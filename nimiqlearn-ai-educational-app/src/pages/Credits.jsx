import React, { useMemo } from "react";
import { useI18n } from "../hooks/useI18n.js";
import { findTopic } from "../data/mockTopics.js";
import { allVideoEntries, DELIBERATELY_EMPTY } from "../data/videoLibrary.js";
import { licenseUrl, verificationStatus, formatDuration } from "../services/videoService.js";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import NimiqLogo from "../components/ui/NimiqLogo.jsx";

/* Third-party material that is not a topic video: named here rather than
   scattered through components, so the credits page is the one complete
   record of everything NimiqLearn shows that it did not make. */
const OTHER_ASSETS = [
  {
    id: "nimiq-logo",
    titleKey: "credits.asset.logo",
    creator: "Nimiq",
    source: "Nimiq Design Kit",
    sourceUrl: "https://nimiq.dev/design-kit/",
  },
  {
    id: "meet-nimiq",
    title: "Meet Nimiq – Crypto made Easy",
    creator: "Nimiq",
    source: "YouTube",
    sourceUrl: "https://www.youtube.com/watch?v=dA40oyDVtqs",
    noteKey: "credits.asset.embedded",
  },
];

const STATUS_TONE = { playable: "teal", "awaiting-review": "amber", unchecked: "slate" };

/**
 * Credits & licences: every video and brand asset NimiqLearn uses, with its
 * creator, licence, and a link to the original. Also lists the topics that
 * deliberately have no video and why, so a gap reads as a decision.
 *
 * Honest about state: an entry that has not passed both verification gates
 * is shown as such, not as a lesson the learner can watch. The status
 * badges come from the same data the player reads, so this page can never
 * claim a video is live that TopicVideo would refuse to show.
 */
export default function Credits() {
  const { t, tOr, locale } = useI18n();

  const languageName = useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([locale], { type: "language" });
      return (code) => dn.of(code) || code;
    } catch {
      return (code) => code;
    }
  }, [locale]);

  /* Group by topic, in curriculum order, so the page reads as a course list. */
  const byTopic = useMemo(() => {
    const groups = new Map();
    for (const entry of allVideoEntries()) {
      if (!groups.has(entry.topicId)) groups.set(entry.topicId, []);
      groups.get(entry.topicId).push(entry);
    }
    return [...groups.entries()];
  }, []);

  const counts = useMemo(() => {
    const all = allVideoEntries();
    return {
      total: all.length,
      playable: all.filter((e) => verificationStatus(e) === "playable").length,
    };
  }, []);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("credits.title")}</h1>
          <p className="page-sub">{t("credits.sub")}</p>
        </div>
        <Badge tone="slate">{t("credits.count", { playable: counts.playable, total: counts.total })}</Badge>
      </header>

      <div className="notice info" style={{ marginBottom: 24 }}>
        <span aria-hidden="true">📜</span>
        <span>{t("credits.disclaimer")}</span>
      </div>

      {/* ---------------- Topic videos ---------------- */}
      <h2 style={{ fontSize: 20, margin: "0 0 14px" }}>{t("credits.videos.heading")}</h2>
      <div style={{ display: "grid", gap: 14, marginBottom: 36 }}>
        {byTopic.map(([topicId, entries]) => {
          const topic = findTopic(topicId);
          return (
            <Card key={topicId}>
              <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>
                {tOr(`topic.${topicId}.name`, topic?.name || topicId)}
              </h3>
              <div style={{ display: "grid", gap: 14 }}>
                {entries.map((e) => {
                  const status = verificationStatus(e);
                  const licHref = licenseUrl(e.license);
                  const duration = formatDuration(e.durationSeconds);
                  return (
                    <dl key={e.id} className="credit-entry">
                      <div className="flex items-center justify-between wrap gap-8" style={{ marginBottom: 6 }}>
                        <span className="strong small">{e.commonsTitle?.replace(/^File:/, "") || e.searchTitle}</span>
                        <Badge tone={STATUS_TONE[status]}>{t(`credits.status.${status}`)}</Badge>
                      </div>
                      <div className="credit-row"><dt>{t("credits.field.creator")}</dt><dd>{e.attribution || "—"}</dd></div>
                      <div className="credit-row">
                        <dt>{t("credits.field.license")}</dt>
                        <dd>{licHref ? <a href={licHref} target="_blank" rel="noopener noreferrer">{e.license}</a> : e.license || "—"}</dd>
                      </div>
                      <div className="credit-row">
                        <dt>{t("credits.field.source")}</dt>
                        <dd>{e.commonsUrl ? <a href={e.commonsUrl} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> : "—"}</dd>
                      </div>
                      <div className="credit-row">
                        <dt>{t("credits.field.language")}</dt>
                        <dd>
                          {languageName(e.audioLanguage)}
                          {e.subtitleLanguages?.length > 0 && (
                            <span className="muted"> · {t("credits.field.subtitles")}: {e.subtitleLanguages.map(languageName).join(", ")}</span>
                          )}
                          {duration && <span className="muted"> · {duration}</span>}
                        </dd>
                      </div>
                      <div className="credit-row"><dt>{t("credits.field.changes")}</dt><dd>{t("credits.field.noChanges")}</dd></div>
                    </dl>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* ---------------- Topics with no video, on purpose ---------------- */}
      <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>{t("credits.empty.heading")}</h2>
      <p className="small muted" style={{ margin: "0 0 14px" }}>{t("credits.empty.sub")}</p>
      <div style={{ display: "grid", gap: 10, marginBottom: 36 }}>
        {Object.entries(DELIBERATELY_EMPTY).map(([topicId, reason]) => {
          const topic = findTopic(topicId);
          return (
            <div key={topicId} className="notice" style={{ margin: 0 }}>
              <span aria-hidden="true">🔍</span>
              <span>
                <strong>{tOr(`topic.${topicId}.name`, topic?.name || topicId)}.</strong> <span className="small">{reason}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* ---------------- Other third-party material ---------------- */}
      <h2 style={{ fontSize: 20, margin: "0 0 14px" }}>{t("credits.assets.heading")}</h2>
      <Card>
        <div style={{ display: "grid", gap: 14 }}>
          {OTHER_ASSETS.map((a) => (
            <dl key={a.id} className="credit-entry">
              <div className="flex items-center gap-10" style={{ marginBottom: 6 }}>
                {a.id === "nimiq-logo" && <NimiqLogo size={22} />}
                <span className="strong small">{a.titleKey ? t(a.titleKey) : a.title}</span>
              </div>
              <div className="credit-row"><dt>{t("credits.field.creator")}</dt><dd>{a.creator}</dd></div>
              <div className="credit-row">
                <dt>{t("credits.field.source")}</dt>
                <dd><a href={a.sourceUrl} target="_blank" rel="noopener noreferrer">{a.source}</a></dd>
              </div>
              {a.noteKey && <div className="credit-row"><dt>{t("credits.field.changes")}</dt><dd>{t(a.noteKey)}</dd></div>}
            </dl>
          ))}
        </div>
        <p className="tiny muted" style={{ margin: "16px 0 0" }}>{t("credits.assets.noEndorsement")}</p>
      </Card>
    </div>
  );
}
