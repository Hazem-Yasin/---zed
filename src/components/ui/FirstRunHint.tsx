import React from 'react';
import { Hand, MousePointerClick, Search, X } from 'lucide-react';
import { usePersistentState } from '../../hooks/usePersistentState';

/** One-time, dismissible tips card shown over the globe on the very first visit. */
export const FirstRunHint: React.FC = () => {
  const [seen, setSeen] = usePersistentState<boolean>('hint-globe-seen', false, (v) => typeof v === 'boolean');
  if (seen) return null;

  return (
    <div className="absolute inset-x-0 top-[22%] z-30 flex justify-center px-4 pointer-events-none">
      <div
        role="note"
        className="pointer-events-auto max-w-sm w-full glass-panel-strong rounded-2xl p-4 animate-fade-in"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="text-sm font-black text-amber-300">كيف تستخدم الأطلس؟</h2>
          <button
            type="button"
            onClick={() => setSeen(true)}
            aria-label="إغلاق التلميحات"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <ul className="space-y-2 text-xs text-slate-200 leading-relaxed">
          <li className="flex items-center gap-2.5">
            <Hand className="w-4 h-4 text-sky-400 shrink-0" />
            <span>اسحب لتدوير الكرة في أي اتجاه، وبالعجلة أو القرص تقرّب وتبعّد.</span>
          </li>
          <li className="flex items-center gap-2.5">
            <MousePointerClick className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>انقر على سورة لعرض تفاصيلها، وانقر مرة أخرى للدخول إلى آياتها.</span>
          </li>
          <li className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              اضغط <kbd className="px-1.5 py-0.5 rounded border border-slate-600 text-slate-300">Ctrl</kbd> +{' '}
              <kbd className="px-1.5 py-0.5 rounded border border-slate-600 text-slate-300">K</kbd> للبحث السريع من أي شاشة.
            </span>
          </li>
        </ul>
        <button
          type="button"
          onClick={() => setSeen(true)}
          className="mt-3 w-full py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400"
        >
          فهمت
        </button>
      </div>
    </div>
  );
};
