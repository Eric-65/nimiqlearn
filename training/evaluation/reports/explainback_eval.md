# ExplainBack evaluation report

Generated: 2026-08-31T10:50:06.504393+00:00
Dataset: SYNTHETIC demo sample (see script header) — NOT the real Kaggle ASAG dataset
Test set size: 120
Split manifest: `../data/processed/explainback/manifest.json` (seed=42, group_by_question=True)

All numbers below are produced by this script running against the actual
test split and the actual trained model file — none are hand-entered.

## Regression (predicted vs. true normalizedScore, 0-1)

| Model | MAE | RMSE |
|---|---|---|
| Lexical baseline (TF-IDF cosine similarity, untrained) | 0.3684 | 0.4276 |
| Trained model (TF-IDF + Ridge) | 0.1869 | 0.2470 |

## Classification (INCORRECT / PARTIAL / CORRECT, thresholds 0.34 / 0.67)

| Model | Accuracy | Macro P | Macro R | Macro F1 |
|---|---|---|---|---|
| Lexical baseline | 0.208 | 0.076 | 0.333 | 0.124 |
| Trained model | 0.775 | 0.808 | 0.794 | 0.770 |

## Interpretation

The trained model beats the lexical baseline on MAE.

Misconception detection is not evaluated here: the source dataset carries
no misconception labels, so no such metric can be honestly reported (see
../evaluation/README.md).
