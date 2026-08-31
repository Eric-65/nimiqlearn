/* ============================================================
   NimiqLearn — ForgetMeNot AI (review scheduling)
   ------------------------------------------------------------
   The app owns scheduling with transparent, deterministic
   logic. The AI may generate review *content*, but the timing
   is never decided by a language model. We make no claim to
   scientifically predict memory loss — this is a transparent
   spaced-repetition heuristic.
   ============================================================ */

import { REVIEW_PRIORITY, reviewLevelLabel } from "../config/learningThresholds.js";

const DAY = 24 * 60 * 60 * 1000;

const STATUS_INTERVAL_DAYS = {
  NEW: 1,
  LEARNING: 3,
  DEVELOPING: 7,
  STRONG: 14,
  MASTERED: 21,
};

/**
 * Compute a review priority score (0-100) plus a recommended
 * review date for one topic's knowledge entry.
 */
export function computeReviewRecommendation(entry, now = Date.now()) {
  const mastery = entry?.mastery ?? 0;
  const lastReviewedAt = entry?.lastReviewedAt || entry?.lastEvaluatedAt || now - 30 * DAY;
  const reviewCount = entry?.reviewCount ?? 0;
  const recent = entry?.recentPerformance ?? [];

  const daysSinceReview = Math.max(0, (now - lastReviewedAt) / DAY);
  const baseInterval = STATUS_INTERVAL_DAYS[entry?.status] || 3;

  // 1. Mastery component: low mastery → higher priority (weight 0.4)
  const masteryScore = 100 - mastery;

  // 2. Recency component: the longer overdue, the higher priority (weight 0.3)
  const overdue = Math.max(0, daysSinceReview - baseInterval);
  const recencyScore = Math.min(100, (overdue / Math.max(baseInterval, 1)) * 100);

  // 3. Failure component: recent incorrect answers raise priority (weight 0.2)
  const failures = recent.filter((r) => r === 0).length;
  const failureScore = recent.length ? (failures / recent.length) * 100 : 0;

  // 4. Stability component: successful reviews lower priority (weight 0.1)
  const stabilityScore = Math.min(100, reviewCount * 12);

  const priorityScore = Math.round(
    clamp01(0.4 * masteryScore + 0.3 * recencyScore + 0.2 * failureScore - 0.1 * stabilityScore)
  );

  // Interval grows with mastery and successful review count
  const intervalDays = Math.round(baseInterval * (1 + Math.min(2, reviewCount * 0.35)));
  const recommendedReviewAt = lastReviewedAt + intervalDays * DAY;
  const dueNow = now >= recommendedReviewAt || priorityScore >= REVIEW_PRIORITY.DUE_SOON;

  const levelLabel = reviewLevelLabel(priorityScore);

  return {
    topicId: entry.topicId,
    topicName: entry.topicName,
    mastery,
    priorityScore,
    daysSinceReview: Math.round(daysSinceReview),
    intervalDays,
    recommendedReviewAt,
    dueNow,
    levelLabel,
  };
}

/** Rank all topics by review priority (for the ForgetMeNot queue). */
export function buildReviewQueue(knowledgeEntries, now = Date.now()) {
  return knowledgeEntries
    .map((e) => computeReviewRecommendation(e, now))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/** After a successful review, the next interval grows. */
export function nextReviewIntervalDays(entry) {
  const base = STATUS_INTERVAL_DAYS[entry?.status] || 3;
  return Math.round(base * (1 + Math.min(2, (entry?.reviewCount ?? 0) * 0.35)));
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}
