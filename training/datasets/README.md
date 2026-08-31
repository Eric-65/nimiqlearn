# Datasets

Neither dataset is stored in this repository. Both are pulled at
preprocessing time from Kaggle into a local, gitignored directory (see
root `.gitignore`: `*.csv`, `*.parquet`, `*.jsonl` and friends). Nothing
here is ever fetched by, or bundled into, the browser app.

## 1. Automatic Short Answer Grading

| Field | Value |
|---|---|
| Source | Kaggle — [`mubeenfurqanahmed/automatic-short-answer-grading-dataset`](https://www.kaggle.com/datasets/mubeenfurqanahmed/automatic-short-answer-grading-dataset) |
| Purpose | ExplainBack assessment research — student answer quality, answer scoring, partial correctness, missing concepts, reference-answer comparison. Offline development/evaluation data for the rubric baseline and, eventually, a trained assessment model. |
| Schema (raw) | `question`, `model_answer`, `student_answer`, `teacher_marks`, `total_marks` |
| Normalized schema | `{ question, referenceAnswer, learnerAnswer, score, maxScore }` (see `explainback/prepare_dataset.py`) |
| License | CC BY 4.0 (as stated by the dataset) — re-verify on the Kaggle page before any redistribution or commercial use, licenses can change |
| Synthetic? | **Yes.** This dataset is synthetically generated. It is treated as an educational NLP development dataset, not as real-world student ground truth. A model trained on it does not provide perfectly accurate grading of real students. |
| Preprocessing version | not yet run — no preprocessing has been executed against the real dataset |
| Training date | none — no training has occurred |

Download only into `explainback/raw/` (gitignored) via the Kaggle CLI or web UI —
never fetched by, or committed to, this repository, and never bundled into
the React application:

```bash
kaggle datasets download -d mubeenfurqanahmed/automatic-short-answer-grading-dataset -p explainback/raw/ --unzip
```

## 2. Riiid Answer Correctness Prediction

| Field | Value |
|---|---|
| Source | Kaggle competition — [`riiid-test-answer-prediction`](https://www.kaggle.com/competitions/riiid-test-answer-prediction/data) |
| Purpose | Learner-state prediction feeding LearningLoop + ForgetMeNot — historical learner performance, correctness prediction, learner progression, question difficulty, review prioritization, next-question performance. Its purpose is predicting future learner performance, not language generation. |
| Schema (raw) | Interaction-level rows: `user_id`, `content_id`, `content_type_id`, `timestamp`, `answered_correctly`, plus supplementary `questions.csv`/`lectures.csv` metadata (see the competition's data description for the authoritative field list). |
| Normalized feature set | `{ recentCorrectness, attemptCount, recentFailures, topicMastery, timeSinceReviewMs, label_nextCorrect }` (see `learner_state/prepare_riiid.py`) — matches what `src/services/learnerStateService.js` already consumes at runtime. |
| License | **Unresolved.** This is a Kaggle *competition* dataset — joining the competition to download it does not automatically grant unrestricted redistribution or commercial-use rights. Before any training run whose output leaves this offline workspace (a published artifact, a public writeup), re-read the competition's current rules tab on Kaggle and record the outcome here. |
| Synthetic? | No — real (anonymized) learner interaction data, per the competition description. |
| Preprocessing version | not yet run |
| Training date | none — no training has occurred |

Requires joining the competition on Kaggle before download is permitted:

```bash
kaggle competitions download -c riiid-test-answer-prediction -p learner_state/raw/
unzip learner_state/raw/riiid-test-answer-prediction.zip -d learner_state/raw/
```

The dataset is only ever used inside `learner_state/` (offline). It is
never fetched at runtime and never reaches the React application — only
the resulting lightweight model artifact or derived parameters would
(see `../exports/README.md`).

## General rules

- Do not commit either dataset, or any derivative larger than a handful of
  rows, to this repository.
- `src/data/mockExplainBackExamples.js` in the app is a hand-written, 8-example
  sample for demo/dev purposes only — it is not extracted from the real
  dataset and must stay that size.
- Update the "Preprocessing version" / "Training date" rows above the
  moment either pipeline is actually run against real data.
