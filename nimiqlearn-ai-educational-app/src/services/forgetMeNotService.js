/* ============================================================
   NimiqLearn — ForgetMeNot AI (review scheduling)
   ------------------------------------------------------------
   The app owns scheduling with transparent, deterministic
   logic. The AI may generate review *content*, but the timing
   is never decided by a language model. This is NimiqLearn
   adaptive review scheduling — a transparent heuristic, not a
   claim of scientifically validated spaced repetition.
   ============================================================ */

import { REVIEW_PRIORITY, reviewLevelKey } from "../config/learningThresholds.js";

const DAY = 24 * 60 * 60 * 1000;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Base review interval as a CONTINUOUS function of mastery (0-100), not a
 * lookup keyed by the 5-band status label. The status bands (NEW/LEARNING/
 * DEVELOPING/STRONG/MASTERED at 0/40/65/85) still mark the same milestones
 * — this just interpolates between them — but knowledgeService's mastery is
 * now a smooth probability estimate (see applyEvidence there), and snapping
 * it to one of 5 fixed intervals threw most of that precision away: a 41%
 * and a 64% mastery both got the same 7-day gap as a 64% right at the
 * DEVELOPING/STRONG boundary. Piecewise-linear through the same anchor
 * points keeps the milestones meaningful while letting the interval move
 * with every point of mastery in between.
 */
const INTERVAL_ANCHORS = [
  [0, 1],
  [40, 3],
  [65, 7],
  [85, 14],
  [100, 21],
];

function masteryToBaseInterval(mastery) {
  const m = clamp(mastery ?? 0, 0, 100);
  for (let i = 0; i < INTERVAL_ANCHORS.length - 1; i++) {
    const [m0, d0] = INTERVAL_ANCHORS[i];
    const [m1, d1] = INTERVAL_ANCHORS[i + 1];
    if (m <= m1) {
      const t = m1 === m0 ? 0 : (m - m0) / (m1 - m0);
      return d0 + t * (d1 - d0);
    }
  }
  return INTERVAL_ANCHORS[INTERVAL_ANCHORS.length - 1][1];
}

/**
 * How much a base interval is trusted, from the entry's `confidence` (see
 * knowledgeService#calculateConfidence — evidence volume + consistency,
 * deliberately separate from mastery). A mastery figure backed by one
 * lucky guess shouldn't earn the same long gap as the same figure backed
 * by eight consistent answers, so low confidence compresses the interval
 * toward the low end (0.6x) and full confidence keeps it uncompressed
 * (1.0x) — replacing the old flat `reviewCount` multiplier, which grew
 * interval length from repetition alone without asking whether that
 * repetition actually agreed with itself.
 */
function confidenceFactor(confidence) {
  return 0.6 + 0.4 * (clamp(confidence ?? 0, 0, 100) / 100);
}

/**
 * Review priority, normalized to 0-1 (higher = review sooner). Documented
 * weights, all computed on a common 0-100 internal scale before the final
 * divide so they're easy to reason about independently:
 *
 *   40% mastery gap       — the less mastered a concept, the sooner it
 *                           should come back up.
 *   30% overdue time      — days past this status's base interval,
 *                           scaled by that same interval.
 *   20% recent failures   — fraction of the recent-performance window
 *                           that was wrong.
 *  -10% review stability  — higher `confidence` (evidence volume +
 *                           consistency, see knowledgeService) slightly
 *                           lowers priority: the concept has held up
 *                           across several checks, not just one review.
 *
 * NOTE: earlier versions of this function clamped the weighted sum with
 * a 0-1 clamp before scaling to a 0-100 "priorityScore" — since the
 * weighted sum is normally well outside [0,1] on that internal scale,
 * this silently collapsed priorityScore to almost always exactly 0 or 1
 * (never a meaningful score in between), which in turn made every
 * priority-based UI badge/threshold downstream effectively decorative.
 * Fixed here: the 0-100 internal sum is clamped to [0,100], THEN divided
 * by 100 to produce the real 0-1 value this function returns.
 */
