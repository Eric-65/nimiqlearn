/* ============================================================
   NimiqLearn — Initial learner profile & knowledge state
   The knowledge model is application-owned (not AI-owned):
   AI produces assessments, the app maintains the state.
   ============================================================ */

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

/**
 * The canonical per-concept learner-state record (see docs/learning-engine.md
 * for the full pipeline this feeds). `topicId` IS the concept identifier
 * throughout this app — there is no separate "conceptId" field, to avoid
 * two names for the same value; anywhere an external contract calls for
 * `conceptId` (e.g. assessmentService's result object), it is populated
 * from this same `topicId`.
 *
 * - `mastery` (0-100): how well the learner appears to understand the
 *   concept. Blended from AI/heuristic assessment + history — see
 *   knowledgeService.js.
 * - `confidence` (0-100): SEPARATE from mastery — how much evidence backs
 *   that mastery estimate. One great answer should not read the same as
 *   many consistent ones. Always derived, never hand-set — see
 *   knowledgeService.js#calculateConfidence.
 * - `correctAttempts` / `incorrectAttempts`: lifetime counters across
 *   every activity type (ExplainBack, practice questions, reviews).
 *   Distinct from `recentPerformance`, which is a short rolling window
 *   used for recency-weighted signals (review priority, "just slipped up")
 *   — the counters never shrink, `recentPerformance` does.
 * - `lastStudiedAt`: last interaction of ANY kind (evaluation, practice,
 *   or review). `lastEvaluatedAt`/`lastReviewedAt` stay as more specific
 *   timestamps for their own activity types; `lastStudiedAt` is the max
 *   of whichever happened most recently.
 * - `nextReviewAt`: persisted output of forgetMeNotService's
 *   calculateNextReview() — recomputed on every state change, never
 *   hand-edited, but stored so the UI/queue don't need to recompute it
 *   from scratch just to sort/display it.
 * - `coveredQuestions` / `coveredAngles`: the generated-activity questions
 *   and sub-aspect "angles" this learner has already been asked on this
 *   topic (see learnLoopService/server buildActivitySystemPrompt), so the
 *   next one can be told what to avoid. Persisted rather than session-only
 *   — without this, closing and reopening the app reset the AI's memory of
 *   what it already asked, and a returning learner could get the exact
 *   same activity as their last session. Capped well past what any single
 *   prompt sends (see cleanList server-side) so a long-running topic still
 *   has a real pool of prior ground to avoid, not just the last couple.
 */
export function makeKnowledgeEntry(topicId, topicName, overrides = {}) {
  return {
    topicId,
    topicName,
    mastery: 0,
    confidence: 0,
    status: "NEW",
    lastEvaluatedAt: null,
    lastReviewedAt: null,
    lastStudiedAt: null,
    nextReviewAt: null,
    strengths: [],
    missingConcepts: [],
    misconceptions: [],
    reviewPriority: 0,
    reviewCount: 0,
    correctAttempts: 0,
    incorrectAttempts: 0,
    recentPerformance: [],
    coveredQuestions: [],
    coveredAngles: [],
    ...overrides,
  };
}

// Bump when the persisted shape changes in a way that needs migration —
// see migrateLearnerState() in LearnerContext.jsx, which upgrades any
// stored blob from an older (or missing) version before use.
// v2: added coveredQuestions/coveredAngles to each knowledge entry.
export const LEARNER_STATE_SCHEMA_VERSION = 2;

export const INITIAL_LEARNER = {
  version: LEARNER_STATE_SCHEMA_VERSION,
  id: "learner-1",
  name: "Alex",
  avatarEmoji: "🎓",
  level: 4,
  xp: 320,
  xpToNext: 500,
  streakDays: 6,
  coins: 12,
  studyMinutes: 245,
  createdAt: now - 21 * DAY,
  unlockedPacks: [], // entitlements from confirmed payments — see entitlementService.js
  pendingPayments: [], // unresolved (UNKNOWN) payment attempts — see item 22 / entitlementService.js
  knowledge: [
    makeKnowledgeEntry("linear-equations", "Linear equations", {
      mastery: 88, status: "MASTERED",
      lastEvaluatedAt: now - 3 * DAY, lastReviewedAt: now - 6 * DAY, lastStudiedAt: now - 3 * DAY,
      strengths: ["Isolating the variable", "Checking solutions by substitution"],
      missingConcepts: [],
      misconceptions: [],
      reviewCount: 5, recentPerformance: [1, 1, 1, 1, 1], correctAttempts: 5, incorrectAttempts: 0,
    }),
    makeKnowledgeEntry("quadratics", "Quadratics", {
      mastery: 62, status: "DEVELOPING",
      lastEvaluatedAt: now - 2 * DAY, lastReviewedAt: now - 2 * DAY, lastStudiedAt: now - 2 * DAY,
      strengths: ["Factoring simple quadratics", "Reading a parabola graph"],
      missingConcepts: ["Completing the square", "Using the discriminant"],
      misconceptions: ["Drops the ± when taking square roots"],
      reviewCount: 3, recentPerformance: [1, 0, 1], correctAttempts: 2, incorrectAttempts: 1,
    }),
    makeKnowledgeEntry("functions", "Functions", {
      mastery: 34, status: "LEARNING",
      lastEvaluatedAt: now - 1 * DAY, lastReviewedAt: null, lastStudiedAt: now - 1 * DAY,
      strengths: ["Function notation f(x)"],
      missingConcepts: ["Domain and range", "Vertical line test"],
      misconceptions: ["Confuses function with its output"],
      reviewCount: 1, recentPerformance: [0], correctAttempts: 0, incorrectAttempts: 1,
    }),
    makeKnowledgeEntry("angles", "Angles", {
      mastery: 78, status: "STRONG",
      lastEvaluatedAt: now - 4 * DAY, lastReviewedAt: now - 9 * DAY, lastStudiedAt: now - 4 * DAY,
      strengths: ["Complementary vs supplementary", "Parallel-line angle rules"],
      missingConcepts: [],
      misconceptions: [],
      reviewCount: 4, recentPerformance: [1, 1, 0, 1], correctAttempts: 3, incorrectAttempts: 1,
    }),
    makeKnowledgeEntry("proofs", "Proofs", {
      mastery: 55, status: "DEVELOPING",
      lastEvaluatedAt: now - 5 * DAY, lastReviewedAt: now - 1 * DAY, lastStudiedAt: now - 1 * DAY,
      strengths: ["Stating given information", "Using basic postulates"],
      missingConcepts: ["Congruence rules (SSS, SAS)", "Chain reasoning"],
      misconceptions: ["Asserts equality by appearance instead of a rule"],
      reviewCount: 2, recentPerformance: [0, 1], correctAttempts: 1, incorrectAttempts: 1,
    }),
    makeKnowledgeEntry("newtons-second-law", "Newton's second law", {
      mastery: 0, status: "NEW",
      lastEvaluatedAt: null, lastReviewedAt: null,
      strengths: [], missingConcepts: ["F = ma relationship"], misconceptions: [],
      reviewCount: 0, recentPerformance: [],
    }),
    makeKnowledgeEntry("energy-work", "Energy & work", {
      mastery: 0, status: "NEW",
    }),
    makeKnowledgeEntry("python-basics", "Python basics", {
      mastery: 0, status: "NEW",
    }),
    makeKnowledgeEntry("ai-fundamentals", "AI fundamentals", {
      mastery: 0, status: "NEW",
    }),
  ],
  history: [], // recent activity events { type, topicId, at, detail }
};
