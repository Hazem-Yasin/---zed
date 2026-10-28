export interface SurahMeta {
  number: number;
  name: string;
  transliteration: string;
  translation: string;
  totalVerses: number;
  revelationType: 'Meccan' | 'Medinan';
  startPage: number;
  endPage: number;
  juz: number[];
  mainTheme?: string;
  referencePageImage?: string; // Reference image from Noor-Book
  revelationOrder: number; // 1-114: order of revelation (ترتيب النزول)
}

export interface MindMapNode {
  id: string;
  title: string;
  ayahRange?: {
    start: number;
    end: number;
  };
  color?: string; // Hex or theme color key
  description?: string;
  children?: MindMapNode[];
  isExpanded?: boolean;
}

export interface SurahMindMap {
  surahNumber: number;
  surahName: string;
  totalVerses: number;
  centralTheme: string;
  scholarReference?: string;
  referenceImageIndex?: number; // e.g. 7 for Al-Fatiha, 8 for Al-Baqarah, 9 for Aal-Imran
  branches: MindMapNode[];
}

export interface Ayah {
  numberInSurah: number;
  numberInQuran: number;
  juz: number;
  page: number;
  surahNumber: number;
  surahName: string;
  textUthmani: string;
  textSimple: string;
  translation?: string;
  tafsirSummary?: string;
  words?: string[];
  themeCategory?: {
    name: string;
    color: string;
    branchId: string;
  };
}

export interface QuranPageData {
  pageNumber: number;
  surahNumber: number;
  surahName: string;
  juzNumber: number;
  ayahs: Ayah[];
  imageUrl?: string;
}

export type AppViewMode = 'home' | 'globe' | 'mushaf' | 'mindmap' | 'section-map' | 'test-word-reveal' | 'test-random-ayah' | 'global-map' | 'site-map';

/** Constrains a quiz to a specific surah or ayah range within a surah */
export interface QuizScope {
  /** Label shown in the quiz header, e.g. "سورة النور" or "محور الأحكام (آيات 1-20)" */
  label: string;
  surahNumber?: number;       // if set, restrict to pages of this surah
  startAyah?: number;         // further restrict to ayah range within the surah
  endAyah?: number;
}

export type ReciterId = 'ar.alafasy' | 'ar.husary' | 'ar.minshawi' | 'ar.hudhaify';

export interface Reciter {
  id: ReciterId;
  name: string;
  arabicName: string;
  serverUrl: string;
}
