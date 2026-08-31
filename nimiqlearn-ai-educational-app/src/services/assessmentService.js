/* ============================================================
   NimiqLearn — ExplainBack Assessment Service (Layer 2)
   ------------------------------------------------------------
   The public assessment abstraction. The rest of the app (and
   the UI) calls evaluateExplanation() and never needs to know
   whether the answer came from the rubric baseline or SmolLM2.

   Architecture (see training/README.md for the full roadmap):

     learner explanation
       -> computeRubricBaseline()   [deterministic, always runs]
       -> SmolLM2 (via explainBackService), fed the compact
          baseline signal — never the raw dataset            [optional]
       -> normalized result: { score, strengths, missingConcepts,
          misconceptions, masteryEstimate, nextAction, source }

   The rubric baseline is informed by the *shape* of the
   Automatic Short Answer Grading dataset (question / referenceAnswer
   / learnerAnswer / score / maxScore — see
   training/explainback/README.md) but does not require that
   dataset at runtime: TOPIC_CONTENT already carries a reference
   definition per topic, so the rubric works standalone. Passing
   an explicit `referenceAnswer` (e.g. from mockExplainBackExamples
   in demo mode) sharpens the CORE_DEFINITION dimension.

   This is a hand-written heuristic, not a trained model. Treat
   its score as a rough signal, not a validated grading result —
   see training/evaluation/README.md for how a trained model
   would eventually be compared against this baseline.
   ============================================================ */

import { isAIReady } from "./aiService.js";
import { callModelAssessment } from "./explainBackService.js";
import { TOPIC_CONTENT } from "../data/mockTopics.js";

export const ASSESSMENT_SOURCE = {
  MODEL: "smolLM2",
  TRAINED: "trained-assessment-model", // reserved — not implemented (see training/README.md, phase 5)
  BASELINE: "deterministic-fallback",
};

export const RUBRIC_DIMENSIONS = ["CORE_DEFINITION", "APPLICATION", "KEY_RELATIONSHIPS", "EXAMPLE", "MISCONCEPTIONS"];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* ------------------ tiny text-similarity toolkit ------------------ */
/* No ML dependency — token-overlap is enough for a transparent,
   explainable baseline. See section "EXPLAINBACK BASELINE" in the
   architecture prompt: similarity alone never proves understanding,
   so it is only ONE input into the rubric below. */

const STOPWORDS = new Set([
  "the","a","an","is","are","was","were","be","been","to","of","in","on","for","and","or",
  "it","its","this","that","with","as","at","by","from","you","your","if","then","so","but",
  "can","will","would","should","could","do","does","did","not","no","yes","i","we","they",
  "he","she","them","his","her","their","our","my","me","us","which","what","how","when",
  // Boilerplate lead-ins used across every TOPIC_CONTENT.misconception string
  // (e.g. "Learners often confuse X with Y") — stripping these lets
  // significant-word extraction reach the actual misconception content
  // instead of getting stuck on the generic framing.
  "learners","learner","often","many","commonly","instead","either","some",
  "think","thinks","thought","confuse","confuses","confusing","assert","asserts",
  "mix","mixes","forget","forgets","drop","drops","without",
]);

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Ranks by frequency (not just first appearance) so a word repeated
 * throughout the source — usually the actual point being made — outranks
 * incidental words from the surrounding sentence framing. */
function significantWords(text, max = 6) {
  const freq = new Map();
  for (const t of tokenize(text)) {
    if (t.length <= 3) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([w]) => w);
}

/** Recall-oriented overlap: how much of `reference` shows up in `answer`. */
function coverageRatio(answerTokens, referenceTokens) {
  if (!referenceTokens.length) return 0;
  const answerSet = new Set(answerTokens);
  const hits = referenceTokens.filter((t) => answerSet.has(t)).length;
  return hits / referenceTokens.length;
}

/* ------------------ rubric baseline (Layer 2 core) ------------------ */

