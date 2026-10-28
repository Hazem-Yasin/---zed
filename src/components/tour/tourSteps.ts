import type { AppViewMode } from '../../types';
import { SURAHS_LIST } from '../../data/surahs';
import { getSurahMindMap } from '../../data/mindmaps/mindmapData';
import { compareSurahs } from '../globe/compareSurahs';
import { DEFAULT_GLOBE, GlobeState } from '../../services/tourBus';

export interface TourStep {
  id: string;
  part: 'globe' | 'site';
  title: string;
  text: string;
  view: AppViewMode;
  /** What the globe screen should show (only used when `view` is 'globe'). */
  globe?: GlobeState;
  /** `data-tour` keys to highlight; the first one found on screen wins. */
  spot?: string[];
  /** Force the popup to the top or bottom of the screen (default: away from the highlighted element). */
  dock?: 'top' | 'bottom';
  /** Mushaf page to open (mushaf / word-reveal). */
  page?: number;
  /** Surah whose mind map is shown (view 'mindmap'). */
  mindmapSurah?: number;
  /** Section map to show (view 'section-map'). */
  sectionMap?: { surah: number; branchId: string; start?: number; end?: number };
  /** Minimum time on screen, ms (the real dwell grows with the length of the text). */
  ms: number;
}

const nm = (n: number) => SURAHS_LIST[n - 1].name;
const typeAr = (t: 'Meccan' | 'Medinan') => (t === 'Meccan' ? 'مكية' : 'مدنية');
/** Arabic count agreement for "ayah". */
const ayahCount = (n: number) => (n === 1 ? 'آية واحدة' : n === 2 ? 'آيتان' : n <= 10 ? `${n} آيات` : `${n} آية`);

const globe = (g: Partial<GlobeState>): GlobeState => ({ ...DEFAULT_GLOBE, ...g, view: { ...DEFAULT_GLOBE.view, ...g.view } });

function sectionOf(surah: number, index: number): NonNullable<TourStep['sectionMap']> {
  const b = getSurahMindMap(surah).branches[index];
  return { surah, branchId: b.id, start: b.ayahRange?.start, end: b.ayahRange?.end };
}

/**
 * Seven surahs far apart on the globe (surah 1 sits at the top, 114 at the bottom).
 * Each comparison keeps the newest surah and drops the oldest, exactly like clicking surahs
 * on the globe while the compare tool is open: (2,114) -> (114,18) -> (18,112) -> ...
 */
export const COMPARE_CHAIN = [2, 114, 18, 112, 3, 67, 1];

/** Real facts about a pair, computed from the app's own data (never hard-coded). */
export function compareFacts(a: number, b: number): string[] {
  const c = compareSurahs(a, b);
  const A = c.a.meta;
  const B = c.b.meta;
  const facts = [`${A.name}: ${ayahCount(A.totalVerses)} (${typeAr(A.revelationType)}) · ${B.name}: ${ayahCount(B.totalVerses)} (${typeAr(B.revelationType)}).`];
  if (A.totalVerses !== B.totalVerses) {
    const [big, small] = A.totalVerses > B.totalVerses ? [A, B] : [B, A];
    const r = big.totalVerses / small.totalVerses;
    facts.push(`${big.name} أطول بنحو ${r >= 10 ? Math.round(r) : r.toFixed(1)} مرة.`);
  }
  if (c.earlier) {
    const first = c.earlier === 'a' ? A : B;
    const second = c.earlier === 'a' ? B : A;
    facts.push(`نزلت ${first.name} قبل ${second.name} بفارق ${c.orderGap} مرتبة.`);
  }
  if (c.sharedCategories.length) facts.push(`يجمعهما محور «${c.sharedCategories[0].label}».`);
  else if (c.sharedKeywords.length) facts.push(`مفاهيم مشتركة: ${c.sharedKeywords.slice(0, 3).join('، ')}.`);
  return facts;
}

/** "Now we are comparing X to Y" popup text for comparison `i` of the chain. */
export function compareText(i: number): { title: string; text: string } {
  const a = COMPARE_CHAIN[i];
  const b = COMPARE_CHAIN[i + 1];
  const between = Math.abs(a - b) - 1;
  const intro =
    i === 0
      ? `نقارن الآن سورة ${nm(a)} (الأزرق) بسورة ${nm(b)} (البنفسجي): بينهما ${between} سورة، ويصل بينهما قوس مضيء.`
      : `ننقر الآن على سورة ${nm(b)}: تدخل المقارنة وتخرج ${nm(COMPARE_CHAIN[i - 1])} (الأقدم)، فنقارن الآن ${nm(a)} بـ${nm(b)}، وبينهما ${between} سورة.`;
  return { title: `مقارنة ${i + 1} من ${COMPARE_CHAIN.length - 1}: ${nm(a)} و${nm(b)}`, text: `${intro} ${compareFacts(a, b).join(' ')}` };
}

