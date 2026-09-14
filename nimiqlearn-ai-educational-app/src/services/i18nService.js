/* ============================================================
   NimiqLearn — i18n service
   ------------------------------------------------------------
   Owns the current locale and the lookup that turns a key into a
   string. Deliberately mirrors themeService.js: the same storage
   discipline, the same "read once at boot, notify subscribers on
   change" shape, so there is one way state like this works here.

   Three decisions worth knowing about:

   1. All catalogues are STATICALLY imported, not lazily fetched.
      NimiqLearn ships as a single self-contained HTML file (see
      vite-plugin-singlefile) and runs inside Nimiq Pay's webview,
      where a runtime fetch for a locale chunk is exactly the kind
      of request that fails on a bad connection — and a language
      that half-loads is worse than one that loads slowly.

   2. Lookup falls back to English per KEY, not per locale. A
      translation that is missing one string still renders that one
      string in English inside an otherwise translated page, rather
      than showing the raw key. Raw keys leaking into the UI is the
      classic i18n failure and it always looks broken.

   3. Plurals go through Intl.PluralRules rather than a hand-rolled
      `count === 1` check. Korean, Japanese and Chinese have a
      single form and would be given a wrong English-shaped plural
      by the naive version.
   ============================================================ */

import { DEFAULT_LOCALE, isSupportedLocale, getLocaleMeta } from "../i18n/locales.js";

import en from "../i18n/messages/en.js";
import es from "../i18n/messages/es.js";
import fr from "../i18n/messages/fr.js";
import de from "../i18n/messages/de.js";
import pt from "../i18n/messages/pt.js";
import it from "../i18n/messages/it.js";
import ko from "../i18n/messages/ko.js";
import ja from "../i18n/messages/ja.js";
import zhHans from "../i18n/messages/zh-Hans.js";
import zhHant from "../i18n/messages/zh-Hant.js";

const CATALOGUES = {
  en,
  es,
  fr,
  de,
  pt,
  it,
  ko,
  ja,
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
};

const STORAGE_KEY = "nimiqlearn:locale";

let currentLocale = DEFAULT_LOCALE;
const listeners = new Set();

/* localStorage throws in a private window and in some embedded webviews;
   a language preference is never worth taking the app down for. */
function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isSupportedLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeStored(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* preference simply won't survive a reload */
  }
}

/* The browser's own language is a hint, not an instruction: we only use it
   when the user has never chosen. An exact match wins; otherwise fall back
   to the base language, so a de-AT browser still gets German. */
function detectFromBrowser() {
  try {
    for (const tag of navigator.languages || [navigator.language]) {
      if (!tag) continue;
      if (isSupportedLocale(tag)) return tag;
      // zh-TW / zh-HK are Traditional; every other zh-* we treat as Simplified.
      if (tag.startsWith("zh")) {
        return /hant|tw|hk|mo/i.test(tag) ? "zh-Hant" : "zh-Hans";
      }
      const base = tag.split("-")[0];
      if (isSupportedLocale(base)) return base;
    }
  } catch {
    /* fall through to the default */
  }
  return null;
}

function applyToDocument(code) {
  const meta = getLocaleMeta(code);
  const el = document.documentElement;
  el.setAttribute("lang", code);
  el.setAttribute("dir", meta.dir);
}

export function initI18n() {
  currentLocale = readStored() || detectFromBrowser() || DEFAULT_LOCALE;
  applyToDocument(currentLocale);
  return currentLocale;
}

export function getLocale() {
  return currentLocale;
}

export function setLocale(code) {
  if (!isSupportedLocale(code) || code === currentLocale) return currentLocale;
  currentLocale = code;
  writeStored(code);
  applyToDocument(code);
  listeners.forEach((fn) => fn(code));
  return currentLocale;
}

export function subscribeLocale(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------------- lookup ---------------- */

function lookup(locale, key) {
  const table = CATALOGUES[locale];
  if (table && typeof table[key] === "string") return table[key];
  return null;
}

/* {name}-style interpolation. Unknown placeholders are left verbatim so a
   translation that invents a variable is visible in testing rather than
   silently rendering "undefined" at a learner. */
function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

export function translate(key, vars, locale = currentLocale) {
  let str = lookup(locale, key);

  if (str === null && locale !== DEFAULT_LOCALE) {
    str = lookup(DEFAULT_LOCALE, key);
    if (str !== null && import.meta.env?.DEV) {
      console.warn(`[i18n] "${key}" missing for "${locale}" — fell back to English.`);
    }
  }

  if (str === null) {
    // Nothing anywhere: surface it loudly in dev, and degrade to the last
    // key segment in production, which reads as a word far more often than
    // "home.hero.cta" does.
    if (import.meta.env?.DEV) console.error(`[i18n] missing key: "${key}"`);
    return key.split(".").pop();
  }

  return interpolate(str, vars);
}

/* Picks `<key>_one` / `<key>_other` (etc.) using the locale's real plural
   categories, then interpolates {count} for free. */
export function translatePlural(key, count, vars, locale = currentLocale) {
  let category = "other";
  try {
    category = new Intl.PluralRules(locale).select(count);
  } catch {
    category = count === 1 ? "one" : "other";
  }
  const withCount = { count, ...vars };
  const exact = lookup(locale, `${key}_${category}`) ?? lookup(DEFAULT_LOCALE, `${key}_${category}`);
  if (exact !== null) return interpolate(exact, withCount);
  return translate(`${key}_other`, withCount, locale);
}

/* Curriculum content (topic names, definitions, analogies…) lives in
   mockTopics.js as English source data, not in the English catalogue.
   Duplicating all of it into en.js just to have something to fall back to
   would create two copies that can drift — and the app grades learners
   against that data, so a drifted copy is a wrong answer.

   So: translated content is looked up by key, and when a catalogue has no
   entry for it the ENGLISH SOURCE OBJECT is used verbatim. That means a
   partially translated language shows real English content rather than a
   key or an empty string, and adding content translations later needs no
   code change at all. */
export function translateOr(key, fallback, vars, locale = currentLocale) {
  const str = lookup(locale, key) ?? (locale === DEFAULT_LOCALE ? null : lookup(DEFAULT_LOCALE, key));
  if (str === null || str === undefined) return fallback;
  return interpolate(str, vars);
}

/* Locale-aware number formatting — 1,234 in English, 1.234 in German. */
export function formatNumber(value, locale = currentLocale) {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}
