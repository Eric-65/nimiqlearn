/* ============================================================
   NimiqLearn — Generic AI service (singleton, prewarmed lifecycle)
   ------------------------------------------------------------
   Model-agnostic. The rest of the app never cares which model is
   active — it calls initializeAI() / generateLearningResponse().

   Active model:
     onnx-community/SmolLM2-135M-Instruct-ONNX-MHA  (q4f16, ~118 MB
     for that one quantized artifact — the HF repo itself contains
     several variants and is much larger in total)
        ↓ if init fails on every runtime
     deterministic educational engine (application code)

   Lifecycle: idle → checking → loading → ready | fallback | error
   (generating is transient while a generation runs)

   - ONE singleton pipeline, ever (StrictMode-safe).
   - Prewarm triggers all converge on initializeAI().
   - WebGPU when present; WASM compatibility runtime otherwise.
   - The model never blocks the initial React render.

   Transformers.js itself is imported statically from the installed npm
   package (below), not fetched at runtime from a CDN — that removed a
   real production risk (CDN outage/CORS/CSP/ad-blocker breaking the
   whole AI feature) for no benefit, since the exact same version was
   already pinned in package.json. Only the model WEIGHTS (via Hugging
   Face) and onnxruntime-web's WASM backend (which ships its binary via
   jsDelivr by default — a separate, expected runtime fetch outside our
   control) are ever fetched over the network at runtime.
   ============================================================ */

import { pipeline, env, TextStreamer } from "@huggingface/transformers";

export const AI_STATUS = {
  IDLE: "idle",
  CHECKING: "checking",
  LOADING: "loading",
  READY: "ready", // active on WebGPU
  FALLBACK: "fallback", // active on the WASM compatibility runtime
  GENERATING: "generating",
  ERROR: "error", // model failed → deterministic fallback path
};

export const PRIMARY_MODEL = "onnx-community/SmolLM2-135M-Instruct-ONNX-MHA";
// No second large language model — SmolLM2-135M is already the lightweight
// interactive model. A failed load falls back to the deterministic engine.
export const FALLBACK_MODEL = null;
export const MODEL_DTYPE = "q4f16"; // matches model_q4f16.onnx (~118 MB)
// Last-resort compatibility fallback if q4f16 fails to load on WASM —
// see the attempt plan in runLifecycle() below.
export const MODEL_DTYPE_FALLBACK = "q4";

const CACHE_FLAG_KEY = "nimiqlearn:model-cached";
const PRELOAD_FLAG_KEY = "nimiqlearn:preload";

/* ---------------- timing budgets ---------------- */
const MODEL_INIT_TIMEOUT = 6 * 60_000; // ~118 MB download + init
const GENERATION_TIMEOUT = 120_000;

/* ---------------- lifecycle state ---------------- */
let initPromise = null; // singleton across the whole app
let generator = null; // resolved pipeline

let lifecycle = {
  status: AI_STATUS.IDLE,
  model: null,
  stage: null,
  device: null,
  fallback: false,
  webgpu: null,
  cached: false,
  progress: { percent: 0, file: null, detail: "" },
  error: null,
  attempts: [],
  metrics: {},
};

const listeners = new Set();

function setState(patch) {
  lifecycle = { ...lifecycle, ...patch };
  listeners.forEach((fn) => {
    try {
      fn(getAIState());
    } catch {
      /* listener errors must never break AI init */
    }
  });
}

export function getAIState() {
  return { ...lifecycle, progress: { ...lifecycle.progress }, attempts: [...lifecycle.attempts] };
}

export function subscribeAI(fn) {
  listeners.add(fn);
  fn(getAIState());
  return () => listeners.delete(fn);
}

/* ---------------- capability detection ---------------- */

export function supportsWebGPU() {
  try {
    return typeof navigator !== "undefined" && "gpu" in navigator && !!navigator.gpu;
  } catch {
    return false;
  }
}

