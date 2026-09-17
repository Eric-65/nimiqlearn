#!/usr/bin/env node
/* ============================================================
   NimiqLearn — video verifier
   ------------------------------------------------------------
   Resolves every candidate in src/data/videoLibrary.js against
   the Wikimedia Commons API and writes what it actually finds to
   src/data/videoVerification.js. Nothing in the app plays a
   video until this has run and a human has confirmed the
   content.

   Run it from a machine that can reach commons.wikimedia.org —
   the build/CI container here cannot, which is the whole reason
   this is a script and not a build step.

     npm run verify:videos                  check every candidate
     npm run verify:videos -- --only <id>   check one
     npm run verify:videos -- --confirm <id>   mark as watched
     npm run verify:videos -- --unconfirm <id>
     npm run verify:videos -- --report      print state, no network

   ------------------------------------------------------------
   TWO GATES

   The API can tell us the file exists, where it streams from,
   how long it is, its licence and its author. It cannot tell us
   whether the video teaches the right topic, is spoken in the
   language we filed it under, or suits a beginner. One candidate
   in the library is known to be wrong in exactly that way. So a
   machine pass is necessary and not sufficient: --confirm is the
   second gate, and you run it after watching the video, not
   before.

   A CC BY-NC licence fails outright rather than warning. The app
   sells learning packs for NIM, which makes this a commercial
   use, and no amount of attribution fixes NC.
   ============================================================ */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { allVideoEntries, isCommercialUseOk, commonsPageUrl } from "../src/data/videoLibrary.js";
import { VIDEO_VERIFICATION } from "../src/data/videoVerification.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../src/data/videoVerification.js");
const API = "https://commons.wikimedia.org/w/api.php";
/* Commons asks automated clients to identify themselves and to say where to
   complain. An anonymous script hammering the API is how a project gets
   rate-limited for everyone. */
const UA = "NimiqLearn-video-verifier/1.0 (https://github.com/Eric-65/nimiqlearn)";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] || true;
};

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status} for ${JSON.stringify(params)}`);
  return res.json();
}

const IMAGEINFO = {
  action: "query",
  prop: "imageinfo",
  iiprop: "url|size|mime|extmetadata|user",
  iiextmetadatafilter: "LicenseShortName|UsageTerms|Artist|Attribution|Credit|Restrictions",
};

async function lookupByTitle(title) {
  const data = await api({ ...IMAGEINFO, titles: title });
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  return { title: page.title, info: page.imageinfo?.[0] || null };
}

/* Commons keeps captions as separate pages in the TimedText namespace, named
   "TimedText:<file name>.<lang>.srt". Listing them is the only honest way to
   populate subtitleLanguages — and step 2 of the selector's fallback chain is
   decorative without it. */
async function lookupSubtitles(title) {
  const data = await api({
    action: "query",
    list: "allpages",
    apnamespace: "710",
    apprefix: title.replace(/^File:/, ""),
    aplimit: "50",
  });
  const pages = data?.query?.allpages || [];
  const langs = new Set();
  for (const p of pages) {
    const m = p.title.match(/\.([A-Za-z-]{2,10})\.(?:srt|vtt)$/);
    if (m) langs.add(m[1].toLowerCase());
  }
  return [...langs].sort();
}

async function lookupBySearch(searchTitle) {
  const data = await api({
    ...IMAGEINFO,
    generator: "search",
    gsrsearch: searchTitle,
    gsrnamespace: "6",
    gsrlimit: "5",
  });
  const pages = data?.query?.pages || [];
  /* Only video files. A search for a lesson title happily returns the
     thumbnail JPEGs that illustrate it. */
  const video = pages.find((p) => (p.imageinfo?.[0]?.mime || "").startsWith("video/"));
  if (!video) return null;
  return { title: video.title, info: video.imageinfo?.[0] || null, viaSearch: true };
}

/* Commons transcodes big uploads to smaller streams. A 1.27 GB original is not
   something to hand a learner on mobile data, so prefer a transcode when one
   has actually been generated — hence the HEAD check rather than a guess. */
function transcodeCandidates(originalUrl) {
  const m = originalUrl.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(.+\/)([^/]+)$/);
  if (!m) return [];
  const [, path, file] = m;
  const base = `https://upload.wikimedia.org/wikipedia/commons/transcoded/${path}${file}/${file}`;
  return [`${base}.480p.vp9.webm`, `${base}.360p.vp9.webm`, `${base}.720p.vp9.webm`];
}

async function firstReachable(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA } });
      if (res.ok) return { url, bytes: Number(res.headers.get("content-length")) || null };
    } catch {
      /* A missing transcode is normal, not an error — fall through. */
    }
  }
  return null;
}

const plain = (html) =>
  String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

function readLicense(meta) {
  const short = plain(meta?.LicenseShortName?.value);
  const terms = plain(meta?.UsageTerms?.value);
  return short || terms || null;
}

function readAttribution(meta, uploader) {
  return (
    plain(meta?.Attribution?.value) ||
    plain(meta?.Artist?.value) ||
    plain(meta?.Credit?.value) ||
    (uploader ? `${uploader} (Wikimedia Commons)` : null)
  );
}

