/* ============================================================
   NimiqLearn — ExplainBack primary grading (OpenAI-backed)
   ------------------------------------------------------------
   Replaces the old on-device SmolLM2 call (previously
   explainBackService.js, now removed) — same job, different
   transport. SmolLM2 required downloading and running a
   multi-hundred-MB model in the browser, which is what made
   "Analyzing your explanation…" slow; this instead makes one
   short request to NimiqLearn's own backend (../../server/),
   which calls OpenAI server-side. Never imports the OpenAI SDK
   and never sees an API key — reuses the same backend/config as
   the AI Tutor (explainBackTutorConfig.js), since it's the same
   server and the same OPENAI_API_KEY either way.

   assessmentService.js (Layer 2) owns fallback policy — this
   module only turns a learner's explanation + the deterministic
   rubric signal into a request, and validates what comes back.
   Never contradicts the rubric signal it was given; only adds
   natural-language framing and a next challenge.
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


const REQUEST_TIMEOUT_MS = 30_000;

export function isAssessmentBackendConfigured() {
  return TUTOR_CONFIGURED;
}

function withTimeout(promiseFactory, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { promise: promiseFactory(controller.signal), cancel: () => clearTimeout(timer) };
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function toShortList(value, fallback = [], max = 5) {
  if (!Array.isArray(value)) {
    if (typeof value === "string" && value.trim()) return [value.trim().slice(0, 120)];
    return fallback;
  }
  return value
    .filter((x) => typeof x === "string" && x.trim().length > 1)
    .map((x) => x.trim().slice(0, 120))
    .slice(0, max);
}

/** Never trusts raw model output blindly — clamps/validates every field,
 * falling back to the deterministic baseline's own value per-field if the
 * model's response is missing or malformed for that field. */
export function validateEvaluation(raw, fallback) {
  const base = fallback || {};
  const obj = raw && typeof raw === "object" ? raw : {};
  return {
    summary: typeof obj.summary === "string" && obj.summary.trim() ? obj.summary.trim().slice(0, 400) : base.summary,
    strengths: toShortList(obj.strengths, base.strengths),
    missingConcepts: toShortList(obj.missingConcepts, base.missingConcepts),
    misconceptions: toShortList(obj.misconceptions, base.misconceptions),
    masteryEstimate: clamp(Number.isFinite(Number(obj.masteryEstimate)) ? Math.round(Number(obj.masteryEstimate)) : base.masteryEstimate, 0, 100),
    nextAction: typeof obj.nextAction === "string" && obj.nextAction.trim() ? obj.nextAction.trim().slice(0, 240) : base.nextAction,
    nextChallenge: typeof obj.nextChallenge === "string" && obj.nextChallenge.trim() ? obj.nextChallenge.trim().slice(0, 200) : base.nextChallenge,
  };
}

/**
 * Call the backend to turn a deterministic baseline into natural-language
 * feedback. Never decides fallback policy — returns {ok:false} on any
 * problem, and the caller (assessmentService.js) decides what to do.
 *
 * baseline: the assessmentService rubric result, used both as the
 *           compact model input AND as the validation fallback shape.
 */
export async function callModelAssessment({ topic, learnerExplanation, learnerLevel = "beginner", baseline }) {
  if (!TUTOR_CONFIGURED) {
    return { ok: false, value: null, error: "Assessment backend isn't configured." };
  }

  const { promise, cancel } = withTimeout(
    (signal) =>
      fetch(`${TUTOR_API_URL}/api/assess/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.name,
          learnerExplanation,
          learnerLevel,
          baseline: baseline
            ? { score: baseline.score, missingConcepts: baseline.missingConcepts, misconceptions: baseline.misconceptions }
            : null,
          ...localePayload(),
        }),
        signal,
      }),
    REQUEST_TIMEOUT_MS
  );

  try {
    const res = await promise;
    cancel();
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.ok) {
      return { ok: false, value: null, error: data?.error || `Assessment backend error (${res.status}).` };
    }
    return { ok: true, value: validateEvaluation(data.value, baseline) };
  } catch (err) {
    cancel();
    if (err.name === "AbortError") {
      return { ok: false, value: null, error: "The assessment backend took too long to respond." };
    }
    return { ok: false, value: null, error: `Could not reach the assessment backend at ${TUTOR_API_LABEL}.` };
  }
}
