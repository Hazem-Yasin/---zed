import { Ayah, QuranPageData, Reciter } from '../types';
import { SURAHS_LIST } from '../data/surahs';
import { getAyahTheme } from '../data/mindmaps/mindmapData';

// Available reciters
export const RECITERS: Reciter[] = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy', arabicName: 'مشاري راشد العفاسي', serverUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy' },
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', arabicName: 'محمود خليل الحصري', serverUrl: 'https://cdn.islamic.network/quran/audio/128/ar.husary' },
  { id: 'ar.minshawi', name: 'Mohamed Siddiq El-Minshawi', arabicName: 'محمد صديق المنشاوي', serverUrl: 'https://cdn.islamic.network/quran/audio/128/ar.minshawi' },
  { id: 'ar.hudhaify', name: 'Ali Al-Hudhaify', arabicName: 'علي بن عبد الرحمن الحذيفي', serverUrl: 'https://cdn.islamic.network/quran/audio/128/ar.hudhaify' },
  { id: 'ar.abdulbasitmujawwad', name: 'Abdul Basit Abdus-Samad (Mujawwad)', arabicName: 'عبد الباسط عبد الصمد (مجوّد)', serverUrl: 'https://everyayah.com/data/Abdul_Basit_Mujawwad_128kbps', everyAyahFolder: 'Abdul_Basit_Mujawwad_128kbps' },
  { id: 'ar.minshawimujawwad', name: 'Mohamed Siddiq El-Minshawi (Mujawwad)', arabicName: 'محمد صديق المنشاوي (مجوّد)', serverUrl: 'https://everyayah.com/data/Minshawy_Mujawwad_192kbps', everyAyahFolder: 'Minshawy_Mujawwad_192kbps' },
  { id: 'ar.abdulbasitmurattal', name: 'Abdul Basit Abdus-Samad (Murattal)', arabicName: 'عبد الباسط عبد الصمد (مرتّل)', serverUrl: 'https://everyayah.com/data/Abdul_Basit_Murattal_192kbps', everyAyahFolder: 'Abdul_Basit_Murattal_192kbps' },
  { id: 'ar.alijaber', name: 'Ali Jaber', arabicName: 'علي جابر', serverUrl: 'https://everyayah.com/data/Ali_Jaber_64kbps', everyAyahFolder: 'Ali_Jaber_64kbps' },
  { id: 'ar.mahermuaiqly', name: 'Maher Al-Muaiqly', arabicName: 'ماهر المعيقلي', serverUrl: 'https://everyayah.com/data/MaherAlMuaiqly128kbps', everyAyahFolder: 'MaherAlMuaiqly128kbps' },
  { id: 'ar.abdurrahmaansudais', name: 'Abdurrahman As-Sudais', arabicName: 'عبد الرحمن السديس', serverUrl: 'https://everyayah.com/data/Abdurrahmaan_As-Sudais_192kbps', everyAyahFolder: 'Abdurrahmaan_As-Sudais_192kbps' },
  { id: 'ar.saoodshuraym', name: "Saud Ash-Shuraym", arabicName: 'سعود الشريم', serverUrl: 'https://everyayah.com/data/Saood_ash-Shuraym_128kbps', everyAyahFolder: 'Saood_ash-Shuraym_128kbps' },
  { id: 'ar.abdullahbasfar', name: 'Abdullah Basfar', arabicName: 'عبد الله بصفر', serverUrl: 'https://everyayah.com/data/Abdullah_Basfar_192kbps', everyAyahFolder: 'Abdullah_Basfar_192kbps' },
  { id: 'ar.hanirifai', name: 'Hani Ar-Rifai', arabicName: 'هاني الرفاعي', serverUrl: 'https://everyayah.com/data/Hani_Rifai_192kbps', everyAyahFolder: 'Hani_Rifai_192kbps' },
  { id: 'ar.muhammadayyoub', name: 'Muhammad Ayyoub', arabicName: 'محمد أيوب', serverUrl: 'https://everyayah.com/data/Muhammad_Ayyoub_128kbps', everyAyahFolder: 'Muhammad_Ayyoub_128kbps' },
  { id: 'ar.muhammadjibreel', name: 'Muhammad Jibreel', arabicName: 'محمد جبريل', serverUrl: 'https://everyayah.com/data/Muhammad_Jibreel_128kbps', everyAyahFolder: 'Muhammad_Jibreel_128kbps' },
  { id: 'ar.shaatree', name: 'Abu Bakr Ash-Shaatree', arabicName: 'أبو بكر الشاطري', serverUrl: 'https://everyayah.com/data/Abu_Bakr_Ash-Shaatree_128kbps', everyAyahFolder: 'Abu_Bakr_Ash-Shaatree_128kbps' },
  { id: 'ar.yasserdussary', name: 'Yasser Ad-Dussary', arabicName: 'ياسر الدوسري', serverUrl: 'https://everyayah.com/data/Yasser_Ad-Dussary_128kbps', everyAyahFolder: 'Yasser_Ad-Dussary_128kbps' },
  { id: 'ar.nasserqatami', name: 'Nasser Al-Qatami', arabicName: 'ناصر القطامي', serverUrl: 'https://everyayah.com/data/Nasser_Alqatami_128kbps', everyAyahFolder: 'Nasser_Alqatami_128kbps' },
];

