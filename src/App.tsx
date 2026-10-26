import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AppViewMode, Ayah, QuizScope } from './types';
import { Logo } from './components/ui/Logo';
import { CommandPalette } from './components/ui/CommandPalette';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { HomeScreen } from './components/home/HomeScreen';
import { AyahDetailModal } from './components/ayah-sheet/AyahDetailModal';
import { SURAHS_LIST } from './data/surahs';
import { usePersistentState } from './hooks/usePersistentState';
import { getAyahAudioUrl, fetchSurahAyahRange } from './services/quranApi';
import { globalAudio } from './services/audioManager';
import { library } from './services/library';
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
  PanelRightClose,
  PanelRightOpen,
  Dumbbell,
} from 'lucide-react';

/* Each screen is its own chunk: three.js (globe) is only downloaded when the globe is opened. */
const QuranGlobe = lazy(() => import('./components/globe/QuranGlobe').then((m) => ({ default: m.QuranGlobe })));
const MushafPageViewer = lazy(() => import('./components/mushaf/MushafPageViewer').then((m) => ({ default: m.MushafPageViewer })));
const MindMapVisualizer = lazy(() => import('./components/mindmap/MindMapVisualizer').then((m) => ({ default: m.MindMapVisualizer })));
const GlobalQuranMindMap = lazy(() => import('./components/mindmap/GlobalQuranMindMap').then((m) => ({ default: m.GlobalQuranMindMap })));
const SectionMapExplorer = lazy(() => import('./components/mindmap/SectionMapExplorer').then((m) => ({ default: m.SectionMapExplorer })));
const WordRevealTest = lazy(() => import('./components/testing/WordRevealTest').then((m) => ({ default: m.WordRevealTest })));
const RandomPageQuiz = lazy(() => import('./components/testing/RandomPageQuiz').then((m) => ({ default: m.RandomPageQuiz })));

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
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState<boolean>('sidebar-collapsed', false, (v) => typeof v === 'boolean');

  // Section Map state
  const [sectionMapState, setSectionMapState] = useState<{
    surahNumber: number;
    branchId?: string;
    startAyah?: number;
    endAyah?: number;
  }>({ surahNumber: 1, startAyah: 1, endAyah: 7 });

  // Interactive Ayah Sheet Modal state
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  const [isModalAudioPlaying, setIsModalAudioPlaying] = useState<boolean>(false);

  // Mobile Nav Drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Command palette
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);

  // Testing Target Ayah (for Mode 1 jump)
  const [testTargetAyah, setTestTargetAyah] = useState<Ayah | null>(null);

  // Quiz scope — set when launching quiz from globe
  const [quizScope, setQuizScope] = useState<QuizScope | undefined>(undefined);

  // Remember where the reader stopped (drives "continue reading" on the home screen)
  useEffect(() => {
    if (currentView === 'mushaf') library.setLastRead(currentPage);
  }, [currentView, currentPage]);

  // Listen to global audio
  useEffect(() => {
    const unsub = globalAudio.subscribe((playingId) => {
      setIsModalAudioPlaying(playingId?.startsWith('modal-') || false);
    });
    return () => unsub();
  }, []);

  // Ctrl/Cmd+K opens quick search from every screen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
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

  // Play audio in Modal with Global AudioManager
  const handlePlayModalAudio = (ayah: Ayah) => {
    const id = `modal-${ayah.numberInQuran}`;
    if (globalAudio.isPlaying(id)) {
      globalAudio.stop();
      setIsModalAudioPlaying(false);
      return;
    }
    const url = getAyahAudioUrl(ayah.numberInQuran);
    globalAudio.play(id, url, () => setIsModalAudioPlaying(false));
    setIsModalAudioPlaying(true);
  };

  /* ---- navigation config (shared by sidebar, mobile drawer, bottom bar and palette) ---- */
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

  /** Section map is a drill-down of the mind map, so it keeps that item highlighted. */
  const isActive = (it: NavItem) => currentView === it.view || (it.view === 'mindmap' && currentView === 'section-map');
  const itemOn = 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20';

  const paletteCommands = groups.flatMap((g) => g.items).map((i) => ({ id: i.id, label: i.label, run: i.run }));

  const openSurahInMushaf = (n: number) => {
    const s = SURAHS_LIST.find((x) => x.number === n);
    if (s) handleNavigateToMushaf(s.startPage);
  };

  // Bottom bar (mobile): the five things people do most
  const tabs: { id: string; label: string; icon: React.ReactNode; on: boolean; run: () => void }[] = [
    { id: 'home', label: 'الرئيسية', icon: <Home className="w-6 h-6" />, on: currentView === 'home', run: () => setCurrentView('home') },
    { id: 'mushaf', label: 'المصحف', icon: <BookOpen className="w-6 h-6" />, on: currentView === 'mushaf', run: () => setCurrentView('mushaf') },
    { id: 'mindmap', label: 'الخريطة', icon: <Brain className="w-6 h-6" />, on: currentView === 'mindmap' || currentView === 'section-map', run: () => setCurrentView('mindmap') },
    { id: 'globe', label: 'الأطلس', icon: <Orbit className="w-6 h-6" />, on: currentView === 'globe', run: () => setCurrentView('globe') },
    {
      id: 'practice',
      label: 'تدريب',
      icon: <Dumbbell className="w-6 h-6" />,
      on: currentView === 'test-word-reveal' || currentView === 'test-random-ayah',
      run: () => handleStartWordRevealTest(),
    },
  ];

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-slate-950 font-cairo text-slate-100" dir="rtl">
      {/* Sidebar Navigation (Desktop & Tablet) */}
      <aside
        className={`hidden md:flex flex-col bg-slate-900 border-l border-amber-500/20 p-3 justify-between shrink-0 transition-[width] duration-200 overflow-y-auto ${
          sidebarCollapsed ? 'w-[4.25rem]' : 'w-64'
        }`}
        aria-label="التنقل الرئيسي"
      >
        <div className="space-y-4">
          {/* App Branding */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-1'} py-1`}>
            <Logo className="w-10 h-10 shrink-0" />
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="font-black text-2xl text-amber-300 leading-tight">زد</h1>
                <p className="text-sm text-slate-300">مصحف الخرائط · قراءة وتدبر وحفظ</p>
              </div>
            )}
          </div>

          {/* Quick search */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="بحث سريع (Ctrl+K)"
            title="بحث سريع (Ctrl+K)"
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2 px-3'} py-2.5 rounded-xl border border-slate-700 bg-slate-950/60 text-slate-300 hover:text-slate-100 hover:border-slate-600 text-sm`}
          >
            <Search className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-start">بحث سريع</span>
                <kbd className="text-xs border border-slate-600 rounded px-1">Ctrl K</kbd>
              </>
            )}
          </button>

          {/* Navigation Links */}
          <nav className="space-y-3">
            {groups.map((g) => (
              <div key={g.title} className="space-y-1">
                {sidebarCollapsed ? (
                  <div className="mx-2 border-t border-slate-800" aria-hidden />
                ) : (
                  <div className="px-3 pt-1 pb-0.5 text-sm font-bold text-slate-400 tracking-wide">{g.title}</div>
                )}
                {g.items.map((it) => {
                  const on = isActive(it);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={it.run}
                      aria-current={on ? 'page' : undefined}
                      aria-label={sidebarCollapsed ? it.label : undefined}
                      title={sidebarCollapsed ? it.label : undefined}
                      className={`w-full flex items-center ${
                        sidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                      } py-2.5 rounded-xl text-sm font-bold transition-colors ${on ? itemOn : 'text-slate-200 hover:bg-slate-800'}`}
                    >
                      {it.icon}
                      {!sidebarCollapsed && <span>{it.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="space-y-2 pt-3">
          {!sidebarCollapsed && (
            <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800 text-xs text-slate-300 text-center">
              <p className="font-bold text-amber-400 mb-0.5">مرجع الخرائط الذهنية</p>
              <p>كتاب الخرائط الذهنية لسور القرآن الكريم</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'توسيع القائمة' : 'طيّ القائمة'}
            title={sidebarCollapsed ? 'توسيع القائمة' : 'طيّ القائمة'}
            className="w-full flex items-center justify-center py-2 rounded-xl text-slate-300 hover:text-amber-300 hover:bg-slate-800"
          >
            {sidebarCollapsed ? <PanelRightOpen className="w-5 h-5" /> : <PanelRightClose className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        {/* Mobile Top Navigation Header */}
        <header className="md:hidden bg-slate-900 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between z-40">
          <div className="flex items-center gap-2">
            <Logo className="w-8 h-8" />
            <span className="font-black text-amber-300 text-xl leading-none">زد</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="بحث سريع"
              className="p-2.5 bg-slate-800 rounded-xl text-slate-200"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'إغلاق القائمة' : 'كل الأقسام'}
              aria-expanded={isMobileMenuOpen}
              className="p-2.5 bg-slate-800 rounded-xl text-slate-200"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Dropdown Drawer (same config as the sidebar) */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-[3.5rem] inset-x-0 bg-slate-900 border-b border-amber-500/30 p-4 z-50 shadow-2xl space-y-3 animate-fade-in max-h-[70dvh] overflow-y-auto">
            {groups.map((g) => (
              <div key={g.title} className="space-y-1.5">
                <div className="px-1 text-sm font-bold text-slate-400">{g.title}</div>
                {g.items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      it.run();
                      setIsMobileMenuOpen(false);
                    }}
                    aria-current={isActive(it) ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                      isActive(it) ? itemOn : 'bg-slate-800 text-slate-100'
                    }`}
                  >
                    {it.icon}
                    <span>{it.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
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

        {/* Mobile bottom tab bar */}
        <nav
          className="md:hidden grid grid-cols-5 bg-slate-900 border-t border-amber-500/20 z-40 pb-[env(safe-area-inset-bottom)]"
          aria-label="التنقل السريع"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={t.run}
              aria-current={t.on ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.5rem] text-xs font-bold transition-colors ${
                t.on ? 'text-amber-300' : 'text-slate-300'
              }`}
            >
              <span className={`px-4 py-1 rounded-full ${t.on ? 'bg-amber-500/20' : ''}`}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
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

      {/* Interactive Ayah Modal */}
      <AyahDetailModal
        ayah={selectedAyah}
        onClose={() => setSelectedAyah(null)}
        onPlayAudio={handlePlayModalAudio}
        isPlaying={isModalAudioPlaying}
        onOpenMindMap={handleOpenMindMap}
        onStartWordRevealTest={handleStartWordRevealTest}
      />
    </div>
  );
}
