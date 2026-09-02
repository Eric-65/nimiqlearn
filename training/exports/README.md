# Model export contract

**ExplainBack has a real trained artifact** — `explainback/model.json`
(TF-IDF + Ridge regressor) and `explainback/classifier.json` (TF-IDF +
LogisticRegression classifier), both trained on the real Automatic Short
Answer Grading (Mohler) dataset, obtained via a public GitHub mirror
since Kaggle itself is unreachable from this sandbox — see
`explainback/README.md`, "Real run", for the full provenance and real
evaluation numbers. Both are copied into the live app at
`nimiqlearn-ai-educational-app/src/data/models/` and wired into
`src/services/assessmentService.js` via
`src/services/explainBackTrainedModel.js`.

**Learner-state has no real artifact yet** — see "Demo exports" below.
Riiid's dataset is Kaggle-competition-gated with no open mirror of the
raw data, so this remains synthetic-only.

This document defines what a trained artifact must provide before it is
wired behind `src/services/assessmentService.js` or
`src/services/learnerStateService.js` — so the app-facing interface
never has to change when a real model replaces a baseline.

## Demo exports (synthetic data — superseded for ExplainBack)

`explainback/SYNTHETIC_DEMO_model.json` and
`learner_state/SYNTHETIC_DEMO_model.json` were both trained on synthetic
stand-in data (see the "Demo run" section in each pipeline's README),
before real data was available. They exist to prove
`scoreExplainBack.js` / `scoreLearnerState.js` actually work as pure-JS
scorers with no ML runtime dependency. `explainback/SYNTHETIC_DEMO_model.json`
is now superseded by the real `explainback/model.json` above and is kept
only for reference; `learner_state/SYNTHETIC_DEMO_model.json` remains the
only learner-state export that exists.

**Export verification**: for every export (synthetic or real), a handful
of held-out predictions from the Python model are compared against the
same inputs scored by the JS reference file — bit-for-bit match (diff
0.000000) is the bar, verified for the real ExplainBack regressor and
classifier exports (see `explainback/README.md`) the same way it was for
the earlier synthetic demo exports. Re-run this any time a `model.json`
or `classifier.json` is regenerated from different data or a different
scikit-learn version, since floating-point/tokenizer edge cases could in
principle change the result.

The generic filenames `model.json`/`classifier.json` (what
`export_model.py`/`export_classifier.py` write by default) are
gitignored inside `training/exports/` itself — the real production
artifact copies live in the app's `src/data/models/`, which IS committed
(that's what actually ships).

## ExplainBack assessment model

- **Input**: `{ question, referenceAnswer, learnerExplanation }` (raw text)
  or a pre-tokenized equivalent.
- **Output**: `{ score }` in `[0, 1]` (mapped to `masteryEstimate` 0-100 by
  the caller), matching the `normalizedScore` target used in
  `../explainback/train.py`.
- **Format**: must be loadable via `@huggingface/transformers` in the
  browser (ONNX) or, if small enough, a pure-JS scoring function bundled
  directly — no server-side inference.
- **Size budget**: comparable to or smaller than the existing SmolLM2
  weights (~118 MB) so total app weight doesn't regress; a linear/TF-IDF
  baseline like `../explainback/train.py` produces is a few MB at most and
  is the preferred first target.
- **Load location**: `/models/explainback/` once it exists. Do not create
  this path with placeholder content — it should appear only alongside a
  real, working artifact and the loader code that consumes it.

## Learner-state model

- **Input**: `{ recentCorrectness, attemptCount, timeSinceReview, topicMastery, recentFailures }`
  — exactly the shape `src/services/learnerStateService.js`'s
  `predictLearnerState()` already accepts.
- **Output**: `{ probabilityCorrect, reviewPriority, recommendedDifficulty }`
  — note `reviewPriority` and `recommendedDifficulty` remain informed by
  `forgetMeNotService.js` / `learningThresholds.js` even after a trained
  model exists; a trained model should only ever replace the
  `probabilityCorrect` estimate, never the scheduling decision.
- **Format**: ONNX, loadable via `onnxruntime-web` or
  `@huggingface/transformers`, or (preferred for a first version) a small
  set of learned coefficients (as produced by `LogisticRegression`) that
  can be evaluated with plain JS arithmetic — no runtime dependency needed
  at all for something this small.
- **Load location**: `/models/learner-state/` once it exists, same caveat
  as above — no fake placeholder files.

## Before wiring either model in

1. Run the matching `evaluate.py` and confirm it beats the current
   deterministic baseline on the metrics in `../evaluation/README.md`.
2. Update `ASSESSMENT_SOURCE.TRAINED` (`"trained-assessment-model"`, already
   reserved in `assessmentService.js`) to actually be reachable, behind a
   flag, so it can be compared side-by-side with the baseline before fully
   replacing it.
