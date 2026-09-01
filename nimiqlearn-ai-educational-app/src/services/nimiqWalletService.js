/* ============================================================
   NimiqLearn — Nimiq Pay wallet service (single source of truth)
   ------------------------------------------------------------
   Every fact this file relies on about the real provider API was
   verified directly against:
     - the INSTALLED package: node_modules/@nimiq/mini-app-sdk@0.1.0
       (dist/*.js — the actual compiled code that runs, not just
       its .d.ts types)
     - its upstream source: github.com/nimiq/trust-web3-provider,
       packages/mini-app-sdk/ (SDK wrapper) and packages/nimiq/
       NimiqProvider.ts (the actual provider implementation)
   nimiq.dev (the current official docs host named in the Prompt 9
   spec) is unreachable from this sandbox's network egress policy;
   the installed package + upstream source are the next-best real
   ground truth and are the same two sources used throughout this
   file. No method or event name here is invented — see
   docs/nimiq-pay-integration.md for the full verification trail.

   Real, confirmed API surface used below:
     init(options?)                    — polls for window.nimiq, default
                                          timeout 10_000ms (read from the
                                          installed package's compiled JS)
     provider.connect()                — internally calls listAccounts()
     provider.disconnect()             — clears cached accounts, emits 'disconnect'
     provider.listAccounts()           — string[] | ErrorResponse
     provider.sign(message)            — SignatureResult | ErrorResponse
     provider.sendBasicTransaction(tx) — string | ErrorResponse (real NIM payment;
                                          the SDK's own doc comment says this
                                          returns "the serialized transaction",
                                          NOT a separately-computed hash — see
                                          sendNimPayment() below)
     provider.isConsensusEstablished()
     provider.getBlockNumber()
     provider.getNetwork()
     events: 'connect' (fires once accounts are first fetched),
             'disconnect' (fires on disconnect()) — these are the ONLY
             two events the real provider emits; there is no
             'accountsChanged' or similar in this SDK version.

   Explicitly NOT implemented, because they do not exist in the real SDK:
     - any balance query method (getBalance always resolves unsupported)
     - any USDT / EVM / window.ethereum integration (zero such code in
       @nimiq/mini-app-sdk or its upstream nimiq provider package)
     - any transaction-status/confirmation-count lookup: provider.request()
       only recognizes the WALLET_METHODS set above; anything else falls
       through to a raw JSON-RPC call against a separate RPC endpoint this
       app would have to configure itself via setRPCUrl() — Nimiq Pay does
       not supply one. Inventing one would mean silently trusting a
       third-party RPC node this app doesn't control, so this file does
       not do it. See waitForTransaction() below.
   ============================================================ */

import { init as initSdkProvider, getHostLanguage } from "@nimiq/mini-app-sdk";
import { createAuthChallenge, createSession, clearSession, getStoredSession } from "./authService.js";

const LUNAS_PER_NIM = 1e5;

/* ---------------- unified environment/connection state (item 6) ----------------
   A single flat enum, not two separate ones — the spec is explicit that
   "connected" must never be shown when no provider actually exists, so
   there is exactly one status value per real situation:
     NIMIQ_PAY_AVAILABLE — provider detected, not yet connected
     BROWSER_UNAVAILABLE — no provider (normal browser tab)
     INITIALIZING        — connection attempt in flight
     CONNECTED           — real address obtained
     ERROR               — provider detected, but connect/account-fetch failed
*/
export const NIMIQ_STATUS = {
  NIMIQ_PAY_AVAILABLE: "NIMIQ_PAY_AVAILABLE",
  BROWSER_UNAVAILABLE: "BROWSER_UNAVAILABLE",
  INITIALIZING: "INITIALIZING",
  CONNECTED: "CONNECTED",
  ERROR: "ERROR",
};

let provider = null;
let listenersRegistered = false;

let state = {
  status: detectInitialStatus(),
  address: null,
  balance: null, // see getNimBalance() below — always null, never fabricated
  network: null,
  consensusReady: null,
  networkHeight: null,
  language: null,
  error: null,
  authenticated: null, // { address, authenticatedAt, expiresAt } — see authenticateWithNimiqPay()
};

