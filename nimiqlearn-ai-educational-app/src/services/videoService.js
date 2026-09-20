/* ============================================================
   NimiqLearn — video selection
   ------------------------------------------------------------
   Picks the video to show a learner for a topic, in the language
   they are actually reading the app in, and says HOW it matched
   so the UI can be honest about it.

   The chain, in order:

     1. a video SPOKEN in their language
     2. a video with real subtitles in their language
     3. a video spoken in English
     4. nothing

   Step 2 is deliberately below step 1 and deliberately not
   merged into it: French subtitles on a German lecture make it a
   German video with French subtitles, and calling that "a French
   lesson" is the exact lie this module exists to avoid. The
   caller gets `match` back and the UI says which one happened.

   Step 4 being "nothing" is a feature. A topic with no good
   video shows no video — it never shows an adjacent one and
   hopes the learner does not notice.

   ------------------------------------------------------------
   Nothing unverified is ever returned. `verified` is computed in
   videoLibrary.js from the generated verification module, so an
   entry reaches a learner only after the Commons API confirmed
   the file and a human confirmed the content. `includeUnverified`
   exists for the verifier script and for tests, and no UI code
   passes it.
   ============================================================ */

import { VIDEO_LIBRARY, DELIBERATELY_EMPTY } from "../data/videoLibrary.js";

export const MATCH_AUDIO = "audio";
export const MATCH_SUBTITLES = "subtitles";
export const MATCH_ENGLISH = "english-fallback";
/* The learner chose this language themselves (a card in the "other
   languages" section), so it is neither a match for their UI language nor
   a fallback — the UI still names the spoken language, honestly. */
export const MATCH_CHOSEN = "chosen";

const ENGLISH = "en";

/* "zh-Hans" and "zh-Hant" are both spoken Chinese as far as an audio track is
   concerned — the split is a writing system. Subtitles are a different matter,
   so subtitle matching below compares full codes first and base codes second. */
export function baseLanguage(locale) {
  return String(locale || ENGLISH).split("-")[0].toLowerCase();
}

function playable(entry, includeUnverified) {
  if (!entry) return false;
  if (includeUnverified) return true;
  return entry.verified === true && Boolean(entry.directVideoUrl);
}

function firstPlayable(list, includeUnverified) {
  if (!Array.isArray(list)) return null;
  return list.find((e) => playable(e, includeUnverified)) || null;
}

function hasSubtitlesFor(entry, locale) {
  const subs = Array.isArray(entry.subtitleLanguages) ? entry.subtitleLanguages : [];
  if (subs.includes(locale)) return true;
  const base = baseLanguage(locale);
  return subs.some((s) => baseLanguage(s) === base);
}

/**
 * @returns {{video: object, match: string, requestedLanguage: string, spokenLanguage: string}|null}
 */
export function selectVideo(topicId, locale, { includeUnverified = false, audioLanguage = null } = {}) {
  const byLanguage = VIDEO_LIBRARY[topicId];
  if (!byLanguage) return null;

  const requested = baseLanguage(locale);
  const result = (video, match) =>
    video
      ? { video, match, requestedLanguage: requested, spokenLanguage: video.audioLanguage }
      : null;

  /* 0. A language the learner picked explicitly — a German card in the
        "other languages" section opened from an English UI. Without this,
        the chain below would look for English, find none for a German-only
        topic, and show NO video on the very page the card led to. Falls
        through to the normal chain if that language has nothing playable. */
  if (audioLanguage) {
    const chosen = firstPlayable(byLanguage[baseLanguage(audioLanguage)], includeUnverified);
    if (chosen) return result(chosen, baseLanguage(audioLanguage) === requested ? MATCH_AUDIO : MATCH_CHOSEN);
  }

  /* 1. Spoken in their language. */
  const spoken = firstPlayable(byLanguage[requested], includeUnverified);
  if (spoken) return result(spoken, MATCH_AUDIO);

  /* 2. Subtitled in their language — any audio language, English last so a
        subtitled non-English video does not lose to the English fallback it
        is meant to beat. */
  if (requested !== ENGLISH) {
    const languages = Object.keys(byLanguage).sort((a, b) =>
      a === ENGLISH ? 1 : b === ENGLISH ? -1 : 0
    );
    for (const lang of languages) {
      const subtitled = (byLanguage[lang] || []).find(
        (e) => playable(e, includeUnverified) && hasSubtitlesFor(e, locale)
      );
      if (subtitled) return result(subtitled, MATCH_SUBTITLES);
    }
  }

  /* 3. English audio. */
  if (requested !== ENGLISH) {
    const english = firstPlayable(byLanguage[ENGLISH], includeUnverified);
    if (english) return result(english, MATCH_ENGLISH);
  }

  /* 4. Nothing, on purpose. */
  return null;
}

