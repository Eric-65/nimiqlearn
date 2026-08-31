/* ============================================================
   NimiqLearn — Nimiq Pay wallet service (single source of truth)
   ------------------------------------------------------------
   Every fact this file relies on about the real provider API was
   verified directly against:
     - the INSTALLED package: node_modules/@nimiq/mini-app-sdk@0.1.0
     - its upstream source: github.com/nimiq/trust-web3-provider,
       packages/mini-app-sdk/ (SDK wrapper) and packages/nimiq/
       NimiqProvider.ts (the actual provider implementation)
   No method or event name here is invented — see
   docs/nimiq-pay-integration.md for the full verification trail.

   Real, confirmed API surface used below:
     init(options?)                          — polls for window.nimiq
     provider.connect()                      — internally calls listAccounts()
     provider.disconnect()                   — clears cached accounts, emits 'disconnect'
     provider.listAccounts()                 — string[] | ErrorResponse
     provider.sign(message)                  — SignatureResult | ErrorResponse
     provider.sendBasicTransaction(tx)       — string | ErrorResponse (real NIM payment)
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
   ============================================================ */

import { init as initNimiqProvider, getHostLanguage } from "@nimiq/mini-app-sdk";

const LUNAS_PER_NIM = 1e5;
const AUTH_STORAGE_KEY = "nimiqlearn:wallet-auth";
const AUTH_SESSION_MS = 5 * 60 * 1000; // 5 minutes — see signInWithNimiqPay()

export const WALLET_STATUS = {
  UNAVAILABLE: "unavailable", // not running inside Nimiq Pay
  DISCONNECTED: "disconnected", // Nimiq Pay detected, not yet connected
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ERROR: "error", // Nimiq Pay detected, but connection/account fetch failed
};

export const ENVIRONMENT = {
  NIMIQ_PAY_AVAILABLE: "NIMIQ_PAY_AVAILABLE",
  BROWSER_MODE: "BROWSER_MODE",
  UNSUPPORTED: "UNSUPPORTED", // no `window` at all (non-browser render)
};

let provider = null;
let listenersRegistered = false;

let state = {
  environment: detectEnvironmentSync(),
  status: WALLET_STATUS.DISCONNECTED,
  address: null,
  balance: null, // see getBalance() — always null, never fabricated
  network: null,
  consensus: null,
  blockNumber: null,
  language: null,
  error: null,
  auth: null, // { address, authenticatedAt, expiresAt } — see signInWithNimiqPay()
};
state.status = state.environment === ENVIRONMENT.NIMIQ_PAY_AVAILABLE ? WALLET_STATUS.DISCONNECTED : WALLET_STATUS.UNAVAILABLE;

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

/* ---------------- environment detection (item 6) ---------------- */

function detectEnvironmentSync() {
  if (typeof window === "undefined") return ENVIRONMENT.UNSUPPORTED;
  return window.nimiq ? ENVIRONMENT.NIMIQ_PAY_AVAILABLE : ENVIRONMENT.BROWSER_MODE;
}

/** Instant, synchronous snapshot — window.nimiq can still be injected a
 * little AFTER this returns false (the host injects asynchronously), so
 * connectWallet() always does the real timeout-based init() poll rather
 * than trusting this alone. Use this only for immediate UI labeling. */
export function isNimiqPayAvailable() {
  return detectEnvironmentSync() === ENVIRONMENT.NIMIQ_PAY_AVAILABLE;
}

export function detectEnvironment() {
  return detectEnvironmentSync();
}

/* ---------------- connection (items 3/4/7/8) ---------------- */

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
  const [consensus, blockNumber] = await Promise.all([
    provider.isConsensusEstablished().catch(() => null),
    provider.getBlockNumber().catch(() => null),
  ]);
  setState({
    status: address ? WALLET_STATUS.CONNECTED : WALLET_STATUS.ERROR,
    address,
    network,
    consensus,
    blockNumber,
    error: address ? null : "Nimiq Pay did not return an account.",
  });
  // Rehydrate a still-valid prior sign-in for this exact address, so a
  // page reload doesn't silently drop a session that hasn't expired.
  if (address) setState({ auth: getStoredAuthSession() });
}

