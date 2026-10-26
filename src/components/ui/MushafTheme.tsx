import React from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';

export type MushafTheme = 'classic' | 'sepia' | 'light' | 'night';

const THEMES: { id: MushafTheme; label: string; swatch: string }[] = [
  { id: 'classic', label: 'كلاسيكي', swatch: '#fbf7ee' },
  { id: 'sepia', label: 'ورقي', swatch: '#f4ecd8' },
  { id: 'light', label: 'فاتح', swatch: '#ffffff' },
  { id: 'night', label: 'ليلي', swatch: '#14181f' },
];

/** One reading theme shared by every screen that draws the mushaf page. */
export const useMushafTheme = () =>
  usePersistentState<MushafTheme>('mushaf-theme', 'classic', (v) => THEMES.some((t) => t.id === v));

export const MushafThemePicker: React.FC<{ value: MushafTheme; onChange: (t: MushafTheme) => void }> = ({ value, onChange }) => (
  <div role="radiogroup" aria-label="سمة القراءة" className="flex items-center gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700">
    {THEMES.map((t) => (
      <button
        key={t.id}
        type="button"
        role="radio"
        aria-checked={value === t.id}
        aria-label={`سمة ${t.label}`}
        title={`سمة ${t.label}`}
        onClick={() => onChange(t.id)}
        className={`w-5 h-5 rounded-full border-2 transition-transform ${
          value === t.id ? 'border-amber-400 scale-110' : 'border-slate-600 hover:border-slate-400'
        }`}
        style={{ background: t.swatch }}
      />
    ))}
  </div>
);
