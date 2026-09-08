/* ============================================================
   NimiqLearn — useEvmWallet hook
   ------------------------------------------------------------
   Thin reactive wrapper over evmWalletService.js — mirrors
   useNimiq.js exactly. On mount this only ever calls
   detectEvmProvider() (read-only eth_accounts/eth_chainId, no
   confirmation) — never connectEvmWallet() (eth_requestAccounts,
   which DOES prompt), for the same anti-pattern reason documented
   in useNimiq.js.

   `autoDetectAttempted` is module-level for the same reason as
   useNimiq.js's `autoConnectAttempted`: many components can mount
   at once, and the environment can't change mid-session.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import {
  getEvmState,
  subscribeToEvmChanges,
  detectEvmProvider,
  connectEvmWallet,
  disconnectEvmWallet,
  EVM_STATUS,
} from "../services/evmWalletService.js";

export { EVM_STATUS };

let autoDetectAttempted = false;

export function useEvmWallet() {
  const [state, setState] = useState(getEvmState());

  useEffect(() => subscribeToEvmChanges(setState), []);

  useEffect(() => {
    if (autoDetectAttempted) return;
    autoDetectAttempted = true;
    detectEvmProvider().catch(() => {});
  }, []);

  const connect = useCallback(() => connectEvmWallet(), []);
  const disconnect = useCallback(() => disconnectEvmWallet(), []);

  return {
    ...state,
    isConnecting: state.status === EVM_STATUS.INITIALIZING,
    isConnected: state.status === EVM_STATUS.CONNECTED,
    isUnavailable: state.status === EVM_STATUS.BROWSER_MODE,
    isError: state.status === EVM_STATUS.ERROR,
    connect,
    disconnect,
  };
}