function detectInitialStatus() {
  if (typeof window === "undefined") return NIMIQ_STATUS.BROWSER_UNAVAILABLE;
  return window.nimiq ? NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE : NIMIQ_STATUS.BROWSER_UNAVAILABLE;
}

const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => {
    try {
      fn(getWalletState());
    } catch {
      /* a bad listener must never break wallet state updates */
    }
  });
}

export function getWalletState() {
  return { ...state };
}

export function subscribeToWalletChanges(fn) {
  listeners.add(fn);
  fn(getWalletState());
  return () => listeners.delete(fn);
}

/** Instant, synchronous snapshot — window.nimiq can still be injected a
 * little AFTER this returns false (the host injects asynchronously), so
 * initializeNimiqProvider() always does the real timeout-based init() poll
 * rather than trusting this alone. Use this only for immediate UI labeling. */
export function isNimiqPayAvailable() {
  return typeof window !== "undefined" && Boolean(window.nimiq);
}

/* ---------------- provider initialization (items 3-8) ---------------- */

function describeProviderError(err) {
  const message = err?.message || String(err || "Unknown wallet error");
  const notInjected = /not injected|are you running inside/i.test(message);
  return { message, notInjected };
}

async function refreshAccountState() {
  const accounts = await provider.listAccounts();
  if (accounts && !Array.isArray(accounts) && "error" in accounts) {
    throw new Error(accounts.error?.message || "Nimiq Pay did not return an account.");
  }
  const address = accounts?.[0] || null;
  const network = provider.getNetwork();
  const [consensusReady, networkHeight] = await Promise.all([
    getConsensusStatus().catch(() => null),
    getBlockNumber().catch(() => null),
  ]);
  setState({
    status: address ? NIMIQ_STATUS.CONNECTED : NIMIQ_STATUS.ERROR,
    address,
    network,
    consensusReady,
    networkHeight,
    error: address ? null : "Nimiq Pay did not return an account.",
  });
  // Rehydrate a still-valid prior sign-in for this exact address, so a
  // page reload doesn't silently drop a session that hasn't expired.
  if (address) setState({ authenticated: getStoredSession(address) });
}

function onProviderConnect() {
  refreshAccountState().catch((err) => setState({ status: NIMIQ_STATUS.ERROR, error: describeProviderError(err).message }));
}

function onProviderDisconnect() {
  setState({
    status: NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE,
    address: null,
    network: null,
    consensusReady: null,
    networkHeight: null,
    authenticated: null,
  });
  clearSession();
}

/**
 * initializeNimiqProvider() — the exact architecture the spec asks for
 * (module-level provider + in-flight promise so concurrent callers share
 * one real init() call), extended with the connection step: `useNimiq()`
 * calls this from a mount effect in every component that uses it (several
 * can be mounted at once — page + status card + diagnostics panel), so
 * this is guarded against duplicate concurrent connects. It never fabricates
 * a connected state: status only becomes CONNECTED once a real, non-empty
 * address comes back from the provider itself.
 */
let providerPromise = null;

export async function initializeNimiqProvider({ timeout } = {}) {
  if (provider) return provider;
  if (!providerPromise) {
    providerPromise = initSdkProvider(timeout != null ? { timeout } : undefined);
  }
  provider = await providerPromise;
  return provider;
}

export async function connectWallet({ timeout } = {}) {
  if (state.status === NIMIQ_STATUS.INITIALIZING || state.status === NIMIQ_STATUS.CONNECTED) {
    return getWalletState();
  }
  setState({ status: NIMIQ_STATUS.INITIALIZING, error: null });
  try {
    await initializeNimiqProvider({ timeout });
    if (!listenersRegistered) {
      provider.on("connect", onProviderConnect);
      provider.on("disconnect", onProviderDisconnect);
      listenersRegistered = true;
    }
    setState({ status: NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE, language: getHostLanguage() || null });

    await provider.connect();
    await refreshAccountState();
    return getWalletState();
  } catch (err) {
    const { message, notInjected } = describeProviderError(err);
    providerPromise = null;
    setState({
      status: notInjected ? NIMIQ_STATUS.BROWSER_UNAVAILABLE : NIMIQ_STATUS.ERROR,
      error: message,
    });
    return getWalletState();
  }
}

