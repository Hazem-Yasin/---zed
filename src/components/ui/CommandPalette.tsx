import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, BookOpen, Brain, Hash, FileText, CornerDownLeft } from 'lucide-react';
import { SURAHS_LIST } from '../../data/surahs';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenSurah: (surahNumber: number) => void; // mushaf at the surah's first page
  onOpenMindMap: (surahNumber: number) => void;
  onOpenPage: (page: number) => void;
  onOpenAyah: (surahNumber: number, ayahNumber: number) => void;
  /** Extra "go to screen" commands, supplied by the shell. */
  commands: { id: string; label: string; run: () => void }[];
}

/** Arabic-insensitive normaliser: strips tashkeel/tatweel, folds alef/ya/ta-marbuta variants, lowercases latin. */
const norm = (s: string) =>
  s
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .trim();

type Item = {
  key: string;
  icon: React.ReactNode;
  title: string;
  sub?: string;
  run: () => void;
  alt?: { label: string; run: () => void };
};

export const CommandPalette: React.FC<Props> = ({
  open,
  onClose,
  onOpenSurah,
  onOpenMindMap,
  onOpenPage,
  onOpenAyah,
  commands,
}) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = norm(query);
    const out: Item[] = [];
    const surahItem = (s: (typeof SURAHS_LIST)[number]): Item => ({
      key: `s${s.number}`,
      icon: <BookOpen className="w-4 h-4 text-amber-400" />,
      title: `سورة ${s.name}`,
      sub: `${s.number} · ${s.totalVerses} آية · صفحة ${s.startPage}`,
      run: () => onOpenSurah(s.number),
      alt: { label: 'الخريطة الذهنية', run: () => onOpenMindMap(s.number) },
    });

    if (!q) {
      // Empty query: show the screen shortcuts first, then a few surahs.
      commands.forEach((c) => out.push({ key: `c${c.id}`, icon: <CornerDownLeft className="w-4 h-4 text-slate-400" />, title: c.label, run: c.run }));
      return out;
    }

    // "2:255" or "2 255" -> ayah
    const ayahMatch = q.match(/^(\d{1,3})\s*[:/ ]\s*(\d{1,3})$/);
    if (ayahMatch) {
      const sn = Number(ayahMatch[1]);
      const an = Number(ayahMatch[2]);
      const s = SURAHS_LIST.find((x) => x.number === sn);
      if (s && an >= 1 && an <= s.totalVerses) {
        out.push({
          key: `a${sn}:${an}`,
          icon: <Hash className="w-4 h-4 text-emerald-400" />,
          title: `الآية ${an} من سورة ${s.name}`,
          sub: `${sn}:${an}`,
          run: () => onOpenAyah(sn, an),
        });
      }
    }

    // plain number -> surah N and page N
    if (/^\d{1,3}$/.test(q)) {
      const n = Number(q);
      const s = SURAHS_LIST.find((x) => x.number === n);
      if (s) out.push(surahItem(s));
      if (n >= 1 && n <= 604) {
        out.push({
          key: `p${n}`,
          icon: <FileText className="w-4 h-4 text-sky-400" />,
          title: `صفحة ${n}`,
          sub: 'فتح المصحف',
          run: () => onOpenPage(n),
        });
      }
    }

    // "p120" / "صفحة 120"
    const pageMatch = q.match(/^(?:p|page|ص|صفحه)\s*(\d{1,3})$/);
    if (pageMatch) {
      const n = Number(pageMatch[1]);
      if (n >= 1 && n <= 604) {
        out.push({ key: `pp${n}`, icon: <FileText className="w-4 h-4 text-sky-400" />, title: `صفحة ${n}`, sub: 'فتح المصحف', run: () => onOpenPage(n) });
      }
    }

    // names (arabic / transliteration / translation)
    const stripped = q.replace(/^(سوره|سورة)\s+/, '').replace(/^ال/, '');
    SURAHS_LIST.forEach((s) => {
      const hay = [norm(s.name).replace(/^ال/, ''), norm(s.name), s.transliteration.toLowerCase(), s.translation.toLowerCase()];
      if (hay.some((h) => h.includes(stripped) || h.includes(q))) {
        if (!out.some((o) => o.key === `s${s.number}`)) out.push(surahItem(s));
      }
    });

    commands.forEach((c) => {
      if (norm(c.label).includes(q)) out.push({ key: `c${c.id}`, icon: <CornerDownLeft className="w-4 h-4 text-slate-400" />, title: c.label, run: c.run });
    });

    return out.slice(0, 30);
  }, [query, commands, onOpenSurah, onOpenMindMap, onOpenPage, onOpenAyah]);

  useEffect(() => setActive(0), [query]);

  // keep the active row in view
  useEffect(() => {
    document.getElementById(`cmdk-item-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const choose = (it: Item | undefined, alt = false) => {
    if (!it) return;
    onClose();
    (alt && it.alt ? it.alt.run : it.run)();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(items[active], e.shiftKey);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-3 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="بحث سريع"
        dir="rtl"
        className="w-full max-w-xl glass-panel-strong rounded-2xl overflow-hidden"
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-2 px-4 border-b border-slate-700/60">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن سورة، صفحة، أو آية (مثال: 2:255)"
            aria-label="بحث سريع"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={items.length ? `cmdk-item-${active}` : undefined}
            className="flex-1 bg-transparent py-3.5 text-sm text-slate-100 placeholder:text-slate-400 outline-none"
          />
          <kbd className="text-xs text-slate-400 border border-slate-700 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <ul id="cmdk-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">لا توجد نتائج</li>}
          {items.map((it, i) => (
            <li
              key={it.key}
              id={`cmdk-item-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => choose(it)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer ${
                i === active ? 'bg-amber-500/15 text-amber-100' : 'text-slate-200'
              }`}
            >
              {it.icon}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{it.title}</div>
                {it.sub && <div className="text-xs text-slate-400 truncate">{it.sub}</div>}
              </div>
              {it.alt && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    choose(it, true);
                  }}
                  className="flex items-center gap-1 text-xs text-emerald-300 border border-emerald-500/30 rounded-lg px-2 py-1 hover:bg-emerald-500/10"
                >
                  <Brain className="w-3.5 h-3.5" />
                  {it.alt.label}
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-700/60 text-xs text-slate-400">
          <span>↑↓ تنقّل</span>
          <span>Enter فتح</span>
          <span>Shift+Enter خريطة ذهنية</span>
        </div>
      </div>
    </div>
  );
};
