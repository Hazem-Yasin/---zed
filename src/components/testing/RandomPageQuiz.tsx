import React, { useState, useEffect, useRef } from 'react';
import { useFitFontScale } from '../../hooks/useFitFontScale';
import { Ayah, QuranPageData, QuizScope } from '../../types';
import { useMushafTheme, MushafThemePicker } from '../ui/MushafTheme';
import { LoadError } from '../ui/kit';
import { library } from '../../services/library';
import { fetchQuranPage, getAyahAudioUrl, fetchSurahAllAyahs } from '../../services/quranApi';
import { SURAHS_LIST } from '../../data/surahs';
import { getSurahMindMap } from '../../data/mindmaps/mindmapData';
import { globalAudio } from '../../services/audioManager';
import {
  Shuffle,
  HelpCircle,
  CheckCircle2,
  RotateCcw,
  Volume2,
  ArrowRight,
  Award,
  Brain,
  BookOpen,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Layers,
  ChevronRight,
  ChevronLeft,
  Target
} from 'lucide-react';

/** Pick a random Mushaf page respecting an optional scope */
function pickInitialPage(scope?: QuizScope): number {
  if (!scope?.surahNumber) return Math.floor(Math.random() * 604) + 1;
  const surah = SURAHS_LIST.find(s => s.number === scope.surahNumber);
  if (!surah) return Math.floor(Math.random() * 604) + 1;
  const span = surah.endPage - surah.startPage + 1;
  return surah.startPage + Math.floor(Math.random() * span);
}

interface RandomPageQuizProps {
  onNavigateToMushaf: (pageNumber: number) => void;
  onOpenMindMap: (surahNumber: number) => void;
  onOpenSectionMap?: (surahNumber: number, branchId?: string, startAyah?: number, endAyah?: number) => void;
  /** If provided, quiz is scoped to a specific surah / ayah range */
  scope?: QuizScope;
}

