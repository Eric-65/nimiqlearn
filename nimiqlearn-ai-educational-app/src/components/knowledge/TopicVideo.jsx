import React, { useMemo } from "react";
import { useI18n } from "../../hooks/useI18n.js";
import {
  selectVideo,
  formatDuration,
  MATCH_SUBTITLES,
  MATCH_ENGLISH,
  MATCH_CHOSEN,
} from "../../services/videoService.js";

/**
 * Video lesson for a topic, in the learner's language where one exists.
 *
 * Renders NOTHING when there is no verified video for the topic. That is the
 * point rather than a gap: a topic with no good video shows no video, instead
 * of an adjacent one dressed up as a lesson. Most topics are in that state
 * today, so most topics look exactly as they did before this component
 * existed.
 *
 * When there is one, the component says which language the learner is
 * actually getting. selectVideo() reports HOW it matched — spoken in their
 * language, subtitled into it, or English because nothing else existed — and
 * the line under the player is that answer, not a guess. A learner reading
 * the app in French who gets an English lecture is told so.
 *
 * The licence line is not decoration either. Every file here is somebody
 * else's work under CC BY or CC BY-SA, and both require attribution and a
 * route back to the source, so the author, the licence and the Commons link
 * ship with the video rather than in a page the learner will never open.
 */
/**
 * @param audioLanguage  a language the learner chose explicitly — the card
 *                       they tapped on Home. The video in that language is
 *                       shown even when it is not the UI language.
 * @param onEnded        called when the video plays to the end.
 */
export default function TopicVideo({ topicId, audioLanguage = null, onEnded }) {
  const { t, locale } = useI18n();

  const selection = useMemo(() => selectVideo(topicId, locale, { audioLanguage }), [topicId, locale, audioLanguage]);

  /* Language names in the learner's own language — "Deutsch" for a German
     reader, "German" for an English one. Intl does this for all ten locales;
     hand-translating a language table would be ten times the strings for a
     worse answer. Old engines without DisplayNames get the raw code, which is
     ugly but never wrong. */
  const languageName = useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([locale], { type: "language" });
      return (code) => dn.of(code) || code;
    } catch {
      return (code) => code;
    }
  }, [locale]);

  if (!selection) return null;

  const { video, match, requestedLanguage, spokenLanguage } = selection;
  const duration = formatDuration(video.durationSeconds);

  let languageLine = null;
  if (match === MATCH_CHOSEN) {
    /* Their own pick, not the UI language: say what is spoken, plainly. */
    languageLine = t("video.spokenIn", { spoken: languageName(spokenLanguage) });
  } else if (match === MATCH_ENGLISH) {
    languageLine = t("video.englishOnly");
  } else if (match === MATCH_SUBTITLES) {
    languageLine = t("video.subtitled", {
      spoken: languageName(spokenLanguage),
      subtitles: languageName(requestedLanguage),
    });
  }

  return (
    <section className="card video-card" aria-label={t("video.aria")}>
      <header className="video-card-head">
        <h3 className="card-title" style={{ margin: 0 }}>
          🎬 {t("video.title")}
        </h3>
        {duration && <span className="tiny muted video-duration">{duration}</span>}
      </header>

      {/* preload="metadata" so opening a topic costs a few kilobytes rather
          than starting a download the learner may never watch — these files
          run to hundreds of megabytes. playsInline keeps it in the page on
          iOS instead of taking over the screen inside the Nimiq Pay webview. */}
      <video
        className="video-player"
        src={video.directVideoUrl}
        controls
        preload="metadata"
        playsInline
        crossOrigin="anonymous"
        onEnded={onEnded}
      >
        {video.subtitleLanguages.map((lang) => (
          <track
            key={lang}
            kind="subtitles"
            srcLang={lang}
            label={languageName(lang)}
            src={`https://commons.wikimedia.org/w/api.php?action=timedtext&format=json&title=${encodeURIComponent(
              video.commonsTitle
            )}&trackformat=vtt&lang=${encodeURIComponent(lang)}`}
            default={lang === requestedLanguage}
          />
        ))}
        {t("video.unsupported")}
      </video>

      {languageLine && (
        <p className="small video-language" role="note">
          <span aria-hidden="true">🌐</span> {languageLine}
        </p>
      )}

      <p className="tiny muted video-credit">
        {video.attribution} · {video.license} ·{" "}
        <a href={video.commonsUrl} target="_blank" rel="noopener noreferrer">
          {t("video.commons")}
        </a>
      </p>
    </section>
  );
}
