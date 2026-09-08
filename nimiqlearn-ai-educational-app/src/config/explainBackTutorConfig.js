/* ============================================================
   NimiqLearn — ExplainBack AI Tutor (OpenAI / ChatGPT) configuration
   ------------------------------------------------------------
   OpenAI's chat models are cloud-only — this always goes through
   NimiqLearn's own backend (../../server/), same process as the
   Claude teaching config, a different route
   (POST /api/tutor/feedback), a different secret (OPENAI_API_KEY,
   never this ANTHROPIC_API_KEY). See docs/explainback-ai-tutor.md
   and server/index.js.

   Same disable-if-unconfigured pattern as paymentConfig.js /
   teachingConfig.js: no backend URL configured means the AI
   Tutor panel in ExplainBack simply doesn't render, rather than
   showing a broken button.
   ============================================================ */

const RAW_URL = import.meta.env.VITE_EXPLAINBACK_TUTOR_API_URL;

export const TUTOR_API_URL = RAW_URL && RAW_URL.trim() ? RAW_URL.trim().replace(/\/$/, "") : null;

export const TUTOR_CONFIGURED = Boolean(TUTOR_API_URL);
