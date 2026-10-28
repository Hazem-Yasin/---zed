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
  // Finish the loading bar: freeze it where it is, then run it to 100%.
  const fill = el.querySelector<HTMLElement>('.splash-bar-fill');
  if (fill) {
    fill.style.width = `${fill.getBoundingClientRect().width}px`;
    fill.style.animation = 'none';
    void fill.offsetWidth; // commit the frozen width so the transition starts from it
    fill.style.transition = 'width 0.35s ease-out';
    fill.style.width = '100%';
  }
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
