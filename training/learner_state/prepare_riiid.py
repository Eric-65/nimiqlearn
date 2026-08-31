#!/usr/bin/env python3
"""Aggregate the raw Riiid interaction log into per-attempt feature rows
matching the shape src/services/learnerStateService.js already consumes:
recentCorrectness, attemptCount, recentFailures, topicMastery,
timeSinceReviewMs -> label_nextCorrect.

Column names below (user_id, content_id, content_type_id, timestamp,
answered_correctly) are the actual Riiid competition schema, not a guess
— see https://www.kaggle.com/competitions/riiid-test-answer-prediction/data.
This script still verifies them against the real file header and fails
loudly if they don't match, in case Kaggle's export ever changes.

Chronological ordering is preserved per user (each feature row only uses
that user's OWN prior history — see AVOID DATA LEAKAGE in ../README.md).
`learnerId` is carried through into every output row so a downstream
train/test split can be done by user group, not by row — otherwise the
same learner's rows could land in both train and test, which would leak
information about that learner's overall skill level across the split.

Usage:
    python3 prepare_riiid.py --input ../data/raw/learner_state/train.csv \
        --output ../data/processed/learner_state/features.jsonl
"""
import argparse
import json
import sys
from pathlib import Path

REQUIRED_COLUMNS = ["user_id", "content_type_id", "timestamp", "answered_correctly"]
WINDOW = 8  # matches the app's own recentPerformance ring buffer size (see mockLearner.js)


def build_features_for_user(user_id, rows):
    """rows: one user's interactions, already sorted by timestamp. Yields
    one feature row per attempt, using only that user's PRIOR history —
    never information from the attempt being predicted or from later
    attempts (no leakage across time)."""
    history = []
    last_timestamp = None
    for row in rows:
        if row.get("content_type_id") == 1:
            continue  # lecture row, not a question — no correctness label

        correct = int(row["answered_correctly"])
        timestamp = int(row["timestamp"])

        if history:
            recent = history[-WINDOW:]
            attempt_count = len(history)
            recent_failures = sum(1 for r in recent if r == 0)
            topic_mastery = sum(history) / len(history)
            time_since_review_ms = timestamp - last_timestamp if last_timestamp is not None else None

            yield {
                "learnerId": str(user_id),
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

    df = pd.read_csv(args.input)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        print(f"Input CSV is missing expected columns: {missing}", file=sys.stderr)
        print(f"Actual columns found: {list(df.columns)}", file=sys.stderr)
        print("If Kaggle's schema changed, update REQUIRED_COLUMNS in this script.", file=sys.stderr)
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
            for feature_row in build_features_for_user(uid, user_rows):
                fh.write(json.dumps(feature_row) + "\n")
                written += 1

    print(f"Rows in raw file: {len(df)}")
    print(f"Users processed: {len(user_ids)}")
    print(f"Feature rows written (post lecture-row filtering, first attempt per user excluded): {written}")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
