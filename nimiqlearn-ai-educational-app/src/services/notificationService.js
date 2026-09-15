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
/* Notifications are emitted as translation KEYS plus variables, never as
   built English sentences. A service that returns finished prose can only
   ever speak one language, and the moment one is added it becomes the one
   place in the app that silently stays English. The view calls t() with
   what it is given here. */
export function buildNotifications({ knowledge = [], dueNow = [], learner = {}, xp = null } = {}) {
  const dismissed = readDismissed();
  const items = [];

  // --- Reviews genuinely due now (ForgetMeNot's own scheduling) ---
  if (dueNow.length > 0) {
    /* IDs as well as names: the name is English source data, so the view
        has to run it through tOr() before it reaches a sentence. */
    const named = dueNow.slice(0, 2).map((d) => d.topicName).filter(Boolean);
    const namedIds = dueNow.slice(0, 2).map((d) => d.topicId).filter(Boolean);
    items.push({
      id: `review:${dueNow.length}:${dueNow[0]?.topicId || ""}`,
      kind: NOTIFICATION_KIND.REVIEW,
      icon: "⏳",
      tone: "amber",
      titleKey: "notif.review.title",
      titleVars: { count: dueNow.length },
      titlePlural: true,
      bodyKey: dueNow.length === 1 ? "notif.review.body.one" : "notif.review.body.many",
      bodyVars: {
        topicId: dueNow[0]?.topicId || "",
        topic: dueNow[0]?.topicName || "",
        topicIds: namedIds,
        topics: named.join(", "),
      },
      action: { labelKey: "notif.review.action", path: "review" },
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
      titleKey: "notif.weak.title",
      titleVars: { topicId: entry.topicId, topic: entry.topicName },
      bodyKey: "notif.weak.body",
      /* statusKey, not STATUS_META's English label — the status word has to
         translate along with the sentence it sits inside. */
      bodyVars: { mastery: Math.round(entry.mastery || 0), statusKey: `status.${entry.status}` },
      action: { labelKey: "notif.weak.action", path: "explain", params: { topic: entry.topicId } },
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
      titleKey: "notif.payment.title",
      bodyKey: "notif.payment.body",
      bodyVars: { product: pending.productId },
      action: { labelKey: "notif.payment.action", path: "wallet" },
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
      titleKey: pack.simulated ? "notif.unlock.title.sim" : "notif.unlock.title",
      bodyKey: pack.simulated ? "notif.unlock.body.sim" : "notif.unlock.body",
      bodyVars: { product: pack.productId },
      action: { labelKey: "notif.unlock.action", path: "market" },
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
      titleKey: "notif.level.title",
      titleVars: { level: xp.level },
      bodyKey: "notif.level.body",
      /* Raw numbers: the view formats them with the locale's own separators
         (1,000 vs 1.000) — toLocaleString() here would bake in en-US. */
      bodyVars: { xp: xp.xp, remaining: xp.xpForNextLevel - xp.xpIntoLevel },
      action: { labelKey: "notif.level.action", path: "leaderboard" },
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