/** How deep inside a surah the globe is: 0 outer globe, 1 inside a surah, 2 inside one of its sections. */
const depth = (s: TourStep | null): number => (!s || s.view !== 'globe' || !s.globe || s.globe.place.surah === null ? 0 : s.globe.place.section === undefined ? 1 : 2);

/** Camera flight time per hop (ms), with a little margin: IN[k] = depth k -> k+1, OUT[k] = depth k+1 -> k. */
const IN = [3000, 2100];
const OUT = [2600, 2000];

/** Time to let the screen / camera settle before the reading time starts. */
export function leadMs(step: TourStep, prev: TourStep | null): number {
  if (step.view !== 'globe') return 1300;
  const to = depth(step);
  const from = depth(prev);
  const mounting = !prev || prev.view !== 'globe';
  let lead = mounting ? 1500 : 600;
  const hops = mounting ? 0 : from;
  if (to > hops) for (let k = hops; k < to; k++) lead += IN[k];
  else if (to < hops) for (let k = to; k < hops; k++) lead += OUT[k];
  else if (!mounting && to > 0 && JSON.stringify(prev?.globe?.place) !== JSON.stringify(step.globe?.place)) lead += 2100;
  if (mounting) for (let k = 0; k < to; k++) lead += IN[k];
  const cmp = step.globe?.compare;
  if (cmp && JSON.stringify(cmp) !== JSON.stringify(prev?.globe?.compare)) lead = Math.max(lead, 1700);
  return lead;
}

/** Reading time: the step's minimum, or ~0.3 s per word plus a pause, whichever is longer. */
export function readMs(step: TourStep): number {
  const words = (step.title + ' ' + step.text).split(/\s+/).length;
  return Math.max(step.ms, 2200 + words * 300);
}

