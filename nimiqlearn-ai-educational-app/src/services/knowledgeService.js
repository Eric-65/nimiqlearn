/* ============================================================
   NimiqLearn — Knowledge state service
   ------------------------------------------------------------
   Application-owned learner model. AI assessments feed into
   it, but the mastery value, status, and scheduling are always
   computed by deterministic application logic.
   ============================================================ */

import { computeReviewRecommendation, buildReviewQueue } from "./forgetMeNotService.js";
import { appendEvidence, withMasteryStage, evidenceKindFor, EXPLAIN_PASS_SCORE } from "./masteryService.js";

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

/* ---------------- Mastery as a probability estimate ----------------
   Mastery (0-100) is the app's estimate of how likely the learner is
   to understand the concept. Every piece of evidence moves it toward
   100 (success) or toward 0 (failure) by a FRACTION OF THE REMAINING
   DISTANCE — a logistic-style update rather than a fixed increment:

     success:  mastery += GAIN_RATE * weight * (100 - mastery)
     failure:  mastery -= LOSS_RATE * weight * mastery

   So a correct answer on a fresh concept moves it a lot, while the
   same answer at 90% moves it a little (diminishing returns — you can't
   keep "proving" what's already proven). A wrong answer at 10% barely
   moves it (little to lose), while a wrong answer at 90% is a real
   signal. The two rates are deliberately ASYMMETRIC: success pushes
   further than failure pulls, so one slip never wipes out several
   successes. The previous model was fixed +3 / -6 — failure hurt twice
   as much as success helped, the inverse of what a learner should feel.
   ------------------------------------------------------------------ */
const GAIN_RATE = 0.22;
const LOSS_RATE = 0.1;

/** How much evidence each activity type carries. Recalling from memory
 * or explaining in your own words proves more than picking from a list. */
const EVIDENCE_WEIGHT = {
  MULTIPLE_CHOICE: 0.55,
  SHORT_EXPLANATION: 0.55,
  ANALOGY: 0.55,
  EXAMPLE: 0.55,
  PRACTICE: 0.75,
  REVIEW: 0.65,
  OPEN_RESPONSE: 0.85,
  EXPLAIN_BACK: 1.0,
  ACTIVITY: 0.55,
};

/**
 * One piece of right/wrong evidence applied to a mastery value.
 * optionCount: for a correct multiple-choice pick from n options, the
 * answer had a 1/n chance of being a guess — the GAIN is discounted by
 * that probability. The loss never is: a wrong answer is wrong no matter
 * how many options there were.
 */
export function applyEvidence(mastery, { correct, activityType = "ACTIVITY", optionCount = null } = {}) {
  const current = clamp(mastery ?? 0, 0, 100);
  let weight = EVIDENCE_WEIGHT[activityType] ?? EVIDENCE_WEIGHT.ACTIVITY;
  if (correct && Number.isInteger(optionCount) && optionCount >= 2) {
    weight *= 1 - 1 / optionCount;
  }
  const next = correct
    ? current + GAIN_RATE * weight * (100 - current)
    : current - LOSS_RATE * weight * current;
  return Math.round(clamp(next, 0, 100));
}

/**
 * Fold an ExplainBack assessment into the knowledge state. The AI's
 * masteryEstimate is treated as a measurement to regress toward, with the
 * same asymmetry as applyEvidence(): an explanation that scores ABOVE
 * current mastery pulls it up by most of the gap (strong evidence of
 * understanding), one that scores below pulls it down by less (a weak
 * attempt is evidence, but one shouldn't undo several good ones). A
 * learner who tried and fell short still moves — just gently.
 */
export function updateKnowledgeAfterEvaluation(entry, evaluation, now = Date.now()) {
  const aiEstimate = clamp(evaluation?.masteryEstimate ?? 0, 0, 100);
  const prevMastery = entry?.mastery ?? 0;

  const gap = aiEstimate - prevMastery;
  const rate = gap >= 0 ? 0.6 : 0.3;
  const mastery = Math.round(clamp(prevMastery + rate * gap, 0, 100));

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
  /* An ExplainBack evaluation is the one thing that can demonstrate
     CAN_EXPLAIN, so it is filed as EXPLAIN evidence carrying its score —
     a 51 and a 95 both pass, and the ledger keeps the difference. */
  updated = appendEvidence(updated, {
    kind: "EXPLAIN",
    passed: aiEstimate >= EXPLAIN_PASS_SCORE,
    activityType: "EXPLAIN_BACK",
    score: aiEstimate,
    at: now,
  });
  updated = withMasteryStage(updated);
  return withReviewPriority(updated, now);
}

/**
 * Record the outcome of any learning activity on the topic.
 * correct: boolean | null
 */
export function applyActivityResult(entry, { correct, activityType = "ACTIVITY", optionCount = null, now = Date.now() } = {}) {
  let updated = { ...(entry || {}) };
  if (correct === true || correct === false) {
    updated.mastery = applyEvidence(updated.mastery, { correct, activityType, optionCount });
    updated.recentPerformance = [...(updated.recentPerformance || []), correct ? 1 : 0].slice(-8);
  }
  updated.status = statusFromMastery(updated.mastery, !!updated.lastEvaluatedAt || updated.mastery > 0);
  if (correct === true || correct === false) {
    updated = recordEvidence(updated, correct, now);
    /* The ledger records WHAT was demonstrated, not just that something
       went right: a correct multiple-choice answer is retrieval, a correct
       practice problem is application, and only the ledger can tell them
       apart later. See masteryService.js. */
    updated = appendEvidence(updated, {
      kind: evidenceKindFor(activityType),
      passed: correct,
      activityType,
      at: now,
    });
    updated = withMasteryStage(updated);
  }
  return withReviewPriority(updated, now);
}

export function recordReview(entry, { correct = true, optionCount = null, now = Date.now() } = {}) {
  let updated = {
    ...(entry || {}),
    lastReviewedAt: now,
    reviewCount: (entry?.reviewCount ?? 0) + 1,
    recentPerformance: [...(entry?.recentPerformance || []), correct ? 1 : 0].slice(-8),
    mastery: applyEvidence(entry?.mastery, { correct, activityType: "REVIEW", optionCount }),
  };
  updated.status = statusFromMastery(updated.mastery, true);
  updated = recordEvidence(updated, correct, now);
  /* Spaced reviews are what turn CAN_APPLY into MASTERED — the evidence
     that the idea survived time, which no single session can show. */
  updated = appendEvidence(updated, { kind: "REVIEW", passed: correct, activityType: "REVIEW", at: now });
  updated = withMasteryStage(updated);
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
