/* ============================================================
   NimiqLearn — Learning Loop orchestrator (Layer 3, public API)
   ------------------------------------------------------------
   getNextLearningActivity() is the ONE function the rest of the
   app should call to ask "what should the learner do next."

   It does not re-implement the decision rules — those already
   live in learnLoopService.js (decideNextActivity), proven and
   used by Learn.jsx / ExplainBack.jsx. This module:

     1. asks learnerStateService for the learner-state prediction
        (mastery, review priority, recommended difficulty) when
        the caller doesn't already have one,
     2. runs the existing rule engine to pick a concrete activity,
     3. maps the result onto the smaller public taxonomy:
        EXPLAIN | EXAMPLE | PRACTICE | EXPLAIN_BACK | REVIEW | CHALLENGE

   ForgetMeNot still owns *when* to review (via learnerStateService,
   which itself defers to forgetMeNotService) — this module only
   ever reads that decision, never overrides it.
   ============================================================ */

import { decideNextActivity } from "./learnLoopService.js";
import { predictFromKnowledgeEntry } from "./learnerStateService.js";

export const NEXT_ACTIVITY_TYPES = ["EXPLAIN", "EXAMPLE", "PRACTICE", "EXPLAIN_BACK", "REVIEW", "CHALLENGE"];

const ESTIMATED_DURATION_MIN = {
  SHORT_EXPLANATION: 2,
  ANALOGY: 2,
  EXAMPLE: 3,
  MULTIPLE_CHOICE: 1,
  OPEN_RESPONSE: 4,
  EXPLAIN_BACK: 5,
  PRACTICE: 3,
  REVIEW: 2,
};

const RULE_TYPE_TO_PUBLIC_TYPE = {
  SHORT_EXPLANATION: "EXPLAIN",
  ANALOGY: "EXPLAIN",
  EXAMPLE: "EXAMPLE",
  MULTIPLE_CHOICE: "PRACTICE",
  OPEN_RESPONSE: "PRACTICE",
  PRACTICE: "PRACTICE",
  EXPLAIN_BACK: "EXPLAIN_BACK",
  REVIEW: "REVIEW",
};

/**
 * @param {object} params
 * @param {object} [params.learnerState] - a learnerStateService prediction. Computed
 *        from `knowledge` when omitted.
 * @param {object} params.topic - the topic object (see mockTopics.js).
 * @param {object} [params.knowledge] - the topic's knowledge entry (see mockLearner.js).
 * @param {Array}  [params.recentPerformance] - used only when `knowledge` is omitted.
 * @param {Array}  [params.history] - recent activity history for this topic.
 * @param {number} [params.availableStudyTime] - minutes the learner has right now.
 * @returns {{activityType:string, difficulty:string, reasonKey:string, topic:string, estimatedDuration:number}}
 */
export function getNextLearningActivity({
  learnerState,
  topic,
  knowledge,
  recentPerformance = [],
  history = [],
  availableStudyTime = 10,
} = {}) {
  if (!topic) throw new Error("getNextLearningActivity requires a topic.");

  const entry = knowledge || { topicId: topic.id, mastery: 0, status: "NEW", recentPerformance };
  const state = learnerState || predictFromKnowledgeEntry(entry);

  const decision = decideNextActivity({
    topic,
    knowledge: entry,
    history,
    reviewDue: state.reviewRecommendation?.dueNow ?? false,
    reviewPriority: state.reviewPriority,
    studyMinutes: availableStudyTime,
  });

  // The rule engine reports which tier actually fired (`decision.tier`) —
  // trust that over re-deriving "mastered" independently from mastery,
  // since the two can disagree on inconsistent/partial input.
  const activityType =
    decision.tier === "MASTERED" ? "CHALLENGE" : RULE_TYPE_TO_PUBLIC_TYPE[decision.activityType] || decision.activityType;

  return {
    activityType,
    difficulty: state.recommendedDifficulty,
    reasonKey: decision.reasonKey,
    reasonVars: decision.reasonVars || null,
    topic: topic.id,
    estimatedDuration: ESTIMATED_DURATION_MIN[decision.activityType] ?? 3,
    ruleActivityType: decision.activityType, // the concrete type generateActivityContent() expects
    targetMisconception: decision.targetMisconception,
    nextTopic: decision.nextTopic,
  };
}
