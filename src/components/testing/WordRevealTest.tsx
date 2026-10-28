import React, { useState, useEffect } from 'react';
import { Ayah, QuranPageData } from '../../types';
import { MushafThemePicker, useMushafTheme } from '../ui/MushafTheme';
import { LoadError } from '../ui/kit';
import { library, useLibrary } from '../../services/library';
import { globalAudio } from '../../services/audioManager';
import { fetchQuranPage, splitAyahIntoWords, splitWordIntoLetters, getAyahAudioUrl } from '../../services/quranApi';
import { SURAHS_LIST } from '../../data/surahs';
import { 
  Sparkles, 
  RotateCcw, 
  CheckCircle, 
  Award, 
  Volume2, 
  ChevronRight, 
  ChevronLeft, 
  Eye, 
  EyeOff, 
  Flame, 
  Trophy,
  ArrowRight,
  BookOpen
} from 'lucide-react';

interface WordRevealTestProps {
  initialPageNumber?: number;
  initialAyah?: Ayah | null;
  onNavigateToMushaf: (pageNumber: number) => void;
}

export const WordRevealTest: React.FC<WordRevealTestProps> = ({
  initialPageNumber = 1,
  initialAyah = null,
  onNavigateToMushaf,
}) => {
  const [pageNumber, setPageNumber] = useState<number>(initialAyah ? initialAyah.page : initialPageNumber);
  const [pageData, setPageData] = useState<QuranPageData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [retryTick, setRetryTick] = useState<number>(0);
  const [mushafTheme, setMushafTheme] = useMushafTheme();

  // Active testing state
  const [currentAyahIndex, setCurrentAyahIndex] = useState<number>(0);
  const [revealedWordCount, setRevealedWordCount] = useState<number>(0);
  const [revealedLetterCount, setRevealedLetterCount] = useState<number>(0);
  
  // Gamification (Duolingo style)
  const [xpPoints, setXpPoints] = useState<number>(0);
  // Real day-streak from the reader's activity history (not a made-up number)
  useLibrary();
  const streakCount = library.streak();
  const [completedAyahs, setCompletedAyahs] = useState<Set<number>>(new Set());
  const [showCelebration, setShowCelebration] = useState<boolean>(false);

  // Load page
  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setLoadFailed(false);
    fetchQuranPage(pageNumber)
      .then((data) => {
        if (!alive) return;
        setPageData(data);
        setIsLoading(false);

        // If initialAyah was specified, target it
        if (initialAyah) {
          const foundIndex = data.ayahs.findIndex(a => a.numberInSurah === initialAyah.numberInSurah);
          if (foundIndex >= 0) {
            setCurrentAyahIndex(foundIndex);
          }
        } else {
          setCurrentAyahIndex(0);
        }
        setRevealedWordCount(0);
        setRevealedLetterCount(0);
        setCompletedAyahs(new Set());
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

  // Stop any recitation when leaving the test
  useEffect(() => () => {
    if (globalAudio.getPlayingId()?.startsWith('reveal-')) globalAudio.stop();
  }, []);

  if (loadFailed) {
    return <LoadError onRetry={() => setRetryTick((n) => n + 1)} />;
  }

  if (isLoading || !pageData || pageData.ayahs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4" dir="rtl">
        <Sparkles className="w-10 h-10 text-amber-500 animate-spin" />
        <p className="font-cairo">جارٍ تجهيز اختبار الحفظ والاسترجاع...</p>
      </div>
    );
  }

  const currentAyah = pageData.ayahs[currentAyahIndex];
  const ayahWords = currentAyah ? splitAyahIntoWords(currentAyah.textUthmani) : [];
  const currentWord = ayahWords[revealedWordCount] || '';
  const currentWordLetters = splitWordIntoLetters(currentWord);

  // Action 1: Reveal Next Letter
  const handleRevealNextLetter = () => {
    if (revealedWordCount >= ayahWords.length) return;

    if (revealedLetterCount + 1 >= currentWordLetters.length) {
      // Completed this word via letter reveals
      setRevealedWordCount(prev => prev + 1);
      setRevealedLetterCount(0);
      setXpPoints(prev => prev + 5);
      
      if (revealedWordCount + 1 >= ayahWords.length) {
        handleAyahCompleted();
      }
    } else {
      setRevealedLetterCount(prev => prev + 1);
      setXpPoints(prev => prev + 2);
    }
  };

  // Action 2: Reveal Next Word
  const handleRevealNextWord = () => {
    if (revealedWordCount < ayahWords.length) {
      const nextCount = revealedWordCount + 1;
      setRevealedWordCount(nextCount);
      setRevealedLetterCount(0);
      setXpPoints(prev => prev + 10);

      if (nextCount >= ayahWords.length) {
        handleAyahCompleted();
      }
    }
  };

  // Action 3: Reveal Entire Next Ayah
  const handleRevealFullAyah = () => {
    setRevealedWordCount(ayahWords.length);
    setRevealedLetterCount(0);
    setXpPoints(prev => prev + 25);
    handleAyahCompleted();
  };

  // Ayah Completion
  const handleAyahCompleted = () => {
    setCompletedAyahs(prev => new Set(prev).add(currentAyahIndex));
    library.touchToday();

    if (currentAyahIndex + 1 < pageData.ayahs.length) {
      setTimeout(() => {
        setCurrentAyahIndex(prev => prev + 1);
        setRevealedWordCount(0);
        setRevealedLetterCount(0);
      }, 700);
    } else {
      setShowCelebration(true);
    }
  };

  // Reset Test
  const handleResetTest = () => {
    setCurrentAyahIndex(0);
    setRevealedWordCount(0);
    setRevealedLetterCount(0);
    setCompletedAyahs(new Set());
    setShowCelebration(false);
  };

  // Play pronunciation
  const handlePlayAyahAudio = () => {
    if (!currentAyah) return;
    const id = `reveal-${currentAyah.numberInQuran}`;
    if (globalAudio.isPlaying(id)) {
      globalAudio.stop();
      return;
    }
    globalAudio.play(id, getAyahAudioUrl(currentAyah.numberInQuran));
  };

  const progressPercentage = Math.round(
    ((completedAyahs.size) / pageData.ayahs.length) * 100
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto select-none" dir="rtl">
      {/* Top Gamification Bar (Duolingo Style) */}
      <header className="bg-slate-900 border-b border-indigo-500/30 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
        {/* Left: Progress & Page info */}
        <div className="flex items-center gap-4 flex-1 max-w-md">
          <button
            onClick={() => onNavigateToMushaf(pageNumber)}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
            title="العودة للمصحف"
            aria-label="العودة للمصحف"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <div className="flex-1">
            <div className="flex justify-between text-xs font-bold mb-1 text-slate-300">
              <span>تقدم حفظ الصفحة ({pageNumber})</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Gamified Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-sm font-bold" title="أيام متتالية من القراءة والتدريب">
            <Flame className={`w-4 h-4 ${streakCount > 0 ? 'text-orange-500 fill-orange-500' : 'text-slate-400'}`} />
            <span>{streakCount} يوم متتالٍ</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-sm font-bold">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span>{xpPoints} XP</span>
          </div>

          <MushafThemePicker value={mushafTheme} onChange={setMushafTheme} />

          <button
            onClick={handleResetTest}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-700"
            title="إعادة اختبار الصفحة"
            aria-label="إعادة اختبار الصفحة"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Testing Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-4xl mx-auto w-full">
        {/* Ayah Meta Info */}
        <div className="text-center mb-6">
          <span className="text-xs font-bold px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full">
            سورة {pageData.surahName} • آية {currentAyah?.numberInSurah} من {pageData.ayahs.length} في الصفحة
          </span>
          <h2 className="text-sm font-semibold text-slate-400 mt-2 font-cairo">
            استحضر الكلمات في ذهنك واكشف الحرف أو الكلمة للتأكد من حفظك
          </h2>
        </div>

        {/* The Big Active Ayah Memorization Box */}
        <div data-mushaf-theme={mushafTheme} style={{ background: 'var(--mushaf-bg)', color: 'var(--mushaf-text)' }} className="w-full rounded-3xl p-6 sm:p-10 shadow-2xl border-4 border-[#caa46e] relative overflow-hidden min-h-[260px] flex flex-col justify-center items-center text-center">
          
          {/* Watermark Pattern */}
          <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center">
            <BookOpen className="w-96 h-96 text-amber-900" />
          </div>

          {/* Ayah Words Display */}
          <div className="font-amiri text-2xl sm:text-3xl md:text-4xl leading-[2.6] text-center flex flex-wrap items-center justify-center gap-x-3 gap-y-2 relative z-10" dir="rtl">
            {ayahWords.map((word, wIdx) => {
              const isRevealed = wIdx < revealedWordCount;
              const isCurrentWord = wIdx === revealedWordCount;
              const wordLetters = splitWordIntoLetters(word);

              if (isRevealed) {
                return (
                  <span 
                    key={wIdx} 
                    className="text-emerald-800 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-xl border border-emerald-300 animate-fade-in"
                  >
                    {word}
                  </span>
                );
              }

              if (isCurrentWord) {
                return (
                  <span 
                    key={wIdx} 
                    className="bg-amber-200/90 border-2 border-amber-500 px-3 py-0.5 rounded-xl shadow-md ring-2 ring-amber-400 text-slate-900 font-bold"
                  >
                    {wordLetters.map((letter, lIdx) => {
                      const isLetterRevealed = lIdx < revealedLetterCount;
                      return (
                        <span 
                          key={lIdx} 
                          className={isLetterRevealed ? 'text-amber-950 font-black' : 'text-transparent bg-amber-300/60 rounded px-1 mx-0.5'}
                        >
                          {isLetterRevealed ? letter : '_'}
                        </span>
                      );
                    })}
                  </span>
                );
              }

              // Hidden Future Words
              return (
                <span 
                  key={wIdx} 
                  className="bg-[#eedec0] border border-[#d8be96] text-transparent rounded-xl px-4 py-1 select-none shadow-inner"
                >
                  {word}
                </span>
              );
            })}

            {/* Ayah Number Badge */}
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-[#caa46e] bg-[#eedec0] text-[#61451b] text-base font-bold font-cairo mr-2">
              ﴿{currentAyah?.numberInSurah}﴾
            </span>
          </div>

          {/* Audio helper button */}
          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={handlePlayAyahAudio}
              className="px-3 py-1.5 bg-[#eedec0] hover:bg-[#e4cfaf] text-[#61451b] border border-[#caa46e] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Volume2 className="w-4 h-4 text-amber-700" />
              <span>استماع للآية</span>
            </button>
          </div>
        </div>

        {/* Action Controls (Duolingo Style Buttons) */}
        <div data-tour="reveal-buttons" className="mt-8 w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Button 1: Reveal Next Letter */}
          <button
            onClick={handleRevealNextLetter}
            className="py-4 px-6 bg-slate-800 hover:bg-slate-750 active:scale-95 border-2 border-slate-700 hover:border-indigo-500 text-indigo-300 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 shadow-lg transition-all"
          >
            <span className="text-lg">+ كشف حرف</span>
            <span className="text-xs text-slate-400 font-normal">كشف الحرف التالي بالكلمة (+2 XP)</span>
          </button>

          {/* Button 2: Reveal Next Word */}
          <button
            onClick={handleRevealNextWord}
            className="py-4 px-6 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-2xl font-bold flex flex-col items-center justify-center gap-1 shadow-xl shadow-indigo-900/40 border-2 border-indigo-400 transition-all"
          >
            <span className="text-lg">+ كشف كلمة</span>
            <span className="text-xs text-indigo-200 font-normal">كشف الكلمة كاملة (+10 XP)</span>
          </button>

          {/* Button 3: Reveal Full Ayah */}
          <button
            onClick={handleRevealFullAyah}
            className="py-4 px-6 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl font-bold flex flex-col items-center justify-center gap-1 shadow-xl shadow-emerald-900/40 border-2 border-emerald-400 transition-all"
          >
            <span className="text-lg">كشف الآية كاملة</span>
            <span className="text-xs text-emerald-200 font-normal">الانتقال للآية التالية (+25 XP)</span>
          </button>
        </div>

        {/* Completion Modal / Celebration */}
        {showCelebration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-md w-full p-8 text-center shadow-2xl">
              <Award className="w-16 h-16 text-yellow-400 mx-auto animate-bounce mb-3" />
              <h3 className="text-2xl font-black text-amber-300 font-cairo">
                ما شاء الله! تبارك الله
              </h3>
              <p className="text-slate-300 text-sm mt-2 font-cairo leading-relaxed">
                لقد أتممت بنجاح مراجعة واسترجاع جميع آيات الصفحة {pageNumber} لسورة {pageData.surahName}.
              </p>
              
              <div className="my-6 p-4 rounded-2xl bg-slate-800 border border-slate-700 flex justify-around text-center">
                <div>
                  <span className="text-xs text-slate-400 block">النقاط المكتسبة</span>
                  <span className="text-xl font-bold text-yellow-400">+{xpPoints} XP</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">الآيات المتقنة</span>
                  <span className="text-xl font-bold text-emerald-400">{pageData.ayahs.length} آيات</span>
                </div>
              </div>

              <div className="space-y-3">
                {pageNumber < 604 && (
                  <button
                    onClick={() => setPageNumber(prev => prev + 1)}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg"
                  >
                    الانتقال لاختبار الصفحة التالية ({pageNumber + 1})
                  </button>
                )}

                <button
                  onClick={() => onNavigateToMushaf(pageNumber)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-sm transition-all"
                >
                  العودة لقراءة المصحف
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
