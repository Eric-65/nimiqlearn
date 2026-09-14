import React from "react";
import { useLearner } from "../hooks/useLearner.js";
import { useI18n } from "../hooks/useI18n.js";
import { computeXp, levelTitleKey } from "../services/xpService.js";
import { buildLeaderboard } from "../data/mockLeaderboard.js";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";

const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * XP leaderboard.
 *
 * The learner's own row is real — their XP is derived from their actual
 * mastery and answer history (xpService.js). Every other row is a fixed
 * demo entry from mockLeaderboard.js, because this app has no accounts and
 * no backend: there are no other users to rank. That distinction is stated
 * on screen rather than buried here, since a leaderboard that quietly
 * invents rivals is exactly the kind of fake data the rest of this app
 * refuses to show.
 */
export default function Leaderboard() {
  const { knowledge } = useLearner();
  const stats = computeXp(knowledge);
  const rows = buildLeaderboard(stats.xp);
  const you = rows.find((r) => r.isYou);
  const { t, tPlural, n } = useI18n();

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("nav.leaderboard")}</h1>
          <p className="page-sub">{t("lb.sub")}</p>
        </div>
        <Badge tone="gold" dot>{t("lb.rank", { rank: you?.rank ?? "—" })}</Badge>
      </header>

      <div className="notice warn anim-pop" style={{ marginBottom: 22 }} role="status">
        <span aria-hidden="true">🧪</span>
        <span>
          <strong>{t("lb.disclaimer.title")}</strong> {t("lb.disclaimer.body")}
        </span>
      </div>

      {/* Your standing — the one row on this page backed by real data */}
      <Card className="anim-rise" style={{ marginBottom: 22, borderColor: "var(--c-teal)" }}>
        <div className="flex items-center justify-between wrap gap-16">
          <div className="flex items-center gap-16">
            <span style={{ fontSize: 38 }} aria-hidden="true">🧠</span>
            <div>
              <div className="flex items-center gap-8 wrap">
                <h2 style={{ margin: 0, fontSize: 22 }}>{t("lb.level", { level: stats.level })}</h2>
                <Badge tone="teal">{t(levelTitleKey(stats.level))}</Badge>
              </div>
              <p className="small muted" style={{ margin: "4px 0 0" }}>
                {t("lb.xpAmount", { xp: n(stats.xp) })} · {tPlural("lb.topicsStudied", stats.topicsStudied)}
                {stats.accuracy !== null && ` · ${t("lb.accuracy", { pct: Math.round(stats.accuracy * 100) })}`}
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right", minWidth: 150 }}>
            <p className="tiny muted" style={{ margin: "0 0 6px" }}>
              {t("lb.toNextLevel", { into: n(stats.xpIntoLevel), need: n(stats.xpForNextLevel), level: stats.level + 1 })}
            </p>
            <div className="progress" style={{ height: 8 }} role="presentation">
              <div className="progress-bar gold" style={{ width: `${Math.max(2, stats.progressPercent)}%` }} />
            </div>
          </div>
        </div>
      </Card>

      <Card title={t("lb.standings")} sub={t("lb.standings.sub")}>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-12"
              style={{
                padding: "12px 14px",
                borderRadius: "var(--r-md)",
                background: row.isYou ? "var(--c-teal-soft)" : "var(--c-surface-2)",
                border: `1px solid ${row.isYou ? "var(--c-teal)" : "var(--c-border)"}`,
              }}
              aria-current={row.isYou ? "true" : undefined}
            >
              <span className="flex items-center gap-12" style={{ minWidth: 0 }}>
                <span
                  className="strong"
                  style={{ width: 34, textAlign: "center", fontVariantNumeric: "tabular-nums", color: "var(--c-text-dim)" }}
                  aria-label={t("lb.rank", { rank: row.rank })}
                >
                  {MEDALS[row.rank] || row.rank}
                </span>
                <span style={{ fontSize: 22 }} aria-hidden="true">{row.avatar}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="strong" style={{ display: "block" }}>
                    {row.isYou ? t("lb.you") : row.name}
                  </span>
                  <span className="tiny muted">
                    {t("lb.level", { level: Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * row.xp) / 250)) / 2)) })}
                    {!row.real && ` · ${t("lb.sample")}`}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-8">
                {!row.real && <Badge tone="slate">{t("lb.demo")}</Badge>}
                {row.isYou && <Badge tone="teal">{t("lb.real")}</Badge>}
                <span className="strong" style={{ fontVariantNumeric: "tabular-nums", minWidth: 74, textAlign: "right" }}>
                  {n(row.xp)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title={t("lb.how.title")} sub={t("lb.how.sub")} style={{ marginTop: 18 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <Row label={t("lb.how.mastery")} value={t("lb.xpAmount", { xp: n(stats.masteryXp) })} hint={t("lb.how.mastery.hint")} />
          <Row
            label={t("lb.how.correct")}
            value={t("lb.xpAmount", { xp: n(stats.correctXp) })}
            hint={t("lb.how.correct.hint", { count: stats.correctAttempts })}
          />
          <Row
            label={t("lb.how.bonus")}
            value={t("lb.xpAmount", { xp: n(stats.accuracyBonusXp) })}
            hint={
              stats.accuracy === null
                ? t("lb.how.bonus.none")
                : t("lb.how.bonus.hint", { pct: Math.round(stats.accuracy * 100) })
            }
          />
          <Row
            label={t("lb.how.wrong")}
            value={t("lb.how.wrong.value", { count: stats.incorrectAttempts })}
            hint={t("lb.how.wrong.hint")}
          />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value, hint }) {
  return (
    <div style={{ paddingBottom: 10, borderBottom: "1px solid var(--c-border)" }}>
      <div className="flex justify-between gap-12 items-center">
        <span className="small strong">{label}</span>
        <span className="small strong" style={{ color: "var(--c-gold)", whiteSpace: "nowrap" }}>{value}</span>
      </div>
      {hint && <p className="tiny muted" style={{ margin: "3px 0 0" }}>{hint}</p>}
    </div>
  );
}
