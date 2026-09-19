/* ============================================================
   NimiqLearn — Wallet authentication session (item 12)
   ------------------------------------------------------------
   Owns ONLY minimal session metadata:
     { address, authenticatedAt, expiresAt }

   Never stores a private key, seed phrase, signing secret, or
   even the signature itself — those never leave
   nimiqWalletService.js's call to the real provider.sign(), and
   this module never sees them.

   localStorage is NOT treated as proof of ownership by itself:
   it is a same-device convenience so the UI can show "signed in"
   without re-prompting every render. The real proof is the
   signature the wallet produced at sign-in time, which this app
   has no backend to verify or archive — see "Security model" in
   docs/nimiq-pay-integration.md for the full caveat.
   ============================================================ */

const SESSION_STORAGE_KEY = "nimiqlearn:wallet-auth";

/* Two different lifetimes, deliberately kept apart.

   The CHALLENGE window is how long the message the wallet signs stays
   valid — short, so a captured signature cannot be replayed later. Five
   minutes is plenty to read the prompt and tap Sign.

   The SESSION is how long the resulting sign-in lasts — the account the
   learner is signed into, in the sense a Google account stays signed in.
   That is weeks, not minutes: a learner who opens the app tomorrow should
   find their own profile waiting, not be sent back to the guest and asked
   to sign again. Signing out clears it early; a different wallet signing
   in replaces it. (One value used to serve both, and the sign-in silently
   lapsed five minutes after it was granted.) */
const CHALLENGE_WINDOW_MS = 5 * 60 * 1000;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function secureNonce() {
  const cryptoObj = typeof crypto !== "undefined" ? crypto : globalThis.crypto;
  if (!cryptoObj?.getRandomValues) throw new Error("A secure random source is not available in this environment.");
  const bytes = new Uint8Array(16);
  cryptoObj.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Builds the exact, human-readable challenge the user will see and approve
 * inside Nimiq Pay's own signing confirmation UI (item 10). Pure function —
 * does not touch the provider or storage.
 */
export function createAuthChallenge({ address }) {
  const issuedAt = new Date();
  /* The Expires line the learner sees in Nimiq Pay is the CHALLENGE window. */
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_WINDOW_MS);
  const nonce = secureNonce();
  const origin = typeof window !== "undefined" ? window.location.origin : "unknown-origin";
  const message = [
    "NimiqLearn sign-in",
    "",
    'I am signing into NimiqLearn.',
    "",
    `Application: ${origin}`,
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt.toISOString()}`,
    `Expires: ${expiresAt.toISOString()}`,
  ].join("\n");
  return { message, nonce, issuedAt, expiresAt };
}

/* The challenge's `expiresAt` is deliberately ignored: the challenge has
   done its job the moment the wallet signed it. The session gets its own,
   long lifetime — see SESSION_DURATION_MS. */
export function createSession({ address, issuedAt }) {
  const session = {
    address,
    authenticatedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + SESSION_DURATION_MS).toISOString(),
  };
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable — session still works for this page load via in-memory state */
  }
  return session;
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Returns the stored session only if it is unexpired AND for this exact
 * address — a session for a different account proves nothing here. */
export function getStoredSession(address) {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.expiresAt || new Date(session.expiresAt).getTime() < Date.now()) {
      clearSession();
      return null;
    }
    if (address && session.address !== address) return null;
    return session;
  } catch {
    return null;
  }
}
