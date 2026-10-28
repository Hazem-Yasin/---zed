import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { AppViewMode, Ayah, QuizScope } from './types';
import { Logo } from './components/ui/Logo';
import { CommandPalette } from './components/ui/CommandPalette';
import { SiteMap, SiteMapTarget } from './components/ui/SiteMap';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { HomeScreen } from './components/home/HomeScreen';
import { AyahDetailModal } from './components/ayah-sheet/AyahDetailModal';
import { ListeningDock, DockInset } from './components/globe/ListeningDock';
import { SURAHS_LIST } from './data/surahs';
import { usePersistentState } from './hooks/usePersistentState';
import { fetchSurahAyahRange } from './services/quranApi';
import { surahPlayer, ListenState } from './services/surahPlayer';
import { library } from './services/library';
import { tourBus, DEFAULT_GLOBE } from './services/tourBus';
import type { TourStep } from './components/tour/tourSteps';
import {
  BookOpen,
  Brain,
  Compass,
  Home,
  Sparkles,
  Shuffle,
  Menu,
  X,
  Orbit,
  Search,
  Map as MapIcon,
  Route,
} from 'lucide-react';

/* Each screen is its own chunk: three.js (globe) is only downloaded when the globe is opened. */
const QuranGlobe = lazy(() => import('./components/globe/QuranGlobe').then((m) => ({ default: m.QuranGlobe })));
const MushafPageViewer = lazy(() => import('./components/mushaf/MushafPageViewer').then((m) => ({ default: m.MushafPageViewer })));
const MindMapVisualizer = lazy(() => import('./components/mindmap/MindMapVisualizer').then((m) => ({ default: m.MindMapVisualizer })));
const GlobalQuranMindMap = lazy(() => import('./components/mindmap/GlobalQuranMindMap').then((m) => ({ default: m.GlobalQuranMindMap })));
const SectionMapExplorer = lazy(() => import('./components/mindmap/SectionMapExplorer').then((m) => ({ default: m.SectionMapExplorer })));
const WordRevealTest = lazy(() => import('./components/testing/WordRevealTest').then((m) => ({ default: m.WordRevealTest })));
const RandomPageQuiz = lazy(() => import('./components/testing/RandomPageQuiz').then((m) => ({ default: m.RandomPageQuiz })));
const GuidedTour = lazy(() => import('./components/tour/GuidedTour'));

const isPage = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 604;
const isSurah = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 114;

interface NavItem {
  id: string;
  /** View that highlights this item. */
  view: AppViewMode;
  label: string;
  icon: React.ReactNode;
  run: () => void;
}

const ViewFallback: React.FC = () => (
  <div className="flex h-full items-center justify-center text-slate-400" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-3">
      <BookOpen className="w-9 h-9 text-amber-500 animate-pulse" />
      <p className="font-cairo text-base">جارٍ التحميل…</p>
    </div>
  </div>
);

