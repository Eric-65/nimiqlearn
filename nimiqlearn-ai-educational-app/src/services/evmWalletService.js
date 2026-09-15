/* ============================================================
   NimiqLearn — Ethereum provider (EVM/USDT) wallet service
   ------------------------------------------------------------
   Mirrors nimiqWalletService.js's architecture (same status
   enum shape, same detect/connect split, same rejection
   handling) but talks to a genuinely different provider: this
   file is the ONLY one that touches window.ethereum, exactly as
   nimiqWalletService.js is the only one that touches window.nimiq.

   Per the official Nimiq Mini Apps skill: Nimiq Pay injects a
   real, standard EIP-1193 provider at window.ethereum — no SDK
   needed, no separate init(). USDT/USDC on it use 6 decimals,
   not 18. ABI encoding for the ERC-20 transfer call uses viem
   (the skill is explicit: "Use an EVM library... Do not manually
   encode contract calls").

   These two providers are independent: a learner can have Nimiq
   Pay's NIM wallet connected while never having granted EVM
   account access, and vice versa. Connecting one never implies
   the other is connected.
   ============================================================ */

import { encodeFunctionData, parseUnits, isAddress } from "viem";
import { EVM_CHAINS } from "../config/evmChains.js";

const looksLikeUserRejection = (err) =>
  err?.code === 4001 || /reject|cancel|denied|declined/i.test(err?.message || "");

/* ---------------- state (mirrors NIMIQ_STATUS's shape) ----------------
     EVM_AVAILABLE — provider detected, not yet connected
     BROWSER_MODE  — no window.ethereum at all
     INITIALIZING  — a request is in flight
     CONNECTED     — a real address obtained
     ERROR         — provider detected, but connect/account-fetch failed
                     (not a user rejection — see connectEvmWallet())
*/
export const EVM_STATUS = {
  EVM_AVAILABLE: "EVM_AVAILABLE",
  BROWSER_MODE: "BROWSER_MODE",
  INITIALIZING: "INITIALIZING",
  CONNECTED: "CONNECTED",
  ERROR: "ERROR",
};

let provider = null;
let listenersRegistered = false;

let state = {
  status: typeof window !== "undefined" && window.ethereum ? EVM_STATUS.EVM_AVAILABLE : EVM_STATUS.BROWSER_MODE,
  address: null,
  chainId: null,
  error: null,
};

const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => {
    try {
      fn(getEvmState());
    } catch {
      /* a bad listener must never break EVM wallet state updates */
    }
  });
}

export function getEvmState() {
  return { ...state };
}

export function subscribeToEvmChanges(fn) {
  listeners.add(fn);
  fn(getEvmState());
  return () => listeners.delete(fn);
}

export function isEthereumProviderAvailable() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

function onAccountsChanged(accounts) {
  const address = accounts?.[0] || null;
  setState({ address, status: address ? EVM_STATUS.CONNECTED : EVM_STATUS.EVM_AVAILABLE });
}

function onChainChanged(chainId) {
  setState({ chainId });
}

/**
 * detectEvmProvider() — provider PRESENCE + already-authorized-accounts
 * check only. `eth_accounts` and `eth_chainId` are both documented
 * read-only methods (no user confirmation) — this never calls
 * `eth_requestAccounts`, which DOES prompt. Safe to run automatically on
 * mount, same reasoning as detectNimiqPay() in nimiqWalletService.js.
 */
export async function detectEvmProvider() {
  // Same bug, same fix as detectNimiqPay() in nimiqWalletService.js: the
  // guard has to prove we HAVE a provider, not that the status label says
  // one is available. The initial state above is set synchronously to
  // EVM_AVAILABLE whenever window.ethereum exists — always true inside
  // Nimiq Pay — so this early-returned on the mount call without ever
  // assigning `provider`, and the first Connect tap died on
  // `provider.request()` with "Cannot read properties of null". The retry
  // succeeded only because the failure had flipped the status to ERROR.
  if (provider) {
    return getEvmState();
  }
  if (!isEthereumProviderAvailable()) {
    setState({ status: EVM_STATUS.BROWSER_MODE });
    return getEvmState();
  }
  provider = window.ethereum;
  setState({ status: EVM_STATUS.INITIALIZING, error: null });
  try {
    if (!listenersRegistered && typeof provider.on === "function") {
      provider.on("accountsChanged", onAccountsChanged);
      provider.on("chainChanged", onChainChanged);
      listenersRegistered = true;
    }
    const [accounts, chainId] = await Promise.all([
      provider.request({ method: "eth_accounts" }),
      provider.request({ method: "eth_chainId" }),
    ]);
    const address = accounts?.[0] || null;
    setState({ status: address ? EVM_STATUS.CONNECTED : EVM_STATUS.EVM_AVAILABLE, address, chainId, error: null });
    return getEvmState();
  } catch (err) {
    setState({ status: EVM_STATUS.ERROR, error: err?.message || "Could not detect the Ethereum provider." });
    return getEvmState();
  }
}

