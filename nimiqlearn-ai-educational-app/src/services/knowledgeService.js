/* ============================================================
   NimiqLearn — Knowledge state service
   ------------------------------------------------------------
   Application-owned learner model. AI assessments feed into
   it, but the mastery value, status, and scheduling are always
   computed by deterministic application logic.
   ============================================================ */

import { computeReviewRecommendation, buildReviewQueue } from "./forgetMeNotService.js";

export const STATUS_ORDER = ["NEW", "LEARNING", "DEVELOPING", "STRONG", "MASTERED"];

export function statusFromMastery(mastery, evaluated) {
  if (!evaluated) return "NEW";
  if (mastery >= 85) return "MASTERED";
  if (mastery >= 65) return "STRONG";
  if (mastery >= 40) return "DEVELOPING";
  return "LEARNING";
}

export const STATUS_META = {
  NEW: { color: "var(--st-new)", label: "New" },
  LEARNING: { color: "var(--st-learning)", label: "Learning" },
  DEVELOPING: { color: "var(--st-developing)", label: "Developing" },
  STRONG: { color: "var(--st-strong)", label: "Strong" },
  MASTERED: { color: "var(--st-mastered)", label: "Mastered" },
};

/**
 * Confidence (0-100) is deliberately SEPARATE from mastery: mastery is
 * "how well does the learner seem to understand this", confidence is
 * "how much evidence backs that number." Documented weights:
 *
 *   confidence = 70% evidence volume + 30% evidence consistency
 *
 * - Evidence volume saturates at 8 attempts (matches the recentPerformance
 *   window elsewhere in this file) — past that, more attempts don't
 *   further raise confidence, they just keep the mastery estimate fresh.
 * - Evidence consistency is how much recent results agree with each
 *   other (all-correct or all-incorrect = 1.0, an even 50/50 split = 0).
 *   A single excellent answer has low volume (confidence ~39 even though
 *   its own consistency is 1.0), so it reads very differently from many
 *   consistent successful attempts (confidence ~100) — exactly the
 *   distinction confidence exists to capture.
 */
export function calculateConfidence(entry) {
  const attempts = (entry?.correctAttempts ?? 0) + (entry?.incorrectAttempts ?? 0);
  const volumeScore = Math.min(1, attempts / 8);

  const recent = entry?.recentPerformance ?? [];
  let consistencyScore = 0;
  if (recent.length) {
    const rate = recent.reduce((a, b) => a + b, 0) / recent.length;
    consistencyScore = Math.abs(rate - 0.5) * 2; // 0 at 50/50, 1 when all-same
  }

  return Math.round(clamp(100 * (0.7 * volumeScore + 0.3 * consistencyScore), 0, 100));
}

/** Every update path funnels through this so correctAttempts/incorrectAttempts/
 * lastStudiedAt/confidence stay consistent no matter which activity produced
 * the evidence (ExplainBack evaluation, a practice question, or a review). */
function recordEvidence(entry, wasCorrect, now) {
  const updated = { ...entry };
  if (wasCorrect === true) updated.correctAttempts = (entry?.correctAttempts ?? 0) + 1;
  else if (wasCorrect === false) updated.incorrectAttempts = (entry?.incorrectAttempts ?? 0) + 1;
  updated.attempts = (updated.correctAttempts ?? 0) + (updated.incorrectAttempts ?? 0);
  updated.lastStudiedAt = now;
  updated.confidence = calculateConfidence(updated);
  return updated;
}

