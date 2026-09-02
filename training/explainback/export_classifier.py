#!/usr/bin/env python3
"""Export the trained TF-IDF + LogisticRegression classifier
(train_classifier.py) to a browser-compatible format.

Same reasoning as export_model.py for JSON-over-ONNX (see that file's
docstring). Captures the TF-IDF vocabulary/idf (shared vectorization
scheme with the regressor) plus the classifier's per-class coefficients,
intercepts, and class order — everything classifyExplainBack.js needs to
reproduce scikit-learn's predict()/predict_proba() in pure JS.

Usage:
    python3 export_classifier.py --model ../models/explainback/tfidf_logreg.joblib --output ../exports/explainback/classifier.json
"""
import argparse
import json
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, help="Path to a joblib pipeline from train_classifier.py")
    parser.add_argument("--output", required=True, help="Path to write the exported JSON")
    args = parser.parse_args()

    try:
        import joblib
    except ImportError:
        print("This script requires joblib: pip install joblib", file=sys.stderr)
        sys.exit(1)

    pipeline = joblib.load(args.model)
    tfidf = pipeline.named_steps["tfidf"]
    logreg = pipeline.named_steps["logreg"]

    vocabulary = {term: int(idx) for term, idx in tfidf.vocabulary_.items()}
    idf = tfidf.idf_.tolist()

    export = {
        "format": "nimiqlearn-tfidf-logreg-v1",
        "ngramRange": list(tfidf.ngram_range),
        "vocabulary": vocabulary,
        "idf": idf,
        "classes": list(logreg.classes_),
        "coef": logreg.coef_.tolist(),
        "intercept": logreg.intercept_.tolist(),
        "note": "Score input as f'{referenceAnswer} [SEP] {learnerAnswer}' — same as training. See classifyExplainBack.js.",
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(export))
    size_kb = out_path.stat().st_size / 1024
    print(f"Exported {len(vocabulary)} vocabulary terms, {len(logreg.classes_)} classes to {out_path} ({size_kb:.1f} KB)")
    print("Pair with classifyExplainBack.js for a pure-JS, no-runtime-dependency classifier.")


if __name__ == "__main__":
    main()
