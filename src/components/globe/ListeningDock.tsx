import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Headphones,
  Loader2,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  X,
  ChevronsLeft,
  ChevronsRight,
  WifiOff,
  AlertTriangle,
  Shuffle,
  Sparkles,
  GripHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Network,
  ChevronDown,
  ChevronUp,
  Volume2,
  BookOpen,
} from 'lucide-react';
import { SURAHS_LIST } from '../../data/surahs';
import { getSurahMindMap } from '../../data/mindmaps/mindmapData';
import { RECITERS } from '../../services/quranApi';
import { ListenError, ListenState, surahPlayer } from '../../services/surahPlayer';
import { globalAudio, PLAYBACK_RATES } from '../../services/audioManager';
import { IconButton } from '../ui/kit';
import { MECCAN_HEX, MEDINAN_HEX, shortTitle } from './globeEngine';
import { usePersistentState } from '../../hooks/usePersistentState';

interface Props {
  state: ListenState;
  onShuffle?: () => void;
  onNavigateAyah?: (surahNumber: number, ayahNumber: number) => void;
  onNavigateMehwar?: (surahNumber: number, branchIndex: number) => void;
  onOpenMindMap?: (surahNumber: number) => void;
  onNavigateToMushaf?: (pageNumber: number) => void;
}

const ERROR_TEXT: Record<Exclude<ListenError, null>, { icon: React.ReactNode; text: string }> = {
  offline: { icon: <WifiOff className="w-3.5 h-3.5" />, text: 'لا يوجد اتصال بالإنترنت. التلاوة تحتاج اتصالاً، اضغط تشغيل بعد عودته.' },
  network: { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: 'تعذّر تحميل التلاوة من الخادم. جرّب قارئاً آخر أو اضغط تشغيل لإعادة المحاولة.' },
  blocked: { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: 'منع المتصفح التشغيل التلقائي. اضغط زر التشغيل للبدء.' },
};

