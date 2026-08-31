# Learner-state training pipeline

Turns the Riiid Answer Correctness Prediction dataset into a baseline
next-answer-correctness classifier that could eventually back
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

**Nothing in this directory runs in the browser.**

Before running anything here: read `../datasets/README.md` and confirm the
Riiid competition's current terms permit your intended use — dataset
access via Kaggle does not itself grant redistribution rights.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install pandas scikit-learn
```

## Pipeline

```bash
# 1. Join the competition, then download train.csv (and
#    questions.csv/lectures.csv if you want richer features):
#    https://www.kaggle.com/competitions/riiid-test-answer-prediction/data
kaggle competitions download -c riiid-test-answer-prediction -p ./raw/
unzip ./raw/riiid-test-answer-prediction.zip -d ./raw/

python3 prepare_riiid.py --input ./raw/train.csv --output ./processed/features.jsonl

python3 train.py --input ./processed/features.jsonl --model-out ./checkpoints/riiid_logreg.joblib

python3 evaluate.py --model ./checkpoints/riiid_logreg.joblib --input ./processed/features.jsonl
```

`./raw/`, `./processed/`, and `./checkpoints/` are gitignored.

## Feature schema

`prepare_riiid.py` aggregates the raw interaction log (one row per
question a learner answered) into the feature set NimiqLearn's
`learnerStateService.js` already speaks:

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

`label_nextCorrect` is the held-out target (whether the learner's *next*
answer was correct) — the same shape as the Riiid competition's own
target column.

## Status

No training run has been performed. This is pipeline code only. The
"Learning Priority" score currently shown to learners is the deterministic
baseline in `src/services/learnerStateService.js` — see
`../evaluation/README.md` for how a trained model here would be judged
against it before ever replacing it.
