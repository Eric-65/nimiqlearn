import React from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useNimiq } from "../hooks/useNimiq.js";
import { useAiBackend } from "../hooks/useAiBackend.js";
import { useI18n } from "../hooks/useI18n.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import BuiltOnNimiq from "../components/layout/BuiltOnNimiq.jsx";
import CourseCarousel from "../components/home/CourseCarousel.jsx";
import { coursesByLanguage } from "../services/videoService.js";
import Badge from "../components/ui/Badge.jsx";
import { LEAF_TOPICS, findTopic } from "../data/mockTopics.js";
import TodaysPlan from "../components/home/TodaysPlan.jsx";
import LearnMascot from "../components/home/LearnMascot.jsx";
import { LEARNING_PACKS } from "../data/mockLearningPacks.js";

const HERO_IMG =
  "https://images.pexels.com/photos/16504588/pexels-photo-16504588.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1100&w=1400";
const STORY_IMG =
  "https://images.pexels.com/photos/38882884/pexels-photo-38882884.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=1200";

/* Ids only — the title and body are t("home.feature.<id>.title"/".text"),
   so no English copy sits in this table at translation time. */
const FEATURES = [
  { id: "learnLoop", icon: "🔄" },
  { id: "explainBack", icon: "🗣️" },
  { id: "forgetMeNot", icon: "⏳" },
  { id: "economy", icon: "⚡" },
];

const LOOP_STEPS = ["learn", "explain", "evaluate", "detectGap", "remediate", "challenge", "measure", "review"];

/** Pick the single best "learn next" recommendation from learner state. */
function pickRecommended(knowledge, reviewQueue) {
  const due = reviewQueue.filter((r) => r.dueNow);
  if (due.length) {
    const topic = findTopic(due[0].topicId);
    if (topic) return { topic, whyKey: "home.rec.due.why", labelKey: "home.rec.due.label" };
  }
  const active = knowledge
    .filter((k) => k.mastery > 0 && k.status !== "MASTERED")
    .sort((a, b) => a.mastery - b.mastery)[0];
  if (active) {
    const topic = findTopic(active.topicId);
    if (topic) {
      return { topic, whyKey: "home.rec.building.why", whyVars: { pct: active.mastery }, labelKey: "home.rec.building.label" };
    }
  }
  const fresh = LEAF_TOPICS.find((t) => !knowledge.some((k) => k.topicId === t.id && k.mastery > 0));
  if (fresh) return { topic: fresh, whyKey: "home.rec.fresh.why", labelKey: "home.rec.fresh.label" };
  return null;
}

