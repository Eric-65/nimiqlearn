/* ============================================================
   NimiqLearn — Learning thresholds (single source of truth)
   ------------------------------------------------------------
   Every service that branches on "how strong is the learner" or
   "how urgent is a review" reads these constants instead of
   hard-coding its own copy. Change the numbers here and every
   consumer (LearnLoop, ForgetMeNot, LearnerState, LearningLoop)
   moves together.
   ============================================================ */

// Mastery bands (0-100), inclusive lower bound.
export const MASTERY_BANDS = {
  NEW: 0,
  LOW: 0,
  MID: 40,
  HIGH: 65,
  MASTERED: 85,
};

// Same bands, exposed as an ordered list for threshold scans.
export const MASTERY_BAND_ORDER = [
  { max: MASTERY_BANDS.MID, label: "LOW" }, // < 40
  { max: MASTERY_BANDS.HIGH, label: "MID" }, // 40-64
  { max: MASTERY_BANDS.MASTERED, label: "HIGH" }, // 65-84
  { max: Infinity, label: "MASTERED" }, // 85+
];

export function masteryBand(mastery) {
  const m = Number(mastery) || 0;
  return MASTERY_BAND_ORDER.find((b) => m < b.max)?.label ?? "MASTERED";
}

// Recommended difficulty derived purely from mastery — used by
// learnerStateService and learningLoopService.
export const DIFFICULTY_BY_BAND = {
  LOW: "simple-explanation",
  MID: "guided-example",
  HIGH: "application-problem",
  MASTERED: "harder-challenge",
};

export function recommendedDifficulty(mastery) {
  return DIFFICULTY_BY_BAND[masteryBand(mastery)];
}

// Review-priority bands (0-100) — shared by ForgetMeNot and LearnerState.
export const REVIEW_PRIORITY = {
  URGENT: 80,
  DUE_SOON: 65,
  KEEP_AN_EYE: 40,
};

export function reviewLevelLabel(priorityScore) {
  const p = Number(priorityScore) || 0;
  if (p >= REVIEW_PRIORITY.URGENT) return "Urgent";
  if (p >= REVIEW_PRIORITY.DUE_SOON) return "Due soon";
  if (p >= REVIEW_PRIORITY.KEEP_AN_EYE) return "Keep an eye";
  return "Fresh";
}

// Minimum study time (minutes) required before a REVIEW activity is
// inserted ahead of the normal loop.
export const REVIEW_INSERTION_MIN_STUDY_MINUTES = 3;
