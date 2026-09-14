/* ============================================================
   NimiqLearn — English (source catalogue)
   ------------------------------------------------------------
   English is the source of truth AND the fallback: every other
   catalogue is checked against this one, and any key missing
   elsewhere resolves here (see i18nService.js).

   Conventions:
   - Keys are dotted and namespaced by surface: nav.*, home.*,
     settings.*, content.* …
   - `{name}` placeholders are interpolated. A translation MUST
     keep every placeholder the English string uses.
   - Keys ending _one / _other are plural forms selected through
     Intl.PluralRules. Languages with a single form (ko, ja, zh)
     only need _other.
   - "NimiqLearn", "ExplainBack", "ForgetMeNot", "Nimiq Pay",
     "NIM" and "USDT" are proper nouns and stay untranslated in
     every catalogue — they are product and asset names, not
     descriptions.
   ============================================================ */

export default {
  /* ---------------- brand + shell ---------------- */
  "brand.tagline": "Adaptive AI learning",
  "nav.primary": "Primary navigation",

  "nav.group.Study": "Study",
  "nav.group.Economy": "Economy",
  "nav.group.You": "You",

  "nav.home": "Home",
  "nav.learn": "Learn",
  "nav.explain": "ExplainBack",
  "nav.review": "ForgetMeNot",
  "nav.knowledge": "Knowledge",
  "nav.glossary": "Glossary",
  "nav.market": "Marketplace",
  "nav.wallet": "Wallet",
  "nav.leaderboard": "Leaderboard",
  "nav.profile": "Profile",
  "nav.notifications": "Notifications",
  "nav.settings": "Settings",

  "nav.unread": "{count} unread",
  "nav.notifications.active": "Notifications, {count} active",

  /* ---------------- theme switch ---------------- */
  "theme.switch.label": "Light theme",
  "theme.switch.toLight": "Switch to light theme",
  "theme.switch.toDark": "Switch to dark theme",

  /* ---------------- connection status ---------------- */
  "status.connected": "Connected",
  "status.connected.suffix": "to Nimiq Pay",
  "status.connectedPay.aria": "Connected to Nimiq Pay",
  "status.detecting": "Detecting environment…",
  "status.demo": "DEMO",
  "status.demo.suffix": "— payments simulated",
  "status.demo.aria": "Demo mode active",

  /* ---------------- shared vocabulary ---------------- */
  "common.active": "Active",
  "common.configured": "Configured",
  "common.notConfigured": "Not configured",
  "common.connected": "Connected",
  "common.notConnected": "Not connected",
  "common.notAvailableHere": "Not available here",
  "common.recipientConfigured": "Recipient configured",
  "common.disabled": "Disabled",
  "common.comingSoon": "Coming soon",

  /* ---------------- settings ---------------- */
  "settings.sub": "Language, appearance, connections, and your data.",
  "settings.badge.light": "Light theme",
  "settings.badge.dark": "Dark theme",

  "settings.language.title": "Language",
  "settings.language.sub": "Tap a language — the whole app switches instantly.",
  "settings.language.note":
    "Your choice is remembered on this device and can be changed back at any time. NimiqLearn AI also replies in the language you pick.",

  "settings.appearance.title": "Appearance",
  "settings.appearance.sub": "Applies instantly and is remembered on this device.",
  "settings.appearance.theme": "Theme",
  "settings.theme.dark": "Dark",
  "settings.theme.dark.hint": "The NimiqLearn default",
  "settings.theme.light": "Light",
  "settings.theme.light.hint": "Bright, high-contrast",
  "settings.theme.system": "System",
  "settings.theme.system.hint": "Follow your device",
  "settings.theme.currently": "currently {theme}",

  "settings.notifications.sub": "Derived from your progress — nothing is pushed from a server.",
  "settings.notifications.body":
    "Reviews falling due, topics slipping, and unverified payments all raise a notification automatically. Dismissals are remembered on this device.",
  "settings.notifications.open": "Open notifications",
  "settings.notifications.restore": "Restore dismissed",

  "settings.connections.title": "Connections",
  "settings.connections.sub": "What this build is actually configured for.",
  "settings.conn.ai": "AI grading backend",
  "settings.conn.ai.on":
    "ExplainBack grading and Learn activities call the backend, falling back to the built-in engine on failure.",
  "settings.conn.ai.off":
    "VITE_EXPLAINBACK_TUTOR_API_URL is unset, so every AI feature uses the built-in deterministic engine.",
  "settings.conn.wallet": "Nimiq Pay wallet",
  "settings.conn.wallet.on": "Real NIM payments are available.",
  "settings.conn.wallet.off":
    "Open NimiqLearn inside Nimiq Pay to connect. Payments run as clearly-labelled simulations until then.",
  "settings.conn.nim": "NIM payments",
  "settings.conn.nim.on": "A real recipient address is set.",
  "settings.conn.nim.off": "No recipient address configured, so unlocking with real NIM is off.",
  "settings.conn.usdt": "USDT payments",
  "settings.conn.usdt.on": "USDT is available on packs that list a USDT price.",
  "settings.conn.usdt.off": "No EVM recipient address configured yet.",
  "settings.conn.walletDetails": "Wallet details",

  "settings.data.title": "Your data",
  "settings.data.sub": "Everything NimiqLearn knows about you lives in this browser.",
  "settings.data.body":
    "Mastery, XP, the review queue and unlocked packs are stored in this browser's local storage. There is no account and no server copy — clearing your browser data clears your progress, and resetting here cannot be undone.",
  "settings.data.viewProfile": "View profile",
  "settings.data.reset": "Reset learner data",
  "settings.data.confirmReset":
    "Reset all learner data? Your mastery, XP, review queue and unlocked packs will be cleared. This cannot be undone.",

  /* ---------------- notifications ---------------- */
  "notif.sub": "What actually needs you — worked out from your own progress, not pushed from anywhere.",
  "notif.count": "{count} active",
  "notif.allClear": "All clear",
  "notif.dismiss": "Dismiss",
  "notif.dismiss.aria": "Dismiss: {title}",
  "notif.restoreAll": "Restore dismissed notifications",
  "notif.empty.title": "Nothing needs your attention",
  "notif.empty.body":
    "No reviews are due, no topics have slipped, and no payments are unverified. This is a real empty state — come back after some study and it will fill itself in.",
  "notif.empty.start": "Start a session",

  "notif.review.title_one": "{count} concept ready for review",
  "notif.review.title_other": "{count} concepts ready for review",
  "notif.review.body.one": "{topic} is due — reviewing it now is when it sticks best.",
  "notif.review.body.many": "Including {topics}. Spaced review is what stops them fading.",
  "notif.review.action": "Review now",

  "notif.weak.title": "{topic} needs another pass",
  "notif.weak.body": "Mastery is {mastery}% ({status}). Explaining it back is the fastest way to find the gap.",
  "notif.weak.action": "Explain it",

  "notif.payment.title": "A payment still needs verifying",
  "notif.payment.body":
    "The result of your payment for \"{product}\" could not be confirmed. Check your wallet history before trying again, so you don't pay twice.",
  "notif.payment.action": "Open wallet",

  "notif.unlock.title": "Pack unlocked",
  "notif.unlock.title.sim": "Pack unlocked (simulated)",
  "notif.unlock.body": "\"{product}\" is yours. It's ready whenever you are.",
  "notif.unlock.body.sim": "\"{product}\" was unlocked in DEMO MODE — no real payment was made.",
  "notif.unlock.action": "Go to Marketplace",

  "notif.level.title": "You reached level {level}",
  "notif.level.body": "{xp} XP earned so far. {remaining} XP to the next level.",
  "notif.level.action": "See leaderboard",

  /* ---------------- knowledge status vocabulary ---------------- */
  "status.new": "New",
  "status.learning": "Learning",
  "status.developing": "Developing",
  "status.strong": "Strong",
  "status.mastered": "Mastered",

  "common.or": "or",

  /* ---------------- knowledge map ---------------- */
  "knowledge.title": "Knowledge Map",
  "knowledge.sub": "Your live understanding of the curriculum. Click any node to start learning — weak nodes pulse.",
  "knowledge.tracked_one": "{count} concept tracked",
  "knowledge.tracked_other": "{count} concepts tracked",
  "knowledge.avgMastery": "Average mastery",
  "knowledge.mastered": "Mastered concepts",
  "knowledge.needsAttention": "Needs attention",
  "knowledge.dueForReview_one": "{count} concept due for review.",
  "knowledge.dueForReview_other": "{count} concepts due for review.",
  "knowledge.openReview": "Open ForgetMeNot \u2192",

  /* ---------------- wallet ---------------- */
  "wallet.title": "Wallet & Learning Economy",
  "wallet.sub": "Your connection to Nimiq Pay, the assets supported by this environment, and your unlock history.",
  "wallet.demoMode": "DEMO MODE",
  "wallet.assets.title": "Supported assets",
  "wallet.assets.sub": "Detected from the current environment — never hard-coded to an unsupported chain.",
  "wallet.assets.real": "Real support",
  "wallet.pending.title": "Payment status needs verification",
  "wallet.pending.sub":
    "A payment may have been submitted but could not be confirmed — check your Nimiq Pay transaction history before retrying.",
  "wallet.pending.attempted": "attempted {when}",
  "wallet.howto.title": "How to run as a real Mini App",
  "wallet.howto.step1": "Deploy this app to an HTTPS URL and open it inside Nimiq Pay via",
  "wallet.howto.step2":
    "The Mini App SDK init() resolves, real accounts load, and payments use Nimiq Pay's native confirmation dialogs.",
  "wallet.howto.step3":
    "In a normal browser the app transparently runs in DEMO MODE: the AI still works, but payments are explicit simulations labelled SIM-\u2026",
  "wallet.howto.security":
    "NimiqLearn never stores seed phrases or private keys, never creates custodial wallets, and never bypasses native Nimiq Pay confirmation.",
  "wallet.reset.title": "Start fresh",
  "wallet.reset.sub": "Reset learner state, knowledge map, and review queue to the demo defaults.",
  "wallet.reset.confirm": "Reset all learner data?",

  /* ---------------- XP levels ---------------- */
  "level.beginner": "Beginner",
  "level.explainer": "Explainer",
  "level.connector": "Connector",
  "level.deepThinker": "Deep Thinker",
  "level.mentor": "Mentor",
  "level.masterExplainer": "Master Explainer",

  /* ---------------- leaderboard ---------------- */
  "lb.sub": "Ranked by XP — which grows with the mastery you build, not the hours you log.",
  "lb.rank": "Rank #{rank}",
  "lb.level": "Level {level}",
  "lb.you": "You",
  "lb.demo": "Demo",
  "lb.real": "Real",
  "lb.sample": "sample",
  "lb.xpAmount": "{xp} XP",
  "lb.accuracy": "{pct}% accuracy",
  "lb.topicsStudied_one": "{count} topic studied",
  "lb.topicsStudied_other": "{count} topics studied",
  "lb.toNextLevel": "{into} / {need} XP to level {level}",
  "lb.disclaimer.title": "Your row is real. The others are sample data.",
  "lb.disclaimer.body":
    "NimiqLearn keeps your progress in this browser only — there are no accounts and no server storing other learners, so there is nobody real to rank you against yet. Your XP, level and position are computed from your genuine mastery and answer history.",
  "lb.standings": "Standings",
  "lb.standings.sub": "Sorted by total XP.",
  "lb.how.title": "How XP is earned",
  "lb.how.sub": "Every number below is computed from your own activity — nothing is awarded for showing up.",
  "lb.how.mastery": "Mastery across all topics",
  "lb.how.mastery.hint":
    "2 XP per mastery point — the biggest share, so XP tracks understanding rather than activity.",
  "lb.how.correct": "Correct answers",
  "lb.how.correct.hint": "12 XP each · {count} correct so far",
  "lb.how.bonus": "Accuracy bonus",
  "lb.how.bonus.none": "Answer something to start building an accuracy record.",
  "lb.how.bonus.hint": "Up to +25% of your correct-answer XP, scaled by your {pct}% hit rate.",
  "lb.how.wrong": "Wrong answers",
  "lb.how.wrong.value": "{count} · no XP lost",
  "lb.how.wrong.hint":
    "They already lower mastery, so they are never subtracted twice — they only hold back the accuracy bonus.",

  /* ---------------- profile ---------------- */
  "profile.sub": "Your learning record — all of it measured, none of it estimated.",
  "profile.signedIn": "Signed in with Nimiq Pay",
  "profile.localLearner": "Local learner — connect a wallet to attach an identity",
  "profile.toLevel": "{into} / {need} to level {level}",
  "profile.topicsStudied": "Topics studied",
  "profile.accuracy": "Answer accuracy",
  "profile.noData": "No data yet",
  "profile.reviewsDue": "Reviews due",
  "profile.breakdown": "Knowledge breakdown",
  "profile.breakdown.sub": "Where every concept in the curriculum currently sits.",
  "profile.record": "Answer record",
  "profile.record.sub": "Lifetime counters across every activity type.",
  "profile.correct": "Correct",
  "profile.incorrect": "Incorrect",
  "profile.lastStudied": "Last studied",
  "profile.notYet": "Not yet",
  "profile.extremes": "Strongest & weakest",
  "profile.extremes.sub": "Based on measured mastery, not self-report.",
  "profile.extremes.empty": "Nothing studied yet — once you explain or practise a concept, it shows up here.",
  "profile.strongest": "Strongest",
  "profile.needsWork": "Needs work",
  "profile.practise": "Practise",
  "profile.packs": "Unlocked packs",
  "profile.packs.sub": "From the Learning Economy.",
  "profile.packs.empty": "No packs unlocked yet.",
  "profile.simulated": "Simulated",
  "profile.paid": "Paid",
  "profile.manage": "Manage your data",
  "profile.manage.sub": "Theme, reset, and diagnostics live in Settings.",
  "profile.openSettings": "Open Settings",
};
