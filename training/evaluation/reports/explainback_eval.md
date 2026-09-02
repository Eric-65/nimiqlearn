# ExplainBack evaluation report

Generated: 2026-09-02T16:16:31.021797+00:00
Dataset: Automatic Short Answer Grading
Test set size: 334
Split manifest: `../data/processed/explainback/manifest.json` (seed=42, group_by_question=True)

All numbers below are produced by this script running against the actual
test split and the actual trained model file — none are hand-entered.

## Regression (predicted vs. true normalizedScore, 0-1)

| Model | MAE | RMSE |
|---|---|---|
| Lexical baseline (TF-IDF cosine similarity, untrained) | 0.6238 | 0.6768 |
| Trained model (TF-IDF + Ridge) | 0.1736 | 0.2106 |

## Classification (INCORRECT / PARTIAL / CORRECT, thresholds 0.34 / 0.67)

Two different ways of producing a 3-way label are compared: thresholding
the *regressor's* continuous score (a derived classification, not a
purpose-built one), versus a *dedicated* classifier (train_classifier.py)
trained directly on the label.

| Model | Accuracy | Macro P | Macro R | Macro F1 |
|---|---|---|---|---|
| Lexical baseline (thresholded) | 0.132 | 0.344 | 0.378 | 0.098 |
| Regressor, thresholded (TF-IDF + Ridge) | 0.796 | 0.270 | 0.327 | 0.296 |
| Dedicated classifier (TF-IDF + LogisticRegression) | 0.581 | 0.379 | 0.463 | 0.391 |

## Interpretation

The trained regressor beats the lexical baseline on MAE.
The dedicated classifier beats the regressor-derived classification on macro-F1 (0.391 vs 0.296).

Misconception detection is not evaluated here: the source dataset carries
no misconception labels, so no such metric can be honestly reported (see
../evaluation/README.md).
