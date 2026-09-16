/* ============================================================
   NimiqLearn — Payment configuration (single source of truth)
   ------------------------------------------------------------
   Where the NIM for a learning pack goes. Two sources, in order:

     1. VITE_NIM_LEARNING_RECIPIENT, if set to a usable address —
        a local .env file (see .env.example) or a Project
        Environment Variable on the host.
     2. DEFAULT_RECIPIENT below: NimiqLearn's own educator
        account, committed so a fresh clone or deploy can take a
        real payment with no setup at all.

   That default is a deliberate reversal of how this file started
   ("never a hard-coded string in this repo"). The original rule
   existed to stop payments silently going to a PLACEHOLDER
   address — an invented value that looks configured and quietly
   loses money. A real account the project controls is the
   opposite of that, and the rule was costing more than it
   bought: the deployed app showed a red "no recipient
   configured" banner to every visitor, because a VITE_ variable
   the host has never been given cannot appear by magic.

   A receiving address is public by nature, and it is public
   either way: Vite inlines every VITE_ variable into the browser
   bundle at BUILD time, so an env-var address ships in the
   page's JavaScript exactly as a committed one does. The env var
   buys deployment-time override, not secrecy — override it to
   point a fork's earnings somewhere else.

   Because these are baked in at build time, changing the host's
   variable does nothing to an already-built bundle. A fresh
   deploy has to follow.

   If neither source yields a valid address, PAYMENTS_ENABLED is
   false and every payment surface must say unlocking is
   unavailable rather than fall back to a placeholder.
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

/* NimiqLearn's own educator account. Safe to commit: it can only RECEIVE —
   spending needs the private key, which lives in the wallet and never comes
   near this repo. */
const DEFAULT_RECIPIENT = "NQ52 A3QM 30EJ E58T FXHQ 1GMC UHSG 339R TA8T";

/* An env var present but blank — which is what an empty field in a hosting
   dashboard produces — means "not set", not "pay nobody", so it falls
   through to the default rather than disabling payment. */
const ENV_RECIPIENT = import.meta.env.VITE_NIM_LEARNING_RECIPIENT;
const ENV_TRIMMED = typeof ENV_RECIPIENT === "string" ? ENV_RECIPIENT.trim() : "";

const RAW_RECIPIENT = ENV_TRIMMED || DEFAULT_RECIPIENT;
const TRIMMED = RAW_RECIPIENT.trim();

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

if (ENV_TRIMMED && !IS_VALID && import.meta.env?.DEV) {
  console.error(
    "[payments] VITE_NIM_LEARNING_RECIPIENT is set but is not a Nimiq address:",
    JSON.stringify(RAW_RECIPIENT),
    "\nExpected NQ + 2 digits + 32 base32 characters (an 0x… address belongs in VITE_USDT_LEARNING_RECIPIENT).",
    "\nUnlocking with NIM stays disabled."
  );
}
