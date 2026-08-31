#!/usr/bin/env python3
"""Learner-state baseline: "what happens without machine learning?"

Predicts P(next answer correct) as simply the learner's own rolling
recent-correctness rate (topicMastery, as already computed by
prepare_riiid.py) — no fitting, no features combined, just the single
strongest naive signal. This is deliberately what
src/services/learnerStateService.js's predictLearnerState() already does
in the app today, so this script also tells you how much (if at all) a
trained model actually improves on the shipped baseline.

Usage:
    python3 baseline.py --input ../data/processed/learner_state/test.jsonl
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="A split JSONL from split_dataset.py (usually test.jsonl)")
    args = parser.parse_args()

    examples = load_examples(args.input)
    if not examples:
        print("No examples found.", file=sys.stderr)
        sys.exit(1)

    predictions = [max(0.0, min(1.0, e["topicMastery"])) for e in examples]

    out_path = args.input.replace(".jsonl", ".baseline_predictions.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump({"predictions": predictions}, fh)

    print(f"Computed rolling-rate baseline for {len(examples)} examples.")
    print(f"Predictions written to {out_path} (consumed by evaluate.py).")


if __name__ == "__main__":
    main()
