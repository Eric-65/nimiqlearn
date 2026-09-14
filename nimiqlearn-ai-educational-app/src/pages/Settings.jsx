import React from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useTheme } from "../hooks/useTheme.js";
import { useI18n } from "../hooks/useI18n.js";
import { useNimiq } from "../hooks/useNimiq.js";
import { LOCALES } from "../i18n/locales.js";
import { isAssessmentBackendConfigured } from "../services/explainBackAssessmentService.js";
import { PAYMENTS_ENABLED } from "../config/paymentConfig.js";
import { USDT_PAYMENTS_ENABLED } from "../config/evmPaymentConfig.js";
import { restoreAllNotifications } from "../services/notificationService.js";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";

const THEME_OPTIONS = [
  { mode: "dark", icon: "🌙" },
  { mode: "light", icon: "☀️" },
  { mode: "system", icon: "🖥️" },
];

/**
 * Settings only ever reports real configuration. Each status row below
 * reflects an actual check (is a backend URL set, is a recipient address
 * configured, is a wallet genuinely connected) rather than a hardcoded
 * "Enabled" — the same rule the rest of the app follows.
 */
export default function Settings() {
  const { navigate } = useNav();
  const { resetLearner } = useLearner();
  const { mode, resolved, setMode } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const nimiq = useNimiq();

  const aiConfigured = isAssessmentBackendConfigured();

  const handleReset = () => {
    if (confirm(t("settings.data.confirmReset"))) {
      resetLearner();
      navigate("home");
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("nav.settings")}</h1>
          <p className="page-sub">{t("settings.sub")}</p>
        </div>
        <Badge tone={resolved === "light" ? "gold" : "blue"} dot>
          {t(resolved === "light" ? "settings.badge.light" : "settings.badge.dark")}
        </Badge>
      </header>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          {/* Language sits first: a learner who cannot read the page needs to
              find this before anything else on it. */}
          <Card title={t("settings.language.title")} sub={t("settings.language.sub")}>
            <div role="radiogroup" aria-label={t("settings.language.title")} className="lang-grid">
              {LOCALES.map((l) => {
                const active = locale === l.code;
                return (
                  <button
                    key={l.code}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setLocale(l.code)}
                    className={`lang-tile ${active ? "active" : ""}`}
                    /* The tile's accessible name is the language's own name,
                       never a translated one: someone looking for "한국어"
                       is, by definition, not reading the current language. */
                    lang={l.code}
                  >
                    <span className="lang-flag" aria-hidden="true">{l.flag}</span>
                    <span className="lang-label">{l.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="tiny muted" style={{ margin: "14px 0 0" }}>
              {t("settings.language.note")}
            </p>
          </Card>

          <Card title={t("settings.appearance.title")} sub={t("settings.appearance.sub")}>
            <div role="radiogroup" aria-label={t("settings.appearance.theme")} style={{ display: "grid", gap: 10 }}>
              {THEME_OPTIONS.map((opt) => {
                const active = mode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(opt.mode)}
                    className="flex items-center justify-between gap-12"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      padding: "14px 16px",
                      minHeight: 56,
                      borderRadius: "var(--r-md)",
                      background: active ? "var(--c-teal-soft)" : "var(--c-surface-2)",
                      border: `1px solid ${active ? "var(--c-teal)" : "var(--c-border)"}`,
                      color: "var(--c-text)",
                      font: "inherit",
                      transition: "background var(--t-fast) var(--ease-out), border-color var(--t-fast) var(--ease-out)",
                    }}
                  >
                    <span className="flex items-center gap-12">
                      <span style={{ fontSize: 20 }} aria-hidden="true">{opt.icon}</span>
                      <span>
                        <span className="strong" style={{ display: "block" }}>{t(`settings.theme.${opt.mode}`)}</span>
                        <span className="tiny muted">
                          {t(`settings.theme.${opt.mode}.hint`)}
                          {opt.mode === "system" && active &&
                            ` · ${t("settings.theme.currently", { theme: t(`settings.theme.${resolved}`) })}`}
                        </span>
                      </span>
                    </span>
                    {active && <Badge tone="teal">{t("common.active")}</Badge>}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title={t("nav.notifications")} sub={t("settings.notifications.sub")}>
            <p className="small muted" style={{ margin: "0 0 14px" }}>
              {t("settings.notifications.body")}
            </p>
            <div className="flex gap-12 wrap">
              <Button variant="outline" size="sm" onClick={() => navigate("notifications")}>
                {t("settings.notifications.open")}
              </Button>
              <Button variant="ghost" size="sm" onClick={restoreAllNotifications}>
                {t("settings.notifications.restore")}
              </Button>
            </div>
          </Card>
        </div>

        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <Card title={t("settings.connections.title")} sub={t("settings.connections.sub")}>
            <div style={{ display: "grid", gap: 12 }}>
              <StatusRow
                label={t("settings.conn.ai")}
                ok={aiConfigured}
                okText={t("common.configured")}
                offText={t("common.notConfigured")}
                hint={t(aiConfigured ? "settings.conn.ai.on" : "settings.conn.ai.off")}
              />
              <StatusRow
                label={t("settings.conn.wallet")}
                ok={nimiq.isConnected}
                okText={t("common.connected")}
                offText={t(nimiq.isUnavailable ? "common.notAvailableHere" : "common.notConnected")}
                hint={t(nimiq.isConnected ? "settings.conn.wallet.on" : "settings.conn.wallet.off")}
              />
              <StatusRow
                label={t("settings.conn.nim")}
                ok={PAYMENTS_ENABLED}
                okText={t("common.recipientConfigured")}
                offText={t("common.disabled")}
                hint={t(PAYMENTS_ENABLED ? "settings.conn.nim.on" : "settings.conn.nim.off")}
              />
              <StatusRow
                label={t("settings.conn.usdt")}
                ok={USDT_PAYMENTS_ENABLED}
                okText={t("common.recipientConfigured")}
                offText={t("common.comingSoon")}
                hint={t(USDT_PAYMENTS_ENABLED ? "settings.conn.usdt.on" : "settings.conn.usdt.off")}
              />
            </div>
            <div className="flex gap-12 wrap" style={{ marginTop: 16 }}>
              <Button variant="outline" size="sm" onClick={() => navigate("wallet")}>
                {t("settings.conn.walletDetails")}
              </Button>
            </div>
          </Card>

          <Card title={t("settings.data.title")} sub={t("settings.data.sub")}>
            <p className="small muted" style={{ margin: "0 0 14px" }}>
              {t("settings.data.body")}
            </p>
            <div className="flex items-center justify-between wrap gap-12">
              <Button variant="ghost" size="sm" onClick={() => navigate("profile")}>
                {t("settings.data.viewProfile")}
              </Button>
              <Button variant="danger" size="sm" onClick={handleReset}>
                {t("settings.data.reset")}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, ok, okText, offText, hint }) {
  return (
    <div style={{ paddingBottom: 12, borderBottom: "1px solid var(--c-border)" }}>
      <div className="flex items-center justify-between gap-12">
        <span className="small strong">{label}</span>
        <Badge tone={ok ? "teal" : "slate"}>{ok ? okText : offText}</Badge>
      </div>
      {hint && <p className="tiny muted" style={{ margin: "5px 0 0" }}>{hint}</p>}
    </div>
  );
}