async function verifyEntry(entry) {
  const found =
    (entry.commonsTitle ? await lookupByTitle(entry.commonsTitle) : null) ||
    (await lookupBySearch(entry.searchTitle));

  if (!found?.info) return { id: entry.id, ok: false, reason: "not found on Commons" };

  const { info, title, viaSearch } = found;
  if (!(info.mime || "").startsWith("video/")) {
    return { id: entry.id, ok: false, reason: `not a video (${info.mime})` };
  }

  const license = readLicense(info.extmetadata);
  if (!license) return { id: entry.id, ok: false, reason: "no licence stated on the file page" };
  if (!isCommercialUseOk(license)) {
    return { id: entry.id, ok: false, reason: `licence forbids commercial use (${license})` };
  }
  const restrictions = plain(info.extmetadata?.Restrictions?.value);

  const stream = await firstReachable(transcodeCandidates(info.url));
  const subtitleLanguages = await lookupSubtitles(title).catch(() => []);

  return {
    id: entry.id,
    ok: true,
    viaSearch,
    record: {
      commonsTitle: title,
      commonsUrl: info.descriptionurl || commonsPageUrl(title),
      directVideoUrl: stream?.url || info.url,
      usedTranscode: Boolean(stream),
      originalBytes: info.size ?? null,
      streamBytes: stream?.bytes ?? info.size ?? null,
      durationSeconds: info.duration ? Math.round(info.duration) : null,
      subtitleLanguages,
      license,
      restrictions: restrictions || null,
      attribution: readAttribution(info.extmetadata, info.user),
      machineCheckedAt: new Date().toISOString(),
      /* Never set by this script. A human sets it with --confirm, after
         watching the video. The library will not serve the entry until then. */
      contentConfirmed: false,
      verifiedAt: null,
    },
  };
}

function serialize(state) {
  const header = readFileSyncHeader();
  return `${header}\nexport const VIDEO_VERIFICATION = ${JSON.stringify(state, null, 2)};\n`;
}

let cachedHeader = null;
function readFileSyncHeader() {
  return cachedHeader;
}

async function loadHeader() {
  const current = await readFile(OUT, "utf8");
  const end = current.indexOf("*/");
  cachedHeader = end === -1 ? "" : `${current.slice(0, end + 2)}\n`;
}

async function save(state) {
  await writeFile(OUT, serialize(state), "utf8");
}

function report(state) {
  const entries = allVideoEntries();
  console.log(`\n${entries.length} candidates\n`);
  for (const e of entries) {
    const v = state.entries[e.id];
    const mark = !v ? "· unchecked" : v.contentConfirmed ? "✓ live" : "◐ machine-checked, awaiting --confirm";
    console.log(`  ${mark.padEnd(38)} ${e.id}`);
    if (v?.subtitleLanguages?.length) console.log(`      subtitles: ${v.subtitleLanguages.join(", ")}`);
    if (v?.license) console.log(`      ${v.license}${v.durationSeconds ? ` · ${v.durationSeconds}s` : ""}`);
    if (e.note) console.log(`      note: ${e.note}`);
  }
  const live = entries.filter((e) => state.entries[e.id]?.contentConfirmed).length;
  console.log(`\n${live} of ${entries.length} will play in the app.\n`);
}

async function main() {
  await loadHeader();
  const state = {
    generatedAt: VIDEO_VERIFICATION.generatedAt,
    entries: { ...VIDEO_VERIFICATION.entries },
  };

  const confirm = flag("--confirm");
  const unconfirm = flag("--unconfirm");

  if (confirm) {
    const rec = state.entries[confirm];
    if (!rec) {
      console.error(`${confirm} has not been machine-checked yet — run the verifier first.`);
      process.exit(1);
    }
    rec.contentConfirmed = true;
    rec.verifiedAt = new Date().toISOString();
    state.generatedAt = rec.verifiedAt;
    await save(state);
    console.log(`✓ ${confirm} confirmed — it will now play in the app.`);
    return;
  }

  if (unconfirm) {
    const rec = state.entries[unconfirm];
    if (rec) {
      rec.contentConfirmed = false;
      rec.verifiedAt = null;
      state.generatedAt = new Date().toISOString();
      await save(state);
    }
    console.log(`${unconfirm} is no longer served.`);
    return;
  }

  if (args.includes("--report")) {
    report(state);
    return;
  }

  const only = flag("--only");
  const entries = allVideoEntries().filter((e) => !only || e.id === only);
  if (!entries.length) {
    console.error(only ? `No candidate with id ${only}.` : "No candidates.");
    process.exit(1);
  }

  let ok = 0;
  let failed = 0;
  for (const entry of entries) {
    process.stdout.write(`  ${entry.id} … `);
    try {
      const result = await verifyEntry(entry);
      if (!result.ok) {
        failed++;
        delete state.entries[entry.id];
        console.log(`✗ ${result.reason}`);
        continue;
      }
      ok++;
      /* Keep a confirmation that was already given, unless the file the
         verifier resolved to has changed underneath it — in which case the
         human confirmed a different video and has to watch this one. */
      const prev = state.entries[entry.id];
      const sameFile = prev?.commonsTitle === result.record.commonsTitle;
      if (sameFile && prev.contentConfirmed) {
        result.record.contentConfirmed = true;
        result.record.verifiedAt = prev.verifiedAt;
      }
      state.entries[entry.id] = result.record;
      const size = result.record.streamBytes
        ? ` · ${(result.record.streamBytes / 1e6).toFixed(0)} MB`
        : "";
      console.log(
        `✓ ${result.record.license}${
          result.record.durationSeconds ? ` · ${result.record.durationSeconds}s` : ""
        }${size}${result.viaSearch ? " (found by search)" : ""}${
          result.record.contentConfirmed ? "" : " — needs --confirm"
        }`
      );
    } catch (err) {
      failed++;
      console.log(`✗ ${err.message}`);
    }
    /* Courtesy pause. Commons is a donated resource. */
    await new Promise((r) => setTimeout(r, 300));
  }

  state.generatedAt = new Date().toISOString();
  await save(state);

  console.log(`\n${ok} resolved, ${failed} rejected.`);
  console.log("Nothing plays until you watch it and run:  npm run verify:videos -- --confirm <id>\n");
  report(state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
