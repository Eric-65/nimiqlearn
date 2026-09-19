/* ============================================================
   NimiqLearn — "Ask about this lesson"
   ------------------------------------------------------------
   A learner with a topic open types a question; the backend
   answers it from that topic's own reference content, in the
   learner's language. Same server, same OPENAI_API_KEY and the
   same locale handling as the Learn-tab activity generator —
   see learnActivityService.js, which this mirrors.

   No fallback engine here, on purpose. An activity can be built
   from a template when the AI is down; a free question cannot be
   answered by one. So when the backend is unreachable the box
   says so, and the learner's earlier answers (saved on their
   profile) stay readable.
   ============================================================ */

import { TUTOR_API_URL, TUTOR_CONFIGURED, TUTOR_API_LABEL } from "../config/explainBackTutorConfig.js";
import { TOPIC_CONTENT } from "../data/mockTopics.js";
import { getLocale } from "./i18nService.js";
import { getLocaleMeta } from "../i18n/locales.js";

const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_QUESTION_LENGTH = 600;

export function isQuestionBackendConfigured() {
  return TUTOR_CONFIGURED;
}

/**
 * @returns {Promise<{ok: true, answer: string} | {ok: false, error: string}>}
 */
export async function askLessonQuestion({ topic, question, level = "beginner" }) {
  if (!TUTOR_CONFIGURED) {
    return { ok: false, error: "The question backend isn't configured." };
  }
  const trimmed = String(question || "").trim();
  if (!trimmed) return { ok: false, error: "Type a question first." };

  const locale = getLocale();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${TUTOR_API_URL}/api/learn/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: trimmed.slice(0, MAX_QUESTION_LENGTH),
        topicId: topic.id,
        topicName: topic.name,
        topicContent: TOPIC_CONTENT[topic.id] || {},
        level,
        locale,
        languageName: getLocaleMeta(locale).aiName,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || typeof data.value?.answer !== "string") {
      return { ok: false, error: data?.error || `Question backend error (${res.status}).` };
    }
    return { ok: true, answer: data.value.answer };
  } catch (err) {
    clearTimeout(timer);
    if (err?.name === "AbortError") return { ok: false, error: "The tutor took too long to answer." };
    return { ok: false, error: `Could not reach the tutor at ${TUTOR_API_LABEL}.` };
  }
}
