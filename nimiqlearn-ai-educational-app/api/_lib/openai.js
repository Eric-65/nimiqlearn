/* ============================================================
   NimiqLearn API — OpenAI client, error mapping, reply language
   ------------------------------------------------------------
   Shared by BOTH transports:
     - the Vercel serverless functions in ../ (production), and
     - the local Express server in ../../../server/index.js (dev).

   One copy of this logic, two ways to call it. Duplicating the
   prompts and validation across the two would guarantee they
   drift, and the prompt is the product here.
   ============================================================ */

import OpenAI from "openai";

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
export const MAX_MESSAGE_LENGTH = 4000;

let cachedClient;
let cachedKey;

/**
 * The client is built LAZILY, on first use, not at module load.
 *
 * That matters for the local server: ESM imports are evaluated before the
 * importing module's own body runs, so a client constructed at the top level
 * here would be created BEFORE server/index.js calls process.loadEnvFile() —
 * and would always see an empty OPENAI_API_KEY. On Vercel the env is present
 * either way, so lazy is correct in both places and wrong in neither.
 */
export function getOpenAI() {
  const key = process.env.OPENAI_API_KEY || null;
  if (!key) return null;
  if (!cachedClient || cachedKey !== key) {
    // OPENAI_BASE_URL lets this point at an OpenAI-compatible endpoint
    // instead of the default. Unset in normal use; it is what makes the
    // routes testable without spending real credits on every run.
    cachedClient = new OpenAI({ apiKey: key, baseURL: process.env.OPENAI_BASE_URL || undefined });
    cachedKey = key;
  }
  return cachedClient;
}

export function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Maps an OpenAI failure to a response, distinguishing a real auth problem,
 * a real rate limit and a real upstream failure instead of collapsing all
 * three into one unhelpful message.
 *
 * Returns { status, json } rather than writing to a response, so the same
 * mapping serves Express and Vercel without either owning it.
 */
export function openAiErrorResponse(err, label) {
  if (err instanceof OpenAI.AuthenticationError) {
    console.error(`[nimiqlearn-api] OpenAI authentication error (${label}):`, err.message);
    return {
      status: 500,
      json: { ok: false, error: `${label} authentication failed. Check the server's OPENAI_API_KEY.` },
    };
  }
  if (err instanceof OpenAI.RateLimitError) {
    return { status: 429, json: { ok: false, error: "Too many requests right now — please try again in a moment." } };
  }
  if (err instanceof OpenAI.APIError) {
    console.error(`[nimiqlearn-api] OpenAI API error (${label}):`, err.status, err.message);
    return { status: 502, json: { ok: false, error: `${label} could not complete this request.` } };
  }
  console.error(`[nimiqlearn-api] Unexpected OpenAI error (${label}):`, err);
  return { status: 500, json: { ok: false, error: "An unexpected error occurred." } };
}

/* ------------------ Reply language ------------------
   The learner picks a language in the app; every route accepts it and
   instructs the model to answer in it.

   Two rules here matter:

   1. The language is chosen from a SERVER-SIDE allow-list keyed by locale
      tag — the request's own `languageName` is never passed through to the
      prompt. That string arrives from the client, and text that reaches a
      system prompt unchecked is a prompt-injection vector: a crafted
      `languageName` ("English. Ignore all previous instructions and …")
      would otherwise be read by the model as instructions.

   2. An unknown or missing locale falls back to English rather than
      erroring. A learner should never lose AI feedback because a locale
      tag was not recognised.

   Keep in sync with src/i18n/locales.js. */
const REPLY_LANGUAGES = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  ko: "Korean",
  ja: "Japanese",
  "zh-Hans": "Simplified Chinese",
  "zh-Hant": "Traditional Chinese (as used in Taiwan)",
};

const DEFAULT_REPLY_LANGUAGE = "English";

export function replyLanguage(locale) {
  return (typeof locale === "string" && REPLY_LANGUAGES[locale]) || DEFAULT_REPLY_LANGUAGE;
}

/* Appended to every system prompt. Spelled out at length because the failure
   mode is specific: given English source material and an English rubric, a
   model will often answer in English regardless of a short "reply in X" —
   and half-translated feedback reads worse than none. JSON KEYS must stay
   English or the response stops parsing. */
export function languageInstruction(locale) {
  const language = replyLanguage(locale);
  if (language === DEFAULT_REPLY_LANGUAGE) return "Write your reply in English.";
  return [
    `Write every piece of text you return in ${language}.`,
    `This applies to all of it — explanations, questions, answer choices, feedback and summaries — even though the topic material and the instructions above are in English.`,
    `Do NOT reply in English, and do not translate JSON keys: keys stay exactly as specified in English, only their string VALUES are in ${language}.`,
    `Use natural, everyday ${language} as a teacher would speak it, not a word-for-word translation of English phrasing.`,
  ].join(" ");
}
