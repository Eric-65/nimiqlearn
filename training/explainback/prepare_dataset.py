#!/usr/bin/env python3
"""Normalize the Automatic Short Answer Grading dataset into NimiqLearn's
schema, then split into train/val/test.

Does NOT assume column names — it inspects the actual CSV header and
matches against known aliases, failing loudly (listing what it found) if
nothing matches. This matters because Kaggle dataset uploads for the same
logical data frequently differ in exact column naming/casing.

Usage:
    python3 prepare_dataset.py --input ../data/raw/explainback/*.csv \
        --output-dir ../data/processed/explainback

Outputs (all under --output-dir):
    train.jsonl, val.jsonl, test.jsonl   — the normalized, split examples
    manifest.json                        — row counts, split ratios, seed,
                                            column mapping actually used
"""
import argparse
import glob
import json
import sys
from pathlib import Path

# Known column-name aliases seen across ASAG-style dataset uploads.
# The first match found in the actual CSV header wins for each field.
COLUMN_ALIASES = {
    "question": ["question", "questions", "prompt"],
    "referenceAnswer": ["model_answer", "reference_answer", "ideal_answer", "correct_answer", "teacher_answer"],
    "learnerAnswer": ["student_answer", "learner_answer", "answer", "response"],
    "score": ["teacher_marks", "score", "marks", "grade", "points"],
    "maxScore": ["total_marks", "max_marks", "max_score", "out_of", "total_score"],
}

# 3-way bucketing thresholds applied to normalizedScore. Documented here
# because the source dataset does not itself supply INCORRECT/PARTIAL/
# CORRECT labels — this script derives them, it does not invent evidence
# the data doesn't support.
LABEL_THRESHOLDS = {"INCORRECT_MAX": 0.34, "PARTIAL_MAX": 0.67}


def detect_columns(header):
    """Match each required field to one actual CSV column. Raises with a
    clear message (listing found vs. expected) if any field can't be
    matched — never silently assumes a column name."""
    header_lower = {h.lower().strip(): h for h in header}
    mapping = {}
    missing = []
    for field, aliases in COLUMN_ALIASES.items():
        found = next((header_lower[a] for a in aliases if a in header_lower), None)
        if found is None:
            missing.append((field, aliases))
        else:
            mapping[field] = found
    if missing:
        lines = [f"  - {field}: tried {aliases}" for field, aliases in missing]
        raise ValueError(
            "Could not match required column(s) to the actual CSV header.\n"
            + "\n".join(lines)
            + f"\nActual columns found in file: {list(header)}\n"
            + "Add the real column name to COLUMN_ALIASES in this script and re-run."
        )
    return mapping


def label_for(normalized_score):
    if normalized_score < LABEL_THRESHOLDS["INCORRECT_MAX"]:
        return "INCORRECT"
    if normalized_score < LABEL_THRESHOLDS["PARTIAL_MAX"]:
        return "PARTIAL"
    return "CORRECT"


def normalize_dataframe(df, mapping):
    """Returns (normalized_examples, stats) — stats documents exactly what
    was dropped and why, per the spec's "document rows before/after"."""
    stats = {"rows_before": len(df), "dropped_missing_fields": 0, "dropped_bad_maxscore": 0, "rows_after": 0}
    examples = []
    for _, row in df.iterrows():
        question = row.get(mapping["question"])
        ref = row.get(mapping["referenceAnswer"])
        learner = row.get(mapping["learnerAnswer"])
        score = row.get(mapping["score"])
        max_score = row.get(mapping["maxScore"])

        if any(v is None or (isinstance(v, float) and v != v) for v in [question, ref, learner, score, max_score]):
            stats["dropped_missing_fields"] += 1
            continue

        try:
            score = float(score)
            max_score = float(max_score)
        except (TypeError, ValueError):
            stats["dropped_missing_fields"] += 1
            continue

        if max_score <= 0:
            stats["dropped_bad_maxscore"] += 1
            continue

        normalized_score = max(0.0, min(1.0, score / max_score))
        examples.append({
            "question": str(question).strip(),
            "referenceAnswer": str(ref).strip(),
            "learnerAnswer": str(learner).strip(),
            "score": score,
            "maxScore": max_score,
            "normalizedScore": round(normalized_score, 4),
            "label": label_for(normalized_score),
        })

    stats["rows_after"] = len(examples)
    return examples, stats


