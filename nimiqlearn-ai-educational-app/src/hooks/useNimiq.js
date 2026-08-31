/* ============================================================
   NimiqLearn — useNimiq hook
   ------------------------------------------------------------
   Thin reactive wrapper over nimiqWalletService.js (the single
   source of truth) and paymentService.js. Attempts a real
   connection on mount — this only ever calls listAccounts()
   through the provider, never a payment or a sign request, so it
   never auto-approves or auto-signs anything (see item 51).
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import {
  getWalletState,
  subscribeToWalletChanges,
  connectWallet,
  disconnectWallet,
  signInWithNimiqPay,
  WALLET_STATUS,
  ENVIRONMENT,
} from "../services/nimiqWalletService.js";
import { processPayment } from "../services/paymentService.js";

export { WALLET_STATUS, ENVIRONMENT };

export function useNimiq() {
  const [state, setState] = useState(getWalletState());

  useEffect(() => subscribeToWalletChanges(setState), []);

  // Real environment/account detection only — see module doc.
  useEffect(() => {
    connectWallet().catch(() => {});
  }, []);

  const connect = useCallback(() => connectWallet(), []);
  const disconnect = useCallback(() => disconnectWallet(), []);
  const signIn = useCallback(() => signInWithNimiqPay(), []);
  const pay = useCallback((request, options) => processPayment(request, options), []);

  return {
    ...state,
    isConnecting: state.status === WALLET_STATUS.CONNECTING,
    isConnected: state.status === WALLET_STATUS.CONNECTED,
    isUnavailable: state.status === WALLET_STATUS.UNAVAILABLE,
    isError: state.status === WALLET_STATUS.ERROR,
    connect,
    disconnect,
    signIn,
    pay,
  };
}
