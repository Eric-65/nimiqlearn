/* ============================================================
   NimiqLearn — Nimiq Pay wallet service (single source of truth)
   ------------------------------------------------------------
   Every fact this file relies on about the real provider API was
   verified against three sources, most-authoritative first:
     1. The OFFICIAL Nimiq Mini Apps skill, installed via
        `npx skills add nimiq/developer-center --skill mini-apps`
        (`.agents/skills/mini-apps/SKILL.md` and
        `references/nimiq-provider-api.md`) — pulled live from
        nimiq.dev's current documentation source.
     2. The INSTALLED package: node_modules/@nimiq/mini-app-sdk@0.1.0
        (dist/*.js — the actual compiled code that runs).
     3. Its upstream source: github.com/nimiq/trust-web3-provider,
        packages/mini-app-sdk/ and packages/nimiq/NimiqProvider.ts.
   nimiq.dev itself is unreachable from this sandbox's network
   egress policy, which is exactly why the skill above matters: it
   is the current official documentation, fetched at install time,
   without needing direct network access to nimiq.dev from this
   session. No method or event name here is invented — see
   docs/nimiq-pay-integration.md for the full verification trail.

   IMPORTANT CORRECTION vs. an earlier pass of this file: the
   installed package's inline doc comment on sendBasicTransaction()
   says it returns "the serialized transaction". The official skill's
   references/nimiq-provider-api.md explicitly documents the return
   type as `string` **(tx hash)**. Both describe the same method on
   the same installed version (0.1.0) — this is a documentation
   authority question, not a version mismatch (confirmed: installed
   version is still exactly 0.1.0). The skill is the current,
   authoritative source, so this file now treats and labels that
   string as a real transaction hash. See sendNimPayment() below and
   "Payment flow" in docs/nimiq-pay-integration.md for the full
   reasoning.

   Real, confirmed API surface used below:
     init(options?)                    — polls for window.nimiq, default
                                          timeout 10_000ms (installed
                                          package's compiled JS)
     provider.connect()                — internally calls listAccounts()
     provider.disconnect()             — clears cached accounts, emits 'disconnect'
     provider.listAccounts()           — string[] | ErrorResponse, user confirmation
     provider.sign(message)            — { publicKey, signature } | ErrorResponse, user confirmation
     provider.sendBasicTransaction(tx) — string (tx hash) | ErrorResponse, user confirmation
     provider.isConsensusEstablished()  — boolean, no confirmation
     provider.getBlockNumber()          — number, no confirmation
     provider.getNetwork()              — string, always "nimiq" (a provider
                                          identifier, not mainnet/testnet info)
     events: 'connect' (fires once accounts are first fetched),
             'disconnect' (fires on disconnect()) — these are the ONLY
             two events the real provider emits.

   USDT/EVM payments now live in evmWalletService.js — a separate file
   for a separate provider (window.ethereum, not window.nimiq). This
   file's job is the native Nimiq provider only.

   Explicitly NOT implemented in this pass:
     - any balance query method — verified genuinely absent from BOTH
       the Nimiq provider's documented capability list AND its
       WALLET_METHODS set (getNimBalance() always resolves unsupported)
     - any transaction-status/confirmation lookup: the skill's own
       capability table has no such method, and provider.request()
       for anything outside WALLET_METHODS falls through to a raw
       JSON-RPC call against a separate RPC endpoint this app would
       have to configure itself via setRPCUrl() — Nimiq Pay does not
       supply one. See waitForTransaction() below.
   ============================================================ */

import { init as initSdkProvider, getHostLanguage } from "@nimiq/mini-app-sdk";
import { createAuthChallenge, createSession, clearSession, getStoredSession } from "./authService.js";

const LUNAS_PER_NIM = 1e5;
const looksLikeUserRejection = (message) => /reject|cancel|denied|declined/i.test(message || "");

