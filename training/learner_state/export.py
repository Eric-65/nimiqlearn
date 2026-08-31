#!/usr/bin/env python3
"""Export the trained logistic regression to JSON — trivial, since it's
just a StandardScaler (mean/scale) + linear coefficients + a sigmoid.
No ONNX needed; this is small enough for plain JS arithmetic.

Usage:
    python3 export.py --model ../models/learner_state/logreg.joblib --output ../exports/learner_state/model.json
"""
import argparse
import json
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, help="Path to a joblib artifact from train.py")
    parser.add_argument("--output", required=True, help="Path to write the exported JSON")
    args = parser.parse_args()

    try:
        import joblib
    except ImportError:
        print("This script requires joblib: pip install joblib", file=sys.stderr)
        sys.exit(1)

    artifact = joblib.load(args.model)
    pipeline = artifact["pipeline"]
    scaler = pipeline.named_steps["scale"]
    logreg = pipeline.named_steps["logreg"]

    export = {
        "format": "nimiqlearn-learner-state-logreg-v1",
        "featureKeys": artifact["feature_keys"],
        "scalerMean": scaler.mean_.tolist(),
        "scalerScale": scaler.scale_.tolist(),
        "coef": logreg.coef_[0].tolist(),
        "intercept": float(logreg.intercept_[0]),
        "note": "Feature order matches featureKeys; see scoreLearnerState.js for the plain-JS scorer.",
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(export, indent=2))
    print(f"Exported logistic regression ({len(export['coef'])} features) to {out_path}")


if __name__ == "__main__":
    main()
