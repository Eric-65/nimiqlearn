#!/usr/bin/env python3
"""Normalize the Automatic Short Answer Grading dataset into NimiqLearn's
schema: {topic, question, referenceAnswer, learnerAnswer, score, maxScore,
normalizedScore}.

The dataset is synthetically generated (see ../datasets/README.md) — this
script does not claim to produce real-world student ground truth, only a
normalized development/evaluation set.

Usage:
    python3 prepare_dataset.py --input raw/asag.csv --output processed/examples.jsonl
"""
import argparse
import json
import sys
from pathlib import Path

RAW_COLUMNS = ["question", "model_answer", "student_answer", "teacher_marks", "total_marks"]


def normalize_row(row, topic_map=None):
    question = str(row["question"]).strip()
    max_score = float(row["total_marks"])
    score = float(row["teacher_marks"])
    if max_score <= 0:
        raise ValueError(f"Non-positive total_marks for question: {question[:60]!r}")

    return {
        "topic": (topic_map or {}).get(question),
        "question": question,
        "referenceAnswer": str(row["model_answer"]).strip(),
        "learnerAnswer": str(row["student_answer"]).strip(),
        "score": score,
        "maxScore": max_score,
        "normalizedScore": round(score / max_score, 4),
    }


def load_topic_map(path):
    if not path:
        return {}
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Path to the raw ASAG CSV")
    parser.add_argument("--output", required=True, help="Path to write normalized JSONL")
    parser.add_argument("--topic-map", default=None, help="Optional JSON file mapping question text -> topic id")
    args = parser.parse_args()

    try:
        import pandas as pd
    except ImportError:
        print("This script requires pandas. Install with: pip install pandas", file=sys.stderr)
        sys.exit(1)

    df = pd.read_csv(args.input)
    missing = [c for c in RAW_COLUMNS if c not in df.columns]
    if missing:
        print(f"Input CSV is missing expected columns: {missing}", file=sys.stderr)
        print(f"Found columns: {list(df.columns)}", file=sys.stderr)
        sys.exit(1)

    topic_map = load_topic_map(args.topic_map)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    written, skipped = 0, 0
    with open(out_path, "w", encoding="utf-8") as fh:
        for _, row in df.iterrows():
            try:
                example = normalize_row(row, topic_map)
            except (ValueError, KeyError) as err:
                skipped += 1
                print(f"Skipping row: {err}", file=sys.stderr)
                continue
            fh.write(json.dumps(example) + "\n")
            written += 1

    print(f"Wrote {written} examples to {out_path} ({skipped} skipped).")


if __name__ == "__main__":
    main()
