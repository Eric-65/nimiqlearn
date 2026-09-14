import React from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useNimiq } from "../hooks/useNimiq.js";
import { useAiBackend } from "../hooks/useAiBackend.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import { LEAF_TOPICS, findTopic } from "../data/mockTopics.js";
import { LEARNING_PACKS } from "../data/mockLearningPacks.js";

const HERO_IMG =
  "https://images.pexels.com/photos/16504588/pexels-photo-16504588.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1100&w=1400";
const STORY_IMG =
  "https://images.pexels.com/photos/38882884/pexels-photo-38882884.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=1200";

const FEATURES = [
  {
    icon: "🔄",
    title: "LearnLoop",
    text: "Every answer feeds the loop. NimiqLearn continuously decides what you know, what you misunderstand, and what you should do next.",
  },
  {
    icon: "🗣️",
    title: "ExplainBack",
    text: "Explaining a concept is the strongest test of understanding. The AI evaluates your explanation and finds the gaps you didn't know you had.",
  },
  {
    icon: "⏳",
    title: "ForgetMeNot",
    text: "Transparent spaced review. The app schedules reinforcement from your mastery, recency, and recent mistakes — no magic, no guessing.",
  },
  {
    icon: "⚡",
    title: "Learning Economy",
    text: "Premium packs, unlocked directly with NIM through Nimiq Pay. Educators get paid instantly — no middlemen, no custodial wallets.",
  },
];

const LOOP = ["Learn", "Explain", "Evaluate", "Detect gap", "Remediate", "Challenge", "Measure", "Review"];

/** Pick the single best "learn next" recommendation from learner state. */
function pickRecommended(knowledge, reviewQueue) {
  const due = reviewQueue.filter((r) => r.dueNow);
  if (due.length) {
    const topic = findTopic(due[0].topicId);
    if (topic) return { topic, why: "ForgetMeNot flagged this for review — a quick refresh locks it in.", label: "Due for review" };
  }
  const active = knowledge
    .filter((k) => k.mastery > 0 && k.status !== "MASTERED")
    .sort((a, b) => a.mastery - b.mastery)[0];
  if (active) {
    const topic = findTopic(active.topicId);
    if (topic) return { topic, why: `You're at ${active.mastery}% — the next step will strengthen this.`, label: "Keep building" };
  }
  const fresh = LEAF_TOPICS.find((t) => !knowledge.some((k) => k.topicId === t.id && k.mastery > 0));
  if (fresh) return { topic: fresh, why: "A fresh concept to grow your map.", label: "New concept" };
  return null;
}