export function calculateReviewPriority(entry, now = Date.now()) {
  const mastery = entry?.mastery ?? 0;
  /* lastStudiedAt is in the chain because it is the most accurate answer
     to "when did they last touch this": a concept practised five hours ago
     has no lastReviewedAt (it was not a review) and no lastEvaluatedAt (it
     was not an ExplainBack), and without it fell through to the 30-day
     fallback — scored, and displayed, as a month stale. The fallback stays
     for an entry genuinely never touched, where treating it as long
     overdue is the right default. */
  const lastReviewedAt = entry?.lastReviewedAt || entry?.lastEvaluatedAt || entry?.lastStudiedAt || now - 30 * DAY;
  const confidence = entry?.confidence ?? 0;
  const recent = entry?.recentPerformance ?? [];

  const daysSinceReview = Math.max(0, (now - lastReviewedAt) / DAY);
  const baseInterval = masteryToBaseInterval(mastery);

  const masteryScore = 100 - mastery;
  const overdue = Math.max(0, daysSinceReview - baseInterval);
  const recencyScore = Math.min(100, (overdue / Math.max(baseInterval, 1)) * 100);
  const failures = recent.filter((r) => r === 0).length;
  const failureScore = recent.length ? (failures / recent.length) * 100 : 0;
  const stabilityScore = clamp(confidence, 0, 100);

  const weightedScore = 0.4 * masteryScore + 0.3 * recencyScore + 0.2 * failureScore - 0.1 * stabilityScore;
  return clamp(weightedScore, 0, 100) / 100;
}

/**
 * Deterministic next-review calculation. Same learner state always
 * produces the same result — no randomness, no LLM involvement.
 * Conceptual progression (not a claim of validated spaced repetition):
 * weak understanding -> short interval; improving/strong -> longer
 * interval, further extended by a track record of completed reviews.
 */
export function calculateNextReview(entry, now = Date.now()) {
  /* Same staleness chain as calculateReviewPriority — including
     lastStudiedAt, without which a concept practised minutes ago anchored
     its schedule to the 30-day fallback and came out with a next review
     29 days in the PAST. The three functions have to agree about when the
     learner last touched something, or the schedule contradicts the
     priority that produced it. */
  const lastReviewedAt = entry?.lastReviewedAt || entry?.lastEvaluatedAt || entry?.lastStudiedAt || now - 30 * DAY;
  const baseInterval = masteryToBaseInterval(entry?.mastery ?? 0);

  const intervalDays = Math.max(1, Math.round(baseInterval * confidenceFactor(entry?.confidence)));
  const nextReviewAt = lastReviewedAt + intervalDays * DAY;
  return { nextReviewAt, intervalDays };
}

/**
 * Compute a review priority score (0-100, UI-friendly) plus a
 * recommended review date for one topic's knowledge entry. Thin
 * wrapper around calculateReviewPriority()/calculateNextReview() — this
 * is the single place both get combined into the shape the rest of the
 * app (ForgetMeNot queue, Knowledge Map, LearnLoop) already consumes.
 */
export function computeReviewRecommendation(entry, now = Date.now()) {
  const mastery = entry?.mastery ?? 0;
  /* Same chain as calculateReviewPriority above — the number shown to a
     learner and the number the schedule is computed from must come from
     the same place. */
  const lastReviewedAt = entry?.lastReviewedAt || entry?.lastEvaluatedAt || entry?.lastStudiedAt || now - 30 * DAY;

  const priorityScore = Math.round(calculateReviewPriority(entry, now) * 100);
  const { nextReviewAt, intervalDays } = calculateNextReview(entry, now);
  const daysSinceReview = Math.max(0, (now - lastReviewedAt) / DAY);
  const dueNow = now >= nextReviewAt || priorityScore >= REVIEW_PRIORITY.DUE_SOON;
  const levelKey = reviewLevelKey(priorityScore);

  return {
    // Optional, like every other read above: a topic the learner has never
    // touched has no knowledge entry yet (getEntry returns null for it), and
    // asking for its review schedule is a normal thing to do — it must not
    // throw just because there's no history to schedule from.
    topicId: entry?.topicId ?? null,
    topicName: entry?.topicName ?? null,
    mastery,
    priorityScore,
    daysSinceReview: Math.round(daysSinceReview),
    intervalDays,
    recommendedReviewAt: nextReviewAt, // kept for existing callers
    nextReviewAt, // same value, contract-matching name
    dueNow,
    levelKey,
  };
}