/**
 * disconnectWallet() vs. local reset — documented distinction: when a real
 * provider connection exists, this calls its OWN disconnect() (real method,
 * verified: clears the provider's cached account list and emits
 * 'disconnect', which onProviderDisconnect() above reacts to). When there
 * is no provider (browser mode, or connection never succeeded), there is
 * nothing to disconnect FROM — this just resets NimiqLearn's own local UI
 * state, which is a fundamentally different thing from revoking a real
 * wallet session (there is no such session to revoke).
 */
export function disconnectWallet() {
  if (provider && typeof provider.disconnect === "function") {
    provider.disconnect(); // real disconnect — triggers onProviderDisconnect via the 'disconnect' event
    return;
  }
  setState({
    status: isNimiqPayAvailable() ? NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE : NIMIQ_STATUS.BROWSER_UNAVAILABLE,
    address: null,
    network: null,
    consensusReady: null,
    networkHeight: null,
    authenticated: null,
  });
  clearSession();
}

/* ---------------- account / network primitives (item 4) ---------------- */

export function getAddress() {
  return state.address;
}

/** Real listAccounts() wrapper — item 7/4's named primitive. Throws if the
 * provider has not been initialized yet; callers that just want the
 * currently-known address should read getAddress() / wallet state instead. */
export async function listAccounts() {
  if (!provider) throw new Error("Nimiq provider is not initialized. Call connectWallet() first.");
  const accounts = await provider.listAccounts();
  if (accounts && !Array.isArray(accounts) && "error" in accounts) {
    throw new Error(accounts.error?.message || "Nimiq Pay did not return an account list.");
  }
  return accounts;
}

/** Real isConsensusEstablished() wrapper (items 4/27). */
export async function getConsensusStatus() {
  if (!provider) return null;
  return provider.isConsensusEstablished();
}

/** Real getBlockNumber() wrapper (items 4/28) — the only real, non-stale
 * source of the current network height, e.g. for a future
 * validityStartHeight parameter. Never hard-coded. */
export async function getBlockNumber() {
  if (!provider) return null;
  return provider.getBlockNumber();
}

/**
 * NIM BALANCE — verified unsupported (item 26). The real provider's
 * WALLET_METHODS set (listAccounts, sign, sendBasicTransaction,
 * sendBasicTransactionWithData, plus staking transactions) contains no
 * balance getter. Any other method name passed to provider.request() falls
 * through to a raw JSON-RPC call against a SEPARATE, self-configured RPC
 * endpoint (setRPCUrl()) that Nimiq Pay does not supply — querying a real
 * balance would mean this app independently trusting a third-party
 * Albatross RPC node, a materially different (and currently unimplemented)
 * trust model. This function therefore always resolves unsupported rather
 * than a fabricated number.
 */
export async function getNimBalance() {
  return {
    amount: null,
    asset: "NIM",
    supported: false,
    reason:
      "The Nimiq Mini App SDK does not expose a balance query method. Displaying a balance would require this app to independently trust a separate RPC endpoint, which it does not do.",
  };
}

export function getUsdtSupportStatus() {
  // Verified UNSUPPORTED: no EVM/USDT method or window.ethereum reference
  // exists anywhere in @nimiq/mini-app-sdk or its upstream Nimiq provider.
  return "UNSUPPORTED";
}

/* ---------------- payments (items 13-22) ---------------- */

/** Integer-safe NIM -> Luna conversion (item 14). Never uses floating-point
 * arithmetic on the final integer value — rounds once, at the boundary. */
