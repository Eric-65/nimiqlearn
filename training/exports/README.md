# Model export contract

No artifact trained on the real datasets is exported yet — see "Demo
exports" below for what actually exists in this directory right now.
This document defines what a trained artifact must provide before it is
wired behind `src/services/assessmentService.js` or
`src/services/learnerStateService.js` — so the app-facing interface
never has to change when a real model replaces a baseline.

## Demo exports (synthetic data — read before trusting anything else here)

`explainback/SYNTHETIC_DEMO_model.json` and
`learner_state/SYNTHETIC_DEMO_model.json` are committed, but both were
trained on synthetic stand-in data (see the "Demo run" section in each
pipeline's README) — this environment's network egress proxy blocks
`kaggle.com`, so no real Kaggle data has been trained on yet. They exist
only to prove `scoreExplainBack.js` / `scoreLearnerState.js` actually
work as pure-JS scorers with no ML runtime dependency.

**Export verification**: for both, 5 held-out predictions from the
Python model were compared against the same inputs scored by the JS
reference file — bit-for-bit match (diff 0.000000) in both cases at
export time. That verification should be re-run (score a handful of
`test.jsonl` rows both ways and diff) any time `model.json` is
regenerated from a different dataset or a different scikit-learn
version, since floating-point/tokenizer edge cases could in principle
change the result.

The generic filename `model.json` (what `export_model.py`/`export.py`
write by default) is gitignored — it's the real production artifact
location, to be filled in once a real training run happens. Only the
`SYNTHETIC_DEMO_*` files are checked in.

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
