# NimiqLearn — Learning Engine

This document is the audit and reference for how the educational engine
actually works: ExplainBack → Learner State → Knowledge Map → ForgetMeNot
→ LearnLoop. It was written by tracing the real code, not by describing
the intended design — where a gap existed, it's called out explicitly
below rather than assumed away.

## The headline finding

**The pipeline was already connected**, contrary to the working
assumption that these were isolated demo screens. `LearnerContext.jsx`
is the one canonical learner-state store; ExplainBack, Learn, ForgetMeNot,
and Knowledge Map all read and write through it, not through separate
local state. What this pass added: the schema fields the contract asked
for that genuinely didn't exist yet (`confidence`, lifetime attempt
counters, schema versioning), explicit `calculateReviewPriority()` /
`calculateNextReview()` functions, a real UI gap (tapping a Knowledge Map
node did nothing but navigate away, with no detail view) — and, in the
course of building `calculateReviewPriority()`, an actual pre-existing
bug that had made review-priority scores meaningless (see below).

## Data flow diagram

```
 ExplainBack.jsx (submit)
        │
        ▼
 LearnerContext.evaluateExplanationAction()          ◄── the ONE place
        │  1. validateInput                              this whole
        │  2. assessmentService.evaluateExplanation()     pipeline runs
        │  3. knowledgeService.updateKnowledgeAfterEvaluation()
        │  4. (same step — see "one canonical state" below)
        │  5. forgetMeNotService.computeReviewRecommendation()
        │  6. learnLoopService.decideNextActivity()
        ▼
 { evaluation, updatedEntry, reviewRecommendation, nextDecision }
        │
        ├──► setLearner(...)  →  localStorage (debounced, versioned)
        │                              │
        │                              ▼
        │                     learner.knowledge (canonical state)
        │                              │
        │              ┌───────────────┼───────────────┐
        │              ▼               ▼               ▼
        │        Knowledge.jsx   ForgetMeNot.jsx    Learn.jsx
        │        (KnowledgeMap)  (buildReviewQueue)  (decideNextActivity
        │                                             + generateActivityContent)
        ▼
 ExplainBack.jsx renders the returned reviewRecommendation/nextDecision
 directly — it does not recompute them from a separate local copy.
```

`recordActivityResult` (Learn.jsx, a practice question) and `recordReview`
(ForgetMeNot.jsx, a spaced review) are the other two entry points into the
same `learner.knowledge` tree — see the per-service table below.

## Services: input → processing → output

### `assessmentService.js` (ExplainBack assessment, Layer 2)
- **Input**: `{ topic, referenceAnswer?, learnerExplanation, learnerLevel, preferAI }`
- **Processing**: deterministic rubric baseline (`computeRubricBaseline`) always
  runs first; the baseline is then fed to NimiqLearn AI (OpenAI, via
  `/api/assess/feedback`) as a compact signal, and its prose becomes the
  natural-language feedback. The score itself is NOT the model's: the
  backend overwrites `masteryEstimate` with the deterministic rubric score
  server-side, because a prompt instruction is not a guarantee. See
  "Mastery calculation" below.
- **Output** (the ExplainBack result contract): `{ conceptId, score,
  masteryEstimate, strengths, missingConcepts, misconceptions, feedback,
  nextAction, nextChallenge, source, confidence: "model"|"heuristic", aiPending, note }`.
  `conceptId` and `feedback` were added this pass; everything else already existed.

### `knowledgeService.js` (canonical learner state — mutations)
- **Input**: the current knowledge entry for one concept + either an
  assessment result, an activity result (`{correct}`), or a review result.
- **Processing**: `updateKnowledgeAfterEvaluation` / `applyActivityResult` /
  `recordReview` each update `mastery` (clamped 0-100) and now also call
  the shared `recordEvidence()` helper, which maintains
  `correctAttempts`/`incorrectAttempts`/`attempts`/`lastStudiedAt` and
  recomputes `confidence` — added this pass, previously these fields did
  not exist on the entry at all.
- **Output**: the updated knowledge entry, always run through
  `withReviewPriority()` before being returned, so `reviewPriority` and
  `nextReviewAt` are never stale relative to the mastery/attempt change
  that just happened.

