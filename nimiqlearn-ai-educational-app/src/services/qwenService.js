/* ============================================================
   NimiqLearn — Backward-compatibility shim
   ------------------------------------------------------------
   The AI engine now lives in the model-agnostic src/services/aiService.js
   (active model: SmolLM2-135M-Instruct-ONNX-MHA).

   This file re-exports the generic API so existing imports keep
   working during the migration. New code should import from
   aiService.js directly.
   ============================================================ */

export * from "./aiService.js";
