/* ============================================================
   NimiqLearn — Payment service
   ------------------------------------------------------------
   Builds payment requests for the Learning Economy and routes
   them to the real Nimiq Pay provider when available, or to an
   explicit, clearly-labelled DEMO simulation otherwise.
   Demo payments are NEVER presented as real blockchain
   transactions and never fabricate a real transaction hash.
   ============================================================ */

import { getNimiqState, sendNimPayment, sendEvmPayment, detectSupportedAssets } from "./nimiqService.js";

export function buildPaymentRequest(pack) {
  return {
    packId: pack.id,
    amount: pack.price,
    asset: pack.asset || "NIM",
    network: pack.asset === "NIM" ? "Nimiq" : "EVM",
    recipient: pack.recipient,
    purpose: pack.purpose || "Educational learning pack",
    title: pack.title,
  };
}

export function getSupportedAssets() {
  return detectSupportedAssets();
}

/**
 * Execute a payment.
 * Returns { status, simulated, reference, provider, detail }
 *  - real: reference is the provider-returned transaction info
 *  - demo: reference is a clearly-labelled simulation id (SIM-…)
 */
export async function processPayment(request, { mode } = {}) {
  const runtime = getNimiqState();
  const actualMode = mode || runtime.mode || "demo";

  // ---- Real path: inside Nimiq Pay ----
  if (actualMode === "miniapp") {
    try {
      if (request.asset === "NIM") {
        const result = await sendNimPayment({
          recipient: request.recipient,
          valueNim: request.amount,
        });
        return {
          status: "success",
          simulated: false,
          reference: result.serialized?.slice(0, 42) || "tx-submitted",
          provider: "Nimiq Pay",
          asset: request.asset,
          detail: "Transaction signed and submitted by Nimiq Pay.",
        };
      }
      if (request.asset === "USDT") {
        const result = await sendEvmPayment({
          recipient: request.recipient,
          amount: request.amount,
          asset: request.asset,
        });
        return {
          status: "success",
          simulated: false,
          reference: result.txHash,
          provider: "Nimiq Pay EVM",
          asset: request.asset,
          detail: `USDT transfer submitted on ${result.chain}.`,
        };
      }
      throw new Error(`Unsupported asset: ${request.asset}`);
    } catch (err) {
      return {
        status: "failed",
        simulated: false,
        error: err?.message || "The payment was rejected.",
        detail: "Nimiq Pay did not confirm this payment.",
      };
    }
  }

  // ---- Demo path: normal browser, explicitly simulated ----
  await new Promise((r) => setTimeout(r, 1400)); // simulate confirmation latency
  const simulationId = `SIM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  return {
    status: "success",
    simulated: true,
    reference: simulationId,
    provider: "DEMO MODE (simulation)",
    asset: request.asset,
    detail: `Simulated ${request.amount} ${request.asset} payment. No blockchain transaction occurred.`,
  };
}
