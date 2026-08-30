/* ============================================================
   NimiqLearn — Initial learner profile & knowledge state
   The knowledge model is application-owned (not AI-owned):
   AI produces assessments, the app maintains the state.
   ============================================================ */

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

export function makeKnowledgeEntry(topicId, topicName, overrides = {}) {
  return {
    topicId,
    topicName,
    mastery: 0,
    status: "NEW",
    lastEvaluatedAt: null,
    lastReviewedAt: null,
    strengths: [],
    missingConcepts: [],
    misconceptions: [],
    reviewPriority: 0,
    reviewCount: 0,
    recentPerformance: [],
    ...overrides,
  };
}

export const INITIAL_LEARNER = {
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
  unlockedPacks: [], // pack ids unlocked via payments
  knowledge: [
    makeKnowledgeEntry("linear-equations", "Linear equations", {
      mastery: 88, status: "MASTERED",
      lastEvaluatedAt: now - 3 * DAY, lastReviewedAt: now - 6 * DAY,
      strengths: ["Isolating the variable", "Checking solutions by substitution"],
      missingConcepts: [],
      misconceptions: [],
      reviewCount: 5, recentPerformance: [1, 1, 1, 1, 1],
    }),
    makeKnowledgeEntry("quadratics", "Quadratics", {
      mastery: 62, status: "DEVELOPING",
      lastEvaluatedAt: now - 2 * DAY, lastReviewedAt: now - 2 * DAY,
      strengths: ["Factoring simple quadratics", "Reading a parabola graph"],
      missingConcepts: ["Completing the square", "Using the discriminant"],
      misconceptions: ["Drops the ± when taking square roots"],
      reviewCount: 3, recentPerformance: [1, 0, 1],
    }),
    makeKnowledgeEntry("functions", "Functions", {
      mastery: 34, status: "LEARNING",
      lastEvaluatedAt: now - 1 * DAY, lastReviewedAt: null,
      strengths: ["Function notation f(x)"],
      missingConcepts: ["Domain and range", "Vertical line test"],
      misconceptions: ["Confuses function with its output"],
      reviewCount: 1, recentPerformance: [0],
    }),
    makeKnowledgeEntry("angles", "Angles", {
      mastery: 78, status: "STRONG",
      lastEvaluatedAt: now - 4 * DAY, lastReviewedAt: now - 9 * DAY,
      strengths: ["Complementary vs supplementary", "Parallel-line angle rules"],
      missingConcepts: [],
      misconceptions: [],
      reviewCount: 4, recentPerformance: [1, 1, 0, 1],
    }),
    makeKnowledgeEntry("proofs", "Proofs", {
      mastery: 55, status: "DEVELOPING",
      lastEvaluatedAt: now - 5 * DAY, lastReviewedAt: now - 1 * DAY,
      strengths: ["Stating given information", "Using basic postulates"],
      missingConcepts: ["Congruence rules (SSS, SAS)", "Chain reasoning"],
      misconceptions: ["Asserts equality by appearance instead of a rule"],
      reviewCount: 2, recentPerformance: [0, 1],
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
