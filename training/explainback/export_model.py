#!/usr/bin/env python3
"""Export the trained TF-IDF + Ridge pipeline to a browser-compatible
format.

Why JSON parameters instead of ONNX: skl2onnx's text-vectorizer support
for TfidfVectorizer is limited and version-fragile (in particular custom
tokenization/ngram handling frequently fails to convert cleanly), and a
linear model on top of TF-IDF is simple enough that raw JS arithmetic is
both easier to trust and easier to audit than an ONNX runtime dependency.
This is a documented limitation, not a fake export: see
../exports/README.md for the full export contract.

The exported JSON captures exactly what's needed to reproduce the
pipeline's score in pure JS: the TF-IDF vocabulary + idf weights (for
both the 1-gram and 2-gram terms scikit-learn's vectorizer learned) and
the Ridge model's coefficients + intercept. See scoreExplainBack.js
(exported alongside) for the reference implementation.

Usage:
    python3 export_model.py --model ../models/explainback/tfidf_ridge.joblib --output ../exports/explainback/model.json
"""
import argparse
import json
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, help="Path to a joblib pipeline from train.py")
    parser.add_argument("--output", required=True, help="Path to write the exported JSON")
    args = parser.parse_args()

    try:
        import joblib
    except ImportError:
        print("This script requires joblib: pip install joblib", file=sys.stderr)
        sys.exit(1)

    pipeline = joblib.load(args.model)
    tfidf = pipeline.named_steps["tfidf"]
    ridge = pipeline.named_steps["ridge"]

    vocabulary = {term: int(idx) for term, idx in tfidf.vocabulary_.items()}
    idf = tfidf.idf_.tolist()

    export = {
        "format": "nimiqlearn-tfidf-ridge-v1",
        "ngramRange": list(tfidf.ngram_range),
        "vocabulary": vocabulary,
        "idf": idf,
        "ridgeCoef": ridge.coef_.tolist(),
        "ridgeIntercept": float(ridge.intercept_),
        "note": "Score input as f'{referenceAnswer} [SEP] {learnerAnswer}' — same as training. See scoreExplainBack.js.",
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(export))
    size_kb = out_path.stat().st_size / 1024
    print(f"Exported {len(vocabulary)} vocabulary terms to {out_path} ({size_kb:.1f} KB)")
    print("Pair with scoreExplainBack.js for a pure-JS, no-runtime-dependency scorer.")


if __name__ == "__main__":
    main()
