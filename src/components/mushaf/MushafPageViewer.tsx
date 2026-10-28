import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFitFontScale } from '../../hooks/useFitFontScale';
import { Ayah, QuranPageData, Reciter } from '../../types';
import { fetchQuranPage, prefetchQuranPage, fetchPageCommentary, CommentaryKind, getAyahAudioUrl, RECITERS } from '../../services/quranApi';
import { globalAudio } from '../../services/audioManager';
import { library, useLibrary } from '../../services/library';
import { Rating } from '../../services/srs';
import { LoadError } from '../ui/kit';
import { SURAHS_LIST } from '../../data/surahs';
import { readStoredReciter } from '../../services/surahPlayer';
import { MushafThemePicker, useMushafTheme } from '../ui/MushafTheme';
import { getSurahMindMap } from '../../data/mindmaps/mindmapData';
import { 
  ChevronRight, 
  ChevronLeft, 
  Play, 
  Pause, 
  Volume2, 
  BookOpen, 
  Brain, 
  Sparkles, 
  Layers, 
  ZoomIn, 
  ZoomOut,
  HelpCircle,
  Shuffle,
  CheckCircle2
} from 'lucide-react';

interface MushafPageViewerProps {
  pageNumber: number;
  onPageChange: (newPage: number) => void;
  onSelectAyah: (ayah: Ayah) => void;
  onOpenMindMap: (surahNumber: number) => void;
  onStartWordRevealTest: (ayah?: Ayah) => void;
  onStartRandomPageQuiz: () => void;
  selectedAyahNumberInSurah?: number;
}

