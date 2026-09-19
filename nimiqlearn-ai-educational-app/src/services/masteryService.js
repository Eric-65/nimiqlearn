/* ============================================================
   NimiqLearn — Mastery model
   ------------------------------------------------------------
   What a learner can DO with a concept, derived from what they
   have actually done. The stages:

     NEW          nothing attempted
     LEARNING     attempted, but nothing demonstrated yet
     CAN_RECALL   retrieved the idea correctly at least once
     CAN_EXPLAIN  explained it in their own words, and it held up
     CAN_APPLY    used it to solve something
     MASTERED     all of the above, then held it across spaced
                  reviews, with the mastery estimate to match

   REVIEW_DUE is in the product brief's list but is NOT a stage
   here: it is orthogonal. A concept that is CAN_APPLY and due
   for review is still CAN_APPLY — forgetting it would be a
   demotion the evidence does not support. `displayStage()`
   surfaces "review due" for the UI while the real stage stays
   underneath, so nothing is lost and the Knowledge Map can show
   both facts at once.

   ------------------------------------------------------------
   WHY EVIDENCE, NOT A SCORE

   Mastery is a claim about a person. A mastery *number* can be
   pushed up by four lucky multiple-choice guesses; it cannot
   tell you whether they could explain the idea to somebody
   else. So each stage above CAN_RECALL has to be UNLOCKED by
   evidence of that specific kind, and the ledger keeps what
   unlocked it. Watching a video unlocks nothing — a video is
   input, not evidence.

   This is also what makes progress explainable. Every stage a
   learner sees can be traced to the attempt that earned it,
   which is what `evidenceFor()` returns and what the "Why this?"
   affordance on Today's Plan reads.
   ============================================================ */

import { MASTERY_BANDS } from "../config/learningThresholds.js";

export const MASTERY_STAGES = [
  "NEW",
  "LEARNING",
  "CAN_RECALL",
  "CAN_EXPLAIN",
  "CAN_APPLY",
  "MASTERED",
];

/** Rank for comparisons — a stage never moves down on new evidence. */
export const STAGE_RANK = Object.fromEntries(MASTERY_STAGES.map((s, i) => [s, i]));

/** The three things a learner can demonstrate, plus how they were shown. */
export const EVIDENCE_KINDS = ["RECALL", "EXPLAIN", "APPLY", "REVIEW"];

/* Which activity demonstrates what. A multiple-choice question shows you
   can retrieve the idea; writing an explanation shows you can articulate
   it; a practice problem shows you can use it. The teaching activities
   (SHORT_EXPLANATION / ANALOGY / EXAMPLE) each end in a check question, so
   answering one correctly is retrieval — but nothing more than that. */
export const EVIDENCE_BY_ACTIVITY = {
  MULTIPLE_CHOICE: "RECALL",
  SHORT_EXPLANATION: "RECALL",
  ANALOGY: "RECALL",
  EXAMPLE: "RECALL",
  DIAGNOSTIC: "RECALL",
  OPEN_RESPONSE: "EXPLAIN",
  EXPLAIN_BACK: "EXPLAIN",
  PRACTICE: "APPLY",
  EXAM: "APPLY",
  REVIEW: "REVIEW",
};

export function evidenceKindFor(activityType) {
  return EVIDENCE_BY_ACTIVITY[activityType] || "RECALL";
}

/* How many SUCCESSFUL spaced reviews MASTERED asks for on top of applying
   it. Two rather than one: a single successful review a day later shows
   the idea survived one night, which is not the same as it having stuck. */
export const REVIEWS_FOR_MASTERY = 2;

/* An ExplainBack score at or above this counts as having explained it.
   Same 50 midpoint knowledgeService uses to classify an evaluation as
   positive evidence, named here so the two cannot drift apart. */
export const EXPLAIN_PASS_SCORE = 50;

const MAX_EVIDENCE = 40;

/**
 * Appends one piece of evidence. Called from knowledgeService's three
 * state transitions, so no caller can forget to record it.
 *
 * @param {object} entry     knowledge entry
 * @param {object} evidence
 * @param {string} evidence.kind     RECALL | EXPLAIN | APPLY | REVIEW
 * @param {boolean} evidence.passed  did the learner demonstrate it
 * @param {string} [evidence.activityType]
 * @param {number} [evidence.score]  0-100 where there is one
 * @param {number} [evidence.at]
 * @param {boolean} [evidence.inferred] true only for migrated history
 */
export function appendEvidence(entry, { kind, passed, activityType = null, score = null, at = Date.now(), inferred = false }) {
  const ledger = Array.isArray(entry?.evidence) ? entry.evidence : [];
  const next = [
    ...ledger,
    { kind, passed: Boolean(passed), activityType, score, at, ...(inferred ? { inferred: true } : {}) },
  ].slice(-MAX_EVIDENCE);
  return { ...entry, evidence: next };
}

const passedOfKind = (evidence, kind) => evidence.filter((e) => e.kind === kind && e.passed);

