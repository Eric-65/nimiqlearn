/* ============================================================
   NimiqLearn — Learn tab activity content (OpenAI-backed)
   ------------------------------------------------------------
   Replaces the old on-device SmolLM2 call in learnLoopService.js.
   Same job (generate the content for whichever activity LearnLoop
   already decided on), different transport — a short request to
   NimiqLearn's own backend (../../server/), reusing the same
   config as the AI Tutor / ExplainBack grading (same server, same
   OPENAI_API_KEY). Never imports the OpenAI SDK, never sees a key.

   LearnLoop's own activity-selection logic is unchanged and stays
   deterministic — this only fills in the content once a choice has
   already been made.
   ============================================================ */

import { TUTOR_API_URL, TUTOR_CONFIGURED, TUTOR_API_LABEL } from "../config/explainBackTutorConfig.js";
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


// Real observed OpenAI latency for this endpoint is 1-3s; 20s meant a
// genuine outage looked identical to "frozen forever" from the learner's
// side before the fallback ever kicked in.
const REQUEST_TIMEOUT_MS = 12_000;

export function isActivityBackendConfigured() {
  return TUTOR_CONFIGURED;
}

/**
 * @returns {Promise<{ok: true, value: object} | {ok: false, error: string}>}
 */
export async function generateActivityContentRemote({ type, topic, level = "beginner", targetMisconception, topicContent, previousQuestions = [], previousAngles = [] }) {
  if (!TUTOR_CONFIGURED) {
    return { ok: false, error: "Activity generation backend isn't configured." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${TUTOR_API_URL}/api/learn/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        topicName: topic.name,
        topicDescription: topic.description || "",
        topicContent,
        level,
        targetMisconception,
        previousQuestions,
        previousAngles,
        ...localePayload(),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.ok) {
      return { ok: false, error: data?.error || `Activity backend error (${res.status}).` };
    }
    return { ok: true, value: data.value };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { ok: false, error: "The activity backend took too long to respond." };
    }
    return { ok: false, error: `Could not reach the activity backend at ${TUTOR_API_LABEL}.` };
  }
}
