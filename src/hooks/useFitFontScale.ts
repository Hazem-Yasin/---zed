import { useCallback, useEffect, useLayoutEffect, useState, RefObject } from 'react';

export const FIT_MIN_SCALE = 0.3;
export const FIT_MAX_SCALE = 1.5;

/**
 * Keeps all text inside `frameRef` visible at any viewport size / browser zoom.
 *
 * - Binary-searches the largest font scale (FIT_MIN_SCALE..FIT_MAX_SCALE) at which the
 *   frame's content does not overflow, so text grows on big screens and shrinks on small ones.
 * - Re-fits whenever the frame is resized (window resize, browser zoom, layout change)
 *   or when `refitKey` changes (new page data, revealed verses, ...).
 * - If content still overflows at the minimum scale, the frame should be `overflow-y-auto`
 *   so the rest of the text stays reachable by scrolling.
 * - Manual zoom (zoomIn/zoomOut) pauses auto-fit until `reset()` or `resetKey` changes.
 */
export function useFitFontScale(
  frameRef: RefObject<HTMLElement>,
  resetKey: unknown,
  refitKey: unknown
) {
  const [fontScale, setFontScale] = useState<number>(1);
  const [userOverride, setUserOverride] = useState<boolean>(false);
  const [resizeTick, setResizeTick] = useState<number>(0);

  // New page => back to auto-fit
  useEffect(() => {
    setFontScale(1);
    setUserOverride(false);
  }, [resetKey]);

  // Refit on any size change of the frame (covers window resize and browser zoom)
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setResizeTick(t => t + 1));
    ro.observe(frame);
    return () => ro.disconnect();
  }, [frameRef, refitKey]);

  // Find the largest scale that fits
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || userOverride) return;

    const overflows = () => frame.scrollHeight > frame.clientHeight + 1;
    let lo = FIT_MIN_SCALE;
    let hi = FIT_MAX_SCALE;

    frame.style.fontSize = `${hi * 100}%`;
    if (!overflows()) {
      lo = hi;
    } else {
      for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2;
        frame.style.fontSize = `${mid * 100}%`;
        if (overflows()) hi = mid;
        else lo = mid;
      }
    }

    const best = +lo.toFixed(3);
    frame.style.fontSize = `${best * 100}%`;
    setFontScale(prev => (Math.abs(prev - best) < 0.001 ? prev : best));
  }, [frameRef, refitKey, resizeTick, userOverride]);

  const zoomIn = useCallback(() => {
    setFontScale(prev => Math.min(+(prev + 0.05).toFixed(3), FIT_MAX_SCALE));
    setUserOverride(true);
  }, []);

  const zoomOut = useCallback(() => {
    setFontScale(prev => Math.max(+(prev - 0.05).toFixed(3), FIT_MIN_SCALE));
    setUserOverride(true);
  }, []);

  const reset = useCallback(() => {
    setUserOverride(false);
    setResizeTick(t => t + 1);
  }, []);

  return { fontScale, zoomIn, zoomOut, reset };
}