const mergeUnique = (existing = [], incoming = [], max = 4) => {
  const seen = new Set(existing.map((s) => s.toLowerCase()));
  const merged = [...existing];
  for (const item of incoming) {
    if (merged.length >= max) break;
    const key = String(item).toLowerCase();
    if (!seen.has(key) && item) {
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
};

/**
 * Blend a model assessment into the application knowledge state.
 * mastery = 0.55 * (AI estimate) + 0.45 * (previous application mastery)
 * The AI estimate is a model-generated assessment; the stored value
 * is the application's learner state.
 */
export function updateKnowledgeAfterEvaluation(entry, evaluation, now = Date.now()) {
  const aiEstimate = clamp(evaluation?.masteryEstimate ?? 0, 0, 100);
  const prevMastery = entry?.mastery ?? 0;

  // Recent failures pull the blend down a little
  const recent = entry?.recentPerformance ?? [];
  const failurePenalty = recent.filter((r) => r === 0).length * 4;

  const blended = Math.round(0.55 * aiEstimate + 0.45 * prevMastery - failurePenalty);
  const mastery = clamp(blended, 0, 100);

  // An ExplainBack evaluation has no discrete right/wrong answer, only a
  // score — classify >=50 as positive evidence, matching the midpoint of
  // the 0-100 scale (documented here since it's a judgment call, not a
  // value carried over from elsewhere).
  const wasPositiveEvidence = aiEstimate >= 50;

  let updated = {
    ...(entry || {}),
    // Optional like every other read in this function — callers may pass a
    // topic the learner has no entry for yet.
    topicId: entry?.topicId ?? null,
    topicName: entry?.topicName ?? null,
    mastery,
    status: statusFromMastery(mastery, true),
    lastEvaluatedAt: now,
    strengths: mergeUnique(entry?.strengths, evaluation?.strengths || []),
    missingConcepts: mergeUnique(entry?.missingConcepts, evaluation?.missingConcepts || []),
    misconceptions: mergeUnique(entry?.misconceptions, evaluation?.misconceptions || []),
    // ExplainBack evaluations are evidence too — without this, "recent
    // performance" would stay empty for a learner who only ever uses
    // ExplainBack (never a practice question or review).
    recentPerformance: [...(entry?.recentPerformance || []), wasPositiveEvidence ? 1 : 0].slice(-8),
  };
  updated = recordEvidence(updated, wasPositiveEvidence, now);
  return withReviewPriority(updated, now);
}

/**
 * Record the outcome of any learning activity on the topic.
 * correct: boolean | null
 */
export function applyActivityResult(entry, { correct, activityType = "ACTIVITY", now = Date.now() } = {}) {
  let updated = { ...(entry || {}) };
  if (correct === true) {
    updated.mastery = clamp((updated.mastery ?? 0) + 3, 0, 100);
    updated.recentPerformance = [...(updated.recentPerformance || []), 1].slice(-8);
  } else if (correct === false) {
    updated.mastery = clamp((updated.mastery ?? 0) - 6, 0, 100);
    updated.recentPerformance = [...(updated.recentPerformance || []), 0].slice(-8);
  }
  updated.status = statusFromMastery(updated.mastery, !!updated.lastEvaluatedAt || updated.mastery > 0);
  if (correct === true || correct === false) updated = recordEvidence(updated, correct, now);
  return withReviewPriority(updated, now);
}

export function recordReview(entry, { correct = true, now = Date.now() } = {}) {
  let updated = {
    ...(entry || {}),
    lastReviewedAt: now,
    reviewCount: (entry?.reviewCount ?? 0) + 1,
    recentPerformance: [...(entry?.recentPerformance || []), correct ? 1 : 0].slice(-8),
    mastery: correct ? clamp((entry?.mastery ?? 0) + 2, 0, 100) : clamp((entry?.mastery ?? 0) - 4, 0, 100),
  };
  updated.status = statusFromMastery(updated.mastery, true);
  updated = recordEvidence(updated, correct, now);
  return withReviewPriority(updated, now);
}

export function withReviewPriority(entry, now = Date.now()) {
  const rec = computeReviewRecommendation(entry, now);
  return { ...entry, reviewPriority: rec.priorityScore, recommendedReviewAt: rec.recommendedReviewAt, nextReviewAt: rec.nextReviewAt };
}

export function refreshAllReviewPriorities(knowledgeEntries, now = Date.now()) {
  const queue = buildReviewQueue(knowledgeEntries, now);
  return knowledgeEntries.map((e) => {
    const rec = queue.find((q) => q.topicId === e.topicId);
    return rec ? { ...e, reviewPriority: rec.priorityScore, recommendedReviewAt: rec.recommendedReviewAt, nextReviewAt: rec.nextReviewAt } : e;
  });
}

export function averageMastery(knowledgeEntries) {
  const evals = knowledgeEntries.filter((k) => k.mastery > 0);
  if (!evals.length) return 0;
  return Math.round(evals.reduce((sum, k) => sum + k.mastery, 0) / evals.length);
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
