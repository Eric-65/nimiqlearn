/* ============================================================
   NimiqLearn — useAI hook
   ------------------------------------------------------------
   Reactive view over the singleton AI lifecycle. Subscribes to
   shared state so every consumer (topbar indicator, loaders,
   pages) stays in sync without ever triggering a model load.

   Model-agnostic: exposes { status, model, modelId, progress,
   error, generate, initialize, prewarm, preload, reset,
   preparing, isReady, isUnavailable, latency, ... }
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import {
  AI_STATUS,
  PRIMARY_MODEL,
  getAIState,
  subscribeAI,
  initializeAI,
  generateLearningResponse,
  isAIReady,
  supportsWebGPU,
  isConstrainedDevice,
  isModelCached,
  startPrewarm,
  maybePreloadAI,
  resetAI,
} from "../services/aiService.js";

export { AI_STATUS, PRIMARY_MODEL };

export function useAI() {
  const [state, setState] = useState(() => getAIState());

  useEffect(() => subscribeAI(setState), []);

  /** Explicit, non-blocking init. Resolves with the pipeline or null. */
  const initialize = useCallback(() => initializeAI().catch(() => null), []);

  /** Background prewarm — safe to call from every trigger point. */
  const prewarm = useCallback(() => {
    startPrewarm();
  }, []);

  /** Conservative preload for the dev diagnostics panel. */
  const preload = useCallback(() => maybePreloadAI().catch(() => {}), []);

  /** Unified model-agnostic generation with optional streaming. */
  const generate = useCallback((opts) => generateLearningResponse(opts), []);

  const reset = useCallback(() => {
    resetAI();
  }, []);

  const preparing = state.status === AI_STATUS.CHECKING || state.status === AI_STATUS.LOADING;

  return {
    status: state.status,
    model: state.model,
    modelId: state.model,
    progress: state.progress,
    error: state.error,
    stage: state.stage,
    device: state.device,
    attempts: state.attempts,
    metrics: state.metrics,
    latency: state.metrics,
    webgpu: state.webgpu !== null ? state.webgpu : supportsWebGPU(),
    constrained: isConstrainedDevice(),
    wasCached: state.cached || isModelCached(),
    preparing,
    isReady: isAIReady(),
    isUnavailable: state.status === AI_STATUS.ERROR,
    initialize,
    prewarm,
    preload,
    generate,
    reset,
  };
}
