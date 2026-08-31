#!/usr/bin/env python3
"""ExplainBack baseline: "what happens without machine learning?"

Computes TF-IDF cosine similarity between each learnerAnswer and its
referenceAnswer and uses that directly as the predicted normalizedScore.
No fitting/training happens — the TF-IDF vectorizer is fit fresh on
whatever split it's run against, purely to turn text into comparable
vectors. This is NOT a claim of semantic understanding: it is lexical
overlap, nothing more, and exists so train.py's learned model has
something concrete to beat.

Usage:
    python3 baseline.py --input ../data/processed/explainback/test.jsonl
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


def label_for(score):
    if score < 0.34:
        return "INCORRECT"
    if score < 0.67:
        return "PARTIAL"
    return "CORRECT"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="A split JSONL from prepare_dataset.py (usually test.jsonl)")
    args = parser.parse_args()

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
    except ImportError:
        print("This script requires scikit-learn: pip install scikit-learn", file=sys.stderr)
        sys.exit(1)

    examples = load_examples(args.input)
    if not examples:
        print("No examples found.", file=sys.stderr)
        sys.exit(1)

    references = [e["referenceAnswer"] for e in examples]
    learners = [e["learnerAnswer"] for e in examples]

    # Fit on the union of both sides of this split so both are in the same
    # vocabulary space — this is a similarity metric, not a trained model,
    # so fitting per-split (rather than reusing a train-set vocabulary)
    # does not leak any label information.
    vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
    vectors = vectorizer.fit_transform(references + learners)
    n = len(examples)
    ref_vectors, learner_vectors = vectors[:n], vectors[n:]

    predictions = []
    for i in range(n):
        sim = cosine_similarity(ref_vectors[i], learner_vectors[i])[0, 0]
        predictions.append(max(0.0, min(1.0, float(sim))))

    predictions_path = args.input.replace(".jsonl", ".baseline_predictions.json")
    with open(predictions_path, "w", encoding="utf-8") as fh:
        json.dump({"predictions": predictions, "labels": [label_for(p) for p in predictions]}, fh)

    print(f"Computed TF-IDF cosine-similarity baseline for {n} examples.")
    print(f"Predictions written to {predictions_path} (consumed by evaluate.py).")
    print("This is a lexical-overlap signal only — it does not demonstrate semantic understanding.")


if __name__ == "__main__":
    main()