/**
 * Deterministic rubric assessment. Always available, never blocks on the
 * AI. This is the "trained-assessment-model" stand-in until the pipeline in training/ actually beats it (Phase 3-5, see
 * training/README.md) — the interface (input/output shape) is designed to
 * stay identical once a real trained model is exported.
 */
export function computeRubricBaseline({ topic, learnerExplanation, referenceAnswer }) {
  const content = TOPIC_CONTENT[topic.id] || {};
  const learnerTokens = tokenize(learnerExplanation);
  const learnerSet = new Set(learnerTokens);

  // CORE_DEFINITION — coverage of the reference answer (explicit, or the
  // topic's canonical definition when no explicit reference is supplied).
  const definitionSource = referenceAnswer || content.definition || "";
  const definitionTokens = tokenize(definitionSource);
  const definitionCoverage = coverageRatio(learnerTokens, definitionTokens);

  // KEY_RELATIONSHIPS / APPLICATION — how many curriculum key points the
  // learner touched on, judged by shared significant vocabulary.
  const keyPoints = content.keyPoints || [];
  const keyPointHits = keyPoints.map((kp) => {
    const words = significantWords(kp);
    const hitCount = words.filter((w) => learnerSet.has(w)).length;
    return { keyPoint: kp, hit: words.length > 0 && hitCount >= 1 };
  });
  const keyPointCoverage = keyPoints.length ? keyPointHits.filter((k) => k.hit).length / keyPoints.length : definitionCoverage;

  // EXAMPLE — did the learner mention anything resembling the worked example?
  const exampleWords = significantWords(content.example || "", 5);
  const exampleTouched = exampleWords.length > 0 && exampleWords.some((w) => learnerSet.has(w));

  // MISCONCEPTIONS — best-effort: the learner's text echoes the same
  // significant vocabulary as the known misconception description. Domain
  // vocabulary (e.g. "force", "mass") appears in both correct and
  // incorrect explanations, so this only fires when the learner is NOT
  // otherwise showing strong coverage — echoing the words while getting
  // the underlying idea right is not a misconception.
  const overallCoverage = (definitionCoverage + keyPointCoverage) / 2;
  const misconceptionWords = significantWords(content.misconception || "", 6);
  const misconceptionHitCount = misconceptionWords.filter((w) => learnerSet.has(w)).length;
  const misconceptionFlag = overallCoverage < 0.5 && misconceptionWords.length >= 2 && misconceptionHitCount >= 2;

  const usesTopicTerm = topic.name
    .toLowerCase()
    .split(/\s+/)
    .some((w) => w.length > 3 && learnerSet.has(w));

  const rawScore =
    0.45 * definitionCoverage +
    0.4 * keyPointCoverage +
    0.1 * (exampleTouched ? 1 : 0) +
    0.05 * (usesTopicTerm ? 1 : 0) -
    (misconceptionFlag ? 0.18 : 0);

  const score = clamp(Math.round(rawScore * 100), learnerTokens.length ? 5 : 0, 100);

  const strengths = keyPointHits.filter((k) => k.hit).map((k) => `You correctly touched on: ${k.keyPoint}`);
  if (!strengths.length && learnerTokens.length) {
    strengths.push("You attempted an explanation — that is the most important step.");
  }

  const missingConcepts = keyPointHits
    .filter((k) => !k.hit)
    .slice(0, 3)
    .map((k) => `Explore: ${k.keyPoint.toLowerCase()}`);

  const misconceptions = misconceptionFlag && content.misconception ? [content.misconception] : [];

  return {
    summary:
      score >= 55
        ? "Solid start — you captured several core ideas."
        : "You touched on the topic, but several core ideas are still missing.",
    strengths,
    missingConcepts: missingConcepts.length ? missingConcepts : ["Connect the core ideas into one complete sentence."],
    misconceptions,
    masteryEstimate: score,
    score,
    nextAction:
      score < 45
        ? "Read a short explanation, then try the misconception-targeted challenge."
        : "Try a real-world example, then explain it back again.",
    nextChallenge:
      score < 45
        ? `Can you explain what would happen if the key quantity in ${topic.name} changed?`
        : `Can you explain how ${topic.name} applies to a real situation you have seen?`,
    rubric: {
      dimensions: RUBRIC_DIMENSIONS,
      coreDefinitionCoverage: Math.round(definitionCoverage * 100),
      keyRelationshipsCoverage: Math.round(keyPointCoverage * 100),
      exampleTouched,
      misconceptionFlag,
    },
  };
}

