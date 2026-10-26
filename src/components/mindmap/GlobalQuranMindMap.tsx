import React, { useState, useEffect, useRef } from 'react';
import { SURAHS_LIST } from '../../data/surahs';
import { getSurahMindMap } from '../../data/mindmaps/mindmapData';
import { SurahMeta } from '../../types';
import { Brain, BookOpen, Search, Filter, Sparkles, Compass, ArrowDownUp, Clock } from 'lucide-react';

type SortMode = 'mushaf' | 'revelation';

interface GlobalQuranMindMapProps {
  onSelectSurah: (surahNumber: number) => void;
  onNavigateToMushaf: (pageNumber: number) => void;
}

export const GlobalQuranMindMap: React.FC<GlobalQuranMindMapProps> = ({
  onSelectSurah,
  onNavigateToMushaf,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'Meccan' | 'Medinan'>('all');
  const [selectedJuz, setSelectedJuz] = useState<number | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('mushaf');

  // Track how many cards are visible (staggered entrance animation)
  const [visibleCount, setVisibleCount] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset + replay animation on mount and every time sort mode changes
  useEffect(() => {
    // Clear any running animation
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisibleCount(0);

    // Reveal 3 cards every 30ms → 114 cards in ~1.1 s, clearly visible wave
    let count = 0;
    const BATCH = 3;
    const INTERVAL = 30;

    const step = () => {
      count = Math.min(count + BATCH, 114);
      setVisibleCount(count);
      if (count < 114) {
        timerRef.current = setTimeout(step, INTERVAL);
      }
    };

    // Short initial pause so the layout paints at 0 first
    timerRef.current = setTimeout(step, 50);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sortMode]);

  const filteredSurahs = SURAHS_LIST.filter((s) => {
    const matchesSearch =
      s.name.includes(searchQuery) ||
      (s.mainTheme && s.mainTheme.includes(searchQuery)) ||
      s.number.toString() === searchQuery;
    const matchesType = filterType === 'all' || s.revelationType === filterType;
    const matchesJuz = selectedJuz === 'all' || s.juz.includes(Number(selectedJuz));
    return matchesSearch && matchesType && matchesJuz;
  });

  // Apply sort
  const sortedSurahs = [...filteredSurahs].sort((a, b) =>
    sortMode === 'revelation'
      ? a.revelationOrder - b.revelationOrder
      : a.number - b.number
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto" dir="rtl">
      {/* Hero Header */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-amber-500/20 px-6 py-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold mb-3">
          <Compass className="w-4 h-4" />
          <span>الخريطة الكبرى للقرآن الكريم</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 font-cairo">
          الربط الشامل لمقاصد ومحاور سور القرآن الكريم
        </h1>
        <p className="mt-2 text-slate-400 text-sm max-w-2xl mx-auto font-cairo">
          تصفح الـ 114 سورة وموضوعاتها الكلية، مع تقسيماتها وفروعها الذهنية وروابطها بمواضع الآيات في المصحف.
        </p>

        {/* Search & Filters */}
        <div className="mt-6 max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              placeholder="ابحث باسم السورة، رقمها، أو موضوعها..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pr-10 pl-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Revelation Type Filter */}
          <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700 text-xs font-bold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
            >
              الكل (114)
            </button>
            <button
              onClick={() => setFilterType('Meccan')}
              className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'Meccan' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
            >
              مكية
            </button>
            <button
              onClick={() => setFilterType('Medinan')}
              className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'Medinan' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
            >
              مدنية
            </button>
          </div>

          {/* Juz Filter */}
          <select
            value={selectedJuz}
            onChange={(e) => setSelectedJuz(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-slate-800/80 border border-slate-700 text-xs font-bold text-amber-300 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">جميع الأجزاء (30 جزء)</option>
            {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
              <option key={juz} value={juz}>الجزء {juz}</option>
            ))}
          </select>

          {/* Sort Toggle */}
          <button
            onClick={() => setSortMode(prev => prev === 'mushaf' ? 'revelation' : 'mushaf')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              sortMode === 'revelation'
                ? 'bg-violet-600 border-violet-400 text-white shadow-lg shadow-violet-900/40'
                : 'bg-slate-800/80 border-slate-700 text-violet-300 hover:bg-slate-800'
            }`}
            title={sortMode === 'revelation' ? 'العرض بترتيب المصحف' : 'العرض بترتيب النزول'}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{sortMode === 'revelation' ? 'ترتيب النزول ✓' : 'ترتيب النزول'}</span>
          </button>
        </div>

        {/* Revelation-order info banner */}
        {sortMode === 'revelation' && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-900/30 border border-violet-500/30 text-violet-300 text-xs font-cairo animate-fade-in">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>
              السور مرتبة حسب ترتيب النزول — من أول ما نزل (العلق) إلى آخره (النصر)
            </span>
          </div>
        )}
      </div>

      {/* Surahs Mind Map Grid */}
      <main className="p-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedSurahs.map((surah, idx) => {
            const mindMap = getSurahMindMap(surah.number);
            // Stagger: only show if idx < visibleCount
            const isVisible = idx < visibleCount;

            return (
              <div
                key={`${sortMode}-${surah.number}`}
                className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 shadow-xl transition-all duration-300 flex flex-col justify-between group"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.97)',
                  transition: 'opacity 0.28s ease, transform 0.28s ease',
                }}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      {/* Surah number badge */}
                      <span className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black flex items-center justify-center text-sm font-cairo">
                        {surah.number}
                      </span>
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                          سورة {surah.name}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {surah.totalVerses} آية • {surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} • الجزء {surah.juz.join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        ص {surah.startPage}
                      </span>
                      {/* Revelation order badge — always visible but highlighted in revelation sort mode */}
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border transition-colors ${
                          sortMode === 'revelation'
                            ? 'bg-violet-900/50 border-violet-500/50 text-violet-300'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                        }`}
                        title="ترتيب النزول"
                      >
                        نزولاً: {surah.revelationOrder}
                      </span>
                    </div>
                  </div>

                  {/* Central Theme */}
                  <div className="my-3 p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs">
                    <span className="font-bold text-amber-400 block mb-0.5">المحور والهدف الرئيسي:</span>
                    <p className="text-slate-200 leading-relaxed font-cairo">
                      {mindMap.centralTheme}
                    </p>
                  </div>

                  {/* Mind Map Branches Preview */}
                  <div className="space-y-1.5 my-3">
                    <span className="text-xs font-bold text-slate-400 block">
                      المحاور الرئيسية ({mindMap.branches.length} فروع):
                    </span>
                    {mindMap.branches.map((branch) => (
                      <div
                        key={branch.id}
                        className="text-xs p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-slate-300"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: branch.color || '#3B82F6' }} />
                          <span className="truncate font-semibold">{branch.title}</span>
                        </div>
                        {branch.ayahRange && (
                          <span className="text-xs text-slate-400 font-cairo shrink-0">
                            {branch.ayahRange.start}-{branch.ayahRange.end}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectSurah(surah.number)}
                    className="flex-1 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    <span>الخريطة التفاعلية</span>
                  </button>

                  <button
                    onClick={() => onNavigateToMushaf(surah.startPage)}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                    title="قراءة في المصحف" aria-label="قراءة في المصحف"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>المصحف</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};
