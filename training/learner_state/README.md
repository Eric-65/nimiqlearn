# Learner-state training pipeline

Turns the Riiid Answer Correctness Prediction dataset into a leakage-safe
train/val/test split, a no-ML rolling-rate baseline, a trained
next-answer-correctness classifier, an honest evaluation report, and a
browser-compatible export that could eventually back
`src/services/learnerStateService.js`, which in turn feeds
`src/services/learningLoopService.js` (next-activity selection) and
`src/services/forgetMeNotService.js` (review prioritization):

```
Riiid Answer Correctness Prediction
        ↓
learner-state research (this directory)
        ↓
learner prediction model
        ↓
LearningLoop + ForgetMeNot
```

**Nothing in this directory runs in the browser.** It is a standalone
Python workspace, never invoked by `npm install` / `npm run dev` / `npm run build`.
This is explicitly NOT an LLM task — no language model is involved.

Before running anything here: read `../datasets/README.md` and confirm the
Riiid competition's current terms permit your intended use — dataset
access via Kaggle does not itself grant redistribution rights.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install pandas scikit-learn joblib
```

## Pipeline

```bash
# 1. Join the competition, then download the real data
#    (see ../scripts/download_data.sh and ../datasets/README.md):
../scripts/download_data.sh learner_state

# 2. Build per-attempt features using ONLY each learner's own prior
#    history (see AVOID DATA LEAKAGE below) — real column names verified
#    against the actual file header, not assumed
python3 prepare_riiid.py --input ../data/raw/learner_state/train.csv --output ../data/processed/learner_state/features.jsonl

# 3. Split by learner (never by row — see below)
python3 split_dataset.py --input ../data/processed/learner_state/features.jsonl --output-dir ../data/processed/learner_state

# 4. Baseline: the learner's own rolling correctness rate, no ML at all
#    (this is what src/services/learnerStateService.js already ships)
python3 baseline.py --input ../data/processed/learner_state/test.jsonl

# 5. Train the model (5 hand-engineered features -> logistic regression)
python3 train.py --data-dir ../data/processed/learner_state --model-out ../models/learner_state/logreg.joblib

# 6. Evaluate baseline vs. trained model on the held-out test split
python3 evaluate.py --data-dir ../data/processed/learner_state \
    --model ../models/learner_state/logreg.joblib \
    --report ../evaluation/reports/learner_state_eval.md

# 7. Export to JSON (trivial for a linear model — no ONNX needed)
python3 export.py --model ../models/learner_state/logreg.joblib --output ../exports/learner_state/model.json
```

`../data/raw/`, `../data/processed/`, and `../models/` are gitignored.

## No real dataset run yet

This environment's network egress proxy blocks `kaggle.com` entirely, so
the real Riiid data could not be downloaded or even browsed from here.
**Nobody has run this pipeline against the real dataset yet.** Run steps
1-7 above yourself, wherever you have real Kaggle access, to get real
numbers.

## Demo run (synthetic data, not the real dataset)

`make_synthetic_sample.py` generates a small, clearly-labeled SYNTHETIC
stand-in with the real Riiid column names (`user_id`, `content_id`,
`content_type_id`, `timestamp`, `answered_correctly`) and a simple
hidden per-learner skill that improves slowly over time, so there is
genuine (if simple) learnable structure:

```bash
python3 make_synthetic_sample.py --output ../data/raw/learner_state/SYNTHETIC_riiid_sample.csv --n-users 150 --interactions-per-user 60
```

Steps 2-7 were run against it end to end. Real, captured results:
`../evaluation/reports/learner_state_eval.md` (trained model ROC-AUC
0.561 vs. baseline ROC-AUC 0.553 — a small edge on this synthetic data,
nowhere near strong enough on its own to justify replacing the shipped
baseline; log loss improved more clearly, 0.68 vs. 1.31, meaning the
trained model's probabilities are much better calibrated even though raw
discrimination is close). **These numbers describe the synthetic demo
data only and say nothing about performance on the real dataset.** The
committed `../exports/learner_state/SYNTHETIC_DEMO_model.json` is that
demo run's export, kept so `scoreLearnerState.js` has something to run
against without re-running the pipeline — verified to reproduce the
Python model's predictions bit-for-bit (see `../exports/README.md`).

## Feature schema

`prepare_riiid.py` aggregates the raw interaction log (one row per
question a learner answered, in chronological order) into:

```json
{
  "learnerId": "...",
  "recentCorrectness": [1, 0, 1, 1],
  "attemptCount": 42,
  "recentFailures": 1,
  "topicMastery": 0.71,
  "timeSinceReviewMs": 86400000,
  "label_nextCorrect": 1
}
```

Every field is computed only from that learner's history strictly BEFORE
the attempt in `label_nextCorrect` — no feature ever looks at a future
answer. `recentCorrectness`/`topicMastery` use only the prior `WINDOW=8`
(or fewer, at the start of a learner's history) attempts, matching the
app's own `recentPerformance` ring buffer size.

## Avoid data leakage

Two separate leakage risks, both handled:

1. **Within a feature row** — `prepare_riiid.py` builds each row from
   only that learner's prior interactions, walking the log in timestamp
   order per user. The label (next answer's correctness) is never part
   of its own input features.
2. **Across the train/test split** — `split_dataset.py` groups by
   `learnerId`, not by row. A per-row random split would let the same
   learner's interactions appear in both train and test, which leaks
   that learner's overall skill level across the split and inflates
   apparent accuracy. The generated `manifest.json` records exactly how
   many learners landed in each split.

`label_nextCorrect` (probability the learner answers the next question
correctly) is the one, unchanging prediction target — see `train.py` /
`evaluate.py`, which both use it consistently.

## Status

No training run has been performed against the real dataset — only
against the synthetic demo data described above. The "Learning Priority"
score currently shown to learners is, and remains, the deterministic
baseline in `src/services/learnerStateService.js` — see
`../evaluation/README.md` for how a trained model here would be judged
against it before ever replacing it.