/** Lightweight capability hint kept for diagnostics (device memory / cores). */
export function isConstrainedDevice() {
  try {
    if (typeof navigator === "undefined") return false;
    const mem = navigator.deviceMemory;
    const cores = navigator.hardwareConcurrency;
    if (typeof mem === "number" && mem < 4) return true;
    if (typeof cores === "number" && cores < 4) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * A HINT only — set after a real successful pipeline() load, but never
 * proof the model still exists in this browser's cache (storage can be
 * cleared, the browser/WebView/device can change, a prior download can
 * have been incomplete). Nothing in this file skips the real
 * initializeAI() -> pipeline() call based on this flag; it only affects
 * display text (wasCached) and whether the conservative idle-preload
 * opts in (maybePreloadAI). Actual readiness always comes from the
 * pipeline itself.
 */
export function isModelCached() {
  try {
    return localStorage.getItem(CACHE_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function markModelCached() {
  try {
    localStorage.setItem(CACHE_FLAG_KEY, "1");
  } catch {
    /* ignore */
  }
}

function getPreloadFlag() {
  try {
    return localStorage.getItem(PRELOAD_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function isAIReady() {
  return lifecycle.status === AI_STATUS.READY || lifecycle.status === AI_STATUS.FALLBACK;
}

export function getActiveModelId() {
  return lifecycle.model;
}

/* ---------------- helpers ---------------- */

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${Math.round(ms / 1000)}s (${label})`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function recordAttempt(entry) {
  const attempt = { at: new Date().toISOString(), ...entry };
  lifecycle.attempts = [...lifecycle.attempts, attempt].slice(-12);
  return attempt;
}

function logInitFailure(err, { model, device, dtype, stage }) {
  console.error("[NimiqLearn] AI initialization failed", {
    model,
    device,
    dtype,
    stage,
    error: err?.message || err,
    webGPU: supportsWebGPU(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
  });
}

/* ---------------- model loading ---------------- */

function emitProgress(data, modelId, device) {
  if (!data) return;
  if (data.status === "progress") {
    const pct = typeof data.progress === "number" ? Math.round(data.progress) : 0;
    setState({
      stage: "download",
      model: modelId,
      device,
      progress: {
        percent: Math.max(5, Math.min(92, pct)),
        file: data.file || null,
        detail: `Downloading ${(data.file || "").split("/").pop() || "model files"}…`,
      },
    });
    if (data.total && !lifecycle.metrics.totalBytes) {
      lifecycle.metrics = { ...lifecycle.metrics, totalBytes: data.total };
    }
  } else if (data.status === "done" || data.status === "ready") {
    setState({ stage: "prepare", progress: { percent: 94, file: null, detail: "Finalizing the model…" } });
  }
}

async function loadModel(modelId, device, dtype) {
  env.allowLocalModels = false; // always fetch from the Hub (browser-cached)
  env.useBrowserCache = true; // reuse previously downloaded weights (Cache API)

  setState({
    status: AI_STATUS.LOADING,
    stage: `load:${modelId.split("/").pop()}:${device}:${dtype}`,
    model: modelId,
    device,
    progress: { percent: 2, file: null, detail: "Loading NimiqLearn AI…" },
  });

  const progress_callback = (data) => emitProgress(data, modelId, device);

  const pipe = await withTimeout(
    pipeline("text-generation", modelId, {
      dtype,
      device,
      progress_callback,
    }),
    MODEL_INIT_TIMEOUT,
    `model:${modelId}`
  );
  markModelCached();
  return pipe;
}

/* ---------------- lifecycle (singleton) ---------------- */

async function runLifecycle() {
  const t0 = performance.now();
  const hasWebGPU = supportsWebGPU();
  setState({
    status: AI_STATUS.CHECKING,
    stage: "checking",
    webgpu: hasWebGPU,
    cached: isModelCached(),
    error: null,
    attempts: [],
    metrics: { ...lifecycle.metrics, initStartMs: Math.round(t0) },
  });
  recordAttempt({ stage: "checking", webGPU: hasWebGPU, cached: isModelCached() });

  // Controlled attempt plan (never a giant nested webgpu×dtype sweep):
  //   1. WebGPU already detected above.
  //   2. Attempt the primary quantized config on the best available device.
  //   3. On failure, fall back to the WASM compatibility runtime — with
  //      one further dtype fallback there only, since that's the one
  //      device every browser supports and is worth a second try.
  //   4. If every attempt fails, the caller (initializeAI) resolves to
  //      null and the deterministic fallback engine takes over.
  // Each (device, dtype) pair is attempted at most once — never
  // re-downloading the same weights under a different configuration on
  // a device that already failed.
  const plan = hasWebGPU
    ? [
        { device: "webgpu", dtype: MODEL_DTYPE },
        { device: "wasm", dtype: MODEL_DTYPE },
        { device: "wasm", dtype: MODEL_DTYPE_FALLBACK },
      ]
    : [
        { device: "wasm", dtype: MODEL_DTYPE },
        { device: "wasm", dtype: MODEL_DTYPE_FALLBACK },
      ];

  for (const { device, dtype } of plan) {
    try {
      const pipe = await loadModel(PRIMARY_MODEL, device, dtype);
      const compatibility = device === "wasm";
      lifecycle.metrics = {
        ...lifecycle.metrics,
        activeModel: PRIMARY_MODEL,
        activeDevice: device,
        activeDtype: dtype,
        initCompleteMs: Math.round(performance.now()),
        initDurationMs: Math.round(performance.now() - t0),
      };
      recordAttempt({ stage: "ready", model: PRIMARY_MODEL, device, dtype, ok: true });
      setState({
        status: compatibility ? AI_STATUS.FALLBACK : AI_STATUS.READY,
        stage: "ready",
        model: PRIMARY_MODEL,
        device,
        fallback: compatibility,
        progress: { percent: 100, file: null, detail: "AI ready" },
        error: null,
        cached: isModelCached(),
      });
      console.info(`[NimiqLearn] AI ready — ${PRIMARY_MODEL} (${dtype}) on ${device} in ${Math.round(performance.now() - t0)}ms`);
      return pipe;
    } catch (err) {
      logInitFailure(err, { model: PRIMARY_MODEL, device, dtype, stage: "load" });
      recordAttempt({ stage: "failed", model: PRIMARY_MODEL, device, dtype, error: err?.message });
      lifecycle.metrics = { ...lifecycle.metrics, lastFailed: { model: PRIMARY_MODEL, device, dtype, error: err?.message } };
    }
  }

  console.error("NimiqLearn AI initialization failed", {
    model: PRIMARY_MODEL,
    plan,
    error: lifecycle.attempts.at(-1)?.error,
    webGPU: hasWebGPU,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
    attempts: lifecycle.attempts,
  });
  setState({
    status: AI_STATUS.ERROR,
    stage: "ai-unavailable",
    error: "The AI model could not be started on this device. The deterministic learning engine is active instead.",
  });
  return null;
}

/**
 * Singleton initialization. Never throws to UI callers: resolves with the
 * pipeline generator, or null when AI is unavailable. StrictMode-safe —
 * concurrent callers share ONE init promise; no duplicate pipelines.
 */
export function initializeAI() {
  if (generator) return Promise.resolve(generator);
  if (!initPromise) {
    initPromise = runLifecycle()
      .then((pipe) => {
        generator = pipe;
        return pipe;
      })
      .catch((err) => {
        console.error("[NimiqLearn] AI lifecycle error", err);
        setState({ status: AI_STATUS.ERROR, stage: "ai-unavailable", error: err?.message || "AI unavailable" });
        return null;
      })
      .finally(() => {
        if (!generator) initPromise = null; // allow retry only on failure
      });
  }
  return initPromise;
}

/* ---------------- background prewarm ---------------- */

/**
 * Starts model initialization as early as practical so a learner who
 * reaches ExplainBack and submits rarely hits a cold-start wait. Guards:
 * offline / slow-2g / 2g connections are always skipped; already-running
 * or ready states are no-ops. Fire-and-forget — never awaited by the UI.
 *
 * Adaptive policy for `{ background: true }` (used only by the app-wide
 * idle trigger in AppRoot.jsx — page-level triggers like ExplainBack/Learn
 * mounting call this with the default, since the learner has already
 * shown clear intent to use the AI there):
 *   - capable browser / WebGPU available → prewarm
 *   - mobile with an ordinary connection → prewarm (network guard above
 *     already covers "good enough" vs. slow-2g/2g)
 *   - constrained device (low RAM/cores) with no WebGPU → defer; the
 *     118MB download only starts once the learner actually opens
 *     ExplainBack or Learn, whose own prewarm() call is unconditional.
 * NimiqLearn runs inside Nimiq Pay Mini App WebViews, which can be much
 * more resource-constrained than a desktop browser, so the app-wide
 * trigger errs cautious rather than always downloading immediately.
 */
export function startPrewarm({ background = false } = {}) {
  try {
    if (isAIReady() || lifecycle.status !== AI_STATUS.IDLE) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const conn = typeof navigator !== "undefined" ? navigator.connection : null;
    if (conn && (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g")) return;
    if (background && isConstrainedDevice() && !supportsWebGPU()) return;
    initializeAI().catch(() => {});
  } catch {
    /* never throw out of prewarm */
  }
}

/** Conservative preload (dev diagnostics panel): cached model or opt-in only. */
export async function maybePreloadAI() {
  try {
    if (isAIReady() || lifecycle.status !== AI_STATUS.IDLE) return;
    if (!isModelCached() && !getPreloadFlag()) return;
    startPrewarm();
  } catch {
    /* ignore */
  }
}

export function enablePreloadFlag() {
  try {
    localStorage.setItem(PRELOAD_FLAG_KEY, "1");
  } catch {
    /* ignore */
  }
}

/* ---------------- generation API (model-agnostic) ---------------- */

/**
 * The ONE consistent interface the app uses. Callers never know which
 * model is active — SmolLM2 today, anything else tomorrow.
 *
 * Optional `onToken(textChunk)` enables REAL streaming (Transformers.js
 * TextStreamer). Never faked. Latency is measured: submit→start,
 * start→first token, start→complete.
 */
export async function generateLearningResponse({
  systemPrompt = "You are NimiqLearn, a concise educational assessment assistant.",
  userPrompt,
  maxNewTokens = 220,
  temperature = 0.4,
  onToken = null,
} = {}) {
  const pipe = await initializeAI();
  if (!pipe) throw new Error("AI_UNAVAILABLE");

  const prevStatus = lifecycle.status;
  const genStart = performance.now();
  let firstTokenAt = null;
  setState({ status: AI_STATUS.GENERATING });
  try {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    lifecycle.metrics = { ...lifecycle.metrics, generationStartAtMs: Math.round(performance.now()) };

    const genOptions = {
      max_new_tokens: maxNewTokens,
      temperature,
      do_sample: true,
      repetition_penalty: 1.08,
    };

    // Real streaming via Transformers.js's TextStreamer — verified against
    // the installed package (not simulated by chunking a finished response).
    if (onToken && pipe.tokenizer) {
      const streamer = new TextStreamer(pipe.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (chunk) => {
          if (firstTokenAt === null) {
            firstTokenAt = performance.now();
            lifecycle.metrics = { ...lifecycle.metrics, firstTokenMs: Math.round(firstTokenAt - genStart) };
          }
          try {
            onToken(chunk);
          } catch {
            /* token callback must never break generation */
          }
        },
      });
      genOptions.streamer = streamer;
    }

    const output = await withTimeout(pipe(messages, genOptions), GENERATION_TIMEOUT, "generation");

    const generated = output?.[0]?.generated_text;
    let text = "";
    if (Array.isArray(generated)) text = generated.at(-1)?.content ?? "";
    else if (typeof generated === "string") text = generated;

    lifecycle.metrics = {
      ...lifecycle.metrics,
      lastGenerationMs: Math.round(performance.now() - genStart),
      firstTokenMs: firstTokenAt !== null ? Math.round(firstTokenAt - genStart) : lifecycle.metrics.firstTokenMs ?? null,
    };
    return text;
  } finally {
    setState({ status: prevStatus });
  }
}

/* ---------------- robust JSON parsing ---------------- */

export function extractJsonObject(text) {
  if (!text) return null;
  let clean = String(text).replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  clean = clean.slice(start, end + 1);
  try {
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

export function parseAIResponse(text, { validate = () => ({ ok: false, value: null }), fallback = null } = {}) {
  try {
    if (typeof text === "string" && text.trim()) {
      const obj = extractJsonObject(text);
      if (obj) {
        const checked = validate(obj);
        if (checked && checked.ok) return { ok: true, value: checked.value };
      }
    }
  } catch {
    /* fall through to fallback */
  }
  return { ok: false, value: fallback };
}

/* ---------------- reset (dev / diagnostics) ---------------- */

export function resetAI() {
  generator = null;
  initPromise = null;
  lifecycle = {
    status: AI_STATUS.IDLE,
    model: null,
    stage: null,
    device: null,
    fallback: false,
    webgpu: null,
    cached: isModelCached(),
    progress: { percent: 0, file: null, detail: "" },
    error: null,
    attempts: [],
    metrics: {},
  };
  listeners.forEach((fn) => {
    try {
      fn(getAIState());
    } catch {
      /* ignore */
    }
  });
}
