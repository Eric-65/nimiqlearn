/* ============================================================
   NimiqLearn — ExplainBack AI evaluation service
   ------------------------------------------------------------
   Asks the local AI model (SmolLM2-135M) to assess a learner's
   explanation. The prompt is deliberately short — the model is
   small and we want fast, useful feedback. Output is strictly
   validated; malformed JSON falls back to a safe deterministic
   heuristic so the app never crashes.
   ============================================================ */

import { generateLearningResponse, isAIReady, parseAIResponse } from "./aiService.js";
import { TOPIC_CONTENT } from "../data/mockTopics.js";

const SYSTEM_PROMPT = `You are NimiqLearn, a concise educational assessment assistant.

Evaluate whether the learner understands the concept.

Identify:
1. strengths
2. missing concepts
3. misconceptions
4. estimated understanding (0-100)
5. one next challenge

Return valid JSON:
{"summary":"1-2 sentences","strengths":[".."],"missingConcepts":[".."],"misconceptions":[".."],"masteryEstimate":0,"nextAction":"one sentence","nextChallenge":"one question"} `;

export function buildExplainBackPrompt({ topic, learnerExplanation, learnerLevel }) {
  const content = TOPIC_CONTENT[topic.id] || {};
  return {
    system: SYSTEM_PROMPT,
    user: `Concept:
${topic.name}

Level:
${learnerLevel}

Learner explanation:
${learnerExplanation}

Key ideas: ${(content.keyPoints || []).slice(0, 3).join(" | ") || "—"}

Return the JSON assessment.`,
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

/* ------------------ Deterministic heuristic fallback ------------------ */

const KEYWORD_INDEX = {
  "linear-equations": {
    concept: ["isolate", "balance", "inverse", "both sides", "variable"],
    terms: ["equation", "solve"],
  },
  quadratics: {
    concept: ["factor", "parabola", "formula", "discriminant", "root", "square"],
    terms: ["quadratic"],
  },
  functions: {
    concept: ["input", "output", "domain", "range", "vertical line", "map"],
    terms: ["function"],
  },
  angles: {
    concept: ["complementary", "supplementary", "parallel", "transversal", "180", "90"],
    terms: ["angle"],
  },
  proofs: {
    concept: ["statement", "reason", "postulate", "theorem", "given", "deduc"],
    terms: ["proof"],
  },
  "newtons-second-law": {
    concept: ["force", "mass", "acceleration", "net force", "f=ma", "newton"],
    terms: ["accelerat", "law"],
  },
  "energy-work": {
    concept: ["work", "force", "distance", "kinetic", "potential", "conserv", "joule"],
    terms: ["energy"],
  },
  "python-basics": {
    concept: ["variable", "loop", "function", "condition", "indent", "print"],
    terms: ["python", "code"],
  },
  "ai-fundamentals": {
    concept: ["train", "inference", "data", "pattern", "predict", "model"],
    terms: ["ai", "model"],
  },
};

function heuristicEvaluation({ topic, learnerExplanation }) {
  const text = (learnerExplanation || "").toLowerCase();
  const profile = KEYWORD_INDEX[topic.id] || { concept: [], terms: [] };
  const content = TOPIC_CONTENT[topic.id] || {};

  const hits = profile.concept.filter((k) => text.includes(k));
  const mentions = profile.terms.some((t) => text.includes(t));
  const coverage = profile.concept.length ? hits.length / profile.concept.length : 0;

  const misconceptionHits = [];
  if (content.misconception) {
    // crude signal: learner restates the misconception itself
    const badPhrases = ["weight", "mass and weight are the same", "constant velocity means no force"];
    if (badPhrases.some((p) => text.includes(p))) misconceptionHits.push("Confuses mass with weight (constant velocity still needs zero NET force).");
  }

  const masteryEstimate = mentions
    ? clamp(Math.round(coverage * 68 + 12), 8, 85)
    : clamp(Math.round(coverage * 45), 5, 55);

  const strengths = hits.length
    ? [`You correctly mentioned: ${hits.slice(0, 3).join(", ")}`]
    : ["You attempted an explanation — that is the most important step."];

  const missingConcepts = (content.keyPoints || [])
    .filter((_, i) => !hits[i]) // simple pairing, good enough for a fallback
    .slice(0, 3)
    .map((p) => `Explore: ${p.toLowerCase()}`);

  return {
    summary:
      coverage >= 0.5
        ? "Solid start — you captured several core ideas. The AI tutor will now refine the missing pieces."
        : "You touched on the topic, but several core ideas are still missing. Let's build them up step by step.",
    strengths,
    missingConcepts: missingConcepts.length ? missingConcepts : ["Connect the core ideas into one complete sentence."],
    misconceptions: misconceptionHits,
    masteryEstimate,
    nextAction:
      masteryEstimate < 45
        ? "Read a short explanation, then try the misconception-targeted challenge."
        : "Try a real-world example, then explain it back again.",
    nextChallenge:
      masteryEstimate < 45
        ? `Can you explain what would happen if the key quantity in ${topic.name} changed?`
        : `Can you explain how ${topic.name} applies to a real situation you have seen?`,
  };
}

/* ------------------ Main entry ------------------ */

/**
 * Evaluate a learner explanation.
 * - preferAI=false → deterministic engine only (escape hatch).
 * - AI not ready → deterministic engine with aiPending:true (instant,
 *   never blocks); the page prewarms so this is rare.
 * - AI ready → model evaluation with a tight 240-token output budget
 *   (within the 150–300 target) for low latency.
 * - onToken → real streaming callback for live output while generating.
 */
export async function evaluateExplanation({ topic, learnerExplanation, learnerLevel = "beginner", preferAI = true, onToken = null }) {
  if (!topic || !learnerExplanation || !learnerExplanation.trim()) {
    throw new Error("An explanation is required before evaluation.");
  }

  const fallback = heuristicEvaluation({ topic, learnerExplanation });

  if (!preferAI || !isAIReady()) {
    return {
      ...fallback,
      confidence: "heuristic",
      aiPending: !preferAI ? false : true,
      note: !preferAI
        ? "You chose the built-in assessment engine for this explanation."
        : "The AI assistant is still preparing, so this assessment used the built-in engine instantly. You can retry with AI once it's ready.",
    };
  }

  try {
    const prompt = buildExplainBackPrompt({ topic, learnerExplanation, learnerLevel });
    const raw = await generateLearningResponse({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      maxNewTokens: 180,
      temperature: 0.35,
      onToken,
    });

    const parsed = parseAIResponse(raw, {
      validate: (obj) => ({ ok: true, value: validateEvaluation(obj, fallback) }),
      fallback: null,
    });
    if (!parsed.ok) {
      return {
        ...fallback,
        confidence: "heuristic",
        aiPending: false,
        note: "The AI returned unreadable output; a safe fallback assessment was used.",
      };
    }
    return { ...parsed.value, confidence: "model", aiPending: false, note: null };
  } catch (err) {
    console.warn("[NimiqLearn] ExplainBack model call failed, using heuristic fallback.", err);
    return {
      ...fallback,
      confidence: "heuristic",
      aiPending: false,
      note: "The local AI model was unavailable; a deterministic fallback assessment was used.",
    };
  }
}
