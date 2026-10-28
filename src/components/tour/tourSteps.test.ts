import { describe, expect, it } from 'vitest';
import { getSurahMindMap } from '../../data/mindmaps/mindmapData';
import { SURAHS_LIST } from '../../data/surahs';
import { COMPARE_CHAIN, TOUR_STEPS, compareText, leadMs, readMs } from './tourSteps';

const compareSteps = TOUR_STEPS.filter((s) => /^compare-\d+$/.test(s.id));

describe('guided tour steps', () => {
  it('has unique ids and non-empty copy', () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    TOUR_STEPS.forEach((s) => {
      expect(s.title.length).toBeGreaterThan(2);
      expect(s.text.length).toBeGreaterThan(20);
      expect(readMs(s)).toBeGreaterThanOrEqual(s.ms);
    });
  });

  it('covers the globe first, then the rest of the site', () => {
    const firstSite = TOUR_STEPS.findIndex((s) => s.part === 'site');
    expect(firstSite).toBeGreaterThan(0);
    expect(TOUR_STEPS.slice(0, firstSite).every((s) => s.view === 'globe')).toBe(true);
    // every non-globe step belongs to the "site" part
    TOUR_STEPS.filter((s) => s.view !== 'globe').forEach((s) => expect(s.part).toBe('site'));
  });

  it('compares 7 distinct, far-apart surahs, two at a time, newest replacing oldest', () => {
    expect(new Set(COMPARE_CHAIN).size).toBe(7);
    expect(compareSteps).toHaveLength(6);
    compareSteps.forEach((s, i) => {
      const { a, b } = s.globe!.compare!;
      expect(Math.abs(a! - b!)).toBeGreaterThanOrEqual(60);
      if (i > 0) expect(a).toBe(compareSteps[i - 1].globe!.compare!.b); // previous B becomes the new A
    });
  });

  it('explains each comparison with the real names and verse counts', () => {
    COMPARE_CHAIN.slice(0, -1).forEach((_, i) => {
      const { title, text } = compareText(i);
      const a = SURAHS_LIST[COMPARE_CHAIN[i] - 1];
      const b = SURAHS_LIST[COMPARE_CHAIN[i + 1] - 1];
      expect(title).toContain(a.name);
      expect(title).toContain(b.name);
      expect(text).toContain('الآن');
      expect(text).toContain(a.name);
      expect(text).toContain(b.name);
      expect(text).toMatch(new RegExp(`${a.totalVerses}|آية واحدة|آيتان`));
    });
  });

  it('only points at surahs, branches and pages that exist', () => {
    TOUR_STEPS.forEach((s) => {
      const place = s.globe?.place;
      if (place?.surah) {
        expect(place.surah).toBeGreaterThanOrEqual(1);
        expect(place.surah).toBeLessThanOrEqual(114);
        if (place.section !== undefined) expect(getSurahMindMap(place.surah).branches[place.section]).toBeTruthy();
      }
      if (s.sectionMap) {
        expect(getSurahMindMap(s.sectionMap.surah).branches.some((b) => b.id === s.sectionMap!.branchId)).toBe(true);
        expect(s.sectionMap.start).toBeGreaterThan(0);
      }
      if (s.page) {
        expect(s.page).toBeGreaterThanOrEqual(1);
        expect(s.page).toBeLessThanOrEqual(604);
      }
    });
  });

  it('gives the camera time to fly in and out of surahs', () => {
    const byId = (id: string) => TOUR_STEPS.find((s) => s.id === id)!;
    const outer = byId('compare-6');
    const inSurah = byId('enter-surah');
    const inSection = byId('enter-section');
    expect(leadMs(inSurah, outer)).toBeGreaterThanOrEqual(3000); // enterSurah takes 2.4 s
    expect(leadMs(inSection, byId('surah-tools'))).toBeGreaterThanOrEqual(2100); // enterSection takes 1.5 s
    expect(leadMs(byId('back-quiz'), byId('section-tools'))).toBeGreaterThanOrEqual(4600); // leaveSection + leaveSurah = 3.4 s
    expect(leadMs(byId('surah-tools'), inSurah)).toBeLessThan(1000); // same place: nothing to wait for
  });
});
