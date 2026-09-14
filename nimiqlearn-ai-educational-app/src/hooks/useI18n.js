/* ============================================================
   NimiqLearn — useI18n hook
   ------------------------------------------------------------
   Reactive wrapper over i18nService. Mirrors useTheme.js.

   The `t` returned here is rebuilt on every locale change so that
   it is a NEW function identity each time. That is deliberate: it
   means a component that lists `t` in a dependency array actually
   re-runs on a language switch, and any memo that closes over `t`
   is invalidated. A stable `t` would leave memoised subtrees
   rendering the previous language until something else happened
   to re-render them — a genuinely hard bug to spot, because most
   of the screen changes correctly.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import {
  getLocale,
  setLocale as applyLocale,
  subscribeLocale,
  translate,
  translateOr,
  translatePlural,
  formatNumber,
} from "../services/i18nService.js";
import { getLocaleMeta } from "../i18n/locales.js";

export function useI18n() {
  const [locale, setLocaleState] = useState(getLocale);

  useEffect(() => subscribeLocale(setLocaleState), []);

  const t = useCallback((key, vars) => translate(key, vars, locale), [locale]);
  const tPlural = useCallback((key, count, vars) => translatePlural(key, count, vars, locale), [locale]);
  /* tOr(key, englishSource) — for curriculum content, which is stored as
     source data rather than in the English catalogue. */
  const tOr = useCallback((key, fallback, vars) => translateOr(key, fallback, vars, locale), [locale]);
  const n = useCallback((value) => formatNumber(value, locale), [locale]);

  return {
    locale,
    meta: getLocaleMeta(locale),
    setLocale: applyLocale,
    t,
    tOr,
    tPlural,
    n,
  };
}
