/* ============================================================
   NimiqLearn — useTheme hook
   ------------------------------------------------------------
   Thin reactive wrapper over themeService.js, same shape as the
   app's other service/hook pairs (useNimiq, useEvmWallet).
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import {
  getThemeMode,
  getResolvedTheme,
  setThemeMode,
  subscribeToTheme,
  THEME_MODES,
} from "../services/themeService.js";

export { THEME_MODES };

export function useTheme() {
  const [state, setState] = useState(() => ({
    mode: getThemeMode(),
    resolved: getResolvedTheme(),
  }));

  useEffect(() => subscribeToTheme(setState), []);

  const setMode = useCallback((mode) => setThemeMode(mode), []);

  return { ...state, setMode, isLight: state.resolved === "light" };
}
