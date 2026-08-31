# Learner-state evaluation report

Generated: 2026-08-31T10:50:43.859463+00:00
Dataset: SYNTHETIC demo sample (see script header) — NOT the real Kaggle Riiid dataset
Test set size: 1280 rows, 23 learners (grouped split — no learner in both train and test)
Split manifest: `../data/processed/learner_state/manifest.json` (seed=42)

All numbers below are produced by this script running against the actual
test split and the actual trained model file — none are hand-entered.

## Metrics

| Model | ROC-AUC | Log loss | Brier (calibration) |
|---|---|---|---|
| Rolling-rate baseline (no ML — matches the app's shipped predictLearnerState()) | 0.5531 | 1.3148 | 0.2580 |
| Trained model (logistic regression) | 0.5608 | 0.6796 | 0.2433 |

## Latency

Trained model: 2.52ms for 1280 rows (0.0020ms/row). Relevant because the eventual target is in-browser inference.

## Interpretation

The trained model beats the rolling-rate baseline on ROC-AUC.
