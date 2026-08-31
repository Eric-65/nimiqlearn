#!/usr/bin/env python3
"""Train the ExplainBack assessment model: TF-IDF over
(referenceAnswer, learnerAnswer) pairs -> Ridge regression on
normalizedScore in [0, 1].

Chosen deliberately over a large transformer: fast, interpretable
(inspectable coefficients), and small enough to export as plain
parameters (see export_model.py) rather than needing a model runtime in
the browser.

Trains on train.jsonl, reports validation performance on val.jsonl (for
picking hyperparameters / knowing if something's badly wrong) — final,
one-time reporting happens in evaluate.py against test.jsonl, which this
script never touches.

Usage:
    python3 train.py --data-dir ../data/processed/explainback --model-out ../models/explainback/tfidf_ridge.joblib
"""
import argparse
import json
import sys
from pathlib import Path


def load_examples(path):
    examples = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                examples.append(json.loads(line))
    return examples


def featurize_text(example):
    return f"{example['referenceAnswer']} [SEP] {example['learnerAnswer']}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True, help="Directory containing train.jsonl and val.jsonl from prepare_dataset.py")
    parser.add_argument("--model-out", required=True, help="Where to write the trained pipeline (joblib)")
    parser.add_argument("--alpha", type=float, default=1.0, help="Ridge regularization strength")
    args = parser.parse_args()

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import Ridge
        from sklearn.pipeline import Pipeline
        from sklearn.metrics import mean_absolute_error
        import joblib
    except ImportError:
        print("This script requires scikit-learn and joblib: pip install scikit-learn joblib", file=sys.stderr)
        sys.exit(1)

    data_dir = Path(args.data_dir)
    train_examples = load_examples(data_dir / "train.jsonl")
    val_examples = load_examples(data_dir / "val.jsonl")

    if len(train_examples) < 10:
        print(f"Only {len(train_examples)} training examples found — need real ASAG data, not the tiny app demo set.", file=sys.stderr)
        sys.exit(1)

    X_train = [featurize_text(e) for e in train_examples]
    y_train = [e["normalizedScore"] for e in train_examples]
    X_val = [featurize_text(e) for e in val_examples]
    y_val = [e["normalizedScore"] for e in val_examples]

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(max_features=5000, ngram_range=(1, 2))),
        ("ridge", Ridge(alpha=args.alpha)),
    ])
    pipeline.fit(X_train, y_train)

    train_pred = [max(0.0, min(1.0, p)) for p in pipeline.predict(X_train)]
    val_pred = [max(0.0, min(1.0, p)) for p in pipeline.predict(X_val)]
    train_mae = mean_absolute_error(y_train, train_pred)
    val_mae = mean_absolute_error(y_val, val_pred) if val_examples else None

    print(f"n_train={len(train_examples)} n_val={len(val_examples)}")
    print(f"Train MAE: {train_mae:.4f}")
    if val_mae is not None:
        print(f"Val MAE: {val_mae:.4f}")
    else:
        print("No val.jsonl examples — skipping validation report.")

    out_path = Path(args.model_out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, out_path)
    print(f"Saved model to {out_path}")
    print("This model has been fit on train.jsonl only. Final numbers come from evaluate.py against test.jsonl.")


if __name__ == "__main__":
    main()