export default function Home() {
  const { navigate } = useNav();
  const { learner, knowledge, reviewQueue } = useLearner();
  const nimiq = useNimiq();
  const ai = useAiBackend();
  const { t, tOr, tPlural } = useI18n();

  const recommended = pickRecommended(knowledge, reviewQueue);
  const dueCount = reviewQueue.filter((r) => r.dueNow).length;
  const unlockedCount = (learner.unlockedPacks || []).length;
  const recentUnlock = [...(learner.unlockedPacks || [])].sort((a, b) => (b.purchasedAt || 0) - (a.purchasedAt || 0))[0];
  const recentPack = recentUnlock ? LEARNING_PACKS.find((p) => p.id === recentUnlock.productId) : null;
  const courseGroups = coursesByLanguage();

  return (
    <div>
      {/* ================= HERO ================= */}
      {/* Above the hero, deliberately: a returning learner should reach
          their next step without scrolling past marketing they have already
          read. The hero still does its job for a first visit, one screen
          down. */}
      <TodaysPlan />

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
              {t("home.hero.line1")}
              <br />
              {t("home.hero.line2")}
              <br />
              <span style={{ background: "linear-gradient(90deg, var(--c-gold), #ffd37e)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                {t("home.hero.line3")}
              </span>
            </h1>
            <p style={{ fontSize: "clamp(15px, 1.6vw, 18px)", color: "var(--c-text-dim)", maxWidth: 560, lineHeight: 1.65 }}>
              {t("home.hero.sub")}
            </p>

            <div className="flex gap-12 wrap" style={{ marginTop: 28 }}>
              <Button variant="primary" size="lg" onClick={() => navigate("learn")}>
                {t("home.hero.start")}
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate("explain")}>
                {t("home.hero.explain")}
              </Button>
            </div>

            <div className="flex gap-16 wrap" style={{ marginTop: 30 }}>
              {/* These claims must track how the AI actually runs. They said
                  "runs locally in your browser" / "stays on your device" back
                  when grading used an on-device SmolLM2 model — that model is
                  gone, and explanations are now sent to OpenAI through this
                  app's own backend, so the old wording was a privacy promise
                  the app no longer keeps. */}
              {["home.hero.claim1", "home.hero.claim2", "home.hero.claim3"].map((key) => (
                <span key={key} className="tiny muted">{t(key)}</span>
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
                alt={t("home.hero.imageAlt")}
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
              <div className="over-media" style={{ position: "absolute", left: 20, bottom: 18, right: 20 }}>
                <Badge tone="gold">{t("home.heroCaption.badge")}</Badge>
                <p className="small" style={{ margin: "8px 0 0", color: "var(--c-text)" }}>
                  {t("home.heroCaption.quote")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= LEARNING DASHBOARD ================= */}
      <section className="reveal" style={{ marginTop: 48 }}>
        <div className="grid grid-2" style={{ marginBottom: 18 }}>
          {/* What should I learn next? */}
          <Card
            hover
            style={{ borderColor: "rgba(247,193,79,0.35)", background: "linear-gradient(135deg, var(--c-gold-soft), var(--c-card-base) 60%)" }}
          >
            <span className="eyebrow" style={{ marginBottom: 8 }}>{t("home.next.eyebrow")}</span>
            {recommended ? (
              <>
                <Badge tone="gold">{t(recommended.labelKey)}</Badge>
                <h3 style={{ fontSize: 20, margin: "10px 0 6px" }}>
                  {tOr(`topic.${recommended.topic.id}.name`, recommended.topic.name)}
                </h3>
                <p className="small muted" style={{ margin: "0 0 16px" }}>{t(recommended.whyKey, recommended.whyVars)}</p>
                <Button variant="primary" onClick={() => navigate("learn", { topic: recommended.topic.id })}>
                  {t("home.next.continue")}
                </Button>
              </>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>{t("home.next.allStrong")}</p>
            )}
          </Card>

          {/* ExplainBack */}
          <Card hover>
            <div style={{ fontSize: 30, marginBottom: 8 }} aria-hidden="true">🗣️</div>
            <h3 style={{ fontSize: 17, margin: "0 0 6px" }}>ExplainBack</h3>
            <p className="small muted" style={{ margin: "0 0 16px" }}>
              {t("home.explainCard.body")}{" "}
              {t(ai.available ? "home.explainCard.aiReady" : "home.explainCard.aiOff")}
            </p>
            <Button variant="teal" onClick={() => navigate("explain")}>{t("home.explainCard.cta")}</Button>
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
              {dueCount > 0 ? tPlural("home.reviewCard.due", dueCount) : t("home.reviewCard.none")}
            </p>
            <Button variant="outline" onClick={() => navigate("review")}>{t("home.reviewCard.cta")}</Button>
          </Card>

          {/* Learning Economy */}
          <Card hover>
            <div className="flex items-center gap-10" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 26 }} aria-hidden="true">⚡</span>
              <h3 style={{ fontSize: 17, margin: 0 }}>{t("market.title")}</h3>
            </div>
            <p className="small muted" style={{ margin: "0 0 6px" }}>
              {t("home.economy.unlocked")} <strong>{unlockedCount}</strong>
            </p>
            {recentPack && (
              <p className="tiny muted" style={{ margin: "0 0 14px" }}>
                {t("home.economy.recent")}{" "}
                <strong>{tOr(`pack.${recentPack.id}.title`, recentPack.title)}</strong> · {recentPack.price} {recentPack.asset}
              </p>
            )}
            {!recentPack && <p className="tiny muted" style={{ margin: "0 0 14px" }}>{t("home.economy.hint")}</p>}
            <div className="flex gap-8 wrap">
              <Button variant="outline" size="sm" onClick={() => navigate("market")}>{t("home.economy.cta")}</Button>
              {!nimiq.isConnected && <Badge tone="amber">{t("wallet.demoMode")}</Badge>}
            </div>
          </Card>
        </div>
      </section>

      {/* ================= THE LOOP ================= */}
      <section className="reveal" style={{ marginTop: 64 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <span className="eyebrow">{t("home.loop.eyebrow")}</span>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 34px)", margin: 0 }}>{t("home.loop.title")}</h2>
        </div>
        <div className="flex gap-8 wrap" style={{ justifyContent: "center", maxWidth: 860, margin: "0 auto" }}>
          {LOOP_STEPS.map((step, i) => (
            <span key={step} className="chip" style={{ cursor: "default", background: i % 2 ? "var(--c-blue-soft)" : "var(--c-gold-soft)", borderColor: i % 2 ? "rgba(77,141,255,0.4)" : "rgba(247,193,79,0.4)" }}>
              <span style={{ color: "var(--c-gold)", fontWeight: 700 }}>{i + 1}.</span> {t(`home.loop.${step}`)}
              {i < LOOP_STEPS.length - 1 && <span aria-hidden="true" style={{ color: "var(--c-text-faint)" }}>→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section className="reveal" style={{ marginTop: 64 }}>
        <div className="grid grid-4">
          {FEATURES.map((f, i) => (
            <Card key={f.id} hover className={`anim-rise delay-${i + 1}`}>
              <div style={{ fontSize: 30, marginBottom: 10 }} aria-hidden="true">{f.icon}</div>
              <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>{t(`home.feature.${f.id}.title`)}</h3>
              <p className="small muted" style={{ margin: 0, lineHeight: 1.6 }}>{t(`home.feature.${f.id}.text`)}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ================= STORY ================= */}
      <section className="reveal" style={{ marginTop: 72 }}>
        <Card style={{ padding: "clamp(26px, 4vw, 44px)", background: "linear-gradient(135deg, var(--c-blue-soft), var(--c-card-base) 55%)" }}>
          <div className="grid grid-2 items-center gap-24">
            <div>
              <span className="eyebrow">{t("home.story.eyebrow")}</span>
              <h2 style={{ fontSize: "clamp(22px, 2.8vw, 30px)", margin: "0 0 16px" }}>{t("home.story.title")}</h2>
              <div style={{ display: "grid", gap: 16 }}>
                <div className="notice info" style={{ margin: 0 }}>
                  <span aria-hidden="true">🎓</span>
                  <span>
                    <strong>{t("home.story.edu.title")}</strong> {t("home.story.edu.body")}
                  </span>
                </div>
                <div className="notice" style={{ margin: 0 }}>
                  <span aria-hidden="true">🌐</span>
                  <span>
                    <strong>{t("home.story.web3.title")}</strong> {t("home.story.web3.body")}
                  </span>
                </div>
                <div className="notice success" style={{ margin: 0 }}>
                  <span aria-hidden="true">⚡</span>
                  <span>
                    <strong>{t("home.story.combine.title")}</strong> {t("home.story.combine.body")}
                  </span>
                </div>
              </div>
              <div className="flex gap-12 wrap" style={{ marginTop: 22 }}>
                <Button variant="teal" onClick={() => navigate("market")}>{t("home.story.browse")}</Button>
                <Button variant="ghost" onClick={() => navigate("wallet")}>{t("home.story.wallet")}</Button>
              </div>
            </div>
            <img
              src={STORY_IMG}
              alt={t("home.story.imageAlt")}
              style={{ borderRadius: "var(--r-lg)", border: "1px solid var(--c-border)", boxShadow: "var(--shadow-md)", width: "100%", height: 320, objectFit: "cover" }}
            />
          </div>
        </Card>
      </section>

      {/* ================= BUILT ON NIMIQ ================= */}
      <BuiltOnNimiq />

      {/* ================= CURRICULUM TEASER ================= */}
      <section className="reveal" style={{ marginTop: 64 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <span className="eyebrow">{t("home.pick.eyebrow")}</span>
          <h2 style={{ fontSize: "clamp(22px, 2.8vw, 30px)", margin: 0 }}>{t("home.pick.title")}</h2>
        </div>
        <div className="flex gap-8 wrap" style={{ justifyContent: "center" }}>
          {LEAF_TOPICS.slice(0, 6).map((leaf) => (
            <button key={leaf.id} className="chip" onClick={() => navigate("explain", { topic: leaf.id })}>
              {tOr(`topic.${leaf.id}.name`, leaf.name)}
            </button>
          ))}
          <button className="chip" onClick={() => navigate("learn")}>{t("home.pick.allTopics")}</button>
        </div>
      </section>

      {/* ================= VIDEO COURSES ================= */}
      {/* Two identical sections: every English course, then every course in
          another language (German, French, Spanish …), each paged three at
          a time. Grouped by the language SPOKEN in the video, not the UI
          language, so a French reader still finds the German lectures under
          "other languages" and the English ones under "English". */}
      <CourseCarousel
        idBase="courses-en"
        courses={courseGroups.english}
        eyebrow={t("courses.eyebrow")}
        title={t("courses.english.title")}
      />
      <CourseCarousel
        idBase="courses-other"
        courses={courseGroups.other}
        eyebrow={t("courses.eyebrow")}
        title={t("courses.other.title")}
      />

      <section className="reveal" style={{ marginTop: 72, textAlign: "center" }}>
        <Button variant="primary" size="lg" onClick={() => navigate("learn")}>{t("home.finalCta")}</Button>

        {/* Between the last call to action and the footer: the page's
            closing note rather than a decoration competing with anything.
            A learner who has read this far has either pressed the button
            or is deciding — and a character doing a small dance at the
            bottom of the page is a warmer end than a rule and a link
            list. */}
        <LearnMascot />
      </section>
    </div>
  );
}
