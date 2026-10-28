import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SURAHS_LIST } from '../../data/surahs';
import { getSurahMindMap } from '../../data/mindmaps/mindmapData';
import { soundEffects } from '../../services/soundEffects';
import { getCachedAyah, fetchSurahAllAyahs } from '../../services/quranApi';
import { ListenState, surahPlayer } from '../../services/surahPlayer';
import { hideSplash } from '../../splash';
import { globeBridge } from '../../services/globeBridge';
import { SurahComparePanel } from './SurahComparePanel';
import {
  GlobeEngine,
  GlobeLevel,
  GlobeMode,
  RevelationFilter,
  SurahHoverItem,
  shortTitle,
  MECCAN_HEX,
  MEDINAN_HEX,
} from './globeEngine';
import { QuizScope } from '../../types';
import { tourBus, GlobeState } from '../../services/tourBus';
import { ActionButton, Chip, Segmented } from '../ui/kit';
import { FirstRunHint } from '../ui/FirstRunHint';
import { usePersistentState } from '../../hooks/usePersistentState';
import {
  ArrowRight,
  Brain,
  BookOpen,
  Search,
  Orbit,
  Layers,
  Dot,
  RotateCcw,
  Network,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Compass,
  Target,
  Headphones,
  SlidersHorizontal,
  GitCompare,
  Play,
} from 'lucide-react';

interface QuranGlobeProps {
  onOpenAyah: (surahNumber: number, ayah: number) => void;
  onOpenMindMap: (surahNumber: number) => void;
  onNavigateToMushaf: (pageNumber: number) => void;
  onStartQuiz: (scope: QuizScope) => void;
  /** Whether the camera follows the recited ayah (owned by App so the always-present dock can toggle it). */
  followCamera: boolean;
  /** Starts the guided tour (adds a button to the dock and to the first-run tips). */
  onStartTour?: () => void;
  /** True while the guided tour is running (hides the first-run tips). */
  touring?: boolean;
}

const LEVELS: { id: GlobeLevel; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'surahs', label: 'السور', hint: '114 سورة', icon: <Orbit className="w-3.5 h-3.5" /> },
  { id: 'sections', label: 'المحاور', hint: 'أقسام وموضوعات كل سورة', icon: <Network className="w-3.5 h-3.5" /> },
  { id: 'ayat', label: 'الآيات', hint: 'توزيع الآيات ونصوصها', icon: <Dot className="w-4 h-4" /> },
];

