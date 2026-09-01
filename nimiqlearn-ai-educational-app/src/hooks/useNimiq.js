/* ============================================================
   NimiqLearn — useNimiq hook
   ------------------------------------------------------------
   Thin reactive wrapper over nimiqWalletService.js (the single
   source of truth) and paymentService.js. Attempts a real
   connection on first mount ONLY — this only ever calls
   listAccounts() through the provider, never a payment or a sign
   request, so it never auto-approves or auto-signs anything
   (item 36).

   `autoConnectAttempted` is module-level, not component state, so
   it is shared across every component that calls this hook (a
   page, the status card, the diagnostics panel can all be mounted
   at once, and the user navigates between pages constantly).
   Without it, every navigation would remount a component that
   calls useNimiq() and restart a fresh ~10s init() poll even
   though the environment (inside Nimiq Pay or not) cannot have
   changed mid-session — a real bug caught by testing navigation
   between pages, not just a single page load. An explicit
   connect()/disconnect() call (Retry, Connect, Disconnect
   buttons) is NOT gated by this — those are user-initiated and
   should always run.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import {
  getWalletState,
  subscribeToWalletChanges,
  connectWallet,
  disconnectWallet,
  authenticateWithNimiqPay,
  isNimiqPayAvailable,
  NIMIQ_STATUS,
} from "../services/nimiqWalletService.js";
import { processPayment } from "../services/paymentService.js";

export { NIMIQ_STATUS };

let autoConnectAttempted = false;

export function useNimiq() {
  const [state, setState] = useState(getWalletState());

  useEffect(() => subscribeToWalletChanges(setState), []);

  useEffect(() => {
    if (autoConnectAttempted) return;
    autoConnectAttempted = true;
    connectWallet().catch(() => {});
  }, []);

  const connect = useCallback(() => connectWallet(), []);
  const disconnect = useCallback(() => disconnectWallet(), []);
  const signIn = useCallback(() => authenticateWithNimiqPay(), []);
  const pay = useCallback((request, options) => processPayment(request, options), []);

  return {
    ...state,
    providerAvailable: isNimiqPayAvailable(),
    isConnecting: state.status === NIMIQ_STATUS.INITIALIZING,
    isConnected: state.status === NIMIQ_STATUS.CONNECTED,
    isUnavailable: state.status === NIMIQ_STATUS.BROWSER_UNAVAILABLE,
    isError: state.status === NIMIQ_STATUS.ERROR,
    isAuthenticated: Boolean(state.authenticated),
    connect,
    disconnect,
    signIn,
    pay,
  };
}