// Offline fallback with REAL text for page 1 (Al-Fatihah) and page 2 (start of Al-Baqarah).
// Any other page that cannot be loaded rejects, so the UI can show a retry state instead of fake verses.
const FALLBACK_PAGE_DATA: Record<number, Partial<QuranPageData>> = {
  1: {
    pageNumber: 1,
    surahNumber: 1,
    surahName: "الفاتحة",
    juzNumber: 1,
    ayahs: [
      { numberInSurah: 1, numberInQuran: 1, juz: 1, page: 1, surahNumber: 1, surahName: "الفاتحة", textUthmani: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", textSimple: "بسم الله الرحمن الرحيم", translation: "In the name of Allah, the Entirely Merciful, the Especially Merciful.", tafsirSummary: "أبدأ قراءتي باسم الله مستعيناً به، والله علم على الذات الإلهية، والرحمن الرحيم اسمان دالان على سعة رحمته." },
      { numberInSurah: 2, numberInQuran: 2, juz: 1, page: 1, surahNumber: 1, surahName: "الفاتحة", textUthmani: "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ", textSimple: "الحمد لله رب العالمين", translation: "[All] praise is [due] to Allah, Lord of the worlds.", tafsirSummary: "الثناء الكامل والشكر الخالص لله وحده المربي لجميع خلقه بنعمه." },
      { numberInSurah: 3, numberInQuran: 3, juz: 1, page: 1, surahNumber: 1, surahName: "الفاتحة", textUthmani: "ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", textSimple: "الرحمن الرحيم", translation: "The Entirely Merciful, the Especially Merciful,", tafsirSummary: "ذو الرحمة الشاملة لجميع الخلائق في الدنيا والخاصة بالمؤمنين في الآخرة." },
      { numberInSurah: 4, numberInQuran: 4, juz: 1, page: 1, surahNumber: 1, surahName: "الفاتحة", textUthmani: "مَٰلِكِ يَوْمِ ٱلدِّينِ", textSimple: "مالك يوم الدين", translation: "Sovereign of the Day of Recompense.", tafsirSummary: "المتصرف وحده بيوم القيامة والجزاء والحساب." },
      { numberInSurah: 5, numberInQuran: 5, juz: 1, page: 1, surahNumber: 1, surahName: "الفاتحة", textUthmani: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ", textSimple: "إياك نعبد وإياك نستعين", translation: "It is You we worship and You we ask for help.", tafsirSummary: "نخصك وحدك بالعبادة ونفردك بالاستعانة في كل شؤوننا." },
      { numberInSurah: 6, numberInQuran: 6, juz: 1, page: 1, surahNumber: 1, surahName: "الفاتحة", textUthmani: "ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ", textSimple: "اهدنا الصراط المستقيم", translation: "Guide us to the straight path -", tafsirSummary: "دلنا وأرشدنا وثبتنا على الطريق الواضح الموصل لرضوانك وهو الإسلام." },
      { numberInSurah: 7, numberInQuran: 7, juz: 1, page: 1, surahNumber: 1, surahName: "الفاتحة", textUthmani: "صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ", textSimple: "صراط الذين أنعمت عليهم غير المغضوب عليهم ولا الضالين", translation: "The path of those upon whom You have bestowed favor, not of those who have evoked [Your] anger or of those who are astray.", tafsirSummary: "طريق النبيين والصديقين والشهداء والصالحين، غير طريق المغضوب عليهم (اليهود ومن شابههم) ولا الضالين (النصارى ومن تاه عن الحق)." },
    ]
  },
  2: {
    pageNumber: 2,
    surahNumber: 2,
    surahName: "البقرة",
    juzNumber: 1,
    ayahs: [
      { numberInSurah: 1, numberInQuran: 8, juz: 1, page: 2, surahNumber: 2, surahName: "البقرة", textUthmani: "الٓمٓ", textSimple: "الم", translation: "Alif, Lam, Meem.", tafsirSummary: "حروف مقطعة لبيان إعجاز القرآن الكريم وأنه مركب من هذه الحروف التي ينطق بها العرب." },
      { numberInSurah: 2, numberInQuran: 9, juz: 1, page: 2, surahNumber: 2, surahName: "البقرة", textUthmani: "ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ", textSimple: "ذلك الكتاب لا ريب فيه هدى للمتقين", translation: "This is the Book about which there is no doubt, a guidance for those conscious of Allah -", tafsirSummary: "هذا القرآن هو الكتاب العظيم الذي لا شك في صدقه وأنه وحي من الله هادياً للمتقين." },
      { numberInSurah: 3, numberInQuran: 10, juz: 1, page: 2, surahNumber: 2, surahName: "البقرة", textUthmani: "ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ", textSimple: "الذين يؤمنون بالغيب ويقيمون الصلاة ومما رزقناهم ينفقون", translation: "Who believe in the unseen, establish prayer, and spend out of what We have provided for them,", tafsirSummary: "المصدقون بما غاب عن حسهم من الجنة والنار، المؤدون للصلاة بأركانها، المنفقون في وجوه الخير." },
      { numberInSurah: 4, numberInQuran: 11, juz: 1, page: 2, surahNumber: 2, surahName: "البقرة", textUthmani: "وَٱلَّذِينَ يُؤْمِنُونَ بِمَآ أُنزِلَ إِلَيْكَ وَمَآ أُنزِلَ مِن قَبْلِكَ وَبِٱلْـَٔاخِرَةِ هُمْ يُوقِنُونَ", textSimple: "والذين يؤمنون بما أنزل إليك وما أنزل من قبلك وبالآخرة هم يوقنون", translation: "And who believe in what has been revealed to you, [O Muhammad], and what was revealed before you, and of the Hereafter they are certain [in faith].", tafsirSummary: "المؤمنون بالقرآن وبالكتب السابقة الموقنون بالدار الآخرة وما فيها من ثواب وعقاب." },
      { numberInSurah: 5, numberInQuran: 12, juz: 1, page: 2, surahNumber: 2, surahName: "البقرة", textUthmani: "أُو۟لَٰٓئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ ۖ وَأُو۟لَٰٓئِكَ هُمُ ٱلْمُفْلِحُونَ", textSimple: "أولئك على هدى من ربهم وأولئك هم المفلحون", translation: "Those are upon [right] guidance from their Lord, and it is those who are the successful.", tafsirSummary: "أولئك الموصوفون بتلك الصفات على نور وبصيرة من ربهم وهم الفائزون بالجنة والنجاة من النار." },
    ]
  }
};

/**
 * Gets high resolution image URL of the Mushaf page (1 to 604)
 */
export function getMushafPageImageUrl(pageNumber: number): string {
  const paddedPage = String(pageNumber).padStart(3, '0');
  // High quality Madani Mushaf page image endpoint
  return `https://raw.githubusercontent.com/The-Quran-Project/Quran-Pages-Images/main/pages_images/${paddedPage}.jpg`;
}

/**
 * Gets Audio streaming URL for a specific Ayah by global index
 */
export function getAyahAudioUrl(ayahGlobalNumber: number, reciterId: string = 'ar.alafasy'): string {
  const folder = RECITERS.find((r) => r.id === reciterId)?.everyAyahFolder;
  if (folder) {
    let remaining = ayahGlobalNumber;
    for (const s of SURAHS_LIST) {
      if (remaining <= s.totalVerses) {
        return `https://everyayah.com/data/${folder}/${String(s.number).padStart(3, '0')}${String(remaining).padStart(3, '0')}.mp3`;
      }
      remaining -= s.totalVerses;
    }
  }
  return `https://cdn.islamic.network/quran/audio/128/${reciterId}/${ayahGlobalNumber}.mp3`;
}

/**
 * Break ayah into word array (cleaning up waqf signs if needed)
 */
export function splitAyahIntoWords(ayahText: string): string[] {
  return ayahText.trim().split(/\s+/).filter(w => w.length > 0);
}

/**
 * Break word into distinct Arabic letters (with harakat intact)
 */
export function splitWordIntoLetters(word: string): string[] {
  // Regex to match an Arabic base letter followed by its diacritics/tashkeel
  const letters: string[] = [];
  const chars = Array.from(word);
  let currentLetter = '';

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const isTashkeel = /[\u064B-\u065F\u0670\u06D6-\u06ED]/.test(char);

    if (isTashkeel && currentLetter) {
      currentLetter += char;
    } else {
      if (currentLetter) {
        letters.push(currentLetter);
      }
      currentLetter = char;
    }
  }
  if (currentLetter) {
    letters.push(currentLetter);
  }
  return letters;
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                       */
/* ------------------------------------------------------------------ */

const TASHKEEL_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0610-\u061A\u08D3-\u08FF]/g;
const ALEF_VARIANTS_RE = /[\u0671\u0622\u0623\u0625]/g;

/** Letters only (no marks, alef variants unified) so the Bismillah can be recognised whatever its Unicode spelling. */
function skeleton(text: string): string {
  return text.replace(TASHKEEL_RE, '').replace(ALEF_VARIANTS_RE, '\u0627').replace(/\u0640/g, '');
}

const BISMILLAH_SKELETON = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

/**
 * The API prepends the Bismillah to verse 1 of every surah except Al-Fatihah (where it IS verse 1)
 * and At-Tawbah (which has none). Strip it by matching the first four words by their letters only,
 * so slightly different diacritics / alef forms in the API text cannot make it leak through.
 */
export function stripLeadingBismillah(text: string, surahNumber: number, ayahNumber: number): string {
  if (ayahNumber !== 1 || surahNumber === 1 || surahNumber === 9) return text;
  const words = text.trim().split(/\s+/);
  if (words.length <= 4) return text.trim();
  const head = words.slice(0, 4).map((w) => skeleton(w));
  return BISMILLAH_SKELETON.every((w, i) => head[i] === w) ? words.slice(4).join(' ') : text.trim();
}

interface RawAyah {
  number: number;
  numberInSurah: number;
  text: string;
  juz: number;
  page: number;
  surah?: { number: number; name: string };
}

function cleanSurahName(name: string): string {
  return name.replace('سُورَةُ ', '').replace('سورة ', '');
}

function buildAyah(a: RawAyah, surahNumber: number, surahName: string, page: number): Ayah {
  const text = stripLeadingBismillah(a.text, surahNumber, a.numberInSurah);
  const theme = getAyahTheme(surahNumber, a.numberInSurah);
  return {
    numberInSurah: a.numberInSurah,
    numberInQuran: a.number,
    juz: a.juz,
    page,
    surahNumber,
    surahName,
    textUthmani: text,
    textSimple: text.replace(TASHKEEL_RE, ''),
    words: splitAyahIntoWords(text),
    themeCategory: { name: theme.name, color: theme.color, branchId: theme.branchId },
  };
}

/** GET + JSON with a timeout and one retry on network / 5xx errors. */
async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Network error');
}

