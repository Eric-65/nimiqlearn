import React, { useCallback, useRef, useState } from "react";
import { useI18n } from "../../hooks/useI18n.js";
import { MASCOT_SRC, MASCOT_WIDTH, MASCOT_HEIGHT } from "../../data/mascotArt.js";

/**
 * The NimiqLearn mascot, dancing at the foot of Home.
 *
 * HOW THE DANCE IS BUILT
 *
 * Three nested elements, one transform animation each, rather than one
 * element with a combined keyframe set. Transforms on the same element
 * overwrite each other, so combining them means writing every frame of
 * every motion into one timeline — and then they are locked in step.
 * Nested, each layer owns one idea:
 *
 *   .mascot-bob     up and down
 *   .mascot-sway    a lean into each step
 *   .mascot-art     squash and stretch
 *
 * The three durations are deliberately not multiples of each other
 * (1.4s / 2.2s / 0.7s), so the combination takes about 15 seconds to
 * come back around instead of visibly ticking on a one-second loop. That
 * is the whole trick to a character that looks alive rather than
 * mechanical.
 *
 * Squash and stretch is what sells the weight: the body widens and
 * flattens at the bottom of each bob and narrows at the top. The shadow
 * is the other half of it — it spreads and darkens as the mascot lands
 * and shrinks as it rises, which is what tells the eye there is a floor.
 *
 * Tapping it makes it jump. The class is removed on animationend so the
 * jump can be triggered again — a one-shot animation that is never
 * cleaned up simply never plays a second time.
 *
 * It is decorative: alt="" and aria-hidden, because a screen reader
 * announcing "a yellow cartoon character waves" between a call to action
 * and the footer is noise. Learners who prefer less motion get a still
 * mascot via the global prefers-reduced-motion rule, plus the explicit
 * rules in global.css that stop it freezing mid-squash.
 */
export default function LearnMascot() {
  const { t } = useI18n();
  const [jumping, setJumping] = useState(false);
  const stage = useRef(null);

  const jump = useCallback(() => setJumping(true), []);

  return (
    <div className="mascot-stage" ref={stage}>
      <button
        type="button"
        className={`mascot-tap ${jumping ? "is-jumping" : ""}`}
        onClick={jump}
        onAnimationEnd={() => setJumping(false)}
        aria-label={t("mascot.aria")}
      >
        <span className="mascot-bob">
          <span className="mascot-sway">
            <img
              className="mascot-art"
              src={MASCOT_SRC}
              width={MASCOT_WIDTH}
              height={MASCOT_HEIGHT}
              alt=""
              aria-hidden="true"
              draggable="false"
            />
          </span>
        </span>
        <span className="mascot-shadow" aria-hidden="true" />
      </button>
    </div>
  );
}
