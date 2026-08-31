#!/usr/bin/env python3
"""Generate a SYNTHETIC stand-in for the Automatic Short Answer Grading
dataset, matching its raw column names (question, model_answer,
student_answer, teacher_marks, total_marks).

THIS IS NOT THE REAL KAGGLE DATASET. It exists only because this
environment's network egress proxy blocks kaggle.com, so the real
dataset could not be downloaded here (see ../datasets/README.md). It
lets the rest of the pipeline (prepare_dataset.py -> baseline.py ->
train.py -> evaluate.py -> export_model.py) be proven to actually run,
end to end, with real (not fabricated) metrics computed on this
synthetic data — those metrics say nothing about performance on the
real dataset.

Fixed seed for reproducibility: anyone can regenerate the exact same
file this repo's committed evaluation report was computed from.

Usage:
    python3 make_synthetic_sample.py --output ../data/raw/explainback/SYNTHETIC_asag_sample.csv --n-per-question 40
"""
import argparse
import csv
import random
import sys
from pathlib import Path

# (question, model_answer, [phrase fragments that indicate a correct answer])
QUESTIONS = [
    (
        "What does it mean to solve a linear equation like 3x + 5 = 20?",
        "It means isolating x using inverse operations while keeping both sides of the equation balanced, until x stands alone.",
        ["isolate", "balance", "both sides", "inverse operation"],
    ),
    (
        "What is the discriminant of a quadratic equation and what does it tell you?",
        "The discriminant is b squared minus 4ac. It tells you how many real roots the quadratic has.",
        ["discriminant", "b squared", "4ac", "real roots"],
    ),
    (
        "How do you tell whether a graph represents a function?",
        "Use the vertical line test. If a vertical line crosses the graph more than once at any point, it is not a function.",
        ["vertical line", "one output", "function"],
    ),
    (
        "Explain Newton's second law in your own words.",
        "Net force equals mass times acceleration. A larger force produces more acceleration, and a larger mass resists acceleration more.",
        ["force", "mass", "acceleration", "f=ma", "f = ma"],
    ),
    (
        "What is the difference between kinetic and potential energy?",
        "Kinetic energy is the energy of motion, equal to one half mass times velocity squared. Potential energy is stored energy due to position, such as height above the ground.",
        ["motion", "velocity", "stored", "position", "height"],
    ),
    (
        "What is the difference between = and == in Python?",
        "A single equals sign assigns a value to a variable, while a double equals sign compares two values and returns True or False.",
        ["assign", "compare", "true", "false"],
    ),
    (
        "What is the difference between training and inference in machine learning?",
        "Training is when a model learns patterns from data by adjusting its parameters. Inference is using the already trained model to make predictions on new input.",
        ["train", "learn", "parameters", "infer", "predict"],
    ),
]

# (student answer template, teacher-marks fraction it should imply, given the question's key fragments)
def make_student_answer(model_answer, key_fragments, quality, rng):
    """quality in {"correct","partial","wrong"} — samples a plausible, imperfect
    paraphrase, not a copy of the model answer, so lexical-similarity baselines
    don't trivially "solve" this synthetic set."""
    words = model_answer.replace(".", "").split()
    if quality == "correct":
        keep = rng.sample(words, k=max(3, int(len(words) * 0.7)))
        rng.shuffle(keep)
        return " ".join(keep) + "."
    if quality == "partial":
        keep = rng.sample(words, k=max(2, int(len(words) * 0.35)))
        filler = ["I", "think", "it", "is", "something", "like", "maybe", "kind", "of"]
        return " ".join(rng.sample(filler, k=3) + keep) + "."
    # wrong / off-topic
    off_topic = ["I", "am", "not", "sure", "about", "this", "topic", "at", "all", "sorry"]
    return " ".join(rng.sample(off_topic, k=len(off_topic))) + "."


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--n-per-question", type=int, default=40)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    rows = []
    for question, model_answer, _fragments in QUESTIONS:
        for _ in range(args.n_per_question):
            quality = rng.choices(["correct", "partial", "wrong"], weights=[0.4, 0.35, 0.25])[0]
            student_answer = make_student_answer(model_answer, _fragments, quality, rng)
            total_marks = 5
            teacher_marks = {"correct": rng.choice([4, 5]), "partial": rng.choice([2, 3]), "wrong": rng.choice([0, 1])}[quality]
            rows.append({
                "question": question,
                "model_answer": model_answer,
                "student_answer": student_answer,
                "teacher_marks": teacher_marks,
                "total_marks": total_marks,
            })

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["question", "model_answer", "student_answer", "teacher_marks", "total_marks"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} SYNTHETIC rows (seed={args.seed}) to {out_path}")
    print("This is demo/test fixture data, not the real Kaggle dataset.")


if __name__ == "__main__":
    main()
