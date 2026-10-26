import React, { useEffect, useState } from 'react';
import { BookOpen, Bookmark, Brain, Flame, Orbit, RotateCcw, Shuffle, Sparkles, Compass } from 'lucide-react';
import { SURAHS_LIST } from '../../data/surahs';
import { library, useLibrary } from '../../services/library';
import { fetchSurahAllAyahs } from '../../services/quranApi';
import { Logo } from '../ui/Logo';
import { AppViewMode } from '../../types';

interface HomeProps {
  onOpenPage: (page: number) => void;
  onNavigate: (view: AppViewMode) => void;
  onStartQuiz: () => void;
  onStartWordReveal: () => void;
  onOpenAyah: (surah: number, ayah: number) => void;
}

/** Deterministic "ayah of the day": same verse all day, different tomorrow. */
function ayahOfTheDay(now = new Date()): { surah: number; ayah: number } {
  const dayIndex = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
  const total = SURAHS_LIST.reduce((n, s) => n + s.totalVerses, 0);
  let k = (dayIndex * 2654435761) % total;
  if (k < 0) k += total;
  for (const s of SURAHS_LIST) {
    if (k < s.totalVerses) return { surah: s.number, ayah: k + 1 };
    k -= s.totalVerses;
  }
  return { surah: 1, ayah: 1 };
}

const pageSurah = (page: number) => SURAHS_LIST.find((s) => page >= s.startPage && page <= s.endPage)?.name ?? '';

export const HomeScreen: React.FC<HomeProps> = ({ onOpenPage, onNavigate, onStartQuiz, onStartWordReveal, onOpenAyah }) => {
  const lib = useLibrary();
  const due = library.duePages();
  const streak = library.streak();
  const daily = ayahOfTheDay();
  const dailyMeta = SURAHS_LIST[daily.surah - 1];
  const [dailyText, setDailyText] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSurahAllAyahs(daily.surah)
      .then((ayahs) => {
        if (alive) setDailyText(ayahs.find((a) => a.numberInSurah === daily.ayah)?.textUthmani ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [daily.surah, daily.ayah]);

  const resumePage = lib.lastReadPage ?? 1;

  return (
    <div className="h-full overflow-y-auto" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <header className="flex items-center gap-4">
          <Logo className="w-14 h-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl sm:text-4xl font-black text-amber-300 leading-tight">زد</h1>
            <p className="text-slate-300 text-sm sm:text-base">مصحف الخرائط · قراءة وتدبّر وحفظ بأسلوب تفاعلي</p>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold"
            title="أيام متتالية من القراءة والمراجعة"
          >
            <Flame className={`w-5 h-5 ${streak > 0 ? 'text-orange-400' : 'text-slate-400'}`} />
            <span className={streak > 0 ? 'text-orange-300' : 'text-slate-400'}>{streak}</span>
            <span className="text-slate-400 font-semibold">يوم</span>
          </div>
        </header>

        {/* Continue reading */}
        <button
          type="button"
          onClick={() => onOpenPage(resumePage)}
          className="w-full text-start rounded-2xl p-5 sm:p-6 bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors flex items-center gap-4"
        >
          <BookOpen className="w-9 h-9 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold opacity-80">{lib.lastReadPage ? 'تابع القراءة' : 'ابدأ القراءة'}</div>
            <div className="text-xl sm:text-2xl font-black truncate">
              {lib.lastReadPage ? `صفحة ${resumePage} — سورة ${pageSurah(resumePage)}` : 'سورة الفاتحة'}
            </div>
          </div>
        </button>

        {/* Reviews due */}
        {due.length > 0 && (
          <section className="rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3 text-indigo-200 font-bold">
              <RotateCcw className="w-5 h-5" />
              <h2 className="text-base">مراجعات مستحقة اليوم ({due.length})</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {due.slice(0, 12).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onOpenPage(p)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-indigo-500/30 text-sm font-bold text-indigo-100 hover:bg-slate-800"
                >
                  صفحة {p} <span className="text-slate-400 font-semibold">· {pageSurah(p)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Ayah of the day */}
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6">
          <div className="text-sm font-bold text-slate-400 mb-3">آية اليوم</div>
          <p className="font-amiri text-2xl sm:text-3xl leading-[2.2] text-amber-100 min-h-[3.5rem]">
            {dailyText ?? <span className="text-slate-400 text-base font-cairo">جارٍ التحميل…</span>}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-300">
              سورة {dailyMeta.name} · الآية {daily.ayah}
            </span>
            <button
              type="button"
              onClick={() => onOpenAyah(daily.surah, daily.ayah)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-sm font-bold"
            >
              تفاصيل الآية
            </button>
          </div>
        </section>

        {/* Main paths */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PathCard icon={<Brain className="w-6 h-6" />} label="خريطة السورة" onClick={() => onNavigate('mindmap')} />
          <PathCard icon={<Orbit className="w-6 h-6" />} label="أطلس القرآن" onClick={() => onNavigate('globe')} />
          <PathCard icon={<Sparkles className="w-6 h-6" />} label="التسميع التدريجي" onClick={onStartWordReveal} />
          <PathCard icon={<Shuffle className="w-6 h-6" />} label="تحدي الآية التالية" onClick={onStartQuiz} />
        </section>

        {/* Bookmarks */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3 text-amber-300 font-bold">
            <Bookmark className="w-5 h-5" />
            <h2 className="text-base">العلامات المرجعية</h2>
          </div>
          {lib.bookmarks.length === 0 ? (
            <p className="text-slate-400 text-sm">لا توجد علامات بعد. افتح أي آية واضغط «حفظ علامة» لتجدها هنا.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-2">
              {lib.bookmarks.slice(0, 8).map((b) => (
                <li key={`${b.surah}:${b.ayah}`}>
                  <button
                    type="button"
                    onClick={() => onOpenPage(b.page)}
                    className="w-full text-start px-3 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 text-sm"
                  >
                    <span className="font-bold text-slate-100">سورة {b.surahName}</span>
                    <span className="text-slate-400"> · آية {b.ayah} · ص {b.page}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button
          type="button"
          onClick={() => onNavigate('global-map')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-700 text-slate-300 hover:text-amber-300 hover:bg-slate-900 text-sm font-bold"
        >
          <Compass className="w-4 h-4" />
          الخريطة الكبرى للقرآن
        </button>

        <p className="text-center text-xs text-slate-400 pb-4">
          محفوظ: {lib.memorized.length} صفحة · علامات: {lib.bookmarks.length}
        </p>
      </div>
    </div>
  );
};

const PathCard: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-800/80 text-slate-100 text-sm font-bold transition-colors"
  >
    <span className="text-amber-400">{icon}</span>
    {label}
  </button>
);
