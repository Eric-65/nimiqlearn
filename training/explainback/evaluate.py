#!/usr/bin/env python3
"""Evaluate a trained ExplainBack model against the normalized dataset,
reporting the metrics defined in ../evaluation/README.md.

Also reports what the CURRENT deterministic baseline
(src/services/assessmentService.js -> computeRubricBaseline) would need to
beat: this script does not re-implement that JS baseline (no cross-language
port), it only reports the trained model's own numbers so a human can
compare them against baseline scores gathered separately.

Usage:
    python3 evaluate.py --model checkpoints/tfidf_ridge.joblib --input processed/examples.jsonl
"""
import argparse
import json
import sys


def load_examples(path):
    examples = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                examples.append(json.loads(line))
    return examples


def classify_band(score):
    if score < 0.34:
        return "incorrect"
    if score < 0.67:
        return "partial"
    return "correct"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, help="Path to a joblib pipeline from train.py")
    parser.add_argument("--input", required=True, help="Normalized JSONL to evaluate against")
    args = parser.parse_args()

    try:
        import joblib
        from sklearn.metrics import mean_absolute_error, accuracy_score
    except ImportError:
        print("This script requires scikit-learn and joblib: pip install scikit-learn joblib", file=sys.stderr)
        sys.exit(1)

    pipeline = joblib.load(args.model)
    examples = load_examples(args.input)

    X = [f"{e['referenceAnswer']} [SEP] {e['learnerAnswer']}" for e in examples]
    y_true = [e["normalizedScore"] for e in examples]
    y_pred = pipeline.predict(X)
    y_pred = [max(0.0, min(1.0, p)) for p in y_pred]

    mae = mean_absolute_error(y_true, y_pred)
    band_true = [classify_band(s) for s in y_true]
    band_pred = [classify_band(s) for s in y_pred]
    band_agreement = accuracy_score(band_true, band_pred)

    print(f"n_examples: {len(examples)}")
    print(f"MAE (normalized score, 0-1): {mae:.4f}")
    print(f"correct/partial/incorrect agreement with teacher marks: {band_agreement:.3f}")
    print()
    print("These are the ONLY measured results this script reports. Do not")
    print("substitute invented numbers when reporting on this pipeline —")
    print("if it hasn't been run against the real dataset, say so.")


if __name__ == "__main__":
    main()
