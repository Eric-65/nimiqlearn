/* ============================================================
   NimiqLearn — Payment configuration (single source of truth)
   ------------------------------------------------------------
   The recipient address for real NIM payments is an environment
   value, never a hard-coded string in this repo. This app does
   NOT invent a production recipient address: set

     VITE_NIM_LEARNING_RECIPIENT=NQ...

   in a local .env file (see .env.example) before real payments
   can be requested. Vite only exposes env vars prefixed VITE_ to
   client code — see https://vite.dev/guide/env-and-mode.

   If this is unset, PAYMENTS_ENABLED is false and every payment
   surface in the app must show that unlocking is unavailable
   rather than silently falling back to a placeholder address.
   ============================================================ */

const RAW_RECIPIENT = import.meta.env.VITE_NIM_LEARNING_RECIPIENT;

export const NIM_LEARNING_RECIPIENT = RAW_RECIPIENT && RAW_RECIPIENT.trim() ? RAW_RECIPIENT.trim() : null;

export const PAYMENTS_ENABLED = Boolean(NIM_LEARNING_RECIPIENT);

export const PAYMENTS_DISABLED_REASON = PAYMENTS_ENABLED
  ? null
  : "No learning-pack recipient address is configured (VITE_NIM_LEARNING_RECIPIENT is unset). Unlocking with real NIM is disabled until an educator recipient address is configured.";
