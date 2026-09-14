import React from "react";
import { useNimiq } from "../hooks/useNimiq.js";
import { useLearner } from "../hooks/useLearner.js";
import { useI18n } from "../hooks/useI18n.js";
import NimiqWalletStatus from "../components/wallet/NimiqWalletStatus.jsx";
import EvmWalletStatus from "../components/wallet/EvmWalletStatus.jsx";
import PaymentHistory from "../components/payments/PaymentHistory.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import { getSupportedAssets } from "../services/paymentService.js";

export default function Wallet() {
  const nimiq = useNimiq();
  const { learner, resetLearner } = useLearner();
  const assets = getSupportedAssets();
  const { t, locale } = useI18n();

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("wallet.title")}</h1>
          <p className="page-sub">{t("wallet.sub")}</p>
        </div>
        {nimiq.isConnected ? (
          <Badge tone="teal" dot>{t("status.connectedPay.aria")}</Badge>
        ) : (
          <Badge tone="amber" dot>{t("wallet.demoMode")}</Badge>
        )}
      </header>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <NimiqWalletStatus />

          <EvmWalletStatus />

          <Card title={t("wallet.assets.title")} sub={t("wallet.assets.sub")}>
            <div style={{ display: "grid", gap: 10 }}>
              {assets.map((a) => (
                <div key={a.asset} className="flex items-center justify-between pill" style={{ cursor: "default" }}>
                  <span className="flex items-center gap-10">
                    <span className="strong">{a.asset}</span>
                    <span className="tiny muted">{a.network}</span>
                  </span>
                  {a.real ? <Badge tone="teal">{t("wallet.assets.real")}</Badge> : <Badge tone="slate">{t("common.comingSoon")}</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          {(learner.pendingPayments || []).length > 0 && (
            <Card title={t("wallet.pending.title")} sub={t("wallet.pending.sub")}>
              <div style={{ display: "grid", gap: 8 }}>
                {learner.pendingPayments.map((p) => (
                  <div key={p.productId} className="notice warn" style={{ margin: 0 }}>
                    <span aria-hidden="true">⏳</span>
                    <span>
                      <strong>{p.productId}</strong> — {t("wallet.pending.attempted", { when: new Date(p.startedAt).toLocaleString(locale) })}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <PaymentHistory unlockedPacks={learner.unlockedPacks} />

          <Card title={t("wallet.howto.title")}>
            <div style={{ display: "grid", gap: 10 }}>
              <p className="small muted" style={{ margin: 0 }}>
                <strong>1.</strong> {t("wallet.howto.step1")}{" "}
                <code style={{ wordBreak: "break-all" }}>nimiqpay://miniapp?url=your-app.com</code> {t("common.or")}{" "}
                <code style={{ wordBreak: "break-all" }}>https://nimpay.app/miniapps/open/your-app.com</code>.
              </p>
              <p className="small muted" style={{ margin: 0 }}>
                <strong>2.</strong> {t("wallet.howto.step2")}
              </p>
              <p className="small muted" style={{ margin: 0 }}>
                <strong>3.</strong> {t("wallet.howto.step3")}
              </p>
            </div>
            <div className="notice warn" style={{ margin: "16px 0 0" }}>
              <span aria-hidden="true">🔐</span>
              <span>{t("wallet.howto.security")}</span>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between wrap gap-12">
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>{t("wallet.reset.title")}</h3>
                <p className="small muted" style={{ margin: "4px 0 0" }}>{t("wallet.reset.sub")}</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => { if (confirm(t("wallet.reset.confirm"))) resetLearner(); }}>
                {t("settings.data.reset")}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