/**
 * connectEvmWallet() — the real, CONFIRMATION-REQUIRING account request
 * (`eth_requestAccounts`). Only ever called from an explicit user action
 * (the "Connect EVM wallet" button) — never automatically on mount, for
 * the same reason connectWallet() in nimiqWalletService.js isn't.
 */
export async function connectEvmWallet() {
  if (state.status === EVM_STATUS.CONNECTED) return getEvmState();
  if (!provider) {
    const detected = await detectEvmProvider();
    if (detected.status === EVM_STATUS.CONNECTED) return detected;
    // Gate on the provider itself rather than the reported status, so a
    // failed detection returns this branch's honest state instead of
    // falling through to dereference null on provider.request() below.
    if (!provider) return detected;
  }
  setState({ status: EVM_STATUS.INITIALIZING, error: null });
  try {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const chainId = await provider.request({ method: "eth_chainId" });
    const address = accounts?.[0] || null;
    setState({
      status: address ? EVM_STATUS.CONNECTED : EVM_STATUS.ERROR,
      address,
      chainId,
      error: address ? null : "No account was returned.",
    });
    return getEvmState();
  } catch (err) {
    const rejected = looksLikeUserRejection(err);
    setState({
      status: rejected ? EVM_STATUS.EVM_AVAILABLE : EVM_STATUS.ERROR,
      error: rejected ? "Connection cancelled" : err?.message || "Connection failed.",
    });
    return getEvmState();
  }
}

/**
 * disconnectEvmWallet() — EIP-1193 has no standard programmatic
 * disconnect method (unlike the Nimiq provider's real disconnect()).
 * This only resets NimiqLearn's own local state; the wallet itself
 * still considers this site authorized until revoked from within
 * Nimiq Pay's own connected-sites settings. Documented honestly rather
 * than implying a real revocation this app cannot perform.
 */
export function disconnectEvmWallet() {
  setState({
    status: isEthereumProviderAvailable() ? EVM_STATUS.EVM_AVAILABLE : EVM_STATUS.BROWSER_MODE,
    address: null,
    chainId: null,
    error: null,
  });
}

async function ensureChain(chainKey) {
  const chain = EVM_CHAINS[chainKey];
  if (!chain) throw new Error(`Unsupported chain: ${chainKey}`);
  const current = await provider.request({ method: "eth_chainId" });
  if (typeof current === "string" && current.toLowerCase() === chain.chainId.toLowerCase()) return chain;
  await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain.chainId }] });
  setState({ chainId: chain.chainId });
  return chain;
}

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

/**
 * Real USDT payment: switches to the requested chain (if needed), then
 * sends a real ERC-20 `transfer` call via `eth_sendTransaction` — the
 * documented pattern (skill: "switch chain, then eth_sendTransaction with
 * a real ABI-encoding library"). Resolves only once the provider itself
 * returns a transaction hash; never resolves from a timer or a guess.
 */
export async function sendUsdtPayment({ chainKey, recipient, amountUsdt } = {}) {
  if (!provider || state.status !== EVM_STATUS.CONNECTED) {
    throw new Error("Connect your EVM wallet before requesting a USDT payment.");
  }
  if (!recipient || !isAddress(recipient)) {
    throw new Error("No valid USDT recipient address configured for this payment.");
  }
  const chain = await ensureChain(chainKey);
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [recipient, parseUnits(String(amountUsdt), chain.usdt.decimals)],
  });
  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from: state.address, to: chain.usdt.address, data }],
  });
  return { hash, chain: chain.name, asset: "USDT" };
}
