#!/usr/bin/env node
/* ============================================================
   NimiqLearn — Nimiq video verifier
   ------------------------------------------------------------
   Resolves every id in src/data/nimiqVideos.js against YouTube's
   oEmbed endpoint and writes what it finds to
   src/data/nimiqVideoVerification.js.

     npm run verify:nimiq-videos                  check all
     npm run verify:nimiq-videos -- --only <id>   check one
     npm run verify:nimiq-videos -- --confirm <id>
     npm run verify:nimiq-videos -- --unconfirm <id>
     npm run verify:nimiq-videos -- --report      no network

   Run it from a machine that can reach youtube.com. The build
   container cannot — the egress proxy refuses the connection —
   which is exactly why this is a script and not a build step.

   ------------------------------------------------------------
   WHAT EACH GATE PROVES

   oEmbed returns the title and, crucially, `author_name`: the
   channel. That settles "is this really Nimiq's video" — the
   question a list of ids cannot answer, and the one that matters,
   because a search for Nimiq tutorials returns exchange ads and
   Trust Wallet walkthroughs that would look perfectly plausible
   in this file.

   It cannot settle "does this teach self-custody". That needs
   somebody to watch it, which is what --confirm records. A video
   whose channel checks out but whose content has not been
   confirmed stays out of the lesson.
   ============================================================ */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { allNimiqVideos, OFFICIAL_CHANNEL } from "../src/data/nimiqVideos.js";
import { NIMIQ_VIDEO_VERIFICATION } from "../src/data/nimiqVideoVerification.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../src/data/nimiqVideoVerification.js");
const UA = "NimiqLearn-video-verifier/1.0 (https://github.com/Eric-65/nimiqlearn)";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] || true;
};

async function oembed(youtubeId) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${youtubeId}`
  )}&format=json`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  /* oEmbed answers 404 for a video that does not exist, and 401 for one
     that exists but cannot be embedded — a meaningful difference, since the
     second would break the player even though the id is real. */
  if (res.status === 404) return { ok: false, reason: "no such video" };
  if (res.status === 401) return { ok: false, reason: "embedding is disabled for this video" };
  if (!res.ok) return { ok: false, reason: `oEmbed responded ${res.status}` };
  const data = await res.json();
  return { ok: true, data };
}

let header = "";
async function loadHeader() {
  const current = await readFile(OUT, "utf8");
  const end = current.indexOf("*/");
  header = end === -1 ? "" : `${current.slice(0, end + 2)}\n`;
}

async function save(state) {
  await writeFile(OUT, `${header}\nexport const NIMIQ_VIDEO_VERIFICATION = ${JSON.stringify(state, null, 2)};\n`, "utf8");
}

function report(state) {
  const all = allNimiqVideos();
  console.log(`\n${all.length} videos\n`);
  for (const v of all) {
    const rec = state.entries[v.youtubeId];
    const mark = !rec
      ? "· unchecked"
      : rec.authorName !== OFFICIAL_CHANNEL
        ? `✗ channel is "${rec.authorName}"`
        : rec.contentConfirmed
          ? "✓ live"
          : "◐ channel ok, awaiting --confirm";
    console.log(`  ${mark.padEnd(34)} ${v.youtubeId}  ${v.topicId || "(unplaced)"}`);
    console.log(`      ${rec?.title || v.title || "(title unknown)"}`);
    if (v.note) console.log(`      note: ${v.note}`);
  }
  const live = all.filter((v) => {
    const rec = state.entries[v.youtubeId];
    return v.attestedBy === "owner" || (rec?.authorName === OFFICIAL_CHANNEL && rec?.contentConfirmed);
  }).length;
  console.log(`\n${live} of ${all.length} will show in a lesson.\n`);
}

async function main() {
  await loadHeader();
  const state = {
    generatedAt: NIMIQ_VIDEO_VERIFICATION.generatedAt,
    entries: { ...NIMIQ_VIDEO_VERIFICATION.entries },
  };

  const confirm = flag("--confirm");
  if (confirm) {
    const rec = state.entries[confirm];
    if (!rec) {
      console.error(`${confirm} has not been checked yet — run the verifier first.`);
      process.exit(1);
    }
    if (rec.authorName !== OFFICIAL_CHANNEL) {
      console.error(`${confirm} is published by "${rec.authorName}", not ${OFFICIAL_CHANNEL}. It cannot be shown as an official Nimiq video.`);
      process.exit(1);
    }
    rec.contentConfirmed = true;
    rec.verifiedAt = new Date().toISOString();
    state.generatedAt = rec.verifiedAt;
    await save(state);
    console.log(`✓ ${confirm} confirmed — "${rec.title}" will now show in its lesson.`);
    return;
  }

  const unconfirm = flag("--unconfirm");
  if (unconfirm) {
    const rec = state.entries[unconfirm];
    if (rec) {
      rec.contentConfirmed = false;
      rec.verifiedAt = null;
      state.generatedAt = new Date().toISOString();
      await save(state);
    }
    console.log(`${unconfirm} is no longer shown.`);
    return;
  }

  if (args.includes("--report")) {
    report(state);
    return;
  }

  const only = flag("--only");
  const videos = allNimiqVideos().filter((v) => !only || v.youtubeId === only);
  if (!videos.length) {
    console.error(only ? `No video with id ${only}.` : "No videos.");
    process.exit(1);
  }

  let ok = 0;
  let rejected = 0;
  for (const v of videos) {
    process.stdout.write(`  ${v.youtubeId} … `);
    try {
      const result = await oembed(v.youtubeId);
      if (!result.ok) {
        rejected++;
        delete state.entries[v.youtubeId];
        console.log(`✗ ${result.reason}`);
        continue;
      }
      const { title, author_name: authorName, duration } = result.data;
      const prev = state.entries[v.youtubeId];
      /* A confirmation survives only if the video is still the same one.
         If the title changed, somebody confirmed different content. */
      const sameVideo = prev?.title === title;
      state.entries[v.youtubeId] = {
        title,
        authorName,
        durationSeconds: typeof duration === "number" ? Math.round(duration) : null,
        checkedAt: new Date().toISOString(),
        contentConfirmed: Boolean(sameVideo && prev?.contentConfirmed),
        verifiedAt: sameVideo ? prev?.verifiedAt || null : null,
      };
      if (authorName !== OFFICIAL_CHANNEL) {
        rejected++;
        console.log(`✗ published by "${authorName}", not ${OFFICIAL_CHANNEL} — "${title}"`);
      } else {
        ok++;
        const proposed = v.title;
        const drift = proposed && proposed !== title ? `  (proposed title was "${proposed}")` : "";
        console.log(`✓ "${title}"${drift}${state.entries[v.youtubeId].contentConfirmed ? "" : " — needs --confirm"}`);
      }
    } catch (err) {
      rejected++;
      console.log(`✗ ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  state.generatedAt = new Date().toISOString();
  await save(state);
  console.log(`\n${ok} on the official channel, ${rejected} rejected.`);
  console.log("Watch each one, then:  npm run verify:nimiq-videos -- --confirm <youtubeId>\n");
  report(state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
