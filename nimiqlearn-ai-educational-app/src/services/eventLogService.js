/* ============================================================
   NimiqLearn — Learning event log
   ------------------------------------------------------------
   A lightweight, append-only record of learning behaviour, kept
   entirely separate from the wallet/payment domain. This is the
   raw material a future trained learner-state model would be
   fit on (offline, from real usage) — see training/learner_state/README.md.

   NEVER log wallet addresses, transaction history, payment
   amounts, or any Nimiq Pay data here (see NIMIQ PAY SEPARATION
   in training/README.md).
   ============================================================ */

export const EVENT_TYPES = [
  "ANSWER_SUBMITTED",
  "EXPLANATION_SUBMITTED",
  "EXPLANATION_EVALUATED",
  "CHALLENGE_COMPLETED",
  "REVIEW_COMPLETED",
];

const STORAGE_KEY = "nimiqlearn:events:v1";
const MAX_EVENTS = 300;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(events) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch {
    /* storage full / private mode — events are non-critical, drop silently */
  }
}

/**
 * @param {{eventType:string, topicId?:string, activityId?:string, correct?:boolean|null, score?:number, durationMs?:number}} event
 */
export function logEvent({ eventType, topicId = null, activityId = null, correct = null, score = null, durationMs = null } = {}) {
  if (!EVENT_TYPES.includes(eventType)) {
    console.warn(`[NimiqLearn] Unknown event type: ${eventType}`);
    return;
  }
  const entry = { eventType, topicId, activityId, correct, score, durationMs, timestamp: Date.now() };
  writeAll([entry, ...readAll()]);
  return entry;
}

export function getEventLog() {
  return readAll();
}

export function clearEventLog() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
