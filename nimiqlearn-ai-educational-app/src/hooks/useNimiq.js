/* ============================================================
   NimiqLearn — useNimiq hook
   ------------------------------------------------------------
   Thin reactive wrapper over nimiqWalletService.js (the single
   source of truth) and paymentService.js.

   On first mount this only ever calls detectNimiqPay() — provider
   PRESENCE detection (init()), which never requires user
   confirmation. It deliberately does NOT call connectWallet() on
   mount: that calls provider.connect() internally, which calls
   listAccounts(), which DOES require user confirmation per the
   official Nimiq Mini Apps skill's own capability table. Auto-
   connecting on mount would mean a native "share your account"
   dialog could appear the instant the mini app opens, with no
   user interaction — exactly the anti-pattern the skill's own
   pre-ship checklist calls out ("The app does not trigger
   approval dialogs on page load without user interaction").
   connectWallet() is only ever invoked from the "Connect Nimiq
   Pay" button (see NimiqWalletStatus.jsx) — a real user click.

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
  detectNimiqPay,
  connectWallet,
  disconnectWallet,
  authenticateWithNimiqPay,
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
    detectNimiqPay().catch(() => {});
  }, []);

  const connect = useCallback(() => connectWallet(), []);
  const disconnect = useCallback(() => disconnectWallet(), []);
  const signIn = useCallback(() => authenticateWithNimiqPay(), []);
  const pay = useCallback((request, options) => processPayment(request, options), []);

  return {
    ...state,
    isConnecting: state.status === NIMIQ_STATUS.INITIALIZING,
    isConnected: state.status === NIMIQ_STATUS.CONNECTED,
    isUnavailable: state.status === NIMIQ_STATUS.BROWSER_MODE,
    isError: state.status === NIMIQ_STATUS.ERROR,
    isAuthenticated: Boolean(state.authenticated),
    connect,
    disconnect,
    signIn,
    pay,
  };
}
