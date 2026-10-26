import { describe, expect, it } from 'vitest';
import { splitAyahIntoWords, splitWordIntoLetters, stripLeadingBismillah } from './quranApi';

describe('stripLeadingBismillah', () => {
  const BISM = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

  it('removes the Bismillah from verse 1 of a regular surah', () => {
    expect(stripLeadingBismillah(`${BISM} الٓمٓ`, 2, 1)).toBe('الٓمٓ');
  });

  it('is tolerant to different diacritics / alef spellings', () => {
    const variant = 'بِّسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ الٓمٓ';
    expect(stripLeadingBismillah(variant, 2, 1)).toBe('الٓمٓ');
  });

  it('keeps Al-Fatihah verse 1 (the Bismillah IS the verse)', () => {
    expect(stripLeadingBismillah(BISM, 1, 1)).toBe(BISM);
  });

  it('does nothing for At-Tawbah and for other verses', () => {
    expect(stripLeadingBismillah('بَرَآءَةٌ مِّنَ ٱللَّهِ', 9, 1)).toBe('بَرَآءَةٌ مِّنَ ٱللَّهِ');
    expect(stripLeadingBismillah(`${BISM} x`, 2, 2)).toBe(`${BISM} x`);
  });

  it('never produces an empty verse when the text is only the Bismillah', () => {
    expect(stripLeadingBismillah(BISM, 2, 1)).toBe(BISM);
  });
});

describe('word / letter splitting', () => {
  it('splits an ayah into words on any whitespace', () => {
    expect(splitAyahIntoWords('  مَٰلِكِ   يَوْمِ ٱلدِّينِ ')).toEqual(['مَٰلِكِ', 'يَوْمِ', 'ٱلدِّينِ']);
  });

  it('keeps diacritics attached to their base letter', () => {
    expect(splitWordIntoLetters('بِسْمِ')).toEqual(['بِ', 'سْ', 'مِ']);
  });
});
