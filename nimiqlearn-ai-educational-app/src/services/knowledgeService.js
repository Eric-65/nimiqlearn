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

  const updated = {
    ...(entry || {}),
    topicId: entry.topicId,
    topicName: entry.topicName,
    mastery,
    status: statusFromMastery(mastery, true),
    lastEvaluatedAt: now,
    strengths: mergeUnique(entry?.strengths, evaluation?.strengths || []),
    missingConcepts: mergeUnique(entry?.missingConcepts, evaluation?.missingConcepts || []),
    misconceptions: mergeUnique(entry?.misconceptions, evaluation?.misconceptions || []),
  };
  return withReviewPriority(updated, now);
}

/**
 * Record the outcome of any learning activity on the topic.
 * correct: boolean | null
 */
export function applyActivityResult(entry, { correct, activityType = "ACTIVITY", now = Date.now() } = {}) {
  const updated = { ...(entry || {}) };
  if (correct === true) {
    updated.mastery = clamp((updated.mastery ?? 0) + 3, 0, 100);
    updated.recentPerformance = [...(updated.recentPerformance || []), 1].slice(-8);
  } else if (correct === false) {
    updated.mastery = clamp((updated.mastery ?? 0) - 6, 0, 100);
    updated.recentPerformance = [...(updated.recentPerformance || []), 0].slice(-8);
  }
  updated.status = statusFromMastery(updated.mastery, !!updated.lastEvaluatedAt || updated.mastery > 0);
  return withReviewPriority(updated, now);
}

export function recordReview(entry, { correct = true, now = Date.now() } = {}) {
  const updated = {
    ...(entry || {}),
    lastReviewedAt: now,
    reviewCount: (entry?.reviewCount ?? 0) + 1,
    recentPerformance: [...(entry?.recentPerformance || []), correct ? 1 : 0].slice(-8),
    mastery: correct ? clamp((entry?.mastery ?? 0) + 2, 0, 100) : clamp((entry?.mastery ?? 0) - 4, 0, 100),
  };
  updated.status = statusFromMastery(updated.mastery, true);
  return withReviewPriority(updated, now);
}

export function withReviewPriority(entry, now = Date.now()) {
  const rec = computeReviewRecommendation(entry, now);
  return { ...entry, reviewPriority: rec.priorityScore, recommendedReviewAt: rec.recommendedReviewAt };
}

export function refreshAllReviewPriorities(knowledgeEntries, now = Date.now()) {
  const queue = buildReviewQueue(knowledgeEntries, now);
  return knowledgeEntries.map((e) => {
    const rec = queue.find((q) => q.topicId === e.topicId);
    return rec ? { ...e, reviewPriority: rec.priorityScore, recommendedReviewAt: rec.recommendedReviewAt } : e;
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