def split_examples(examples, val_size, test_size, seed, group_by_question):
    """Reproducible train/val/test split. When group_by_question is set,
    all examples sharing the same question text stay in the same split —
    otherwise the same question (with a different student answer) could
    leak into both train and test, letting the model memorize per-question
    quirks instead of learning general answer-quality signal."""
    from sklearn.model_selection import GroupShuffleSplit, train_test_split

    if group_by_question:
        groups = [e["question"] for e in examples]
        gss1 = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
        trainval_idx, test_idx = next(gss1.split(examples, groups=groups))
        trainval = [examples[i] for i in trainval_idx]
        trainval_groups = [groups[i] for i in trainval_idx]
        relative_val = val_size / (1 - test_size)
        gss2 = GroupShuffleSplit(n_splits=1, test_size=relative_val, random_state=seed)
        train_idx, val_idx = next(gss2.split(trainval, groups=trainval_groups))
        train = [trainval[i] for i in train_idx]
        val = [trainval[i] for i in val_idx]
        test = [examples[i] for i in test_idx]
    else:
        trainval, test = train_test_split(examples, test_size=test_size, random_state=seed)
        relative_val = val_size / (1 - test_size)
        train, val = train_test_split(trainval, test_size=relative_val, random_state=seed)

    return train, val, test


def write_jsonl(path, rows):
    with open(path, "w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Glob for the raw ASAG CSV(s), e.g. ../data/raw/explainback/*.csv")
    parser.add_argument("--output-dir", required=True, help="Directory to write train/val/test.jsonl + manifest.json")
    parser.add_argument("--val-size", type=float, default=0.15)
    parser.add_argument("--test-size", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--group-by-question", action="store_true", default=True,
                         help="Keep all rows for the same question in one split (default: on)")
    parser.add_argument("--no-group-by-question", dest="group_by_question", action="store_false")
    args = parser.parse_args()

    try:
        import pandas as pd
    except ImportError:
        print("This script requires pandas. Install with: pip install pandas", file=sys.stderr)
        sys.exit(1)

    files = sorted(glob.glob(args.input))
    if not files:
        print(f"No files matched --input {args.input!r}. Run download_data.sh first.", file=sys.stderr)
        sys.exit(1)

    df = pd.concat([pd.read_csv(f) for f in files], ignore_index=True)
    mapping = detect_columns(df.columns)
    print(f"Detected column mapping: {mapping}")

    examples, stats = normalize_dataframe(df, mapping)
    print(f"Rows before preprocessing: {stats['rows_before']}")
    print(f"Dropped (missing/unparseable fields): {stats['dropped_missing_fields']}")
    print(f"Dropped (non-positive max score): {stats['dropped_bad_maxscore']}")
    print(f"Rows after preprocessing: {stats['rows_after']}")

    if stats["rows_after"] < 20:
        print("Too few usable rows to split/train meaningfully.", file=sys.stderr)
        sys.exit(1)

    train, val, test = split_examples(examples, args.val_size, args.test_size, args.seed, args.group_by_question)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    write_jsonl(out_dir / "train.jsonl", train)
    write_jsonl(out_dir / "val.jsonl", val)
    write_jsonl(out_dir / "test.jsonl", test)

    manifest = {
        "source_files": files,
        "column_mapping": mapping,
        "label_thresholds": LABEL_THRESHOLDS,
        "preprocessing_stats": stats,
        "split": {
            "seed": args.seed,
            "group_by_question": args.group_by_question,
            "val_size": args.val_size,
            "test_size": args.test_size,
            "n_train": len(train),
            "n_val": len(val),
            "n_test": len(test),
        },
    }
    with open(out_dir / "manifest.json", "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)

    print(f"Wrote train={len(train)} val={len(val)} test={len(test)} to {out_dir}")
    print(f"Manifest: {out_dir / 'manifest.json'}")


if __name__ == "__main__":
    main()
