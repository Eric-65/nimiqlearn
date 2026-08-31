#!/usr/bin/env python3
"""Split learner-state feature rows into train/val/test, grouped by
learnerId — never by row. Splitting by row would let the same learner's
interactions appear in both train and test, which leaks that learner's
overall skill level across the split and inflates apparent accuracy (see
AVOID DATA LEAKAGE in ../README.md).

Usage:
    python3 split_dataset.py --input ../data/processed/learner_state/features.jsonl \
        --output-dir ../data/processed/learner_state
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


def write_jsonl(path, rows):
    with open(path, "w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="features.jsonl from prepare_riiid.py")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--val-size", type=float, default=0.15)
    parser.add_argument("--test-size", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    try:
        from sklearn.model_selection import GroupShuffleSplit
    except ImportError:
        print("This script requires scikit-learn: pip install scikit-learn", file=sys.stderr)
        sys.exit(1)

    examples = load_examples(args.input)
    if len(examples) < 50:
        print(f"Only {len(examples)} feature rows found — need the real Riiid dataset.", file=sys.stderr)
        sys.exit(1)

    groups = [e["learnerId"] for e in examples]
    gss1 = GroupShuffleSplit(n_splits=1, test_size=args.test_size, random_state=args.seed)
    trainval_idx, test_idx = next(gss1.split(examples, groups=groups))
    trainval = [examples[i] for i in trainval_idx]
    trainval_groups = [groups[i] for i in trainval_idx]

    relative_val = args.val_size / (1 - args.test_size)
    gss2 = GroupShuffleSplit(n_splits=1, test_size=relative_val, random_state=args.seed)
    train_idx, val_idx = next(gss2.split(trainval, groups=trainval_groups))
    train = [trainval[i] for i in train_idx]
    val = [trainval[i] for i in val_idx]
    test = [examples[i] for i in test_idx]

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    write_jsonl(out_dir / "train.jsonl", train)
    write_jsonl(out_dir / "val.jsonl", val)
    write_jsonl(out_dir / "test.jsonl", test)

    n_learners = len(set(groups))
    manifest = {
        "n_examples": len(examples),
        "n_learners": n_learners,
        "split": {
            "seed": args.seed,
            "group_by": "learnerId",
            "val_size": args.val_size,
            "test_size": args.test_size,
            "n_train": len(train),
            "n_val": len(val),
            "n_test": len(test),
            "n_train_learners": len(set(trainval_groups[i] for i in train_idx)),
            "n_test_learners": len(set(groups[i] for i in test_idx)),
        },
    }
    with open(out_dir / "manifest.json", "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)

    print(f"n_examples={len(examples)} across {n_learners} learners")
    print(f"train={len(train)} val={len(val)} test={len(test)} (grouped by learnerId — no learner appears in more than one split)")
    print(f"Wrote splits + manifest to {out_dir}")


if __name__ == "__main__":
    main()
