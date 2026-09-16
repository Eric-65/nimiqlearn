/* ============================================================
   NimiqLearn — Payment configuration (single source of truth)
   ------------------------------------------------------------
   The recipient address for real NIM payments is an environment
   value, never a hard-coded string in this repo. This app does
   NOT invent a production recipient address: set

     VITE_NIM_LEARNING_RECIPIENT=NQ...

   in a local .env file (see .env.example), or as a Project
   Environment Variable on the host, before real payments can be
   requested. Vite only exposes env vars prefixed VITE_ to client
   code — see https://vite.dev/guide/env-and-mode.

   Vite BAKES these in at build time, not at runtime: setting the
   variable on the host does nothing to an already-built bundle.
   A fresh deploy has to follow, or the app keeps serving the
   value (or absence of one) it was built with.

   If this is unset, PAYMENTS_ENABLED is false and every payment
   surface in the app must show that unlocking is unavailable
   rather than silently falling back to a placeholder address.
   ============================================================ */

/* A Nimiq address is "NQ", two check digits, then 32 characters of
   Nimiq's base32 alphabet — which omits I, O, W and Z — and is
   conventionally printed in nine groups of four.

   Only the SHAPE is checked here, never the IBAN-style checksum. A false
   reject would disable payments on a perfectly good address, which is a
   worse failure than the typo it would catch, and Nimiq Pay shows the
   recipient in its own confirmation dialog before the learner approves
   anything. What this does catch is the realistic mistake: pasting the
   0x… EVM address into this variable, since the two sit next to each
   other in .env.example and only one of them is a Nimiq address. */
const NIMIQ_ADDRESS = /^NQ\d{2}[0-9A-HJ-NP-VXY]{32}$/;

const RAW_RECIPIENT = import.meta.env.VITE_NIM_LEARNING_RECIPIENT;
const TRIMMED = typeof RAW_RECIPIENT === "string" ? RAW_RECIPIENT.trim() : "";

const IS_CONFIGURED = TRIMMED.length > 0;
/* Spaces and letter case are display conventions, so they are normalised
   away for the CHECK only — what gets sent is exactly what was configured,
   because this module has no business reformatting an address it is about
   to hand to a wallet. */
const IS_VALID = IS_CONFIGURED && NIMIQ_ADDRESS.test(TRIMMED.replace(/\s+/g, "").toUpperCase());

export const NIM_LEARNING_RECIPIENT = IS_VALID ? TRIMMED : null;

export const PAYMENTS_ENABLED = Boolean(NIM_LEARNING_RECIPIENT);

/* A key, not a sentence — this is shown to the learner, so it has to
   follow the app's language like every other message.

   Set-but-unusable is a different problem from never-set and has to say
   so: reporting "not configured" for a variable that IS configured, just
   wrong, sends you hunting for the wrong thing. */
export const PAYMENTS_DISABLED_REASON_KEY = PAYMENTS_ENABLED
  ? null
  : IS_CONFIGURED
    ? "market.paymentsMisconfigured"
    : "market.paymentsDisabled";

if (IS_CONFIGURED && !IS_VALID && import.meta.env?.DEV) {
  console.error(
    "[payments] VITE_NIM_LEARNING_RECIPIENT is set but is not a Nimiq address:",
    JSON.stringify(RAW_RECIPIENT),
    "\nExpected NQ + 2 digits + 32 base32 characters (an 0x… address belongs in VITE_USDT_LEARNING_RECIPIENT).",
    "\nUnlocking with NIM stays disabled."
  );
}
