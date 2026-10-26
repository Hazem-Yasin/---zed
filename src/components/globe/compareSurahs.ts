import { SURAHS_LIST } from '../../data/surahs';
import { SURAH_MINDMAPS, THEME_COLORS, getSurahMindMap } from '../../data/mindmaps/mindmapData';
import type { MindMapNode, SurahMeta } from '../../types';

/** Human label for every branch colour used by the mind-map data. */
export const THEME_LABELS: Record<string, string> = {
  [THEME_COLORS.blue]: 'العقيدة والتوحيد',
  [THEME_COLORS.green]: 'العبادة والعمل الصالح',
  [THEME_COLORS.amber]: 'منهج الحياة والتشريع',
  [THEME_COLORS.purple]: 'القصص والسنن الإلهية',
  [THEME_COLORS.rose]: 'مشاهد القيامة والجزاء',
  [THEME_COLORS.teal]: 'الأخلاق والتزكية',
  [THEME_COLORS.indigo]: 'الدعوة والرسالة',
};

export interface BranchInfo {
  title: string;
  color: string;
  category: string;
  range?: string;
}

export interface SurahProfile {
  meta: SurahMeta;
  centralTheme: string;
  /** true when a hand-made mind map exists; false when the branches are auto-generated thirds */
  detailed: boolean;
  pages: number;
  branches: BranchInfo[];
}

export interface SharedCategory {
  color: string;
  label: string;
  a: string[];
  b: string[];
}

export interface Comparison {
  a: SurahProfile;
  b: SurahProfile;
  sameType: boolean;
  /** |revelationOrder(a) - revelationOrder(b)| */
  orderGap: number;
  /** which surah was revealed first (null if same order) */
  earlier: 'a' | 'b' | null;
  mushafGap: number;
  sharedJuz: number[];
  sharedCategories: SharedCategory[];
  sharedKeywords: string[];
  /** branch comparison is only meaningful when both surahs have a real mind map */
  canCompareBranches: boolean;
}

const cleanTitle = (t: string) => t.replace(/\s*[(（][^)）]*[)）]/g, '').trim() || t;

function profile(n: number): SurahProfile {
  const meta = SURAHS_LIST[n - 1];
  const map = getSurahMindMap(n);
  return {
    meta,
    centralTheme: map.centralTheme,
    detailed: !!SURAH_MINDMAPS[n],
    pages: meta.endPage - meta.startPage + 1,
    branches: map.branches.map((b: MindMapNode) => ({
      title: cleanTitle(b.title),
      color: b.color || THEME_COLORS.blue,
      category: THEME_LABELS[b.color || ''] || 'موضوع عام',
      range: b.ayahRange ? `${b.ayahRange.start}–${b.ayahRange.end}` : undefined,
    })),
  };
}

/* ----------------------------- keyword matching ----------------------------- */

const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

const STOP = new Set([
  'من', 'في', 'على', 'الي', 'عن', 'ما', 'لا', 'ان', 'او', 'ثم', 'بعد', 'قبل', 'بين', 'هذا', 'هذه',
  'ذلك', 'التي', 'الذي', 'مع', 'كل', 'عند', 'حتي', 'لكن', 'هو', 'هي', 'قد', 'بما', 'اما', 'الله',
  'سوره', 'السوره', 'ايات', 'مقدمه', 'خاتمه', 'الموضوع', 'الرئيسي', 'مقاصد', 'هدايات',
  'علي', 'عليه', 'عليهم', 'عليها', 'السلام', 'صلي', 'وسلم', 'اذا', 'ايضا', 'حول', 'عبر', 'دون', 'ذات',
  'بعض', 'كيف', 'ماذا', 'هل', 'اي', 'ذو', 'منه', 'فيه', 'فيها', 'منها', 'به', 'بها', 'له', 'لها',
]);

function normalize(w: string): string {
  return w
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

/**
 * Strip common Arabic prefixes so "والرحمة", "بالرحمة" and "رحمة" all match.
 * Handles و/ف/ب/ك/ل + ال first, then a lone conjunction/preposition (و ف ب ك ل) when enough letters remain.
 */
function stem(w: string): string {
  let s = w.replace(/^(وال|فال|بال|كال|لل)/, '').replace(/^ال/, '');
  if (s === w && s.length >= 5) s = s.replace(/^[وفبكل]/, '');
  return s;
}

function keywordMap(texts: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const text of texts) {
    for (const raw of text.split(/[^\u0621-\u063A\u0641-\u064A\u064B-\u065F\u0670\u06D6-\u06ED]+/)) {
      const plain = raw.replace(DIACRITICS, '');
      const key = stem(normalize(raw));
      if (key.length < 3 || STOP.has(key) || STOP.has(normalize(plain))) continue;
      // Display form keeps "ال" but drops a glued conjunction/preposition: "والأرض" -> "الأرض"
      if (!out.has(key)) out.set(key, plain.replace(/^[وفبك](?=ال)/, ''));
    }
  }
  return out;
}

function themeTexts(p: SurahProfile, n: number): string[] {
  const texts = [p.meta.mainTheme || '', p.centralTheme];
  if (p.detailed) {
    const map = getSurahMindMap(n);
    map.branches.forEach((b) => {
      texts.push(cleanTitle(b.title), b.description || '');
      b.children?.forEach((c) => texts.push(cleanTitle(c.title)));
    });
  }
  return texts;
}

/* --------------------------------- compare --------------------------------- */

export function compareSurahs(aNum: number, bNum: number): Comparison {
  const a = profile(aNum);
  const b = profile(bNum);

  const canCompareBranches = a.detailed && b.detailed;
  const sharedCategories: SharedCategory[] = [];
  if (canCompareBranches) {
    const colors = new Set<string>();
    a.branches.forEach((x) => colors.add(x.color));
    colors.forEach((color) => {
      const ax = a.branches.filter((x) => x.color === color);
      const bx = b.branches.filter((x) => x.color === color);
      if (ax.length && bx.length) {
        sharedCategories.push({
          color,
          label: THEME_LABELS[color] || 'موضوع عام',
          a: ax.map((x) => x.title),
          b: bx.map((x) => x.title),
        });
      }
    });
  }

  const ka = keywordMap(themeTexts(a, aNum));
  const kb = keywordMap(themeTexts(b, bNum));
  const sharedKeywords: string[] = [];
  ka.forEach((display, key) => {
    if (kb.has(key)) sharedKeywords.push(display);
  });

  const oa = a.meta.revelationOrder;
  const ob = b.meta.revelationOrder;

  return {
    a,
    b,
    sameType: a.meta.revelationType === b.meta.revelationType,
    orderGap: Math.abs(oa - ob),
    earlier: oa === ob ? null : oa < ob ? 'a' : 'b',
    mushafGap: Math.abs(aNum - bNum),
    sharedJuz: a.meta.juz.filter((j) => b.meta.juz.includes(j)),
    sharedCategories,
    sharedKeywords: sharedKeywords.slice(0, 10),
    canCompareBranches,
  };
}
