/* ============================================================
   NimiqLearn — Backward-compatibility shim
   ------------------------------------------------------------
   The hook now lives in src/hooks/useAI.js (model-agnostic).
   useQwen() is kept as an alias so existing imports keep working
   during the migration. New code should use useAI().
   ============================================================ */

export { useAI as useQwen } from "./useAI.js";
export { AI_STATUS, PRIMARY_MODEL } from "./useAI.js";
