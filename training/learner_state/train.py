#!/usr/bin/env python3
"""Train a learner-state classifier: logistic regression over
attemptCount/recentFailures/topicMastery/recentCorrectness-rate/timeSince
-> P(next answer correct).

Deliberately simple (a handful of hand-engineered features + logistic
regression) so the coefficients export directly to plain JS arithmetic
(see export.py) with no ML runtime needed at all.

Trains on train.jsonl, reports on val.jsonl. Final, one-time numbers come
from evaluate.py against test.jsonl, which this script never touches.

Usage:
    python3 train.py --data-dir ../data/processed/learner_state --model-out ../models/learner_state/logreg.joblib
"""
import argparse
import json
import sys
from pathlib import Path

FEATURE_KEYS = ["attemptCount", "recentFailures", "topicMastery", "recentRate", "daysSinceReview"]


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
    parser.add_argument("--data-dir", required=True, help="Directory with train.jsonl and val.jsonl from split_dataset.py")
    parser.add_argument("--model-out", required=True, help="Where to write the trained pipeline (joblib)")
    args = parser.parse_args()

    try:
        from sklearn.linear_model import LogisticRegression
        from sklearn.preprocessing import StandardScaler
        from sklearn.pipeline import Pipeline
        from sklearn.metrics import roc_auc_score
        import joblib
    except ImportError:
        print("This script requires scikit-learn and joblib: pip install scikit-learn joblib", file=sys.stderr)
        sys.exit(1)

    data_dir = Path(args.data_dir)
    train_examples = load_examples(data_dir / "train.jsonl")
    val_examples = load_examples(data_dir / "val.jsonl")

    if len(train_examples) < 50:
        print(f"Only {len(train_examples)} training rows found — need the real Riiid dataset.", file=sys.stderr)
        sys.exit(1)

    X_train = [featurize(e) for e in train_examples]
    y_train = [e["label_nextCorrect"] for e in train_examples]
    X_val = [featurize(e) for e in val_examples]
    y_val = [e["label_nextCorrect"] for e in val_examples]

    pipeline = Pipeline([
        ("scale", StandardScaler()),
        ("logreg", LogisticRegression(max_iter=1000)),
    ])
    pipeline.fit(X_train, y_train)

    train_acc = pipeline.score(X_train, y_train)
    print(f"n_train={len(train_examples)} n_val={len(val_examples)}")
    print(f"Train accuracy: {train_acc:.3f}")
    if val_examples:
        val_acc = pipeline.score(X_val, y_val)
        val_auc = roc_auc_score(y_val, pipeline.predict_proba(X_val)[:, 1])
        print(f"Val accuracy: {val_acc:.3f}  |  Val ROC-AUC: {val_auc:.3f}")
    else:
        print("No val.jsonl examples — skipping validation report.")

    out_path = Path(args.model_out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": pipeline, "feature_keys": FEATURE_KEYS}, out_path)
    print(f"Saved model to {out_path}")
    print("Final numbers come from evaluate.py against test.jsonl.")


if __name__ == "__main__":
    main()
