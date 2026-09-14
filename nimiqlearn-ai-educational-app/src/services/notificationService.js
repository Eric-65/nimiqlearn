/* ============================================================
   NimiqLearn — notifications
   ------------------------------------------------------------
   Every notification here is DERIVED from state the app already
   holds: the review queue, knowledge entries, unlocked packs,
   unverified payments. Nothing is pushed from a server (there
   isn't one for this), nothing is invented, and an empty list
   genuinely means "nothing needs you right now" rather than
   "we failed to load something".

   Read-state is per-browser in localStorage, keyed by a stable
   id derived from the notification's meaning — so dismissing
   "3 reviews due" stays dismissed until the underlying facts
   change, instead of reappearing on every render.
   ============================================================ */

import { STATUS_META } from "./knowledgeService.js";

const READ_KEY = "nimiqlearn:notifications-read";

export const NOTIFICATION_KIND = {
  REVIEW: "REVIEW",
  WEAK_TOPIC: "WEAK_TOPIC",
  PAYMENT: "PAYMENT",
  UNLOCK: "UNLOCK",
  MILESTONE: "MILESTONE",
};

function readDismissed() {
  try {
    const raw = localStorage.getItem(READ_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function writeDismissed(set) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-200)));
  } catch {
    /* storage unavailable — dismissals just won't persist */
  }
}

export function dismissNotification(id) {
  const set = readDismissed();
  set.add(id);
  writeDismissed(set);
}

export function restoreAllNotifications() {
  writeDismissed(new Set());
}

/**
 * Builds the current notification list.
 *
 * @param {object} params
 * @param {Array}  params.knowledge   - per-topic knowledge entries
 * @param {Array}  params.dueNow      - review-queue items already due
 * @param {object} params.learner     - the learner record (packs, payments)
 * @param {object} params.xp          - computeXp() output, for milestones
 */
export function buildNotifications({ knowledge = [], dueNow = [], learner = {}, xp = null } = {}) {
  const dismissed = readDismissed();
  const items = [];

  // --- Reviews genuinely due now (ForgetMeNot's own scheduling) ---
  if (dueNow.length > 0) {
    items.push({
      id: `review:${dueNow.length}:${dueNow[0]?.topicId || ""}`,
      kind: NOTIFICATION_KIND.REVIEW,
      icon: "⏳",
      tone: "amber",
      title: `${dueNow.length} concept${dueNow.length === 1 ? "" : "s"} ready for review`,
      body:
        dueNow.length === 1
          ? `${dueNow[0]?.topicName || "A concept"} is due — reviewing it now is when it sticks best.`
          : `Including ${dueNow.slice(0, 2).map((d) => d.topicName).filter(Boolean).join(" and ")}. Spaced review is what stops them fading.`,
      action: { label: "Review now", path: "review" },
      at: Date.now(),
    });
  }

  // --- Topics the learner is measurably weakest on ---
  const weak = knowledge
    .filter((e) => e.lastStudiedAt && (Number(e.mastery) || 0) < 40)
    .sort((a, b) => (a.mastery || 0) - (b.mastery || 0))
    .slice(0, 2);

  for (const entry of weak) {
    items.push({
      id: `weak:${entry.topicId}:${Math.round((entry.mastery || 0) / 10)}`,
      kind: NOTIFICATION_KIND.WEAK_TOPIC,
      icon: "🎯",
      tone: "rose",
      title: `${entry.topicName} needs another pass`,
      body: `Mastery is ${Math.round(entry.mastery || 0)}% (${STATUS_META[entry.status]?.label || entry.status}). Explaining it back is the fastest way to find the gap.`,
      action: { label: "Explain it", path: "explain", params: { topic: entry.topicId } },
      at: entry.lastStudiedAt || Date.now(),
    });
  }

  // --- A payment whose outcome was never confirmed (real money question) ---
  for (const pending of learner.pendingPayments || []) {
    items.push({
      id: `payment:${pending.productId}:${pending.startedAt}`,
      kind: NOTIFICATION_KIND.PAYMENT,
      icon: "⚠️",
      tone: "rose",
      title: "A payment still needs verifying",
      body: `The result of your payment for "${pending.productId}" could not be confirmed. Check your wallet history before trying again, so you don't pay twice.`,
      action: { label: "Open wallet", path: "wallet" },
      at: pending.startedAt || Date.now(),
    });
  }

  // --- Packs actually unlocked ---
  for (const pack of (learner.unlockedPacks || []).slice(-2)) {
    items.push({
      id: `unlock:${pack.productId}:${pack.unlockedAt || ""}`,
      kind: NOTIFICATION_KIND.UNLOCK,
      icon: pack.simulated ? "🧪" : "🎉",
      tone: pack.simulated ? "amber" : "teal",
      title: pack.simulated ? "Pack unlocked (simulated)" : "Pack unlocked",
      body: pack.simulated
        ? `"${pack.productId}" was unlocked in DEMO MODE — no real payment was made.`
        : `"${pack.productId}" is yours. It's ready whenever you are.`,
      action: { label: "Go to Marketplace", path: "market" },
      at: pack.unlockedAt || Date.now(),
    });
  }

  // --- Level milestone, from real XP ---
  if (xp && xp.level > 1) {
    items.push({
      id: `milestone:level:${xp.level}`,
      kind: NOTIFICATION_KIND.MILESTONE,
      icon: "⭐",
      tone: "gold",
      title: `You reached level ${xp.level}`,
      body: `${xp.xp.toLocaleString()} XP earned so far. ${xp.xpForNextLevel - xp.xpIntoLevel} XP to the next level.`,
      action: { label: "See leaderboard", path: "leaderboard" },
      at: Date.now(),
    });
  }

  return items
    .filter((n) => !dismissed.has(n.id))
    .sort((a, b) => b.at - a.at);
}

/** Count only — cheap enough to call from the topbar badge on every render. */
export function countNotifications(params) {
  return buildNotifications(params).length;
}