function onProviderConnect() {
  refreshAccountState().catch((err) => setState({ status: WALLET_STATUS.ERROR, error: describeProviderError(err).message }));
}

function onProviderDisconnect() {
  setState({
    status: WALLET_STATUS.DISCONNECTED,
    address: null,
    network: null,
    consensus: null,
    blockNumber: null,
  });
  clearStoredAuth();
}

/**
 * Real connection flow: init() polls for window.nimiq (real timeout-based
 * implementation — see docs), then provider.connect() (which itself calls
 * listAccounts() — verified in the upstream source). Never fabricates a
 * connected state: status only becomes CONNECTED once a real address is
 * returned by the provider.
 *
 * `useNimiq()` calls this from a mount effect in every component that uses
 * it (several can be mounted at once — page + status card + diagnostics
 * panel). Guarded against concurrent/duplicate calls: if a connection is
 * already in flight or established, later callers just get the current
 * state (they already receive live updates via subscribeToWalletChanges).
 * `provider` is a module-level singleton, so event listeners are attached
 * at most once per provider instance — never once per useNimiq() caller.
 */
export async function connectWallet({ timeout = 8000 } = {}) {
  if (state.status === WALLET_STATUS.CONNECTING || state.status === WALLET_STATUS.CONNECTED) {
    return getWalletState();
  }
  setState({ status: WALLET_STATUS.CONNECTING, error: null });
  try {
    if (!provider) {
      provider = await initNimiqProvider({ timeout });
    }
    if (!listenersRegistered) {
      provider.on("connect", onProviderConnect);
      provider.on("disconnect", onProviderDisconnect);
      listenersRegistered = true;
    }
    setState({ environment: ENVIRONMENT.NIMIQ_PAY_AVAILABLE, language: getHostLanguage() || null });

    await provider.connect();
    await refreshAccountState();
    return getWalletState();
  } catch (err) {
    const { message, notInjected } = describeProviderError(err);
    setState({
      status: notInjected ? WALLET_STATUS.UNAVAILABLE : WALLET_STATUS.ERROR,
      environment: notInjected ? ENVIRONMENT.BROWSER_MODE : state.environment,
      error: message,
    });
    return getWalletState();
  }
}

/**
 * disconnectWallet() vs. local reset — documented distinction (item 14):
 * when a real provider connection exists, this calls its OWN disconnect()
 * (real method, verified: clears the provider's cached account list and
 * emits 'disconnect', which onProviderDisconnect() above reacts to). When
 * there is no provider (browser mode, or connection never succeeded),
 * there is nothing to disconnect FROM — this just resets NimiqLearn's own
 * local UI state, which is a fundamentally different thing from revoking
 * a real wallet session (there is no such session to revoke).
 */
export function disconnectWallet() {
  if (provider && typeof provider.disconnect === "function") {
    provider.disconnect(); // real disconnect — triggers onProviderDisconnect via the 'disconnect' event
    return;
  }
  // Local-only reset (see doc comment above).
  setState({
    status: state.environment === ENVIRONMENT.NIMIQ_PAY_AVAILABLE ? WALLET_STATUS.DISCONNECTED : WALLET_STATUS.UNAVAILABLE,
    address: null,
    network: null,
    consensus: null,
    blockNumber: null,
  });
  clearStoredAuth();
}

export function getAddress() {
  return state.address;
}

/**
 * BALANCE — verified unsupported. The real provider's WALLET_METHODS set
 * (listAccounts, sign, sendBasicTransaction, sendBasicTransactionWithData,
 * plus staking transactions) contains no balance getter. Any other method
 * name passed to provider.request() falls through to a raw JSON-RPC call
 * against a SEPARATE, self-configured RPC endpoint (setRPCUrl()) that
 * Nimiq Pay does not supply — querying a real balance would mean this app
 * independently trusting a third-party Albatross RPC node, a materially
 * different (and currently unimplemented) trust model. This function
 * therefore always resolves unsupported rather than a fabricated number.
 */
