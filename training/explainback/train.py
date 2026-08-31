#!/usr/bin/env python3
"""Train a baseline ExplainBack scoring model: TF-IDF over
(referenceAnswer, learnerAnswer) pairs -> Ridge regression on
normalizedScore in [0, 1].

This is intentionally simple — the goal of this phase is a measurable,
reproducible baseline to compare future models against (see
../evaluation/README.md), not state-of-the-art accuracy.

Usage:
    python3 train.py --input processed/examples.jsonl --model-out checkpoints/tfidf_ridge.joblib
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
    # Concatenate reference + learner answer; the vectorizer learns which
    # shared/overlapping terms correlate with a high teacher-assigned score.
    return f"{example['referenceAnswer']} [SEP] {example['learnerAnswer']}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Normalized JSONL from prepare_dataset.py")
    parser.add_argument("--model-out", required=True, help="Where to write the trained pipeline (joblib)")
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import Ridge
        from sklearn.model_selection import train_test_split
        from sklearn.pipeline import Pipeline
        import joblib
    except ImportError:
        print("This script requires scikit-learn and joblib: pip install scikit-learn joblib", file=sys.stderr)
        sys.exit(1)

    examples = load_examples(args.input)
    if len(examples) < 10:
        print(f"Only {len(examples)} examples found — need real ASAG data, not the tiny app demo set.", file=sys.stderr)
        sys.exit(1)

    X = [featurize_text(e) for e in examples]
    y = [e["normalizedScore"] for e in examples]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=args.test_size, random_state=args.seed)

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(max_features=5000, ngram_range=(1, 2))),
        ("ridge", Ridge(alpha=1.0)),
    ])
    pipeline.fit(X_train, y_train)

    train_score = pipeline.score(X_train, y_train)
    test_score = pipeline.score(X_test, y_test)
    print(f"Train R^2: {train_score:.3f}  |  Test R^2: {test_score:.3f}  |  n_train={len(X_train)} n_test={len(X_test)}")

    out_path = Path(args.model_out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, out_path)
    print(f"Saved model to {out_path}")


if __name__ == "__main__":
    main()
