/* ============================================================
   NimiqLearn — ExplainBack AI Tutor service (OpenAI / ChatGPT)
   ------------------------------------------------------------
   Talks ONLY to NimiqLearn's own backend (../../server/) — never
   to OpenAI directly, and never holds an OpenAI API key. Same
   fetch + timeout transport pattern as
   explainBackAssessmentService.js and learnActivityService.js —
   different route, same backend, same key.

   This is an opt-in, user-triggered call (see AITutorPanel.jsx) —
   OpenAI's API is paid and metered, so it is never fired
   automatically the way the rubric baseline is.
   ============================================================ */

import { TUTOR_API_URL, TUTOR_API_LABEL, TUTOR_CONFIGURED } from "../config/explainBackTutorConfig.js";
import { getLocale } from "./i18nService.js";
import { getLocaleMeta } from "../i18n/locales.js";

/* The learner's language, sent with every AI request so the model writes its
   reply in it. Both fields go over the wire on purpose: `locale` is the
   machine-readable tag the server validates against its allow-list, and
   `languageName` is the English name of the language, which is what actually
   goes into the system prompt — models follow "Reply in Korean" far more
   reliably than "Reply in ko". */
function localePayload() {
  const locale = getLocale();
  return { locale, languageName: getLocaleMeta(locale).aiName };
}


const REQUEST_TIMEOUT_MS = 45_000;

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { promise: promise(controller.signal), cancel: () => clearTimeout(timer) };
}

/**
 * Checks whether the configured backend is actually reachable AND holds a
 * real OPENAI_API_KEY — distinct from TUTOR_CONFIGURED (which only means a
 * URL was set). Never assumes reachability from configuration alone.
 */
export async function checkTutorAvailable() {
  if (!TUTOR_CONFIGURED) {
    return { available: false, reason: "The AI Tutor isn't configured yet (VITE_EXPLAINBACK_TUTOR_API_URL is unset)." };
  }
  try {
    const res = await fetch(`${TUTOR_API_URL}/api/tutor/health`, { method: "GET" });
    if (!res.ok) return { available: false, reason: `AI Tutor backend responded with ${res.status}.` };
    const data = await res.json();
    if (!data.configured) return { available: false, reason: "The AI Tutor backend is running but has no OPENAI_API_KEY configured." };
    return { available: true, reason: null };
  } catch {
    return { available: false, reason: `Could not reach the AI Tutor backend at ${TUTOR_API_LABEL}.` };
  }
}

/**
 * Ask OpenAI (ChatGPT), via the backend proxy, to critique the learner's
 * explanation against the app's own rubric grading (never the raw dataset)
 * and complete/correct it when it's partial or wrong.
 * @param {object} params
 * @param {string} [params.topic] - human-readable topic name
 * @param {string} [params.topicId] - curriculum id; decides server-side whether
 *   this is a Nimiq topic and gets the Nimiq grounding
 * @param {string} [params.learnerLevel] - "beginner" or "advanced"
 * @param {string} [params.referenceAnswer] - the topic's canonical definition
 * @param {string} params.learnerExplanation - the learner's own explanation
 * @param {{score?: number, missingConcepts?: string[], misconceptions?: string[]}} [params.assessment]
 * @returns {Promise<{ok: true, feedback: string} | {ok: false, error: string}>}
 */
export async function askExplainBackTutor({ topic, topicId, learnerLevel, referenceAnswer, learnerExplanation, assessment }) {
  if (!TUTOR_CONFIGURED) {
    return { ok: false, error: "The AI Tutor isn't configured yet." };
  }
  if (!learnerExplanation || !learnerExplanation.trim()) {
    return { ok: false, error: "An explanation is required first." };
  }

  const { promise, cancel } = withTimeout(
    (signal) =>
      fetch(`${TUTOR_API_URL}/api/tutor/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, topicId, learnerLevel, referenceAnswer, learnerExplanation, assessment, ...localePayload() }),
        signal,
      }),
    REQUEST_TIMEOUT_MS
  );

  try {
    const res = await promise;
    cancel();
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return { ok: false, error: data?.error || `AI Tutor backend error (${res.status}).` };
    }
    if (!data.ok) {
      return { ok: false, error: data.error || "The AI Tutor backend reported an error." };
    }
    return { ok: true, feedback: data.feedback || "" };
  } catch (err) {
    cancel();
    if (err.name === "AbortError") {
      return { ok: false, error: "The AI Tutor took too long to respond. Please try again." };
    }
    return { ok: false, error: `Could not reach the AI Tutor backend at ${TUTOR_API_LABEL}.` };
  }
}
