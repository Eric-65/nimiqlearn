/* ============================================================
   NimiqLearn — Payment service
   ------------------------------------------------------------
   Delegates every real wallet/provider action to
   nimiqWalletService.js — this file never talks to window.nimiq
   directly. A transaction is reported successful ONLY when the
   real provider call resolves with a real result; the browser
   DEMO simulation path is the one deliberate exception, and it
   is always clearly labelled and never claims to be a real
   blockchain transaction.
   ============================================================ */

import {
  getWalletState,
  WALLET_STATUS,
  requestNimPayment,
  getUsdtSupportStatus,
} from "./nimiqWalletService.js";

export const TRANSACTION_STATE = {
  IDLE: "idle",
  REQUESTING: "requesting",
  AWAITING_APPROVAL: "awaitingApproval",
  SUBMITTED: "submitted",
  CONFIRMED: "confirmed",
  REJECTED: "rejected",
  FAILED: "failed",
};

const PAYMENT_TIMEOUT_MS = 60_000;

export function buildPaymentRequest(pack) {
  return {
    productId: pack.id,
    amount: pack.price,
    asset: pack.asset || "NIM",
    recipient: pack.recipient,
    purpose: pack.purpose || "Educational learning pack",
    title: pack.title,
  };
}

/** NIM is real (sendBasicTransaction, verified). USDT is verified
 * unsupported by the installed Mini App SDK — never presented as "real"
 * regardless of environment. See docs/nimiq-pay-integration.md. */
export function getSupportedAssets() {
  const usdtSupported = getUsdtSupportStatus() === "SUPPORTED";
  return [
    { asset: "NIM", network: "Nimiq", real: true },
    { asset: "USDT", network: usdtSupported ? "Nimiq Pay EVM" : "Not available in this Mini App SDK", real: usdtSupported },
  ];
}

function randomId(length = 6) {
  const cryptoObj = typeof crypto !== "undefined" ? crypto : globalThis.crypto;
  const bytes = new Uint8Array(length);
  cryptoObj.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("").toUpperCase();
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("PAYMENT_TIMEOUT")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const looksLikeUserRejection = (message) => /reject|cancel|denied|declined/i.test(message || "");

/**
 * Execute a payment and report its real outcome.
 *
 * Returns one of three shapes, distinguished by `status`:
 *  - "success"   — transactionState CONFIRMED. `simulated` tells you
 *                   whether this was a real Nimiq Pay transaction or an
 *                   explicitly-labelled DEMO MODE simulation.
 *  - "rejected"  — the user explicitly declined in their wallet. Safe to
 *                   say the wallet was not charged (nothing was ever
 *                   broadcast).
 *  - "uncertain" — anything else that didn't resolve to success: a
 *                   provider error we can't classify, or a timeout. We
 *                   do NOT claim the wallet was or wasn't charged here —
 *                   see item 23: only "success" or "rejected" make that
 *                   claim, because only those cases give us grounds to.
 *
 * `onStateChange(transactionState)` fires through the TRANSACTION_STATE
 * enum so the UI can show real stage labels (never a fake percentage).
 */
export async function processPayment(request, { onStateChange } = {}) {
  const emit = (s) => onStateChange?.(s);
  const wallet = getWalletState();

  if (wallet.status === WALLET_STATUS.CONNECTED) {
    if (request.asset !== "NIM") {
      emit(TRANSACTION_STATE.FAILED);
      return {
        transactionState: TRANSACTION_STATE.FAILED,
        status: "failed",
        simulated: false,
        error: "USDT payment support is not available in this environment yet.",
        detail: "Only NIM payments are currently supported by this Mini App SDK.",
      };
    }

    emit(TRANSACTION_STATE.AWAITING_APPROVAL);
    try {
      const result = await withTimeout(
        requestNimPayment({ recipient: request.recipient, amountNim: request.amount }),
        PAYMENT_TIMEOUT_MS
      );
      emit(TRANSACTION_STATE.CONFIRMED);
      return {
        transactionState: TRANSACTION_STATE.CONFIRMED,
        status: "success",
        simulated: false,
        purchaserAddress: wallet.address,
        reference: result.serialized,
        provider: "Nimiq Pay",
        asset: "NIM",
        detail: "Transaction signed and submitted by Nimiq Pay.",
      };
    } catch (err) {
      if (err.message === "PAYMENT_TIMEOUT") {
        emit(TRANSACTION_STATE.SUBMITTED);
        return {
          transactionState: TRANSACTION_STATE.SUBMITTED,
          status: "uncertain",
          simulated: false,
          error: "Payment status could not be confirmed. Please check your wallet before trying again.",
          detail: "Nimiq Pay did not respond within the expected time.",
        };
      }
      const rejected = looksLikeUserRejection(err.message);
      emit(rejected ? TRANSACTION_STATE.REJECTED : TRANSACTION_STATE.FAILED);
      return {
        transactionState: rejected ? TRANSACTION_STATE.REJECTED : TRANSACTION_STATE.FAILED,
        status: rejected ? "rejected" : "uncertain",
        simulated: false,
        error: rejected
          ? "Payment was cancelled. Your wallet was not charged."
          : "Payment status could not be confirmed. Please check your wallet before trying again.",
        detail: err.message || "Nimiq Pay did not confirm this payment.",
      };
    }
  }

  // ---- Browser DEMO simulation — explicit, always labelled, never a
  // real transaction. Runs only when no wallet is connected at all. ----
  emit(TRANSACTION_STATE.REQUESTING);
  await new Promise((r) => setTimeout(r, 1400));
  emit(TRANSACTION_STATE.CONFIRMED);
  return {
    transactionState: TRANSACTION_STATE.CONFIRMED,
    status: "success",
    simulated: true,
    purchaserAddress: null,
    reference: `SIM-${randomId()}`,
    provider: "DEMO MODE (simulation)",
    asset: request.asset,
    detail: `Simulated ${request.amount} ${request.asset} payment. No blockchain transaction occurred.`,
  };
}
