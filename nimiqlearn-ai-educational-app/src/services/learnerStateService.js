/* ============================================================
   NimiqLearn — Learner State Service
   ------------------------------------------------------------
   Predicts near-term learner performance and derives a review
   priority / recommended difficulty / recommended next action.

   This is a DETERMINISTIC BASELINE, informed by the shape of the
   Riiid Answer Correctness Prediction dataset (see
   training/learner_state/README.md) — recent correctness, attempt
   count, recency, topic mastery, recent failures — but it is not
   itself trained on that dataset. No Riiid data is bundled into
   or fetched by the browser (see training/datasets/README.md).

   Scheduling ownership: this service NEVER decides *when* to
   review a concept — that responsibility belongs solely to
   forgetMeNotService.js. It only forwards that service's
   priority score alongside its own performance prediction, so
   downstream code (learningLoopService.js) has one place to ask
   "what should the learner do next."

   Future trained-model swap point (see training/exports/README.md
   for the artifact contract this must satisfy):

     Model input:  recentCorrectness, attemptCount, timeSinceReview,
                    topicMastery, recentFailures
     Model output: probabilityCorrect, reviewPriority,
                    recommendedDifficulty

   Until such a model is trained and exported, predictLearnerState()
   below IS the implementation — call it "Learning Priority" /
   "Review Priority" to learners, never a validated forgetting
   predictor.
   ============================================================ */

import { computeReviewRecommendation } from "./forgetMeNotService.js";
import { masteryBand, recommendedDifficulty, REVIEW_PRIORITY } from "../config/learningThresholds.js";

const ACTION_BY_BAND = { LOW: "EXPLAIN", MID: "EXAMPLE", HIGH: "PRACTICE", MASTERED: "CHALLENGE" };

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/**
 * Low-level baseline: predict the probability the learner answers the
 * NEXT question on this topic correctly, plus a recommended difficulty.
 * Pure function — no knowledge of the app's storage shape.
 */
export function predictLearnerState({
  recentCorrectness = [], // array of 0/1, most recent last
  attemptCount = 0,
  recentFailures = 0,
  topicMastery = 0,
  reviewPriority = 0,
} = {}) {
  const recentRate = recentCorrectness.length
    ? recentCorrectness.reduce((a, b) => a + b, 0) / recentCorrectness.length
    : topicMastery / 100;
  const masteryComponent = clamp01(topicMastery / 100);
  const failurePenalty = Math.min(0.3, recentFailures * 0.06);
  // Attempts add a small confidence bump — more data, less noisy estimate.
  const experienceBump = Math.min(0.05, attemptCount * 0.005);

  const predictedPerformance = Math.round(
    clamp01(0.55 * recentRate + 0.45 * masteryComponent + experienceBump - failurePenalty) * 100
  ) / 100;

  const band = masteryBand(topicMastery);
  const recommendedAction = reviewPriority >= REVIEW_PRIORITY.DUE_SOON ? "REVIEW" : ACTION_BY_BAND[band];

  return {
    predictedPerformance, // 0-1 probability, matches Riiid's "probabilityCorrect" shape
    masteryEstimate: Math.round(topicMastery),
    reviewPriority: Math.round(reviewPriority),
    recommendedDifficulty: recommendedDifficulty(topicMastery),
    recommendedAction,
  };
}

/**
 * Adapter: derive the Riiid-style feature set from the app's own
 * knowledge entry shape (see src/data/mockLearner.js) and produce the
 * same learner-state prediction. This is the function the rest of the
 * app should call.
 */
export function predictFromKnowledgeEntry(entry, now = Date.now()) {
  const recent = entry?.recentPerformance ?? [];
  const recentFailures = recent.filter((r) => r === 0).length;
  const reviewRec = computeReviewRecommendation(entry, now);

  const state = predictLearnerState({
    recentCorrectness: recent,
    attemptCount: (entry?.reviewCount ?? 0) + recent.length,
    recentFailures,
    topicMastery: entry?.mastery ?? 0,
    reviewPriority: reviewRec.priorityScore,
  });

  return { ...state, topicId: entry?.topicId, reviewRecommendation: reviewRec };
}
