import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "../../hooks/useI18n.js";
import { primaryVideoForTopic } from "../../data/nimiqVideos.js";
import { formatDuration } from "../../services/videoService.js";
import Button from "../ui/Button.jsx";

/**
 * An official Nimiq video, embedded as the lesson's opening step.
 *
 * Renders nothing when the concept has no verified video — most of them
 * do not yet, and a lesson without a video is a lesson, where a lesson
 * with the wrong video is a lie the learner cannot detect. See
 * nimiqVideos.js for what "verified" requires.
 *
 * The video is EMBEDDED, never copied: youtube-nocookie serves the same
 * player from YouTube's own privacy-enhanced host, which sets no tracking
 * cookies until the learner presses play. There is no autoplay parameter,
 * deliberately — this runs inside Nimiq Pay's WebView on someone's phone,
 * quite possibly on mobile data.
 *
 * `loading="lazy"` matters more than it looks: the sprint mounts this
 * above the fold, and an eager iframe pulls the whole YouTube player
 * bundle on page load even for a learner who never presses play.
 */
export default function NimiqVideo({ topicId, onWatched = null }) {
  const { t } = useI18n();
  const video = primaryVideoForTopic(topicId);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const frame = useRef(null);

  /* A cross-origin iframe never tells us it failed — no error event, no
     readable document. So the fallback is driven by time: if the player
     has not reported `load` within eight seconds, the learner is shown a
     prominent "watch it on YouTube" route out rather than a grey box.
     The link is always present below the player too; this only promotes
     it when something is evidently wrong (blocked embeds, a corporate
     network, a WebView without the right permissions). */
  useEffect(() => {
    if (!video || !playing || loaded) return undefined;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [video, playing, loaded]);

  if (!video) return null;

  const isShort = video.format === "short";
  const duration = formatDuration(video.durationSeconds);

  return (
    <section className="card nimiq-video" aria-label={t("nimiqVideo.aria")}>
      <header className="nimiq-video-head">
        <span className="badge badge-gold">{t("nimiqVideo.official")}</span>
        {duration && <span className="tiny muted">{duration}</span>}
      </header>

      {video.title && <h3 className="nimiq-video-title">{video.title}</h3>}

      {/* CLICK TO LOAD.
          The iframe is not rendered until the learner presses play, so a
          lesson they scroll past costs zero bytes to YouTube — not a
          thumbnail, not a cookie, not the player bundle, which is several
          hundred kilobytes and was being fetched on mount even with
          loading="lazy" (an in-viewport iframe is not lazy). That matters
          on mobile data inside a wallet's WebView, and it means YouTube
          learns nothing about a learner who never watched.

          It also removes the third-party storage error the embedded
          player logs on every load in a browser that blocks third-party
          storage. */}
      <div className={`nimiq-video-frame ${isShort ? "is-short" : ""}`}>
        {playing ? (
          <iframe
            ref={frame}
            src={`${video.embedUrl}&autoplay=1`}
            title={video.title || t("nimiqVideo.official")}
            onLoad={() => setLoaded(true)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          /* autoplay=1 above applies only to the frame created BY this
             click — the video starts because the learner asked for it,
             which is the opposite of autoplay on page load. */
          <button
            type="button"
            className="nimiq-video-play"
            onClick={() => setPlaying(true)}
            aria-label={t("nimiqVideo.play", { title: video.title || "" })}
          >
            <span className="nimiq-video-play-icon" aria-hidden="true">▶</span>
            <span className="tiny">{t("nimiqVideo.tapToLoad")}</span>
          </button>
        )}
      </div>

      {slow && !loaded && (
        <p className="notice warn nimiq-video-fallback" role="status">
          <span aria-hidden="true">⚠️</span>
          <span>
            {t("nimiqVideo.failed")}{" "}
            <a href={video.watchUrl} target="_blank" rel="noopener noreferrer">
              {t("nimiqVideo.watchOnYouTube")}
            </a>
          </span>
        </p>
      )}

      <p className="tiny muted nimiq-video-credit">
        {video.source} ·{" "}
        <a href={video.watchUrl} target="_blank" rel="noopener noreferrer">
          {t("nimiqVideo.watchOnYouTube")}
        </a>
      </p>

      {onWatched && (
        <Button variant="teal" size="sm" className="nimiq-video-done" onClick={onWatched}>
          {t("nimiqVideo.watched")}
        </Button>
      )}
    </section>
  );
}
