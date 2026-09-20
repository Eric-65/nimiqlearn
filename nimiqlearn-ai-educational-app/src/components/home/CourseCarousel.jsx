import React, { useEffect, useMemo, useState } from "react";
import { useNav } from "../../context/NavContext.jsx";
import { useI18n } from "../../hooks/useI18n.js";
import { useLearner } from "../../hooks/useLearner.js";
import { findTopic } from "../../data/mockTopics.js";
import { formatDuration } from "../../services/videoService.js";
import { STATUS_META } from "../../services/knowledgeService.js";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";

/* 3-up on a desktop, 1-up on a phone: a 390px screen cannot show three
   cards with a readable title and two buttons each. The arrows always step
   by a full page, so "next" on a desktop shows the next three. */
function usePageSize() {
  const query = "(min-width: 720px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide ? 3 : 1;
}

/**
 * A paged row of video courses. Home renders one for English courses and
 * one for courses in other languages, with the same card, the same arrows
 * and the same paging — three at a time, all of them reachable.
 *
 * Every card is a playable video; nothing here is a placeholder. Clicking
 * a card, its image or "Start learning" opens the topic in the Learn tab in
 * watch-first mode — the video plays there, never inline on Home — and
 * carries the card's spoken language so Learn shows THIS video, not the
 * one it would have picked for the UI language. "More info" opens the
 * concept on the Knowledge Map.
 *
 * Stats shown are real ones the app has (duration, spoken language, the
 * learner's own mastery). No like counts or learner counts: the app does
 * not have them and will not invent them.
 *
 * @param courses  [{ id, topicId, video, audioLanguage }] from coursesByLanguage()
 * @param title    section heading, already translated
 * @param eyebrow  small label above the heading, already translated
 * @param idBase   distinct per instance, for aria ids
 */
export default function CourseCarousel({ courses, title, eyebrow, idBase = "courses" }) {
  const { navigate } = useNav();
  const { t, tOr, locale } = useI18n();
  const { getEntry } = useLearner();
  const pageSize = usePageSize();
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(courses.length / pageSize));

  /* A page that no longer exists after a resize (page 1 of 2 at 3-up is
     page 3 of 6 at 1-up, but page 5 of 6 has no 3-up equivalent) snaps back. */
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const languageName = useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([locale], { type: "language" });
      return (code) => dn.of(code) || code;
    } catch {
      return (code) => code;
    }
  }, [locale]);

  if (!courses || courses.length === 0) return null;

  const visible = courses.slice(page * pageSize, page * pageSize + pageSize);
  const canPrev = page > 0;
  const canNext = page < pageCount - 1;
  const headingId = `${idBase}-title`;

  return (
    <section style={{ marginTop: 64 }} aria-labelledby={headingId}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={headingId} style={{ fontSize: "clamp(22px, 2.8vw, 30px)", margin: 0 }}>
          {title}
        </h2>
      </div>

      <div className="carousel">
        <button
          type="button"
          className="carousel-arrow"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={!canPrev}
          aria-label={t("courses.prev")}
        >
          ‹
        </button>

        <div className="carousel-track" style={{ "--per-page": pageSize }} aria-live="polite">
          {visible.map(({ id, topicId, video, audioLanguage }) => {
            const topic = findTopic(topicId);
            const entry = getEntry(topicId);
            const duration = formatDuration(video.durationSeconds);
            /* `watch` holds the practice question until the learner taps
               "I've watched it"; `lang` is the language of THIS card's
               video, so Learn opens the same video the card showed. */
            const open = () => navigate("learn", { topic: topicId, watch: "1", lang: audioLanguage });
            return (
              <article key={id} className="course-card">
                <button type="button" className="course-thumb" onClick={open} aria-label={t("courses.open", { topic: topic?.name || topicId })}>
                  {video.posterUrl ? (
                    <img src={video.posterUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="course-thumb-fallback" aria-hidden="true">🎬</div>
                  )}
                  <span className="course-play" aria-hidden="true">▶</span>
                  {duration && <span className="course-duration">{duration}</span>}
                </button>

                <div className="course-body">
                  <Badge tone="blue">{topic?.parentId ? tOr(`topic.${topic.parentId}.name`, topic.parentName) : t("learn.concept")}</Badge>
                  <h3 className="course-title">{tOr(`topic.${topicId}.name`, topic?.name || topicId)}</h3>
                  <p className="course-desc small muted">{tOr(`topic.${topicId}.description`, topic?.description || "")}</p>

                  <ul className="course-stats" aria-label={t("courses.stats")}>
                    <li><span aria-hidden="true">🎧</span> {languageName(audioLanguage)}</li>
                    {duration && <li><span aria-hidden="true">⏱</span> {duration}</li>}
                    <li>
                      <span className="status-dot" style={{ background: STATUS_META[entry?.status]?.color || "var(--st-new)" }} aria-hidden="true" />{" "}
                      {t(`status.${String(entry?.status || "NEW").toLowerCase()}`)}
                      {entry?.mastery > 0 && <span className="muted"> · {entry.mastery}%</span>}
                    </li>
                  </ul>

                  <div className="course-actions">
                    <Button variant="outline" size="sm" onClick={() => navigate("knowledge", { topic: topicId })}>
                      {t("courses.moreInfo")}
                    </Button>
                    <Button variant="primary" size="sm" onClick={open}>
                      {t("courses.start")}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          className="carousel-arrow"
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          disabled={!canNext}
          aria-label={t("courses.next")}
        >
          ›
        </button>
      </div>

      {pageCount > 1 && (
        <div className="carousel-dots" role="tablist" aria-label={t("courses.pages")}>
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === page}
              aria-label={t("courses.page", { n: i + 1, total: pageCount })}
              className={`carousel-dot${i === page ? " active" : ""}`}
              onClick={() => setPage(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
