/* ============================================================
   NimiqLearn — video course library
   ------------------------------------------------------------
   Video lessons for curriculum topics, keyed by the language
   ACTUALLY SPOKEN in the video — not by the language of the page
   it was found on. Those differ often enough on Wikimedia Commons
   (an English description over German audio) that keying on the
   page language would quietly serve a German lesson to a French
   learner and call it French.

   Shape:

     VIDEO_LIBRARY[topicId][audioLanguage] = [ VideoEntry, ... ]

   and every VideoEntry carries:

     id                 stable key, `${topicId}-${lang}-${nn}`
     commonsTitle       the canonical "File:....webm" on Commons
     searchTitle        human-readable title, and the fallback the
                        verifier searches with if the title 404s
     audioLanguage      BCP-47 code of the SPOKEN audio
     subtitleLanguages  codes with real captions on the file
     durationSeconds    claimed length — replaced by the real one
     license            claimed licence — replaced by the real one
     attribution        who must be credited
     level              "school" | "advanced"
     note               anything a reviewer should know

   and gets three more computed in `hydrate()` below:

     commonsUrl         derived from commonsTitle, or null
     directVideoUrl     playable media URL — only from verification
     verified           true only when verification says so

   ------------------------------------------------------------
   WHY NOTHING HERE IS PLAYABLE UNTIL IT IS VERIFIED

   Everything in this file is a research result, not a checked
   fact. The research runs could not be validated from the build
   environment (Commons is unreachable from it), and they are
   known to have produced wrong answers: one pass offered
   Probabilidad.webm as a probability lesson and a second pass
   found its Commons metadata describes computer programming, and
   the two passes disagree outright on which file teaches work
   and energy. Durations and licences here are likewise claims
   copied from a chat transcript.

   A wrong licence or attribution on a public educational app is
   not a cosmetic bug. So `verified` is not a comment anyone can
   flip by hand in this file: it is computed from
   videoVerification.json, which only `npm run verify:videos`
   writes, and videoService.js refuses to serve an entry that is
   not verified. Until an entry passes, the app behaves exactly
   as it did before it existed — no video, no broken player, no
   unsourced licence claim.

   Verification is two gates, because an API can only prove half
   of it:

     machine   the file exists, and here are its real URL,
               duration, licence and author  (the script)
     content   it really teaches this topic, in this language,
               at this level                 (a human watching it)

   ------------------------------------------------------------
   WHY NO VIDEO IS COMMITTED TO THIS REPO

   These files are large — the linear-equations lecture is about
   1.27 GB and the circles one about 875 MB. They stay on Commons
   and stream from there; this repo stores only the metadata. The
   app bundles to a single HTML file, so committing media would
   also be self-defeating.

   ------------------------------------------------------------
   LICENCE PREFERENCE

   Public domain > CC BY > CC BY-SA. NimiqLearn sells learning
   packs for NIM, which makes it a commercial use, so anything
   CC BY-NC-* cannot ship here at all — it must fail verification
   rather than be shown with a warning. The verifier enforces
   that on the licence it reads from Commons, not on the claim
   below. One candidate (the MIT 8.02x lecture) is very likely to
   be caught by exactly that rule.
   ============================================================ */

import { VIDEO_VERIFICATION as VERIFICATION } from "./videoVerification.js";

/** Licence prefixes that NimiqLearn cannot use, because it charges for packs. */
export const FORBIDDEN_LICENSE_PATTERNS = [/\bNC\b/i, /non-?commercial/i];

export function isCommercialUseOk(license) {
  if (!license) return false;
  return !FORBIDDEN_LICENSE_PATTERNS.some((re) => re.test(license));
}

