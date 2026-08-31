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

# 4. Train the model (TF-IDF + Ridge regression on normalizedScore)
python3 train.py --data-dir ../data/processed/explainback --model-out ../models/explainback/tfidf_ridge.joblib

# 5. Evaluate baseline vs. trained model on the held-out test split
python3 evaluate.py --data-dir ../data/processed/explainback \
    --model ../models/explainback/tfidf_ridge.joblib \
    --report ../evaluation/reports/explainback_eval.md

# 6. Export to a browser-compatible format
python3 export_model.py --model ../models/explainback/tfidf_ridge.joblib --output ../exports/explainback/model.json
```

`../data/raw/`, `../data/processed/`, and `../models/` are gitignored —
nothing produced by this pipeline (real or synthetic) is committed
automatically. `../evaluation/reports/*.md` and a small, clearly-labeled
demo export ARE committed (see "Demo run" below).

## No real dataset run yet

The environment this pipeline was built in has its network egress proxy
blocking `kaggle.com` entirely, so the real dataset could not be
downloaded or even browsed from there. **Nobody has run this pipeline
against the real Automatic Short Answer Grading dataset yet.** Run steps
1-6 above yourself, wherever you have real Kaggle access, to get real
numbers.

## Demo run (synthetic data, not the real dataset)

To prove the pipeline code actually works, `make_synthetic_sample.py`
generates a small, clearly-labeled SYNTHETIC stand-in (same raw column
names) and steps 2-6 were run against it end to end:

```bash
python3 make_synthetic_sample.py --output ../data/raw/explainback/SYNTHETIC_asag_sample.csv --n-per-question 60
```

Real, captured results from that run: `../evaluation/reports/explainback_eval.md`
(trained model MAE 0.187 vs. baseline MAE 0.368 — the model reliably beats
lexical similarity alone). **These numbers describe the synthetic demo
data only and say nothing about performance on the real dataset.** The
committed `../exports/explainback/SYNTHETIC_DEMO_model.json` is that
demo run's export, kept only so `scoreExplainBack.js` has something to
run against without anyone needing to re-run the pipeline first — it was
verified to reproduce the Python model's predictions bit-for-bit (see
`../exports/README.md`).

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

No training run has been performed against the real dataset — only
against the synthetic demo data described above. See `../README.md` for
the phase roadmap and `../evaluation/README.md` for the metrics
definitions used to judge a real run against the shipped deterministic
baseline in `src/services/assessmentService.js`.
