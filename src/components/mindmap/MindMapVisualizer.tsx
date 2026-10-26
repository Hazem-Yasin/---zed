import React, { useState, useRef, useEffect } from 'react';
import { SurahMindMap, MindMapNode } from '../../types';
import { getSurahMindMap, THEME_COLORS } from '../../data/mindmaps/mindmapData';
import { SURAHS_LIST } from '../../data/surahs';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  BookOpen, 
  Image as ImageIcon,
  Printer,
  Plus, 
  Edit3, 
  ArrowRight, 
  Check, 
  X,
  Share2,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface MindMapVisualizerProps {
  surahNumber: number;
  onSelectSurah: (surahNumber: number) => void;
  onNavigateToMushaf: (pageNumber: number) => void;
  onOpenSectionMap?: (surahNumber: number, branchId?: string, startAyah?: number, endAyah?: number) => void;
}

export const MindMapVisualizer: React.FC<MindMapVisualizerProps> = ({
  surahNumber,
  onSelectSurah,
  onNavigateToMushaf,
  onOpenSectionMap,
}) => {
  const [mindMap, setMindMap] = useState<SurahMindMap>(() => getSurahMindMap(surahNumber));
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showOriginalBookRef, setShowOriginalBookRef] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [editingTheme, setEditingTheme] = useState<string>('');
  const [newBranchTitle, setNewBranchTitle] = useState<string>('');
  const [newBranchRange, setNewBranchRange] = useState<string>('1-10');

  useEffect(() => {
    const loadedMap = getSurahMindMap(surahNumber);
    setMindMap(loadedMap);
    setEditingTheme(loadedMap.centralTheme);
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  }, [surahNumber]);

  const surahMeta = SURAHS_LIST.find(s => s.number === surahNumber);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && (e.target.closest('button') || e.target.closest('input') || e.target.closest('select'))) {
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

  // Add Branch
  const handleAddBranch = () => {
    if (!newBranchTitle.trim()) return;
    const parts = newBranchRange.split('-').map(p => parseInt(p.trim()));
    const start = parts[0] || 1;
    const end = parts[1] || start;

    const newBranch: MindMapNode = {
      id: `${surahNumber}-b-${Date.now()}`,
      title: newBranchTitle.trim(),
      ayahRange: { start, end },
      color: Object.values(THEME_COLORS)[mindMap.branches.length % Object.values(THEME_COLORS).length],
      description: "موضوع مضاف مخصص",
    };

    setMindMap({
      ...mindMap,
      branches: [...mindMap.branches, newBranch],
    });
    setNewBranchTitle('');
  };

  // Reference image filename if available (shipped as optimised WebP)
  const rawRefImage = surahMeta?.referencePageImage || (mindMap.referenceImageIndex ? `Noor-Book.com  الخرائط الذهنية لسور القرآن الكريم_page-${String(mindMap.referenceImageIndex).padStart(4, '0')}.jpg` : null);
  const refImageName = rawRefImage ? rawRefImage.replace(/\.jpg$/i, '.webp') : null;

  return (
    <div className="mindmap-print-root flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden" dir="rtl">
      {/* Top Navbar */}
      <header className="no-print bg-slate-900 border-b border-amber-500/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3 z-30">
        <div className="flex items-center gap-3">
          <select
            value={surahNumber}
            onChange={(e) => onSelectSurah(parseInt(e.target.value))}
            className="bg-slate-800 border border-amber-500/30 rounded-xl px-4 py-2 font-bold text-amber-300 text-sm focus:outline-none focus:border-amber-400 cursor-pointer shadow-md"
          >
            {SURAHS_LIST.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. سورة {s.name} ({s.totalVerses} آية)
              </option>
            ))}
          </select>

          {surahMeta && (
            <button
              onClick={() => onNavigateToMushaf(surahMeta.startPage)}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              <span>فتح في المصحف (ص {surahMeta.startPage})</span>
            </button>
          )}
        </div>

        {/* View Tools */}
        <div className="flex items-center gap-2">
          {/* Toggle Reference Book Image */}
          {refImageName && (
            <button
              onClick={() => setShowOriginalBookRef(!showOriginalBookRef)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                showOriginalBookRef 
                  ? 'bg-purple-600 border-purple-400 text-white' 
                  : 'bg-slate-800 border-slate-700 text-purple-300 hover:bg-slate-700'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>{showOriginalBookRef ? 'إخفاء صورة الكتاب' : 'مرجع كتاب الخرائط'}</span>
            </button>
          )}

          {/* Print / save as PDF */}
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1.5 border bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
            title="طباعة الخريطة أو حفظها كملف PDF"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">طباعة / PDF</span>
          </button>

          {/* Toggle Edit Mode */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
              isEditing 
                ? 'bg-emerald-600 border-emerald-400 text-white' 
                : 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>{isEditing ? 'حفظ التعديلات' : 'تعديل الخريطة'}</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 p-0.5">
            <button 
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.15, 2.5))}
              className="p-1.5 hover:bg-slate-700 text-slate-300 rounded-lg"
              title="تكبير" aria-label="تكبير"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.15, 0.4))}
              className="p-1.5 hover:bg-slate-700 text-slate-300 rounded-lg"
              title="تصغير" aria-label="تصغير"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { setZoomLevel(1); setPanPosition({ x: 0, y: 0 }); }}
              className="p-1.5 hover:bg-slate-700 text-slate-300 rounded-lg"
              title="إعادة ضبط" aria-label="إعادة ضبط"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Interactive Canvas */}
        <div
          className={`flex-1 relative bg-radial-gradient from-slate-900 to-slate-950 overflow-hidden cursor-${isDragging ? 'grabbing' : 'grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Canvas Background Grid */}
          <div 
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)',
              backgroundSize: '28px 28px'
            }}
          />

          {/* Zoomable & Pannable Mind Map Content */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-75"
            style={{
              transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
            }}
          >
            <div className="relative min-w-[700px] max-w-5xl p-12 flex flex-col items-center">
              
              {/* Central Surah Node */}
              <div className="relative z-20 group">
                <div className="w-64 sm:w-72 p-6 rounded-3xl bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 border-4 border-amber-300 shadow-[0_0_50px_rgba(245,158,11,0.3)] text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <span className="text-xs uppercase tracking-widest text-amber-200 font-bold block mb-1">
                    سورة رقم {mindMap.surahNumber}
                  </span>

                  <h1 className="text-3xl sm:text-4xl font-black text-white font-cairo drop-shadow-md">
                    سورة {mindMap.surahName}
                  </h1>

                  <div className="mt-2 py-1 px-3 bg-black/30 rounded-xl inline-block text-xs font-semibold text-amber-200">
                    {mindMap.totalVerses} آية • {surahMeta?.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}
                  </div>

                  <div className="mt-3 pt-3 border-t border-amber-400/40 text-xs text-amber-100 font-semibold leading-relaxed">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTheme}
                        onChange={(e) => {
                          setEditingTheme(e.target.value);
                          setMindMap({ ...mindMap, centralTheme: e.target.value });
                        }}
                        className="w-full bg-black/40 border border-amber-300 rounded px-2 py-1 text-center text-white text-xs"
                      />
                    ) : (
                      <span>المحور العام: {mindMap.centralTheme}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mind Map Branches Container */}
              <div className="mt-14 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                {mindMap.branches.map((branch, idx) => {
                  const branchColor = branch.color || THEME_COLORS.blue;
                  const isSelected = selectedNode?.id === branch.id;

                  return (
                    <div
                      key={branch.id}
                      onClick={() => setSelectedNode(branch)}
                      className={`relative rounded-2xl p-5 border-2 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:scale-[1.02] ${
                        isSelected 
                          ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900' 
                          : ''
                      }`}
                      style={{
                        backgroundColor: `${branchColor}18`,
                        borderColor: branchColor,
                      }}
                    >
                      {/* Branch Top Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span 
                          className="px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-sm"
                          style={{ backgroundColor: branchColor }}
                        >
                          فرع {idx + 1}
                        </span>

                        {branch.ayahRange && (
                          <span 
                            className="text-xs font-bold px-2 py-0.5 rounded-lg border"
                            style={{ 
                              color: branchColor,
                              borderColor: `${branchColor}60`,
                              backgroundColor: `${branchColor}10`
                            }}
                          >
                            الآيات: {branch.ayahRange.start} - {branch.ayahRange.end}
                          </span>
                        )}
                      </div>

                      {/* Branch Title */}
                      <h3 className="text-lg font-bold text-white mb-2 leading-snug">
                        {branch.title}
                      </h3>

                      {/* Branch Description */}
                      {branch.description && (
                        <p className="text-xs text-slate-300 leading-relaxed mb-3">
                          {branch.description}
                        </p>
                      )}

                      {/* Sub-branches (Leaf nodes) */}
                      {branch.children && branch.children.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2">
                          <span className="text-xs font-bold text-slate-400 block">
                            التفريعات والموضوعات الفرعية:
                          </span>
                          <div className="space-y-1.5">
                            {branch.children.map((child) => (
                              <div
                                key={child.id}
                                className="text-xs bg-slate-900/70 border border-slate-700/60 rounded-xl p-2.5 text-slate-200 flex items-start gap-2 hover:border-amber-500/50 transition-colors"
                              >
                                <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: child.color || branchColor }} />
                                <div className="flex-1">
                                  <span className="font-semibold">{child.title}</span>
                                  {child.ayahRange && (
                                    <span className="text-xs text-amber-400 block font-cairo">
                                      (آيات {child.ayahRange.start} - {child.ayahRange.end})
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Jump to Mushaf Ayah button */}
                      {branch.ayahRange && surahMeta && (
                        <div className="mt-4 flex gap-2">
                          {onOpenSectionMap && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenSectionMap(surahNumber, branch.id, branch.ayahRange!.start, branch.ayahRange!.end);
                              }}
                              className="flex-1 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-xs font-bold rounded-xl text-amber-200 flex items-center justify-center gap-1.5 transition-colors border border-amber-500/40"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>استكشاف الآيات</span>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToMushaf(surahMeta.startPage);
                            }}
                            className="flex-1 py-2 bg-slate-800/80 hover:bg-slate-700 text-xs font-bold rounded-xl text-amber-300 flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>في المصحف</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add New Branch Box in Edit Mode */}
              {isEditing && (
                <div className="mt-8 w-full max-w-md bg-slate-900 border-2 border-dashed border-emerald-500/50 rounded-2xl p-4 text-center">
                  <h4 className="text-sm font-bold text-emerald-400 mb-3 flex items-center justify-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    إضافة محور / فرع جديد للخريطة
                  </h4>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="عنوان الموضوع أو المحور..."
                      value={newBranchTitle}
                      onChange={(e) => setNewBranchTitle(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="text"
                      placeholder="نطاق الآيات (مثال: 1-15)..."
                      value={newBranchRange}
                      onChange={(e) => setNewBranchRange(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={handleAddBranch}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                    >
                      حفظ وإضافة الفرع
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Side-by-side Reference Book Image Drawer */}
        {showOriginalBookRef && refImageName && (
          <div className="w-80 sm:w-96 md:w-[480px] bg-slate-900 border-r border-slate-800 flex flex-col h-full z-20 shadow-2xl animate-fade-in">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm text-purple-200">
                  كتاب الخرائط الذهنية (مرجع أصلي)
                </h3>
              </div>
              <button 
                onClick={() => setShowOriginalBookRef(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center bg-slate-950/80">
              <img
                src={`/assets/mindmaps_reference/${encodeURIComponent(refImageName)}`}
                alt="مرجع الخريطة الذهنية"
                loading="lazy"
                decoding="async"
                className="w-full h-auto object-contain rounded-xl shadow-lg border border-slate-700"
              />
              <p className="mt-3 text-xs text-slate-400 text-center font-cairo">
                كتاب: الخرائط الذهنية لسور القرآن الكريم • إعداد: صفية السحيباني
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
