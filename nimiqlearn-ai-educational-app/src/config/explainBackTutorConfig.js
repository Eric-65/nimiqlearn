/* ============================================================
   NimiqLearn — ExplainBack AI Tutor (GLM-5.3) configuration
   ------------------------------------------------------------
   GLM-5.3 (zai-org/GLM-5.3 — 320B total / 18B active parameters)
   is far too large to ever run on-device like aiService.js's
   SmolLM2, so this always goes through NimiqLearn's own backend
   (../../server/) — same process as the Claude teaching config,
   a different route (POST /api/tutor/feedback), a different
   secret (HF_TOKEN, never this ANTHROPIC_API_KEY). See
   docs/explainback-ai-tutor.md and server/index.js.

   Same disable-if-unconfigured pattern as paymentConfig.js /
   teachingConfig.js: no backend URL configured means the AI
   Tutor panel in ExplainBack simply doesn't render, rather than
   showing a broken button.
   ============================================================ */

const RAW_URL = import.meta.env.VITE_EXPLAINBACK_TUTOR_API_URL;

export const TUTOR_API_URL = RAW_URL && RAW_URL.trim() ? RAW_URL.trim().replace(/\/$/, "") : null;

export const TUTOR_CONFIGURED = Boolean(TUTOR_API_URL);
