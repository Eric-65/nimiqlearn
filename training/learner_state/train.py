#!/usr/bin/env python3
"""Train a baseline learner-state classifier: logistic regression over
recentCorrectness/attemptCount/recentFailures/topicMastery/timeSinceReviewMs
-> P(next answer correct).

Deliberately simple, to match the interface (not necessarily the internal
logic) of src/services/learnerStateService.js's predictLearnerState(), so
the exported model can be swapped in behind that same function signature
later without changing any calling code.

Usage:
    python3 train.py --input processed/features.jsonl --model-out checkpoints/riiid_logreg.joblib
"""
import argparse
import json
import sys


FEATURE_KEYS = ["attemptCount", "recentFailures", "topicMastery", "timeSinceReviewMs"]


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
        min(time_since / 86_400_000, 30),  # clamp to 30 days, in days
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Feature JSONL from prepare_riiid.py")
    parser.add_argument("--model-out", required=True, help="Where to write the trained pipeline (joblib)")
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    try:
        from sklearn.linear_model import LogisticRegression
        from sklearn.model_selection import train_test_split
        from sklearn.preprocessing import StandardScaler
        from sklearn.pipeline import Pipeline
        import joblib
    except ImportError:
        print("This script requires scikit-learn and joblib: pip install scikit-learn joblib", file=sys.stderr)
        sys.exit(1)

    examples = load_examples(args.input)
    if len(examples) < 50:
        print(f"Only {len(examples)} feature rows found — need the real Riiid dataset, not synthetic data.", file=sys.stderr)
        sys.exit(1)

    X = [featurize(e) for e in examples]
    y = [e["label_nextCorrect"] for e in examples]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=args.test_size, random_state=args.seed, stratify=y)

    pipeline = Pipeline([
        ("scale", StandardScaler()),
        ("logreg", LogisticRegression(max_iter=1000)),
    ])
    pipeline.fit(X_train, y_train)

    train_acc = pipeline.score(X_train, y_train)
    test_acc = pipeline.score(X_test, y_test)
    print(f"Train accuracy: {train_acc:.3f}  |  Test accuracy: {test_acc:.3f}  |  n_train={len(X_train)} n_test={len(X_test)}")

    from pathlib import Path
    out_path = Path(args.model_out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": pipeline, "feature_keys": FEATURE_KEYS}, out_path)
    print(f"Saved model to {out_path}")


if __name__ == "__main__":
    main()
