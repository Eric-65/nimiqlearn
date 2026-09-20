import React, { useState } from "react";
import { useNimiq } from "../../hooks/useNimiq.js";
import { useI18n } from "../../hooks/useI18n.js";
import { signMessage, getBlockNumber, getConsensusStatus } from "../../services/nimiqWalletService.js";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";

/**
 * Learn by doing — the safe half of Nimiq Pay, used as a teaching step.
 *
 * Reading a description of account approval teaches less in five minutes
 * than pressing the button and watching the wallet ask. So three concepts
 * get a real activity, each chosen because its worst outcome is nothing
 * happening:
 *
 *   nimiq-pay     read the chain. Block height and consensus need no
 *                 approval at all, which is the point being taught.
 *   self-custody  connect an account. The wallet asks; declining is a
 *                 first-class outcome and the screen says so.
 *   building-on-  sign a harmless message. Signing proves you hold the
 *   nimiq         key without moving anything — exactly what a developer
 *                 tests with before a transaction.
 *
 * ------------------------------------------------------------------
 * WHAT THIS WILL NOT DO
 *
 * No payment. No testnet transaction either: this app is wired to
 * mainnet through Nimiq Pay, and a "testnet demo" that is really a
 * mainnet call with reassuring copy would be the most dangerous thing
 * on the page. When testnet support exists in the provider, a
 * transaction step belongs here; until then its absence is the honest
 * answer.
 *
 * Nothing here is ever simulated. Every value shown came back from the
 * real provider, and when the wallet is absent the activity says so
 * rather than inventing an address, a balance or a signature. Private
 * keys, seed phrases and recovery words are never requested, displayed
 * or accepted — a learner who is asked for them anywhere should treat
 * it as an attack, which is what using-nimiq-safely teaches.
 */

const ACTIVITIES = {
  "nimiq-pay": "read",
  "self-custody": "connect",
  "building-on-nimiq": "sign",
  "nimiq-mini-apps": "read",
};

export function hasPracticalActivity(topicId) {
  return Boolean(ACTIVITIES[topicId]);
}

export default function NimiqPractical({ topicId, onDone = null }) {
  const kind = ACTIVITIES[topicId];
  const nimiq = useNimiq();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!kind) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (kind === "read") {
        /* Deliberately the unprivileged pair: these answer without any
           dialog, which is the lesson. */
        const [height, consensus] = await Promise.all([getBlockNumber(), getConsensusStatus()]);
        /* Both wrappers return null when there is no provider rather than
           throwing, so a plain browser reached this line with height =
           null and rendered "✅ read straight from the network" over two
           em-dashes. A success message about a read that did not happen is
           precisely the fake state this activity exists to argue against,
           so a missing height is a failure here, not a blank. */
        if (height == null) throw new Error(t("practical.noProvider"));
        setResult({ kind, height, consensus });
      } else if (kind === "connect") {
        const state = await nimiq.connect();
        /* connect() resolves in browser mode too. Only an address proves
           a wallet actually answered. */
        const address = state?.address || nimiq.address || null;
        if (!address) throw new Error(t("practical.noProvider"));
        setResult({ kind, address });
      } else if (kind === "sign") {
        const message = t("practical.sign.message");
        const signed = await signMessage(message);
        /* The signature is shown truncated and never stored. It proves
           the key answered; keeping it would serve no purpose here. And
           without one there is nothing to claim: no signature, no
           success. */
        const signature = signed?.signature ? String(signed.signature).slice(0, 24) : null;
        if (!signature) throw new Error(t("practical.noProvider"));
        setResult({ kind, message, signature });
      }
    } catch (err) {
      /* A declined dialog arrives here like any other failure, and is
         not one: the screen says the wallet said no, because learning
         that refusing works is part of the point.

         "There is no wallet here" is a different fact and gets different
         words — telling somebody in a desktop browser that "declining is
         a valid answer" describes a dialog they never saw. */
      const message = err?.message || t("practical.failed");
      setError({ message, absent: message === t("practical.noProvider") });
    } finally {
      setBusy(false);
    }
  };

  const walletMissing = nimiq.isUnavailable;

  return (
    <Card className="nimiq-practical" title={t(`practical.${kind}.title`)} sub={t(`practical.${kind}.sub`)}>
      {walletMissing ? (
        /* In an ordinary browser there is no wallet, and pretending
           otherwise is exactly what this lesson warns against. */
        <p className="small muted" style={{ margin: 0 }}>
          {t("practical.noWallet")}
        </p>
      ) : (
        <>
          <Button variant="nimiq" size="sm" onClick={run} disabled={busy}>
            {busy ? t("practical.working") : t(`practical.${kind}.action`)}
          </Button>

          {error && (
            <div className="notice warn" role="status" style={{ marginTop: 12 }}>
              <span aria-hidden="true">⚠️</span>
              <span>{error.absent ? error.message : t("practical.declined", { reason: error.message })}</span>
            </div>
          )}

          {result && !error && (
            <div className="notice success anim-pop" role="status" style={{ marginTop: 12 }}>
              <span aria-hidden="true">✅</span>
              <span>
                {result.kind === "read" && (
                  <>
                    <strong>{t("practical.read.done")}</strong>{" "}
                    {t("practical.read.detail", {
                      height: result.height ?? "—",
                      consensus: String(result.consensus ?? "—"),
                    })}
                  </>
                )}
                {result.kind === "connect" && (
                  <>
                    <strong>{t("practical.connect.done")}</strong> {t("practical.connect.detail")}
                  </>
                )}
                {result.kind === "sign" && (
                  <>
                    <strong>{t("practical.sign.done")}</strong>{" "}
                    {t("practical.sign.detail", { signature: result.signature || "—" })}
                  </>
                )}
              </span>
            </div>
          )}

          {(result || error) && onDone && (
            <Button variant="outline" size="sm" onClick={onDone} style={{ marginTop: 12 }}>
              {t("practical.continue")}
            </Button>
          )}
        </>
      )}

      <p className="tiny muted" style={{ margin: "14px 0 0" }}>
        🔒 {t("practical.safety")}
      </p>
    </Card>
  );
}
