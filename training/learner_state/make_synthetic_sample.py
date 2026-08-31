#!/usr/bin/env python3
"""Generate a SYNTHETIC stand-in for the Riiid Answer Correctness
Prediction dataset, matching its raw column names (user_id, content_id,
content_type_id, timestamp, answered_correctly).

THIS IS NOT THE REAL KAGGLE COMPETITION DATASET. It exists only because
this environment's network egress proxy blocks kaggle.com, so the real
dataset could not be downloaded here (see ../datasets/README.md). It
lets the rest of the pipeline (prepare_riiid.py -> split_dataset.py ->
baseline.py -> train.py -> evaluate.py -> export.py) be proven to
actually run, end to end, with real (not fabricated) metrics computed on
this synthetic data — those metrics say nothing about performance on the
real dataset.

Each synthetic learner has a hidden, slowly-improving skill level; answer
correctness is sampled from that skill plus noise, so there is genuine
(if simple) learnable structure — a completely random correctness label
would make the whole exercise meaningless for either the baseline or a
trained model. Fixed seed for reproducibility.

Usage:
    python3 make_synthetic_sample.py --output ../data/raw/learner_state/SYNTHETIC_riiid_sample.csv --n-users 120 --interactions-per-user 60
"""
import argparse
import csv
import random
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--n-users", type=int, default=120)
    parser.add_argument("--interactions-per-user", type=int, default=60)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    rows = []
    row_id = 0
    for user_id in range(args.n_users):
        skill = rng.uniform(0.25, 0.55)  # starting skill (probability of a correct answer)
        learning_rate = rng.uniform(0.0005, 0.003)
        timestamp = 0
        for i in range(args.interactions_per_user):
            timestamp += rng.randint(30_000, 3_600_000)  # 30s to 1hr between interactions, ms

            if rng.random() < 0.05:
                # occasional lecture row — not a question, no correctness label
                rows.append({
                    "row_id": row_id, "user_id": user_id, "content_id": rng.randint(9000, 9999),
                    "content_type_id": 1, "timestamp": timestamp, "answered_correctly": -1,
                })
                row_id += 1
                continue

            p_correct = max(0.02, min(0.98, skill + rng.gauss(0, 0.12)))
            answered_correctly = 1 if rng.random() < p_correct else 0
            rows.append({
                "row_id": row_id, "user_id": user_id, "content_id": rng.randint(0, 500),
                "content_type_id": 0, "timestamp": timestamp, "answered_correctly": answered_correctly,
            })
            row_id += 1
            skill = min(0.97, skill + learning_rate)  # slow improvement with practice

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["row_id", "user_id", "content_id", "content_type_id", "timestamp", "answered_correctly"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} SYNTHETIC rows for {args.n_users} users (seed={args.seed}) to {out_path}")
    print("This is demo/test fixture data, not the real Kaggle competition dataset.")


if __name__ == "__main__":
    main()
