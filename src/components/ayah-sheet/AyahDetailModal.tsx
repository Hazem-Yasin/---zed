import React, { useEffect, useRef, useState } from 'react';
import { Ayah } from '../../types';
import { Pause, Bookmark, Brain, Sparkles, X, Volume2, BookOpen } from 'lucide-react';
import { fetchPageCommentary } from '../../services/quranApi';
import { library, useLibrary } from '../../services/library';

interface AyahDetailModalProps {
  ayah: Ayah | null;
  onClose: () => void;
  onPlayAudio: (ayah: Ayah) => void;
  isPlaying: boolean;
  onOpenMindMap: (surahNumber: number) => void;
  onStartWordRevealTest: (ayah: Ayah) => void;
}

export const AyahDetailModal: React.FC<AyahDetailModalProps> = ({
  ayah,
  onClose,
  onPlayAudio,
  isPlaying,
  onOpenMindMap,
  onStartWordRevealTest,
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Real commentary for this ayah's page (never placeholder text)
  const [tafsir, setTafsir] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [commentaryFailed, setCommentaryFailed] = useState(false);
  const lib = useLibrary();
  const bookmarked = !!ayah && lib.bookmarks.some((b) => b.surah === ayah.surahNumber && b.ayah === ayah.numberInSurah);

  useEffect(() => {
    if (!ayah) return;
    let alive = true;
    setTafsir(null);
    setTranslation(null);
    setCommentaryFailed(false);
    fetchPageCommentary(ayah.page, 'tafsir')
      .then((m) => alive && setTafsir(m[ayah.numberInQuran] ?? ''))
      .catch(() => alive && setCommentaryFailed(true));
    fetchPageCommentary(ayah.page, 'translation')
      .then((m) => alive && setTranslation(m[ayah.numberInQuran] ?? ''))
      .catch(() => alive && setCommentaryFailed(true));
    return () => {
      alive = false;
    };
  }, [ayah]);

  // Escape closes; focus moves into the dialog on open and returns to the opener on close.
  useEffect(() => {
    if (!ayah) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      // Keep Tab focus inside the dialog while it is open
      if (e.key === 'Tab') {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
        const items = dialog?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!dialog || !items || items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [ayah]);

  if (!ayah) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div 
        role="dialog"
        aria-modal="true"
        aria-label={`سورة ${ayah.surahName} الآية ${ayah.numberInSurah}`}
        className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold flex items-center justify-center font-cairo">
              {ayah.numberInSurah}
            </span>
            <div>
              <h3 className="text-xl font-bold text-amber-200">
                سورة {ayah.surahName}
              </h3>
              <p className="text-xs text-slate-400">
                الجزء {ayah.juz} • الصفحة {ayah.page} • الآية {ayah.numberInSurah} (ترتيب المصحف {ayah.numberInQuran})
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-pressed={bookmarked}
              aria-label={bookmarked ? 'إزالة العلامة' : 'حفظ علامة'}
              title={bookmarked ? 'إزالة العلامة' : 'حفظ علامة'}
              onClick={() =>
                library.toggleBookmark({ surah: ayah.surahNumber, ayah: ayah.numberInSurah, page: ayah.page, surahName: ayah.surahName })
              }
              className={`p-2 rounded-lg transition-colors ${
                bookmarked ? 'text-amber-300 bg-amber-500/15' : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
              }`}
            >
              <Bookmark className={`w-5 h-5 ${bookmarked ? 'fill-current' : ''}`} />
            </button>
            <button
              ref={closeRef}
              type="button"
              aria-label="إغلاق"
              title="إغلاق"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thematic Category Badge from Mind Map */}
        {ayah.themeCategory && (
          <div 
            className="mt-4 px-4 py-2 rounded-xl flex items-center justify-between text-xs font-semibold"
            style={{ 
              backgroundColor: `${ayah.themeCategory.color}20`,
              borderColor: `${ayah.themeCategory.color}50`,
              borderWidth: 1,
              color: ayah.themeCategory.color
            }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ayah.themeCategory.color }} />
              <span>الموضوع في الخريطة الذهنية: {ayah.themeCategory.name}</span>
            </div>
            <button 
              onClick={() => onOpenMindMap(ayah.surahNumber)}
              className="flex items-center gap-1 hover:underline text-xs"
            >
              <Brain className="w-3.5 h-3.5" />
              عرض في الخريطة
            </button>
          </div>
        )}

        {/* Ayah Text Display */}
        <div className="my-6 p-6 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-center">
          <p className="font-amiri text-2xl sm:text-3xl md:text-4xl leading-loose text-amber-100">
            {ayah.textUthmani}
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-amber-500/40 text-amber-400 text-base font-cairo mr-2 align-middle">
              ﴿{ayah.numberInSurah}﴾
            </span>
          </p>
        </div>

        {/* Tafsir & Translation */}
        <div className="space-y-4 text-base bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
          <div>
            <h4 className="text-sm font-bold text-amber-400 mb-1 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              التفسير الميسر
            </h4>
            <p className="text-slate-200 leading-relaxed font-cairo">
              {ayah.tafsirSummary ?? (tafsir !== null ? tafsir || '—' : commentaryFailed ? 'تعذّر تحميل التفسير. تحقّق من الاتصال.' : 'جارٍ التحميل…')}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-700/50">
            <h4 className="text-sm font-bold text-slate-300 mb-1">English</h4>
            <p className="text-slate-200 text-left" dir="ltr">
              {ayah.translation ?? (translation !== null ? translation || '—' : commentaryFailed ? 'Could not load the translation.' : 'Loading…')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={() => onPlayAudio(ayah)}
            className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm transition-all ${
              isPlaying
                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                إيقاف التلاوة
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                استماع للتلاوة
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onStartWordRevealTest(ayah)}
              className="px-4 py-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              اختبار حفظ الآية (كلمة بكلمة)
            </button>

            <button
              onClick={() => onOpenMindMap(ayah.surahNumber)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600/50 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
            >
              <Brain className="w-4 h-4 text-emerald-400" />
              الخريطة الذهنية
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
