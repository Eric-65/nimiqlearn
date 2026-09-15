import React, { useState } from "react";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import { useI18n } from "../../hooks/useI18n.js";
import Button from "../ui/Button.jsx";
import { useNimiq } from "../../hooks/useNimiq.js";
import { NIMIQ_STATUS } from "../../services/nimiqWalletService.js";

function truncateAddress(address) {
  if (!address) return null;
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

/**
 * Wallet connection status card (Part 29/30). Deliberately NOT a crypto
 * dashboard — just: Nimiq Pay detected, wallet connected, wallet
 * authenticated, network ready. Connection and authentication are shown
 * as two independent facts (Part 10): a connected account is never shown
 * as authenticated unless a real signing flow has actually succeeded.
 *
 * Copy for each state follows Part 29 exactly:
 *   NOT AVAILABLE  → "Open NimiqLearn in Nimiq Pay to connect your wallet."
 *   DISCONNECTED   → "Connect Nimiq Pay"
 *   CONNECTING     → "Connecting..."
 *   CONNECTED      → "Wallet connected"
 *   AUTHENTICATED  → "Wallet authenticated"
 *   ERROR          → "Connection failed" [Retry]
 */
export default function NimiqWalletStatus() {
  const { t } = useI18n();
  const nimiq = useNimiq();
  const [copied, setCopied] = useState(false);
  const [signInError, setSignInError] = useState(null);

  /**
   * navigator.clipboard is SECURE-CONTEXT ONLY, so it is simply `undefined`
   * when this mini app is loaded over plain HTTP from the dev machine's LAN
   * IP — which is exactly how Nimiq Pay loads it during development (the
   * official mini-apps skill's own checklist calls out providing fallbacks
   * for secure-context-only APIs on HTTP LAN). Without a fallback the copy
   * button did nothing at all on a phone, silently, because the failure was
   * caught and discarded.
   *
   * The execCommand path is deprecated but still works in WebViews and in
   * insecure contexts, which is precisely where the modern API won't.
   */
  const writeToClipboard = async (text) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const el = document.createElement("textarea");
    el.value = text;
    // Keep it off-screen and non-disruptive: an element that can be focused
    // but neither scrolls the page nor flashes into view.
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.top = "-1000px";
    el.style.opacity = "0";
    document.body.appendChild(el);
    try {
      el.select();
      return document.execCommand("copy");
    } finally {
      document.body.removeChild(el);
    }
  };

  const handleCopy = async () => {
    try {
      if (await writeToClipboard(nimiq.address)) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* clipboard genuinely unavailable — not critical */
    }
  };

  const handleSignIn = async () => {
    setSignInError(null);
    try {
      await nimiq.signIn();
    } catch (err) {
      /* The wallet SDK's own message cannot be translated by us; only our
         fallback sentence can. */
      setSignInError(err?.message || t("nwallet.signInRejected"));
    }
  };

  return (
    <Card title={t("nwallet.title")} sub={t("nwallet.sub")}>
      <div className="flex items-center gap-8 wrap" style={{ marginBottom: 16 }}>
        {nimiq.status === NIMIQ_STATUS.INITIALIZING && <Badge tone="amber" dot>{t("wallet.connecting")}</Badge>}
        {nimiq.status === NIMIQ_STATUS.CONNECTED && nimiq.isAuthenticated && <Badge tone="teal" dot>{t("nwallet.authenticated")}</Badge>}
        {nimiq.status === NIMIQ_STATUS.CONNECTED && !nimiq.isAuthenticated && <Badge tone="teal" dot>{t("wallet.walletConnected")}</Badge>}
        {nimiq.status === NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE && <Badge tone="slate" dot>{t("nwallet.detected")}</Badge>}
        {nimiq.status === NIMIQ_STATUS.ERROR && <Badge tone="rose" dot>{t("wallet.connFailed")}</Badge>}
        {nimiq.status === NIMIQ_STATUS.BROWSER_MODE && <Badge tone="amber" dot>{t("wallet.notAvailable")}</Badge>}
      </div>

      {nimiq.status === NIMIQ_STATUS.BROWSER_MODE && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          <span aria-hidden="true">🧪</span>
          <span>
            {t("nwallet.browserNotice")}
          </span>
        </div>
      )}

      {nimiq.status === NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE && nimiq.error === "Connection cancelled" && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          <span aria-hidden="true">🚫</span>
          <span>{t("wallet.cancelled")}</span>
        </div>
      )}

      {nimiq.status === NIMIQ_STATUS.ERROR && (
        <div className="notice danger" style={{ marginBottom: 16 }}>
          <span aria-hidden="true">⚠️</span>
          <span>{nimiq.error || t("wallet.connFailedDot")}</span>
        </div>
      )}

      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <Row label={t("nwallet.detected")} value={t(nimiq.providerAvailable ? "common.yes" : "common.no")} />
        <Row label={t("wallet.walletConnected")} value={t(nimiq.isConnected ? "common.yes" : "common.no")} />
        <Row label={t("nwallet.authenticated")} value={t(nimiq.isAuthenticated ? "common.yes" : "common.no")} />
        <Row
          label={t("nwallet.networkReady")}
          value={nimiq.consensusReady === null ? "—" : t(nimiq.consensusReady ? "nwallet.networkReady" : "nwallet.networkWaiting")}
        />
        <Row
          label={t("wallet.address")}
          value={nimiq.address ? truncateAddress(nimiq.address) : nimiq.isConnected ? "—" : t("common.notConnected")}
          mono
          action={nimiq.address && (
            <button className="btn btn-ghost btn-sm" onClick={handleCopy} aria-label={t("wallet.copyAddress")} style={{ marginLeft: 8 }}>
              {t(copied ? "wallet.copied" : "wallet.copy")}
            </button>
          )}
        />
        <Row
          label={t("nwallet.balance")}
          value={t("nwallet.balanceUnavailable")}
          hint={t("nwallet.balanceHint")}
        />
        <Row label={t("nwallet.blockNumber")} value={nimiq.blockNumber ?? "—"} />
      </div>

      <div className="flex gap-8 wrap">
        {nimiq.status === NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE && (
          <Button variant="nimiq" onClick={nimiq.connect}>{t("nwallet.connect")}</Button>
        )}
        {nimiq.status === NIMIQ_STATUS.INITIALIZING && (
          <Button variant="nimiq" disabled loading>{t("wallet.connecting")}</Button>
        )}
        {nimiq.status === NIMIQ_STATUS.ERROR && (
          <Button variant="outline" onClick={nimiq.connect}>{t("common.tryAgain")}</Button>
        )}
        {nimiq.status === NIMIQ_STATUS.CONNECTED && (
          <>
            <Button variant="outline" onClick={nimiq.disconnect}>{t("wallet.disconnect")}</Button>
            {!nimiq.isAuthenticated && (
              <Button variant="outline" onClick={handleSignIn}>{t("nwallet.signIn")}</Button>
            )}
          </>
        )}
      </div>
      {signInError && (
        <p className="tiny" style={{ color: "var(--c-rose)", marginTop: 8, marginBottom: 0 }} role="alert">{signInError}</p>
      )}
    </Card>
  );
}

function Row({ label, value, mono, hint, action }) {
  return (
    <div>
      <div className="flex justify-between gap-12 items-center">
        <span className="muted small">{label}</span>
        <span className="flex items-center" style={{ textAlign: "right" }}>
          <span className="small strong" style={mono ? { fontFamily: "monospace", fontSize: 12.5, wordBreak: "break-all" } : undefined}>
            {value}
          </span>
          {action}
        </span>
      </div>
      {hint && <p className="tiny muted" style={{ margin: "2px 0 0" }}>{hint}</p>}
    </div>
  );
}
