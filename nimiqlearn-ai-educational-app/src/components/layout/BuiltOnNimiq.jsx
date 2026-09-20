import React, { useState } from "react";
import { useI18n } from "../../hooks/useI18n.js";
import { useNav } from "../../context/NavContext.jsx";
import NimiqLogo from "../ui/NimiqLogo.jsx";
import Button from "../ui/Button.jsx";

/* "Meet Nimiq – Crypto made Easy", Nimiq's own introduction to the network.
   The id is the only thing that identifies the video; the watch link and the
   embed are both derived from it so they can never point at different
   videos. */
const NIMIQ_INTRO_VIDEO_ID = "dA40oyDVtqs";
const WATCH_URL = `https://www.youtube.com/watch?v=${NIMIQ_INTRO_VIDEO_ID}`;
/* youtube-nocookie is YouTube's own privacy-enhanced embed host: same
   player, but it does not set tracking cookies until the learner presses
   play. The `allow` list is the one YouTube's embed generator emits. */
const EMBED_URL = `https://www.youtube-nocookie.com/embed/${NIMIQ_INTRO_VIDEO_ID}`;

/**
 * The "Built on Nimiq" block on Home: logo, a one-line explanation, the
 * embedded intro video, and a sentence on how NimiqLearn relates to Nimiq.
 *
 * Centred and single-column at every width on purpose — the layout the
 * design specifies is the same on desktop and mobile, only the logo and
 * type scale down. The player reuses .video-player from the topic videos so
 * every video in the app has the same 16:9 letterboxed frame.
 */
export default function BuiltOnNimiq() {
  const { t } = useI18n();
  const { navigate } = useNav();
  const [playing, setPlaying] = useState(false);
  return (
    <section
      aria-labelledby="built-on-nimiq-title"
      style={{ marginTop: 72, textAlign: "center" }}
    >
      <NimiqLogo size={72} style={{ margin: "0 auto 18px", display: "block" }} />

      <h2 id="built-on-nimiq-title" style={{ fontSize: "clamp(22px, 2.8vw, 30px)", margin: "0 0 8px" }}>
        {t("home.nimiq.title")}
      </h2>
      <p className="muted" style={{ margin: "0 auto 26px", maxWidth: 480, fontSize: 15.5 }}>
        {t("home.nimiq.sub")}
      </p>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Click to load, same as the lesson videos. This block sits on
            Home, so an eager iframe meant every single visit fetched
            YouTube's player — several hundred kilobytes, on the first
            screen, for a video most visitors never press. loading="lazy"
            does not help: the iframe is in the viewport once you scroll
            here, and lazy only defers what is off screen. */}
        <div className="nimiq-video-frame">
          {playing ? (
            <iframe
              src={`${EMBED_URL}?autoplay=1`}
              title={t("home.nimiq.videoTitle")}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              className="nimiq-video-play"
              onClick={() => setPlaying(true)}
              aria-label={t("nimiqVideo.play", { title: t("home.nimiq.videoTitle") })}
            >
              <span className="nimiq-video-play-icon" aria-hidden="true">▶</span>
              <span className="tiny">{t("nimiqVideo.tapToLoad")}</span>
            </button>
          )}
        </div>

        <p className="strong" style={{ margin: "14px 0 4px", fontSize: 15 }}>
          {t("home.nimiq.videoTitle")}
        </p>
        <a
          href={WATCH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="small"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44 }}
        >
          <span aria-hidden="true">▶</span> {t("home.nimiq.watch")}
        </a>
      </div>

      <p className="small muted" style={{ margin: "22px auto 0", maxWidth: 440, lineHeight: 1.6 }}>
        {t("home.nimiq.body")}
      </p>

      {/* Into the existing Nimiq concepts in the Learn tab — not a separate
          Nimiq page. The whole point of the track living in Learn is that
          learning about Nimiq uses the same loop, the same mastery model
          and the same review schedule as learning about quadratics. */}
      <Button
        variant="nimiq"
        onClick={() => navigate("learn", { topic: "nimiq-blockchain" })}
        style={{ marginTop: 20 }}
      >
        {t("home.nimiq.cta")}
      </Button>
    </section>
  );
}