export const QuranGlobe: React.FC<QuranGlobeProps> = ({ onOpenAyah, onOpenMindMap, onNavigateToMushaf, onStartQuiz, onStartTour, touring, followCamera }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GlobeEngine | null>(null);
  const cbRef = useRef<{ onOpenAyah: QuranGlobeProps['onOpenAyah']; onPickSurah: (n: number) => void }>({
    onOpenAyah,
    onPickSurah: () => {},
  });
  cbRef.current.onOpenAyah = onOpenAyah;

  const [level, setLevel] = usePersistentState<GlobeLevel>('globe-level', 'surahs', (v) => v === 'surahs' || v === 'sections' || v === 'ayat');
  const [filter, setFilter] = usePersistentState<RevelationFilter>('globe-filter', 'all', (v) => v === 'all' || v === 'Meccan' || v === 'Medinan');
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [mode, setMode] = useState<GlobeMode>('globe');
  const [activeSurah, setActiveSurah] = useState<number | null>(null);
  const [activeBranchIndex, setActiveBranchIndex] = useState<number | null>(null);
  const [hoverSurah, setHoverSurah] = useState<number | null>(null);
  const [hoverItem, setHoverItem] = useState<SurahHoverItem | null>(null);
  const [query, setQuery] = useState('');
  const [webglFailed, setWebglFailed] = useState(false);
  const [soundMuted, setSoundMuted] = useState(soundEffects.getMuted());
  const [resolvedAyahText, setResolvedAyahText] = useState<string | null>(null);

  // listening + compare tools
  const [listen, setListen] = useState<ListenState>(surahPlayer.getState());
  const [compareOpen, setCompareOpen] = useState(false);
  const [cmpA, setCmpA] = useState<number | null>(null);
  const [cmpB, setCmpB] = useState<number | null>(null);

  // Clicking a surah on the globe while comparing fills the slots (newest replaces the oldest).
  cbRef.current.onPickSurah = (n: number) => {
    if (n === cmpA || n === cmpB) return;
    if (cmpA === null) setCmpA(n);
    else if (cmpB === null) setCmpB(n);
    else {
      setCmpA(cmpB);
      setCmpB(n);
    }
  };

  // Guided tour: where the tour wants the camera (null when no tour is steering) and where the engine is now.
  const wantRef = useRef<GlobeState['place'] | null>(null);
  const curRef = useRef<{ surah: number | null; branch: number | null }>({ surah: null, branch: null });
  const viewRef = useRef({ level, filter });
  viewRef.current = { level, filter };

  /** Takes the next single step toward `wantRef` (enter / leave one level); called again after each camera flight. */
  const pump = () => {
    const eng = engineRef.current;
    const want = wantRef.current;
    if (!eng || !want) return;
    const m = eng.getMode();
    const cur = curRef.current;
    // Once the target is reached the tour lets go, so the user's own clicks are never fought.
    if (m === 'globe') {
      if (want.surah !== null) eng.enterSurah(want.surah);
      else wantRef.current = null;
    } else if (m === 'surah') {
      if (want.surah !== cur.surah) eng.leaveSurah();
      else if (want.section !== undefined) eng.enterSection(want.section);
      else wantRef.current = null;
    } else if (m === 'section') {
      if (want.surah !== cur.surah || want.section === undefined) eng.leaveSection();
      else if (want.section !== cur.branch) eng.enterSection(want.section);
      else wantRef.current = null;
    }
  };
  const pumpRef = useRef(pump);
  pumpRef.current = pump;

  useEffect(() => {
    if (!hostRef.current) return;
    let engine: GlobeEngine;
    try {
      engine = new GlobeEngine(hostRef.current, {
        onHoverSurah: setHoverSurah,
        onHoverItem: setHoverItem,
        onModeChange: (m, s, b) => {
          setMode(m);
          if (m === 'globe') curRef.current = { surah: null, branch: null };
          else if (m === 'surah') curRef.current = { surah: s, branch: null };
          else if (m === 'section') curRef.current = { surah: s, branch: b ?? 0 };
          if (wantRef.current) setTimeout(() => pumpRef.current(), 60);
          if (m === 'entering' || m === 'surah' || m === 'section' || m === 'entering_section') {
            setActiveSurah(s);
          }
          if (m === 'section' || m === 'entering_section') {
            setActiveBranchIndex(b ?? 0);
          } else if (m === 'surah') {
            setActiveBranchIndex(null);
          } else if (m === 'globe') {
            setActiveSurah(null);
            setActiveBranchIndex(null);
          }
        },
        onClickAyah: (s, a) => cbRef.current.onOpenAyah(s, a),
        onPickSurah: (n) => cbRef.current.onPickSurah(n),
      });
    } catch (e) {
      console.error('WebGL init failed', e);
      setWebglFailed(true);
      hideSplash();
      return;
    }
    engineRef.current = engine;
    // Drop the loading veil after the first painted frame (level/filter are applied by the effects below).
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setEngineReady(true);
        hideSplash();
      })
    );
    return () => {
      cancelAnimationFrame(raf);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => engineRef.current?.setLevel(level), [level]);
  useEffect(() => engineRef.current?.setFilter(filter), [filter]);
  useEffect(() => engineRef.current?.setFollowCamera(followCamera), [followCamera]);

  // Listening mode: mirror the player into React state and drive the node pulse.
  useEffect(() => {
    const s0 = surahPlayer.getState();
    engineRef.current?.setListening(s0.active ? s0.surah : null, s0.playing, s0.ayah);
    const unsub = surahPlayer.subscribe((s, event) => {
      setListen(s);
      const eng = engineRef.current;
      if (!eng) return;
      eng.setListening(s.active ? s.surah : null, s.playing, s.ayah);
      if ((event === 'ayah' || event === 'surah') && s.playing) eng.pulseListening();
    });
    return () => {
      unsub();
      engineRef.current?.setListening(null, false);
    };
  }, []);

  const handleShuffle = () => {
    const pick = surahPlayer.shuffle();
    engineRef.current?.navigateDeepToAyah(pick.surah, pick.branchIndex, pick.ayah);
  };

  const handleNavigateAyah = (surahNumber: number, ayahNumber: number) => {
    const map = getSurahMindMap(surahNumber);
    let branchIndex = 0;
    if (map.branches) {
      for (let i = 0; i < map.branches.length; i++) {
        const r = map.branches[i].ayahRange;
        if (r && ayahNumber >= r.start && ayahNumber <= r.end) {
          branchIndex = i;
          break;
        }
      }
    }
    surahPlayer.startAtAyah(surahNumber, ayahNumber);
    engineRef.current?.navigateDeepToAyah(surahNumber, branchIndex, ayahNumber);
  };

  const handleNavigateMehwar = (surahNumber: number, branchIndex: number) => {
    const map = getSurahMindMap(surahNumber);
    const b = map.branches[branchIndex];
    const ayah = b?.ayahRange?.start || 1;
    surahPlayer.startAtAyah(surahNumber, ayah);
    engineRef.current?.navigateDeepToAyah(surahNumber, branchIndex, ayah);
  };

  // Expose the globe-aware actions to the app-level dock while the globe is open.
  const handlersRef = useRef({ handleShuffle, handleNavigateAyah, handleNavigateMehwar });
  handlersRef.current = { handleShuffle, handleNavigateAyah, handleNavigateMehwar };
  useEffect(
    () =>
      globeBridge.register({
        shuffle: () => handlersRef.current.handleShuffle(),
        navigateAyah: (s, a) => handlersRef.current.handleNavigateAyah(s, a),
        navigateMehwar: (s, b) => handlersRef.current.handleNavigateMehwar(s, b),
      }),
    []
  );

  // Compare mode: picking, rings and arc on the globe.
  useEffect(() => {
    engineRef.current?.setPickMode(compareOpen);
    engineRef.current?.setCompare(compareOpen ? cmpA : null, compareOpen ? cmpB : null);
  }, [compareOpen, cmpA, cmpB]);

  // Guided tour: each step describes the whole globe screen; "restore" gives the user their own settings back.
  useEffect(
    () =>
      tourBus.subscribe((cmd) => {
        const eng = engineRef.current;
        if (cmd.type === 'restore') {
          eng?.previewSurah(null);
          setQuery('');
          setViewMenuOpen(false);
          setCompareOpen(false);
          setCmpA(null);
          setCmpB(null);
          if (surahPlayer.getState().active) surahPlayer.stop();
          if (tourBus.saved) {
            setLevel(tourBus.saved.level);
            setFilter(tourBus.saved.filter);
            tourBus.saved = null;
          }
          wantRef.current = { surah: null };
          pumpRef.current();
          return;
        }
        const s = cmd.s;
        if (!tourBus.saved) tourBus.saved = { ...viewRef.current };
        setLevel(s.view.level);
        setFilter(s.view.filter);
        setViewMenuOpen(s.view.menu);
        setQuery(s.search);
        setCompareOpen(!!s.compare);
        setCmpA(s.compare?.a ?? null);
        setCmpB(s.compare?.b ?? null);
        eng?.previewSurah(s.place.surah === null ? s.preview : null);
        const st = surahPlayer.getState();
        if (s.listen !== null) {
          if (!(st.active && st.surah === s.listen)) surahPlayer.start(s.listen);
        } else if (st.active) surahPlayer.stop();
        wantRef.current = s.place;
        pumpRef.current();
      }),
    []
  );

  // Synchronously or asynchronously resolve ayah text when an ayah is hovered
  useEffect(() => {
    if (hoverItem?.kind === 'ayah' && hoverItem.ayah) {
      if (hoverItem.ayahText) {
        setResolvedAyahText(hoverItem.ayahText);
      } else {
        const cached = getCachedAyah(hoverItem.surahNumber, hoverItem.ayah);
        if (cached?.textUthmani) {
          setResolvedAyahText(cached.textUthmani);
        } else {
          fetchSurahAllAyahs(hoverItem.surahNumber)
            .then((ayahs) => {
              const found = ayahs.find((a) => a.numberInSurah === hoverItem.ayah);
              if (found) setResolvedAyahText(found.textUthmani);
            })
            .catch(() => {});
        }
      }
    } else {
      setResolvedAyahText(null);
    }
  }, [hoverItem]);

  const toggleSound = () => {
    const muted = soundEffects.toggleMute();
    setSoundMuted(muted);
  };

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return SURAHS_LIST.filter(
      (s) =>
        s.name.includes(q) ||
        s.transliteration.toLowerCase().includes(q.toLowerCase()) ||
        s.number.toString() === q ||
        (s.mainTheme && s.mainTheme.includes(q))
    ).slice(0, 7);
  }, [query]);

  const inSurah = mode === 'surah' || mode === 'entering';
  const inSection = mode === 'section' || mode === 'entering_section';
  const activeMeta = activeSurah ? SURAHS_LIST[activeSurah - 1] : null;
  const activeMap = activeSurah ? getSurahMindMap(activeSurah) : null;
  const activeBranch = activeMap && activeBranchIndex !== null ? activeMap.branches[activeBranchIndex] : null;

  const hoverMeta = hoverSurah ? SURAHS_LIST[hoverSurah - 1] : null;
  const hoverMap = hoverSurah ? getSurahMindMap(hoverSurah) : null;

  const glass = 'glass-panel';

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      dir="rtl"
      style={{ background: 'radial-gradient(ellipse at 50% 45%, #0e1630 0%, #060a18 55%, #02040b 100%)' }}
    >
      <div ref={hostRef} className="absolute inset-0" />

      {!engineReady && !webglFailed && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 text-slate-300" role="status" aria-live="polite">
          <div className="w-16 h-16 rounded-full border-2 border-amber-500/40 border-t-amber-400 animate-spin" aria-hidden />
          <p className="text-sm animate-shimmer">جاري تجهيز الأطلس…</p>
        </div>
      )}

      {engineReady && !inSurah && !inSection && !touring && <FirstRunHint onStartTour={onStartTour} />}

      {webglFailed && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm p-8 text-center">
          تعذّر تشغيل العرض ثلاثي الأبعاد على هذا المتصفح (WebGL غير متاح).
        </div>
      )}

      {/* ---------------- top bar ---------------- */}
      <div className="absolute top-3 left-3 right-16 flex items-start justify-between gap-3 pointer-events-none z-10">
        <div className={`${glass} rounded-2xl px-4 py-2.5 pointer-events-auto flex items-center gap-3`}>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-amber-300 leading-tight">أطلس القرآن الكريم</h1>
              {inSection && activeMeta && activeBranch && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30">
                  فلك آيات المحور
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {inSection && activeMeta && activeBranch
                ? `سورة ${activeMeta.name} · ${shortTitle(activeBranch.title)} (${activeBranch.ayahRange?.start}–${activeBranch.ayahRange?.end}) · الآيات معروضة ومقروءة ثلاثياً`
                : inSurah && activeMeta
                ? `داخل سورة ${activeMeta.name} · اضغط على أي محور لدخول فلك آياته`
                : 'اسبح بين السور والآيات · مرّر للمعاينة · اضغط للدخول'}
            </p>
          </div>
        </div>

        {/* search & sound toggle */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            data-tour="sound"
            onClick={toggleSound}
            aria-label={soundMuted ? 'تفعيل أصوات الرياح والتنقل' : 'كتم أصوات الرياح'}
            aria-pressed={!soundMuted}
            title={soundMuted ? 'تفعيل أصوات الرياح والتنقل' : 'كتم أصوات الرياح'}
            className={`${glass} rounded-2xl p-2.5 text-slate-300 hover:text-amber-300 hover:bg-slate-900/90 transition-all flex items-center justify-center`}
          >
            {soundMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />}
          </button>

          <div data-tour="search" className="relative w-48 sm:w-72">
            <div className={`${glass} rounded-2xl flex items-center gap-2 px-3 py-2`}>
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                aria-label="ابحث عن سورة"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث عن سورة…"
                disabled={inSurah || inSection}
                className="bg-transparent outline-none text-xs text-slate-100 placeholder-slate-500 w-full disabled:opacity-40"
              />
            </div>
            {results.length > 0 && (
              <div className={`${glass} absolute mt-1.5 w-full rounded-2xl overflow-hidden z-20`}>
                {results.map((s) => (
                  <div key={s.number} className="flex items-center hover:bg-amber-500/10 transition-colors">
                    <button
                      onClick={() => {
                        setQuery('');
                        if (compareOpen) cbRef.current.onPickSurah(s.number);
                        else engineRef.current?.enterSurah(s.number);
                      }}
                      className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 text-right"
                    >
                      <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0">
                        {s.number}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-slate-100">سورة {s.name}</span>
                        <span className="block text-xs text-slate-400 truncate">{s.mainTheme}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setQuery('');
                        surahPlayer.start(s.number);
                      }}
                      title={`استمع لسورة ${s.name}`}
                      aria-label={`استمع لسورة ${s.name}`}
                      className="p-2 ml-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 shrink-0"
                    >
                      <Headphones className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- bottom dock (outer level only): 3 tools + one "view" menu ---------------- */}
      {!inSurah && !inSection && (
        <div className="absolute bottom-4 inset-x-0 flex flex-col items-center gap-2 px-3 z-10 pointer-events-none">
          <div className="relative flex items-center justify-center gap-2 pointer-events-auto">
            <ActionButton
              data-tour="dock-listen"
              tone="sky"
              on={listen.active}
              onClick={() => (listen.active ? surahPlayer.stop() : surahPlayer.start(1))}
              title="استمع من الفاتحة: تُضيء السورة مع التلاوة وينتقل الاستماع للتي تليها (ولبدء سورة أخرى استخدم البحث أو سماعة الرأس داخل السورة)"
              icon={listen.active ? <Headphones className="w-4 h-4 animate-pulse" /> : <Play className="w-4 h-4" />}
              className={glass}
            >
              <span className="hidden sm:inline">{listen.active ? 'إنهاء الاستماع' : 'استماع'}</span>
              <span className="sm:hidden">{listen.active ? 'إنهاء' : 'استماع'}</span>
            </ActionButton>

            <ActionButton
              tone="violet"
              on={compareOpen}
              onClick={() => setCompareOpen((v) => !v)}
              title="قارن بين سورتين: النوع والطول وترتيب النزول والمحاور المشتركة"
              icon={<GitCompare className="w-4 h-4" />}
              className={glass}
            >
              {compareOpen ? 'إغلاق المقارنة' : 'مقارنة'}
            </ActionButton>

            <ActionButton
              data-tour="dock-quiz"
              tone="emerald"
              onClick={() => onStartQuiz({ label: 'القرآن الكريم كاملاً' })}
              title="اختبر نفسك في القرآن كاملاً"
              icon={<Target className="w-4 h-4" />}
              className={glass}
            >
              اختبار
            </ActionButton>

            {onStartTour && (
              <ActionButton
                tone="slate"
                onClick={onStartTour}
                aria-label="ابدأ الجولة التعريفية"
                title="جولة تعريفية تشرح كل أدوات الأطلس وصفحات الموقع"
                icon={<Compass className="w-4 h-4" />}
                className={glass}
              >
                <span className="hidden sm:inline">جولة</span>
              </ActionButton>
            )}

            <span className="w-px h-6 bg-slate-700/70" aria-hidden />

            <ActionButton
              data-tour="dock-view"
              tone="amber"
              on={viewMenuOpen}
              onClick={() => setViewMenuOpen((v) => !v)}
              aria-expanded={viewMenuOpen}
              aria-haspopup="dialog"
              title="طريقة العرض والتصفية"
              icon={<SlidersHorizontal className="w-4 h-4" />}
              className={glass}
            >
              {LEVELS.find((l) => l.id === level)?.label}
              {filter !== 'all' && <span className="text-slate-300"> · {filter === 'Meccan' ? 'مكية' : 'مدنية'}</span>}
            </ActionButton>

            {viewMenuOpen && (
              <>
                {/* tap-away layer (also dims the globe behind the mobile sheet) */}
                <div className="fixed inset-0 z-10 bg-slate-950/40 sm:bg-transparent" onClick={() => setViewMenuOpen(false)} aria-hidden />
                <div
                  role="dialog"
                  data-tour="view-menu"
                  aria-label="طريقة العرض والتصفية"
                  className="glass-panel-strong z-20 fixed inset-x-0 bottom-0 rounded-t-3xl p-4 pb-6 animate-sheet-up sm:absolute sm:inset-x-auto sm:bottom-full sm:mb-2 sm:right-0 sm:w-80 sm:rounded-2xl sm:pb-4"
                >
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-600 sm:hidden" aria-hidden />
                  <div className="mb-1.5 text-xs font-bold text-slate-400">مستوى العرض</div>
                  <Segmented<GlobeLevel>
                    label="مستوى العرض"
                    value={level}
                    onChange={setLevel}
                    options={LEVELS.map((l) => ({ id: l.id, label: l.label, icon: l.icon, hint: l.hint }))}
                  />
                  <p className="mt-1.5 text-xs text-slate-400">{LEVELS.find((l) => l.id === level)?.hint}</p>

                  <div className="mt-4 mb-1.5 text-xs font-bold text-slate-400">تصفية حسب نوع السورة</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip color={MECCAN_HEX} on={filter === 'Meccan'} onClick={() => setFilter(filter === 'Meccan' ? 'all' : 'Meccan')}>
                      مكية
                    </Chip>
                    <Chip color={MEDINAN_HEX} on={filter === 'Medinan'} onClick={() => setFilter(filter === 'Medinan' ? 'all' : 'Medinan')}>
                      مدنية
                    </Chip>
                    {filter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setFilter('all')}
                        className="text-xs text-amber-300 underline underline-offset-2 hover:text-amber-200"
                      >
                        إظهار الكل
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">اضغط على اللون لإبراز نوع واحد، واضغط مرة أخرى لإلغاء التصفية.</p>
                </div>
              </>
            )}
          </div>
          <p className="hidden sm:block text-xs text-slate-400 pointer-events-none drop-shadow">
            {compareOpen
              ? 'وضع المقارنة: اضغط على سورتين في الكرة لمقارنتهما · أغلق المقارنة للعودة إلى الدخول في السور'
              : level === 'ayat'
              ? 'نمط الآيات: مرّر على السورة والآيات المنبثقة حولها لتكبيرها وقراءتها · اضغط للدخول'
              : 'اسحب للتدوير · العجلة للتقريب · اضغط على أي سورة للدخول إليها واستكشاف محاورها وآياتها'}
          </p>
        </div>
      )}

      {/* ---------------- compare panel (outer globe only) ---------------- */}
      {compareOpen && !inSurah && !inSection && (
        <SurahComparePanel
          a={cmpA}
          b={cmpB}
          onChange={(a, b) => {
            setCmpA(a);
            setCmpB(b);
          }}
          onClose={() => setCompareOpen(false)}
        />
      )}

      {/* ---------------- surah & ayah hover card (globe) ---------------- */}
      {!inSurah && !inSection && hoverMeta && hoverMap && (
        <div
          data-tour="hover-card"
          className={`${glass} absolute top-20 right-3 w-72 sm:w-80 rounded-2xl p-4 z-10 pointer-events-none animate-fade-in border-amber-500/30`}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-800">
            <span className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black flex items-center justify-center text-sm shadow-inner">
              {hoverMeta.number}
            </span>
            <div className="min-w-0">
              <div className="text-base font-black text-white flex items-center gap-2">
                <span>سورة {hoverMeta.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-normal">
                  {hoverMeta.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                {hoverMeta.totalVerses} آية · الجزء {hoverMeta.juz.join('، ')}
              </div>
            </div>
          </div>

          {/* If specific Ayah is hovered */}
          {hoverItem?.kind === 'ayah' && hoverItem.ayah ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>الآية {hoverItem.ayah}</span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {hoverItem.subtitle || 'من آيات السورة'}
                </span>
              </div>

              {resolvedAyahText ? (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-100 text-sm leading-relaxed font-amiri text-center shadow-inner">
                  {resolvedAyahText}
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-slate-900/60 text-slate-400 text-xs text-center animate-pulse">
                  جاري جلب نص الآية...
                </div>
              )}

              <div className="text-xs text-emerald-400 font-medium text-center">اضغط على الآية للاستماع والتفسير المفصل</div>
            </div>
          ) : level === 'ayat' ? (
            /* Hovering surah in Ayat Mode */
            <div className="mt-3 space-y-2">
              <div className="text-xs text-amber-200/90 leading-relaxed font-medium">{hoverMap.centralTheme}</div>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-center gap-2">
                <Dot className="w-4 h-4 text-amber-400 shrink-0" />
                <span>الآيات منبثقة حول السورة: مرّر الفأرة فوق أي دائرة آية لمعاينة نصها وتكبيرها.</span>
              </div>
              <div className="text-xs text-slate-400 pt-1">اضغط للدخول إلى كامل السورة ومحاورها</div>
            </div>
          ) : (
            /* Topics / Sections view */
            <div className="mt-3 space-y-2">
              <p className="text-xs text-amber-200/90 leading-relaxed">{hoverMap.centralTheme}</p>
              <div className="space-y-1 pt-1 max-h-40 overflow-y-auto">
                {hoverMap.branches.map((b) => {
                  const isBranchHovered = hoverItem?.kind === 'branch' && hoverItem.title === shortTitle(b.title);
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center gap-2 p-1 rounded-lg text-xs transition-all ${
                        isBranchHovered ? 'bg-amber-500/20 text-amber-200 font-bold' : 'text-slate-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color }} />
                      <span className="truncate">{shortTitle(b.title)}</span>
                      {b.ayahRange && <span className="text-xs text-slate-400 mr-auto">({b.ayahRange.start}-{b.ayahRange.end})</span>}
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-slate-400 pt-1">اضغط للدخول إلى السورة</div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- inside a Surah (Themes/Branches View) ---------------- */}
      {inSurah && activeMeta && activeMap && (
        <>
          <div className="absolute top-20 right-3 flex flex-col gap-2 z-10 max-h-[calc(100%-9rem)]">
            <button
              onClick={() => engineRef.current?.leaveSurah()}
              disabled={mode !== 'surah'}
              className={`${glass} rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs font-bold text-amber-300 hover:bg-slate-900/90 transition-colors disabled:opacity-50 self-start`}
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة إلى الكرة</span>
            </button>

            <div data-tour="surah-panel" className={`${glass} rounded-2xl p-3 w-64 overflow-y-auto`}>
              <div className="text-xs font-bold text-amber-300 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> محاور السورة</span>
                <span className="text-xs text-slate-400">اضغط لدخول فلك الآيات</span>
              </div>
              <div className="space-y-1.5">
                {activeMap.branches.map((b, i) => (
                  <button
                    key={b.id}
                    onClick={() => engineRef.current?.enterSection(i)}
                    className="w-full text-right flex items-start gap-2 p-2 rounded-xl hover:bg-amber-500/15 border border-transparent hover:border-amber-500/30 transition-all group"
                  >
                    <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 group-hover:scale-125 transition-transform" style={{ background: b.color }} />
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-100 leading-snug group-hover:text-amber-200">{shortTitle(b.title)}</span>
                      {b.ayahRange && (
                        <span className="block text-xs text-slate-400 group-hover:text-slate-300">
                          الآيات {b.ayahRange.start}–{b.ayahRange.end} · استكشاف ثلاثي
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 inset-x-0 flex justify-center px-3 z-10 pointer-events-none">
            <div data-tour="surah-tools" className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
              <button
                onClick={() => engineRef.current?.resetSurahView()}
                className={`${glass} rounded-2xl px-3 py-2 flex items-center gap-1.5 text-xs font-bold text-slate-200 hover:bg-slate-900/90`}
              >
                <RotateCcw className="w-3.5 h-3.5" /> إعادة التوسيط
              </button>
              <button
                onClick={() => onOpenMindMap(activeMeta.number)}
                className={`${glass} rounded-2xl px-3 py-2 flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:bg-slate-900/90`}
              >
                <Brain className="w-3.5 h-3.5" /> الخريطة التفصيلية
              </button>
              <button
                onClick={() => onNavigateToMushaf(activeMeta.startPage)}
                className={`${glass} rounded-2xl px-3 py-2 flex items-center gap-1.5 text-xs font-bold text-slate-200 hover:bg-slate-900/90`}
              >
                <BookOpen className="w-3.5 h-3.5" /> المصحف
              </button>
              <button
                onClick={() => surahPlayer.start(activeMeta.number)}
                className={`${glass} rounded-2xl px-3 py-2 flex items-center gap-1.5 text-xs font-bold text-sky-300 hover:bg-slate-900/90 hover:text-sky-200`}
              >
                <Headphones className="w-3.5 h-3.5" /> استمع للسورة
              </button>
              {/* Quiz button — scoped to this surah */}
              <button
                onClick={() => onStartQuiz({ label: `سورة ${activeMeta.name}`, surahNumber: activeMeta.number })}
                className={`${glass} rounded-2xl px-3 py-2 flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:bg-slate-900/90 hover:text-emerald-200 transition-all`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>اختبر نفسك في سورة {activeMeta.name}</span>
              </button>
            </div>
          </div>

          {/* Hover popup inside surah */}
          {hoverItem && mode === 'surah' && !touring && (
            <div
              className={`${glass} absolute bottom-20 left-1/2 -translate-x-1/2 max-w-md w-[92%] rounded-2xl px-4 py-3 z-10 pointer-events-none animate-fade-in border`}
              style={{ borderColor: hoverItem.color || '#f5b942' }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: hoverItem.color }} />
                <span className="text-sm font-black text-white">{hoverItem.title}</span>
                {hoverItem.kind === 'branch' ? (
                  <span className="text-xs text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full mr-auto">
                    اضغط لدخول فلك آيات المحور
                  </span>
                ) : hoverItem.kind === 'ayah' ? (
                  <span className="text-xs text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full mr-auto">
                    اضغط للقراءة والاستماع
                  </span>
                ) : null}
              </div>

              {hoverItem.kind === 'ayah' && resolvedAyahText && (
                <div className="mt-2 p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-amber-100 text-sm font-amiri leading-relaxed text-center">
                  {resolvedAyahText}
                </div>
              )}

              {hoverItem.subtitle && (
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">{hoverItem.subtitle}</p>
              )}
            </div>
          )}
        </>
      )}

      {/* ---------------- Inside Section / Ayah Constellation Sphere ---------------- */}
      {inSection && activeMeta && activeMap && activeBranch && (
        <>
          <div className="absolute top-20 right-3 flex flex-col gap-2 z-10 max-h-[calc(100%-9rem)]">
            <button
              onClick={() => engineRef.current?.leaveSection()}
              className={`${glass} rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs font-bold text-amber-300 hover:bg-slate-900/90 transition-colors self-start shadow-lg`}
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة لمحاور السورة</span>
            </button>

            {/* Topic Switcher Bar */}
            <div data-tour="section-panel" className={`${glass} rounded-2xl p-3 w-64 overflow-y-auto`}>
              <div className="text-xs font-bold text-amber-300 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Compass className="w-3.5 h-3.5" /> فلك الآيات</span>
                <span className="text-xs text-slate-400">
                  {activeBranch.ayahRange?.start}–{activeBranch.ayahRange?.end}
                </span>
              </div>
              <div className="space-y-1">
                {activeMap.branches.map((b, idx) => {
                  const isActive = idx === activeBranchIndex;
                  return (
                    <button
                      key={b.id}
                      onClick={() => engineRef.current?.enterSection(idx)}
                      className={`w-full text-right flex items-center justify-between p-2 rounded-xl text-xs transition-all ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                          : 'text-slate-300 hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-slate-950' : ''}`} style={{ background: isActive ? '#020617' : b.color }} />
                        <span className="truncate">{shortTitle(b.title)}</span>
                      </span>
                      {b.ayahRange && (
                        <span className={`text-xs shrink-0 ${isActive ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                          ({b.ayahRange.start}-{b.ayahRange.end})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section Navigation & Mushaf / Reset Controls */}
          <div className="absolute bottom-4 inset-x-0 flex flex-col items-center gap-2 px-3 z-10 pointer-events-none">
            <div data-tour="section-tools" className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
              <button
                onClick={() => engineRef.current?.prevSection()}
                title="المحور السابق"
                aria-label="المحور السابق"
                className={`${glass} rounded-2xl p-2 text-slate-200 hover:text-amber-300 hover:bg-slate-900/90 transition-all flex items-center gap-1 text-xs font-bold px-3`}
              >
                <ChevronRight className="w-4 h-4" />
                <span>المحور السابق</span>
              </button>

              <button
                onClick={() => engineRef.current?.resetSurahView()}
                className={`${glass} rounded-2xl px-3 py-2 flex items-center gap-1.5 text-xs font-bold text-slate-200 hover:bg-slate-900/90`}
              >
                <RotateCcw className="w-3.5 h-3.5" /> إعادة التوسيط
              </button>

              <button
                onClick={() => onNavigateToMushaf(activeMeta.startPage)}
                className={`${glass} rounded-2xl px-3 py-2 flex items-center gap-1.5 text-xs font-bold text-slate-200 hover:bg-slate-900/90`}
              >
                <BookOpen className="w-3.5 h-3.5" /> المصحف
              </button>

              <button
                onClick={() => engineRef.current?.nextSection()}
                title="المحور التالي"
                aria-label="المحور التالي"
                className={`${glass} rounded-2xl p-2 text-slate-200 hover:text-amber-300 hover:bg-slate-900/90 transition-all flex items-center gap-1 text-xs font-bold px-3`}
              >
                <span>المحور التالي</span>
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Quiz button — scoped to this branch's ayah range */}
              <button
                onClick={() => onStartQuiz({
                  label: `${shortTitle(activeBranch.title)} — سورة ${activeMeta.name} (آيات ${activeBranch.ayahRange?.start}–${activeBranch.ayahRange?.end})`,
                  surahNumber: activeMeta.number,
                  startAyah: activeBranch.ayahRange?.start,
                  endAyah: activeBranch.ayahRange?.end,
                })}
                className={`${glass} rounded-2xl px-3 py-2 flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:bg-slate-900/90 hover:text-emerald-200 transition-all`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>اختبر نفسك في هذا المحور</span>
              </button>
            </div>
            <p className="text-xs text-slate-400 pointer-events-none drop-shadow">
              اسحب للتدوير حول فلك آيات المحور · اضغط على أي بطاقة آية لفتح التفسير والتلاوة
            </p>
          </div>

          {/* Hover popup inside section mode */}
          {hoverItem && mode === 'section' && !touring && (
            <div
              className={`${glass} absolute bottom-20 left-1/2 -translate-x-1/2 max-w-lg w-[92%] rounded-2xl px-4 py-3 z-10 pointer-events-none animate-fade-in border-2`}
              style={{ borderColor: hoverItem.color || '#f5b942' }}
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: hoverItem.color }} />
                <span className="text-sm font-black text-amber-300">{hoverItem.title}</span>
                {hoverItem.kind === 'ayah' && (
                  <span className="text-xs text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full mr-auto">
                    اضغط لفتح التفسير والاستماع
                  </span>
                )}
              </div>

              {hoverItem.kind === 'ayah' && resolvedAyahText && (
                <div className="mt-2 p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 text-amber-100 text-sm font-amiri leading-relaxed text-center shadow-inner">
                  {resolvedAyahText}
                </div>
              )}

              {hoverItem.subtitle && (
                <p className="mt-1 text-xs text-slate-300 leading-relaxed font-medium">{hoverItem.subtitle}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