export async function getBalance() {
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

/* ---------------- payments (items 19-24, 30) ---------------- */

/**
 * Real NIM payment — the SDK has no separate "payment request" concept;
 * a payment IS a signed transaction, submitted via the wallet's native
 * confirmation UI. Resolves only once the provider itself returns a
 * result; never resolves "success" from a timer or a guess.
 */
export async function requestNimPayment({ recipient, amountNim }) {
  if (!provider || state.status !== WALLET_STATUS.CONNECTED) {
    throw new Error("Connect your Nimiq Pay wallet before requesting a payment.");
  }
  const valueLunas = Math.round(Number(amountNim) * LUNAS_PER_NIM);
  const result = await provider.sendBasicTransaction({ recipient, value: valueLunas });
  if (result && typeof result === "object" && "error" in result) {
    throw new Error(result.error?.message || "Nimiq Pay did not confirm this transaction.");
  }
  return { serialized: result, network: provider.getNetwork(), asset: "NIM" };
}

/** USDT is not implemented — see getUsdtSupportStatus(). Never fakes a
 * transaction; the UI must call getUsdtSupportStatus() before offering
 * this asset as a payment option at all. */
export async function requestUsdtPayment() {
  throw new Error("USDT payment support is not available in this environment yet.");
}

/* ---------------- sign-in / authentication (items 15-18) ---------------- */

function secureNonce() {
  const cryptoObj = typeof crypto !== "undefined" ? crypto : globalThis.crypto;
  if (!cryptoObj?.getRandomValues) throw new Error("A secure random source is not available in this environment.");
  const bytes = new Uint8Array(16);
  cryptoObj.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildSignInMessage({ address, nonce, issuedAt, expiresAt }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "unknown-origin";
  return [
    "Sign in to NimiqLearn",
    "",
    `Origin: ${origin}`,
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt}`,
    `Expires: ${expiresAt}`,
  ].join("\n");
}

function persistAuthSession(session) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable — session still works for this page load via state */
  }
}

function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  setState({ auth: null });
}

/**
 * Optional message-signing authentication (item 15/16/17). A fresh
 * cryptographically-random nonce (crypto.getRandomValues, never
 * Math.random) and a short expiry are the ONLY replay defenses available
 * client-side — there is no backend here to track spent nonces server-
 * side, so this is a prototype auth model, not a production one. See
 * docs/nimiq-pay-integration.md, "Security model".
 *
 * Never signs anything the user doesn't see: the exact message text is
 * passed to provider.sign(), which is Nimiq Pay's own confirmation UI —
 * this app has no way to sign "hidden" data through this API.
 */
export async function signInWithNimiqPay() {
  if (!provider || state.status !== WALLET_STATUS.CONNECTED || !state.address) {
    throw new Error("Connect your wallet before signing in.");
  }
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + AUTH_SESSION_MS);
  const nonce = secureNonce();
  const message = buildSignInMessage({
    address: state.address,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  const result = await provider.sign(message);
  if (result && "error" in result) {
    throw new Error(result.error?.message || "Sign-in was rejected.");
  }

  // Only the minimum session metadata is stored — never the signature or
  // public key. localStorage is not cryptographic proof of anything; it
  // is a convenience so the UI can show "signed in" without re-prompting
  // every render. See item 18.
  const session = {
    address: state.address,
    authenticatedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  persistAuthSession(session);
  setState({ auth: session });
  return session;
}

export function getStoredAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.expiresAt || new Date(session.expiresAt).getTime() < Date.now()) {
      clearStoredAuth();
      return null;
    }
    if (session.address !== state.address) return null; // different account — not this session's proof
    return session;
  } catch {
    return null;
  }
}
