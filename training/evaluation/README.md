# Evaluation framework

Metrics a trained model must report before it's considered for the
export contract in `../exports/README.md`. Definitions below; real
numbers from an actual pipeline run live in `reports/` (see "Reports"
below) — this file doesn't restate them, since they'd drift out of sync
with the scripts that produced them.

## Reports

- `reports/explainback_eval.md`
- `reports/learner_state_eval.md`

Both are generated verbatim by `evaluate.py` in their respective pipeline
— never hand-edited. **Both currently describe a run against synthetic
demo data**, not the real Kaggle datasets (this environment's network
egress proxy blocks `kaggle.com` — see each pipeline's README for the
"Demo run" section). Re-run `evaluate.py` against a real-data split to
replace them with real numbers; the report format stays the same.

## ExplainBack assessment

Reported by `../explainback/evaluate.py`:

- **MAE** — mean absolute error between predicted `normalizedScore` and
  the teacher-assigned `normalizedScore`, in `[0, 1]`.
- **Agreement with teacher marks** — accuracy of a 3-way bucketing
  (`incorrect` <0.34, `partial` 0.34-0.66, `correct` ≥0.67) versus the same
  bucketing applied to the true score.
- **Misconception detection** — only evaluable where the dataset carries
  misconception labels, which the raw ASAG dataset does not. Leave this
  metric unreported until such labels exist (e.g. a NimiqLearn-specific
  annotated subset).

## Learner-state

Reported by `../learner_state/evaluate.py`:

- **ROC-AUC** — discrimination between "answers correctly next" vs. not.
- **Log loss** — proper scoring rule for the predicted probability.
- **Calibration** — Brier score as a simple calibration proxy; a
  reliability diagram is a better follow-up once there's a real result to
  plot.
- **Prediction latency** — wall-clock time per row, reported because the
  eventual target is in-browser inference where latency directly affects
  the Learn/ExplainBack UX.

## Baseline comparison

The Phase 1 deterministic baselines already running in the app:

- `src/services/assessmentService.js` → `computeRubricBaseline()`
- `src/services/learnerStateService.js` → `predictLearnerState()`

A trained model only replaces a baseline once it demonstrably beats it on
the metrics above, measured on a held-out split it did not train on. Until
that comparison has actually been run, the deterministic baseline remains
the shipped behavior — do not claim a trained model is "better" from
architecture alone.
