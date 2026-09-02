/* ============================================================
   NimiqLearn — Learn Concept (Claude teaching) configuration
   ------------------------------------------------------------
   The backend URL is safe to expose client-side (it's just an
   endpoint, not a secret) — the actual ANTHROPIC_API_KEY lives
   only in ../../server/.env, on the server, never here. See
   ../../server/index.js and docs/learn-concept.md.

   Same disable-if-unconfigured pattern as
   src/config/paymentConfig.js: no backend URL configured means
   the feature is honestly disabled, never silently pointed at a
   guessed or hard-coded URL.
   ============================================================ */

const RAW_URL = import.meta.env.VITE_TEACHING_API_URL;

export const TEACHING_API_URL = RAW_URL && RAW_URL.trim() ? RAW_URL.trim().replace(/\/$/, "") : null;

export const TEACHING_CONFIGURED = Boolean(TEACHING_API_URL);

export const TEACHING_DISABLED_REASON = TEACHING_CONFIGURED
  ? null
  : "Claude teaching isn't configured yet (VITE_TEACHING_API_URL is unset). See docs/learn-concept.md to run the teaching backend.";
