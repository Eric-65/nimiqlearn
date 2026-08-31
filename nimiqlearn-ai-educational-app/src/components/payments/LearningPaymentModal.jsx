import React, { useEffect, useState } from "react";
import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import { useNimiq } from "../../hooks/useNimiq.js";
import { buildPaymentRequest, getSupportedAssets } from "../../services/paymentService.js";

const STEP = { REVIEW: "review", CONFIRMING: "confirming", PENDING: "pending", SUCCESS: "success", FAILED: "failed", CANCELLED: "cancelled" };

/**
 * Learning Economy payment dialog.
 * States: review → confirming → pending → success | failed | cancelled.
 * Success is only shown when the provider reports success. In DEMO MODE
 * every simulated payment is clearly labelled as a simulation.
 */
export default function LearningPaymentModal({ pack, open, onClose, onSuccess }) {
  const nimiq = useNimiq();
  const [step, setStep] = useState(STEP.REVIEW);
  const [result, setResult] = useState(null);
  const assets = getSupportedAssets();
  const [selectedAsset, setSelectedAsset] = useState("NIM");

  useEffect(() => {
    if (open) {
      setStep(STEP.REVIEW);
      setResult(null);
      setSelectedAsset("NIM");
    }
  }, [open]);

  if (!pack) return null;

  const demo = !nimiq.isConnected;
  const request = { ...buildPaymentRequest(pack), asset: selectedAsset };

  const handleConfirm = async () => {
    setStep(STEP.CONFIRMING);
    // brief explicit review moment before the request goes out
    await new Promise((r) => setTimeout(r, 500));
    setStep(STEP.PENDING);
    const res = await nimiq.pay(request);
    setResult(res);
    if (res.status === "success") {
      setStep(STEP.SUCCESS);
      onSuccess?.(res);
    } else {
      setStep(STEP.FAILED);
    }
  };

  return (
    <Modal open={open} onClose={step === STEP.PENDING ? undefined : () => { setStep(STEP.CANCELLED); setTimeout(onClose, 350); }} title="Unlock learning pack">
      <div style={{ padding: 26 }}>
        {step === STEP.REVIEW && (
          <div className="anim-fade">
            <div className="flex items-center justify-between wrap gap-8" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 20 }}>Unlock {pack.title}</h3>
              {demo ? (
                <Badge tone="amber">DEMO MODE — simulation</Badge>
              ) : (
                <Badge tone="teal">Nimiq Pay • live</Badge>
              )}
            </div>

            <dl style={{ margin: 0, display: "grid", gap: 13 }}>
              <div className="flex justify-between">
                <dt className="muted small">Price</dt>
                <dd className="strong" style={{ margin: 0 }}>
                  {request.amount} {request.asset}
                </dd>
              </div>
              <div className="flex justify-between items-center gap-12">
                <dt className="muted small">Asset / network</dt>
                <dd style={{ margin: 0 }}>
                  <select
                    className="select"
                    style={{ minWidth: 150, padding: "6px 34px 6px 12px", fontSize: 13.5 }}
                    value={selectedAsset}
                    onChange={(e) => setSelectedAsset(e.target.value)}
                    aria-label="Select payment asset"
                  >
                    {assets.map((a) => (
                      <option key={a.asset} value={a.asset} disabled={!a.real}>
                        {a.asset} — {a.network}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="muted small">Purpose</dt>
                <dd style={{ margin: 0, textAlign: "right" }}>{request.purpose}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="muted small">Recipient</dt>
                <dd style={{ margin: 0, fontFamily: "monospace", fontSize: 12.5 }} title={request.recipient}>
                  {request.recipient}
                </dd>
              </div>
            </dl>

            {demo ? (
              <div className="notice warn" style={{ marginTop: 18 }}>
                <span aria-hidden="true">🧪</span>
                <span>
                  You're in <strong>DEMO MODE</strong>. Confirming simulates the payment — no blockchain transaction is created and no NIM moves. Simulated receipts are labelled <strong>SIM-…</strong>.
                </span>
              </div>
            ) : (
              <div className="notice info" style={{ marginTop: 18 }}>
                <span aria-hidden="true">🛡️</span>
                <span>
                  This request opens <strong>Nimiq Pay's native confirmation dialog</strong>. Your keys never leave the wallet. Success is only shown after Nimiq Pay confirms.
                </span>
              </div>
            )}

            <div className="flex gap-12" style={{ marginTop: 22 }}>
              <Button variant="ghost" onClick={() => { setStep(STEP.CANCELLED); setTimeout(onClose, 300); }}>Cancel</Button>
              <Button variant={demo ? "amber" : "nimiq"} onClick={handleConfirm} style={{ flex: 1 }} disabled={nimiq.isConnecting}>
                {nimiq.isConnecting ? "Checking environment…" : `Confirm with Nimiq Pay · ${request.amount} ${request.asset}`}
              </Button>
            </div>
          </div>
        )}

        {step === STEP.CONFIRMING && (
          <div className="anim-fade" style={{ textAlign: "center", padding: "18px 0" }}>
            <div className="spinner" style={{ width: 30, height: 30, borderWidth: 3, margin: "0 auto 16px" }} aria-hidden="true" />
            <h3 style={{ margin: "0 0 6px" }}>Please review the details</h3>
            <p className="small muted" style={{ margin: 0 }}>Your confirmation opens the wallet flow.</p>
          </div>
        )}

        {step === STEP.PENDING && (
          <div className="anim-fade" style={{ textAlign: "center", padding: "18px 0" }}>
            <div className="spinner" style={{ width: 30, height: 30, borderWidth: 3, margin: "0 auto 16px" }} aria-hidden="true" />
            <h3 style={{ margin: "0 0 6px" }}>{demo ? "Simulating payment…" : "Waiting for Nimiq Pay confirmation…"}</h3>
            <p className="small muted" style={{ margin: 0 }}>
              {demo ? "This is a demo simulation and will complete momentarily." : "Approve the request in Nimiq Pay to continue."}
            </p>
          </div>
        )}

        {step === STEP.SUCCESS && result && (
          <div className="anim-pop" style={{ textAlign: "center", padding: "12px 0" }}>
            <div className="success-ring" style={{ margin: "0 auto 18px" }} aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--c-teal)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h3 style={{ margin: "0 0 8px" }}>{result.simulated ? "Pack unlocked (simulated)" : "Payment confirmed"}</h3>
            <p className="small muted" style={{ margin: "0 0 14px" }}>
              {result.detail}
            </p>
            <div className="notice" style={{ margin: "0 0 18px", textAlign: "left" }}>
              <span aria-hidden="true">{result.simulated ? "🧪" : "🧾"}</span>
              <span>
                <strong>Reference:</strong> <code>{result.reference}</code>
                <br />
                {result.simulated ? (
                  <em>This is a simulated receipt. No blockchain transaction occurred.</em>
                ) : (
                  <em>Submitted by {result.provider}. Final confirmation is settled on-chain.</em>
                )}
              </span>
            </div>
            <Button variant="teal" block onClick={onClose}>Start learning</Button>
          </div>
        )}

        {step === STEP.FAILED && (
          <div className="anim-fade" style={{ textAlign: "center", padding: "12px 0" }}>
            <div className="success-ring" style={{ margin: "0 auto 18px", background: "var(--c-rose-soft)", borderColor: "rgba(255,107,139,0.5)" }} aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--c-rose)" strokeWidth="3" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </div>
            <h3 style={{ margin: "0 0 8px" }}>
              {result?.status === "uncertain"
                ? "Payment status unknown"
                : result?.status === "rejected"
                ? "Payment cancelled"
                : "Payment not confirmed"}
            </h3>
            <p className="small muted" style={{ margin: "0 0 18px" }}>
              {result?.error || "Payment status could not be confirmed."}
            </p>
            <div className="flex gap-12">
              {result?.status === "uncertain" ? (
                <Button variant="outline" block onClick={onClose}>I'll check my wallet first</Button>
              ) : (
                <Button variant="outline" block onClick={() => setStep(STEP.REVIEW)}>Try again</Button>
              )}
              <Button variant="ghost" block onClick={onClose}>Close</Button>
            </div>
          </div>
        )}

        {step === STEP.CANCELLED && (
          <div className="anim-fade" style={{ textAlign: "center", padding: "12px 0" }}>
            <h3 style={{ margin: "0 0 8px" }}>Payment cancelled</h3>
            <p className="small muted" style={{ margin: "0 0 18px" }}>Nothing was charged. You can come back any time.</p>
            <Button variant="outline" block onClick={onClose}>Done</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