/** "File:A b.webm" -> the Commons page URL for it. */
export function commonsPageUrl(title) {
  if (!title) return null;
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/* Builds one entry: defaults, then the curated claims, then whatever
   verification actually established — in that order, so a verified fact
   always beats the claim it replaces and never the other way round. */
const candidate = (entry) => {
  const v = VERIFICATION.entries?.[entry.id] || null;
  const machineOk = Boolean(v?.directVideoUrl);
  const contentOk = v?.contentConfirmed === true;
  const license = v?.license || entry.license || null;

  return {
    subtitleLanguages: [],
    level: "school",
    note: "",
    commonsTitle: null,
    ...entry,
    /* Only verification can establish these: a caption file either exists on
       Commons or it does not, and no curated guess should claim one. */
    subtitleLanguages: v?.subtitleLanguages || [],
    license,
    attribution: v?.attribution || entry.attribution || null,
    durationSeconds: v?.durationSeconds ?? entry.durationSeconds ?? null,
    commonsUrl: v?.commonsUrl || commonsPageUrl(entry.commonsTitle),
    directVideoUrl: v?.directVideoUrl || null,
    verified: machineOk && contentOk && isCommercialUseOk(license),
    verifiedAt: machineOk && contentOk ? v.verifiedAt || null : null,
  };
};

export const VIDEO_LIBRARY = {
  /* ---------------- Mathematics ---------------- */
  "linear-equations": {
    de: [
      candidate({
        id: "linear-equations-de-01",
        commonsTitle: "File:Lineare Gleichungssysteme und Lösungsverfahren - kolleg24 Mathematik.webm",
        searchTitle: "Lineare Gleichungssysteme und Lösungsverfahren - kolleg24 Mathematik",
        audioLanguage: "de",
        durationSeconds: 1052,
        license: "CC BY-SA 4.0",
        attribution: "ARD kolleg24",
        note: "About 1.27 GB on Commons — stream it, and expect a slow start on mobile data.",
      }),
    ],
  },
  quadratics: {
    en: [
      candidate({
        id: "quadratics-en-01",
        commonsTitle: "File:Solving-quadratic-equations.ogv",
        searchTitle: "Solving quadratic equations",
        audioLanguage: "en",
        durationSeconds: 161,
        license: "CC BY-SA 3.0",
        attribution: "Wikimedia Commons contributor",
      }),
    ],
  },
  functions: {
    de: [
      candidate({
        id: "functions-de-01",
        commonsTitle: "File:Lineare Funktionen - kolleg24 Mathematik.webm",
        searchTitle: "Lineare Funktionen - kolleg24 Mathematik",
        audioLanguage: "de",
        durationSeconds: 872,
        license: "CC BY-SA 4.0",
        attribution: "ARD kolleg24",
        note: "Covers the function equation, its graph and slope.",
      }),
    ],
  },
  inequalities: {
    de: [
      candidate({
        id: "inequalities-de-01",
        commonsTitle:
          "File:Verwendung der Bernoulli-Ungleichung für Beweise ohne Logarithmus (Potenz ist kleinerer Term).webm",
        searchTitle: "Verwendung der Bernoulli-Ungleichung für Beweise ohne Logarithmus",
        audioLanguage: "de",
        durationSeconds: 317,
        license: "CC BY-SA 4.0",
        attribution: "Wikimedia Commons contributor",
        level: "advanced",
        note: "Both research passes flagged this as harder than 'basic inequalities'. Keep hunting for a beginner one.",
      }),
    ],
  },
  exponents: {
    de: [
      candidate({
        id: "exponents-de-01",
        commonsTitle: "File:Potenzgesetze - kolleg24 Mathematik.webm",
        searchTitle: "Potenzgesetze - kolleg24 Mathematik",
        audioLanguage: "de",
        durationSeconds: 550,
        license: "CC BY-SA 4.0",
        attribution: "ARD kolleg24",
        note: "Powers, negative exponents and the exponent rules.",
      }),
    ],
  },
  angles: {
    de: [
      candidate({
        id: "angles-de-01",
        /* No commonsTitle: the research only ever produced a CATEGORY
           (Category:Videos of angles (geometry)), which is a listing page,
           not a playable file. The verifier has to search for it. */
        searchTitle: "Winkel konstruieren",
        audioLanguage: "de",
        durationSeconds: 339,
        license: "CC BY-SA 4.0",
        attribution: "Serlo Education",
        note: "Research gave a Commons category, not a file. The exact file is unidentified — verification must name it.",
      }),
    ],
  },
  proofs: {
    en: [
      candidate({
        id: "proofs-en-01",
        commonsTitle: "File:Visually-straight-lines-on-log-log-plots.webm",
        searchTitle: "Visually straight lines on log-log plots",
        audioLanguage: "en",
        durationSeconds: 365,
        license: "CC BY-SA 3.0",
        attribution: "Wikimedia Commons contributor",
        level: "advanced",
        note: "Contains a real proof, but about power functions on log-log plots — advanced for a first proofs lesson.",
      }),
    ],
  },
  "pythagorean-theorem": {
    de: [
      candidate({
        id: "pythagorean-theorem-de-01",
        commonsTitle: "File:Satz des Pythagoras – Beweis mit Scherung.webm",
        searchTitle: "Satz des Pythagoras Beweis mit Scherung",
        audioLanguage: "de",
        durationSeconds: 847,
        license: "CC BY-SA 4.0",
        attribution: "Wikimedia Commons contributor",
        note: "A proof by geometric shearing.",
      }),
    ],
    fr: [
      candidate({
        id: "pythagorean-theorem-fr-01",
        commonsTitle: "File:PythagoreEuclide.ogv",
        searchTitle: "PythagoreEuclide",
        audioLanguage: "fr",
        durationSeconds: 15,
        license: "CC BY-SA 3.0",
        attribution: "Wikimedia Commons contributor",
        note: "A 15-second animation, not a lesson. Supplementary visual only — and it may have no narration at all, in which case it is not a French video.",
      }),
    ],
  },
  circles: {
    de: [
      candidate({
        id: "circles-de-01",
        commonsTitle: "File:Flächeninhalt und Umfang von Rechteck und Kreis - kolleg24 Mathematik.webm",
        searchTitle: "Flächeninhalt und Umfang von Rechteck und Kreis - kolleg24 Mathematik",
        audioLanguage: "de",
        durationSeconds: 679,
        license: "CC BY-SA 4.0",
        attribution: "ARD kolleg24",
        note: "About 875 MB on Commons — stream it.",
      }),
    ],
  },
  "probability-basics": {
    es: [
      candidate({
        id: "probability-basics-es-01",
        commonsTitle: "File:Probabilidad.webm",
        searchTitle: "Probabilidad",
        audioLanguage: "es",
        durationSeconds: 247,
        license: "CC BY-SA 4.0",
        attribution: "Wikimedia Commons contributor",
        note: "DISPUTED: one research pass offered this as a probability lesson, a second found its Commons metadata describes computer programming. Do not confirm without watching it.",
      }),
    ],
  },

  /* ---------------- Science ---------------- */
  "newtons-second-law": {
    en: [
      candidate({
        id: "newtons-second-law-en-01",
        commonsTitle: "File:STEMonstrations- Newton's 2nd Law of Motion.webm",
        searchTitle: "STEMonstrations Newton's 2nd Law of Motion",
        audioLanguage: "en",
        durationSeconds: 159,
        license: "Public domain (NASA)",
        attribution: "NASA",
        note: "Best licence in the library — NASA, public domain in the US.",
      }),
    ],
  },
  "energy-work": {
    en: [
      candidate({
        id: "energy-work-en-01",
        commonsTitle: "File:PlaneWork.webm",
        searchTitle: "PlaneWork",
        audioLanguage: "en",
        durationSeconds: null,
        license: null,
        attribution: null,
        note: "DISPUTED: the two research passes named different files for this topic, and the second flagged work/energy as one it wanted to re-search. Duration and licence unknown.",
      }),
    ],
  },
  "waves-sound": {
    en: [
      candidate({
        id: "waves-sound-en-01",
        commonsTitle: "File:DopplerEffectBuzzer.webm",
        searchTitle: "Doppler Effect Buzzer",
        audioLanguage: "en",
        durationSeconds: 95,
        license: "CC BY 3.0",
        attribution: "Wikimedia Commons contributor",
        note: "A demonstration of the Doppler effect rather than a narrated lesson — check there is speech before claiming English audio.",
      }),
    ],
  },
  "electricity-basics": {
    en: [
      candidate({
        id: "electricity-basics-en-01",
        commonsTitle: "File:8.02x - Lect 10 - Batteries, Power, Kirchhoff's Rules, Circuits, Kelvin Water Dropper.webm",
        searchTitle: "8.02x Lect 10 Batteries Power Kirchhoff's Rules Circuits",
        audioLanguage: "en",
        durationSeconds: 3001,
        license: "CC BY-NC-SA 3.0",
        attribution: "MIT OpenCourseWare / Walter Lewin",
        level: "advanced",
        note: "EXPECTED TO FAIL VERIFICATION: MIT OpenCourseWare ships CC BY-NC-SA, and NimiqLearn charges for packs. Also 50 minutes — a university lecture, not a lesson.",
      }),
    ],
  },
  "atoms-elements": {
    en: [
      candidate({
        id: "atoms-elements-en-01",
        commonsTitle: "File:How Atoms Are Defying Gravity in NASA's Cold Atom Lab (SVS31389).webm",
        searchTitle: "How Atoms Are Defying Gravity in NASA's Cold Atom Lab",
        audioLanguage: "en",
        durationSeconds: 187,
        license: "Public domain (NASA)",
        attribution: "NASA",
        note: "About cold-atom research rather than atomic structure — good licence, questionable topical fit.",
      }),
    ],
  },
  "dna-genetics": {
    en: [
      candidate({
        id: "dna-genetics-en-01",
        commonsTitle: "File:DNA extraction explained - biology animation.webm",
        searchTitle: "DNA extraction explained biology animation",
        audioLanguage: "en",
        durationSeconds: 108,
        license: "CC BY 4.0",
        attribution: "Wikimedia Commons contributor",
        note: "Made for secondary-school genetics. Short, CC BY — one of the strongest candidates here.",
      }),
    ],
  },

  /* ---------------- Computer Science ---------------- */
  "python-basics": {
    en: [
      candidate({
        id: "python-basics-en-01",
        commonsTitle: "File:Installing Jupyter Notebooks-Anaconda - Python for Beginners.webm",
        searchTitle: "Installing Jupyter Notebooks Anaconda Python for Beginners",
        audioLanguage: "en",
        durationSeconds: 603,
        license: "CC BY 3.0",
        attribution: "Wikimedia Commons contributor",
        note: "Flagged on Commons as needing licence review. It also teaches tool setup, not Python — the topic fit is weak.",
      }),
    ],
  },
  "ai-fundamentals": {
    en: [
      candidate({
        id: "ai-fundamentals-en-01",
        commonsTitle: "File:Artificial intelligence explained in 2 minutes - What exactly is AI?.webm",
        searchTitle: "Artificial intelligence explained in 2 minutes",
        audioLanguage: "en",
        durationSeconds: 143,
        license: "CC BY-SA 4.0",
        attribution: "Wikimedia Commons contributor",
      }),
    ],
  },
};

/* Topics deliberately left without a candidate rather than filled with
   something adjacent. Named here so the gap is a recorded decision and not
   an oversight the next person silently "fixes" with a bad match. */
export const DELIBERATELY_EMPTY = {
  "descriptive-stats":
    "No instructional video found for mean/median/mode. Commons has good diagrams for it, but a diagram is not a lesson.",
  "chemical-bonding":
    "The only candidate found was a molecular-dynamics simulation of argon solvation, which shows hydrogen bonding at molecular scale but is not a beginner bonding lesson.",
  "cell-structure":
    "Commons has a large cell-biology video category, but the research never resolved it to a single beginner lesson.",
};

/** Every candidate in the library, flattened — for the verifier and for tests. */
export function allVideoEntries() {
  const out = [];
  for (const [topicId, byLang] of Object.entries(VIDEO_LIBRARY)) {
    for (const [lang, list] of Object.entries(byLang)) {
      for (const entry of list) out.push({ ...entry, topicId, listedUnder: lang });
    }
  }
  return out;
}
