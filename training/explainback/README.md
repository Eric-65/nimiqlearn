# ExplainBack training pipeline

Turns the Automatic Short Answer Grading dataset into a normalized,
leakage-safe train/val/test split, a no-ML lexical baseline, a trained
assessment model, an honest evaluation report, and a browser-compatible
export — the "trained-assessment-model" path in
`src/services/assessmentService.js`, still unused by the shipped app
until a real (not synthetic) run beats the deterministic rubric baseline.

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
Python workspace, never invoked by `npm install` / `npm run dev` / `npm run build`.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install pandas scikit-learn joblib
```

## Pipeline

```bash
# 1. Download the real dataset (see ../scripts/download_data.sh and
#    ../datasets/README.md for license terms — CC BY 4.0, re-verify
#    before redistribution/commercial use):
../scripts/download_data.sh explainback

# 2. Normalize + split into train/val/test (column names are auto-detected
#    from the actual CSV header, never assumed — see prepare_dataset.py)
python3 prepare_dataset.py --input "../data/raw/explainback/*.csv" --output-dir ../data/processed/explainback

# 3. Baseline: TF-IDF cosine similarity, no training — "what happens without ML?"
python3 baseline.py --input ../data/processed/explainback/test.jsonl

# 4. Train the REGRESSOR (TF-IDF + Ridge regression on normalizedScore)
python3 train.py --data-dir ../data/processed/explainback --model-out ../models/explainback/tfidf_ridge.joblib

# 4b. Train a DEDICATED CLASSIFIER (TF-IDF + LogisticRegression on the
#     3-way label) — separate from thresholding the regressor's output
python3 train_classifier.py --data-dir ../data/processed/explainback --model-out ../models/explainback/tfidf_logreg.joblib

# 5. Evaluate baseline vs. regressor vs. classifier on the held-out test split
python3 evaluate.py --data-dir ../data/processed/explainback \
    --model ../models/explainback/tfidf_ridge.joblib \
    --classifier-model ../models/explainback/tfidf_logreg.joblib \
    --report ../evaluation/reports/explainback_eval.md

# 6. Export both to browser-compatible formats
python3 export_model.py --model ../models/explainback/tfidf_ridge.joblib --output ../exports/explainback/model.json
python3 export_classifier.py --model ../models/explainback/tfidf_logreg.joblib --output ../exports/explainback/classifier.json
```

`../data/raw/`, `../data/processed/`, and `../models/` are gitignored —
nothing produced by this pipeline (real or synthetic) is committed
automatically. `../evaluation/reports/*.md` and the exported model JSONs
ARE committed (see "Real run" below).

## Real run (Mohler dataset via GitHub mirror, not Kaggle directly)

Kaggle itself is unreachable from the sandbox this pipeline runs in, but
the underlying academic corpus Kaggle's `automatic-short-answer-grading-dataset`
packages (Mohler et al., 2011) is mirrored publicly on GitHub
(`gsasikiran/Comparative-Evaluation-of-Pretrained-Transfer-Learning-Models-on-ASAG`,
file `mohler_dataset_edited.csv`) — the same 2,273-row dataset, downloaded
from there instead. Its real columns (`question`, `desired_answer`,
`student_answer`, `score_avg`, graded on a fixed 0-5 scale with no
per-row max-score column) required extending `prepare_dataset.py`:
`desired_answer`/`score_avg` added to `COLUMN_ALIASES`, and a new
`--fixed-max-score` flag for datasets with no per-row max-score column
(used here as `--fixed-max-score 5`).

Steps 1-6 above were run end to end against this real data (1596/343/334
train/val/test, grouped by question, seed 42). Real, captured results:
`../evaluation/reports/explainback_eval.md`:

| Model | Regression MAE | Classification macro-F1 |
|---|---|---|
| Lexical baseline (untrained) | 0.624 | 0.098 |
| Trained regressor (TF-IDF + Ridge) | 0.174 | 0.296 (thresholded) |
| Trained classifier (TF-IDF + LogisticRegression) | — | 0.391 (dedicated) |

Both trained models beat their respective baselines. The dedicated
classifier beats thresholding the regressor's output on macro-F1 —
`class_weight="balanced"` trades some raw accuracy (0.581 vs 0.796) for
much better performance on the minority INCORRECT/PARTIAL classes, which
raw accuracy alone hides given how CORRECT-heavy this dataset is.

`../exports/explainback/model.json` and `classifier.json` are the real
exports from this run, verified bit-for-bit against the Python models'
predictions on held-out examples (same method as the synthetic demo
below). Both are wired into the live app — see
`src/services/explainBackTrainedModel.js` and
`src/services/assessmentService.js`, "computeRubricBaseline()".

**Riiid was not similarly obtained** — see `../README.md`'s network note
for why (Kaggle-competition-gated, no open mirror of the raw data exists).

## Demo run (synthetic data — superseded by the real run above)

Before real data was available, `make_synthetic_sample.py` generated a
small, clearly-labeled SYNTHETIC stand-in (same raw column names) to
prove the pipeline code worked end to end, before ASAG could be obtained.
Kept for reference; the real run above is what the app actually uses now.

```bash
python3 make_synthetic_sample.py --output ../data/raw/explainback/SYNTHETIC_asag_sample.csv --n-per-question 60
```

The committed `../exports/explainback/SYNTHETIC_DEMO_model.json` is that
earlier demo run's export — not used by the app, kept only as a record
that the export format was verified before real data existed.

## Normalized schema

Raw ASAG columns (`question`, `model_answer`, `student_answer`,
`teacher_marks`, `total_marks` — auto-detected with a few known aliases,
see `COLUMN_ALIASES` in `prepare_dataset.py`) become:

```json
{
  "question": "...",
  "referenceAnswer": "...",
  "learnerAnswer": "...",
  "score": 3,
  "maxScore": 5,
  "normalizedScore": 0.6,
  "label": "PARTIAL"
}
```

`label` is derived (not present in the source data) via documented
thresholds: `< 0.34` INCORRECT, `0.34-0.66` PARTIAL, `≥ 0.67` CORRECT.

`topic` is intentionally NOT included — ASAG's questions don't line up
with NimiqLearn's curriculum, and a trained model should key off the
`question`/`referenceAnswer` text itself, not a topic id.

## Split strategy

`prepare_dataset.py` groups by `question` by default (`--group-by-question`,
on unless disabled) so the same question never appears in both train and
test — otherwise the model could memorize per-question quirks (e.g. a
distinctive reference-answer phrasing) instead of learning general
answer-quality signal. Default ratio 70/15/15, seed 42, both documented
in the generated `manifest.json`.

## Status

A real training run against the real Automatic Short Answer Grading
(Mohler) dataset has been performed and is wired into the live app — see
"Real run" above. See `../README.md` for the phase roadmap and
`../evaluation/README.md` for the metrics
definitions used to judge a real run against the shipped deterministic
baseline in `src/services/assessmentService.js`.
