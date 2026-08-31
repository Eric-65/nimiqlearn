/* ============================================================
   NimiqLearn — Entitlement service
   ------------------------------------------------------------
   A successful payment produces an entitlement. This is
   deliberately a separate concept from learning progress
   (mastery/confidence/knowledge state) — see
   docs/learning-engine.md for that model. Payment says "the
   learner unlocked this pack"; it says nothing about how well
   they're doing in it.

   CLIENT-SIDE PROTOTYPE ENTITLEMENT STATE: entitlements here are
   persisted only in this browser's localStorage (via
   LearnerContext.jsx), with no backend verification. This is
   appropriate for a prototype but is NOT tamper-proof — a user
   could edit their own localStorage to grant themselves an
   entitlement. There is no server here to prevent that. A
   production version would verify the transaction against the
   Nimiq blockchain (or a trusted indexer) server-side before
   granting access.
   ============================================================ */

export const ENTITLEMENT_STATUS = {
  ACTIVE: "active",
  REVOKED: "revoked", // reserved — nothing in this app revokes an entitlement yet
};

/**
 * @param {object} params
 * @param {string} params.productId
 * @param {string|null} params.purchaserAddress - the wallet address that paid,
 *   or null when the purchase happened in browser DEMO MODE (no real wallet).
 * @param {string} params.transactionId - the provider's transaction reference,
 *   or a clearly-labelled SIM-… id for a demo purchase (see paymentService.js).
 * @param {boolean} [params.simulated] - true for a DEMO MODE purchase — carried
 *   through so the UI never has to guess whether a payment was real.
 */
export function createEntitlement({ productId, purchaserAddress = null, transactionId, simulated = false }) {
  return {
    productId,
    purchaserAddress,
    transactionId,
    purchasedAt: Date.now(),
    status: ENTITLEMENT_STATUS.ACTIVE,
    simulated,
  };
}

export function hasEntitlement(entitlements, productId) {
  return (entitlements || []).some((e) => e.productId === productId && e.status === ENTITLEMENT_STATUS.ACTIVE);
}

export function findEntitlement(entitlements, productId) {
  return (entitlements || []).find((e) => e.productId === productId) || null;
}
