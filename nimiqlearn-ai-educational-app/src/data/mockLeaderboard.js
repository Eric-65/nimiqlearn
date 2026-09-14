/* ============================================================
   NimiqLearn — DEMO leaderboard cohort
   ------------------------------------------------------------
   READ THIS BEFORE USING THIS FILE.

   These learners are NOT real. NimiqLearn has no accounts, no
   user database, and no backend that stores anyone's progress —
   learner state lives in this browser's localStorage and nowhere
   else (see LearnerContext.jsx). So there is no such thing as
   "other users of the app" to rank against, and any leaderboard
   that implied otherwise would be inventing people.

   This file exists so the leaderboard can show what it is FOR —
   ranking by XP — with a fixed, clearly-labelled sample cohort,
   while the signed-in learner's own row uses their REAL XP from
   xpService.js. Leaderboard.jsx must say so on screen. Same
   convention as mockTopics.js / mockLearningPacks.js: named
   "mock", never dressed up as live data.

   Values are fixed constants, not random, so a learner's rank
   doesn't jitter between renders for no reason.

   When a real backend with real accounts exists, this whole file
   should be deleted, not "kept as a fallback" — a fallback that
   invents competitors is worse than an empty leaderboard.
   ============================================================ */

/** Fixed sample cohort, ordered loosely by XP (the page sorts anyway). */
export const DEMO_COHORT = [
  { id: "demo-1", name: "Amara O.", xp: 9420, avatar: "🦉", accent: "gold" },
  { id: "demo-2", name: "Kenji T.", xp: 7860, avatar: "🦊", accent: "teal" },
  { id: "demo-3", name: "Priya S.", xp: 6310, avatar: "🐢", accent: "blue" },
  { id: "demo-4", name: "Luis M.", xp: 4980, avatar: "🦅", accent: "violet" },
  { id: "demo-5", name: "Nadia K.", xp: 3640, avatar: "🐬", accent: "amber" },
  { id: "demo-6", name: "Tomas B.", xp: 2475, avatar: "🦌", accent: "teal" },
  { id: "demo-7", name: "Ingrid H.", xp: 1520, avatar: "🐧", accent: "blue" },
  { id: "demo-8", name: "Samir A.", xp: 880, avatar: "🦁", accent: "gold" },
  { id: "demo-9", name: "Chiara V.", xp: 410, avatar: "🐝", accent: "rose" },
];

/**
 * Merges the learner's REAL xp into the demo cohort and ranks the lot.
 * The learner's row is flagged `isYou` and `real: true`; every demo row is
 * flagged `real: false` so the UI cannot accidentally present them alike.
 */
export function buildLeaderboard(realXp, youName = "You") {
  const you = {
    id: "you",
    name: youName,
    xp: Math.max(0, Math.round(Number(realXp) || 0)),
    avatar: "🧠",
    accent: "teal",
    isYou: true,
    real: true,
  };

  const rows = [...DEMO_COHORT.map((r) => ({ ...r, isYou: false, real: false })), you];

  rows.sort((a, b) => {
    if (b.xp !== a.xp) return b.xp - a.xp;
    // Stable tie-break, and it puts the learner above a demo row they've
    // drawn level with rather than below it.
    if (a.isYou) return -1;
    if (b.isYou) return 1;
    return a.name.localeCompare(b.name);
  });

  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}
