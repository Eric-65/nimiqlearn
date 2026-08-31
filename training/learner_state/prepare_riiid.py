#!/usr/bin/env python3
"""Aggregate the raw Riiid interaction log into per-attempt feature rows
matching the shape src/services/learnerStateService.js already consumes:
recentCorrectness, attemptCount, recentFailures, topicMastery,
timeSinceReviewMs -> label_nextCorrect.

This is feature engineering for offline research only — no Riiid data is
ever loaded by, or shipped with, the browser app.

Usage:
    python3 prepare_riiid.py --input raw/train.csv --output processed/features.jsonl
"""
import argparse
import json
import sys
from pathlib import Path

WINDOW = 8  # how many prior attempts feed recentCorrectness, matches the
            # app's own recentPerformance ring buffer size (see mockLearner.js)


def build_features_for_user(rows):
    """rows: list of dicts, one per interaction, already sorted by timestamp
    for a single user. Yields one feature row per attempt (using only prior
    history — no leakage from the attempt being predicted)."""
    history = []
    last_timestamp = None
    for row in rows:
        if row.get("content_type_id") == 1:
            # Riiid marks lecture rows with content_type_id == 1; they are
            # not questions and carry no correctness label.
            continue

        correct = int(row["answered_correctly"])
        timestamp = int(row["timestamp"])

        if history:
            recent = history[-WINDOW:]
            attempt_count = len(history)
            recent_failures = sum(1 for r in recent if r == 0)
            topic_mastery = sum(history) / len(history)
            time_since_review_ms = timestamp - last_timestamp if last_timestamp is not None else None

            yield {
                "recentCorrectness": recent,
                "attemptCount": attempt_count,
                "recentFailures": recent_failures,
                "topicMastery": round(topic_mastery, 4),
                "timeSinceReviewMs": time_since_review_ms,
                "label_nextCorrect": correct,
            }

        history.append(correct)
        last_timestamp = timestamp


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Path to the raw Riiid train.csv")
    parser.add_argument("--output", required=True, help="Path to write feature JSONL")
    parser.add_argument("--max-users", type=int, default=None, help="Optional cap for a quick local run")
    args = parser.parse_args()

    try:
        import pandas as pd
    except ImportError:
        print("This script requires pandas. Install with: pip install pandas", file=sys.stderr)
        sys.exit(1)

    required = {"user_id", "timestamp", "content_type_id", "answered_correctly"}
    df = pd.read_csv(args.input)
    missing = required - set(df.columns)
    if missing:
        print(f"Input CSV is missing expected columns: {missing}", file=sys.stderr)
        sys.exit(1)

    df = df.sort_values(["user_id", "timestamp"])
    user_ids = df["user_id"].unique()
    if args.max_users:
        user_ids = user_ids[: args.max_users]

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    written = 0
    with open(out_path, "w", encoding="utf-8") as fh:
        for uid in user_ids:
            user_rows = df[df["user_id"] == uid].to_dict("records")
            for feature_row in build_features_for_user(user_rows):
                fh.write(json.dumps(feature_row) + "\n")
                written += 1

    print(f"Wrote {written} feature rows for {len(user_ids)} users to {out_path}")


if __name__ == "__main__":
    main()