/* ---------------- unified environment/connection state (Part 6) ----------------
   One flat enum: "connected" must never be shown when no provider
   actually exists.
     NIMIQ_PAY_AVAILABLE — provider detected, not yet connected
     BROWSER_MODE        — no provider (normal browser tab)
     INITIALIZING        — connection attempt in flight
     CONNECTED           — real address obtained
     ERROR               — provider detected, but connect/account-fetch
                            genuinely failed (NOT a user rejection —
                            see Part 8: a rejection resets to
                            NIMIQ_PAY_AVAILABLE with a distinct message)
*/
export const NIMIQ_STATUS = {
  NIMIQ_PAY_AVAILABLE: "NIMIQ_PAY_AVAILABLE",
  BROWSER_MODE: "BROWSER_MODE",
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
  blockNumber: null,
  language: null,
  error: null,
  authenticated: null, // { address, authenticatedAt, expiresAt } — see authenticateWithNimiqPay()
};

function detectInitialStatus() {
  if (typeof window === "undefined") return NIMIQ_STATUS.BROWSER_MODE;
  return window.nimiq ? NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE : NIMIQ_STATUS.BROWSER_MODE;
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

/** Part 9's canonical wallet state shape: { status, providerAvailable,
 * address, authenticated, balance, consensusReady, blockNumber, error }
 * (plus a couple of extra, non-required fields: network, language). */
export function getWalletState() {
  return { ...state, providerAvailable: isNimiqPayAvailable() };
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

/** Whether initializeNimiqProvider() has actually completed once this
 * session — distinct from "connected" (Part 56 diagnostics: a provider can
 * be initialized while account access is still pending/rejected). */
export function isProviderInitialized() {
  return provider !== null;
}

/* ---------------- provider initialization (Parts 5-8) ---------------- */

function describeProviderError(err) {
  const message = err?.message || String(err || "Unknown wallet error");
  const notInjected = /not injected|are you running inside/i.test(message);
  return { message, notInjected, rejected: looksLikeUserRejection(message) };
}

async function refreshAccountState() {
  const accounts = await provider.listAccounts();
  if (accounts && !Array.isArray(accounts) && "error" in accounts) {
    throw new Error(accounts.error?.message || "Nimiq Pay did not return an account.");
  }
  const address = accounts?.[0] || null;
  const network = provider.getNetwork();
  const [consensusReady, blockNumber] = await Promise.all([
    getConsensusStatus().catch(() => null),
    getBlockNumber().catch(() => null),
  ]);
  setState({
    status: address ? NIMIQ_STATUS.CONNECTED : NIMIQ_STATUS.ERROR,
    address,
    network,
    consensusReady,
    blockNumber,
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
    blockNumber: null,
    authenticated: null,
  });
  clearSession();
}

/**
 * initializeNimiqProvider() — module-level provider + in-flight promise so
 * concurrent callers share one real init() call, exactly the architecture
 * Part 5 asks for.
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

/**
 * detectNimiqPay() — provider PRESENCE detection only. Safe to run
 * automatically on mount: `init()` and registering event listeners never
 * require user confirmation (per the official skill's capability table).
 * This never calls provider.connect() / listAccounts(), which DOES require
 * confirmation — the skill's own pre-ship checklist is explicit that a
 * mini app must never trigger an approval dialog on page load without user
 * interaction. Detecting whether Nimiq Pay exists is not the same as
 * requesting account access, so it is deliberately split into its own
 * function rather than folded into connectWallet() below.
 */
export async function detectNimiqPay({ timeout } = {}) {
  if (
    state.status === NIMIQ_STATUS.INITIALIZING ||
    state.status === NIMIQ_STATUS.CONNECTED ||
    state.status === NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE
  ) {
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
    return getWalletState();
  } catch (err) {
    const { message, notInjected } = describeProviderError(err);
    providerPromise = null;
    setState({ status: notInjected ? NIMIQ_STATUS.BROWSER_MODE : NIMIQ_STATUS.ERROR, error: message });
    return getWalletState();
  }
}

/**
 * connectWallet() — the real, CONFIRMATION-REQUIRING account request
 * (Part 7). Only ever called from an explicit user action (the "Connect
 * Nimiq Pay" button) — never automatically on mount. Never fabricates a
 * connected state: status only becomes CONNECTED once a real, non-empty
 * address comes back from the provider itself.
 *
 * Part 8 — account rejection is handled distinctly from a genuine error:
 * if the provider's failure looks like a user decline, status resets to
 * NIMIQ_PAY_AVAILABLE (not ERROR) with "Connection cancelled" — the app
 * never marks the user connected, never fabricates an address, and never
 * creates an entitlement from this state.
 */
export async function connectWallet({ timeout } = {}) {
  if (state.status === NIMIQ_STATUS.CONNECTED) {
    return getWalletState();
  }
  if (!provider) {
    const detected = await detectNimiqPay({ timeout });
    if (detected.status !== NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE) return detected;
  }
  setState({ status: NIMIQ_STATUS.INITIALIZING, error: null });
  try {
    await provider.connect(); // real confirmation-requiring call — user-initiated only
    await refreshAccountState();
    return getWalletState();
  } catch (err) {
    const { message, notInjected, rejected } = describeProviderError(err);
    if (notInjected) {
      setState({ status: NIMIQ_STATUS.BROWSER_MODE, error: message });
    } else if (rejected) {
      setState({ status: NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE, error: "Connection cancelled" });
    } else {
      setState({ status: NIMIQ_STATUS.ERROR, error: message });
    }
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
    status: isNimiqPayAvailable() ? NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE : NIMIQ_STATUS.BROWSER_MODE,
    address: null,
    network: null,
    consensusReady: null,
    blockNumber: null,
    authenticated: null,
  });
  clearSession();
}

/* ---------------- account / network primitives (Part 4) ---------------- */

export function getAddress() {
  return state.address;
}

/** Real listAccounts() wrapper. Throws if the provider has not been
 * initialized yet; callers that just want the currently-known address
 * should read getAddress() / wallet state instead. */
export async function listAccounts() {
  if (!provider) throw new Error("Nimiq provider is not initialized. Call connectWallet() first.");
  const accounts = await provider.listAccounts();
  if (accounts && !Array.isArray(accounts) && "error" in accounts) {
    throw new Error(accounts.error?.message || "Nimiq Pay did not return an account list.");
  }
  return accounts;
}

/** Real isConsensusEstablished() wrapper (Parts 4/14). */
export async function getConsensusStatus() {
  if (!provider) return null;
  return provider.isConsensusEstablished();
}

/** Real getBlockNumber() wrapper (Parts 4/15) — the only real, non-stale
 * source of the current network height, e.g. for a future
 * validityStartHeight parameter. Never hard-coded. */
export async function getBlockNumber() {
  if (!provider) return null;
  return provider.getBlockNumber();
}

/**
 * NIM BALANCE — verified unsupported (Part 31). Confirmed against the
 * skill's own capability list (references/nimiq-provider-api.md) as well
 * as the WALLET_METHODS set in the installed provider: neither includes a
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

/* ---------------- payments (Parts 16-24) ---------------- */

/** Integer-safe NIM -> Luna conversion (Part 17). Never uses floating-point
 * arithmetic on the final integer value — rounds once, at the boundary.
 * Rejects non-finite, non-positive, or otherwise invalid amounts. */
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
 * Returns `{ hash, network, asset }`. `hash` is the real transaction hash
 * returned by sendBasicTransaction() — the official skill's
 * references/nimiq-provider-api.md documents this return value explicitly
 * as `string (tx hash)`, so this app now stores and displays it as a real
 * hash. This app never independently computes a replacement hash.
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
  return { hash: result, network: provider.getNetwork(), asset: "NIM" };
}

/**
 * Documented mechanism for tracking a submitted transaction's confirmation
 * status: there isn't one. Even with a real transaction hash in hand
 * (see sendNimPayment() above), the skill's own capability table
 * (references/nimiq-provider-api.md) has no confirmation/status-lookup
 * method, and provider.request() for anything outside WALLET_METHODS needs
 * a self-configured RPC endpoint this app does not provide (Part 23
 * explicitly forbids inventing one). This always resolves "UNKNOWN": the
 * caller (paymentService.js) treats that as "needs manual verification,"
 * never as a fabricated confirmation.
 */
export async function waitForTransaction() {
  return {
    status: "UNKNOWN",
    reason: "No documented transaction-confirmation mechanism is exposed by this Mini App SDK without independently configuring a third-party RPC endpoint.",
  };
}

/* ---------------- sign-in / authentication (Parts 10-13) ---------------- */

/** Real provider.sign() wrapper — the low-level primitive. Never requests
 * a seed phrase, private key, or wallet password: signing a message is the
 * only thing this ever asks the provider for. */
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
 * Composed sign-in flow (Parts 10-12): builds a clear challenge the user
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
