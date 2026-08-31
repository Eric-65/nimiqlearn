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
  runs first; if SmolLM2 is ready, the baseline is fed to it as a compact
  signal and its prose becomes the natural-language feedback. Mastery is
  never solely the model's — see "Mastery calculation" below.
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
  LLM — SmolLM2 only ever generates review *content* (see `ForgetMeNot.jsx`
  → `generateActivityContent`).

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
