/* ============================================================
   NimiqLearn — useAiBackend hook
   ------------------------------------------------------------
   Reactive view of whether NimiqLearn's OpenAI-backed server is
   configured AND actually reachable. Unlike the old on-device
   SmolLM2 model, there's no multi-hundred-MB download or "loading"
   phase to represent here — a request either works or it doesn't,
   in a couple of seconds either way. This is a single health check
   run once per app session (not per request), so pages can show an
   honest, lightweight status badge without re-checking constantly.

   Reuses checkTutorAvailable() (explainBackTutorService.js) since
   every /api/* route on the backend shares one OPENAI_API_KEY and
   one "is it configured" fact — a single check answers for all of
   ExplainBack grading, the AI Tutor, and Learn activity generation.
   ============================================================ */

import { useEffect, useState } from "react";
import { checkTutorAvailable } from "../services/explainBackTutorService.js";

let cached = null; // { available, reason } — shared across every consumer, checked once
let inFlight = null;

function runCheck() {
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = checkTutorAvailable()
      .then((result) => {
        cached = result;
        return result;
      })
      .catch(() => {
        cached = { available: false, reason: "Could not reach the AI backend." };
        return cached;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function useAiBackend() {
  const [state, setState] = useState(() => (cached ? { checking: false, ...cached } : { checking: true, available: false, reason: null }));

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    runCheck().then((result) => {
      if (!cancelled) setState({ checking: false, ...result });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
