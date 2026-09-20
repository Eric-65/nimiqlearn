/* ============================================================
   NimiqLearn — Coach: what should this learner do next?
   ------------------------------------------------------------
   One question, one answer, across ALL concepts: which concept,
   which activity, how long, and why.

   Everything already in the app answers a narrower question.
   learnLoopService decides the next activity WITHIN a chosen
   concept; forgetMeNotService decides WHEN a concept is due;
   masteryService says what a learner has demonstrated. None of
   them chooses between concepts, which is exactly the decision
   a learner should not have to make — and the whole point of
   the app recommending a next step rather than offering six
   features and a menu.

   So this module picks the concept, then delegates the activity
   to learningLoopService (which runs the existing rule engine).
   Nothing here re-implements a decision that already has a home.

   ------------------------------------------------------------
   THE PRIORITY ORDER, AND WHY IT IS THIS ORDER

   1. A review that is due.        Forgetting is the only
      failure mode with a deadline: a concept slipping away is
      lost work, and reviewing it is the cheapest minute in the
      app.
   2. A misconception to repair.   A wrong idea actively
      contradicts what comes next, so it compounds. Ahead of new
      material for the same reason you fix a foundation before
      adding a floor.
   3. The concept closest to its next stage. Momentum: a concept
      one demonstration away from CAN_EXPLAIN finishes today,
      and a finished thing is worth more than three half-started
      ones.
   4. Something new.               Only once nothing above is
      outstanding.

   Every branch returns the evidence that triggered it, so the
   "Why this?" the learner taps is the real reason and not a
   plausible sentence written afterwards.
   ============================================================ */

import { findTopic, LEAF_TOPICS } from "../data/mockTopics.js";
import { getNextLearningActivity } from "./learningLoopService.js";
import { computeReviewRecommendation, isReviewable } from "./forgetMeNotService.js";
import { nextEvidenceNeeded, evidenceFor, deriveMasteryStage, STAGE_RANK } from "./masteryService.js";
import { MASTERY_BANDS } from "../config/learningThresholds.js";

/** What kind of session the recommendation opens. */
export const PLAN_KINDS = ["REVIEW", "REPAIR", "ADVANCE", "START"];

const entryFor = (knowledge, topicId) => knowledge.find((k) => k.topicId === topicId) || null;

/* Which due rows are genuinely reviewable. The rule itself lives in
   forgetMeNotService, which owns scheduling — the coach only applies it,
   so the queue page and Today's Plan can never disagree about what is
   due. */
export function reviewableNow(knowledge, dueNow, now = Date.now()) {
  return dueNow.filter((row) => isReviewable(entryFor(knowledge, row.topicId), now));
}

/* A concept the learner has touched but not finished — the pool rule 3
   ranks. Sorted by how close it is to its next stage, which is stage rank
   first (a concept at CAN_APPLY needs one review; one at LEARNING needs
   three demonstrations) and mastery second inside a stage. */
function closestToNextStage(knowledge) {
  const candidates = knowledge
    .filter((k) => {
      const stage = k.masteryStage || deriveMasteryStage(k);
      return stage !== "NEW" && stage !== "MASTERED";
    })
    .sort((a, b) => {
      const rank = STAGE_RANK[b.masteryStage || deriveMasteryStage(b)] - STAGE_RANK[a.masteryStage || deriveMasteryStage(a)];
      if (rank !== 0) return rank;
      return (b.mastery ?? 0) - (a.mastery ?? 0);
    });
  return candidates[0] || null;
}

/* A concept that recently went wrong AND has a recorded misconception.
   Both conditions on purpose: an old misconception the learner has since
   answered correctly several times is not what today should be about. */
function needingRepair(knowledge) {
  return (
    knowledge.find((k) => {
      const recent = k.recentPerformance ?? [];
      const lastWrong = recent.at(-1) === 0;
      return lastWrong && (k.misconceptions?.length ?? 0) > 0;
    }) || null
  );
}

