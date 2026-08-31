#!/usr/bin/env python3
"""Evaluate the trained learner-state model AND the rolling-rate baseline
on the held-out test set, and write a markdown comparison report. Every
number comes from this script's own run.

Usage:
    python3 baseline.py --input ../data/processed/learner_state/test.jsonl
    python3 evaluate.py --data-dir ../data/processed/learner_state \
        --model ../models/learner_state/logreg.joblib \
        --report ../evaluation/reports/learner_state_eval.md
"""
import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def load_examples(path):
    examples = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                examples.append(json.loads(line))
    return examples


def featurize(example):
    recent = example["recentCorrectness"]
    recent_rate = sum(recent) / len(recent) if recent else 0.0
    time_since = example["timeSinceReviewMs"] or 0
    return [
        example["attemptCount"],
        example["recentFailures"],
        example["topicMastery"],
        recent_rate,
        min(time_since / 86_400_000, 30),
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True, help="Directory with test.jsonl and manifest.json from split_dataset.py")
    parser.add_argument("--model", required=True, help="Path to a joblib artifact from train.py")
    parser.add_argument("--report", required=True, help="Path to write the markdown evaluation report")
    parser.add_argument("--dataset-label", default="Riiid Answer Correctness Prediction", help="Human-readable name of the data actually used, for the report header")
    args = parser.parse_args()

    try:
        import joblib
        from sklearn.metrics import roc_auc_score, log_loss, brier_score_loss
    except ImportError:
        print("This script requires scikit-learn and joblib: pip install scikit-learn joblib", file=sys.stderr)
        sys.exit(1)

    data_dir = Path(args.data_dir)
    test_examples = load_examples(data_dir / "test.jsonl")
    if not test_examples:
        print("test.jsonl is empty or missing — run split_dataset.py first.", file=sys.stderr)
        sys.exit(1)

    baseline_predictions_path = data_dir / "test.baseline_predictions.json"
    if not baseline_predictions_path.exists():
        print(f"Missing {baseline_predictions_path} — run baseline.py against test.jsonl first.", file=sys.stderr)
        sys.exit(1)
    baseline_predictions = json.loads(baseline_predictions_path.read_text())["predictions"]

    artifact = joblib.load(args.model)
    pipeline = artifact["pipeline"]
    X = [featurize(e) for e in test_examples]
    y_true = [e["label_nextCorrect"] for e in test_examples]

    t0 = time.perf_counter()
    model_predictions = pipeline.predict_proba(X)[:, 1].tolist()
    elapsed_ms = (time.perf_counter() - t0) * 1000

    def metrics(preds):
        return {
            "auc": roc_auc_score(y_true, preds),
            "logloss": log_loss(y_true, preds, labels=[0, 1]),
            "brier": brier_score_loss(y_true, preds),
        }

    baseline_m = metrics(baseline_predictions)
    model_m = metrics(model_predictions)

    manifest_path = data_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

    report = f"""# Learner-state evaluation report

Generated: {datetime.now(timezone.utc).isoformat()}
Dataset: {args.dataset_label}
Test set size: {len(test_examples)} rows, {manifest.get('split', {}).get('n_test_learners', '?')} learners (grouped split — no learner in both train and test)
Split manifest: `{manifest_path}` (seed={manifest.get('split', {}).get('seed')})

All numbers below are produced by this script running against the actual
test split and the actual trained model file — none are hand-entered.

## Metrics

| Model | ROC-AUC | Log loss | Brier (calibration) |
|---|---|---|---|
| Rolling-rate baseline (no ML — matches the app's shipped predictLearnerState()) | {baseline_m['auc']:.4f} | {baseline_m['logloss']:.4f} | {baseline_m['brier']:.4f} |
| Trained model (logistic regression) | {model_m['auc']:.4f} | {model_m['logloss']:.4f} | {model_m['brier']:.4f} |

## Latency

Trained model: {elapsed_ms:.2f}ms for {len(test_examples)} rows ({elapsed_ms / max(len(test_examples), 1):.4f}ms/row). Relevant because the eventual target is in-browser inference.

## Interpretation

{"The trained model beats the rolling-rate baseline on ROC-AUC." if model_m['auc'] > baseline_m['auc'] else "The trained model did NOT beat the rolling-rate baseline on this run — the app's existing deterministic predictLearnerState() should stay as-is."}
"""
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report)
    print(report)
    print(f"Report written to {report_path}")


if __name__ == "__main__":
    main()
