#!/usr/bin/env python3
"""Train a DEDICATED ExplainBack classifier: TF-IDF over
(referenceAnswer, learnerAnswer) pairs -> multinomial Logistic Regression
on the 3-way label (INCORRECT / PARTIAL / CORRECT).

This is deliberately a SEPARATE model from train.py's Ridge regressor,
not just the regressor's continuous score thresholded into buckets
(that derived approach is what evaluate.py compared against before this
script existed). Training directly on the label lets the model learn a
decision boundary shaped for classification instead of inheriting
whatever boundary a regression-then-threshold pipeline happens to draw.

Usage:
    python3 train_classifier.py --data-dir ../data/processed/explainback --model-out ../models/explainback/tfidf_logreg.joblib
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
    parser.add_argument("--C", type=float, default=1.0, help="Inverse regularization strength for LogisticRegression")
    args = parser.parse_args()

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import Pipeline
        from sklearn.metrics import accuracy_score, f1_score
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
    y_train = [e["label"] for e in train_examples]
    X_val = [featurize_text(e) for e in val_examples]
    y_val = [e["label"] for e in val_examples]

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(max_features=5000, ngram_range=(1, 2))),
        ("logreg", LogisticRegression(C=args.C, max_iter=2000, class_weight="balanced")),
    ])
    pipeline.fit(X_train, y_train)

    train_pred = pipeline.predict(X_train)
    train_acc = accuracy_score(y_train, train_pred)
    train_f1 = f1_score(y_train, train_pred, labels=["INCORRECT", "PARTIAL", "CORRECT"], average="macro", zero_division=0)

    print(f"n_train={len(train_examples)} n_val={len(val_examples)}")
    print(f"Train accuracy: {train_acc:.4f}  Train macro-F1: {train_f1:.4f}")
    if val_examples:
        val_pred = pipeline.predict(X_val)
        val_acc = accuracy_score(y_val, val_pred)
        val_f1 = f1_score(y_val, val_pred, labels=["INCORRECT", "PARTIAL", "CORRECT"], average="macro", zero_division=0)
        print(f"Val accuracy: {val_acc:.4f}  Val macro-F1: {val_f1:.4f}")
    else:
        print("No val.jsonl examples — skipping validation report.")

    out_path = Path(args.model_out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, out_path)
    print(f"Saved model to {out_path}")
    print("This model has been fit on train.jsonl only. Final numbers come from evaluate.py against test.jsonl.")


if __name__ == "__main__":
    main()