/* ------------------------------------------------------------------ */
/* Pages                                                                */
/* ------------------------------------------------------------------ */

const pagesCache = new Map<number, QuranPageData>();
const pagesInFlight = new Map<number, Promise<QuranPageData>>();

function fallbackPage(pageNumber: number): QuranPageData | null {
  const fb = FALLBACK_PAGE_DATA[pageNumber];
  if (!fb) return null;
  const ayahs = (fb.ayahs || []).map((a) => ({
    ...a,
    words: splitAyahIntoWords(a.textUthmani as string),
    themeCategory: getAyahTheme(a.surahNumber as number, a.numberInSurah as number),
  })) as Ayah[];
  return {
    pageNumber,
    surahNumber: fb.surahNumber || 1,
    surahName: fb.surahName || 'الفاتحة',
    juzNumber: fb.juzNumber || 1,
    ayahs,
    imageUrl: getMushafPageImageUrl(pageNumber),
  };
}

async function loadQuranPage(pageNumber: number): Promise<QuranPageData> {
  try {
    const json = await fetchJson<{ data: { ayahs: RawAyah[] } }>(
      `https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthmani`,
      6000
    );
    const rawAyahs = json.data?.ayahs;
    if (!rawAyahs || rawAyahs.length === 0) throw new Error('No ayahs found for page');

    const first = rawAyahs[0];
    const firstSurahNumber = first.surah?.number ?? 1;
    const surahMeta = SURAHS_LIST.find((s) => s.number === firstSurahNumber);

    const ayahs = rawAyahs.map((a) =>
      buildAyah(a, a.surah?.number ?? firstSurahNumber, cleanSurahName(a.surah?.name ?? surahMeta?.name ?? ''), pageNumber)
    );

    const pageData: QuranPageData = {
      pageNumber,
      surahNumber: firstSurahNumber,
      surahName: surahMeta?.name ?? ayahs[0].surahName,
      juzNumber: first.juz,
      ayahs,
      imageUrl: getMushafPageImageUrl(pageNumber),
    };
    pagesCache.set(pageNumber, pageData);
    return pageData;
  } catch (error) {
    const fb = fallbackPage(pageNumber);
    if (fb) {
      console.warn(`Using bundled offline text for page ${pageNumber}:`, error);
      pagesCache.set(pageNumber, fb);
      return fb;
    }
    // No real text available: let the caller show a retry state rather than invent verses.
    throw error;
  }
}

