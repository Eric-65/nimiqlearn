/* ============================================================
   NimiqLearn — XP and levels
   ------------------------------------------------------------
   XP is DERIVED, never stored. Every number here is recomputed
   from the knowledge entries the app already maintains
   (knowledgeService.js), so XP can never drift out of sync with
   the mastery it is supposed to represent — there is no second
   counter to forget to increment, and clearing a topic's
   progress clears its XP with it.

   The brief was "XP is directly proportional to how well a
   user's app mastery has reached", with mastery itself coming
   from correct vs. incorrect answers. So mastery is the dominant
   term, and effort is a deliberately smaller one:

     mastery XP   = mastery (0-100) x MASTERY_XP  per topic
     correct XP   = correctAttempts x CORRECT_XP
     accuracy bonus = a share of correct XP, scaled by hit rate

   Incorrect answers are NOT subtracted. They already cost the
   learner through mastery (applyEvidence lowers it on a wrong
   answer), so subtracting again would double-penalise, and an
   XP bar that slides backwards punishes the exact behaviour this
   app exists to encourage — attempting explanations you might
   get wrong. They do hold back the accuracy bonus, which is the
   honest way to reflect them.

   Levels use a widening curve (see LEVEL_STEP): early levels
   arrive quickly so a new learner sees movement, later ones take
   real work.
   ============================================================ */

const MASTERY_XP = 2; // per mastery point, per topic -> 200 XP for a fully mastered topic
const CORRECT_XP = 12; // per correct answer, any activity type
const ACCURACY_BONUS_MAX = 0.25; // at 100% accuracy, +25% of correct XP

/** Level N starts at LEVEL_STEP * N * (N - 1) / 2 XP — i.e. each level
 * costs LEVEL_STEP more than the one before (250, 500, 750, ...). */
const LEVEL_STEP = 250;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function xpForLevelStart(level) {
  return (LEVEL_STEP * level * (level - 1)) / 2;
}

/** Inverse of xpForLevelStart, solved for the largest level whose start
 * is <= xp. Closed form so this stays O(1) regardless of XP size. */
function levelFromXp(xp) {
  const n = Math.floor((1 + Math.sqrt(1 + (8 * xp) / LEVEL_STEP)) / 2);
  return Math.max(1, n);
}

/**
 * Total XP and the level it implies, from a learner's knowledge entries.
 *
 * @param {Array} knowledgeEntries - the app's per-topic records
 * @returns {{xp:number, level:number, levelStartXp:number, nextLevelXp:number,
 *            xpIntoLevel:number, xpForNextLevel:number, progressPercent:number,
 *            masteryXp:number, correctXp:number, accuracyBonusXp:number,
 *            correctAttempts:number, incorrectAttempts:number, accuracy:number|null,
 *            topicsStudied:number, averageMastery:number}}
 */
export function computeXp(knowledgeEntries = []) {
  const entries = Array.isArray(knowledgeEntries) ? knowledgeEntries : [];

  let masteryTotal = 0;
  let correctAttempts = 0;
  let incorrectAttempts = 0;
  let topicsStudied = 0;

  for (const e of entries) {
    const mastery = clamp(Number(e?.mastery) || 0, 0, 100);
    masteryTotal += mastery;
    correctAttempts += Math.max(0, Number(e?.correctAttempts) || 0);
    incorrectAttempts += Math.max(0, Number(e?.incorrectAttempts) || 0);
    // "Studied" means actually interacted with, not merely present in the
    // curriculum — otherwise every learner starts having "studied" 18 topics.
    if (e?.lastStudiedAt || mastery > 0) topicsStudied += 1;
  }

  const totalAttempts = correctAttempts + incorrectAttempts;
  const accuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : null;

  const masteryXp = Math.round(masteryTotal * MASTERY_XP);
  const correctXp = correctAttempts * CORRECT_XP;
  const accuracyBonusXp = accuracy === null ? 0 : Math.round(correctXp * ACCURACY_BONUS_MAX * accuracy);

  const xp = masteryXp + correctXp + accuracyBonusXp;

  const level = levelFromXp(xp);
  const levelStartXp = xpForLevelStart(level);
  const nextLevelXp = xpForLevelStart(level + 1);
  const xpIntoLevel = xp - levelStartXp;
  const xpForNextLevel = nextLevelXp - levelStartXp;

  return {
    xp,
    level,
    levelStartXp,
    nextLevelXp,
    xpIntoLevel,
    xpForNextLevel,
    progressPercent: xpForNextLevel > 0 ? clamp(Math.round((xpIntoLevel / xpForNextLevel) * 100), 0, 100) : 0,
    masteryXp,
    correctXp,
    accuracyBonusXp,
    correctAttempts,
    incorrectAttempts,
    accuracy,
    topicsStudied,
    averageMastery: entries.length ? Math.round(masteryTotal / entries.length) : 0,
  };
}

/** A short, honest label for a level — flavour only, never a claim about
 * anything the app hasn't measured. */
export function levelTitle(level) {
  if (level >= 20) return "Master Explainer";
  if (level >= 15) return "Mentor";
  if (level >= 10) return "Deep Thinker";
  if (level >= 6) return "Connector";
  if (level >= 3) return "Explainer";
  return "Beginner";
}

/** XP a learner would gain right now from one more correct answer, used to
 * show "+N XP" affordances. Mastery movement is not included because it
 * depends on the activity and the topic's current state. */
export function xpPerCorrectAnswer() {
  return CORRECT_XP;
}