**Mastery calculation** (documented weights, unchanged this pass):
`mastery = 0.55 × AI/heuristic estimate + 0.45 × previous mastery − 4 × recentFailures`,
clamped to 0-100. The AI is never the sole authority — see
`src/services/assessmentService.js#computeRubricBaseline` for the
deterministic half of every ExplainBack score.

**Confidence** (new this pass, `calculateConfidence()`): `70% evidence
volume (saturating at 8 attempts) + 30% evidence consistency (how much
recent results agree with each other)`. Deliberately separate from
mastery — a single great answer scores confidence ~39, not ~100, because
volume is low even though that one attempt is fully consistent with
itself; many consistent attempts approach 100. See the function's own
comment in `knowledgeService.js` for the full worked explanation.

### `forgetMeNotService.js` (review scheduling)
- **Input**: a knowledge entry (`mastery`, `status`, `lastReviewedAt`,
  `reviewCount`, `recentPerformance`).
- **Processing**: `calculateReviewPriority(entry, now)` — 0-1 normalized,
  documented weights (40% mastery gap, 30% overdue time, 20% recent
  failures, −10% review stability). `calculateNextReview(entry, now)` —
  deterministic interval that grows with status and review count. Both
  are new, explicitly-named functions extracted from what was previously
  one inline function; `computeReviewRecommendation()` now calls both and
  keeps its original return shape so no existing caller had to change.
- **Output**: `{ priorityScore (0-100), dueNow, intervalDays,
  recommendedReviewAt, nextReviewAt, levelLabel }`. Never decided by the
  LLM — NimiqLearn AI only ever generates review *content* (see
  `ForgetMeNot.jsx` → `generateActivityContent`).