/* The first concept the learner has never touched. Ordered by the
   curriculum rather than by anything clever — LEAF_TOPICS is already in
   teaching order, and a learner starting out should start at the start. */
function firstUntouched(knowledge, goalTopicId = null) {
  if (goalTopicId) {
    const goalEntry = entryFor(knowledge, goalTopicId);
    if (!goalEntry || (goalEntry.masteryStage || "NEW") === "NEW") {
      const topic = findTopic(goalTopicId);
      if (topic) return { topicId: goalTopicId, topicName: topic.name };
    }
  }
  const touched = new Set(knowledge.filter((k) => (k.mastery ?? 0) > 0 || (k.evidence?.length ?? 0) > 0).map((k) => k.topicId));
  const next = LEAF_TOPICS.find((t) => !touched.has(t.id));
  return next ? { topicId: next.id, topicName: next.name } : null;
}

/**
 * The one recommendation Today's Plan renders.
 *
 * @param {object} params
 * @param {Array}  params.knowledge   all knowledge entries
 * @param {Array}  [params.dueNow]    review queue rows already due
 * @param {object} [params.learner]   for history + study minutes
 * @param {string} [params.goalTopicId] the learner's stated goal, if any
 * @returns {object|null} null only when there is no curriculum at all
 */
export function recommendNextAction({ knowledge = [], dueNow = [], learner = null, goalTopicId = null } = {}) {
  const history = learner?.history ?? [];
  const studyMinutes = Math.max(3, Math.round((learner?.studyMinutes ?? 30) / 60));

  const build = (kind, entryOrStub, reasonKey, reasonVars = null) => {
    const topicId = entryOrStub.topicId;
    const topic = findTopic(topicId);
    if (!topic) return null;
    const entry = entryFor(knowledge, topicId);
    const rec = computeReviewRecommendation(entry);
    const next = getNextLearningActivity({
      topic,
      knowledge: entry || undefined,
      history: history.filter((h) => h.topicId === topicId).slice(0, 12),
      availableStudyTime: studyMinutes,
    });
    const stage = entry?.masteryStage || deriveMasteryStage(entry || {});
    const needed = nextEvidenceNeeded(entry || {});

    return {
      kind,
      topicId,
      topicName: topic.name,
      stage,
      /* What this session is FOR — the demonstration that would move the
         concept up a stage. The sprint's ending screen checks it off. */
      targetStage: needed.stage,
      neededEvidence: needed.kind,
      activityType: next.ruleActivityType,
      publicActivityType: next.activityType,
      difficulty: next.difficulty,
      targetMisconception: next.targetMisconception || entry?.misconceptions?.[0] || null,
      estimatedMinutes: Math.max(5, Math.min(10, (next.estimatedDuration ?? 3) + 4)),
      reviewDue: rec.dueNow,
      mastery: entry?.mastery ?? 0,
      reasonKey,
      reasonVars,
      /* Where [Continue] goes. One route for every kind — the sprint —
         so the learner always lands in the same shaped experience. */
      route: "sprint",
      routeParams: { topic: topicId },
    };
  };

  /* 1. Due review, most urgent first.
     Only concepts the learner has ACTUALLY STUDIED can be reviewed. The
     review queue scores every entry it is given, including ones at mastery
     0 that have never been opened — and "you last worked on this 1 days
     ago, it is due for review" in front of a concept somebody has never
     seen is both false and the fastest way to lose their trust in the
     recommendation. A never-started concept falls through to rule 4, where
     it is correctly offered as somewhere to start. */
  const studied = reviewableNow(knowledge, dueNow);
  if (studied.length) {
    const top = [...studied].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))[0];
    const entry = entryFor(knowledge, top.topicId);
    const since = entry?.lastStudiedAt || entry?.lastReviewedAt || entry?.lastEvaluatedAt || null;
    const plan = build("REVIEW", top, "coach.reason.reviewDue", {
      days: since ? Math.max(1, Math.round((Date.now() - since) / 86400000)) : 1,
    });
    if (plan) return plan;
  }

  /* 2. A misconception that just cost them an answer. */
  const repair = needingRepair(knowledge);
  if (repair) {
    const plan = build("REPAIR", repair, "coach.reason.misconception", {
      misconception: repair.misconceptions[0],
    });
    if (plan) return plan;
  }

  /* 3. Closest to its next stage. The reason names the evidence that got
        them here and the evidence still missing — both read off the
        ledger, never inferred from the mastery number. */
  const advancing = closestToNextStage(knowledge);
  if (advancing) {
    const needed = nextEvidenceNeeded(advancing);
    const proof = evidenceFor(advancing, needed.kind === "EXPLAIN" ? "RECALL" : needed.kind === "APPLY" ? "EXPLAIN" : "APPLY");
    const plan = build("ADVANCE", advancing, proof.length ? "coach.reason.advanceWithProof" : "coach.reason.advance", {
      stage: advancing.masteryStage || deriveMasteryStage(advancing),
      needed: needed.kind,
    });
    if (plan) return plan;
  }

  /* 4. Something new. */
  const fresh = firstUntouched(knowledge, goalTopicId);
  if (fresh) {
    const plan = build("START", fresh, goalTopicId === fresh.topicId ? "coach.reason.goal" : "coach.reason.start");
    if (plan) return plan;
  }

  /* Everything touched and nothing due: send them to the strongest
     concept for a challenge rather than returning nothing. */
  const strongest = [...knowledge].sort((a, b) => (b.mastery ?? 0) - (a.mastery ?? 0))[0];
  return strongest ? build("ADVANCE", strongest, "coach.reason.allCaught") : null;
}

