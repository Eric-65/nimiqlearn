/* ============================================================
   NimiqLearn — ExplainBack AI model call (Layer 1)
   ------------------------------------------------------------
   This module owns exactly one thing: turning a learner's
   explanation (plus a compact deterministic assessment signal)
   into a natural-language SmolLM2 call, and validating the JSON
   it returns. It has no opinion about *when* to call the model,
   what to do if it fails, or what the deterministic baseline is
   — that orchestration lives in assessmentService.js (Layer 2).

   Hybrid design (see training/README.md, phase 1):
     learner answer -> assessmentService baseline (score, missing
     concepts, misconceptions) -> THIS module -> SmolLM2 -> prose
   SmolLM2 receives the compact baseline, never the raw dataset.
   ============================================================ */

import { generateLearningResponse, parseAIResponse } from "./aiService.js";
import { TOPIC_CONTENT } from "../data/mockTopics.js";

const SYSTEM_PROMPT = `You are NimiqLearn, a concise educational assessment assistant.

You will be given a deterministic assessment signal (score, missing concepts,
possible misconceptions) already computed for the learner's explanation.
Use it as ground truth — do not contradict it. Your job is to turn it into
warm, concrete, natural-language feedback and one next challenge.

Return valid JSON:
{"summary":"1-2 sentences","strengths":[".."],"missingConcepts":[".."],"misconceptions":[".."],"masteryEstimate":0,"nextAction":"one sentence","nextChallenge":"one question"} `;

export function buildExplainBackPrompt({ topic, learnerExplanation, learnerLevel, baseline }) {
  const content = TOPIC_CONTENT[topic.id] || {};
  const signalBlock = baseline
    ? `Assessment score: ${baseline.score}/100
Missing concepts: ${(baseline.missingConcepts || []).join(" | ") || "none detected"}
Possible misconceptions: ${(baseline.misconceptions || []).join(" | ") || "none detected"}`
    : `Key ideas: ${(content.keyPoints || []).slice(0, 3).join(" | ") || "—"}`;

  return {
    system: SYSTEM_PROMPT,
    user: `Concept:
${topic.name}

Level:
${learnerLevel}

Learner explanation:
${learnerExplanation}

${signalBlock}

Give concise educational feedback and one next challenge. Return the JSON assessment.`,
  };
}

/* ------------------ JSON extraction & validation ------------------ */

// Shared robust extraction lives in the AI service (direct parse →
// markdown fences → outermost braces). Re-exported for compatibility.
export { extractJsonObject } from "./aiService.js";

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

/* ------------------ Main entry (Layer 1 only) ------------------ */

/**
 * Call SmolLM2 to turn a deterministic baseline into natural-language
 * feedback. Never decides fallback policy — throws or returns {ok:false}
 * on any problem, and the caller (assessmentService) decides what to do.
 *
 * baseline: the assessmentService rubric result, used both as the
 *           compact model input AND as the validation fallback shape.
 */
export async function callModelAssessment({ topic, learnerExplanation, learnerLevel = "beginner", baseline, onToken = null }) {
  const prompt = buildExplainBackPrompt({ topic, learnerExplanation, learnerLevel, baseline });
  const raw = await generateLearningResponse({
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
    maxNewTokens: 180,
    temperature: 0.35,
    onToken,
  });

  const parsed = parseAIResponse(raw, {
    validate: (obj) => ({ ok: true, value: validateEvaluation(obj, baseline) }),
    fallback: null,
  });
  if (!parsed.ok) return { ok: false, value: null, raw };
  return { ok: true, value: parsed.value, raw };
}
