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
   - "NimiqLearn", "Nimiq Pay", "NIM" and "USDT" are product and
     asset names and stay untranslated in every catalogue.
   - The FEATURE names — ExplainBack, ForgetMeNot, LearnLoop — are
     translated, because to a learner reading a Korean or Spanish
     UI they are just two English words sitting in the middle of
     the nav. Each catalogue documents its own choices in its
     header; German and Chinese use the actual forget-me-not
     flower (Vergissmeinnicht, 勿忘我), keeping the pun the English
     name is built on.
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

  /* ---------------- Home ---------------- */
  "home.hero.line1": "Learn smarter.",
  "home.hero.line2": "Explain better.",
  "home.hero.line3": "Remember longer.",
  "home.hero.sub":
    "An adaptive learning system that finds what you understand, what you're missing, and what you should practice next.",
  "home.hero.start": "Start Learning \u2192",
  "home.hero.explain": "Explain a concept",
  "home.hero.claim1": "🧠 AI grading, with a built-in offline engine",
  "home.hero.claim2": "🔒 Your keys never leave your wallet",
  "home.hero.claim3": "⚡ Pay with NIM",
  "home.hero.imageAlt": "A focused student reading a textbook in a warm library",
  "home.heroCaption.badge": "ExplainBack in action",
  "home.heroCaption.quote":
    "\u201CForce equals mass times acceleration — so the same push moves a light cart faster\u2026\u201D",

  "home.next.eyebrow": "What should I learn next?",
  "home.next.continue": "Continue \u2192",
  "home.next.allStrong": "Everything looks strong — pick something new to explore.",
  "home.rec.due.label": "Due for review",
  "home.rec.due.why": "ForgetMeNot flagged this for review — a quick refresh locks it in.",
  "home.rec.building.label": "Keep building",
  "home.rec.building.why": "You're at {pct}% — the next step will strengthen this.",
  "home.rec.fresh.label": "New concept",
  "home.rec.fresh.why": "A fresh concept to grow your map.",

  "home.explainCard.body": "Test what you really understand.",
  "home.explainCard.aiReady": "AI ready — explain and get instant feedback.",
  "home.explainCard.aiOff": "Explain a concept and the AI checks your understanding.",
  "home.explainCard.cta": "Explain a concept \u2192",

  "home.reviewCard.due_one": "{count} concept is ready for review.",
  "home.reviewCard.due_other": "{count} concepts are ready for review.",
  "home.reviewCard.none": "No reviews due right now — you're on track.",
  "home.reviewCard.cta": "Review \u2192",

  "home.economy.unlocked": "Unlocked learning paths:",
  "home.economy.recent": "Recent purchase:",
  "home.economy.hint": "Unlock packs with NIM through Nimiq Pay.",
  "home.economy.cta": "Explore Marketplace",

  "home.loop.eyebrow": "The core loop",
  "home.loop.title": "An AI tutor that learns what you understand",
  "home.loop.learn": "Learn",
  "home.loop.explain": "Explain",
  "home.loop.evaluate": "Evaluate",
  "home.loop.detectGap": "Detect gap",
  "home.loop.remediate": "Remediate",
  "home.loop.challenge": "Challenge",
  "home.loop.measure": "Measure",
  "home.loop.review": "Review",

  "home.feature.learnLoop.title": "LearnLoop",
  "home.feature.learnLoop.text":
    "Every answer feeds the loop. NimiqLearn continuously decides what you know, what you misunderstand, and what you should do next.",
  "home.feature.explainBack.title": "ExplainBack",
  "home.feature.explainBack.text":
    "Explaining a concept is the strongest test of understanding. The AI evaluates your explanation and finds the gaps you didn't know you had.",
  "home.feature.forgetMeNot.title": "ForgetMeNot",
  "home.feature.forgetMeNot.text":
    "Transparent spaced review. The app schedules reinforcement from your mastery, recency, and recent mistakes — no magic, no guessing.",
  "home.feature.economy.title": "Learning Economy",
  "home.feature.economy.text":
    "Premium packs, unlocked directly with NIM through Nimiq Pay. Educators get paid instantly — no middlemen, no custodial wallets.",

  "home.story.eyebrow": "Why NimiqLearn exists",
  "home.story.title": "Two connected problems. One learning economy.",
  "home.story.edu.title": "The educational problem.",
  "home.story.edu.body":
    "Most platforms flood you with content but never understand what you actually know, which misconception is blocking you, or what needs reinforcement next.",
  "home.story.web3.title": "The Web3 problem.",
  "home.story.web3.body":
    "Independent educators lack a simple, native way to monetize small learning experiences and receive direct payments.",
  "home.story.combine.title": "NimiqLearn combines",
  "home.story.combine.body":
    "AI personalization with direct educational payments through Nimiq Pay — an adaptive learning marketplace where great teaching gets paid.",
  "home.story.browse": "Browse the marketplace",
  "home.story.wallet": "Wallet & payments",
  "home.story.imageAlt": "A student reading in a modern library aisle",

  "home.pick.eyebrow": "Start anywhere",
  "home.pick.title": "Pick a concept and explain it back",
  "home.pick.allTopics": "+ all topics",
  "home.finalCta": "Start Learning — it's free",

  /* ---------------- AI status badge ---------------- */
  "aiStatus.checking": "Checking\u2026",
  "aiStatus.ready": "Ready",
  "aiStatus.unavailable": "Unavailable",
  "aiStatus.checking.title": "Checking whether AI grading is reachable\u2026",
  "aiStatus.ready.title": "AI grading is configured and reachable.",
  "aiStatus.unavailable.title":
    "AI grading isn't reachable right now — the built-in assessment engine is used instead.",

  /* ---------------- next challenge ---------------- */
  "challenge.eyebrow": "Next challenge",
  "challenge.fallback": "Can you explain {topic} again with an example?",
  "challenge.take": "Take the challenge \u2192",

  /* ---------------- progress card ---------------- */
  "progress.title": "Your learning state",
  "progress.sub": "Application-calculated from your activity — updated after every interaction.",

  /* ---------------- unlock history ---------------- */
  "history.title": "Your unlocks",
  "history.sub": "Purchases you've made through the Learning Economy.",
  "history.empty": "No packs unlocked yet. Browse the marketplace to get started.",
  "history.confirmed": "Confirmed",

  /* ---------------- crash screen ---------------- */
  "error.title": "Something went wrong",
  "error.body":
    "The interface hit an unexpected error. Your progress is safe — this is a display issue, not a learning or payment issue.",
  "error.recover": "Try to recover",
  "error.reload": "Reload app",

  /* ---------------- relative dates ---------------- */
  "date.never": "Never",
  "date.today": "Today",
  "date.yesterday": "Yesterday",
  "date.daysAgo_one": "{count} day ago",
  "date.daysAgo_other": "{count} days ago",
  "date.notScheduled": "Not scheduled",
  "date.dueNow": "Due now",
  "date.tomorrow": "Tomorrow",
  "date.inDays_one": "In {count} day",
  "date.inDays_other": "In {count} days",

  /* ---------------- concept detail panel ---------------- */
  "detail.mastery": "Mastery",
  "detail.confidence": "Confidence",
  "detail.confidence.title": "How much evidence backs the mastery estimate — separate from mastery itself.",
  "detail.recent": "Recent performance",
  "detail.recent.aria": "{correct} correct of last {total}",
  "detail.noAttempts": "No attempts yet",
  "detail.nextReview": "Next review",
  "detail.lifetime": "Lifetime record",
  "detail.record": "{correct} correct / {incorrect} incorrect",
  "detail.explain": "Explain",
  "detail.practice": "Practice",
  "detail.review": "Review",

  "common.yes": "YES",
  "common.no": "NO",

  /* ---------------- explanation result ---------------- */
  "result.byAI": "Generated by NimiqLearn AI",
  "result.byFallback": "AI was unavailable — built-in fallback used",
  "result.understanding": "Understanding",
  "result.strengths": "You understand",
  "result.strengths.empty": "No clear strengths captured yet.",
  "result.missing": "Still developing",
  "result.missing.empty": "Nothing missing — strong coverage.",
  "result.misconceptions": "Watch for this",
  "result.misconceptions.empty": "No misconceptions detected.",

  /* ---------------- knowledge node ---------------- */
  "node.dueTitle": "Due for review",
  "node.aria": "{name}, {status}{due}. Click to study.",
  "node.aria.due": ", due for review",
  "node.fixThis": "Fix this",
  "streak.levelAria": "Level progress {pct} percent",

  /* ---------------- payment receipt ---------------- */
  "receipt.product": "Product",
  "receipt.amount": "Amount",
  "receipt.hash": "Transaction hash",
  "receipt.status": "Status",
  "receipt.datetime": "Date/time",

  /* ---------------- wallet status (shared) ---------------- */
  "wallet.connecting": "Connecting...",
  "wallet.usdtComingSoon": "Coming soon (Nimiq Pay EVM)",
  "wallet.walletConnected": "Wallet connected",
  "wallet.connFailed": "Connection failed",
  "wallet.connFailedDot": "Connection failed.",
  "wallet.notAvailable": "Not available",
  "wallet.cancelled": "Connection cancelled. Nothing was shared, and no account was connected.",
  "wallet.address": "Address",
  "wallet.copyAddress": "Copy address",
  "wallet.copy": "Copy",
  "wallet.copied": "Copied",
  "wallet.disconnect": "Disconnect",

  /* ---------------- Nimiq wallet ---------------- */
  "nwallet.title": "Your Nimiq wallet",
  "nwallet.sub": "Wallet state is handled by application code — the AI never sees it.",
  "nwallet.authenticated": "Wallet authenticated",
  "nwallet.detected": "Nimiq Pay detected",
  "nwallet.browserNotice":
    "Open NimiqLearn in Nimiq Pay to connect your wallet. This browser environment is useful for UI testing but cannot prove the real wallet flow.",
  "nwallet.networkReady": "Network ready",
  "nwallet.networkWaiting": "Waiting for network\u2026",
  "nwallet.balance": "NIM balance",
  "nwallet.balanceUnavailable": "Balance unavailable in this Mini App provider.",
  "nwallet.balanceHint": "See Wallet diagnostics for why — no balance query method is exposed.",
  "nwallet.blockNumber": "Block number",
  "nwallet.connect": "Connect Nimiq Pay",
  "nwallet.signIn": "Sign in with Nimiq Pay",
  "nwallet.signInRejected": "Sign-in was rejected.",

  /* ---------------- EVM wallet ---------------- */
  "ewallet.title": "Your EVM wallet (USDT)",
  "ewallet.sub": "A separate connection from your Nimiq wallet above — used only for USDT payments.",
  "ewallet.detected": "Ethereum provider detected",
  "ewallet.chainId": "Active chain ID",
  "ewallet.browserMode": "Open NimiqLearn in Nimiq Pay to connect an EVM wallet for USDT payments.",
  "ewallet.connect": "Connect EVM wallet",
  "ewallet.disconnectNote":
    "Disconnecting only clears this app's local state — revoke NimiqLearn's access from within Nimiq Pay itself to fully disconnect.",

  "knowledge.mapSub": "Your live understanding across the curriculum. Weak nodes pulse — click one to fix it.",

  "knowledge.mapNote":
    "Statuses are computed by the app from your evaluations, activity results, and reviews — not by the AI.",

  /* ---- Curriculum: the 37 topic names and one-line descriptions.
     These mirror src/data/mockTopics.js, which stays English as the
     source of truth; tOr() prefers a catalogue entry and falls back
     to that source, so a locale missing a topic shows English rather
     than a key. ---- */
  "topic.math.name": "Mathematics",
  "topic.math.description": "From equations to proofs — build a rigorous math foundation.",
  "topic.algebra.name": "Algebra",
  "topic.algebra.description": "The language of patterns and unknown quantities.",
  "topic.linear-equations.name": "Linear equations",
  "topic.linear-equations.description": "Solve equations of the form ax + b = c.",
  "topic.quadratics.name": "Quadratics",
  "topic.quadratics.description": "Parabolas, factoring, and the quadratic formula.",
  "topic.functions.name": "Functions",
  "topic.functions.description": "Mappings, domain & range, and function notation.",
  "topic.inequalities.name": "Inequalities",
  "topic.inequalities.description": "Comparing quantities and why dividing by a negative flips the sign.",
  "topic.exponents.name": "Exponents & powers",
  "topic.exponents.description": "Repeated multiplication, exponent laws, and scientific notation.",
  "topic.geometry.name": "Geometry",
  "topic.geometry.description": "Shapes, space, and the logic of proofs.",
  "topic.angles.name": "Angles",
  "topic.angles.description": "Complementary, supplementary, and parallel-line angles.",
  "topic.proofs.name": "Proofs",
  "topic.proofs.description": "Constructing logical two-column geometric proofs.",
  "topic.pythagorean-theorem.name": "Pythagorean theorem",
  "topic.pythagorean-theorem.description": "a² + b² = c² and how to find a missing side.",
  "topic.circles.name": "Circles & area",
  "topic.circles.description": "Radius, diameter, circumference, and area of a circle.",
  "topic.statistics.name": "Statistics & Probability",
  "topic.statistics.description": "Summarising data and reasoning about uncertainty.",
  "topic.descriptive-stats.name": "Mean, median & mode",
  "topic.descriptive-stats.description": "Three ways to describe the centre of a data set.",
  "topic.probability-basics.name": "Probability basics",
  "topic.probability-basics.description": "Measuring how likely an event is, from 0 to 1.",
  "topic.science.name": "Science",
  "topic.science.description": "The laws behind motion, matter, and life.",
  "topic.physics.name": "Physics",
  "topic.physics.description": "Force, motion, energy, and how the universe behaves.",
  "topic.newtons-second-law.name": "Newton's second law",
  "topic.newtons-second-law.description": "F = ma — how force, mass, and acceleration relate.",
  "topic.energy-work.name": "Energy & work",
  "topic.energy-work.description": "Kinetic and potential energy, and the work-energy theorem.",
  "topic.waves-sound.name": "Waves & sound",
  "topic.waves-sound.description": "Frequency, wavelength, and how sound travels.",
  "topic.electricity-basics.name": "Electricity basics",
  "topic.electricity-basics.description": "Current, voltage, resistance, and Ohm's law.",
  "topic.chemistry.name": "Chemistry",
  "topic.chemistry.description": "What matter is made of and how it combines.",
  "topic.atoms-elements.name": "Atoms & elements",
  "topic.atoms-elements.description": "Protons, neutrons, electrons, and the periodic table.",
  "topic.chemical-bonding.name": "Chemical bonding",
  "topic.chemical-bonding.description": "Ionic and covalent bonds, and why atoms bond at all.",
  "topic.biology.name": "Biology",
  "topic.biology.description": "The machinery of living things.",
  "topic.cell-structure.name": "Cell structure",
  "topic.cell-structure.description": "Organelles and the division of labour inside a cell.",
  "topic.dna-genetics.name": "DNA & genetics",
  "topic.dna-genetics.description": "How traits are stored, copied, and inherited.",
  "topic.cs.name": "Computer Science",
  "topic.cs.description": "Programming, algorithms, and the ideas behind modern AI.",
  "topic.programming.name": "Programming",
  "topic.programming.description": "Write code, reason about algorithms, debug like a pro.",
  "topic.python-basics.name": "Python basics",
  "topic.python-basics.description": "Variables, loops, conditionals, and functions.",
  "topic.ai-fundamentals.name": "AI fundamentals",
  "topic.ai-fundamentals.description": "What models are, training data, and inference.",
  "topic.data-structures.name": "Data structures",
  "topic.data-structures.description": "Arrays, dictionaries, stacks, and when to use each.",
  "topic.recursion.name": "Recursion",
  "topic.recursion.description": "Functions that call themselves, and the base case that stops them.",
  "topic.big-o-notation.name": "Big-O notation",
  "topic.big-o-notation.description": "Describing how an algorithm scales as input grows.",
  "topic.web-data.name": "Web & Data",
  "topic.web-data.description": "How data is stored and how the web actually works.",
  "topic.sql-databases.name": "SQL & databases",
  "topic.sql-databases.description": "Tables, queries, and asking a database questions.",
  "topic.how-web-works.name": "How the web works",
  "topic.how-web-works.description": "Requests, responses, DNS, and what happens when you open a page.",
};