export const RandomPageQuiz: React.FC<RandomPageQuizProps> = ({
  onNavigateToMushaf,
  onOpenMindMap,
  onOpenSectionMap,
  scope,
}) => {
  const [pageNumber, setPageNumber] = useState<number>(() => pickInitialPage(scope));
  const [pageData, setPageData] = useState<QuranPageData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [retryTick, setRetryTick] = useState<number>(0);

  // The starting visible Ayah index (chosen randomly across all verses on the page!)
  const [startIndex, setStartIndex] = useState<number>(0);
  
  // Set of indices currently revealed
  const [revealedSet, setRevealedSet] = useState<Set<number>>(new Set([0]));
  
  // Active target index to guess
  const [targetIndex, setTargetIndex] = useState<number>(1);
  
  const [isPageComplete, setIsPageComplete] = useState<boolean>(false);
  const [selectedJuzRange, setSelectedJuzRange] = useState<string>('all');
  const [playingAyahNumber, setPlayingAyahNumber] = useState<number | null>(null);

  // Zoom / Font Scale — auto-fits the page to the frame at any viewport size
  const frameRef = useRef<HTMLDivElement>(null);
  const [mushafTheme, setMushafTheme] = useMushafTheme();
  const { fontScale, zoomIn, zoomOut, reset: resetZoom } = useFitFontScale(
    frameRef,
    pageNumber,
    `${isLoading}-${pageData?.pageNumber}-${revealedSet.size}-${targetIndex}`
  );

  // Subscribe to global audio
  useEffect(() => {
    const unsub = globalAudio.subscribe((playingId) => {
      if (!playingId || !playingId.startsWith('quiz-')) {
        setPlayingAyahNumber(null);
      }
    });
    return () => unsub();
  }, []);

  const loadRandomPage = () => {
    globalAudio.stop();
    // If scoped to a surah, always pick from that surah's pages
    if (scope?.surahNumber) {
      setPageNumber(pickInitialPage(scope));
      return;
    }
    let randomP = 1;
    if (selectedJuzRange === 'all') {
      randomP = Math.floor(Math.random() * 604) + 1;
    } else if (selectedJuzRange === '30') {
      randomP = Math.floor(Math.random() * (604 - 582 + 1)) + 582;
    } else if (selectedJuzRange === '29') {
      randomP = Math.floor(Math.random() * (581 - 562 + 1)) + 562;
    } else {
      const juzNum = parseInt(selectedJuzRange);
      const startP = (juzNum - 1) * 20 + 2;
      randomP = Math.min(604, Math.max(1, startP + Math.floor(Math.random() * 20)));
    }
    setPageNumber(randomP);
  };

  // Pick another random starting ayah on the current page
  const pickRandomStartingAyah = (data: QuranPageData) => {
    globalAudio.stop();
    const totalAyahs = data.ayahs.length;
    let chosenStart = 0;
    if (totalAyahs > 1) {
      chosenStart = Math.floor(Math.random() * (totalAyahs - 1));
    }
    setStartIndex(chosenStart);
    setRevealedSet(new Set([chosenStart]));
    setTargetIndex(chosenStart + 1);
    setIsPageComplete(false);
  };

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setLoadFailed(false);
    fetchQuranPage(pageNumber)
      .then((data) => {
        if (!alive) return;
        setPageData(data);
        setIsLoading(false);
        pickRandomStartingAyah(data);
      })
      .catch(() => {
        if (!alive) return;
        setLoadFailed(true);
        setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [pageNumber, retryTick]);

  // Finishing a page counts as practice for today's streak
  useEffect(() => {
    if (isPageComplete) library.touchToday();
  }, [isPageComplete]);

  // Stop any recitation when leaving the quiz
  useEffect(() => () => {
    if (globalAudio.getPlayingId()?.startsWith('quiz-')) globalAudio.stop();
  }, []);

  // Reveal next Ayah
  const handleRevealNext = () => {
    if (!pageData) return;
    
    if (targetIndex < pageData.ayahs.length) {
      const newRevealed = new Set(revealedSet);
      newRevealed.add(targetIndex);
      setRevealedSet(newRevealed);

      if (targetIndex + 1 < pageData.ayahs.length) {
        setTargetIndex(targetIndex + 1);
      } else {
        setIsPageComplete(true);
      }
    } else {
      setIsPageComplete(true);
    }
  };

  const handleSelectAyahAsStartingClue = (idx: number) => {
    if (!pageData) return;
    globalAudio.stop();
    setStartIndex(idx);
    setRevealedSet(new Set([idx]));
    setTargetIndex(idx + 1 < pageData.ayahs.length ? idx + 1 : idx);
    setIsPageComplete(idx + 1 >= pageData.ayahs.length);
  };

  const handlePlayAudio = (ayah: Ayah) => {
    const id = `quiz-${ayah.numberInQuran}`;
    if (globalAudio.isPlaying(id)) {
      globalAudio.stop();
      setPlayingAyahNumber(null);
      return;
    }

    setPlayingAyahNumber(ayah.numberInQuran);
    const url = getAyahAudioUrl(ayah.numberInQuran);
    globalAudio.play(id, url, () => setPlayingAyahNumber(null));
  };

  const handleTopicClick = (b: any) => {
    if (onOpenSectionMap) {
      onOpenSectionMap(pageData!.surahNumber, b.id, b.ayahRange?.start, b.ayahRange?.end);
    } else {
      onOpenMindMap(pageData!.surahNumber);
    }
  };

  if (loadFailed) {
    return <LoadError onRetry={() => setRetryTick((n) => n + 1)} />;
  }

  if (isLoading || !pageData || pageData.ayahs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4" dir="rtl">
        <Shuffle className="w-10 h-10 text-amber-500 animate-spin" />
        <p className="font-cairo">جارٍ اختيار صفحة وتجهيز الصفحة التفاعلية...</p>
      </div>
    );
  }

  const currentSurah = SURAHS_LIST.find(s => s.number === pageData.surahNumber);
  const targetNextAyah = pageData.ayahs[targetIndex];
  const startingAyah = pageData.ayahs[startIndex];
  const surahMindMap = getSurahMindMap(pageData.surahNumber);

  // Scope label for header
  const scopeLabel = scope?.label ?? 'القرآن الكريم كاملاً';

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none" dir="rtl">
      {/* Top Header Bar */}
      <header className="bg-slate-900 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateToMushaf(pageNumber)}
            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
            title="العودة للمصحف"
            aria-label="العودة للمصحف"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          <div>
            <h2 className="text-sm sm:text-base font-bold text-amber-300 font-cairo flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400 shrink-0" />
              اختبار: {scopeLabel}
            </h2>
            <p className="text-xs text-slate-400">
              صفحة {pageNumber} • الجزء {pageData.juzNumber} • سورة {pageData.surahName} (الآية المرئية: {startingAyah?.numberInSurah})
            </p>
          </div>
        </div>

        {/* Top Actions & Zoom */}
        <div className="flex items-center gap-2">
          {/* Zoom In / Out Controls */}
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

          <MushafThemePicker value={mushafTheme} onChange={setMushafTheme} />

          <button
            onClick={() => pickRandomStartingAyah(pageData)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
            title="اختيار آية عشوائية أخرى بالصفحة"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">آية أخرى بالصفحة</span>
          </button>

          <button
            onClick={loadRandomPage}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-900/40 transition-all cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>صفحة عشوائية</span>
          </button>
        </div>
      </header>

      {/* 3-Column Studio Layout */}
      <div className="flex-1 flex overflow-hidden p-2 sm:p-4 gap-3 lg:gap-4 justify-between items-stretch">
        
        {/* RIGHT PANEL: Surah Mind Map Topics (Click to swim in Section Map!) */}
        <aside className="hidden xl:flex flex-col w-72 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shrink-0 overflow-y-auto">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-3">
            <Brain className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-xs text-amber-300">
              خريطة سورة {pageData.surahName}
            </h3>
          </div>

          <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs text-slate-200 mb-3">
            <span className="font-bold text-amber-400 block mb-1">المحور العام للسورة:</span>
            <p className="leading-relaxed font-cairo text-xs text-slate-300">
              {surahMindMap.centralTheme}
            </p>
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>محاور السورة:</span>
              <span className="text-xs text-emerald-400 font-normal">انقر لفتح خريطة المقطع</span>
            </div>
            {surahMindMap.branches.map((b) => (
              <div
                key={b.id}
                onClick={() => handleTopicClick(b)}
                className="p-2.5 rounded-xl border bg-slate-950/80 hover:bg-slate-900 hover:border-amber-400 cursor-pointer transition-all text-xs group"
                style={{ borderColor: `${b.color || '#3B82F6'}40` }}
                title="انقر لفتح خريطة الآيات الكاملة لهذا المحور والسباحة بينها"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                    <span className="font-bold text-white text-xs group-hover:text-amber-300 transition-colors">{b.title}</span>
                  </div>
                  <Brain className="w-3 h-3 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                </div>
                {b.ayahRange && (
                  <span className="text-xs text-slate-400 block">
                    الآيات ({b.ayahRange.start} - {b.ayahRange.end})
                  </span>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => onOpenMindMap(pageData.surahNumber)}
            className="mt-3 w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>عرض الشجرة الذهنية الكلية</span>
          </button>
        </aside>

        {/* CENTER MAIN: The Complete Mushaf Page */}
        <main className="flex-1 flex flex-col justify-between items-center max-w-4xl mx-auto h-full overflow-hidden">
          
          {/* Question Prompt Callout */}
          <div className="w-full text-center shrink-0 mb-2">
            {!isPageComplete && targetNextAyah ? (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs sm:text-sm shadow-md animate-pulse">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>الآية المرئية رقم ({startingAyah?.numberInSurah}) — ما هي الآية التالية؟ ﴿ آية {targetNextAyah.numberInSurah} ﴾</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ما شاء الله! تم كشف وتسميع كامل آيات الصفحة بنجاح</span>
              </div>
            )}
          </div>

          {/* Full Mushaf Page Frame */}
          <div
            ref={frameRef}
            data-mushaf-theme={mushafTheme}
            className="w-full flex-1 min-h-0 rounded-2xl p-4 sm:p-6 shadow-2xl border-[8px] sm:border-[10px] border-[#ecd8b5] outline outline-1 outline-[#caa46e] relative flex flex-col justify-between overflow-x-hidden overflow-y-auto"
            style={{ fontSize: `${fontScale * 100}%`, background: 'var(--mushaf-bg)', color: 'var(--mushaf-text)' }}
          >
            {/* Decorative Corner Borders */}
            <div className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-[#caa46e]" />
            <div className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-[#caa46e]" />
            <div className="absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-[#caa46e]" />
            <div className="absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-[#caa46e]" />

            {/* Page Header */}
            <div className="flex items-center justify-between border-b border-[#dfcaa7] pb-1.5 mb-2 text-xs font-bold font-cairo shrink-0" style={{ color: 'var(--mushaf-muted)' }}>
              <div>الجزء {pageData.juzNumber}</div>
              <div className="text-sm font-bold" style={{ color: 'var(--mushaf-text)' }}>سورة {pageData.surahName}</div>
              <div>صفحة {pageData.pageNumber}</div>
            </div>

            {/* Surah Header if first page of Surah */}
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

            {/* Flowing Verses Across Full Page Layout */}
            <div
              className="flex-1 font-amiri text-[1.35em] leading-[2.4] text-justify font-normal select-none"
            >
              <div className="text-justify w-full">
                {pageData.ayahs.map((ayah, idx) => {
                  const isRevealed = revealedSet.has(idx);
                  const isTargetNext = !isPageComplete && idx === targetIndex;
                  const isPlaying = playingAyahNumber === ayah.numberInQuran;
                  const isStartingAyah = idx === startIndex;
                  const words = ayah.words || ayah.textUthmani.split(' ');

                  if (isRevealed) {
                    return (
                      <span
                        key={ayah.numberInQuran}
                        onClick={() => handlePlayAudio(ayah)}
                        className={`inline transition-all duration-300 rounded-md px-1 py-0.5 cursor-pointer ${
                          isPlaying 
                            ? 'bg-amber-300 text-amber-950 ring-2 ring-amber-500 font-bold' 
                            : isStartingAyah 
                              ? 'bg-blue-100/90 text-blue-950 font-bold ring-1 ring-blue-400' 
                              : 'bg-emerald-100/80 text-emerald-950 font-semibold'
                        }`}
                        title="انقر للاستماع للآية"
                      >
                        {ayah.textUthmani}
                        <span className="inline-flex items-center justify-center w-6 h-6 mx-1 text-xs font-bold text-[#6b4c1e] bg-[#eedec0] border border-[#caa46e] rounded-full align-middle font-cairo shadow-inner">
                          {ayah.numberInSurah}
                        </span>
                      </span>
                    );
                  }

                  if (isTargetNext) {
                    return (
                      <span
                        key={ayah.numberInQuran}
                        className="inline bg-amber-100/60 rounded-lg px-1 py-0.5 border-2 border-dashed border-amber-500 mx-0.5"
                      >
                        {words.map((w, wIdx) => (
                          <span
                            key={wIdx}
                            className="inline-block bg-amber-200/90 border border-amber-400 rounded px-2 py-0.5 m-0.5 text-xs text-amber-900 font-bold font-cairo shadow-sm"
                          >
                            ؟
                          </span>
                        ))}
                        <span className="inline-flex items-center justify-center w-6 h-6 mx-0.5 text-xs font-bold text-amber-800 bg-amber-300 border border-amber-600 rounded-full align-middle font-cairo shadow-sm animate-bounce">
                          {ayah.numberInSurah}
                        </span>
                      </span>
                    );
                  }

                  // Other Masked Ayahs on the Page
                  return (
                    <span
                      key={ayah.numberInQuran}
                      onClick={() => handleSelectAyahAsStartingClue(idx)}
                      className="inline opacity-80 cursor-pointer group"
                      title={`انقر لبدء التحدي من الآية ${ayah.numberInSurah}`}
                    >
                      {words.map((w, wIdx) => (
                        <span
                          key={wIdx}
                          className="inline-block bg-[#eedec0]/70 group-hover:bg-[#e4cfaf] border border-[#dfcaa7] rounded px-2.5 py-0.5 m-0.5 text-transparent select-none shadow-inner align-middle h-5 min-w-6 transition-colors"
                        >
                          {w}
                        </span>
                      ))}
                      <span className="inline-flex items-center justify-center w-6 h-6 mx-0.5 text-xs font-bold text-[#8a6833]/70 group-hover:text-amber-800 bg-[#eedec0]/60 group-hover:bg-amber-200 border border-[#caa46e]/50 rounded-full align-middle font-cairo transition-colors">
                        {ayah.numberInSurah}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Page Footer */}
            <div className="pt-1.5 border-t border-[#dfcaa7] flex items-center justify-between text-xs font-cairo font-bold shrink-0 mt-2" style={{ color: 'var(--mushaf-muted)' }}>
              <span>مصحف الخرائط الذهنية</span>
              <span className="w-6 h-6 rounded-full border border-[#caa46e] flex items-center justify-center text-xs font-bold bg-[#eedec0]">
                {pageData.pageNumber}
              </span>
              <span>{currentSurah?.translation || ''}</span>
            </div>
          </div>
        </main>

        {/* LEFT PANEL: Interactive Controls, Actions & Quick Ayah Clue */}
        <aside className="hidden lg:flex flex-col w-72 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shrink-0 justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-bold text-xs text-amber-300">لوحة التحكم بالتحدي</span>
              <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-cairo">
                {revealedSet.size} / {pageData.ayahs.length} مكتمل
              </span>
            </div>

            {/* Big Next Button */}
            {!isPageComplete && targetNextAyah ? (
              <button
                onClick={handleRevealNext}
                className="w-full py-4 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-base rounded-2xl shadow-xl shadow-emerald-950/60 border-2 border-emerald-400 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>اكشف الآية ({targetNextAyah.numberInSurah})</span>
              </button>
            ) : (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500 rounded-xl text-center space-y-2">
                <Award className="w-8 h-8 text-yellow-400 mx-auto animate-bounce" />
                <p className="text-xs font-bold text-emerald-300">أتممت تسميع آيات الصفحة بالكامل!</p>
                <button
                  onClick={loadRandomPage}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-all"
                >
                  صفحة عشوائية جديدة
                </button>
              </div>
            )}

            {/* Active Visible Ayah Details */}
            {startingAyah && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>الآية المنطلق منها:</span>
                  <span className="text-blue-400 font-bold">آية {startingAyah.numberInSurah}</span>
                </div>
                <p className="font-amiri text-sm text-slate-200 line-clamp-2">
                  {startingAyah.textUthmani}
                </p>
                <button
                  onClick={() => handlePlayAudio(startingAyah)}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    playingAyahNumber === startingAyah.numberInQuran
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-300'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{playingAyahNumber === startingAyah.numberInQuran ? 'إيقاف التلاوة' : 'استماع للآية'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Bottom Side Tools */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <button
              onClick={() => onNavigateToMushaf(pageNumber)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>عرض في المصحف الكامل</span>
            </button>
          </div>
        </aside>

      </div>

      {/* Mobile Bottom Quick Actions */}
      <div className="lg:hidden bg-slate-900 border-t border-slate-800 p-2.5 flex items-center justify-between gap-2 shrink-0">
        {!isPageComplete && targetNextAyah ? (
          <button
            onClick={handleRevealNext}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>اكشف الآية التالية ({targetNextAyah.numberInSurah})</span>
          </button>
        ) : (
          <button
            onClick={loadRandomPage}
            className="flex-1 py-3 bg-amber-500 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2"
          >
            <Shuffle className="w-4 h-4" />
            <span>صفحة عشوائية جديدة</span>
          </button>
        )}
      </div>
    </div>
  );
};
