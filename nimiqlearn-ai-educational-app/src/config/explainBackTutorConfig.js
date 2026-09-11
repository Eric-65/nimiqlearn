/* ============================================================
   NimiqLearn — OpenAI backend URL configuration
   ------------------------------------------------------------
   One backend URL, shared by every OpenAI-backed feature: the
   AI Tutor (/api/tutor/feedback), ExplainBack's primary grading
   (/api/assess/feedback), and Learn tab activity generation
   (/api/learn/activity) — same server, same OPENAI_API_KEY. See
   docs/explainback-ai-tutor.md and server/index.js.

   Same disable-if-unconfigured pattern as paymentConfig.js: no
   backend URL configured means the AI Tutor panel in ExplainBack
   simply doesn't render (and grading/activity generation fall
   back to their deterministic engines), rather than showing a
   broken button.
   ============================================================ */

const RAW_URL = import.meta.env.VITE_EXPLAINBACK_TUTOR_API_URL;

export const TUTOR_API_URL = RAW_URL && RAW_URL.trim() ? RAW_URL.trim().replace(/\/$/, "") : null;

export const TUTOR_CONFIGURED = Boolean(TUTOR_API_URL);