/**
 * The stage the evidence supports. Pure: same entry in, same stage out,
 * no clock, no randomness — so a learner's stage can always be recomputed
 * from their ledger and checked against what they were shown.
 *
 * Stages are cumulative and ordered: explaining something you have never
 * retrieved still gets you CAN_EXPLAIN, because explaining it is the
 * harder demonstration and the ledger records it plainly.
 */
export function deriveMasteryStage(entry) {
  const evidence = Array.isArray(entry?.evidence) ? entry.evidence : [];
  if (!evidence.length) {
    /* No ledger. Either genuinely untouched, or an entry from before the
       ledger existed whose counters the migration could not interpret —
       either way, claim nothing beyond what the counters prove. */
    const attempts = (entry?.correctAttempts ?? 0) + (entry?.incorrectAttempts ?? 0);
    if (!attempts && !entry?.lastEvaluatedAt) return "NEW";
    return (entry?.correctAttempts ?? 0) > 0 ? "CAN_RECALL" : "LEARNING";
  }

  const recall = passedOfKind(evidence, "RECALL").length;
  const explain = passedOfKind(evidence, "EXPLAIN").length;
  const apply = passedOfKind(evidence, "APPLY").length;
  const reviews = passedOfKind(evidence, "REVIEW").length;
  const mastery = entry?.mastery ?? 0;

  if (apply > 0 && explain > 0 && reviews >= REVIEWS_FOR_MASTERY && mastery >= MASTERY_BANDS.MASTERED) {
    return "MASTERED";
  }
  if (apply > 0) return "CAN_APPLY";
  if (explain > 0) return "CAN_EXPLAIN";
  if (recall > 0 || reviews > 0) return "CAN_RECALL";
  return "LEARNING";
}

/** What the UI shows: the real stage, or that a review is due on top of it. */
export function displayStage(entry, { reviewDue = false } = {}) {
  const stage = entry?.masteryStage || deriveMasteryStage(entry);
  return reviewDue && stage !== "NEW" ? "REVIEW_DUE" : stage;
}

/**
 * The single demonstration standing between this concept and its next
 * stage — the thing Today's Plan turns into "your next step", and the
 * honest answer to "what is missing?".
 *
 * @returns {{kind: string|null, stage: string|null}}
 */
export function nextEvidenceNeeded(entry) {
  const stage = entry?.masteryStage || deriveMasteryStage(entry);
  switch (stage) {
    case "NEW":
    case "LEARNING":
      return { kind: "RECALL", stage: "CAN_RECALL" };
    case "CAN_RECALL":
      return { kind: "EXPLAIN", stage: "CAN_EXPLAIN" };
    case "CAN_EXPLAIN":
      return { kind: "APPLY", stage: "CAN_APPLY" };
    case "CAN_APPLY":
      return { kind: "REVIEW", stage: "MASTERED" };
    default:
      return { kind: null, stage: null };
  }
}

/** The evidence that unlocked each stage — for "show me why". */
export function evidenceFor(entry, kind) {
  const evidence = Array.isArray(entry?.evidence) ? entry.evidence : [];
  return evidence.filter((e) => e.kind === kind && e.passed);
}

/**
 * Recomputes and stamps the stage. Monotonic by design: a stage that
 * evidence once supported is never taken away by a later wrong answer.
 * Getting something wrong lowers the mastery estimate and can make a
 * review due, which is how forgetting is represented — but "you explained
 * this correctly on Tuesday" stays true on Wednesday.
 *
 * MASTERED is the one exception, because its own definition includes a
 * live mastery threshold: if the estimate falls back below it the concept
 * returns to CAN_APPLY, which is exactly what it still is.
 */
export function withMasteryStage(entry) {
  const derived = deriveMasteryStage(entry);
  const previous = entry?.masteryStage;
  if (!previous) return { ...entry, masteryStage: derived };
  if (previous === "MASTERED" && derived !== "MASTERED") return { ...entry, masteryStage: derived };
  const stage = STAGE_RANK[derived] >= STAGE_RANK[previous] ? derived : previous;
  return { ...entry, masteryStage: stage };
}

/* Translation keys, never finished English — the stage a learner reads
   has to follow the app's language like everything else. */
export const STAGE_LABEL_KEYS = {
  NEW: "stage.new",
  LEARNING: "stage.learning",
  CAN_RECALL: "stage.canRecall",
  CAN_EXPLAIN: "stage.canExplain",
  CAN_APPLY: "stage.canApply",
  MASTERED: "stage.mastered",
  REVIEW_DUE: "stage.reviewDue",
};

/* Reuses the existing status palette so the map keeps one visual language:
   the three demonstration stages share the progression from "learning" to
   "strong", and MASTERED keeps the gold it already had. */
export const STAGE_COLORS = {
  NEW: "var(--st-new)",
  LEARNING: "var(--st-learning)",
  CAN_RECALL: "var(--st-developing)",
  CAN_EXPLAIN: "var(--st-strong)",
  CAN_APPLY: "var(--st-strong)",
  MASTERED: "var(--st-mastered)",
  REVIEW_DUE: "var(--st-learning)",
};