export function nimToLuna(amountNim) {
  const n = Number(amountNim);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid NIM amount: ${amountNim}`);
  return Math.round(n * LUNAS_PER_NIM);
}

/**
 * Real NIM payment — the SDK has no separate "payment request" concept; a
 * payment IS a signed transaction, submitted via the wallet's native
 * confirmation UI. Resolves only once the provider itself returns a result;
 * never resolves from a timer or a guess.
 *
 * Returns `{ serialized, network, asset }`. IMPORTANT: `serialized` is what
 * the installed SDK's own doc comment calls "the serialized transaction" —
 * NOT a separately-computed Nimiq protocol transaction hash. Computing that
 * canonical hash would require re-implementing Nimiq's transaction
 * serialization + Blake2b hashing outside any documented SDK method, which
 * risks silently producing a hash that does not match the real one on
 * chain — worse than being explicit that this is a real, verifiable
 * transaction reference from the real provider call, not an independently
 * computed hash. See docs/nimiq-pay-integration.md.
 */
export async function sendNimPayment({ recipient, amountNim, fee, validityStartHeight } = {}) {
  if (!provider || state.status !== NIMIQ_STATUS.CONNECTED) {
    throw new Error("Connect your Nimiq Pay wallet before requesting a payment.");
  }
  if (!recipient) {
    throw new Error("No recipient address configured for this payment.");
  }
  const tx = { recipient, value: nimToLuna(amountNim) };
  if (fee != null) tx.fee = nimToLuna(fee);
  if (validityStartHeight != null) tx.validityStartHeight = validityStartHeight;

  const result = await provider.sendBasicTransaction(tx);
  if (result && typeof result === "object" && "error" in result) {
    throw new Error(result.error?.message || "Nimiq Pay did not confirm this transaction.");
  }
  return { serialized: result, network: provider.getNetwork(), asset: "NIM" };
}

/** USDT is not implemented — see getUsdtSupportStatus() (item 41). Never
 * fakes a transaction; the UI must call getUsdtSupportStatus() before
 * offering this asset as a payment option at all. */
export async function requestUsdtPayment() {
  throw new Error("USDT payment support is not available in this environment yet.");
}

/**
 * Documented mechanism for tracking a submitted transaction: there isn't
 * one. sendBasicTransaction() returns the serialized transaction, not a
 * hash to look up, and the SDK's request() only recognizes the
 * WALLET_METHODS set — everything else needs a self-configured RPC
 * endpoint this app does not provide. Rather than inventing a status
 * endpoint (explicitly disallowed — item 19), this always resolves
 * "UNKNOWN": the caller (paymentService.js) treats that as "needs manual
 * verification," never as a fabricated confirmation.
 */
export async function waitForTransaction() {
  return { status: "UNKNOWN", reason: "No documented transaction-status mechanism is exposed by this Mini App SDK without independently configuring a third-party RPC endpoint." };
}

/* ---------------- sign-in / authentication (items 9-12) ---------------- */

/** Real provider.sign() wrapper — the low-level primitive (item 9). Never
 * requests a seed phrase, private key, or wallet password: signing a
 * message is the only thing this ever asks the provider for. */
export async function signMessage(message) {
  if (!provider || state.status !== NIMIQ_STATUS.CONNECTED) {
    throw new Error("Connect your wallet before signing a message.");
  }
  const result = await provider.sign(message);
  if (result && "error" in result) {
    throw new Error(result.error?.message || "Signing was rejected.");
  }
  return result; // { publicKey, signature }
}

/**
 * Composed sign-in flow (items 9-11): builds a clear challenge the user
 * reads before approving (authService.createAuthChallenge), calls the real
 * signMessage(), and on success stores ONLY minimal session metadata via
 * authService — never the signature or public key.
 *
 * Connection and authentication are deliberately separate states: a
 * connected account is NOT automatically authenticated. This only ever
 * runs when explicitly invoked by the user pressing "Sign in".
 */
export async function authenticateWithNimiqPay() {
  if (!provider || state.status !== NIMIQ_STATUS.CONNECTED || !state.address) {
    throw new Error("Connect your wallet before signing in.");
  }
  const { message, issuedAt, expiresAt } = createAuthChallenge({ address: state.address });
  await signMessage(message); // signature itself is intentionally discarded — see authService.js doc comment
  const session = createSession({ address: state.address, issuedAt, expiresAt });
  setState({ authenticated: session });
  return session;
}

export { getStoredSession } from "./authService.js";