**Bug found and fixed while extracting `calculateReviewPriority()`**: the
previous single implementation computed a weighted sum on a 0-100 scale
but then ran it through a helper called `clamp01` that actually clamped
to **[0, 1]** — silently collapsing `priorityScore` to almost always
exactly `0` or `1` instead of a real 0-100 spread. Concretely, on the
seeded demo data this produced scores of `0` or `1` for every concept;
after the fix, the same data produces `0, 9, 18, 26, 45, 70` — a real,
usable spread (verified by running both versions against
`INITIAL_LEARNER.knowledge` directly). Every UI threshold that reads
`priorityScore` (ForgetMeNot's badge tone, LearnLoop's `REVIEW` branch,
`learnerStateService`'s `recommendedAction`) was silently non-functional
until this fix — none of them ever saw a score above 1.

### `learnLoopService.js` (next-activity decision)
- **Input**: `{ topic, knowledge, history, reviewDue, reviewPriority, studyMinutes }`.
- **Processing**: unchanged this pass — a rule ladder over mastery bands
  (see `src/config/learningThresholds.js`), reporting which tier fired
  via `decision.tier` (added in Prompt 7) so nothing downstream has to
  re-derive it.
- **Output**: `{ activityType, reason, tier, targetMisconception?, nextTopic? }`,
  now returned to the UI via `LearnerContext.evaluateExplanationAction`'s
  `nextDecision` rather than being recomputed separately in `ExplainBack.jsx`.

### `LearnerContext.jsx` (the one canonical learner state)
- **Persistence**: `localStorage["nimiqlearn:learner:v1"]`, debounced
  250ms, containing the whole learner object including `knowledge: []`.
  Never stores wallet/payment data — that lives entirely in
  `nimiqService.js`'s own in-memory state, untouched by this file.
- **Schema version** (new this pass): `LEARNER_STATE_SCHEMA_VERSION = 1`
  in `mockLearner.js`. `migrateLearnerState()` upgrades any persisted
  blob with no `version` (or an older one) by deriving
  `correctAttempts`/`incorrectAttempts` from the existing
  `recentPerformance` array and computing `confidence`/`lastStudiedAt`
  from what's already there — an existing user's data is never discarded,
  only filled in. Runs once, in `loadPersisted()`, before the blob is
  ever used.
- **Rolling history caps**: `recentPerformance` per concept is capped at
  8 entries (`.slice(-8)`); the app-wide activity `history` log is capped
  at 60 (`.slice(0, 60)`); the separate `eventLogService.js` log (Prompt
  5/6) is capped at 300. None of these grow unbounded.

## The canonical learner-state schema

`topicId` **is** the concept identifier throughout this app — there is
deliberately no separate `conceptId` field on the stored entry (that
would be the exact kind of duplicated state this document is meant to
prevent). Where an external contract calls for `conceptId` (the
ExplainBack result object), it's populated from this same `topicId`.

```js
{
  topicId,              // = conceptId
  topicName,
  mastery,               // 0-100, blended AI + heuristic + history
  confidence,            // 0-100, SEPARATE from mastery — evidence volume + consistency
  status,                // NEW | LEARNING | DEVELOPING | STRONG | MASTERED
  attempts,              // = correctAttempts + incorrectAttempts (lifetime)
  correctAttempts,
  incorrectAttempts,
  recentPerformance,     // rolling window, most recent last, capped at 8
  reviewCount,
  reviewPriority,        // 0-100, always derived — see forgetMeNotService.js
  lastEvaluatedAt,       // last ExplainBack evaluation
  lastReviewedAt,        // last ForgetMeNot review
  lastStudiedAt,         // last interaction of ANY kind (max of the above two,
                         // or an activity-result timestamp)
  nextReviewAt,          // always derived, never hand-set
  recommendedReviewAt,   // same value as nextReviewAt — kept for existing callers
  strengths, missingConcepts, misconceptions,  // capped lists, deduped
}
```

## Knowledge Map

`Knowledge.jsx` / `KnowledgeMap.jsx` / `KnowledgeNode.jsx` already read
directly from the canonical `knowledge` array — no separate map-specific
state existed to audit. Status labels use plain language (New, Learning,
Developing, Strong, Mastered) — no "brain state" or similar terminology
appears anywhere in this codebase (checked).

**Gap found and fixed**: tapping a node previously called `onSelect` →
immediately navigated to the Learn page, with no way to see mastery,
confidence, recent performance, last studied, next review, or a choice of
action first. Added `ConceptDetail.jsx` (Prompt 8) — a modal, opened on
tap, showing all of the above plus four action buttons (Learn, Explain,
Practice, Review); "Learn" and "Practice" both route to the Learn page
since LearnLoop is this app's single adaptive activity stream, not two
separate systems — labeling them separately still gives the learner the
vocabulary the product spec asks for.

## ForgetMeNot UI

Already shows a due-now count, a full priority-sorted queue ("Needs
attention" is expressed via status badges + the priority queue rather
than a separately-labeled list, but the underlying data and sort order
match Prompt 8 section 15's intent), and a visible, humanly-readable
explanation of how priority is computed. Un-changed structurally this
pass — the fix that mattered here was making the underlying
`priorityScore` numbers actually meaningful (see the bug above).

## Known limitations

- `attempts` is stored as a literal field (`correctAttempts + incorrectAttempts`)
  rather than computed on read, to match the contract's example shape
  exactly. It is only ever written by `recordEvidence()`, so it cannot
  drift from the two counters it mirrors — but this is a deliberate,
  documented trade-off, not a discovered accident.
- ExplainBack's classification of "was this evaluation positive evidence"
  (score ≥ 50) is a judgment call, not something carried over from
  existing code — it did not need to exist before `correctAttempts`/
  `incorrectAttempts` did.
- The review queue includes never-studied (`NEW`, 0% mastery) concepts,
  which can show a high priority score despite having nothing to
  "forget" yet. This is pre-existing behavior (not changed this pass) —
  flagged here because it's the kind of thing this document exists to
  surface, not because it was fixed.


---

# The mastery model, the coach, and Study Sprints

Added in the AI Mastery Coach work. Everything above still stands — this
layer sits on top of it and changes nothing about how mastery, review
priority or activity selection are computed.

## Mastery stages (`src/services/masteryService.js`)

```
NEW → LEARNING → CAN_RECALL → CAN_EXPLAIN → CAN_APPLY → MASTERED
```

A stage says what the learner can DO, and each one has to be unlocked by
evidence of that specific kind. The mastery *number* cannot unlock a stage
on its own: four lucky multiple-choice guesses raise it, and no number of
them shows somebody can explain an idea to another person.

`REVIEW_DUE` is in the product brief's list but is deliberately not a
stage — it is orthogonal. A concept at CAN_APPLY that is due for review is
still CAN_APPLY; demoting it would be a claim the evidence contradicts.
`displayStage()` surfaces "review due" for the UI while the real stage
stays underneath.

### The evidence ledger

Every knowledge entry carries `evidence[]`, appended by knowledgeService's
three state transitions so no caller can forget to record one:

| Activity | Evidence kind | Unlocks |
|---|---|---|
| MULTIPLE_CHOICE, SHORT_EXPLANATION, ANALOGY, EXAMPLE | `RECALL` | CAN_RECALL |
| OPEN_RESPONSE, EXPLAIN_BACK | `EXPLAIN` | CAN_EXPLAIN |
| PRACTICE | `APPLY` | CAN_APPLY |
| REVIEW | `REVIEW` | MASTERED (2 passed + mastery ≥ 85) |

**Watching a video unlocks nothing.** A video is input, not evidence.

Stages are monotonic: a later wrong answer lowers the mastery estimate and
can make a review due, which is how forgetting is represented, but "you
explained this correctly on Tuesday" stays true on Wednesday. MASTERED is
the one exception, because its definition includes a live mastery
threshold.

### Migration (v2 → v3)

`upgradeToEvidenceLedger()` in LearnerContext. Old profiles recorded only
counters — how many attempts were right, not what they demonstrated. The
migration claims the least the old data supports: each correct attempt
becomes one `RECALL` marked `inferred`, a stored ExplainBack evaluation
becomes one `EXPLAIN`. **Nothing is ever inferred as APPLY**, so CAN_APPLY
has to be re-earned. That is one deliberate, visible demotion in exchange
for never overstating what somebody has shown.

## The coach (`src/services/coachService.js`)

`recommendNextAction()` answers one question across ALL concepts: which
concept, which activity, how long, and why. Nothing else in the app chose
*between* concepts — which is exactly the decision a learner should not
have to make.

Priority order, and the reason for it:

1. **A review that is due.** Forgetting is the only failure mode with a
   deadline. Only concepts the learner has actually studied are eligible —
   the review queue scores unopened entries too, and "you last worked on
   this yesterday" in front of something never opened is false.
2. **A misconception to repair.** A wrong idea contradicts what comes
   next, so it compounds.
3. **The concept closest to its next stage.** Momentum — a finished
   concept is worth more than three half-started ones.
4. **Something new.**

Every branch returns the evidence that triggered it, which is what the
"Why this?" affordance renders. The activity itself is delegated to
`learningLoopService.getNextLearningActivity()` → `decideNextActivity()`,
so no decision is re-implemented here.

### Adaptive difficulty

`difficultyFor(entry)` → `FOUNDATION | STANDARD | CHALLENGE`, from stage,
mastery and recent correctness together. Two wrong answers in the last
three force FOUNDATION regardless of mastery; CHALLENGE needs CAN_APPLY,
mastery ≥ 65 AND a clean recent run. One correct answer never raises it.
The level maps onto the `beginner|intermediate|advanced` the backend
prompt already understands.

## Study Sprint (`src/pages/StudySprint.jsx`)

One short, complete pass at a concept: lesson → retrieval → explanation →
what changed. **What it contains is not fixed** — the sprint includes only
the steps that serve the demonstration the concept needs next, so a
learner who can already recall something does not sit through the video,
and one who has never seen it is not asked to explain it back.

It ends with WHAT CHANGED, read off the ledger. A sprint where nothing
moved says so: a learner told "great progress!" after a wrong answer
learns to stop reading the screen.

## AI routes used

Unchanged, and all still server-side:

| Route | Used by | Purpose |
|---|---|---|
| `/api/tutor/health` | `useAiBackend` | is the backend up AND keyed |
| `/api/learn/activity` | Sprint, Learn, ForgetMeNot | generate the practice question |
| `/api/assess/feedback` | Sprint, ExplainBack | grade an explanation |
| `/api/tutor/feedback` | AI Tutor panel | critique an explanation |
| `/api/learn/question` | LessonQuestions | answer a question about a lesson |

`OPENAI_API_KEY` is read only in `api/_lib/openai.js` and `server/index.js`
(`process.env`). It is never prefixed `VITE_` and never reaches the
browser — verified against the built bundle.

## Onboarding & diagnostic (`src/services/onboardingService.js`)

Four taps, then an optional check. Every question asked in onboarding is
asked before the learner has seen anything work — the worst moment to ask
one — so each has to change what the app does next: goal picks the
curriculum branch, familiarity sets the starting difficulty, session length
defines a sprint. There is no name field because a name changes nothing.

Skipping is *recorded* (`onboardingSkippedAt`), because "never answered"
and "declined" must be different facts or the app asks again every reload.
A returning learner with real history is never shown it at all.

### Stating a goal ends the demo

An unsigned-in visitor starts on the demo profile "Alex", with invented
mastery so the app looks alive. The moment a learner states a goal, that
fiction stops being a showcase and becomes something the coach acts on —
it outranked a real goal and recommended reviewing a concept the learner
had never opened. So an untouched demo profile is cleared on `setGoal`,
exactly as `loadOrCreateWallet` already does for a real wallet. A profile
with real work on it is never touched.

### What a diagnostic answer means

One question per concept — five questions about quadratics tell you how
good somebody is at quadratics, which you were going to find out anyway;
one each across five concepts tells you where to start.

Every question asks twice: the answer, then "how sure were you?". The pair
is worth far more than the answer:

| Answer | Sure? | Recorded as | Why |
|---|---|---|---|
| Right | Yes | `RECALL` passed → **CAN_RECALL** | They know it. Never taught from scratch. |
| Right | No | mastery only, **no evidence** | A guess is indistinguishable from knowledge here. |
| Wrong | Yes | `RECALL` failed + **misconception** | The most useful answer in the exercise: a named wrong idea the coach repairs. |
| Wrong | No | `RECALL` failed | An ordinary gap. |

Written in one commit (`recordDiagnostic`), not one per answer: these are a
snapshot taken before any teaching, and pushing them through
`recordActivityResult` would put five activities in the history and award
XP for something nobody studied.

### Minimum review gap

`reviewableNow()` in coachService refuses to call a concept "due" within 6
hours of being studied, however the interval arithmetic scores it. Without
it, finishing the diagnostic produced "you last worked on this yesterday,
it is due for review" about five concepts answered seconds earlier — the
first recommendation a new learner ever sees, and plainly false.

## The mastery model in the UI

Both surfaces that answer "what do I know" now read the stage ladder.

### ForgetMeNot: three sections, not one ranked list

`buildReviewSections()` splits the queue:

| Section | What it is | Ordering |
|---|---|---|
| **Due now** | `isReviewable()` — studied, past the 6-hour floor, and due | misconception first, then priority |
| **Coming up** | studied and scheduled, not yet worth asking | soonest first |
| **Not started** | never opened — named, not listed | — |

The flat list this replaces ranked *every* concept by priority score,
including ones never opened. That put "review this" in front of material
the learner had never seen and made the page disagree with Today's Plan
about how many reviews were due. Both now apply the same `isReviewable()`
rule, which lives in forgetMeNotService because it owns scheduling.

Each row says **why** it is there — a misconception reads differently from
a faded memory and is not repaired the same way — and the reason is
section-aware: "about now is when it starts to fade" only appears under
Due now, because a row held back by the six-hour floor is in Coming up and
the section contradicts the sentence.

Prerequisites are **not** a factor. The brief lists "important
prerequisites" as a priority signal, and the curriculum has no prerequisite
edges — only sibling ordering. Inferring a dependency graph from ordering
would be a guess presented as a reason, so it is left out.

### Staleness now includes `lastStudiedAt`

`calculateReviewPriority` and `computeReviewRecommendation` fell back to
`now - 30 days` when an entry had no `lastReviewedAt` or `lastEvaluatedAt`.
A concept practised five hours ago has neither — it was not a review and
not an ExplainBack — so it was scored, and displayed, as a month stale.
`lastStudiedAt` is now in the chain; the 30-day fallback remains for an
entry genuinely never touched.

### Knowledge Map: stages, not bands

Nodes and the legend are coloured by `masteryStage`. "Can explain" and
"Developing" are different claims — one says what the learner
demonstrated, the other describes a number — and the map is where somebody
looks to answer "what do I actually know". The mastery percentage shows
only once something has been demonstrated, so an untouched concept reads
"Not started" rather than "Not started • 0%".

The clock badge uses the same `buildReviewSections()` output, so a node can
no longer read "Not started" and "⏳ Review" at once.

### Concept panel: the evidence behind the stage

Tapping a node shows the three demonstrations with ticks, read straight off
the ledger rather than inferred from the stage — so a concept that was
explained but never recalled displays honestly. Evidence reconstructed by
the v2→v3 migration is labelled "from earlier work" rather than counted.
Below it: the known misconception, and the one demonstration that would
move the concept up ("Next: explain it, to reach Can explain"). The primary
action is a sprint, because a sprint performs whichever demonstration is
missing.
