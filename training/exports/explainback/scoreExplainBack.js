/* ============================================================
   NimiqLearn — reference pure-JS scorer for the exported
   TF-IDF + Ridge ExplainBack model (training/exports/explainback/model.json)
   ------------------------------------------------------------
   NOT wired into the app. This is the reference adapter promised by
   the export contract (see ../README.md) — proof that the trained
   model CAN run as plain JS with no ML runtime dependency, so
   src/services/assessmentService.js can add a "trained-assessment-model"
   path later without an architecture change.

   Reproduces scikit-learn's TfidfVectorizer(ngram_range=(1,2)): lowercase,
   \w{2,} word tokenization, 1- and 2-grams, smoothed IDF, L2-normalized
   output vector. Verified bit-for-bit (diff 0.000000) against the Python
   pipeline's predict() on 5 held-out test examples when this export was
   produced — see the "Export verification" note in ../README.md. Still,
   re-verify after regenerating model.json from a different/real dataset,
   since sklearn version or tokenizer edge cases could change the match.
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

/** vocabulary: {term: index}, idf: number[] (same length as vocabulary) */
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

  // L2 normalize (scikit-learn TfidfVectorizer default norm="l2")
  let norm = 0;
  for (let i = 0; i < size; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < size; i++) vec[i] /= norm;

  return vec;
}

/**
 * @param {{vocabulary: object, idf: number[], ngramRange: number[], ridgeCoef: number[], ridgeIntercept: number}} model
 *        the parsed contents of model.json
 * @param {string} referenceAnswer
 * @param {string} learnerAnswer
 * @returns {number} predicted normalizedScore, clamped to [0, 1]
 */
export function scoreExplainBack(model, referenceAnswer, learnerAnswer) {
  const text = `${referenceAnswer} [SEP] ${learnerAnswer}`;
  const vec = tfidfVector(text, model.vocabulary, model.idf, model.ngramRange);

  let dot = model.ridgeIntercept;
  for (let i = 0; i < vec.length; i++) {
    if (vec[i] !== 0) dot += vec[i] * model.ridgeCoef[i];
  }
  return Math.max(0, Math.min(1, dot));
}