/** Why a topic has no video — for the editorial report, not for the UI. */
export function noVideoReason(topicId) {
  if (DELIBERATELY_EMPTY[topicId]) return DELIBERATELY_EMPTY[topicId];
  if (!VIDEO_LIBRARY[topicId]) return "No candidate has been researched for this topic yet.";
  return "Candidates exist but none has passed verification.";
}

/**
 * The licence's own page, from the short name Commons reports
 * ("CC BY-SA 4.0", "CC BY 3.0", "CC0", "Public domain"). Every CC licence
 * asks that a reuse link to the licence text, not just name it, so this is
 * what the credit line and the credits page link to. Null for anything not
 * recognised — a wrong link is worse than no link.
 */
export function licenseUrl(license) {
  if (!license) return null;
  const s = String(license).trim();
  if (/^CC0\b/i.test(s)) return "https://creativecommons.org/publicdomain/zero/1.0/";
  if (/public domain/i.test(s)) return "https://creativecommons.org/publicdomain/mark/1.0/";
  const m = s.match(/^CC\s+(BY(?:-SA)?(?:-NC)?(?:-ND)?)\s+(\d\.\d)/i);
  if (!m) return null;
  return `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/`;
}

/** Where an entry stands: playable, machine-checked only, or unchecked. */
export function verificationStatus(entry) {
  if (entry?.verified) return "playable";
  if (entry?.directVideoUrl) return "awaiting-review";
  return "unchecked";
}

/** mm:ss / h:mm:ss, or null when the real duration is not known yet. */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Topics that would show a video right now. */
export function topicsWithVideo(locale) {
  return Object.keys(VIDEO_LIBRARY).filter((id) => selectVideo(id, locale) !== null);
}

/* The order the Home carousels present courses in. There is no real
   popularity signal (no like counts, no learner counts — and the app will
   not invent them), so "top" is editorial: short, well-licensed, squarely
   on-topic first. Anything not listed comes after, in library order. */
const FEATURED_ORDER = [
  "newtons-second-law",
  "dna-genetics",
  "quadratics",
  "ai-fundamentals",
  "python-basics",
  "waves-sound",
  "atoms-elements",
  "proofs",
  "electricity-basics",
  "energy-work",
  "linear-equations",
  "functions",
  "exponents",
  "angles",
  "pythagorean-theorem",
  "circles",
  "inequalities",
  "probability-basics",
];

const rank = (id) => {
  const i = FEATURED_ORDER.indexOf(id);
  return i === -1 ? FEATURED_ORDER.length : i;
};

/**
 * Every playable video in the library, grouped by the language SPOKEN in
 * it, for the Home carousels: one section of English courses, one of
 * courses in other languages. Every entry, not a top six — a learner
 * pages through with the arrows. A topic with videos in two languages
 * (Pythagoras: German and French) appears once per video, so items are
 * keyed by the video id, and each carries the language the card was
 * chosen for so Learn can honour it on arrival.
 *
 * "english" is ordered editorially; "other" is grouped by language, then
 * editorially within a language, so German courses sit together.
 */
export function coursesByLanguage() {
  const english = [];
  const other = [];
  for (const [topicId, byLanguage] of Object.entries(VIDEO_LIBRARY)) {
    for (const [lang, list] of Object.entries(byLanguage)) {
      const video = firstPlayable(list, false);
      if (!video) continue;
      const item = { id: video.id, topicId, video, audioLanguage: video.audioLanguage || lang };
      (baseLanguage(item.audioLanguage) === ENGLISH ? english : other).push(item);
    }
  }
  english.sort((a, b) => rank(a.topicId) - rank(b.topicId));
  other.sort((a, b) => a.audioLanguage.localeCompare(b.audioLanguage) || rank(a.topicId) - rank(b.topicId));
  return { english, other };
}