/* ------------------ public entry point ------------------ */

/**
 * Every caller gets this exact shape — see docs/learning-engine.md for the
 * full ExplainBack result contract:
 *   { conceptId, score, masteryEstimate, strengths, missingConcepts,
 *     misconceptions, feedback, nextAction }
 * plus a few app-specific extras (nextChallenge, source, confidence,
 * aiPending, note) that existing UI already depends on — additive, never
 * a breaking rename of what's already there.
 */
function normalizeResult(value, meta, conceptId) {
  const score = clamp(Math.round(value.masteryEstimate ?? 0), 0, 100);
  return {
    conceptId,
    summary: value.summary,
    feedback: value.summary,
    strengths: value.strengths || [],
    missingConcepts: value.missingConcepts || [],
    misconceptions: value.misconceptions || [],
    masteryEstimate: score,
    score,
    maxScore: 100,
    nextAction: value.nextAction,
    nextChallenge: value.nextChallenge,
    ...meta,
  };
}

/**
 * Evaluate a learner's explanation. This is the ONE function the rest of
 * the app calls — it never exposes which layer produced the result to
 * the UI beyond the transparent `source`/`confidence` fields.
 *
 * - preferAI=false            → rubric baseline only (explicit escape hatch)
 * - AI not ready               → rubric baseline, instant, aiPending:true
 * - AI ready                   → SmolLM2, fed the rubric baseline as a
 *                                 compact signal (never the raw dataset)
 * - AI call fails/unparseable  → rubric baseline, transparently noted
 */
export async function evaluateExplanation({ topic, referenceAnswer, learnerExplanation, learnerLevel = "beginner", preferAI = true, onToken = null }) {
  if (!topic || !learnerExplanation || !learnerExplanation.trim()) {
    throw new Error("An explanation is required before evaluation.");
  }

  const baseline = computeRubricBaseline({ topic, learnerExplanation, referenceAnswer });

  if (!preferAI || !isAIReady()) {
    return normalizeResult(baseline, {
      source: ASSESSMENT_SOURCE.BASELINE,
      confidence: "heuristic",
      aiPending: preferAI ? true : false,
      note: !preferAI
        ? "You chose the built-in assessment engine for this explanation."
        : "The AI assistant is still preparing, so this assessment used the built-in engine instantly. You can retry with AI once it's ready.",
    }, topic.id);
  }

  try {
    const result = await callModelAssessment({ topic, learnerExplanation, learnerLevel, baseline, onToken });
    if (!result.ok) {
      return normalizeResult(baseline, {
        source: ASSESSMENT_SOURCE.BASELINE,
        confidence: "heuristic",
        aiPending: false,
        note: "The AI returned unreadable output; a safe fallback assessment was used.",
      }, topic.id);
    }
    return normalizeResult(result.value, { source: ASSESSMENT_SOURCE.MODEL, confidence: "model", aiPending: false, note: null }, topic.id);
  } catch (err) {
    console.warn("[NimiqLearn] ExplainBack model call failed, using rubric baseline.", err);
    return normalizeResult(baseline, {
      source: ASSESSMENT_SOURCE.BASELINE,
      confidence: "heuristic",
      aiPending: false,
      note: "The local AI model was unavailable; a deterministic fallback assessment was used.",
    }, topic.id);
  }
}
