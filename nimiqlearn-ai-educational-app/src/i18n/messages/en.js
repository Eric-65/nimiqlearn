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

  "common.more": "More",
  "common.less": "Less",

  /* ---------------- glossary ---------------- */
  "glossary.sub":
    "Every concept the app teaches, defined — including the misconception it most often trips people with.",
  "glossary.count": "{count} concepts",
  "glossary.search.label": "Search the glossary",
  "glossary.search.placeholder": "Search definitions, examples, misconceptions\u2026",
  "glossary.showingAll": "Showing all {count} concepts",
  "glossary.matches_one": "{count} match for \u201C{query}\u201D",
  "glossary.matches_other": "{count} matches for \u201C{query}\u201D",
  "glossary.noMatch":
    "Nothing matches \u201C{query}\u201D. Try a broader word — the search covers definitions, key points, analogies and misconceptions.",
  "glossary.keyPoints": "Key points",
  "glossary.analogy": "Analogy",
  "glossary.example": "Worked example",
  "glossary.misconception": "Common misconception",
  "glossary.explainBack": "Explain this back \u2192",
  "glossary.studyIt": "Study it",

  /* ---------------- ForgetMeNot (review) ---------------- */
  "review.title": "ForgetMeNot AI",
  "review.sub":
    "Transparent spaced review. The app schedules reinforcement from your mastery, recency, and recent mistakes — the AI only writes the review content, never the timing.",
  "review.empty": "Nothing to review yet — evaluate a concept first.",
  "review.reason": "ForgetMeNot scheduled this for reinforcement.",
  "review.due": "Due",
  "review.level.urgent": "Urgent",
  "review.level.dueSoon": "Due soon",
  "review.level.keepAnEye": "Keep an eye",
  "review.level.fresh": "Fresh",
  "review.meta": "{days}d since last review • next in {next}d • mastery {mastery}%",
  "review.priorityAria": "Review priority {score} percent",
  "review.now": "Review now",
  "review.again": "Review again",
  "review.start": "Start review",
  "review.preparing": "Preparing review\u2026",
  "review.priorityReady": "Priority {score}/100 — ready when you are.",
  "review.howTitle": "How priority is computed:",
  "review.howBody":
    "40% mastery gap + 30% overdue time + 20% recent failures − 10% review stability. Deterministic, visible, and owned by the app.",
  "review.aiFallback": "Reviews use built-in recall prompts — your schedule is unaffected.",
  "review.result.ok": "Recalled — interval extended.",
  "review.result.again": "Needs another pass — priority raised.",
  "review.mastery.moved": "Mastery {delta} \u2192 {after}%.",
  "review.mastery.same": "Mastery stays at {after}%.",
  "review.scheduleUpdated": "The review schedule updated automatically.",
  "review.dueNow_one": "{count} topic due now.",
  "review.dueNow_other": "{count} topics due now.",
  "review.dueNow.hint": "A 3-minute review now beats a re-teach later.",

  /* ---------------- AI status ---------------- */
  "ai.unavailable": "AI unavailable right now.",

  /* ---------------- learning activities ---------------- */
  "activity.shortExplanation": "Short explanation",
  "activity.analogy": "Analogy",
  "activity.example": "Worked example",
  "activity.multipleChoice": "Quick check",
  "activity.openResponse": "Open response",
  "activity.explainBack": "Explain it back",
  "activity.practice": "Targeted practice",
  "activity.review": "Spaced review",
  "activity.generatedByAI": "Generated by AI",
  "activity.aiTimeout": "AI generation didn't respond in time.",
  "activity.aiTimeout.body": "This activity is using a built-in question instead.",
  "activity.retryAI": "Retry AI \u2192",
  "activity.yourAnswerFor": "Your answer for {activity}",
  "activity.placeholder.explain": "Explain it as if teaching a friend\u2026",
  "activity.placeholder.open": "Write your answer\u2026",
  "activity.evaluate": "Evaluate my explanation",
  "activity.submit": "Submit answer",
  "activity.gotIt": "Got it — continue",
  "activity.recalled": "I recalled it",
  "activity.anotherPass": "I need another pass",
  "activity.showExplanation": "Show explanation",

  /* ---------------- learn-loop reasons ---------------- */
  "loop.reason.new": "This concept is new to you — let's start with the core idea.",
  "loop.reason.review": "ForgetMeNot flagged this concept for reinforcement.",
  "loop.reason.misconception": "You just slipped on this — let's attack the exact misconception.",
  "loop.reason.low": "Building the foundation before we go deeper.",
  "loop.reason.mid": "You get the idea — now let's apply it.",
  "loop.reason.high": "You're strong here. Explaining it back will lock it in.",
  "loop.reason.mastered": "Mastered! Keep it fresh with a final explanation.",
  "loop.reason.masteredNext": "Mastered! Time to level up to {topic}.",

  "home.recommendedNext": "Recommended next",
  "home.afterThis": "After this:",
  "home.startActivity": "Start this activity",

  /* ---------------- ExplainBack ---------------- */
  "explain.sub": "Teach the concept back in your own words.",
  "explain.prompt": "Imagine you're teaching this to a friend who has never seen it before.",
  "explain.yourExplanation": "Your explanation",
  "explain.placeholder": "Start explaining here...",
  "explain.words_one": "{count} word",
  "explain.words_other": "{count} words",
  "explain.aiReady": "AI grading ready",
  "explain.aiNotConfigured": "AI grading not configured — built-in assessment will be used",
  "explain.check": "Check My Understanding \u2192",
  "explain.checking": "Checking your understanding\u2026",
  "explain.hideYours": "Hide your explanation",
  "explain.showYours": "Show your explanation",
  "explain.useBuiltIn": "Use built-in assessment now",
  "explain.usedBuiltIn": "This assessment used the built-in engine.",
  "explain.aiUnavailable": "AI grading is unavailable right now.",
  "explain.retryAI": "Retry with AI \u2192",
  "explain.revisitIn": "You should revisit this concept in",
  "explain.days_one": "{count} day",
  "explain.days_other": "{count} days",
  "explain.whySchedule":
    "Why? Your mastery improved, but one important concept is still developing. The schedule is computed by the app — the AI only creates review content.",
  "explain.reviewLater": "Review later",
  "explain.nextUp": "Next up",
  "explain.startNext": "Start next challenge \u2192",
  "explain.another": "Explain another concept",

  /* ---------------- Learn ---------------- */
  "learn.sub":
    "LearnLoop picks the next activity from your knowledge state. The AI generates the content; the loop decides the move.",
  "learn.concept": "Concept",
  "learn.appMastery": "App mastery: {pct}%",
  "learn.explainConcept": "Explain this concept",
  "learn.reviewSchedule": "Review schedule",
  "learn.feedback.ok": "Nice — that's locked in.",
  "learn.feedback.miss": "Good try — the loop will target this.",
  "learn.mastery.same": "Mastery stays at {after}% — nothing to lose yet.",
  "learn.nextActivity": "Next activity \u2192",
  "learn.preparing": "Preparing your next activity\u2026",
  "learn.aiFallback": "Activities are using built-in templates — everything keeps working.",

  /* ---------------- Marketplace ---------------- */
  "market.title": "Learning Economy",
  "market.sub":
    "Courses and learning paths from independent educators. Unlock them directly with NIM through Nimiq Pay — creators receive payments instantly.",
  "market.live": "Live Nimiq Pay",
  "market.demoBadge": "DEMO MODE — payments simulated",
  "market.paymentsDisabled":
    "No learning-pack recipient address is configured (VITE_NIM_LEARNING_RECIPIENT is unset). Unlocking with real NIM is disabled until an educator recipient address is configured.",
  "market.unlocked": "{title} unlocked — payment confirmed via Nimiq Pay.",
  "market.unlocked.sim": "{title} unlocked in DEMO MODE (simulated payment).",
  "market.popular": "Popular",
  "market.unlockedBadge": "Unlocked",
  "market.unlockedSim": "Unlocked (sim.)",
  "market.by": "by {creator}",
  "market.outcomes": "You'll be able to",
  "market.oneTime": "one-time unlock",
  "market.unlock": "Unlock pack",
  "market.unlockedCheck": "Unlocked \u2713",
  "market.safety.title": "Unlocks go through Nimiq Pay's native confirmation.",
  "market.safety.body":
    "Your keys never leave the wallet. NIM is supported on every pack; USDT is available on packs that list a USDT price, over Nimiq Pay's Ethereum provider. Wallet and payment services are fully separated from the AI — the model never sees your address.",

  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.tryAgain": "Try again",

  /* ---------------- payment modal ---------------- */
  "pay.title": "Unlock learning pack",
  "pay.disabled": "Payment disabled",
  "pay.demoBadge": "DEMO MODE — simulation",
  "pay.liveBadge": "Nimiq Pay • live",
  "pay.price": "Price",
  "pay.asset": "Asset",
  "pay.selectAsset": "Select payment asset",
  "pay.chain": "Chain",
  "pay.selectChain": "Select EVM chain",
  "pay.purpose": "Purpose",
  "pay.recipient": "Recipient",
  "pay.checkingEnv": "Checking environment\u2026",
  "pay.confirmWith": "Confirm with Nimiq Pay · {amount} {asset}",
  "pay.review": "Please review the details",
  "pay.demoNote": "This is a demo simulation and will complete momentarily.",
  "pay.approveNote": "Approve the request in Nimiq Pay to continue.",
  "pay.awaiting": "Waiting for wallet approval...",
  "pay.simulating": "Simulating payment\u2026",
  "pay.submitted": "Payment submitted",
  "pay.confirmed": "Payment confirmed",
  "pay.cancelled": "Payment cancelled",
  "pay.notConfirmed": "Payment not confirmed",
  "pay.unconfirmed": "Payment status could not be confirmed.",
  "pay.checkWalletFirst": "I'll check my wallet first",
  "pay.unlocked": "Learning pack unlocked",
  "pay.unlocked.sim": "Learning pack unlocked (simulated)",
  "pay.startLearning": "Start learning",
  "market.noRecipient": "No recipient address is configured for this product.",
  "market.noUsdtRecipient": "No recipient address is configured for USDT payments.",
  "market.usdtDisabled":
    "No USDT recipient address is configured (VITE_USDT_LEARNING_RECIPIENT is unset). Unlocking with USDT is disabled until an educator EVM address is configured.",
};
