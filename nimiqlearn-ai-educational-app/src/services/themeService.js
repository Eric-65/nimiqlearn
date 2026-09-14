/* ============================================================
   NimiqLearn — theme service
   ------------------------------------------------------------
   Owns the one fact "which theme is active" and the one side
   effect that applies it: a data-theme attribute on <html>.
   All the actual colour lives in src/styles/variables.css —
   this file never contains a hex value.

   Three modes, matching what a learner can reasonably want:
     "dark"   — the brand default, and what unconfigured means
     "light"  — explicit opt-in
     "system" — follow the OS, and keep following it if the OS
                flips while the app is open

   Persisted per-browser in localStorage. Every read/write is
   wrapped: localStorage throws outright in some WebViews and in
   private mode, and a theme preference is never worth breaking
   the app over.
   ============================================================ */

export const THEME_MODES = ["dark", "light", "system"];
export const DEFAULT_THEME = "dark";

const STORAGE_KEY = "nimiqlearn:theme";

const listeners = new Set();
let current = DEFAULT_THEME;

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return THEME_MODES.includes(raw) ? raw : null;
  } catch {
    return null;
  }
}

function persist(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage unavailable — the theme still applies for this session */
  }
}

/** The mode the app is set to ("system" stays "system" here — use
 * getResolvedTheme() when you need the concrete dark/light answer). */
export function getThemeMode() {
  return current;
}

/** What "system" currently resolves to, so UI can show the real state. */
export function getResolvedTheme(mode = current) {
  if (mode !== "system") return mode;
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return DEFAULT_THEME;
  }
}

function apply(mode) {
  const root = document.documentElement;
  if (!root) return;
  // Dark is what a bare :root already is, so the attribute is only set for
  // the two modes that need a selector to match. Setting data-theme="dark"
  // would work too, but leaving it off keeps the default path attribute-free
  // and matches the no-JS/first-paint state exactly.
  if (mode === "dark") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
}

/**
 * Applies the stored theme. Call once, as early as possible — see the
 * inline script in index.html, which does the same job before first paint
 * so a light-theme user never sees a dark flash. This function is the
 * React-side source of truth after that.
 */
export function initTheme() {
  current = readStored() || DEFAULT_THEME;
  apply(current);

  // Keep "system" live: if the OS flips while the app is open, the CSS
  // media query re-matches on its own, but subscribers still need telling
  // so any UI showing the resolved value updates with it.
  try {
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (current === "system") notify();
    };
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
  } catch {
    /* matchMedia unavailable — system mode just won't live-update */
  }
  return current;
}

function notify() {
  const snapshot = { mode: current, resolved: getResolvedTheme() };
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      /* a bad listener must never break theme switching */
    }
  });
}

export function setThemeMode(mode) {
  if (!THEME_MODES.includes(mode)) return current;
  current = mode;
  persist(mode);

  // Briefly cross-fade colours so the switch reads as intentional. The
  // class is removed once the transition is done, otherwise EVERY later
  // colour change on the page (hover, focus, progress bars) inherits this
  // transition and the whole UI feels laggy.
  const root = document.documentElement;
  let cleanup = null;
  try {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && root) {
      root.classList.add("theme-transition");
      cleanup = setTimeout(() => root.classList.remove("theme-transition"), 280);
    }
  } catch {
    /* ignore — the theme still applies without the fade */
  }

  apply(mode);
  notify();
  if (cleanup === null && root) root.classList.remove("theme-transition");
  return current;
}

export function subscribeToTheme(fn) {
  listeners.add(fn);
  fn({ mode: current, resolved: getResolvedTheme() });
  return () => listeners.delete(fn);
}
