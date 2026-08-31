# ExplainBack training pipeline

Turns the Automatic Short Answer Grading dataset into (a) a normalized
evaluation set and (b) — once actually run — a trained assessment model
that can eventually replace/augment the rubric baseline in
`src/services/assessmentService.js`:

```
Automatic Short Answer Grading Dataset
        ↓
ExplainBack assessment research (this directory)
        ↓
assessment model / rubric
        ↓
NimiqLearn ExplainBack
```

**Nothing in this directory runs in the browser.** It is a standalone
Python workspace.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install pandas scikit-learn
```

## Pipeline

```bash
# 1. Download the dataset (see ../datasets/README.md for license terms —
#    CC BY 4.0, re-verify before redistribution/commercial use):
#    https://www.kaggle.com/datasets/mubeenfurqanahmed/automatic-short-answer-grading-dataset
kaggle datasets download -d mubeenfurqanahmed/automatic-short-answer-grading-dataset -p ./raw/ --unzip

# 2. Normalize it into the schema NimiqLearn uses everywhere
#    (use the actual CSV filename the download produced)
python3 prepare_dataset.py --input ./raw/*.csv --output ./processed/examples.jsonl

# 3. Train the baseline model (TF-IDF + linear regression on normalizedScore)
python3 train.py --input ./processed/examples.jsonl --model-out ./checkpoints/tfidf_ridge.joblib

# 4. Evaluate against the held-out split and the deterministic baseline
python3 evaluate.py --model ./checkpoints/tfidf_ridge.joblib --input ./processed/examples.jsonl
```

`./raw/`, `./processed/`, and `./checkpoints/` are gitignored — nothing
produced by this pipeline is committed automatically.

## Normalized schema

Raw ASAG columns (`question`, `model_answer`, `student_answer`,
`teacher_marks`, `total_marks`) become:

```json
{
  "topic": "photosynthesis",
  "question": "...",
  "referenceAnswer": "...",
  "learnerAnswer": "...",
  "score": 3,
  "maxScore": 5,
  "normalizedScore": 0.6
}
```

`topic` is not present in the raw dataset — `prepare_dataset.py` leaves it
`null` unless a topic-mapping file is supplied, since ASAG's questions
don't line up with NimiqLearn's curriculum. A trained model should key off
`question`/`referenceAnswer` text, not the topic id.

## Status

No training run has been performed. This is pipeline code only. See
`../README.md` for the phase roadmap and `../evaluation/README.md` for how
a resulting model would be judged against the current deterministic
baseline in `src/services/assessmentService.js`.
