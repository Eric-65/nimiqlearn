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

/**
 * Resolves a configured backend URL against the host the app is actually
 * being served from.
 *
 * `localhost` is only meaningful to the machine doing the asking. When
 * this app is opened on another device on the LAN — which is exactly how
 * the Nimiq Pay Mini App has to be tested, since Nimiq Pay runs on a phone
 * and cannot reach the dev machine's `localhost` (see
 * docs/nimiq-pay-integration.md, "Android testing") — a configured
 * `http://localhost:8787` would send the phone looking for a backend on
 * the phone itself, and every AI feature would fail with a connection
 * error that looks like a backend outage.
 *
 * So: if the backend is configured as localhost/127.0.0.1 BUT the page
 * itself came from some other host, the backend host is rewritten to the
 * page's own host, keeping the configured port. The dev machine serving
 * the page is by definition also the one running the backend.
 *
 * Deliberately narrow — this only ever rewrites a localhost-configured
 * backend. A real deployed HTTPS backend URL is passed through untouched,
 * so production behaviour is unchanged.
 */
function resolveAgainstPageHost(rawUrl) {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  if (typeof window === "undefined" || !window.location) return trimmed;

  try {
    const configured = new URL(trimmed);
    const isLoopback = configured.hostname === "localhost" || configured.hostname === "127.0.0.1";
    const pageIsLoopback =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (isLoopback && !pageIsLoopback) {
      configured.hostname = window.location.hostname;
      // Match the page's scheme too: a page served over https cannot make
      // plain-http requests to the backend (mixed content is blocked).
      configured.protocol = window.location.protocol;
      return configured.toString().replace(/\/$/, "");
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

export const TUTOR_API_URL = resolveAgainstPageHost(RAW_URL);

export const TUTOR_CONFIGURED = Boolean(TUTOR_API_URL);
