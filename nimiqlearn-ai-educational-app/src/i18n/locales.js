/* ============================================================
   NimiqLearn — supported locales
   ------------------------------------------------------------
   One registry, used by three different consumers that must never
   disagree:

     1. the language picker UI (label + flag),
     2. the <html lang> attribute (screen readers, hyphenation,
        and the browser's own font selection for CJK),
     3. the AI backend, which is told to answer in `aiName`.

   `aiName` is spelled out in English on purpose. It goes into an
   OpenAI system prompt, and an English language name ("Korean")
   is far more reliable there than a BCP-47 tag ("ko") or the
   endonym ("한국어"), which models sometimes read as content to
   translate rather than an instruction.

   English is the default and the fallback: every other locale is
   allowed to be incomplete, and any key it is missing resolves
   against English rather than rendering a raw key at the user.
   ============================================================ */

export const DEFAULT_LOCALE = "en";

/* Display order for the picker, and nothing else — no other consumer reads
   the order. It is not alphabetical and not grouped by region: grouping the
   six European languages first pushed every non-Latin script below the fold
   on a phone, so the picker read as "English and some European options",
   with Korean, Japanese and Chinese looking like an afterthought.

   Latin and CJK scripts therefore alternate down the two-column grid, which
   puts a non-Latin script in the first row next to English and makes the
   breadth of the list visible without scrolling.

   English stays first: it is the default, and getLocaleMeta() falls back to
   LOCALES[0] for an unrecognised code. */
export const LOCALES = [
  { code: "en",      label: "English",    flag: "🇺🇸", aiName: "English",                       dir: "ltr" },
  { code: "ko",      label: "한국어",      flag: "🇰🇷", aiName: "Korean",                        dir: "ltr" },
  { code: "es",      label: "Español",    flag: "🇪🇸", aiName: "Spanish",                       dir: "ltr" },
  { code: "ja",      label: "日本語",      flag: "🇯🇵", aiName: "Japanese",                      dir: "ltr" },
  { code: "fr",      label: "Français",   flag: "🇫🇷", aiName: "French",                        dir: "ltr" },
  { code: "zh-Hans", label: "简体中文",    flag: "🇨🇳", aiName: "Simplified Chinese",            dir: "ltr" },
  { code: "de",      label: "Deutsch",    flag: "🇩🇪", aiName: "German",                        dir: "ltr" },
  { code: "zh-Hant", label: "繁體中文",    flag: "🇹🇼", aiName: "Traditional Chinese (Taiwan)",  dir: "ltr" },
  { code: "pt",      label: "Português",  flag: "🇵🇹", aiName: "Portuguese",                    dir: "ltr" },
  { code: "it",      label: "Italiano",   flag: "🇮🇹", aiName: "Italian",                       dir: "ltr" },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code);

export function getLocaleMeta(code) {
  return LOCALES.find((l) => l.code === code) || LOCALES[0];
}

export function isSupportedLocale(code) {
  return LOCALE_CODES.includes(code);
}
