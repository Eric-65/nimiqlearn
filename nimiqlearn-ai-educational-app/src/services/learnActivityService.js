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

import { TUTOR_API_URL, TUTOR_CONFIGURED } from "../config/explainBackTutorConfig.js";

const REQUEST_TIMEOUT_MS = 20_000;

export function isActivityBackendConfigured() {
  return TUTOR_CONFIGURED;
}

/**
 * @returns {Promise<{ok: true, value: object} | {ok: false, error: string}>}
 */
export async function generateActivityContentRemote({ type, topic, level = "beginner", targetMisconception, topicContent }) {
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
    return { ok: false, error: `Could not reach the activity backend at ${TUTOR_API_URL}.` };
  }
}
