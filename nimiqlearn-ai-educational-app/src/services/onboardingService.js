/* ============================================================
   NimiqLearn — Onboarding & goal
   ------------------------------------------------------------
   What the learner said they came here for, and the diagnostic
   that finds out what they already know.

   Two rules shape all of it.

   FIRST: under a minute. Every question asked here is a question
   answered before the learner has seen anything work, which is
   the worst possible moment to ask one. So there are four, each
   a single tap, and each one has to earn its place by changing
   what the app does next — a "what's your name" field would not.

   SECOND: a diagnostic exists to SKIP things, not to add a
   test before the learning. A learner who can already solve
   quadratics should never be walked through quadratics, and the
   only way to know that is to ask. Answers are real evidence
   and are recorded as such, so testing out of a concept moves
   it up the mastery ladder exactly as earning it in a sprint
   would — because it is the same demonstration.
   ============================================================ */

import { findTopic, LEAF_TOPICS, ALL_TOPICS } from "../data/mockTopics.js";

/* Each goal names a starting point in the curriculum. The labels are
   translation keys; the topic ids are real leaves, checked by a test
   below so a curriculum rename cannot silently leave a goal pointing at
   nothing. */
export const GOALS = [
  { id: "exam", labelKey: "onboarding.goal.exam", emoji: "📝", groupId: "algebra" },
  { id: "school", labelKey: "onboarding.goal.school", emoji: "🎒", groupId: "algebra" },
  { id: "python", labelKey: "onboarding.goal.python", emoji: "🐍", groupId: "programming", topicId: "python-basics" },
  { id: "ai", labelKey: "onboarding.goal.ai", emoji: "🤖", groupId: "programming", topicId: "ai-fundamentals" },
  { id: "professional", labelKey: "onboarding.goal.professional", emoji: "💼", groupId: "web-data" },
  { id: "explore", labelKey: "onboarding.goal.explore", emoji: "🧭", groupId: null },
];

export const FAMILIARITY = [
  { id: "new", labelKey: "onboarding.familiar.new", level: "beginner" },
  { id: "some", labelKey: "onboarding.familiar.some", level: "beginner" },
  { id: "rusty", labelKey: "onboarding.familiar.rusty", level: "intermediate" },
  { id: "confident", labelKey: "onboarding.familiar.confident", level: "intermediate" },
];

export const SESSION_LENGTHS = [5, 10, 20];

export function goalById(id) {
  return GOALS.find((g) => g.id === id) || null;
}

/** The concepts a goal covers — what the diagnostic draws from. */
export function conceptsForGoal(goalId) {
  const goal = goalById(goalId);
  if (!goal) return LEAF_TOPICS.slice(0, 5);
  if (goal.groupId) {
    const group = ALL_TOPICS.find((t) => t.id === goal.groupId);
    const children = group ? LEAF_TOPICS.filter((t) => t.parentId === goal.groupId) : [];
    if (children.length) return children;
  }
  if (goal.topicId) {
    const t = findTopic(goal.topicId);
    if (t) return [t];
  }
  /* "Explore something new" has no group on purpose — it gets a spread
     across subjects rather than a drill down one, since the learner has
     told us they do not know what they want yet. */
  const bySubject = new Map();
  for (const leaf of LEAF_TOPICS) {
    const root = String(leaf.path || "").split("/")[0] || leaf.parentId;
    if (!bySubject.has(root)) bySubject.set(root, leaf);
  }
  return [...bySubject.values()].slice(0, 5);
}

/* How many questions the diagnostic asks. The brief says 3-7 "depending on
   topic"; the honest driver is how many concepts there are to separate —
   asking five questions about one concept tells you less than asking one
   about each of five. Capped at 5 so it stays inside the minute. */
export function diagnosticLength(goalId) {
  return Math.max(3, Math.min(5, conceptsForGoal(goalId).length));
}

/**
 * The stored goal. Small on purpose: everything else the coach needs it
 * can derive, and a profile is easier to migrate the less it holds.
 */
export function makeGoal({ goalId, topicId = null, familiarity = "new", sessionMinutes = 10, deadline = null }) {
  const goal = goalById(goalId);
  return {
    goalId,
    topicId: topicId || goal?.topicId || conceptsForGoal(goalId)[0]?.id || null,
    groupId: goal?.groupId || null,
    familiarity,
    level: FAMILIARITY.find((f) => f.id === familiarity)?.level || "beginner",
    sessionMinutes,
    deadline,
    setAt: Date.now(),
    diagnosticDoneAt: null,
  };
}

/**
 * What a completed diagnostic means for one concept.
 *
 * Confidence matters as much as correctness, and not symmetrically:
 *
 *  - right and sure      → they know it. RECALL evidence, and the concept
 *                          starts at CAN_RECALL instead of NEW.
 *  - right but unsure    → a lucky guess is indistinguishable from
 *                          knowledge here, so it counts for mastery but
 *                          NOT as a demonstration. The concept stays where
 *                          it was and the learner meets it again.
 *  - wrong but sure      → the most useful answer in the whole diagnostic:
 *                          a confidently wrong answer is a misconception,
 *                          not a gap, and it gets flagged as one.
 *  - wrong and unsure    → an ordinary gap. Nothing to flag.
 */
export function classifyDiagnosticAnswer({ correct, confident }) {
  if (correct && confident) return { evidence: "RECALL", passed: true, testedOut: true, misconception: false };
  if (correct && !confident) return { evidence: null, passed: true, testedOut: false, misconception: false };
  if (!correct && confident) return { evidence: "RECALL", passed: false, testedOut: false, misconception: true };
  return { evidence: "RECALL", passed: false, testedOut: false, misconception: false };
}

/**
 * Should the first-run sheet open?
 *
 * Not for anyone already under way. A returning learner with real work
 * behind them has demonstrably started without needing a goal, and
 * interrupting them with a setup wizard costs more than the goal is worth
 * — they can set one from Settings whenever it suits them. So this is for
 * genuinely new profiles only: no goal, not previously declined, and
 * nothing done yet.
 */
export function needsOnboarding(learner) {
  if (learner?.goal || learner?.onboardingSkippedAt) return false;
  return !(Array.isArray(learner?.history) && learner.history.length > 0);
}
