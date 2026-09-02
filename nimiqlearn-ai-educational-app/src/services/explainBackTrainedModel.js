/* ============================================================
   NimiqLearn — trained ExplainBack model (real, verified)
   ------------------------------------------------------------
   Two real models trained on the real Automatic Short Answer
   Grading dataset (the Mohler corpus — see training/README.md
   and training/explainback/README.md for the full pipeline,
   evaluation report, and verification trail):

     - a TF-IDF + Ridge REGRESSOR predicting a continuous
       similarity-based score in [0, 1]
     - a TF-IDF + LogisticRegression CLASSIFIER predicting
       INCORRECT / PARTIAL / CORRECT directly

   Both beat their respective baselines on the real held-out test
   split (training/evaluation/reports/explainback_eval.md — MAE
   0.17 vs 0.62 for the regressor; macro-F1 0.39 vs 0.10 for the
   classifier against the untrained lexical baseline).

   The JS implementation here (TF-IDF vectorization + linear
   scoring) is copied from training/exports/explainback/
   scoreExplainBack.js and classifyExplainBack.js, verified
   bit-for-bit against the Python models' predictions at export
   time — see that directory's README for the verification method.

   IMPORTANT DOMAIN CAVEAT: this model was trained on general
   introductory CS short-answer questions (Mohler dataset — e.g.
   "what does a function signature include?"), not on NimiqLearn's
   specific curriculum (Linear Algebra, Newton's Laws, etc). It has
   no idea what a "prototype" or "eigenvalue" means beyond surface
   text overlap with the reference answer. For this reason
   assessmentService.js treats it as an ADDITIONAL signal that
   refines the topic-aware rubric baseline — never as a replacement
   for it, and never as the sole source of truth. See
   training/exports/README.md, "Before wiring either model in."
   ============================================================ */

import regressorModel from "../data/models/explainbackRegressor.json";
import classifierModel from "../data/models/explainbackClassifier.json";

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .match(/[a-z0-9]{2,}/g) || [];
}

function ngrams(tokens, ranges) {
  const [minN, maxN] = ranges;
  const out = [];
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i + n <= tokens.length; i++) {
      out.push(tokens.slice(i, i + n).join(" "));
    }
  }
  return out;
}

function tfidfVector(text, vocabulary, idf, ngramRange) {
  const terms = ngrams(tokenize(text), ngramRange);
  const counts = new Map();
  for (const t of terms) counts.set(t, (counts.get(t) || 0) + 1);

  const size = idf.length;
  const vec = new Float64Array(size);
  for (const [term, count] of counts) {
    const idx = vocabulary[term];
    if (idx === undefined) continue; // out-of-vocabulary term, ignored
    vec[idx] = count * idf[idx];
  }

  let norm = 0;
  for (let i = 0; i < size; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < size; i++) vec[i] /= norm;

  return vec;
}

function softmax(scores) {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Real trained regressor. Returns a similarity-based score in [0, 1]. */
export function scoreWithTrainedModel(referenceAnswer, learnerAnswer) {
  const text = `${referenceAnswer} [SEP] ${learnerAnswer}`;
  const vec = tfidfVector(text, regressorModel.vocabulary, regressorModel.idf, regressorModel.ngramRange);
  let dot = regressorModel.ridgeIntercept;
  for (let i = 0; i < vec.length; i++) {
    if (vec[i] !== 0) dot += vec[i] * regressorModel.ridgeCoef[i];
  }
  return Math.max(0, Math.min(1, dot));
}

/** Real trained classifier. Returns { label, probabilities }. */
export function classifyWithTrainedModel(referenceAnswer, learnerAnswer) {
  const text = `${referenceAnswer} [SEP] ${learnerAnswer}`;
  const vec = tfidfVector(text, classifierModel.vocabulary, classifierModel.idf, classifierModel.ngramRange);

  const rawScores = classifierModel.classes.map((_, c) => {
    let dot = classifierModel.intercept[c];
    const coefRow = classifierModel.coef[c];
    for (let i = 0; i < vec.length; i++) {
      if (vec[i] !== 0) dot += vec[i] * coefRow[i];
    }
    return dot;
  });

  const probs = softmax(rawScores);
  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[bestIdx]) bestIdx = i;

  const probabilities = {};
  classifierModel.classes.forEach((label, i) => { probabilities[label] = probs[i]; });

  return { label: classifierModel.classes[bestIdx], probabilities };
}
