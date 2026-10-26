import React, { useMemo } from 'react';
import { ArrowLeftRight, GitCompare, X } from 'lucide-react';
import { SURAHS_LIST } from '../../data/surahs';
import { Comparison, SurahProfile, compareSurahs } from './compareSurahs';
import { IconButton } from '../ui/kit';

interface Props {
  a: number | null;
  b: number | null;
  onChange: (a: number | null, b: number | null) => void;
  onClose: () => void;
}

const COLOR_A = '#38bdf8';
const COLOR_B = '#c084fc';

const typeLabel = (t: 'Meccan' | 'Medinan') => (t === 'Meccan' ? 'مكية' : 'مدنية');

/** Arabic count agreement (1 / 2 / 3-10 / 11+). */
const count = (n: number, one: string, two: string, few: string, many: string) =>
  n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`;
const surahCount = (n: number) => count(n, 'سورة واحدة', 'سورتان', 'سور', 'سورة');
const rankCount = (n: number) => count(n, 'مرتبة واحدة', 'مرتبتين', 'مراتب', 'مرتبة');

const Row: React.FC<{ label: string; children: React.ReactNode; note?: React.ReactNode }> = ({ label, children, note }) => (
  <div className="py-2 border-t border-slate-800/80">
    <div className="text-xs font-bold text-slate-400 mb-1 text-center">{label}</div>
    {children}
    {note && <div className="mt-1 text-xs text-slate-400 text-center leading-relaxed">{note}</div>}
  </div>
);

const Two: React.FC<{ a: React.ReactNode; b: React.ReactNode }> = ({ a, b }) => (
  <div className="grid grid-cols-2 gap-2">
    <div className="text-center text-xs text-slate-100" style={{ color: COLOR_A }}>
      {a}
    </div>
    <div className="text-center text-xs text-slate-100" style={{ color: COLOR_B }}>
      {b}
    </div>
  </div>
);

const Bar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => (
  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mt-1">
    <div className="h-full rounded-full" style={{ width: `${Math.max(4, (value / max) * 100)}%`, background: color }} />
  </div>
);

const BranchList: React.FC<{ p: SurahProfile }> = ({ p }) => (
  <div className="space-y-1">
    {p.branches.map((br, i) => (
      <div key={i} className="flex items-start gap-1.5 text-xs text-slate-300 text-right leading-snug">
        <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: br.color }} />
        <span className="min-w-0">
          {br.title}
          {br.range && <span className="text-slate-400 mr-1">({br.range})</span>}
        </span>
      </div>
    ))}
  </div>
);

const Result: React.FC<{ c: Comparison }> = ({ c }) => {
  const { a, b } = c;
  const maxVerses = Math.max(a.meta.totalVerses, b.meta.totalVerses);
  const longer = a.meta.totalVerses === b.meta.totalVerses ? null : a.meta.totalVerses > b.meta.totalVerses ? a : b;
  const shorter = longer === a ? b : a;
  const ratio = longer ? longer.meta.totalVerses / shorter.meta.totalVerses : 1;
  const earlierP = c.earlier === 'a' ? a : c.earlier === 'b' ? b : null;
  const laterP = earlierP === a ? b : a;

  return (
    <div>
      <Row label="النوع">
        <Two a={typeLabel(a.meta.revelationType)} b={typeLabel(b.meta.revelationType)} />
      </Row>

      <Row
        label="عدد الآيات"
        note={longer ? `سورة ${longer.meta.name} أطول بنحو ${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)} مرة` : 'السورتان متساويتان في عدد الآيات'}
      >
        <Two
          a={
            <>
              <b>{a.meta.totalVerses}</b>
              <Bar value={a.meta.totalVerses} max={maxVerses} color={COLOR_A} />
            </>
          }
          b={
            <>
              <b>{b.meta.totalVerses}</b>
              <Bar value={b.meta.totalVerses} max={maxVerses} color={COLOR_B} />
            </>
          }
        />
      </Row>

      <Row label="الصفحات في المصحف">
        <Two a={`${a.pages} ${a.pages === 1 ? 'صفحة' : 'صفحات'}`} b={`${b.pages} ${b.pages === 1 ? 'صفحة' : 'صفحات'}`} />
      </Row>

      <Row
        label="ترتيب النزول"
        note={
          earlierP
            ? `${c.sameType ? 'نزلتا في نفس المرحلة' : 'نزلتا في مرحلتين مختلفتين'} · نزلت ${earlierP.meta.name} قبل ${laterP.meta.name} بفارق ${rankCount(c.orderGap)}`
            : undefined
        }
      >
        <Two a={`#${a.meta.revelationOrder}`} b={`#${b.meta.revelationOrder}`} />
      </Row>

      <Row
        label="الأجزاء"
        note={
          c.sharedJuz.length
            ? `يجمعهما الجزء ${c.sharedJuz.join('، ')}`
            : c.mushafGap === 1
            ? 'متجاورتان في المصحف'
            : `يفصل بينهما ${surahCount(c.mushafGap - 1)} في ترتيب المصحف`
        }
      >
        <Two a={a.meta.juz.join('، ')} b={b.meta.juz.join('، ')} />
      </Row>

      <Row label="المحور العام">
        <div className="grid grid-cols-2 gap-2">
          <p className="text-xs leading-relaxed text-center" style={{ color: COLOR_A }}>
            {a.centralTheme}
          </p>
          <p className="text-xs leading-relaxed text-center" style={{ color: COLOR_B }}>
            {b.centralTheme}
          </p>
        </div>
      </Row>

      <Row label="مفاهيم مشتركة في موضوعيهما">
        {c.sharedKeywords.length ? (
          <div className="flex flex-wrap justify-center gap-1">
            {c.sharedKeywords.map((k) => (
              <span key={k} className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-200 border border-amber-500/30">
                {k}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-400 text-center">لا توجد كلمات موضوعية مشتركة ظاهرة</div>
        )}
      </Row>

      <Row
        label="محاور متشابهة في التصنيف"
        note={c.canCompareBranches && c.sharedCategories.length ? 'مجمّعة حسب لون التصنيف في الخريطة الذهنية، وليست تطابقاً في المعنى' : undefined}
      >
        {c.canCompareBranches ? (
          c.sharedCategories.length ? (
            <div className="space-y-2">
              {c.sharedCategories.map((s) => (
                <div key={s.color} className="rounded-xl border p-2" style={{ borderColor: `${s.color}55`, background: `${s.color}10` }}>
                  <div className="flex items-center gap-1.5 text-xs font-black mb-1.5" style={{ color: s.color }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      {s.a.map((t, i) => (
                        <div key={i} className="text-xs leading-snug text-center" style={{ color: COLOR_A }}>
                          {t}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-0.5">
                      {s.b.map((t, i) => (
                        <div key={i} className="text-xs leading-snug text-center" style={{ color: COLOR_B }}>
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center">لا تشترك السورتان في أي فئة من فئات المحاور</div>
          )
        ) : (
          <div className="text-xs text-amber-300/80 text-center leading-relaxed">
            الخريطة الذهنية التفصيلية غير متوفرة بعد لـ{' '}
            {[a, b].filter((p) => !p.detailed).map((p) => `سورة ${p.meta.name}`).join(' و')}، لذا اقتصرت المقارنة على المحور العام والمفاهيم المشتركة.
          </div>
        )}
      </Row>

      {(a.detailed || b.detailed) && (
        <Row label="كل المحاور">
          <div className="grid grid-cols-2 gap-2">
            {a.detailed ? <BranchList p={a} /> : <div className="text-xs text-slate-400 text-center">—</div>}
            {b.detailed ? <BranchList p={b} /> : <div className="text-xs text-slate-400 text-center">—</div>}
          </div>
        </Row>
      )}
    </div>
  );
};

const SlotSelect: React.FC<{
  value: number | null;
  color: string;
  placeholder: string;
  onChange: (n: number | null) => void;
}> = ({ value, color, placeholder, onChange }) => (
  <div className="flex-1 min-w-0 flex items-center gap-1.5 rounded-xl border bg-slate-900/80 px-2 py-1.5" style={{ borderColor: `${color}66` }}>
    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
      aria-label={placeholder}
      className="bg-transparent w-full min-w-0 text-xs font-bold text-slate-100 focus:outline-none cursor-pointer"
    >
      <option value="" className="bg-slate-900">
        {placeholder}
      </option>
      {SURAHS_LIST.map((s) => (
        <option key={s.number} value={s.number} className="bg-slate-900">
          {s.number}. {s.name}
        </option>
      ))}
    </select>
  </div>
);

export const SurahComparePanel: React.FC<Props> = ({ a, b, onChange, onClose }) => {
  const result = useMemo(() => (a && b && a !== b ? compareSurahs(a, b) : null), [a, b]);

  const setA = (n: number | null) => onChange(n && n === b ? a : n, b);
  const setB = (n: number | null) => onChange(a, n && n === a ? b : n);

  return (
    <div
      role="region"
      aria-label="مقارنة سورتين"
      className="absolute top-20 left-3 z-20 w-[min(92%,22rem)] max-h-[calc(100%-9.5rem)] flex flex-col rounded-2xl glass-panel-strong animate-fade-in"
      dir="rtl"
    >
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-2 shrink-0">
        <GitCompare className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-black text-amber-300">مقارنة سورتين</h3>
        <IconButton label="تبديل الجانبين" size="sm" className="mr-auto" onClick={() => onChange(b, a)} disabled={!a && !b}>
          <ArrowLeftRight className="w-4 h-4" />
        </IconButton>
        <IconButton label="إغلاق المقارنة" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </IconButton>
      </div>

      <div className="px-3.5 pb-2 shrink-0 flex items-center gap-2">
        <SlotSelect value={a} color={COLOR_A} placeholder="السورة الأولى" onChange={setA} />
        <SlotSelect value={b} color={COLOR_B} placeholder="السورة الثانية" onChange={setB} />
      </div>

      <div className="px-3.5 pb-3 overflow-y-auto min-h-0">
        {result ? (
          <Result c={result} />
        ) : (
          <p className="text-xs text-slate-400 leading-relaxed text-center py-4">
            {!a && !b
              ? 'اضغط على سورتين في الكرة لمقارنتهما، أو اخترهما من القائمتين أعلاه.'
              : 'اختر السورة الثانية: اضغط عليها في الكرة أو من القائمة.'}
          </p>
        )}
      </div>
    </div>
  );
};