export const ListeningDock: React.FC<Props> = ({
  state,
  onShuffle,
  onNavigateAyah,
  onNavigateMehwar,
  onOpenMindMap,
  onNavigateToMushaf,
}) => {
  const [rate, setRate] = useState(() => globalAudio.getRate());
  const [docked, setDocked] = usePersistentState<boolean>('listen-dock-docked', false);
  const [showMahawir, setShowMahawir] = useState(false);
  const [dockTab, setDockTab] = useState<'controls' | 'mahawir' | 'ayat'>('controls');

  // Floating Position & Size state
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== 'undefined' ? Math.max(16, (window.innerWidth - 490) / 2) : 100,
    y: 74,
  }));
  const [width, setWidth] = useState<number>(490);
  const [isNearDockZone, setIsNearDockZone] = useState(false);

  // Dragging refs
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  // Resizing refs
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef<{ mouseX: number; startWidth: number }>({ mouseX: 0, startWidth: 490 });

  const dockContainerRef = useRef<HTMLDivElement>(null);

  // Keep floating window on-screen on resize
  useEffect(() => {
    const handleWindowResize = () => {
      setPos((prev) => {
        const maxX = Math.max(10, window.innerWidth - width - 16);
        const maxY = Math.max(10, window.innerHeight - 180);
        return {
          x: Math.min(Math.max(10, prev.x), maxX),
          y: Math.min(Math.max(10, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [width]);

  // Pointer drag listeners for moving
  const handlePointerDownDrag = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input, a, [role="button"]')) {
      return;
    }
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.mouseX;
      const dy = ev.clientY - dragStartRef.current.mouseY;

      let nextX = dragStartRef.current.startX + dx;
      let nextY = dragStartRef.current.startY + dy;

      const maxX = Math.max(10, window.innerWidth - width - 12);
      const maxY = Math.max(10, window.innerHeight - 120);

      nextX = Math.min(Math.max(10, nextX), maxX);
      nextY = Math.min(Math.max(10, nextY), maxY);

      // Detect if user dragged close to left edge (snap zone)
      if (nextX <= 75) {
        setIsNearDockZone(true);
      } else {
        setIsNearDockZone(false);
      }

      setPos({ x: nextX, y: nextY });
    };

    const handlePointerUp = (ev: PointerEvent) => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        if (ev.clientX <= 110) {
          setDocked(true);
          setIsNearDockZone(false);
        }
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [pos.x, pos.y, width, setDocked]);

  // Resize listener
  const handlePointerDownResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartRef.current = {
      mouseX: e.clientX,
      startWidth: width,
    };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!isResizingRef.current) return;
      // In RTL or LTR handle drag width
      const dx = ev.clientX - resizeStartRef.current.mouseX;
      const nextW = Math.min(Math.max(340, resizeStartRef.current.startWidth - dx), Math.min(window.innerWidth - 32, 680));
      setWidth(nextW);
    };

    const handlePointerUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [width]);

  const surahMeta = state.surah ? SURAHS_LIST[state.surah - 1] : null;
  const mindMap = useMemo(() => (state.surah ? getSurahMindMap(state.surah) : null), [state.surah]);

  if (!state.active || state.surah === null || !surahMeta) return null;

  const accent = surahMeta.revelationType === 'Meccan' ? MECCAN_HEX : MEDINAN_HEX;
  const pct = state.total > 0 ? (state.ayah / state.total) * 100 : 0;

  /* ------------------------------------------------------------------------ */
  /* Docked Left Sidebar Mode                                                */
  /* ------------------------------------------------------------------------ */
  if (docked) {
    return (
      <aside
        role="region"
        data-tour="listen-dock"
        aria-label="مشغّل التلاوة المثبت"
        className="fixed top-0 bottom-0 left-0 z-30 w-84 sm:w-92 flex flex-col bg-slate-950/95 backdrop-blur-2xl border-r shadow-2xl animate-fade-in text-slate-100"
        style={{ borderColor: `${accent}44`, boxShadow: `0 0 35px ${accent}22` }}
        dir="rtl"
      >
        {/* Dock Header */}
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-800/80 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center border"
              style={{ background: `${accent}1f`, borderColor: `${accent}55`, color: accent }}
            >
              <Headphones className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-black tracking-wide text-white">مشغّل أطلس القرآن</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDocked(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              title="فك التثبيت (نافذة عائمة قابلة للتحريك)"
              aria-label="فك التثبيت كعنصر عائم"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
            <IconButton label="إيقاف التلاوة" size="sm" onClick={() => surahPlayer.stop()}>
              <X className="w-4 h-4" />
            </IconButton>
          </div>
        </div>

        {/* Surah Summary Banner */}
        <div className="p-4 border-b border-slate-800/80 bg-gradient-to-b from-slate-900/40 to-transparent shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-amber-300">سورة {surahMeta.name}</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                style={{
                  background: `${accent}18`,
                  borderColor: `${accent}40`,
                  color: accent,
                }}
              >
                {surahMeta.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}
              </span>
            </div>
            <span className="text-xs font-bold text-slate-400 tabular-nums">
              آية {state.ayah} / {state.total}
            </span>
          </div>

          {mindMap?.centralTheme && (
            <p className="mt-1 text-xs text-slate-300 line-clamp-1 leading-relaxed">{mindMap.centralTheme}</p>
          )}

          {/* Progress bar */}
          <div
            className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden cursor-pointer"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={state.total}
            aria-valuenow={state.ayah}
            aria-label="تقدّم السورة"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              // In RTL, right is start
              const targetAyah = Math.max(1, Math.min(state.total, Math.round((1 - ratio) * state.total)));
              if (onNavigateAyah) onNavigateAyah(state.surah!, targetAyah);
              else surahPlayer.startAtAyah(state.surah!, targetAyah);
            }}
          >
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: accent }} />
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="flex items-center border-b border-slate-800/80 px-2 py-1.5 bg-slate-950/60 shrink-0 gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setDockTab('controls')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              dockTab === 'controls' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>التحكم</span>
          </button>
          <button
            type="button"
            onClick={() => setDockTab('mahawir')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              dockTab === 'mahawir' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>المحاور ({mindMap?.branches?.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setDockTab('ayat')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              dockTab === 'ayat' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>الآيات ({state.total})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 custom-scrollbar">
          {state.error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
              <span className="mt-0.5 shrink-0">{ERROR_TEXT[state.error].icon}</span>
              <span>{ERROR_TEXT[state.error].text}</span>
            </div>
          )}

          {dockTab === 'controls' && (
            <div className="space-y-4">
              {/* Playback Controls Box */}
              <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex flex-col items-center gap-3">
                <div className="flex items-center justify-center gap-1 w-full">
                  <IconButton label="السورة السابقة" size="sm" onClick={() => surahPlayer.prevSurah()} disabled={state.surah <= 1}>
                    <ChevronsRight className="w-4 h-4" />
                  </IconButton>
                  <IconButton label="الآية السابقة" size="sm" onClick={() => surahPlayer.prevAyah()}>
                    <SkipForward className="w-4 h-4" />
                  </IconButton>
                  <button
                    type="button"
                    onClick={() => surahPlayer.togglePlay()}
                    aria-label={state.playing ? 'إيقاف مؤقت' : 'تشغيل'}
                    title={state.playing ? 'إيقاف مؤقت' : 'تشغيل'}
                    className="w-11 h-11 mx-2 rounded-full flex items-center justify-center text-slate-950 font-black shadow-xl transition-transform hover:scale-105"
                    style={{ background: accent }}
                  >
                    {state.loading && state.playing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : state.playing ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 translate-x-[-1px]" />
                    )}
                  </button>
                  <IconButton label="الآية التالية" size="sm" onClick={() => surahPlayer.nextAyah()}>
                    <SkipBack className="w-4 h-4" />
                  </IconButton>
                  <IconButton label="السورة التالية" size="sm" onClick={() => surahPlayer.nextSurah()} disabled={state.surah >= 114}>
                    <ChevronsLeft className="w-4 h-4" />
                  </IconButton>
                </div>

                {/* Reciter and Speed Multiplier */}
                <div className="w-full flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 shrink-0">القارئ:</span>
                    <select
                      value={state.reciterId}
                      onChange={(e) => surahPlayer.setReciter(e.target.value)}
                      className="bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1 text-xs font-bold text-amber-200 focus:outline-none focus:border-amber-500 w-full truncate"
                      title="القارئ"
                      aria-label="القارئ"
                    >
                      {RECITERS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.arabicName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const i = PLAYBACK_RATES.findIndex((r) => r === rate);
                      const next = PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length];
                      globalAudio.setRate(next);
                      setRate(next);
                    }}
                    title="سرعة التلاوة"
                    aria-label={`سرعة التلاوة ${rate}`}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-slate-950 text-amber-200 border-slate-700 hover:border-amber-500/50 tabular-nums shrink-0"
                  >
                    {rate}×
                  </button>
                </div>

                {/* Auto-Next Switch */}
                <button
                  type="button"
                  onClick={() => surahPlayer.setAutoNext(!state.autoNext)}
                  aria-pressed={state.autoNext}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    state.autoNext
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-slate-950/70 text-slate-400 border-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5" />
                    <span>الانتقال التلقائي للسورة التالية</span>
                  </span>
                  <span className={`w-2 h-2 rounded-full ${state.autoNext ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-slate-600'}`} />
                </button>
              </div>

              {/* Shuffle Big Button */}
              <button
                type="button"
                onClick={() => {
                  if (onShuffle) onShuffle();
                  else surahPlayer.shuffle();
                }}
                className="w-full group relative overflow-hidden flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-sky-500/20 to-emerald-500/20 hover:from-amber-500/30 hover:via-sky-500/30 hover:to-emerald-500/30 border border-amber-500/40 text-amber-200 hover:text-white font-black text-xs transition-all shadow-lg hover:shadow-amber-500/20 hover:scale-[1.02]"
              >
                <Shuffle className="w-4 h-4 text-amber-300 group-hover:rotate-180 transition-transform duration-500" />
                <span>انتقال عشوائي لكامل الأطلس (سورة • محور • آية)</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              </button>

              {/* Surah Explore Quick Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                {onOpenMindMap && (
                  <button
                    type="button"
                    onClick={() => onOpenMindMap(state.surah!)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-amber-300 hover:border-amber-500/40 transition-colors"
                  >
                    <Network className="w-3.5 h-3.5 text-sky-400" />
                    <span>الخريطة الذهنية</span>
                  </button>
                )}
                {onNavigateToMushaf && surahMeta.startPage && (
                  <button
                    type="button"
                    onClick={() => onNavigateToMushaf(surahMeta.startPage)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-amber-300 hover:border-amber-500/40 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>عرض بالمصحف</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mahawir List Tab */}
          {dockTab === 'mahawir' && mindMap && (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-400 font-semibold px-1">
                اضغط على أي محور للغوص فيه وإضاءة فلك آياته على الكرة:
              </p>
              {mindMap.branches.map((b, bi) => {
                const bCol = b.color || '#3B82F6';
                const isCurrentMehwar = b.ayahRange && state.ayah >= b.ayahRange.start && state.ayah <= b.ayahRange.end;
                return (
                  <button
                    key={b.id || bi}
                    type="button"
                    onClick={() => {
                      if (onNavigateMehwar) {
                        onNavigateMehwar(state.surah!, bi);
                      } else {
                        const startA = b.ayahRange?.start || 1;
                        surahPlayer.startAtAyah(state.surah!, startA);
                      }
                    }}
                    className={`w-full text-right p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                      isCurrentMehwar
                        ? 'bg-amber-500/15 border-amber-500/60 shadow-[0_0_18px_rgba(245,158,11,0.25)]'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full mt-1 shrink-0 shadow-sm"
                      style={{ background: bCol }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-bold ${isCurrentMehwar ? 'text-amber-200' : 'text-slate-200'}`}>
                          {shortTitle(b.title)}
                        </span>
                        {b.ayahRange && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 shrink-0">
                            {b.ayahRange.start}–{b.ayahRange.end}
                          </span>
                        )}
                      </div>
                      {b.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{b.description}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Ayat Quick-Jump Tab */}
          {dockTab === 'ayat' && (
            <div className="grid grid-cols-5 gap-1.5 max-h-[60vh] overflow-y-auto p-1 custom-scrollbar">
              {Array.from({ length: state.total }, (_, idx) => idx + 1).map((a) => {
                const isAct = a === state.ayah;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      if (onNavigateAyah) onNavigateAyah(state.surah!, a);
                      else surahPlayer.startAtAyah(state.surah!, a);
                    }}
                    className={`py-2 rounded-xl text-xs font-black transition-all ${
                      isAct
                        ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 shadow-[0_0_15px_#f59e0b] scale-105 ring-2 ring-amber-400'
                        : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-amber-500/40 hover:text-white'
                    }`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Floating Movable & Resizable Dock Mode                                   */
  /* ------------------------------------------------------------------------ */
  return (
    <>
      {/* Visual Dock Snap Highlight Zone */}
      {isNearDockZone && (
        <div className="fixed top-0 bottom-0 left-0 w-24 z-20 pointer-events-none border-r-2 border-dashed border-amber-400/80 bg-amber-500/10 backdrop-blur-sm animate-pulse flex items-center justify-center">
          <span className="text-[11px] font-black text-amber-300 rotate-90 whitespace-nowrap">
            أفلت للتثبيت بالشريط الجانبي
          </span>
        </div>
      )}

      <div
        ref={dockContainerRef}
        role="region"
        data-tour="listen-dock"
        aria-label="مشغّل التلاوة العائم"
        className="fixed z-20 rounded-2xl bg-slate-950/90 backdrop-blur-xl border shadow-2xl px-3.5 py-2.5 animate-fade-in select-none"
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: `${width}px`,
          maxWidth: 'calc(100vw - 24px)',
          borderColor: `${accent}66`,
          boxShadow: `0 0 32px ${accent}25`,
        }}
        dir="rtl"
      >
        {/* Drag Bar & Top Row */}
        <div
          onPointerDown={handlePointerDownDrag}
          className="flex items-center gap-2 cursor-grab active:cursor-grabbing pb-1.5"
        >
          <span
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border"
            style={{ background: `${accent}1f`, borderColor: `${accent}55`, color: accent }}
          >
            <Headphones className="w-3.5 h-3.5" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <span className="truncate">سورة {surahMeta.name}</span>
              <span className="text-xs font-bold text-slate-400 shrink-0">
                {state.ayah} / {state.total}
              </span>
            </div>
            <div
              className="mt-1 h-1 rounded-full bg-slate-800 overflow-hidden cursor-pointer"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={state.total}
              aria-valuenow={state.ayah}
              aria-label="تقدّم السورة"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                const targetAyah = Math.max(1, Math.min(state.total, Math.round((1 - ratio) * state.total)));
                if (onNavigateAyah) onNavigateAyah(state.surah!, targetAyah);
                else surahPlayer.startAtAyah(state.surah!, targetAyah);
              }}
            >
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: accent }} />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowMahawir((prev) => !prev)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              title={showMahawir ? 'إخفاء المحاور' : 'عرض محاور السورة'}
              aria-label="عرض محاور السورة"
            >
              {showMahawir ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setDocked(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              title="تثبيت كشريط جانبي (مثل VS Code)"
              aria-label="تثبيت كشريط جانبي"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <IconButton label="إيقاف الاستماع" size="sm" onClick={() => surahPlayer.stop()}>
              <X className="w-4 h-4" />
            </IconButton>
          </div>
        </div>

        {state.error && (
          <div role="alert" className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
            <span className="mt-0.5 shrink-0">{ERROR_TEXT[state.error].icon}</span>
            <span>{ERROR_TEXT[state.error].text}</span>
          </div>
        )}

        {/* Playback Controls Row */}
        <div className="mt-2 flex items-center justify-between gap-1.5 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-0.5">
            <IconButton label="السورة السابقة" size="sm" onClick={() => surahPlayer.prevSurah()} disabled={state.surah <= 1}>
              <ChevronsRight className="w-4 h-4" />
            </IconButton>
            <IconButton label="الآية السابقة" size="sm" onClick={() => surahPlayer.prevAyah()}>
              <SkipForward className="w-4 h-4" />
            </IconButton>
            <button
              type="button"
              onClick={() => surahPlayer.togglePlay()}
              aria-label={state.playing ? 'إيقاف مؤقت' : 'تشغيل'}
              title={state.playing ? 'إيقاف مؤقت' : 'تشغيل'}
              className="w-9 h-9 mx-1 rounded-full flex items-center justify-center text-slate-950 font-black shadow-lg transition-transform hover:scale-105"
              style={{ background: accent }}
            >
              {state.loading && state.playing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : state.playing ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 translate-x-[-1px]" />
              )}
            </button>
            <IconButton label="الآية التالية" size="sm" onClick={() => surahPlayer.nextAyah()}>
              <SkipBack className="w-4 h-4" />
            </IconButton>
            <IconButton label="السورة التالية" size="sm" onClick={() => surahPlayer.nextSurah()} disabled={state.surah >= 114}>
              <ChevronsLeft className="w-4 h-4" />
            </IconButton>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            {/* Shuffle Button */}
            <button
              type="button"
              onClick={() => {
                if (onShuffle) onShuffle();
                else surahPlayer.shuffle();
              }}
              title="انتقال عشوائي لكامل الأطلس (سورة • محور • آية)"
              aria-label="استماع عشوائي"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-emerald-500/15 text-amber-200 hover:text-white hover:border-amber-400 transition-all hover:scale-105"
            >
              <Shuffle className="w-3 h-3 text-amber-300" />
              <span className="hidden sm:inline">عشوائي</span>
            </button>

            <button
              type="button"
              onClick={() => surahPlayer.setAutoNext(!state.autoNext)}
              aria-pressed={state.autoNext}
              title={state.autoNext ? 'الانتقال التلقائي للسورة التالية: مفعّل' : 'الانتقال التلقائي للسورة التالية: متوقف'}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${
                state.autoNext
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
            >
              <Repeat className="w-3 h-3" />
              <span className="hidden md:inline">تلقائي</span>
            </button>

            <select
              value={state.reciterId}
              onChange={(e) => surahPlayer.setReciter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 text-xs font-bold text-amber-200 focus:outline-none focus:border-amber-500 max-w-[6.8rem] truncate"
              title="القارئ"
              aria-label="القارئ"
            >
              {RECITERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.arabicName}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                const i = PLAYBACK_RATES.findIndex((r) => r === rate);
                const next = PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length];
                globalAudio.setRate(next);
                setRate(next);
              }}
              title="سرعة التلاوة"
              aria-label={`سرعة التلاوة ${rate}`}
              className="px-2 py-1 rounded-lg text-xs font-bold border bg-slate-900 text-amber-200 border-slate-700 hover:border-amber-500/50 tabular-nums shrink-0"
            >
              {rate}×
            </button>
          </div>
        </div>

        {/* Collapsible Mahawir quick list */}
        {showMahawir && mindMap?.branches && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold px-1">
              <span>محاور سورة {surahMeta.name}:</span>
              <span>اضغط للدخول المباشر</span>
            </div>
            {mindMap.branches.map((b, bi) => {
              const isCurrentMehwar = b.ayahRange && state.ayah >= b.ayahRange.start && state.ayah <= b.ayahRange.end;
              return (
                <button
                  key={b.id || bi}
                  type="button"
                  onClick={() => {
                    if (onNavigateMehwar) onNavigateMehwar(state.surah!, bi);
                    else {
                      const startA = b.ayahRange?.start || 1;
                      surahPlayer.startAtAyah(state.surah!, startA);
                    }
                  }}
                  className={`w-full text-right p-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-between gap-2 ${
                    isCurrentMehwar
                      ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
                      : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color || '#3B82F6' }} />
                    <span className="truncate">{shortTitle(b.title)}</span>
                  </span>
                  {b.ayahRange && (
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {b.ayahRange.start}–{b.ayahRange.end}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Resize Handle on bottom edge */}
        <div
          onPointerDown={handlePointerDownResize}
          className="absolute -bottom-1 left-2 right-2 h-2 cursor-ew-resize flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
          title="اسحب لتغيير العرض"
        >
          <GripHorizontal className="w-4 h-2 text-slate-400" />
        </div>
      </div>
    </>
  );
};