/** Rank all topics by review priority (for the ForgetMeNot queue). */
export function buildReviewQueue(knowledgeEntries, now = Date.now()) {
  return knowledgeEntries
    .map((e) => computeReviewRecommendation(e, now))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/* ------------------ What can actually be reviewed ------------------ */

/**
 * The shortest gap that can count as a review.
 *
 * A review exists to catch a concept before it fades, so something studied
 * minutes ago cannot be one, however the interval arithmetic scores it.
 * Without this, finishing the diagnostic produced "due for review" on five
 * concepts answered seconds earlier. Six hours is the smallest gap over
 * which "do you still remember it?" is a real question.
 */
export const MIN_REVIEW_GAP_MS = 6 * 60 * 60 * 1000;

/** Has the learner ever actually worked on this concept? */
export function hasBeenStudied(entry) {
  if (!entry) return false;
  return (entry.evidence?.length ?? 0) > 0 || (entry.mastery ?? 0) > 0 || Boolean(entry.lastStudiedAt);
}

/**
 * Can this concept be reviewed right now?
 *
 * Two conditions the interval arithmetic alone cannot express: there has
 * to be something to review (a never-opened concept is not "overdue", it
 * is unstarted), and enough time has to have passed for the question to
 * mean anything.
 */
export function isReviewable(entry, now = Date.now()) {
  if (!hasBeenStudied(entry)) return false;
  const last = entry.lastStudiedAt || entry.lastReviewedAt || entry.lastEvaluatedAt || null;
  return !last || now - last >= MIN_REVIEW_GAP_MS;
}

/* Why a concept is in the queue. Ordered by how much it matters, since a
   row shows one reason and a concept can be several things at once: a
   misconception outranks weakness, which outranks simply fading. */
function reviewReasonKey(entry, rec, section) {
  if ((entry?.misconceptions?.length ?? 0) > 0) return "review.reason.misunderstood";
  const recent = entry?.recentPerformance ?? [];
  if (recent.slice(-2).includes(0)) return "review.reason.weak";
  /* "About now is when it starts to fade" is only true of a row actually
     offered as due. A concept can score dueNow and still be held back by
     the six-hour floor, and printing the fading line under "Coming up"
     said something the section itself contradicts. */
  if (section === "due") return "review.reason.fading";
  return "review.reason.scheduled";
}

/**
 * The ForgetMeNot queue, split into what a learner can act on.
 *
 * The flat list this replaces ranked EVERY concept by priority score,
 * including ones never opened — which put "review this" in front of
 * material the learner had never seen, and made the page disagree with
 * Today's Plan about how many reviews were due.
 *
 * Three sections instead:
 *
 *   due       reviewable now, most urgent first, with a misconception
 *             pushed up: a wrong idea costs more than a faded one, because
 *             it actively contradicts what comes next.
 *   upcoming  studied and scheduled, but not yet worth asking about.
 *             Shown so the schedule is visible, not as work.
 *   unstarted never opened. Not reviews at all — surfaced only so the
 *             count is honest about what is missing.
 */
export function buildReviewSections(knowledgeEntries = [], now = Date.now()) {
  const due = [];
  const upcoming = [];
  const unstarted = [];

  for (const entry of knowledgeEntries) {
    const rec = computeReviewRecommendation(entry, now);
    const section = !hasBeenStudied(entry)
      ? "unstarted"
      : rec.dueNow && isReviewable(entry, now)
        ? "due"
        : "upcoming";
    const row = {
      ...rec,
      section,
      reasonKey: reviewReasonKey(entry, rec, section),
      hasMisconception: (entry?.misconceptions?.length ?? 0) > 0,
      misconception: entry?.misconceptions?.[0] || null,
      masteryStage: entry?.masteryStage || null,
    };

    if (section === "unstarted") unstarted.push(row);
    else if (section === "due") due.push(row);
    else upcoming.push(row);
  }

  due.sort((a, b) => {
    if (a.hasMisconception !== b.hasMisconception) return a.hasMisconception ? -1 : 1;
    return (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
  });
  /* Soonest first: "upcoming" is a schedule, and a schedule reads in the
     order things happen, not by how urgent they will eventually be. */
  upcoming.sort((a, b) => (a.nextReviewAt ?? Infinity) - (b.nextReviewAt ?? Infinity));

  return { due, upcoming, unstarted };
}

/** After a successful review, the next interval grows — same curve as
 * calculateNextReview(), exposed standalone for callers that only need the
 * day count (e.g. previewing the interval before a review is recorded). */
export function nextReviewIntervalDays(entry) {
  return Math.max(1, Math.round(masteryToBaseInterval(entry?.mastery ?? 0) * confidenceFactor(entry?.confidence)));
}
