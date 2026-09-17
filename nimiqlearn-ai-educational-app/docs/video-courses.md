# Video courses

Video lessons for curriculum topics, sourced from Wikimedia Commons and
streamed from there. No video file is committed to this repo — the originals
run from tens of megabytes to 1.27 GB, and the app builds to a single inlined
HTML file, so hosting media here is doubly a non-starter. What is committed is
metadata.

## Language-first, not page-first

`src/data/videoLibrary.js` is keyed on the language **spoken in the video**:

```
VIDEO_LIBRARY[topicId][audioLanguage] = [ entry, ... ]
```

Not on the language of the Commons page it was found on. Those differ often
enough — an English description over German audio is common — that keying on
the page would serve a German lecture to a French learner and label it French.

## The fallback chain

`selectVideo(topicId, locale)` in `src/services/videoService.js`:

1. a video **spoken** in the learner's language
2. a video with real **subtitles** in their language
3. a video **spoken in English**
4. **nothing**

Step 2 sits below step 1 and is never merged into it: French subtitles on a
German lecture make it a German video with French subtitles, and that is what
the UI says. The selector returns *how* it matched (`audio`, `subtitles`,
`english-fallback`) and `TopicVideo.jsx` prints the corresponding line, so a
learner reading the app in French who gets English audio is told so.

Step 4 is a feature. A topic with no good video shows no video. It never shows
an adjacent one and hopes nobody notices.

## Nothing plays until it is verified

Every entry in the library is a **research result, not a checked fact**, and
the research is known to have been wrong: one pass offered `Probabilidad.webm`
as a probability lesson and a second found its Commons metadata describes
computer programming; the two passes name different files for work and energy.
Durations and licences in the library are claims copied from a chat transcript.

So `verified` is not a field anyone edits in `videoLibrary.js`. It is computed
from `videoVerification.js`, which only the verifier writes, and
`videoService.js` refuses to return an unverified entry. Until an entry
passes, the app behaves exactly as it did before this feature existed.

Verification is two gates, because an API can only prove half of it:

| gate | proves | who |
|---|---|---|
| machine | the file exists; its real URL, duration, licence, author, captions | `npm run verify:videos` |
| content | it teaches this topic, in this language, at this level | a human, watching it |

```
npm run verify:videos                      # check every candidate
npm run verify:videos -- --only <id>       # check one
npm run verify:videos -- --confirm <id>    # after watching it
npm run verify:videos -- --unconfirm <id>  # pull it back
npm run verify:videos -- --report          # state, no network
```

Run it from a machine that can reach `commons.wikimedia.org`. The Claude Code
container cannot — the egress proxy returns 403 — which is exactly why this is
a script and not a build step. It fails cleanly there: candidates are rejected,
nothing is written as verified.

The verifier also prefers a Commons **transcode** (480p/360p VP9) over the
original when one has been generated, HEAD-checking before recording it. Handing
a learner a 1.27 GB original on mobile data is not a lesson.

## Licences

Preference order: public domain > CC BY > CC BY-SA.

**CC BY-NC-\* cannot ship at all.** NimiqLearn sells learning packs for NIM,
which makes this a commercial use, and no amount of attribution fixes NC. The
verifier rejects it outright on the licence it reads from Commons, not on the
claim in the library — `FORBIDDEN_LICENSE_PATTERNS` in `videoLibrary.js`. The
MIT 8.02x lecture currently in the library is expected to fail on exactly this.

Every video shows its author, its licence and a link back to the Commons file
page under the player. CC BY and CC BY-SA both require that, and a learner
should be one tap from the source.

## Gaps are recorded, not hidden

`DELIBERATELY_EMPTY` in the library names the topics left without a candidate
and why — mean/median/mode, chemical bonding, cell structure — so the gap reads
as a decision and not as an oversight for the next person to "fix" with a bad
match.
