#!/usr/bin/env python3
"""Evaluate a trained learner-state model, reporting ROC-AUC, log loss, and
calibration as specified in ../evaluation/README.md, plus wall-clock
prediction latency (relevant since the eventual target is browser
inference).

Usage:
    python3 evaluate.py --model checkpoints/riiid_logreg.joblib --input processed/features.jsonl
"""
import argparse
import json
import sys
import time


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
    parser.add_argument("--model", required=True, help="Path to a joblib artifact from train.py")
    parser.add_argument("--input", required=True, help="Feature JSONL to evaluate against")
    args = parser.parse_args()

    try:
        import joblib
        from sklearn.metrics import roc_auc_score, log_loss, brier_score_loss
    except ImportError:
        print("This script requires scikit-learn and joblib: pip install scikit-learn joblib", file=sys.stderr)
        sys.exit(1)

    artifact = joblib.load(args.model)
    pipeline = artifact["pipeline"]
    examples = load_examples(args.input)

    X = [featurize(e) for e in examples]
    y_true = [e["label_nextCorrect"] for e in examples]

    t0 = time.perf_counter()
    y_pred_proba = pipeline.predict_proba(X)[:, 1]
    elapsed_ms = (time.perf_counter() - t0) * 1000

    auc = roc_auc_score(y_true, y_pred_proba)
    loss = log_loss(y_true, y_pred_proba)
    brier = brier_score_loss(y_true, y_pred_proba)  # calibration proxy

    print(f"n_examples: {len(examples)}")
    print(f"ROC-AUC: {auc:.4f}")
    print(f"Log loss: {loss:.4f}")
    print(f"Brier score (calibration): {brier:.4f}")
    print(f"Prediction latency: {elapsed_ms:.2f}ms for {len(examples)} rows ({elapsed_ms / max(len(examples),1):.4f}ms/row)")
    print()
    print("These are the ONLY measured results this script reports. Do not")
    print("substitute invented numbers when reporting on this pipeline.")


if __name__ == "__main__":
    main()
