#!/usr/bin/env python3
"""Evaluate the trained ExplainBack model AND the lexical baseline on the
held-out test set, and write a markdown comparison report. Every number
in the report comes from this script's own run — nothing is hand-typed.

Usage:
    python3 baseline.py --input ../data/processed/explainback/test.jsonl   # writes test.baseline_predictions.json
    python3 evaluate.py --data-dir ../data/processed/explainback \
        --model ../models/explainback/tfidf_ridge.joblib \
        --report ../evaluation/reports/explainback_eval.md
"""
import argparse
import json
import sys
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


def label_for(score):
    if score < 0.34:
        return "INCORRECT"
    if score < 0.67:
        return "PARTIAL"
    return "CORRECT"


def regression_metrics(y_true, y_pred):
    from sklearn.metrics import mean_absolute_error, mean_squared_error
    return {
        "mae": mean_absolute_error(y_true, y_pred),
        "rmse": mean_squared_error(y_true, y_pred) ** 0.5,
    }


def classification_metrics(y_true_labels, y_pred_labels):
    from sklearn.metrics import accuracy_score, precision_recall_fscore_support
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true_labels, y_pred_labels, labels=["INCORRECT", "PARTIAL", "CORRECT"], average="macro", zero_division=0
    )
    return {
        "accuracy": accuracy_score(y_true_labels, y_pred_labels),
        "macro_precision": precision,
        "macro_recall": recall,
        "macro_f1": f1,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True, help="Directory with test.jsonl and manifest.json from prepare_dataset.py")
    parser.add_argument("--model", required=True, help="Path to a joblib pipeline from train.py")
    parser.add_argument("--report", required=True, help="Path to write the markdown evaluation report")
    parser.add_argument("--dataset-label", default="Automatic Short Answer Grading", help="Human-readable name of the data actually used, for the report header")
    args = parser.parse_args()

    try:
        import joblib
    except ImportError:
        print("This script requires joblib: pip install joblib", file=sys.stderr)
        sys.exit(1)

    data_dir = Path(args.data_dir)
    test_examples = load_examples(data_dir / "test.jsonl")
    if not test_examples:
        print("test.jsonl is empty or missing — run prepare_dataset.py first.", file=sys.stderr)
        sys.exit(1)

    baseline_predictions_path = data_dir / "test.baseline_predictions.json"
    if not baseline_predictions_path.exists():
        print(f"Missing {baseline_predictions_path} — run baseline.py against test.jsonl first.", file=sys.stderr)
        sys.exit(1)
    with open(baseline_predictions_path, "r", encoding="utf-8") as fh:
        baseline_result = json.load(fh)

    pipeline = joblib.load(args.model)
    model_input = [f"{e['referenceAnswer']} [SEP] {e['learnerAnswer']}" for e in test_examples]
    model_predictions = [max(0.0, min(1.0, p)) for p in pipeline.predict(model_input)]

    y_true = [e["normalizedScore"] for e in test_examples]
    y_true_labels = [e["label"] for e in test_examples]
    baseline_predictions = baseline_result["predictions"]
    baseline_labels = baseline_result["labels"]
    model_labels = [label_for(p) for p in model_predictions]

    baseline_reg = regression_metrics(y_true, baseline_predictions)
    model_reg = regression_metrics(y_true, model_predictions)
    baseline_cls = classification_metrics(y_true_labels, baseline_labels)
    model_cls = classification_metrics(y_true_labels, model_labels)

    manifest_path = data_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

    report = f"""# ExplainBack evaluation report

Generated: {datetime.now(timezone.utc).isoformat()}
Dataset: {args.dataset_label}
Test set size: {len(test_examples)}
Split manifest: `{manifest_path}` (seed={manifest.get('split', {}).get('seed')}, group_by_question={manifest.get('split', {}).get('group_by_question')})

All numbers below are produced by this script running against the actual
test split and the actual trained model file — none are hand-entered.

## Regression (predicted vs. true normalizedScore, 0-1)

| Model | MAE | RMSE |
|---|---|---|
| Lexical baseline (TF-IDF cosine similarity, untrained) | {baseline_reg['mae']:.4f} | {baseline_reg['rmse']:.4f} |
| Trained model (TF-IDF + Ridge) | {model_reg['mae']:.4f} | {model_reg['rmse']:.4f} |

## Classification (INCORRECT / PARTIAL / CORRECT, thresholds 0.34 / 0.67)

| Model | Accuracy | Macro P | Macro R | Macro F1 |
|---|---|---|---|---|
| Lexical baseline | {baseline_cls['accuracy']:.3f} | {baseline_cls['macro_precision']:.3f} | {baseline_cls['macro_recall']:.3f} | {baseline_cls['macro_f1']:.3f} |
| Trained model | {model_cls['accuracy']:.3f} | {model_cls['macro_precision']:.3f} | {model_cls['macro_recall']:.3f} | {model_cls['macro_f1']:.3f} |

## Interpretation

{"The trained model beats the lexical baseline on MAE." if model_reg['mae'] < baseline_reg['mae'] else "The trained model did NOT beat the lexical baseline on MAE on this run — do not deploy it over the baseline until that changes."}

Misconception detection is not evaluated here: the source dataset carries
no misconception labels, so no such metric can be honestly reported (see
../evaluation/README.md).
"""
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report)
    print(report)
    print(f"Report written to {report_path}")


if __name__ == "__main__":
    main()
