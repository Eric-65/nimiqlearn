import React from "react";
import { useLearner } from "../hooks/useLearner.js";
import { computeXp, levelTitle } from "../services/xpService.js";
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

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Leaderboard</h1>
          <p className="page-sub">Ranked by XP — which grows with the mastery you build, not the hours you log.</p>
        </div>
        <Badge tone="gold" dot>Rank #{you?.rank ?? "—"}</Badge>
      </header>

      <div className="notice warn anim-pop" style={{ marginBottom: 22 }} role="status">
        <span aria-hidden="true">🧪</span>
        <span>
          <strong>Your row is real. The others are sample data.</strong> NimiqLearn keeps your progress in this
          browser only — there are no accounts and no server storing other learners, so there is nobody real to rank
          you against yet. Your XP, level and position are computed from your genuine mastery and answer history.
        </span>
      </div>

      {/* Your standing — the one row on this page backed by real data */}
      <Card className="anim-rise" style={{ marginBottom: 22, borderColor: "var(--c-teal)" }}>
        <div className="flex items-center justify-between wrap gap-16">
          <div className="flex items-center gap-16">
            <span style={{ fontSize: 38 }} aria-hidden="true">🧠</span>
            <div>
              <div className="flex items-center gap-8 wrap">
                <h2 style={{ margin: 0, fontSize: 22 }}>Level {stats.level}</h2>
                <Badge tone="teal">{levelTitle(stats.level)}</Badge>
              </div>
              <p className="small muted" style={{ margin: "4px 0 0" }}>
                {stats.xp.toLocaleString()} XP · {stats.topicsStudied} topic{stats.topicsStudied === 1 ? "" : "s"} studied
                {stats.accuracy !== null && ` · ${Math.round(stats.accuracy * 100)}% accuracy`}
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right", minWidth: 150 }}>
            <p className="tiny muted" style={{ margin: "0 0 6px" }}>
              {stats.xpIntoLevel.toLocaleString()} / {stats.xpForNextLevel.toLocaleString()} XP to level {stats.level + 1}
            </p>
            <div className="progress" style={{ height: 8 }} role="presentation">
              <div className="progress-bar gold" style={{ width: `${Math.max(2, stats.progressPercent)}%` }} />
            </div>
          </div>
        </div>
      </Card>

      <Card title="Standings" sub="Sorted by total XP.">
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
                  aria-label={`Rank ${row.rank}`}
                >
                  {MEDALS[row.rank] || row.rank}
                </span>
                <span style={{ fontSize: 22 }} aria-hidden="true">{row.avatar}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="strong" style={{ display: "block" }}>
                    {row.isYou ? "You" : row.name}
                  </span>
                  <span className="tiny muted">
                    Level {Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * row.xp) / 250)) / 2))}
                    {!row.real && " · sample"}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-8">
                {!row.real && <Badge tone="slate">Demo</Badge>}
                {row.isYou && <Badge tone="teal">Real</Badge>}
                <span className="strong" style={{ fontVariantNumeric: "tabular-nums", minWidth: 74, textAlign: "right" }}>
                  {row.xp.toLocaleString()}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="How XP is earned" sub="Every number below is computed from your own activity — nothing is awarded for showing up." style={{ marginTop: 18 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <Row label="Mastery across all topics" value={`${stats.masteryXp.toLocaleString()} XP`} hint="2 XP per mastery point — the biggest share, so XP tracks understanding rather than activity." />
          <Row label="Correct answers" value={`${stats.correctXp.toLocaleString()} XP`} hint={`12 XP each · ${stats.correctAttempts} correct so far`} />
          <Row
            label="Accuracy bonus"
            value={`${stats.accuracyBonusXp.toLocaleString()} XP`}
            hint={
              stats.accuracy === null
                ? "Answer something to start building an accuracy record."
                : `Up to +25% of your correct-answer XP, scaled by your ${Math.round(stats.accuracy * 100)}% hit rate.`
            }
          />
          <Row
            label="Wrong answers"
            value={`${stats.incorrectAttempts} · no XP lost`}
            hint="They already lower mastery, so they are never subtracted twice — they only hold back the accuracy bonus."
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