/**
 * Fetch full Quran page data. Rejects when the page cannot be loaded (and is not bundled offline);
 * failures are never cached, so a retry hits the network again.
 */
export function fetchQuranPage(pageNumber: number): Promise<QuranPageData> {
  const cached = pagesCache.get(pageNumber);
  if (cached) return Promise.resolve(cached);
  const pending = pagesInFlight.get(pageNumber);
  if (pending) return pending;

  const p = loadQuranPage(pageNumber).finally(() => pagesInFlight.delete(pageNumber));
  pagesInFlight.set(pageNumber, p);
  return p;
}

/** Warm the cache for a page the user is likely to open next. Never throws. */
export function prefetchQuranPage(pageNumber: number): void {
  if (pageNumber < 1 || pageNumber > 604 || pagesCache.has(pageNumber)) return;
  fetchQuranPage(pageNumber).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Tafsir & translation (per page, loaded on demand, keyed by ayah)     */
/* ------------------------------------------------------------------ */

export type CommentaryKind = 'tafsir' | 'translation';

const EDITION: Record<CommentaryKind, string> = {
  tafsir: 'ar.muyassar', // التفسير الميسر - King Fahd Complex
  translation: 'en.sahih',
};

const commentaryCache = new Map<string, Record<number, string>>();
const commentaryInFlight = new Map<string, Promise<Record<number, string>>>();

/** Text for every ayah on a page, keyed by numberInQuran. Rejects on failure (not cached). */
export function fetchPageCommentary(pageNumber: number, kind: CommentaryKind): Promise<Record<number, string>> {
  const key = `${kind}:${pageNumber}`;
  const cached = commentaryCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = commentaryInFlight.get(key);
  if (pending) return pending;

  const p = fetchJson<{ data: { ayahs: { number: number; text: string }[] } }>(
    `https://api.alquran.cloud/v1/page/${pageNumber}/${EDITION[kind]}`,
    8000
  )
    .then((json) => {
      const map: Record<number, string> = {};
      for (const a of json.data?.ayahs ?? []) map[a.number] = a.text;
      commentaryCache.set(key, map);
      return map;
    })
    .finally(() => commentaryInFlight.delete(key));
  commentaryInFlight.set(key, p);
  return p;
}


/* ------------------------------------------------------------------ */
/* Surahs                                                               */
/* ------------------------------------------------------------------ */

const surahsCache = new Map<number, Ayah[]>();
const surahsInFlight = new Map<number, Promise<Ayah[]>>();

async function loadSurah(surahNumber: number): Promise<Ayah[]> {
  const json = await fetchJson<{ data: { name: string; ayahs?: RawAyah[] } }>(
    `https://api.alquran.cloud/v1/surah/${surahNumber}/quran-uthmani`,
    10000
  );
  const rawAyahs = json.data?.ayahs ?? [];
  if (rawAyahs.length === 0) throw new Error('No ayahs found for surah');
  const surahName = cleanSurahName(json.data.name);
  const ayahs = rawAyahs.map((a) => buildAyah(a, surahNumber, surahName, a.page));
  surahsCache.set(surahNumber, ayahs);
  return ayahs;
}

/**
 * Fetch all ayahs for a surah (cached, de-duplicated). Rejects on failure; failures are not cached.
 */
export function fetchSurahAllAyahs(surahNumber: number): Promise<Ayah[]> {
  const cached = surahsCache.get(surahNumber);
  if (cached) return Promise.resolve(cached);
  const pending = surahsInFlight.get(surahNumber);
  if (pending) return pending;

  const p = loadSurah(surahNumber).finally(() => surahsInFlight.delete(surahNumber));
  surahsInFlight.set(surahNumber, p);
  return p;
}

/**
 * Get synchronously cached ayah if available
 */
export function getCachedAyah(surahNumber: number, ayahNumber: number): Ayah | null {
  const surah = surahsCache.get(surahNumber);
  if (!surah) return null;
  return surah.find(a => a.numberInSurah === ayahNumber) || null;
}

/**
 * Fetch a range of ayahs for a specific surah (e.g. Ayah 62 to 144). Rejects if the surah cannot be loaded.
 */
export async function fetchSurahAyahRange(surahNumber: number, startAyah: number, endAyah: number): Promise<Ayah[]> {
  const all = await fetchSurahAllAyahs(surahNumber);
  return all.filter((a) => a.numberInSurah >= startAyah && a.numberInSurah <= endAyah);
}
