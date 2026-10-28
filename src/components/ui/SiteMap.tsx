import React from 'react';
import { ChevronLeft, MapPin } from 'lucide-react';

/** Ids the shell understands (see `goTo` in App.tsx). */
export type SiteMapTarget =
  | 'home'
  | 'globe'
  | 'mushaf'
  | 'mindmap'
  | 'global-map'
  | 'word-reveal'
  | 'next-ayah'
  | 'site-map';

interface Node {
  label: string;
  desc: string;
  /** Screen the node opens. Nodes without one live *inside* their parent screen. */
  target?: SiteMapTarget;
  children?: Node[];
}

const TREE: Node[] = [
  {
    label: 'أطلس القرآن',
    desc: 'الشاشة الأولى: كرة ثلاثية الأبعاد للسور الـ114',
    target: 'globe',
    children: [
      { label: 'داخل السورة', desc: 'فلك محاور السورة — اضغط أي سورة على الكرة' },
      { label: 'فلك آيات المحور', desc: 'الآيات معروضة ومقروءة ثلاثياً' },
      { label: 'مقارنة السور', desc: 'لوحة تقارن سورتين جنباً إلى جنب' },
      { label: 'الاستماع للسورة', desc: 'شريط تشغيل صوتي أثناء التنقل' },
    ],
  },
  {
    label: 'الصفحة الرئيسية',
    desc: 'تابع القراءة · المراجعات المستحقة · آية اليوم · العلامات',
    target: 'home',
  },
  {
    label: 'المصحف الشريف',
    desc: '604 صفحات بخط المصحف مع التسميع والعلامات',
    target: 'mushaf',
    children: [{ label: 'تفاصيل الآية', desc: 'نافذة منبثقة: التفسير، الصوت، الحفظ' }],
  },
  {
    label: 'خريطة السورة',
    desc: 'الخريطة الذهنية لكل سورة من السور الـ114',
    target: 'mindmap',
    children: [{ label: 'خريطة المحور', desc: 'تفصيل قسم من السورة بآياته — يُفتح من داخل خريطة السورة' }],
  },
  { label: 'الخريطة الكبرى', desc: 'نظرة واحدة على القرآن كله وعلاقة السور', target: 'global-map' },
  {
    label: 'تدريب',
    desc: 'أدوات الحفظ والمراجعة',
    children: [
      { label: 'التسميع التدريجي', desc: 'إظهار الكلمات تدريجياً أثناء التسميع', target: 'word-reveal' },
      { label: 'تحدي الآية التالية', desc: 'اختبار على صفحة عشوائية أو نطاق محدد', target: 'next-ayah' },
    ],
  },
];

const OVERLAYS: Node[] = [
  { label: 'البحث السريع', desc: 'Ctrl + K من أي شاشة: سور، صفحات، آيات، وأقسام التطبيق' },
  { label: 'خريطة الموقع', desc: 'هذه الصفحة', target: 'site-map' },
];

interface Props {
  /** Id of the current screen, to mark "you are here". */
  current: SiteMapTarget;
  onGo: (target: SiteMapTarget) => void;
}

export const SiteMap: React.FC<Props> = ({ current, onGo }) => {
  const renderNode = (n: Node, depth = 0): React.ReactNode => {
    const here = n.target === current;
    const body = (
      <>
        <span className="flex items-center gap-2">
          <span className={`font-bold ${n.target ? 'text-amber-300' : 'text-slate-100'}`}>{n.label}</span>
          {here && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
              <MapPin className="w-3 h-3" /> أنت هنا
            </span>
          )}
          {!n.target && depth > 0 && <span className="text-xs text-slate-400 border border-slate-700 rounded-full px-2">داخل الشاشة</span>}
          {n.target && <ChevronLeft className="w-4 h-4 text-slate-500 ms-auto shrink-0" aria-hidden />}
        </span>
        <span className="block text-sm text-slate-400 mt-0.5">{n.desc}</span>
      </>
    );
    const base = 'block w-full text-start rounded-xl border px-4 py-3';
    return (
      <li key={n.label} className="space-y-2">
        {n.target ? (
          <button
            type="button"
            onClick={() => onGo(n.target!)}
            aria-current={here ? 'page' : undefined}
            className={`${base} ${here ? 'border-amber-500/60 bg-amber-500/10' : 'border-slate-700 bg-slate-900 hover:border-amber-500/40 hover:bg-slate-800/80'}`}
          >
            {body}
          </button>
        ) : (
          <div className={`${base} border-slate-800 bg-slate-900/50`}>{body}</div>
        )}
        {n.children && (
          <ul className="space-y-2 me-0 ms-4 ps-4 border-s-2 border-slate-800">{n.children.map((c) => renderNode(c, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <div className="h-full overflow-y-auto" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <header>
          <h1 className="text-2xl sm:text-3xl font-black text-amber-300">خريطة الموقع</h1>
          <p className="text-slate-300 text-sm sm:text-base mt-1">كل شاشات «زد» وكيف ترتبط ببعضها. اضغط أي بطاقة للانتقال إليها.</p>
        </header>

        <section aria-label="الشاشات">
          <ul className="space-y-2">{TREE.map((n) => renderNode(n))}</ul>
        </section>

        <section aria-label="أدوات عامة" className="space-y-2">
          <h2 className="text-sm font-bold text-slate-400">أدوات عامة</h2>
          <ul className="space-y-2">{OVERLAYS.map((n) => renderNode(n))}</ul>
        </section>
      </div>
    </div>
  );
};
