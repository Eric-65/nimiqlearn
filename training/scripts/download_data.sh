#!/usr/bin/env bash
# NimiqLearn — offline dataset download
# ------------------------------------------------------------
# This script is a manual, separate developer operation. It is never run
# by npm install / npm run dev / npm run build, and never runs inside the
# production app or CI for the app itself.
#
# It could not be executed from the Claude Code sandbox that built this
# pipeline — that environment's network egress proxy blocks kaggle.com
# entirely. Run this yourself, wherever you have real Kaggle access.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./download_data.sh [explainback|learner_state|all]

Requires the Kaggle CLI and an authenticated ~/.kaggle/kaggle.json:
  pip install kaggle
  # Kaggle account -> Settings -> API -> "Create New Token" downloads
  # kaggle.json. Place it at ~/.kaggle/kaggle.json and:
  chmod 600 ~/.kaggle/kaggle.json

Never commit kaggle.json or embed its contents in source code.
EOF
}

download_explainback() {
  echo "Downloading Automatic Short Answer Grading dataset..."
  echo "Source: https://www.kaggle.com/datasets/mubeenfurqanahmed/automatic-short-answer-grading-dataset"
  kaggle datasets download \
    -d mubeenfurqanahmed/automatic-short-answer-grading-dataset \
    -p ../data/raw/explainback \
    --unzip
  echo "Expected location: training/data/raw/explainback/*.csv"
  echo "Re-check the dataset's License section on the page above before"
  echo "redistributing anything derived from it — see ../datasets/README.md."
}

download_learner_state() {
  echo "Downloading Riiid Answer Correctness Prediction competition data..."
  echo "Source: https://www.kaggle.com/competitions/riiid-test-answer-prediction/data"
  echo "You must join the competition on the Kaggle website first."
  kaggle competitions download \
    -c riiid-test-answer-prediction \
    -p ../data/raw/learner_state
  unzip -o ../data/raw/learner_state/riiid-test-answer-prediction.zip -d ../data/raw/learner_state
  echo "Expected location: training/data/raw/learner_state/train.csv (+ questions.csv, lectures.csv)"
  echo "Re-read the competition's current Rules tab before using the"
  echo "resulting artifacts publicly — see ../datasets/README.md."
}

case "${1:-}" in
  explainback) download_explainback ;;
  learner_state) download_learner_state ;;
  all) download_explainback; download_learner_state ;;
  *) usage; exit 1 ;;
esac
