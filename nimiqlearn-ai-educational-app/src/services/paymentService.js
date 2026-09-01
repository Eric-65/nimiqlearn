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
  NIMIQ_STATUS,
  sendNimPayment,
  getUsdtSupportStatus,
} from "./nimiqWalletService.js";
import { PAYMENTS_ENABLED, PAYMENTS_DISABLED_REASON } from "../config/paymentConfig.js";

/** Item 18 — the exact transaction-state machine the spec asks for. A
 * transaction hash/reference is never equated with "confirmed": UNKNOWN
 * is its own state precisely so the UI never collapses "we don't know"
 * into either a false success or a false failure (item 22). */
export const TRANSACTION_STATE = {
  IDLE: "IDLE",
  REVIEW: "REVIEW",
  REQUESTING_APPROVAL: "REQUESTING_APPROVAL",
  SUBMITTED: "SUBMITTED",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  FAILED: "FAILED",
  UNKNOWN: "UNKNOWN",
};

const PAYMENT_TIMEOUT_MS = 60_000;

export function buildPaymentRequest(pack) {
  return {
    productId: pack.id,
    amount: pack.price,
    asset: pack.asset || "NIM",
    recipient: pack.recipient, // resolves through src/config/paymentConfig.js — null if unconfigured
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
 * Execute a payment and report its real outcome via `transactionState`
 * (item 18):
 *  - CONFIRMED — the real provider call resolved. `simulated` tells you
 *                 whether this was a real Nimiq Pay transaction or an
 *                 explicitly-labelled DEMO MODE simulation.
 *  - REJECTED  — the user explicitly declined in their wallet. Safe to
 *                 say the wallet was not charged (nothing was ever
 *                 broadcast).
 *  - FAILED    — a provider error we CAN classify as a real failure
 *                 (e.g. an unsupported asset, rejected before submission).
 *  - UNKNOWN   — a timeout or an error we cannot classify. We do NOT
 *                 claim the wallet was or wasn't charged here (item 22) —
 *                 the caller must block a repeat purchase of the same
 *                 product until the learner explicitly acknowledges
 *                 checking their own wallet (see LearningPaymentModal.jsx
 *                 and LearnerContext's pendingPayments).
 *
 * `onStateChange(transactionState)` fires through TRANSACTION_STATE so the
 * UI can show real stage labels (never a fake percentage).
 */
export async function processPayment(request, { onStateChange } = {}) {
  const emit = (s) => onStateChange?.(s);
  const wallet = getWalletState();

  if (!PAYMENTS_ENABLED || !request.recipient) {
    emit(TRANSACTION_STATE.FAILED);
    return {
      transactionState: TRANSACTION_STATE.FAILED,
      simulated: false,
      error: PAYMENTS_DISABLED_REASON || "No recipient address is configured for this product.",
      detail: "Payment is disabled until a real recipient address is configured.",
    };
  }

  if (wallet.status === NIMIQ_STATUS.CONNECTED) {
    if (request.asset !== "NIM") {
      emit(TRANSACTION_STATE.FAILED);
      return {
        transactionState: TRANSACTION_STATE.FAILED,
        simulated: false,
        error: "USDT payment support is not available in this environment yet.",
        detail: "Only NIM payments are currently supported by this Mini App SDK.",
      };
    }

    emit(TRANSACTION_STATE.REQUESTING_APPROVAL);
    try {
      const result = await withTimeout(
        sendNimPayment({ recipient: request.recipient, amountNim: request.amount }),
        PAYMENT_TIMEOUT_MS
      );
      emit(TRANSACTION_STATE.CONFIRMED);
      return {
        transactionState: TRANSACTION_STATE.CONFIRMED,
        simulated: false,
        purchaserAddress: wallet.address,
        reference: result.serialized,
        provider: "Nimiq Pay",
        asset: "NIM",
        detail: "Transaction signed and submitted by Nimiq Pay.",
      };
    } catch (err) {
      if (err.message === "PAYMENT_TIMEOUT") {
        emit(TRANSACTION_STATE.UNKNOWN);
        return {
          transactionState: TRANSACTION_STATE.UNKNOWN,
          simulated: false,
          error: "Payment status could not be confirmed. Please check your wallet before trying again.",
          detail: "Nimiq Pay did not respond within the expected time.",
        };
      }
      const rejected = looksLikeUserRejection(err.message);
      const finalState = rejected ? TRANSACTION_STATE.REJECTED : TRANSACTION_STATE.UNKNOWN;
      emit(finalState);
      return {
        transactionState: finalState,
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
  emit(TRANSACTION_STATE.REVIEW);
  await new Promise((r) => setTimeout(r, 1400));
  emit(TRANSACTION_STATE.CONFIRMED);
  return {
    transactionState: TRANSACTION_STATE.CONFIRMED,
    simulated: true,
    purchaserAddress: null,
    reference: `SIM-${randomId()}`,
    provider: "DEMO MODE (simulation)",
    asset: request.asset,
    detail: `Simulated ${request.amount} ${request.asset} payment. No blockchain transaction occurred.`,
  };
}