export default function App() {
  // The app always opens on the Atlas; only the last page / surah survive a reload.
  const [currentView, setCurrentView] = useState<AppViewMode>('globe');
  const [currentPage, setCurrentPage] = usePersistentState<number>('page', 1, isPage);
  const [selectedSurahNumber, setSelectedSurahNumber] = usePersistentState<number>('surah', 1, isSurah);
  // Section Map state
  const [sectionMapState, setSectionMapState] = useState<{
    surahNumber: number;
    branchId?: string;
    startAyah?: number;
    endAyah?: number;
  }>({ surahNumber: 1, startAyah: 1, endAyah: 7 });

  // Interactive Ayah Sheet Modal state
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  // The audio player lives at app level so it survives modal/view changes. Its state drives the modal's play button too.
  const [listen, setListen] = useState<ListenState>(surahPlayer.getState());
  const [followCamera, setFollowCamera] = usePersistentState<boolean>('globe-follow-camera', true);
  useEffect(() => surahPlayer.subscribe((s) => setListen(s)), []);
  // Space taken by the docked player: the page is laid out beside/above it instead of being covered.
  const [dockInset, setDockInset] = useState<DockInset>({ left: 0, bottom: 0 });
  const handleInsetChange = React.useCallback(
    (n: DockInset) => setDockInset((p) => (p.left === n.left && p.bottom === n.bottom ? p : n)),
    []
  );
  const isModalAudioPlaying =
    !!selectedAyah && listen.active && listen.playing && listen.surah === selectedAyah.surahNumber && listen.ayah === selectedAyah.numberInSurah;

  // Sliding menu drawer — closed by default so the first thing the user sees is the globe
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  // Command palette
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);

  // Testing Target Ayah (for Mode 1 jump)
  const [testTargetAyah, setTestTargetAyah] = useState<Ayah | null>(null);

  // Quiz scope — set when launching quiz from globe
  const [quizScope, setQuizScope] = useState<QuizScope | undefined>(undefined);

  // Guided tour: while it runs it borrows the page / surah / screen, and gives them back when it ends
  const [touring, setTouring] = useState<boolean>(false);
  const tourReturn = useRef<{
    view: AppViewMode;
    page: number;
    surah: number;
    testTarget: Ayah | null;
    quiz: QuizScope | undefined;
  } | null>(null);

  // Remember where the reader stopped (drives "continue reading" on the home screen); the tour must not touch it
  useEffect(() => {
    if (currentView === 'mushaf' && !touring) library.setLastRead(currentPage);
  }, [currentView, currentPage, touring]);

  // Ctrl/Cmd+K opens quick search from every screen; Escape closes the menu drawer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Open an ayah (from the globe, palette or home) in the detail modal
  const handleOpenAyah = async (surahNumber: number, ayahNumber: number) => {
    try {
      const [ayah] = await fetchSurahAyahRange(surahNumber, ayahNumber, ayahNumber);
      if (ayah) setSelectedAyah(ayah);
    } catch {
      /* offline: nothing to show, the click is simply ignored */
    }
  };

  // Navigate to specific Mushaf page
  const handleNavigateToMushaf = (page: number) => {
    setCurrentPage(page);
    setCurrentView('mushaf');
    setSelectedAyah(null);
  };

  // Open Mind map for specific Surah
  const handleOpenMindMap = (surahNumber: number) => {
    setSelectedSurahNumber(surahNumber);
    setCurrentView('mindmap');
    setSelectedAyah(null);
  };

  // Open Section / Topic Map Explorer
  const handleOpenSectionMap = (surahNumber: number, branchId?: string, startAyah?: number, endAyah?: number) => {
    setSectionMapState({ surahNumber, branchId, startAyah, endAyah });
    setCurrentView('section-map');
    setSelectedAyah(null);
  };

  // Start Word Reveal test from specific Ayah
  const handleStartWordRevealTest = (ayah?: Ayah) => {
    if (ayah) {
      setTestTargetAyah(ayah);
      setCurrentPage(ayah.page);
    } else {
      setTestTargetAyah(null);
    }
    setCurrentView('test-word-reveal');
    setSelectedAyah(null);
  };

  // Start Random page quiz (unscoped)
  const handleStartRandomPageQuiz = () => {
    setQuizScope(undefined);
    setCurrentView('test-random-ayah');
    setSelectedAyah(null);
  };

  // Start quiz scoped to a specific context (from globe)
  const handleStartQuiz = (scope: QuizScope) => {
    setQuizScope(scope);
    setCurrentView('test-random-ayah');
    setSelectedAyah(null);
  };

  const startTour = () => {
    tourReturn.current = { view: currentView, page: currentPage, surah: selectedSurahNumber, testTarget: testTargetAyah, quiz: quizScope };
    setMenuOpen(false);
    setPaletteOpen(false);
    setSelectedAyah(null);
    setTouring(true);
  };

  /** `keepView`: the user chose another screen while touring, so don't pull them back to where they started. */
  const endTour = (_finished: boolean, keepView = false) => {
    const back = tourReturn.current;
    tourReturn.current = null;
    setTouring(false);
    tourBus.emit({ type: 'restore' });
    if (!back) return;
    setCurrentPage(back.page);
    setSelectedSurahNumber(back.surah);
    setTestTargetAyah(back.testTarget);
    setQuizScope(back.quiz);
    if (!keepView) setCurrentView(back.view);
  };

  // Each tour step drives the real screens: globe steps are sent to the globe, site steps open the page.
  const handleTourStep = (step: TourStep) => {
    setSelectedAyah(null);
    if (step.view === 'globe') {
      setCurrentView('globe');
      tourBus.emit({ type: 'apply', s: step.globe ?? DEFAULT_GLOBE });
      return;
    }
    if (step.page) setCurrentPage(step.page);
    if (step.mindmapSurah) setSelectedSurahNumber(step.mindmapSurah);
    if (step.sectionMap) {
      const m = step.sectionMap;
      setSectionMapState({ surahNumber: m.surah, branchId: m.branchId, startAyah: m.start, endAyah: m.end });
    }
    if (step.view === 'test-word-reveal') setTestTargetAyah(null);
    if (step.view === 'test-random-ayah') setQuizScope(undefined);
    setCurrentView(step.view);
  };

  // The modal plays through the shared surah player, so audio keeps going (and stays controllable
  // from the dock) after the modal closes.
  const handlePlayModalAudio = (ayah: Ayah) => {
    if (isModalAudioPlaying) surahPlayer.pause();
    else surahPlayer.startAtAyah(ayah.surahNumber, ayah.numberInSurah);
  };

  /* ---- navigation config (shared by the sliding menu, the site map and the palette) ---- */
  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'الرئيسية',
      items: [{ id: 'home', view: 'home', label: 'الصفحة الرئيسية', icon: <Home className="w-5 h-5" />, run: () => setCurrentView('home') }],
    },
    {
      title: 'قراءة',
      items: [
        { id: 'mushaf', view: 'mushaf', label: 'المصحف الشريف', icon: <BookOpen className="w-5 h-5" />, run: () => setCurrentView('mushaf') },
        { id: 'mindmap', view: 'mindmap', label: 'خريطة السورة', icon: <Brain className="w-5 h-5" />, run: () => setCurrentView('mindmap') },
      ],
    },
    {
      title: 'استكشاف',
      items: [
        { id: 'globe', view: 'globe', label: 'أطلس القرآن', icon: <Orbit className="w-5 h-5" />, run: () => setCurrentView('globe') },
        { id: 'global-map', view: 'global-map', label: 'الخريطة الكبرى', icon: <Compass className="w-5 h-5" />, run: () => setCurrentView('global-map') },
        { id: 'site-map', view: 'site-map', label: 'خريطة الموقع', icon: <MapIcon className="w-5 h-5" />, run: () => setCurrentView('site-map') },
      ],
    },
    {
      title: 'تدريب',
      items: [
        { id: 'word-reveal', view: 'test-word-reveal', label: 'التسميع التدريجي', icon: <Sparkles className="w-5 h-5" />, run: () => handleStartWordRevealTest() },
        { id: 'next-ayah', view: 'test-random-ayah', label: 'تحدي الآية التالية', icon: <Shuffle className="w-5 h-5" />, run: handleStartRandomPageQuiz },
      ],
    },
  ];

  const allItems = groups.flatMap((g) => g.items);

  /** Section map is a drill-down of the mind map, so it keeps that item highlighted. */
  const isActive = (it: NavItem) => currentView === it.view || (it.view === 'mindmap' && currentView === 'section-map');
  const itemOn = 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20';
  const activeItem = allItems.find(isActive);

  const paletteCommands = [
    ...allItems.map((i) => ({ id: i.id, label: i.label, run: i.run })),
    { id: 'tour', label: 'جولة تعريفية في الموقع', run: startTour },
  ];

  const openSurahInMushaf = (n: number) => {
    const s = SURAHS_LIST.find((x) => x.number === n);
    if (s) handleNavigateToMushaf(s.startPage);
  };

  const pick = (it: NavItem) => {
    if (touring) endTour(false, true);
    it.run();
    setMenuOpen(false);
  };

  const goTo = (target: SiteMapTarget) => {
    const it = allItems.find((i) => i.id === target);
    if (it) pick(it);
  };

  const menuButton = (extra: string) => (
    <button
      type="button"
      onClick={() => setMenuOpen(true)}
      aria-label="فتح القائمة"
      aria-expanded={menuOpen}
      aria-controls="app-menu"
      title="القائمة"
      className={`p-2.5 rounded-xl text-slate-200 hover:text-amber-300 ${extra}`}
    >
      <Menu className="w-5 h-5" />
    </button>
  );

  return (
    <div
      className="flex h-[100dvh] w-screen overflow-hidden bg-slate-950 font-cairo text-slate-100"
      style={{ paddingLeft: dockInset.left, paddingBottom: dockInset.bottom }}
      dir="rtl"
    >
      {/* Sliding menu: hidden until asked for, so the globe is the first thing on screen */}
      <div
        className={`fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-[2px] transition-opacity duration-200 ${
          menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMenuOpen(false)}
        aria-hidden
      />
      <aside
        id="app-menu"
        aria-label="القائمة الرئيسية"
        aria-hidden={!menuOpen}
        className={`fixed inset-y-0 right-0 z-[70] w-72 max-w-[85vw] flex flex-col bg-slate-900 border-l border-amber-500/30 shadow-2xl p-3 overflow-y-auto transition-[transform,visibility] duration-250 ease-out ${
          menuOpen ? 'translate-x-0 visible' : 'translate-x-full invisible'
        }`}
      >
        <div className="flex items-center gap-3 px-1 py-1">
          <Logo className="w-10 h-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="font-black text-2xl text-amber-300 leading-tight">زد</h1>
            <p className="text-sm text-slate-300">مصحف الخرائط · قراءة وتدبر وحفظ</p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="إغلاق القائمة"
            className="p-2 rounded-xl text-slate-300 hover:text-amber-300 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            setPaletteOpen(true);
          }}
          className="mt-3 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950/60 text-slate-300 hover:text-slate-100 hover:border-slate-600 text-sm"
        >
          <Search className="w-5 h-5 shrink-0" />
          <span className="flex-1 text-start">بحث سريع</span>
          <kbd className="text-xs border border-slate-600 rounded px-1">Ctrl K</kbd>
        </button>

        <button
          type="button"
          onClick={startTour}
          className="mt-2 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 text-sm font-bold"
        >
          <Route className="w-5 h-5 shrink-0" />
          <span className="flex-1 text-start">جولة تعريفية في الموقع</span>
        </button>

        <nav className="mt-4 space-y-3 flex-1">
          {groups.map((g) => (
            <div key={g.title} className="space-y-1">
              <div className="px-3 pt-1 pb-0.5 text-sm font-bold text-slate-400 tracking-wide">{g.title}</div>
              {g.items.map((it) => {
                const on = isActive(it);
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => pick(it)}
                    aria-current={on ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      on ? itemOn : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {it.icon}
                    <span>{it.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-4 p-2.5 bg-slate-950/70 rounded-xl border border-slate-800 text-xs text-slate-300 text-center">
          <p className="font-bold text-amber-400 mb-0.5">مرجع الخرائط الذهنية</p>
          <p>كتاب الخرائط الذهنية لسور القرآن الكريم</p>
        </div>
      </aside>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        {/* Slim bar on every screen except the globe, which gets a floating button instead */}
        {currentView !== 'globe' && (
          <header className="bg-slate-900 border-b border-amber-500/20 px-3 py-1.5 flex items-center gap-2 z-40 shrink-0">
            {menuButton('bg-slate-800')}
            <Logo className="w-7 h-7" />
            <span className="font-black text-amber-300 text-lg leading-none">زد</span>
            {activeItem && <span className="text-sm text-slate-300 truncate">· {activeItem.label}</span>}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="بحث سريع (Ctrl+K)"
              title="بحث سريع (Ctrl+K)"
              className="ms-auto p-2.5 bg-slate-800 rounded-xl text-slate-200 hover:text-amber-300"
            >
              <Search className="w-5 h-5" />
            </button>
          </header>
        )}

        {/* View Router: every screen is lazy, isolated by an error boundary, and re-mounted per view */}
        <div className="flex-1 overflow-hidden relative">
          <ErrorBoundary resetKey={currentView}>
            <Suspense fallback={<ViewFallback />}>
              {currentView === 'home' && (
                <HomeScreen
                  onOpenPage={handleNavigateToMushaf}
                  onNavigate={setCurrentView}
                  onStartQuiz={handleStartRandomPageQuiz}
                  onStartWordReveal={() => handleStartWordRevealTest()}
                  onOpenAyah={handleOpenAyah}
                />
              )}

              {currentView === 'globe' && (
                <QuranGlobe
                  onOpenAyah={handleOpenAyah}
                  onOpenMindMap={handleOpenMindMap}
                  onNavigateToMushaf={handleNavigateToMushaf}
                  onStartQuiz={handleStartQuiz}
                  followCamera={followCamera}
                  onStartTour={startTour}
                  touring={touring}
                />
              )}

              {currentView === 'mushaf' && (
                <MushafPageViewer
                  pageNumber={currentPage}
                  onPageChange={setCurrentPage}
                  onSelectAyah={setSelectedAyah}
                  onOpenMindMap={handleOpenMindMap}
                  onStartWordRevealTest={handleStartWordRevealTest}
                  onStartRandomPageQuiz={handleStartRandomPageQuiz}
                />
              )}

              {currentView === 'mindmap' && (
                <MindMapVisualizer
                  surahNumber={selectedSurahNumber}
                  onSelectSurah={setSelectedSurahNumber}
                  onNavigateToMushaf={handleNavigateToMushaf}
                  onOpenSectionMap={handleOpenSectionMap}
                />
              )}

              {currentView === 'section-map' && (
                <SectionMapExplorer
                  surahNumber={sectionMapState.surahNumber}
                  branchId={sectionMapState.branchId}
                  startAyah={sectionMapState.startAyah}
                  endAyah={sectionMapState.endAyah}
                  onNavigateToMushaf={handleNavigateToMushaf}
                  onSelectSurahMindMap={handleOpenMindMap}
                />
              )}

              {currentView === 'global-map' && (
                <GlobalQuranMindMap onSelectSurah={handleOpenMindMap} onNavigateToMushaf={handleNavigateToMushaf} />
              )}

              {currentView === 'site-map' && <SiteMap current={activeItem?.id as SiteMapTarget} onGo={goTo} onStartTour={startTour} />}

              {currentView === 'test-word-reveal' && (
                <WordRevealTest
                  initialPageNumber={currentPage}
                  initialAyah={testTargetAyah}
                  onNavigateToMushaf={handleNavigateToMushaf}
                />
              )}

              {currentView === 'test-random-ayah' && (
                <RandomPageQuiz
                  onNavigateToMushaf={handleNavigateToMushaf}
                  onOpenMindMap={handleOpenMindMap}
                  onOpenSectionMap={handleOpenSectionMap}
                  scope={quizScope}
                />
              )}
            </Suspense>
          </ErrorBoundary>
        </div>

        {currentView === 'globe' && menuButton('absolute top-3 right-3 z-40 glass-panel')}
      </div>

      {/* Quick search (Ctrl/Cmd+K) */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenSurah={openSurahInMushaf}
        onOpenMindMap={handleOpenMindMap}
        onOpenPage={handleNavigateToMushaf}
        onOpenAyah={handleOpenAyah}
        commands={paletteCommands}
      />

      {/* Guided tour (above the drawer, palette and ayah modal) */}
      {touring && (
        <Suspense fallback={null}>
          <GuidedTour onStep={handleTourStep} onEnd={endTour} />
        </Suspense>
      )}

      {/* Audio player: always present on every screen, docked or floating, resizable */}
      <ListeningDock
        state={listen}
        followCamera={followCamera}
        onToggleFollowCamera={setFollowCamera}
        onInsetChange={handleInsetChange}
        onOpenMindMap={handleOpenMindMap}
        onNavigateToMushaf={handleNavigateToMushaf}
      />

      {/* Interactive Ayah Modal */}
      <AyahDetailModal
        ayah={selectedAyah}
        onClose={() => setSelectedAyah(null)}
        onPlayAudio={handlePlayModalAudio}
        isPlaying={isModalAudioPlaying}
        inset={dockInset}
        onOpenMindMap={handleOpenMindMap}
        onStartWordRevealTest={handleStartWordRevealTest}
      />
    </div>
  );
}
