/* ============================================================
   NimiqLearn — EVM (USDT) payment configuration
   ------------------------------------------------------------
   Same disable-if-unconfigured pattern as paymentConfig.js, for
   the same reason: this app does NOT invent a production USDT
   recipient address. Set

     VITE_USDT_LEARNING_RECIPIENT=0x...

   in a local .env file (see .env.example), or as a Project
   Environment Variable on the host. This is a separate address
   from VITE_NIM_LEARNING_RECIPIENT — an EVM address, not a Nimiq
   NQ... address — since USDT moves over Nimiq Pay's
   window.ethereum provider on a different chain entirely. See
   src/services/evmWalletService.js and
   docs/nimiq-pay-integration.md, "USDT status".

   Like every VITE_ variable this is baked in at BUILD time, so a
   change on the host needs a fresh deploy to take effect.
   ============================================================ */

/* 20 bytes, hex-encoded, 0x-prefixed. The checksum casing from EIP-55 is
   deliberately not enforced: plenty of tooling emits all-lowercase
   addresses and rejecting those would be wrong. This catches the
   realistic mistake — an NQ… Nimiq address pasted into the EVM slot,
   since the two variables sit next to each other in .env.example. */
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

const RAW_RECIPIENT = import.meta.env.VITE_USDT_LEARNING_RECIPIENT;
const TRIMMED = typeof RAW_RECIPIENT === "string" ? RAW_RECIPIENT.trim() : "";

const IS_CONFIGURED = TRIMMED.length > 0;
/* Validated, never rewritten — what gets sent is what was configured. */
const IS_VALID = IS_CONFIGURED && EVM_ADDRESS.test(TRIMMED);

export const USDT_LEARNING_RECIPIENT = IS_VALID ? TRIMMED : null;

export const USDT_PAYMENTS_ENABLED = Boolean(USDT_LEARNING_RECIPIENT);

/* A key, not a sentence — see paymentConfig.js for the reasoning, and for
   why set-but-invalid reports differently from never-set. */
export const USDT_PAYMENTS_DISABLED_REASON_KEY = USDT_PAYMENTS_ENABLED
  ? null
  : IS_CONFIGURED
    ? "market.usdtMisconfigured"
    : "market.usdtDisabled";

if (IS_CONFIGURED && !IS_VALID && import.meta.env?.DEV) {
  console.error(
    "[payments] VITE_USDT_LEARNING_RECIPIENT is set but is not an EVM address:",
    JSON.stringify(RAW_RECIPIENT),
    "\nExpected 0x + 40 hex characters (an NQ… address belongs in VITE_NIM_LEARNING_RECIPIENT).",
    "\nUnlocking with USDT stays disabled."
  );
}
