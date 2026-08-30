/* ============================================================
   NimiqLearn — useNimiq hook
   ------------------------------------------------------------
   Exposes the Nimiq Pay environment state (mode, accounts,
   consensus, block number) and a pay() helper that routes
   through the real provider or the labelled demo simulation.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { initNimiq, onNimiqState, getNimiqState } from "../services/nimiqService.js";
import { processPayment } from "../services/paymentService.js";

export function useNimiq() {
  const [state, setState] = useState(getNimiqState());

  useEffect(() => {
    initNimiq().then(setState).catch(() => {});
  }, []);

  useEffect(() => onNimiqState(setState), []);

  const pay = useCallback(async (request) => processPayment(request), []);

  const refresh = useCallback(() => {
    initNimiq().then(setState).catch(() => {});
  }, []);

  return { ...state, pay, refresh };
}
