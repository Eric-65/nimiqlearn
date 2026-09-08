import React, { useEffect, useRef, useState } from "react";
import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import PaymentReceipt from "./PaymentReceipt.jsx";
import { useNimiq } from "../../hooks/useNimiq.js";
import { useEvmWallet } from "../../hooks/useEvmWallet.js";
import { useLearner } from "../../hooks/useLearner.js";
import { buildPaymentRequest, getPackPaymentOptions, TRANSACTION_STATE } from "../../services/paymentService.js";
import { hasPendingPayment } from "../../services/entitlementService.js";
import { EVM_CHAINS, DEFAULT_USDT_CHAIN } from "../../config/evmChains.js";

const STEP = {
  NEEDS_VERIFICATION: "needsVerification", // item 22 — blocks a duplicate purchase attempt
  REVIEW: "review",
  CONFIRMING: "confirming",
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

/**
 * Learning Economy payment dialog.
 * States: (needsVerification ->) review → confirming → pending →
 * success | failed | cancelled. Success is only shown when the provider
 * reports TRANSACTION_STATE.CONFIRMED. In DEMO MODE every simulated
 * payment is clearly labelled as a simulation.
 */
/** Part 27's exact progression copy, driven by the real transactionState
 * the provider reports — never a fake percentage or a guessed stage. */
const PENDING_TEXT = {
  [TRANSACTION_STATE.AWAITING_APPROVAL]: "Waiting for wallet approval...",
  [TRANSACTION_STATE.SUBMITTED]: "Transaction submitted",
  [TRANSACTION_STATE.CONFIRMED]: "Payment confirmed",
};

export default function LearningPaymentModal({ pack, open, onClose, onSuccess }) {
  const nimiq = useNimiq();
  const evm = useEvmWallet();
  const { learner, recordPendingPayment, clearPendingPayment } = useLearner();
  const [step, setStep] = useState(STEP.REVIEW);
  const [result, setResult] = useState(null);
  const [pendingText, setPendingText] = useState("Waiting for wallet approval...");
  const [selectedAsset, setSelectedAsset] = useState("NIM");
  const [selectedChain, setSelectedChain] = useState(DEFAULT_USDT_CHAIN);
  const submittingRef = useRef(false);

  const pending = pack ? hasPendingPayment(learner.pendingPayments, pack.id) : false;

  useEffect(() => {
    if (open) {
      setStep(pending ? STEP.NEEDS_VERIFICATION : STEP.REVIEW);
      setResult(null);
      setSelectedAsset("NIM");
      setSelectedChain(DEFAULT_USDT_CHAIN);
      submittingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!pack) return null;

  const assets = getPackPaymentOptions(pack);
  // Which provider's connection state determines DEMO vs. live differs by
  // asset — NIM goes through Nimiq Pay's native provider, USDT through the
  // separate EVM provider (see evmWalletService.js).
  const demo = selectedAsset === "USDT" ? !evm.isConnected : !nimiq.isConnected;
  const checkingEnvironment = selectedAsset === "USDT" ? evm.isConnecting : nimiq.isConnecting;
  const request = {
    ...buildPaymentRequest(pack, selectedAsset),
    ...(selectedAsset === "USDT" ? { chainKey: selectedChain } : {}),
  };
  // Derived directly from whether a real recipient resolved for this
  // asset (see buildPaymentRequest()) — never a second, separately-tracked
  // "enabled" flag that could drift from the actual request.
  const disabled = !request.recipient;

  const handleConfirm = async () => {
    // Part 26 — never allow a rapid double-click to trigger two
    // transactions, even before React re-renders the button away.
    if (submittingRef.current) return;
    submittingRef.current = true;

    setStep(STEP.CONFIRMING);
    // brief explicit review moment before the request goes out
    await new Promise((r) => setTimeout(r, 500));
    setStep(STEP.PENDING);
    setPendingText(demo ? "Simulating payment…" : PENDING_TEXT[TRANSACTION_STATE.AWAITING_APPROVAL]);
    const res = await nimiq.pay(request, {
      onStateChange: (s) => {
        if (PENDING_TEXT[s]) setPendingText(PENDING_TEXT[s]);
      },
    });
    setResult(res);
    submittingRef.current = false;
    if (res.transactionState === TRANSACTION_STATE.CONFIRMED) {
      setStep(STEP.SUCCESS);
      onSuccess?.(res);
    } else {
      // Part 24/26 — an UNKNOWN outcome blocks a second attempt for this
      // product until the learner explicitly acknowledges checking their
      // own wallet (see the NEEDS_VERIFICATION step below).
      if (res.transactionState === TRANSACTION_STATE.UNKNOWN) {
        recordPendingPayment({ productId: pack.id });
      }
      setStep(STEP.FAILED);
    }
  };

  return (
    <Modal open={open} onClose={step === STEP.PENDING ? undefined : () => { setStep(STEP.CANCELLED); setTimeout(onClose, 350); }} title="Unlock learning pack">
      <div style={{ padding: 26 }}>
        {step === STEP.NEEDS_VERIFICATION && (
          <div className="anim-fade" style={{ textAlign: "center", padding: "12px 0" }}>
            <h3 style={{ margin: "0 0 8px" }}>Payment status needs verification</h3>
            <p className="small muted" style={{ margin: "0 0 18px" }}>
              A previous payment attempt for <strong>{pack.title}</strong> could not be confirmed. To avoid paying twice,
              please check your Nimiq Pay transaction history before trying again.
            </p>
            <div className="flex gap-12">
              <Button
                variant="outline"
                block
                onClick={() => {
                  clearPendingPayment({ productId: pack.id });
                  setStep(STEP.REVIEW);
                }}
              >
                I've checked my wallet
              </Button>
              <Button variant="ghost" block onClick={onClose}>Close</Button>
            </div>
          </div>
        )}

        {step === STEP.REVIEW && (
          <div className="anim-fade">
            <div className="flex items-center justify-between wrap gap-8" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 20 }}>Unlock {pack.title}</h3>
              {disabled ? (
                <Badge tone="rose">Payment disabled</Badge>
              ) : demo ? (
                <Badge tone="amber">DEMO MODE — simulation</Badge>
              ) : (
                <Badge tone="teal">Nimiq Pay • live</Badge>
              )}
            </div>

            {disabled && (
              <div className="notice danger" style={{ marginBottom: 16 }}>
                <span aria-hidden="true">⚠️</span>
                <span>
                  No {selectedAsset} recipient address is configured for this pack yet. Unlocking with {selectedAsset} is
                  disabled until an educator recipient address is configured.
                </span>
              </div>
            )}

            <dl style={{ margin: 0, display: "grid", gap: 13 }}>
              <div className="flex justify-between">
                <dt className="muted small">Price</dt>
                <dd className="strong" style={{ margin: 0 }}>
                  {request.amount} {request.asset}
                </dd>
              </div>
              <div className="flex justify-between items-center gap-12">
                <dt className="muted small">Asset</dt>
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
                        {a.asset}{a.real ? "" : " — Coming soon"}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              {selectedAsset === "USDT" && (
                <div className="flex justify-between items-center gap-12">
                  <dt className="muted small">Chain</dt>
                  <dd style={{ margin: 0 }}>
                    <select
                      className="select"
                      style={{ minWidth: 150, padding: "6px 34px 6px 12px", fontSize: 13.5 }}
                      value={selectedChain}
                      onChange={(e) => setSelectedChain(e.target.value)}
                      aria-label="Select EVM chain"
                    >
                      {Object.entries(EVM_CHAINS).map(([key, c]) => (
                        <option key={key} value={key}>{c.name}</option>
                      ))}
                    </select>
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="muted small">Purpose</dt>
                <dd style={{ margin: 0, textAlign: "right" }}>{request.purpose}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="muted small">Recipient</dt>
                <dd style={{ margin: 0, fontFamily: "monospace", fontSize: 12.5, wordBreak: "break-all", textAlign: "right" }} title={request.recipient || undefined}>
                  {request.recipient || "Not configured"}
                </dd>
              </div>
            </dl>

            {!disabled && (demo ? (
              <div className="notice warn" style={{ marginTop: 18 }}>
                <span aria-hidden="true">🧪</span>
                <span>
                  You're in <strong>DEMO MODE</strong>. Confirming simulates the payment — no blockchain transaction is created and no {request.asset} moves. Simulated receipts are labelled <strong>SIM-…</strong>.
                </span>
              </div>
            ) : (
              <div className="notice info" style={{ marginTop: 18 }}>
                <span aria-hidden="true">🛡️</span>
                <span>
                  This request opens <strong>Nimiq Pay's native confirmation dialog</strong>. Your keys never leave the wallet. Success is only shown after Nimiq Pay confirms.
                </span>
              </div>
            ))}

            <div className="flex gap-12" style={{ marginTop: 22 }}>
              <Button variant="ghost" onClick={() => { setStep(STEP.CANCELLED); setTimeout(onClose, 300); }}>Cancel</Button>
              <Button variant={demo ? "amber" : "nimiq"} onClick={handleConfirm} style={{ flex: 1 }} disabled={disabled || checkingEnvironment}>
                {checkingEnvironment ? "Checking environment…" : `Confirm with Nimiq Pay · ${request.amount} ${request.asset}`}
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
            <h3 style={{ margin: "0 0 6px" }}>{pendingText}</h3>
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
            <h3 style={{ margin: "0 0 8px" }}>{result.simulated ? "Learning pack unlocked (simulated)" : "Learning pack unlocked"}</h3>
            <p className="small muted" style={{ margin: "0 0 14px" }}>
              {result.detail}
            </p>
            <PaymentReceipt
              product={pack.title}
              amount={request.amount}
              asset={result.asset}
              chain={result.chain}
              recipient={request.recipient}
              transactionHash={result.transactionHash}
              status={result.transactionState}
              simulated={result.simulated}
              occurredAt={Date.now()}
            />
            <Button variant="teal" block onClick={onClose} style={{ marginTop: 18 }}>Start learning</Button>
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
              {result?.transactionState === TRANSACTION_STATE.UNKNOWN
                ? "Payment submitted"
                : result?.transactionState === TRANSACTION_STATE.REJECTED
                ? "Payment cancelled"
                : "Payment not confirmed"}
            </h3>
            <p className="small muted" style={{ margin: "0 0 18px" }}>
              {result?.error || "Payment status could not be confirmed."}
            </p>
            <div className="flex gap-12">
              {result?.transactionState === TRANSACTION_STATE.UNKNOWN ? (
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