/**
 * Headline counts for the strip under Today's Plan. Deliberately small:
 * three numbers a learner can read in a glance, not a dashboard.
 */
export function coachSummary({ knowledge = [], dueNow = [], learner = null } = {}) {
  const stageOf = (k) => k.masteryStage || deriveMasteryStage(k);
  /* The same filter the recommendation uses. A "3 reviews due" badge that
     the coach would never actually offer is a number the learner cannot
     act on. */
  const reviewable = reviewableNow(knowledge, dueNow);
  const demonstrated = knowledge.filter((k) => STAGE_RANK[stageOf(k)] >= STAGE_RANK.CAN_RECALL);
  return {
    reviewsDue: reviewable.length,
    mastered: knowledge.filter((k) => stageOf(k) === "MASTERED").length,
    inProgress: demonstrated.filter((k) => stageOf(k) !== "MASTERED").length,
    streakDays: learner?.streakDays ?? 0,
    /* Concepts where the learner has demonstrated SOMETHING this week —
       the honest version of a "weekly goal", counted from evidence. */
    activeThisWeek: knowledge.filter((k) =>
      (k.evidence ?? []).some((e) => e.passed && !e.inferred && Date.now() - e.at < 7 * 86400000)
    ).length,
  };
}

/** Is this concept strong enough that practice should get harder? */
export function difficultyFor(entry) {
  const stage = entry?.masteryStage || deriveMasteryStage(entry || {});
  const mastery = entry?.mastery ?? 0;
  const recent = entry?.recentPerformance ?? [];
  const recentWrong = recent.slice(-3).filter((r) => r === 0).length;

  /* Multiple pieces of evidence, never one: a single correct answer after
     two wrong ones is not a reason to raise the difficulty. */
  if (recentWrong >= 2 || mastery < MASTERY_BANDS.MID) return "FOUNDATION";
  if (STAGE_RANK[stage] >= STAGE_RANK.CAN_APPLY && mastery >= MASTERY_BANDS.HIGH && recentWrong === 0) return "CHALLENGE";
  return "STANDARD";
}