export const MushafPageViewer: React.FC<MushafPageViewerProps> = ({
  pageNumber,
  onPageChange,
  onSelectAyah,
  onOpenMindMap,
  onStartWordRevealTest,
  onStartRandomPageQuiz,
}) => {
  const [pageData, setPageData] = useState<QuranPageData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [retryTick, setRetryTick] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'digital' | 'scan'>('digital');
  const [showThemeColors, setShowThemeColors] = useState<boolean>(true);
  const [hoveredAyah, setHoveredAyah] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const { fontScale, zoomIn, zoomOut, reset: resetZoom } = useFitFontScale(
    frameRef,
    pageNumber,
    `${isLoading}-${pageData?.pageNumber}`
  );
  
  // Audio Playback (through the shared AudioManager so nothing else can play at the same time)
  const [currentPlayingAyahIndex, setCurrentPlayingAyahIndex] = useState<number>(-1);
  const isPlayingAudio = currentPlayingAyahIndex >= 0;
  const [selectedReciter] = useState<Reciter>(() => RECITERS.find((r) => r.id === readStoredReciter()) || RECITERS[0]);
  const [mushafTheme, setMushafTheme] = useMushafTheme();
  const pageDataRef = useRef<QuranPageData | null>(null);
  pageDataRef.current = pageData;

  // Load page data (and warm the cache for the neighbouring pages)
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadFailed(false);

    // Stop page recitation on page change
    if (globalAudio.getPlayingId()?.startsWith('mushaf-')) globalAudio.stop();

    fetchQuranPage(pageNumber)
      .then((data) => {
        if (!isMounted) return;
        setPageData(data);
        setIsLoading(false);
        prefetchQuranPage(pageNumber + 1);
        prefetchQuranPage(pageNumber - 1);
      })
      .catch(() => {
        if (!isMounted) return;
        setLoadFailed(true);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pageNumber, retryTick]);

  // Follow the shared audio state; stop our recitation when leaving the screen
  useEffect(() => {
    const unsub = globalAudio.subscribe((id) => {
      if (!id || !id.startsWith('mushaf-')) setCurrentPlayingAyahIndex(-1);
    });
    return () => {
      unsub();
      if (globalAudio.getPlayingId()?.startsWith('mushaf-')) globalAudio.stop();
    };
  }, []);

  const playAyahAudio = useCallback(
    (ayahIndex: number) => {
      const data = pageDataRef.current;
      const ayah = data?.ayahs[ayahIndex];
      if (!data || !ayah) return;

      setCurrentPlayingAyahIndex(ayahIndex);
      globalAudio.play(`mushaf-${ayah.numberInQuran}`, getAyahAudioUrl(ayah.numberInQuran, selectedReciter.id), () => {
        if (ayahIndex + 1 < data.ayahs.length) playAyahAudio(ayahIndex + 1);
        else setCurrentPlayingAyahIndex(-1);
      });
    },
    [selectedReciter.id]
  );

  const togglePageAudio = () => {
    if (isPlayingAudio) {
      globalAudio.stop();
      setCurrentPlayingAyahIndex(-1);
    } else {
      playAyahAudio(0);
    }
  };

  const handleNextPage = () => {
    if (pageNumber < 604) onPageChange(pageNumber + 1);
  };

  const handlePrevPage = () => {
    if (pageNumber > 1) onPageChange(pageNumber - 1);
  };

  // Keyboard navigation (ignored while typing / using a form control / a dialog is open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, select, textarea, [contenteditable="true"], [role="dialog"], [role="combobox"]')) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      // RTL reading order: left = next page, right = previous page
      if (e.key === 'ArrowLeft') handleNextPage();
      else if (e.key === 'ArrowRight') handlePrevPage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageNumber]);

  const currentSurah = pageData ? SURAHS_LIST.find(s => s.number === pageData.surahNumber) : null;
  const currentMindMap = pageData ? getSurahMindMap(pageData.surahNumber) : null;
  const activeHoveredAyahObj = pageData?.ayahs.find(a => a.numberInSurah === hoveredAyah) || pageData?.ayahs[0];

  // Jump-to-page input (kept as text so the user can type freely, applied on submit)
  const [pageInput, setPageInput] = useState<string>(String(pageNumber));
  useEffect(() => setPageInput(String(pageNumber)), [pageNumber]);
  const submitPageInput = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(pageInput, 10);
    if (Number.isInteger(n) && n >= 1 && n <= 604) onPageChange(n);
    else setPageInput(String(pageNumber));
  };
  const currentJuz = pageData?.juzNumber ?? 1;
  const juzStartPage = (j: number) => (j <= 1 ? 1 : 20 * (j - 1) + 2);

  // Memorisation + spaced-repetition state for this page
  const lib = useLibrary();
  const isMemorized = lib.memorized.includes(pageNumber);
  const review = lib.reviews[String(pageNumber)];
  const rate = (r: Rating) => library.rate(pageNumber, r);

  // Real tafsir / translation for the page (loaded on demand, never invented)
  const [commentaryKind, setCommentaryKind] = useState<CommentaryKind>('tafsir');
  const [commentary, setCommentary] = useState<Record<number, string> | null>(null);
  const [commentaryFailed, setCommentaryFailed] = useState<boolean>(false);
  useEffect(() => {
    let alive = true;
    setCommentary(null);
    setCommentaryFailed(false);
    fetchPageCommentary(pageNumber, commentaryKind)
      .then((m) => alive && setCommentary(m))
      .catch(() => alive && setCommentaryFailed(true));
    return () => {
      alive = false;
    };
  }, [pageNumber, commentaryKind]);

  // Swipe to turn pages on touch screens (RTL: swipe right = next, like turning a mushaf)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0) handleNextPage();
    else handlePrevPage();
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden" dir="rtl">
      {/* Top Mushaf Controls Bar */}
      <header data-tour="mushaf-bar" className="bg-slate-900 border-b border-amber-500/20 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 z-30">
        {/* Navigation & Surah Info */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-0.5 border border-slate-700">
            <button
              onClick={handlePrevPage}
              aria-label="الصفحة السابقة"
              disabled={pageNumber <= 1}
              className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 text-amber-400 transition-colors"
              title="الصفحة السابقة"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <form onSubmit={submitPageInput} className="flex items-center gap-1 px-1 font-cairo text-sm font-bold">
              <label htmlFor="mushaf-page-input" className="sr-only">رقم الصفحة</label>
              <input
                id="mushaf-page-input"
                inputMode="numeric"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
                onBlur={submitPageInput}
                className="w-12 text-center bg-slate-900 border border-slate-700 rounded-lg py-1 text-amber-200 focus:border-amber-500"
              />
              <span className="text-slate-400 font-semibold">/ 604</span>
            </form>
            <button
              onClick={handleNextPage}
              aria-label="الصفحة التالية"
              disabled={pageNumber >= 604}
              className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 text-amber-400 transition-colors"
              title="الصفحة التالية"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Surah Dropdown Jump */}
          <select
            aria-label="الانتقال إلى سورة"
            value={pageData?.surahNumber || 1}
            onChange={(e) => {
              const surahNum = parseInt(e.target.value);
              const targetSurah = SURAHS_LIST.find(s => s.number === surahNum);
              if (targetSurah) onPageChange(targetSurah.startPage);
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-sm font-bold text-amber-200 focus:outline-none focus:border-amber-500 cursor-pointer max-w-[9.5rem] sm:max-w-none"
          >
            {SURAHS_LIST.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. سورة {s.name}
              </option>
            ))}
          </select>

          {/* Juz jump */}
          <select
            aria-label="الانتقال إلى جزء"
            value={currentJuz}
            onChange={(e) => onPageChange(juzStartPage(parseInt(e.target.value, 10)))}
            className="hidden sm:block bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-sm font-bold text-amber-200 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
              <option key={j} value={j}>
                الجزء {j}
              </option>
            ))}
          </select>
        </div>

        {/* View Controls & Zoom */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 p-0.5">
            <button
              onClick={zoomIn}
              className="p-1 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              title="تكبير الخط"
              aria-label="تكبير الخط"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={zoomOut}
              className="p-1 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              title="تصغير الخط"
              aria-label="تصغير الخط"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetZoom}
              className="px-1.5 py-0.5 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-bold min-w-[36px] text-center"
              title="إعادة ضبط الحجم (تلقائي)"
              aria-label="إعادة ضبط حجم الخط (تلقائي)"
            >
              {Math.round(fontScale * 100)}%
            </button>
          </div>

          {/* Memorised toggle */}
          <button
            onClick={() => library.toggleMemorized(pageNumber)}
            aria-pressed={isMemorized}
            title={isMemorized ? 'إزالة من المحفوظ' : 'تعليم الصفحة كمحفوظة'}
            className={`px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 text-sm transition-colors border ${
              isMemorized
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">{isMemorized ? 'محفوظة' : 'حفظتها'}</span>
          </button>

          {/* Audio Recitation */}
          <button
            onClick={togglePageAudio}
            aria-label={isPlayingAudio ? 'إيقاف التلاوة' : 'استماع لصفحة المصحف'}
            className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 text-xs transition-all border ${
              isPlayingAudio
                ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-amber-400'
            }`}
          >
            {isPlayingAudio ? <Pause className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isPlayingAudio ? 'إيقاف' : 'استماع'}</span>
          </button>

          <MushafThemePicker value={mushafTheme} onChange={setMushafTheme} />

          {/* Toggle Theme Coloring */}
          <button
            onClick={() => setShowThemeColors(!showThemeColors)}
            aria-pressed={showThemeColors}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all ${
              showThemeColors 
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="تلوين الآيات حسب مواضيع الخريطة الذهنية"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ألوان الخريطة</span>
          </button>

          {/* Switch Digital / Scan view */}
          <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700 text-xs">
            <button
              onClick={() => setViewMode('digital')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                viewMode === 'digital' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              مصحف
            </button>
            <button
              onClick={() => setViewMode('scan')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                viewMode === 'scan' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              طبعة المدينة
            </button>
          </div>
        </div>
      </header>

      {/* 3-Column Studio Layout Filling Left, Center, and Right Screen */}
      <div className="flex-1 flex overflow-hidden p-2 sm:p-4 gap-3 lg:gap-4 justify-between items-stretch">
        
        {/* RIGHT PANEL: Surah Mind Map Topics */}
        <aside className="hidden xl:flex flex-col w-72 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shrink-0 overflow-y-auto">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-3">
            <Brain className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-xs text-amber-300">
              خريطة سورة {pageData?.surahName}
            </h3>
          </div>

          {currentMindMap && (
            <div className="space-y-3 flex-1">
              <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs text-slate-200">
                <span className="font-bold text-amber-400 block mb-1">المحور والهدف:</span>
                <p className="leading-relaxed font-cairo text-xs text-slate-300">
                  {currentMindMap.centralTheme}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 block">تقسيمات السورة بالمصحف:</span>
                {currentMindMap.branches.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => onOpenMindMap(pageData!.surahNumber)}
                    className="p-2.5 rounded-xl border bg-slate-950/80 hover:border-amber-500/50 cursor-pointer transition-all text-xs"
                    style={{ borderColor: `${b.color || '#3B82F6'}40` }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                      <span className="font-bold text-white text-xs">{b.title}</span>
                    </div>
                    {b.ayahRange && (
                      <span className="text-xs text-slate-400 block font-cairo">
                        الآيات ({b.ayahRange.start} - {b.ayahRange.end})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => onOpenMindMap(pageData?.surahNumber || 1)}
            className="mt-3 w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>عرض الخريطة التفاعلية</span>
          </button>
        </aside>

        {/* CENTER MAIN: The Complete Mushaf Page (Fitted without scroll) */}
        <main
          className="flex-1 flex flex-col justify-between items-center max-w-4xl mx-auto h-full overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
              <BookOpen className="w-10 h-10 text-amber-500 animate-spin" />
              <p className="font-cairo text-sm">جارٍ تحميل صفحة القرآن الكريم...</p>
            </div>
          ) : loadFailed ? (
            <LoadError onRetry={() => setRetryTick((n) => n + 1)} />
          ) : pageData ? (
            <div
              ref={frameRef}
              data-mushaf-theme={mushafTheme}
              className="w-full flex-1 min-h-0 rounded-2xl p-4 sm:p-6 shadow-2xl border-[8px] sm:border-[10px] border-[#ecd8b5] outline outline-1 outline-[#caa46e] relative flex flex-col justify-between overflow-x-hidden overflow-y-auto"
              style={{ fontSize: `${fontScale * 100}%`, background: 'var(--mushaf-bg)', color: 'var(--mushaf-text)' }}
            >
              {/* Decorative Frame Corners */}
              <div className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-[#caa46e]" />
              <div className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-[#caa46e]" />
              <div className="absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-[#caa46e]" />
              <div className="absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-[#caa46e]" />

              {/* Page Top Header Bar */}
              <div className="flex items-center justify-between border-b border-[#dfcaa7] pb-1.5 mb-2 text-xs font-bold font-cairo shrink-0" style={{ color: 'var(--mushaf-muted)' }}>
                <div>الجزء {pageData.juzNumber}</div>
                <div className="text-sm font-bold" style={{ color: 'var(--mushaf-text)' }}>سورة {pageData.surahName}</div>
                <div>صفحة {pageData.pageNumber}</div>
              </div>

              {/* Surah Header Banner (if start of Surah) */}
              {pageData.ayahs.some(a => a.numberInSurah === 1) && (
                <div className="my-1 text-center shrink-0">
                  <div className="inline-block bg-[#ecd8b5] border border-[#caa46e] px-6 py-0.5 rounded-xl shadow-inner">
                    <span className="font-amiri text-lg sm:text-xl font-bold text-[#5c3e10]">
                      سُورَةُ {pageData.surahName}
                    </span>
                  </div>

                  {pageData.surahNumber !== 9 && (
                    <div className="font-amiri text-base sm:text-lg mt-0.5" style={{ color: 'var(--mushaf-text)' }}>
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                    </div>
                  )}
                </div>
              )}

              {/* Flowing Ayahs Container — font sized by auto-fit */}
              <div
                className="flex-1 font-amiri text-[1.35em] leading-[2.4] text-justify font-normal select-none"
              >
                <div className="text-justify w-full">
                  {pageData.ayahs.map((ayah, index) => {
                    const isHovered = hoveredAyah === ayah.numberInSurah;
                    const isPlaying = currentPlayingAyahIndex === index;
                    const themeColor = ayah.themeCategory?.color || '#3B82F6';

                    return (
                      <span
                        key={ayah.numberInQuran}
                        onClick={() => onSelectAyah(ayah)}
                        onMouseEnter={() => setHoveredAyah(ayah.numberInSurah)}
                        onMouseLeave={() => setHoveredAyah(null)}
                        className={`inline cursor-pointer rounded-md px-1 py-0.5 transition-all duration-200 relative group ${
                          isPlaying 
                            ? 'bg-amber-300 text-amber-950 font-bold ring-2 ring-amber-500' 
                            : isHovered 
                              ? 'bg-amber-500/20 shadow-sm'
                              : ''
                        }`}
                        style={
                          showThemeColors && !isPlaying
                            ? {
                                borderBottom: `2.5px solid ${themeColor}70`,
                                backgroundColor: isHovered ? `${themeColor}20` : 'transparent',
                              }
                            : {}
                        }
                      >
                        {ayah.textUthmani}
                        
                        {/* Ayah End Symbol */}
                        <span className="inline-flex items-center justify-center w-6 h-6 mx-1 text-xs font-bold text-[#6b4c1e] bg-[#eedec0] border border-[#caa46e] rounded-full align-middle font-cairo shadow-inner group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-transform">
                          {ayah.numberInSurah}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Page Bottom Footer */}
              <div className="pt-1.5 border-t border-[#dfcaa7] flex items-center justify-between text-xs font-cairo font-bold shrink-0 mt-2" style={{ color: 'var(--mushaf-muted)' }}>
                <span>مصحف التجويد والخرائط الذهنية</span>
                <span className="w-6 h-6 rounded-full border border-[#caa46e] flex items-center justify-center text-xs font-bold bg-[#eedec0] text-[#6b4c1e]">
                  {pageData.pageNumber}
                </span>
                <span>{currentSurah?.translation || ''}</span>
              </div>
            </div>
          ) : null}
        </main>

        {/* LEFT PANEL: Ayah Quick Tafsir, Audio Reciter & Memorization Jump */}
        <aside data-tour="ayah-panel" className="hidden lg:flex flex-col w-72 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shrink-0 justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-bold text-xs text-amber-300">بيانات الآية المحددة</span>
              {activeHoveredAyahObj && (
                <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-amber-400 font-bold font-cairo">
                  آية {activeHoveredAyahObj.numberInSurah}
                </span>
              )}
            </div>

            {activeHoveredAyahObj && (
              <div className="space-y-2.5">
                {activeHoveredAyahObj.themeCategory && (
                  <div 
                    className="p-2 rounded-xl text-xs font-bold border"
                    style={{
                      backgroundColor: `${activeHoveredAyahObj.themeCategory.color}15`,
                      borderColor: `${activeHoveredAyahObj.themeCategory.color}40`,
                      color: activeHoveredAyahObj.themeCategory.color
                    }}
                  >
                    <span>الموضوع: {activeHoveredAyahObj.themeCategory.name}</span>
                  </div>
                )}

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-1 mb-2" role="tablist" aria-label="نوع الشرح">
                    {([
                      ['tafsir', 'التفسير الميسر'],
                      ['translation', 'English'],
                    ] as [CommentaryKind, string][]).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={commentaryKind === k}
                        onClick={() => setCommentaryKind(k)}
                        className={`px-2.5 py-1 rounded-lg text-sm font-bold ${
                          commentaryKind === k ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p
                    className={`text-sm text-slate-200 leading-relaxed max-h-44 overflow-y-auto ${
                      commentaryKind === 'translation' ? 'text-left' : 'font-cairo'
                    }`}
                    dir={commentaryKind === 'translation' ? 'ltr' : 'rtl'}
                  >
                    {commentaryFailed
                      ? 'تعذّر تحميل النص حالياً.'
                      : commentary
                      ? commentary[activeHoveredAyahObj.numberInQuran] ?? '—'
                      : 'جارٍ التحميل…'}
                  </p>
                </div>

                <button
                  onClick={() => onSelectAyah(activeHoveredAyahObj)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>فتح نافذة تفاصيل الآية</span>
                </button>
              </div>
            )}
          </div>

          {/* Review: only meaningful for pages the user is memorising */}
          {isMemorized && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="text-sm font-bold text-emerald-300">
                راجعت هذه الصفحة؟
                {review && (
                  <span className="block text-xs font-semibold text-slate-400">
                    المرحلة {review.box} من 5 · المراجعة القادمة{' '}
                    {review.due <= Date.now() ? 'الآن' : new Date(review.due).toLocaleDateString('ar')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  ['again', 'نسيت', 'bg-rose-500/15 text-rose-200 border-rose-500/40'],
                  ['hard', 'صعبة', 'bg-orange-500/15 text-orange-200 border-orange-500/40'],
                  ['good', 'جيدة', 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'],
                  ['easy', 'سهلة', 'bg-sky-500/15 text-sky-200 border-sky-500/40'],
                ] as [Rating, string, string][]).map(([r, label, cls]) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => rate(r)}
                    className={`py-2 rounded-xl border text-sm font-bold hover:brightness-125 ${cls}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Testing Navigation */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <button
              onClick={() => onStartWordRevealTest(activeHoveredAyahObj)}
              className="w-full py-2 bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/50 hover:to-purple-600/50 text-indigo-200 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>اختبار تسميع الآية (كلمة بكلمة)</span>
            </button>

            <button
              onClick={onStartRandomPageQuiz}
              className="w-full py-2 bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/50 hover:to-orange-600/50 text-amber-200 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              <Shuffle className="w-3.5 h-3.5 text-amber-400" />
              <span>تحدي الآية التالية بالصفحة</span>
            </button>
          </div>
        </aside>

      </div>
    </div>
  );
};
