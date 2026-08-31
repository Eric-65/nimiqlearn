# NimiqLearn — Training Workspace

This directory is **completely separate from the production React app**
(`nimiqlearn-ai-educational-app/`). Nothing here is bundled into the
browser build. It exists to turn two Kaggle datasets into small, offline
artifacts that the app can eventually load.

```
Kaggle
 ↓
offline preprocessing   (prepare_dataset.py / prepare_riiid.py)
 ↓
training / evaluation   (train.py / evaluate.py)
 ↓
lightweight model artifact
 ↓
browser-compatible export   (exports/)
 ↓
NimiqLearn JavaScript   (src/services/assessmentService.js, learnerStateService.js)
 ↓
real learner
```

The production app runs today **without any of this having been trained**.
Its `assessmentService.js` and `learnerStateService.js` already implement
deterministic baselines that satisfy the exact interfaces a trained model
would eventually fill in — see `exports/README.md` for that contract.

## Official dataset sources

| Dataset | Kaggle link | Feeds |
|---|---|---|
| Automatic Short Answer Grading | [`mubeenfurqanahmed/automatic-short-answer-grading-dataset`](https://www.kaggle.com/datasets/mubeenfurqanahmed/automatic-short-answer-grading-dataset) | `explainback/` → ExplainBack assessment |
| Riiid Answer Correctness Prediction | [`riiid-test-answer-prediction`](https://www.kaggle.com/competitions/riiid-test-answer-prediction/data) | `learner_state/` → LearningLoop + ForgetMeNot |

Full provenance, schema, and licensing for both live in `datasets/README.md`.

```
Automatic Short Answer Grading Dataset          Riiid Answer Correctness Prediction
        ↓                                                ↓
ExplainBack assessment research                 learner-state research
        ↓                                                ↓
assessment model / rubric                       learner prediction model
        ↓                                                ↓
NimiqLearn ExplainBack                          LearningLoop + ForgetMeNot
```

The React application consumes only the resulting lightweight model
artifacts or derived parameters (`exports/`) — never the original Kaggle
datasets.

## Layout

| Path | Purpose |
|---|---|
| `explainback/` | Offline pipeline for the Automatic Short Answer Grading dataset → ExplainBack assessment model |
| `learner_state/` | Offline pipeline for the Riiid Answer Correctness Prediction dataset → learner-state model |
| `exports/` | Where trained artifacts land once exported to a browser-compatible format, plus the contract they must satisfy |
| `datasets/` | Dataset provenance, schema, and licensing |
| `evaluation/` | Shared metrics definitions for comparing a trained model against the deterministic baseline |

## Three intelligence layers in the running app

1. **SmolLM2-135M-Instruct** (`src/services/explainBackService.js`) — natural-language
   feedback, examples, next-challenge phrasing. Never stores learner state,
   never touches wallet/payment data, never decides scheduling.
2. **ExplainBack assessment** (`src/services/assessmentService.js`) — a rubric +
   text-similarity baseline today; the eventual home for a model trained
   in `explainback/`.
3. **Learner-state prediction** (`src/services/learnerStateService.js`) — a
   deterministic baseline today, informed by the *shape* of the Riiid
   dataset; the eventual home for a model trained in `learner_state/`.

Scheduling (`src/services/forgetMeNotService.js`) and activity selection
(`src/services/learningLoopService.js`) are, and will remain, plain
application logic — never delegated to a language model or a trained
classifier's raw output. They *consume* the layers above.

## Nimiq Pay separation

Wallet address, transaction history, payment amount, and transaction
metadata are never sent to any of the three intelligence layers, and never
appear in the event log (`src/services/eventLogService.js`) or in any
training data derived from real usage. Nimiq Pay (`src/services/nimiqService.js`,
`src/services/paymentService.js`) stays fully independent of the learning
engine.

## Roadmap

- **Phase 1 (current)** — deterministic ExplainBack baseline (rubric +
  similarity) + SmolLM2 natural-language feedback + deterministic
  learner-state engine. **This is the only phase actually implemented.**
- **Phase 2** — train a specialized ExplainBack assessment model offline,
  using `explainback/prepare_dataset.py` → `train.py` → `evaluate.py`.
- **Phase 3** — train a learner-state model offline using the Riiid
  dataset (`learner_state/prepare_riiid.py` → `train.py` → `evaluate.py`).
- **Phase 4** — export both models to an ONNX / browser-compatible format
  (`exports/`).
- **Phase 5** — integrate browser inference (transformers.js / onnxruntime-web)
  behind the existing `assessmentService.js` / `learnerStateService.js`
  interfaces, so no calling code changes.
- **Phase 6** — compare the trained model against the Phase 1 baseline
  using the metrics in `evaluation/README.md`, and only then flip the
  `source` a caller sees from `"deterministic-fallback"` to
  `"trained-assessment-model"`.

None of phases 2-6 are implemented. Do not report them as complete until
a real training run has produced a real, evaluated artifact.
