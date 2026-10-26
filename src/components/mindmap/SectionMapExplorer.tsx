import React, { useState, useEffect, useRef } from 'react';
import { Ayah, MindMapNode, SurahMindMap } from '../../types';
import { fetchSurahAyahRange, getAyahAudioUrl } from '../../services/quranApi';
import { LoadError } from '../ui/kit';
import { getSurahMindMap } from '../../data/mindmaps/mindmapData';
import { SURAHS_LIST } from '../../data/surahs';
import { globalAudio } from '../../services/audioManager';
import { 
  ArrowRight, 
  Brain, 
  BookOpen, 
  Play, 
  Pause, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Sparkles,
  Layers,
  ChevronRight,
  ChevronLeft,
  Volume2
} from 'lucide-react';

interface SectionMapExplorerProps {
  surahNumber: number;
  branchId?: string;
  startAyah?: number;
  endAyah?: number;
  onNavigateToMushaf: (pageNumber: number) => void;
  onSelectSurahMindMap: (surahNumber: number) => void;
}

export const SectionMapExplorer: React.FC<SectionMapExplorerProps> = ({
  surahNumber,
  branchId,
  startAyah = 1,
  endAyah = 20,
  onNavigateToMushaf,
  onSelectSurahMindMap,
}) => {
  const [mindMap, setMindMap] = useState<SurahMindMap>(() => getSurahMindMap(surahNumber));
  const [activeBranch, setActiveBranch] = useState<MindMapNode>(() => {
    const map = getSurahMindMap(surahNumber);
    if (branchId) {
      const found = map.branches.find(b => b.id === branchId);
      if (found) return found;
    }
    return map.branches[0] || {
      id: `${surahNumber}-b1`,
      title: "محور السورة",
      ayahRange: { start: startAyah, end: endAyah },
      color: '#2563EB',
    };
  });

  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [retryTick, setRetryTick] = useState<number>(0);
  
  // Canvas Zoom / Pan state ("swim between them like in a map")
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Audio Playback
  const [currentPlayingAyah, setCurrentPlayingAyah] = useState<number | null>(null);
  const [isAutoPlaySection, setIsAutoPlaySection] = useState<boolean>(false);

  // Subscribe to global audio
  useEffect(() => {
    const unsubscribe = globalAudio.subscribe((playingId) => {
      if (!playingId) {
        setCurrentPlayingAyah(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Update when surah or branch changes
  useEffect(() => {
    const loadedMap = getSurahMindMap(surahNumber);
    setMindMap(loadedMap);
    
    let target = activeBranch;
    if (branchId) {
      const found = loadedMap.branches.find(b => b.id === branchId);
      if (found) target = found;
    }
    setActiveBranch(target);
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });

    const fromAyah = target.ayahRange?.start || startAyah;
    const toAyah = target.ayahRange?.end || endAyah;

    let alive = true;
    setIsLoading(true);
    setLoadFailed(false);
    fetchSurahAyahRange(surahNumber, fromAyah, toAyah)
      .then((data) => {
        if (!alive) return;
        setAyahs(data);
        setIsLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setLoadFailed(true);
        setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [surahNumber, branchId, activeBranch.id, retryTick]);

  // Pan handlers for canvas navigation
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && (e.target.closest('button') || e.target.closest('select') || e.target.closest('a'))) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Play single Ayah Audio with Global AudioManager
  const handlePlayAyah = (ayah: Ayah, idx: number) => {
    if (currentPlayingAyah === ayah.numberInQuran) {
      globalAudio.stop();
      setCurrentPlayingAyah(null);
      setIsAutoPlaySection(false);
      return;
    }

    setCurrentPlayingAyah(ayah.numberInQuran);
    const url = getAyahAudioUrl(ayah.numberInQuran);
    globalAudio.play(`section-${ayah.numberInQuran}`, url, () => {
      if (isAutoPlaySection && idx + 1 < ayahs.length) {
        handlePlayAyah(ayahs[idx + 1], idx + 1);
      } else {
        setCurrentPlayingAyah(null);
        setIsAutoPlaySection(false);
      }
    });
  };

  // Autoplay whole section
  const handleToggleAutoplay = () => {
    if (isAutoPlaySection) {
      globalAudio.stop();
      setIsAutoPlaySection(false);
      setCurrentPlayingAyah(null);
    } else {
      if (ayahs.length > 0) {
        setIsAutoPlaySection(true);
        handlePlayAyah(ayahs[0], 0);
      }
    }
  };

  const surahMeta = SURAHS_LIST.find(s => s.number === surahNumber);
  const branchColor = activeBranch.color || '#2563EB';

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden" dir="rtl">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectSurahMindMap(surahNumber)}
            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
            title="العودة لشجرة السورة" aria-label="العودة لشجرة السورة"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: branchColor }} />
              <h2 className="text-sm sm:text-base font-bold text-amber-300 font-cairo">
                خريطة المقطع: {activeBranch.title}
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              سورة {surahMeta?.name} • الآيات ({activeBranch.ayahRange?.start || startAyah} إلى {activeBranch.ayahRange?.end || endAyah}) • {ayahs.length} آية
            </p>
          </div>
        </div>

        {/* Action Controls & Zoom */}
        <div className="flex items-center gap-2">
          {/* Autoplay Section Audio */}
          <button
            onClick={handleToggleAutoplay}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              isAutoPlaySection 
                ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse' 
                : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-amber-300'
            }`}
          >
            {isAutoPlaySection ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isAutoPlaySection ? 'إيقاف التلاوة' : 'تلاوة المقطع كاملاً'}</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 p-0.5">
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.15, 2.0))}
              className="p-1 hover:bg-slate-700 text-slate-300 rounded-lg"
              title="تكبير الخريطة" aria-label="تكبير الخريطة"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.15, 0.5))}
              className="p-1 hover:bg-slate-700 text-slate-300 rounded-lg"
              title="تصغير الخريطة" aria-label="تصغير الخريطة"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setZoomLevel(1); setPanPosition({ x: 0, y: 0 }); }}
              className="p-1 hover:bg-slate-700 text-slate-300 rounded-lg"
              title="إعادة ضبط الموضع" aria-label="إعادة ضبط الموضع"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace: 2-Column Canvas Studio */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Right Sidebar: Switch Topic Branches */}
        <aside className="hidden md:flex flex-col w-64 bg-slate-900/90 border-l border-slate-800 p-3 shrink-0 overflow-y-auto">
          <span className="text-xs font-bold text-slate-400 block mb-2">
            محاور سورة {surahMeta?.name}:
          </span>
          <div className="space-y-1.5 flex-1">
            {mindMap.branches.map((b) => {
              const isActive = b.id === activeBranch.id;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    setActiveBranch(b);
                    globalAudio.stop();
                    setIsAutoPlaySection(false);
                  }}
                  className={`w-full text-right p-2.5 rounded-xl border transition-all text-xs font-semibold ${
                    isActive 
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-md ring-1 ring-amber-400' 
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color || '#3B82F6' }} />
                    <span className="truncate">{b.title}</span>
                  </div>
                  {b.ayahRange && (
                    <span className="text-xs text-slate-400 block font-cairo">
                      آية {b.ayahRange.start} إلى {b.ayahRange.end}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onSelectSurahMindMap(surahNumber)}
            className="mt-3 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Brain className="w-3.5 h-3.5 text-emerald-400" />
            <span>الشجرة الذهنية الكلية</span>
          </button>
        </aside>

        {/* Center: Infinite Canvas Map ("Swim between ayahs like in a map") */}
        <div
          className={`flex-1 relative bg-radial-gradient from-slate-900 to-slate-950 overflow-hidden cursor-${isDragging ? 'grabbing' : 'grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Canvas Dot Pattern */}
          <div 
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          {/* Interactive Transform Canvas */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-start p-8 transition-transform duration-75 overflow-y-auto"
            style={{
              transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
              transformOrigin: 'top center',
            }}
          >
            {/* Thematic Section Header Node */}
            <div className="mb-8 text-center shrink-0">
              <div 
                className="inline-block p-6 rounded-3xl border-2 shadow-2xl relative max-w-xl text-center backdrop-blur-md"
                style={{
                  backgroundColor: `${branchColor}25`,
                  borderColor: branchColor,
                }}
              >
                <span className="text-xs uppercase tracking-widest text-amber-400 font-bold block mb-1">
                  محور الخريطة الذهنية
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-white font-cairo">
                  {activeBranch.title}
                </h1>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed font-cairo">
                  {activeBranch.description || "تأمل تدفق الآيات الكريمة وترابط موضوعاتها وسياقها العام."}
                </p>
                <div className="mt-3 inline-block px-3 py-1 bg-black/40 rounded-full text-xs font-bold text-amber-300 border border-amber-500/30">
                  سورة {surahMeta?.name} • الآيات {activeBranch.ayahRange?.start} إلى {activeBranch.ayahRange?.end}
                </div>
              </div>
            </div>

            {/* Ayahs Constellation Flow */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <Brain className="w-10 h-10 text-amber-500 animate-spin" />
                <p className="font-cairo text-sm">جارٍ بناء خريطة الآيات التفاعلية...</p>
              </div>
            ) : loadFailed ? (
              <div className="py-16">
                <LoadError onRetry={() => setRetryTick((n) => n + 1)} />
              </div>
            ) : (
              <div className="w-full max-w-4xl space-y-4 pb-20">
                {ayahs.map((ayah, idx) => {
                  const isPlaying = currentPlayingAyah === ayah.numberInQuran;

                  return (
                    <div
                      key={ayah.numberInQuran}
                      className={`relative bg-slate-900/90 border-2 rounded-2xl p-5 shadow-xl transition-all duration-300 hover:scale-[1.01] ${
                        isPlaying 
                          ? 'border-amber-400 ring-4 ring-amber-500/40 bg-amber-950/30 shadow-[0_0_30px_rgba(245,158,11,0.3)]' 
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Connection Line from previous ayah */}
                      {idx > 0 && (
                        <div 
                          className="absolute -top-4 right-1/2 w-0.5 h-4 -translate-x-1/2"
                          style={{ backgroundColor: `${branchColor}60` }}
                        />
                      )}

                      {/* Card Header */}
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center text-white shadow-md font-cairo"
                            style={{ backgroundColor: branchColor }}
                          >
                            {ayah.numberInSurah}
                          </span>
                          <span className="text-xs font-bold text-slate-300">
                            آية رقم {ayah.numberInSurah} (صفحة {ayah.page})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Audio Play Button */}
                          <button
                            onClick={() => handlePlayAyah(ayah, idx)}
                            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                              isPlaying 
                                ? 'bg-rose-500 text-white' 
                                : 'bg-slate-800 hover:bg-slate-700 text-amber-300'
                            }`}
                            title="استماع للآية" aria-label="استماع للآية"
                          >
                            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            <span className="text-xs">{isPlaying ? 'إيقاف' : 'استماع'}</span>
                          </button>

                          {/* Jump to Mushaf Page */}
                          <button
                            onClick={() => onNavigateToMushaf(ayah.page)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                            title="قراءة في المصحف" aria-label="قراءة في المصحف"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span className="text-xs">ص {ayah.page}</span>
                          </button>
                        </div>
                      </div>

                      {/* Ayah Arabic Uthmani Text */}
                      <div className="font-amiri text-2xl sm:text-3xl leading-[2.6] text-right text-slate-100 py-1">
                        {ayah.textUthmani}
                        <span className="inline-flex items-center justify-center w-7 h-7 mx-1 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/40 rounded-full align-middle font-cairo">
                          {ayah.numberInSurah}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
