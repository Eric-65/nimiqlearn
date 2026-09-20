/* ============================================================
   NimiqLearn — official Nimiq videos, mapped to lessons
   ------------------------------------------------------------
   Short videos from Nimiq's own YouTube channel, embedded from
   YouTube rather than copied: nothing here is downloaded or
   re-uploaded, and every entry links back to the original.

   Shape, per the brief:

     topicId       the concept this video teaches
     youtubeId     the only identifier — the watch URL and the
                   embed are both derived from it, so they can
                   never point at different videos
     title         the video's real title
     format        "short" | "video"
     durationSeconds
     language      BCP-47 of the spoken audio
     source        always "Official Nimiq YouTube"

   ------------------------------------------------------------
   WHY EVERY ENTRY IS GATED

   The risk here is not a broken embed — a dead id shows YouTube's
   own error and the "Watch on YouTube" link still works. The risk
   is MISLABELLING: putting a video under "Self-custody" that
   teaches something else, or calling a third party's video an
   official Nimiq one.

   That risk is real rather than theoretical. Searching for Nimiq
   payment tutorials returns Trust Wallet walkthroughs, exchange
   ads and "free NIM" clickbait alongside the official channel,
   and several would look plausible in a list of ids.

   So verification is two gates, same as the Wikimedia course
   library:

     machine   the video exists AND its channel is Nimiq's
               (`npm run verify:nimiq-videos`, which reads the
               author from YouTube's oEmbed endpoint)
     content   it actually teaches this concept
               (a person watching it, then --confirm)

   Until both pass, the lesson simply has no video — the rest of
   the lesson is unaffected. A wrong video would be worse than
   none, because a learner cannot tell it is wrong.

   ------------------------------------------------------------
   WHERE THESE IDS CAME FROM

   YouTube is unreachable from the build environment, so none of
   this could be checked here. Each entry records how it was
   attested so the next person knows what they are confirming:

     "owner"   the project owner already ships it in the app
     "search"  a web search returned this id with this title and
               an official-channel URL — good enough to propose,
               not good enough to publish
     "unknown" supplied without a resolvable title
   ============================================================ */

import { NIMIQ_VIDEO_VERIFICATION as VERIFICATION } from "./nimiqVideoVerification.js";

/** The channel a video must belong to before it can be called official. */
export const OFFICIAL_CHANNEL = "Nimiq";

export const watchUrl = (youtubeId) => `https://www.youtube.com/watch?v=${youtubeId}`;
export const shortsUrl = (youtubeId) => `https://www.youtube.com/shorts/${youtubeId}`;

/* youtube-nocookie is YouTube's own privacy-enhanced host: the same player,
   but it sets no tracking cookies until the learner presses play. Matches
   what BuiltOnNimiq already uses, so every video in the app behaves the
   same way. `rel=0` keeps the end-screen suggestions to the same channel;
   there is deliberately no autoplay parameter. */
export const embedUrl = (youtubeId) =>
  `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`;

const video = (entry) => {
  const v = VERIFICATION.entries?.[entry.youtubeId] || null;
  const channelOk = entry.attestedBy === "owner" || v?.authorName === OFFICIAL_CHANNEL;
  const contentOk = entry.attestedBy === "owner" || v?.contentConfirmed === true;

  return {
    format: "video",
    language: "en",
    durationSeconds: null,
    source: "Official Nimiq YouTube",
    note: "",
    ...entry,
    /* A verified title always beats the proposed one: the proposed title
       came from a search index, the verified one from YouTube. */
    title: v?.title || entry.title,
    authorName: v?.authorName || (entry.attestedBy === "owner" ? OFFICIAL_CHANNEL : null),
    durationSeconds: v?.durationSeconds ?? entry.durationSeconds ?? null,
    watchUrl: entry.format === "short" ? shortsUrl(entry.youtubeId) : watchUrl(entry.youtubeId),
    embedUrl: embedUrl(entry.youtubeId),
    verified: Boolean(channelOk && contentOk),
    verifiedAt: v?.verifiedAt || null,
  };
};

export const NIMIQ_VIDEOS = {
  "nimiq-blockchain": [
    video({
      youtubeId: "dA40oyDVtqs",
      title: "Meet Nimiq – Crypto made Easy",
      format: "video",
      attestedBy: "owner",
      note: "Already shipping in the Built on Nimiq section on Home, so the owner has seen it. Reused here rather than sourced again.",
    }),
    video({
      youtubeId: "hH17mmNlKB0",
      title: "What is so special about Nimiq technology?",
      format: "video",
      attestedBy: "search",
    }),
  ],
  "self-custody": [
    video({
      youtubeId: "ZV2pDKsr_uM",
      title: "What is Nimiq?",
      format: "video",
      attestedBy: "search",
      note: "Search summary describes it as being about self-custodial crypto being confusing and hard to use — which is this concept, not the chain. Confirm which before publishing.",
    }),
  ],
  "sending-nim": [
    video({
      youtubeId: "ymQqvgZmZcA",
      title: "How to create a Nimiq Wallet - Tutorial",
      format: "video",
      attestedBy: "search",
      note: "A wallet-creation walkthrough. Confirm it actually covers sending and receiving before mapping it here rather than to self-custody.",
    }),
  ],
  "nimiq-pay": [
    video({
      youtubeId: "d1yiJ9Kdhxg",
      title: "Nimiq Podcast Episode 14: Introducing Nimiq Pay",
      format: "video",
      attestedBy: "search",
      note: "A podcast episode, so probably long-form rather than a short lesson. Check the length before using it in a sprint.",
    }),
  ],
  /* The Short the project owner supplied. Kept, because they supplied it —
     but with no topic claimed: the id could not be resolved to a title from
     here (YouTube is blocked and a web search did not return it), so
     filing it under a concept would be a guess about what it teaches. The
     verifier will name it, and --confirm will place it. */
  unplaced: [
    video({
      youtubeId: "2ffYZUsHnOg",
      title: null,
      format: "short",
      attestedBy: "unknown",
      note: "Supplied by the project owner. Title and topic unresolved from this environment — run the verifier, then map it to the concept it actually teaches.",
    }),
  ],
};

/** Videos that may be shown for a concept, in order. */
export function videosForTopic(topicId, { includeUnverified = false } = {}) {
  const list = NIMIQ_VIDEOS[topicId] || [];
  return includeUnverified ? list : list.filter((v) => v.verified);
}

/** The one video a lesson shows, or null. */
export function primaryVideoForTopic(topicId) {
  return videosForTopic(topicId)[0] || null;
}

/** Every entry, flattened — for the verifier and for the credits page. */
export function allNimiqVideos() {
  return Object.entries(NIMIQ_VIDEOS).flatMap(([topicId, list]) =>
    list.map((v) => ({ ...v, topicId: topicId === "unplaced" ? null : topicId }))
  );
}
