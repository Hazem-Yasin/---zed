/**
 * Startup splash. The markup lives in index.html (so it paints before any JS runs);
 * this module only decides when to take it away.
 */
const MIN_VISIBLE_MS = 1800; // long enough to read the ayah once
const FAILSAFE_MS = 8000; // never trap the user behind it
const FADE_MS = 500;

let hidden = false;

export function hideSplash() {
  if (hidden) return;
  hidden = true;
  const el = document.getElementById('splash');
  if (!el) return;
  const wait = Math.max(0, MIN_VISIBLE_MS - performance.now());
  window.setTimeout(() => {
    el.classList.add('splash-out');
    window.setTimeout(() => el.remove(), FADE_MS + 50);
  }, wait);
}

/** Call once at startup. */
export function armSplashFailsafe() {
  window.setTimeout(hideSplash, FAILSAFE_MS);
}
