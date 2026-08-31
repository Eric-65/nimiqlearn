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

**Network note**: the environment this pipeline was built and tested in
has its network egress proxy blocking `kaggle.com` entirely — neither
dataset could be downloaded, nor could the Kaggle pages even be fetched
to re-verify column names/license live. `scripts/download_data.sh`
documents the download commands to run wherever you *do* have Kaggle
access; everything below was validated end-to-end against small,
clearly-labeled synthetic stand-ins instead (see each pipeline's "Demo
run" section) — real numbers are still pending a real download.

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
| `scripts/download_data.sh` | Manual, separate developer operation — never run by npm. Documents Kaggle CLI auth + download commands (no embedded credentials). |
| `data/raw/{explainback,learner_state}/` | Downloaded (or synthetic demo) raw CSVs. Gitignored. |
| `data/processed/{explainback,learner_state}/` | Normalized `train.jsonl`/`val.jsonl`/`test.jsonl` + `manifest.json` from each pipeline's prepare/split scripts. Gitignored. |
| `explainback/` | Offline pipeline: prepare → baseline → train → evaluate → export, for the ASAG dataset → ExplainBack assessment model |
| `learner_state/` | Offline pipeline: prepare → split → baseline → train → evaluate → export, for the Riiid dataset → learner-state model |
| `models/{explainback,learner_state}/` | Trained model checkpoints (`.joblib`). Gitignored. |
| `exports/` | Browser-compatible exports + the contract they must satisfy + committed synthetic-demo fixtures |
| `datasets/` | Dataset provenance, schema, and licensing |
| `evaluation/` | Metrics definitions + `reports/` — the real, generated (not hand-written) evaluation reports |

The React frontend never imports from `data/raw`, `data/processed`,
`models/`, or anything else under `training/` — it's a separate workspace
by construction, not just convention (there is no build-time wiring
between the two at all).

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

- **Phase 1** — deterministic ExplainBack baseline (rubric + similarity)
  + SmolLM2 natural-language feedback + deterministic learner-state
  engine. Implemented and shipped.
- **Phase 2** — the full prepare → baseline → train → evaluate → export
  pipeline for both datasets exists and runs end-to-end (`explainback/`,
  `learner_state/`), verified against small synthetic stand-ins because
  this environment cannot reach `kaggle.com`. **Not yet run against
  either real dataset.**
- **Phase 3** — run both pipelines against the real downloaded datasets,
  and record real numbers in `evaluation/reports/`, replacing the
  synthetic-data reports currently there.
- **Phase 4** — compare the real-data trained models against the Phase 1
  baselines using `evaluation/README.md`'s metrics. Only proceed past
  this point if a trained model actually beats its baseline.
- **Phase 5** — wire the winning trained model in behind
  `assessmentService.js` / `learnerStateService.js` (flipping `source`
  from `"deterministic-fallback"` to `"trained-assessment-model"`),
  using the JS reference scorers in `exports/` as the starting point —
  already verified to reproduce their Python models' predictions
  bit-for-bit on the synthetic demo run.

Do not report phases 3-5 as complete until they've actually happened
against real data — see each pipeline's README for exactly what has and
hasn't been run so far.
