/* ============================================================
   NimiqLearn — EVM (USDT) payment configuration
   ------------------------------------------------------------
   Same disable-if-unconfigured pattern as paymentConfig.js, for
   the same reason: this app does NOT invent a production USDT
   recipient address. Set

     VITE_USDT_LEARNING_RECIPIENT=0x...

   in a local .env file (see .env.example) before real USDT
   payments can be requested. This is a separate address from
   VITE_NIM_LEARNING_RECIPIENT — an EVM address, not a Nimiq NQ...
   address — since USDT moves over Nimiq Pay's window.ethereum
   provider on a different chain entirely. See
   src/services/evmWalletService.js and
   docs/nimiq-pay-integration.md, "USDT status".
   ============================================================ */

const RAW_RECIPIENT = import.meta.env.VITE_USDT_LEARNING_RECIPIENT;

export const USDT_LEARNING_RECIPIENT = RAW_RECIPIENT && RAW_RECIPIENT.trim() ? RAW_RECIPIENT.trim() : null;

export const USDT_PAYMENTS_ENABLED = Boolean(USDT_LEARNING_RECIPIENT);

/* A key, not a sentence — see paymentConfig.js for the reasoning. */
export const USDT_PAYMENTS_DISABLED_REASON_KEY = USDT_PAYMENTS_ENABLED ? null : "market.usdtDisabled";
