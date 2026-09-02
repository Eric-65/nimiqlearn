/* ============================================================
   NimiqLearn — Claude teaching service
   ------------------------------------------------------------
   Not currently imported by any page. Kept as reusable plumbing
   for a future Claude "AI Tutor" layer inside ExplainBack — see
   docs/learn-concept.md for status and rationale.

   Talks ONLY to NimiqLearn's own small backend (../../server/) —
   never to the Anthropic API directly, and never holds an API
   key. The backend is what actually calls Claude, server-side.
   This separation exists because NimiqLearn ships as a single
   static HTML file (a Nimiq Pay Mini App); anything embedded in
   it is visible to every user who opens dev tools.

   Deliberately independent of the wallet/payment layer and of
   aiService.js (SmolLM2): this is a different model, a different
   transport (network, not on-device), and a different failure
   mode (network/backend down vs. local model load failure).
   ============================================================ */

import { TEACHING_API_URL, TEACHING_CONFIGURED, TEACHING_DISABLED_REASON } from "../config/teachingConfig.js";

export { TEACHING_CONFIGURED, TEACHING_DISABLED_REASON };

const REQUEST_TIMEOUT_MS = 45_000;

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { promise: promise(controller.signal), cancel: () => clearTimeout(timer) };
}

/**
 * Checks whether the configured backend is actually reachable AND holds a
 * real API key — distinct from TEACHING_CONFIGURED (which only means a URL
 * was set). Never assumes reachability from configuration alone.
 */
export async function checkTeachingAvailable() {
  if (!TEACHING_CONFIGURED) return { available: false, reason: TEACHING_DISABLED_REASON };
  try {
    const res = await fetch(`${TEACHING_API_URL}/api/health`, { method: "GET" });
    if (!res.ok) return { available: false, reason: `Teaching backend responded with ${res.status}.` };
    const data = await res.json();
    if (!data.configured) return { available: false, reason: "The teaching backend is running but has no ANTHROPIC_API_KEY configured." };
    return { available: true, reason: null };
  } catch {
    return { available: false, reason: `Could not reach the teaching backend at ${TEACHING_API_URL}.` };
  }
}

/**
 * Ask Claude to teach/explain something, via the backend proxy.
 * @param {object} params
 * @param {string} params.topic - human-readable topic name, e.g. "Linear Algebra"
 * @param {string} params.message - the learner's question or prompt
 * @param {{role: "user"|"assistant", content: string}[]} [params.history] - prior turns, oldest first
 * @returns {Promise<{ok: true, reply: string} | {ok: false, error: string}>}
 */
export async function askConceptTeacher({ topic, message, history = [] }) {
  if (!TEACHING_CONFIGURED) {
    return { ok: false, error: TEACHING_DISABLED_REASON };
  }
  if (!message || !message.trim()) {
    return { ok: false, error: "Type a question first." };
  }

  const { promise, cancel } = withTimeout(
    (signal) =>
      fetch(`${TEACHING_API_URL}/api/teach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message, history }),
        signal,
      }),
    REQUEST_TIMEOUT_MS
  );

  try {
    const res = await promise;
    cancel();
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return { ok: false, error: data?.error || `Teaching backend error (${res.status}).` };
    }
    if (!data.ok) {
      return { ok: false, error: data.error || "The teaching backend reported an error." };
    }
    return { ok: true, reply: data.reply || "" };
  } catch (err) {
    cancel();
    if (err.name === "AbortError") {
      return { ok: false, error: "The teaching backend took too long to respond. Please try again." };
    }
    return { ok: false, error: `Could not reach the teaching backend at ${TEACHING_API_URL}.` };
  }
}
