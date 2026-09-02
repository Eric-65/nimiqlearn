/* ============================================================
   NimiqLearn — reference pure-JS classifier for the exported
   TF-IDF + LogisticRegression ExplainBack model
   (training/exports/explainback/classifier.json)
   ------------------------------------------------------------
   NOT wired into the app on its own — see scoreExplainBack.js for the
   regressor twin. Same TF-IDF vectorization as scoreExplainBack.js
   (duplicated here, not imported, so each exported model stays a
   self-contained reference file per the existing convention).

   Reproduces scikit-learn's multinomial LogisticRegression.predict():
   raw score per class = coef[c] . x + intercept[c], softmax to get
   probabilities, argmax to get the predicted class. Verify bit-for-bit
   against Python's predict()/predict_proba() on held-out examples any
   time classifier.json is regenerated (same caveat as the regressor).
   ============================================================ */

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
    if (idx === undefined) continue;
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

/**
 * @param {{vocabulary: object, idf: number[], ngramRange: number[], classes: string[], coef: number[][], intercept: number[]}} model
 *        the parsed contents of classifier.json
 * @param {string} referenceAnswer
 * @param {string} learnerAnswer
 * @returns {{label: string, probabilities: Record<string, number>}}
 */
export function classifyExplainBack(model, referenceAnswer, learnerAnswer) {
  const text = `${referenceAnswer} [SEP] ${learnerAnswer}`;
  const vec = tfidfVector(text, model.vocabulary, model.idf, model.ngramRange);

  const rawScores = model.classes.map((_, c) => {
    let dot = model.intercept[c];
    const coefRow = model.coef[c];
    for (let i = 0; i < vec.length; i++) {
      if (vec[i] !== 0) dot += vec[i] * coefRow[i];
    }
    return dot;
  });

  const probs = softmax(rawScores);
  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[bestIdx]) bestIdx = i;

  const probabilities = {};
  model.classes.forEach((label, i) => { probabilities[label] = probs[i]; });

  return { label: model.classes[bestIdx], probabilities };
}