const compareSteps: TourStep[] = COMPARE_CHAIN.slice(0, -1).map((a, i) => ({
  id: `compare-${i + 1}`,
  part: 'globe',
  view: 'globe',
  globe: globe({ compare: { a, b: COMPARE_CHAIN[i + 1] } }),
  spot: ['compare-panel'],
  ms: 6000,
  ...compareText(i),
}));

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    part: 'globe',
    view: 'globe',
    globe: globe({}),
    title: 'أهلاً بك في أطلس القرآن',
    text: 'هذه كرة تضم السور الـ114: كل نقطة سورة. الذهبية مكية والفيروزية مدنية، ومرتبة كالمصحف من القمة (الفاتحة) إلى القاع (الناس). سنمر الآن على كل أدوات الأطلس خطوة بخطوة.',
    ms: 6000,
  },
  {
    id: 'preview',
    part: 'globe',
    view: 'globe',
    globe: globe({ preview: 18 }),
    spot: ['hover-card'],
    title: 'معاينة أي سورة',
    text: 'عندما تمرّر الفأرة على سورة (أو تلمسها) تظهر بطاقتها: عدد آياتها وجزؤها ومحاورها. هنا نعاين سورة الكهف. وبالنقر على السورة تدخل إليها.',
    ms: 5000,
  },
  {
    id: 'search',
    part: 'globe',
    view: 'globe',
    globe: globe({ search: 'الكهف' }),
    spot: ['search'],
    title: 'البحث عن سورة',
    text: 'اكتب اسم السورة أو رقمها أو موضوعها وتظهر النتائج فوراً، وبجانب كل نتيجة سماعة تبدأ تلاوة السورة مباشرة.',
    ms: 5000,
  },
  {
    id: 'sound',
    part: 'globe',
    view: 'globe',
    globe: globe({}),
    spot: ['sound'],
    title: 'أصوات الأطلس',
    text: 'رياح خفيفة ترافق الدوران والتنقل بين السور. يمكنك كتمها أو تفعيلها من هذا الزر.',
    ms: 4500,
  },
  {
    id: 'listen',
    part: 'globe',
    view: 'globe',
    globe: globe({ listen: 1 }),
    spot: ['listen-dock', 'dock-listen'],
    title: 'الاستماع',
    text: 'زر «استماع» يبدأ من الفاتحة: تُضيء كل سورة على الكرة أثناء تلاوتها ثم ينتقل الاستماع للتي تليها. ومن المشغّل تتحكم بالآية والسورة والقارئ والسرعة.',
    ms: 7000,
  },
  {
    id: 'view-sections',
    part: 'globe',
    view: 'globe',
    globe: globe({ preview: 18, view: { level: 'sections', filter: 'all', menu: true } }),
    spot: ['view-menu', 'dock-view'],
    title: 'طريقة العرض: المحاور',
    text: 'من زر العرض تختار ما تراه حول كل سورة. مستوى «المحاور» يُظهر الأقسام الموضوعية للسورة أقماراً صغيرة ملونة حولها، وهنا محاور سورة الكهف.',
    ms: 6000,
  },
  {
    id: 'view-ayat',
    part: 'globe',
    view: 'globe',
    globe: globe({ preview: 36, view: { level: 'ayat', filter: 'all', menu: true } }),
    spot: ['view-menu', 'dock-view'],
    title: 'طريقة العرض: الآيات',
    text: 'مستوى «الآيات» يجعل كل آية نقطة تحيط بالسورة، فترى حجمها وتوزيع آياتها. هنا سورة يس، ومع الفأرة على أي نقطة تقرأ الآية وتستمع إليها.',
    ms: 6000,
  },
  {
    id: 'filter-meccan',
    part: 'globe',
    view: 'globe',
    globe: globe({ view: { level: 'surahs', filter: 'Meccan', menu: true } }),
    spot: ['view-menu', 'dock-view'],
    title: 'التصفية: السور المكية',
    text: 'تبرز السور المكية (الذهبية) وتخفت المدنية، لترى كيف تتوزع المكية على المصحف.',
    ms: 5000,
  },
  {
    id: 'filter-medinan',
    part: 'globe',
    view: 'globe',
    globe: globe({ view: { level: 'surahs', filter: 'Medinan', menu: true } }),
    spot: ['view-menu', 'dock-view'],
    title: 'التصفية: السور المدنية',
    text: 'والعكس تماماً: تبرز السور المدنية (الفيروزية). اضغط اللون مرة أخرى لإلغاء التصفية.',
    ms: 5000,
  },
  {
    id: 'compare-intro',
    part: 'globe',
    view: 'globe',
    globe: globe({ compare: { a: null, b: null } }),
    spot: ['compare-panel'],
    title: 'مقارنة السور',
    text: 'افتح «مقارنة» ثم انقر سورتين على الكرة (أو اخترهما من القائمتين) لتقارن النوع والطول وترتيب النزول والمحاور المشتركة. سنقارن الآن سبع سور متباعدة، سورتين في كل مرة، وكل سورة جديدة تحلّ محل الأقدم.',
    ms: 6000,
  },
  ...compareSteps,
  {
    id: 'enter-surah',
    part: 'globe',
    view: 'globe',
    globe: globe({ place: { surah: 18 } }),
    spot: ['surah-panel'],
    title: 'الدخول إلى سورة',
    text: 'بالنقر على سورة تدخلها: محاورها أفلاك ملونة حولك، وقائمة المحاور على الجانب. انقر محوراً لتدخل فلك آياته.',
    ms: 6000,
  },
  {
    id: 'surah-tools',
    part: 'globe',
    view: 'globe',
    globe: globe({ place: { surah: 18 } }),
    spot: ['surah-tools'],
    title: 'أدوات السورة',
    text: 'من داخل السورة تفتح خريطتها التفصيلية أو المصحف، وتستمع إليها، وتختبر نفسك فيها كلها.',
    ms: 5500,
  },
  {
    id: 'enter-section',
    part: 'globe',
    view: 'globe',
    globe: globe({ place: { surah: 18, section: 0 } }),
    spot: ['section-panel'],
    title: 'فلك آيات المحور',
    text: 'آيات المحور على بطاقات ثلاثية الأبعاد من حولك. اسحب للدوران وانقر آية لتفتح تفسيرها وتلاوتها، وبدّل بين المحاور من القائمة الجانبية.',
    ms: 6000,
  },
  {
    id: 'section-tools',
    part: 'globe',
    view: 'globe',
    globe: globe({ place: { surah: 18, section: 0 } }),
    spot: ['section-tools'],
    title: 'أدوات المحور',
    text: 'تنقّل بين المحور السابق والتالي، أعد توسيط المشهد، افتح المصحف عند السورة، أو اختبر نفسك في آيات هذا المحور فقط.',
    ms: 5500,
  },
  {
    id: 'back-quiz',
    part: 'globe',
    view: 'globe',
    globe: globe({}),
    spot: ['dock-quiz'],
    title: 'العودة والاختبار',
    text: 'زر «العودة إلى الكرة» يرجعك إلى الأطلس، وزر «اختبار» في الشريط السفلي يختبرك في القرآن كاملاً. بهذا نكون قد مررنا على كل أدوات الأطلس.',
    ms: 6000,
  },
  {
    id: 'mindmap',
    part: 'site',
    view: 'mindmap',
    mindmapSurah: 18,
    title: 'خريطة السورة',
    text: 'خريطة ذهنية لكل سورة بمحاورها وتفريعاتها. تنتقل بين السور من القائمة أعلى الشاشة، وتطبع الخريطة أو تحفظها PDF، وتعدّلها بنفسك.',
    ms: 6000,
  },
  {
    id: 'section-map',
    part: 'site',
    view: 'section-map',
    sectionMap: sectionOf(18, 0),
    title: 'خريطة المحور',
    text: 'تفاصيل قسم واحد من السورة بآياته، ويمكنك تلاوة المقطع كاملاً من الزر أعلى الشاشة.',
    ms: 5500,
  },
  {
    id: 'global-map',
    part: 'site',
    view: 'global-map',
    title: 'الخريطة الكبرى',
    text: 'كل السور في شبكة واحدة، مع بحث وتصفية بنوع السورة وبالجزء، وترتيب إما بالمصحف أو بترتيب النزول.',
    ms: 5500,
  },
  {
    id: 'mushaf',
    part: 'site',
    view: 'mushaf',
    page: 293,
    spot: ['mushaf-bar'],
    title: 'المصحف الشريف',
    text: '604 صفحة بخط المصحف. تنتقل بسرعة بالسورة أو الجزء، وتلوّن الآيات حسب محاور الخريطة، وتستمع للصفحة، وتعلّم ما حفظته.',
    ms: 6000,
  },
  {
    id: 'mushaf-ayah',
    part: 'site',
    view: 'mushaf',
    page: 293,
    spot: ['ayah-panel'],
    title: 'تفاصيل الآية',
    text: 'انقر أي آية فتظهر هنا موضوعها والتفسير الميسر، وتفتح نافذتها للتلاوة وحفظ علامة مرجعية واختبار حفظ الآية كلمة بكلمة.',
    ms: 6000,
  },
  {
    id: 'word-reveal',
    part: 'site',
    view: 'test-word-reveal',
    page: 293,
    spot: ['reveal-buttons'],
    title: 'التسميع التدريجي',
    text: 'استحضر الآية في ذهنك ثم اكشفها حرفاً حرفاً أو كلمة كلمة أو كاملة، واكسب نقاطاً وحافظ على سلسلة أيامك.',
    ms: 6000,
  },
  {
    id: 'quiz',
    part: 'site',
    view: 'test-random-ayah',
    title: 'تحدي الآية التالية',
    text: 'تظهر لك آية في صفحة عشوائية ويُطلب منك ما بعدها، لتختبر حفظك على الصفحة كلها.',
    ms: 5500,
  },
  {
    id: 'home',
    part: 'site',
    view: 'home',
    title: 'الصفحة الرئيسية',
    text: 'متابعة القراءة من حيث توقفت، والمراجعات المستحقة اليوم، وآية اليوم، وعلاماتك المرجعية، وعدّاد أيامك المتتالية.',
    ms: 5500,
  },
  {
    id: 'site-map',
    part: 'site',
    view: 'site-map',
    title: 'خريطة الموقع',
    text: 'كل شاشات التطبيق وكيف ترتبط ببعضها، مع علامة «أنت هنا». والقائمة الجانبية دائماً في أعلى اليمين.',
    ms: 5000,
  },
  {
    id: 'finish',
    part: 'site',
    view: 'globe',
    globe: globe({}),
    title: 'انتهت الجولة',
    text: 'يمكنك إعادة الجولة متى شئت من القائمة أو من زر «جولة» في الأطلس. وللبحث السريع من أي شاشة اضغط Ctrl+K.',
    ms: 5000,
  },
];
