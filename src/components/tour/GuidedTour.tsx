import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, SkipForward, X } from 'lucide-react';
import { TOUR_STEPS as steps, TourStep, leadMs, readMs } from './tourSteps';

interface Props {
  /** Called whenever the tour lands on a step: the host navigates to `step.view` and drives the globe. */
  onStep: (step: TourStep, prev: TourStep | null) => void;
  /** Called once when the tour closes (finished = reached the end). */
  onEnd: (finished: boolean) => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TICK = 100;
const PART_LABEL: Record<TourStep['part'], string> = { globe: 'أدوات الأطلس', site: 'صفحات الموقع' };

/** First on-screen element carrying one of the `data-tour` keys (hidden elements have no size, so they are skipped). */
function findSpot(keys: string[] | undefined): Box | null {
  for (const k of keys ?? []) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${k}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return null;
}

const same = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/**
 * Guided tour: a small popup that explains each step while the app shows the real screen behind it,
 * a ring around the element being described, and auto-advance with pause / back / next / skip.
 */
const GuidedTour: React.FC<Props> = ({ onStep, onEnd }) => {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [spot, setSpot] = useState<Box | null>(null);
  const [total, setTotal] = useState(() => leadMs(steps[0], null) + readMs(steps[0]));
  const prevRef = useRef<TourStep | null>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const step = steps[i];
  const isLast = i === steps.length - 1;

  // Land on a step: navigate, restart its clock.
  useEffect(() => {
    onStepRef.current(step, prevRef.current);
    setTotal(leadMs(step, prevRef.current) + readMs(step));
    prevRef.current = step;
    setElapsed(0);
    setSpot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const go = useCallback(
    (to: number) => {
      if (to >= steps.length) onEnd(true);
      else setI(Math.max(0, to));
    },
    [onEnd]
  );

  // Auto-advance clock.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setElapsed((e) => e + TICK), TICK);
    return () => clearInterval(t);
  }, [playing]);
  useEffect(() => {
    if (playing && elapsed >= total) {
      if (isLast) setPlaying(false);
      else go(i + 1);
    }
  }, [elapsed, total, playing, isLast, go, i]);

  // Follow the highlighted element (it appears after the screen / camera settles and may move).
  useEffect(() => {
    const tick = () => setSpot((old) => {
      const next = findSpot(step.spot);
      return same(old, next) ? old : next;
    });
    tick();
    const t = setInterval(tick, 200);
    window.addEventListener('resize', tick);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', tick);
    };
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEnd(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEnd]);

  useEffect(() => nextBtn.current?.focus(), []);

  // Put the popup on whichever side covers less of the highlighted element.
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
  let dock: 'top' | 'bottom' = step.dock ?? 'bottom';
  if (!step.dock && spot) {
    const cardW = Math.min(vw * 0.92, 416);
    const cardH = 270;
    const cardL = (vw - cardW) / 2;
    const overlap = (cardT: number) => {
      const w = Math.max(0, Math.min(spot.left + spot.width, cardL + cardW) - Math.max(spot.left, cardL));
      const h = Math.max(0, Math.min(spot.top + spot.height, cardT + cardH) - Math.max(spot.top, cardT));
      return w * h;
    };
    dock = overlap(72) < overlap(vh - 96 - cardH) ? 'top' : 'bottom';
  }

  const firstSite = steps.findIndex((s) => s.part === 'site');
  const pct = Math.min(100, (elapsed / total) * 100);
  const pad = 6;

  return (
    <div className="fixed inset-0 z-[110] pointer-events-none" dir="rtl">
      {spot && (
        <div
          aria-hidden
          className="fixed rounded-2xl border-2 border-amber-400 transition-[top,left,width,height] duration-300 ease-out"
          style={{
            top: spot.top - pad,
            left: spot.left - pad,
            width: spot.width + pad * 2,
            height: spot.height + pad * 2,
            boxShadow: '0 0 0 3px rgba(251,191,36,0.25), 0 0 28px 6px rgba(251,191,36,0.45)',
          }}
        />
      )}

      <section
        role="dialog"
        aria-label={`الجولة التعريفية: ${step.title}`}
        className={`pointer-events-auto absolute inset-x-0 mx-auto w-[min(92vw,26rem)] glass-panel-strong rounded-2xl border-amber-500/40 overflow-hidden ${
          dock === 'top' ? 'top-[4.5rem]' : 'bottom-24'
        }`}
      >
        <div className="h-1 bg-slate-800" aria-hidden>
          <div className="h-full bg-amber-400 transition-[width] duration-100 ease-linear" style={{ width: `${pct}%` }} />
        </div>
        <div className="p-4 pt-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold">{PART_LABEL[step.part]}</span>
            <span>
              الخطوة {i + 1} من {steps.length}
            </span>
            <button
              type="button"
              onClick={() => onEnd(false)}
              aria-label="إغلاق الجولة"
              title="إغلاق الجولة (Esc)"
              className="ms-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div aria-live="polite" className="max-h-[38vh] overflow-y-auto">
            <h2 className="mt-2 text-base font-black text-amber-300 leading-snug">{step.title}</h2>
            <p className="mt-1.5 text-sm text-slate-200 leading-relaxed">{step.text}</p>
          </div>

          <div className="mt-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => go(i - 1)}
              disabled={i === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" /> السابق
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? 'إيقاف مؤقت' : 'متابعة تلقائية'}
              title={playing ? 'إيقاف مؤقت' : 'متابعة تلقائية'}
              className="p-2 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              ref={nextBtn}
              type="button"
              onClick={() => go(i + 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400"
            >
              {isLast ? 'إنهاء' : 'التالي'} {!isLast && <ChevronLeft className="w-4 h-4" />}
            </button>
            {step.part === 'globe' && firstSite > i && (
              <button
                type="button"
                onClick={() => go(firstSite)}
                title="تخطَّ أدوات الأطلس وانتقل إلى صفحات الموقع"
                className="ms-auto flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold text-sky-300 hover:bg-sky-500/10"
              >
                <SkipForward className="w-4 h-4" /> صفحات الموقع
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
