import React, { useMemo, useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useI18n } from "../hooks/useI18n.js";
import { TOPIC_CONTENT, ALL_TOPICS, findTopicPath } from "../data/mockTopics.js";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";

/**
 * The glossary is generated from TOPIC_CONTENT — the same definitions,
 * key points, analogies and misconceptions the learning engine itself
 * teaches and grades against. That matters: a separate hand-written
 * glossary would drift out of sync with what ExplainBack actually marks
 * you on. One source, two surfaces.
 */
function buildEntries(tOr, locale) {
  /* Built once per locale, not once per comparison: sorting alphabetically
     by the ENGLISH name would put a Korean or Chinese glossary in an order
     that means nothing to the reader, and Intl.Collator sorts by the active
     locale's own rules. */
  const collator = new Intl.Collator(locale);
  return Object.entries(TOPIC_CONTENT)
    .map(([topicId, content]) => {
      const topic = ALL_TOPICS.find((t) => t.id === topicId);
      const k = (field) => `content.${topicId}.${field}`;
      return {
        topicId,
        name: tOr(`topic.${topicId}.name`, topic?.name || topicId),
        path: topic
          ? findTopicPath(topicId).map((p) => tOr(`topic.${p.id}.name`, p.name))
          : [],
        definition: tOr(k("definition"), content.definition),
        analogy: tOr(k("analogy"), content.analogy),
        example: tOr(k("example"), content.example),
        misconception: tOr(k("misconception"), content.misconception),
        keyPoints: (content.keyPoints || []).map((kp, i) => tOr(k(`kp${i}`), kp)),
      };
    })
    .sort((a, b) => collator.compare(a.name, b.name));
}

export default function Glossary() {
  const { navigate } = useNav();
  const { getEntry } = useLearner();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const { t, tOr, tPlural, locale } = useI18n();

  const entries = useMemo(() => buildEntries(tOr, locale), [tOr, locale]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.name, e.definition, e.analogy, e.misconception, ...(e.keyPoints || [])]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(q))
    );
  }, [entries, query]);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("nav.glossary")}</h1>
          <p className="page-sub">{t("glossary.sub")}</p>
        </div>
        <Badge tone="blue" dot>{t("glossary.count", { count: entries.length })}</Badge>
      </header>

      <div style={{ marginBottom: 20, maxWidth: 520 }}>
        <label className="sr-only" htmlFor="glossary-search">{t("glossary.search.label")}</label>
        <input
          id="glossary-search"
          className="input"
          type="search"
          placeholder={t("glossary.search.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="tiny muted" style={{ margin: "8px 0 0" }} aria-live="polite">
          {filtered.length === entries.length
            ? t("glossary.showingAll", { count: entries.length })
            : tPlural("glossary.matches", filtered.length, { query: query.trim() })}
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="small muted" style={{ margin: 0 }}>
            {t("glossary.noMatch", { query: query.trim() })}
          </p>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map((entry) => {
            const known = getEntry(entry.topicId);
            const open = openId === entry.topicId;
            return (
              <Card key={entry.topicId} className="anim-rise">
                <div className="flex items-start justify-between gap-12 wrap">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="flex items-center gap-8 wrap" style={{ marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: 17 }}>{entry.name}</h3>
                      {known?.status && known.status !== "NEW" && (
                        <Badge tone={known.status === "MASTERED" ? "gold" : known.status === "STRONG" ? "teal" : "blue"}>
                          {t(`status.${known.status.toLowerCase()}`)} · {Math.round(known.mastery || 0)}%
                        </Badge>
                      )}
                    </div>
                    {entry.path.length > 0 && (
                      <p className="tiny muted" style={{ margin: "0 0 8px" }}>{entry.path.join(" • ")}</p>
                    )}
                    <p className="small" style={{ margin: 0, color: "var(--c-text-dim)", lineHeight: 1.65 }}>
                      {entry.definition}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenId(open ? null : entry.topicId)}
                    aria-expanded={open}
                  >
                    {t(open ? "common.less" : "common.more")}
                  </Button>
                </div>

                {open && (
                  <div className="anim-fade" style={{ marginTop: 16, display: "grid", gap: 14 }}>
                    {entry.keyPoints?.length > 0 && (
                      <Section title={t("glossary.keyPoints")}>
                        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5 }}>
                          {entry.keyPoints.map((k) => (
                            <li key={k} className="small" style={{ color: "var(--c-text-dim)" }}>{k}</li>
                          ))}
                        </ul>
                      </Section>
                    )}
                    {entry.analogy && (
                      <Section title={t("glossary.analogy")} tone="blue">
                        <p className="small" style={{ margin: 0, color: "var(--c-text-dim)" }}>{entry.analogy}</p>
                      </Section>
                    )}
                    {entry.example && (
                      <Section title={t("glossary.example")} tone="teal">
                        <p className="small" style={{ margin: 0, color: "var(--c-text-dim)" }}>{entry.example}</p>
                      </Section>
                    )}
                    {entry.misconception && (
                      <Section title={t("glossary.misconception")} tone="rose">
                        <p className="small" style={{ margin: 0, color: "var(--c-text-dim)" }}>{entry.misconception}</p>
                      </Section>
                    )}
                    <div className="flex gap-8 wrap">
                      <Button variant="outline" size="sm" onClick={() => navigate("explain", { topic: entry.topicId })}>
                        {t("glossary.explainBack")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate("learn", { topic: entry.topicId })}>
                        {t("glossary.studyIt")}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Section({ title, tone = "slate", children }) {
  return (
    <div style={{ borderLeft: `2px solid var(--c-${tone === "slate" ? "border-strong" : tone})`, paddingLeft: 12 }}>
      <p className="tiny muted" style={{ margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</p>
      {children}
    </div>
  );
}