export default function Home() {
  const { navigate } = useNav();
  const { learner, knowledge, reviewQueue } = useLearner();
  const nimiq = useNimiq();
  const ai = useAiBackend();

  const recommended = pickRecommended(knowledge, reviewQueue);
  const dueCount = reviewQueue.filter((r) => r.dueNow).length;
  const unlockedCount = (learner.unlockedPacks || []).length;
  const recentUnlock = [...(learner.unlockedPacks || [])].sort((a, b) => (b.purchasedAt || 0) - (a.purchasedAt || 0))[0];
  const recentPack = recentUnlock ? LEARNING_PACKS.find((p) => p.id === recentUnlock.productId) : null;

  return (
    <div>
      {/* ================= HERO ================= */}
      <section style={{ position: "relative", overflow: "hidden", padding: "clamp(40px, 7vw, 76px) 0" }}>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(700px 420px at 15% 20%, rgba(77,141,255,0.16), transparent 60%), radial-gradient(620px 380px at 85% 10%, rgba(124,58,237,0.14), transparent 60%), radial-gradient(560px 340px at 60% 100%, rgba(52,224,180,0.10), transparent 60%)",
          }}
        />
        <div className="grid grid-2 items-center gap-24" style={{ position: "relative", alignItems: "center" }}>
          <div className="anim-rise">
            <span className="eyebrow">NimiqLearn</span>
            <h1 style={{ fontSize: "clamp(34px, 5vw, 58px)", fontWeight: 800, lineHeight: 1.08, margin: "0 0 18px" }}>
              Learn smarter.
              <br />
              Explain better.
              <br />
              <span style={{ background: "linear-gradient(90deg, var(--c-gold), #ffd37e)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                Remember longer.
              </span>
            </h1>
            <p style={{ fontSize: "clamp(15px, 1.6vw, 18px)", color: "var(--c-text-dim)", maxWidth: 560, lineHeight: 1.65 }}>
              An adaptive learning system that finds what you understand, what you're missing, and what you should practice next.
            </p>

            <div className="flex gap-12 wrap" style={{ marginTop: 28 }}>
              <Button variant="primary" size="lg" onClick={() => navigate("learn")}>
                Start Learning →
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate("explain")}>
                Explain a concept
              </Button>
            </div>

            <div className="flex gap-16 wrap" style={{ marginTop: 30 }}>
              {/* These claims must track how the AI actually runs. They said
                  "runs locally in your browser" / "stays on your device" back
                  when grading used an on-device SmolLM2 model — that model is
                  gone, and explanations are now sent to OpenAI through this
                  app's own backend, so the old wording was a privacy promise
                  the app no longer keeps. */}
              {["🧠 AI grading, with a built-in offline engine", "🔒 Your keys never leave your wallet", "⚡ Pay with NIM"].map((t) => (
                <span key={t} className="tiny muted">{t}</span>
              ))}
            </div>
          </div>

          {/* Hero visual — calm, single framed image */}
          <div className="anim-rise delay-2" style={{ position: "relative" }}>
            <div
              style={{
                position: "relative",
                borderRadius: "var(--r-xl)",
                overflow: "hidden",
                border: "1px solid var(--c-border-strong)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <img
                src={HERO_IMG}
                alt="A focused student reading a textbook in a warm library"
                style={{ width: "100%", height: "clamp(300px, 42vw, 460px)", objectFit: "cover" }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, transparent 45%, rgba(10,15,30,0.8))",
                }}
              />
              <div style={{ position: "absolute", left: 20, bottom: 18, right: 20 }}>
                <Badge tone="gold">ExplainBack in action</Badge>
                <p className="small" style={{ margin: "8px 0 0", color: "#eef2ff" }}>
                  “Force equals mass times acceleration — so the same push moves a light cart faster…”
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= LEARNING DASHBOARD ================= */}
      <section style={{ marginTop: 48 }}>
        <div className="grid grid-2" style={{ marginBottom: 18 }}>
          {/* What should I learn next? */}
          <Card
            hover
            style={{ borderColor: "rgba(247,193,79,0.35)", background: "linear-gradient(135deg, rgba(247,193,79,0.12), rgba(17,24,49,0.9) 60%)" }}
          >
            <span className="eyebrow" style={{ marginBottom: 8 }}>What should I learn next?</span>
            {recommended ? (
              <>
                <Badge tone="gold">{recommended.label}</Badge>
                <h3 style={{ fontSize: 20, margin: "10px 0 6px" }}>{recommended.topic.name}</h3>
                <p className="small muted" style={{ margin: "0 0 16px" }}>{recommended.why}</p>
                <Button variant="primary" onClick={() => navigate("learn", { topic: recommended.topic.id })}>
                  Continue →
                </Button>
              </>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>Everything looks strong — pick something new to explore.</p>
            )}
          </Card>

          {/* ExplainBack */}
          <Card hover>
            <div style={{ fontSize: 30, marginBottom: 8 }} aria-hidden="true">🗣️</div>
            <h3 style={{ fontSize: 17, margin: "0 0 6px" }}>ExplainBack</h3>
            <p className="small muted" style={{ margin: "0 0 16px" }}>
              Test what you really understand. {ai.available ? "AI ready — explain and get instant feedback." : "Explain a concept and the AI checks your understanding."}
            </p>
            <Button variant="teal" onClick={() => navigate("explain")}>Explain a concept →</Button>
          </Card>
        </div>

        <div className="grid grid-2">
          {/* ForgetMeNot */}
          <Card hover>
            <div className="flex items-center gap-10" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 26 }} aria-hidden="true">⏳</span>
              <h3 style={{ fontSize: 17, margin: 0 }}>ForgetMeNot</h3>
            </div>
            <p className="small muted" style={{ margin: "0 0 16px" }}>
              {dueCount > 0
                ? `${dueCount} ${dueCount === 1 ? "concept is" : "concepts are"} ready for review.`
                : "No reviews due right now — you're on track."}
            </p>
            <Button variant="outline" onClick={() => navigate("review")}>Review →</Button>
          </Card>

          {/* Learning Economy */}
          <Card hover>
            <div className="flex items-center gap-10" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 26 }} aria-hidden="true">⚡</span>
              <h3 style={{ fontSize: 17, margin: 0 }}>Learning Economy</h3>
            </div>
            <p className="small muted" style={{ margin: "0 0 6px" }}>
              Unlocked learning paths: <strong>{unlockedCount}</strong>
            </p>
            {recentPack && (
              <p className="tiny muted" style={{ margin: "0 0 14px" }}>
                Recent purchase: <strong>{recentPack.title}</strong> · {recentPack.price} {recentPack.asset}
              </p>
            )}
            {!recentPack && <p className="tiny muted" style={{ margin: "0 0 14px" }}>Unlock packs with NIM through Nimiq Pay.</p>}
            <div className="flex gap-8 wrap">
              <Button variant="outline" size="sm" onClick={() => navigate("market")}>Explore Marketplace</Button>
              {!nimiq.isConnected && <Badge tone="amber">DEMO MODE</Badge>}
            </div>
          </Card>
        </div>
      </section>

      {/* ================= THE LOOP ================= */}
      <section style={{ marginTop: 64 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <span className="eyebrow">The core loop</span>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 34px)", margin: 0 }}>An AI tutor that learns what you understand</h2>
        </div>
        <div className="flex gap-8 wrap" style={{ justifyContent: "center", maxWidth: 860, margin: "0 auto" }}>
          {LOOP.map((step, i) => (
            <span key={step} className="chip" style={{ cursor: "default", background: i % 2 ? "var(--c-blue-soft)" : "var(--c-gold-soft)", borderColor: i % 2 ? "rgba(77,141,255,0.4)" : "rgba(247,193,79,0.4)" }}>
              <span style={{ color: "var(--c-gold)", fontWeight: 700 }}>{i + 1}.</span> {step}
              {i < LOOP.length - 1 && <span aria-hidden="true" style={{ color: "var(--c-text-faint)" }}>→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section style={{ marginTop: 64 }}>
        <div className="grid grid-4">
          {FEATURES.map((f, i) => (
            <Card key={f.title} hover className={`anim-rise delay-${i + 1}`}>
              <div style={{ fontSize: 30, marginBottom: 10 }} aria-hidden="true">{f.icon}</div>
              <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>{f.title}</h3>
              <p className="small muted" style={{ margin: 0, lineHeight: 1.6 }}>{f.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ================= STORY ================= */}
      <section style={{ marginTop: 72 }}>
        <Card style={{ padding: "clamp(26px, 4vw, 44px)", background: "linear-gradient(135deg, rgba(37,103,235,0.12), rgba(17,24,49,0.92) 55%)" }}>
          <div className="grid grid-2 items-center gap-24">
            <div>
              <span className="eyebrow">Why NimiqLearn exists</span>
              <h2 style={{ fontSize: "clamp(22px, 2.8vw, 30px)", margin: "0 0 16px" }}>
                Two connected problems. One learning economy.
              </h2>
              <div style={{ display: "grid", gap: 16 }}>
                <div className="notice info" style={{ margin: 0 }}>
                  <span aria-hidden="true">🎓</span>
                  <span>
                    <strong>The educational problem.</strong> Most platforms flood you with content but never understand what you actually know, which misconception is blocking you, or what needs reinforcement next.
                  </span>
                </div>
                <div className="notice" style={{ margin: 0 }}>
                  <span aria-hidden="true">🌐</span>
                  <span>
                    <strong>The Web3 problem.</strong> Independent educators lack a simple, native way to monetize small learning experiences and receive direct payments.
                  </span>
                </div>
                <div className="notice success" style={{ margin: 0 }}>
                  <span aria-hidden="true">⚡</span>
                  <span>
                    <strong>NimiqLearn combines</strong> AI personalization with direct educational payments through Nimiq Pay — an adaptive learning marketplace where great teaching gets paid.
                  </span>
                </div>
              </div>
              <div className="flex gap-12 wrap" style={{ marginTop: 22 }}>
                <Button variant="teal" onClick={() => navigate("market")}>Browse the marketplace</Button>
                <Button variant="ghost" onClick={() => navigate("wallet")}>Wallet & payments</Button>
              </div>
            </div>
            <img
              src={STORY_IMG}
              alt="A student reading in a modern library aisle"
              style={{ borderRadius: "var(--r-lg)", border: "1px solid var(--c-border)", boxShadow: "var(--shadow-md)", width: "100%", height: 320, objectFit: "cover" }}
            />
          </div>
        </Card>
      </section>

      {/* ================= CURRICULUM TEASER ================= */}
      <section style={{ marginTop: 64 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <span className="eyebrow">Start anywhere</span>
          <h2 style={{ fontSize: "clamp(22px, 2.8vw, 30px)", margin: 0 }}>Pick a concept and explain it back</h2>
        </div>
        <div className="flex gap-8 wrap" style={{ justifyContent: "center" }}>
          {LEAF_TOPICS.slice(0, 6).map((t) => (
            <button key={t.id} className="chip" onClick={() => navigate("explain", { topic: t.id })}>
              {t.name}
            </button>
          ))}
          <button className="chip" onClick={() => navigate("learn")}>+ all topics</button>
        </div>
      </section>

      <section style={{ marginTop: 72, textAlign: "center" }}>
        <Button variant="primary" size="lg" onClick={() => navigate("learn")}>Start Learning — it's free</Button>
      </section>
    </div>
  );
}
