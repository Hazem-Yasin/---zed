import React from 'react';

/* ------------------------------------------------------------------ */
/* Small shared building blocks so every screen looks the same.        */
/* ------------------------------------------------------------------ */

type DivProps = React.HTMLAttributes<HTMLDivElement>;

/** Frosted floating panel (the "glass" look used on the globe). */
export const Panel: React.FC<DivProps & { strong?: boolean; rounded?: string }> = ({
  strong,
  rounded = 'rounded-2xl',
  className = '',
  children,
  ...rest
}) => (
  <div className={`${strong ? 'glass-panel-strong' : 'glass-panel'} ${rounded} ${className}`} {...rest}>
    {children}
  </div>
);

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required: icon-only buttons must say what they do (used as tooltip + screen-reader name). */
  label: string;
  size?: 'sm' | 'md';
  active?: boolean;
};

/** Icon-only button with a mandatory accessible name. */
export const IconButton: React.FC<BtnProps> = ({ label, size = 'md', active, className = '', children, ...rest }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={`${size === 'sm' ? 'p-1.5' : 'p-2'} rounded-xl transition-colors disabled:opacity-40 disabled:pointer-events-none ${
      active
        ? 'bg-amber-500 text-slate-950'
        : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800/80'
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
);

type Tone = 'amber' | 'emerald' | 'sky' | 'violet' | 'slate';

const TONES: Record<Tone, { idle: string; on: string }> = {
  amber: { idle: 'text-amber-300 border-amber-500/30 hover:bg-amber-500/10', on: 'text-amber-200 border-amber-500/60 bg-amber-500/15' },
  emerald: { idle: 'text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10', on: 'text-emerald-200 border-emerald-500/60 bg-emerald-500/15' },
  sky: { idle: 'text-sky-300 border-sky-500/30 hover:bg-sky-500/10', on: 'text-sky-200 border-sky-500/60 bg-sky-500/15' },
  violet: { idle: 'text-violet-300 border-violet-500/30 hover:bg-violet-500/10', on: 'text-violet-200 border-violet-500/60 bg-violet-500/15' },
  slate: { idle: 'text-slate-200 border-slate-700 hover:bg-slate-800/80', on: 'text-white border-slate-500 bg-slate-800' },
};

/** Labelled action button (icon + text) with a consistent size and tone. */
export const ActionButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; on?: boolean; icon?: React.ReactNode }
> = ({ tone = 'slate', on, icon, className = '', children, ...rest }) => (
  <button
    type="button"
    aria-pressed={on === undefined ? undefined : on}
    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
      on ? TONES[tone].on : TONES[tone].idle
    } ${className}`}
    {...rest}
  >
    {icon}
    <span>{children}</span>
  </button>
);

/** Selectable pill (filters, theme chips). */
export const Chip: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; color?: string }
> = ({ on, color, className = '', children, ...rest }) => (
  <button
    type="button"
    aria-pressed={!!on}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
      on ? 'bg-slate-100 text-slate-900 border-slate-100' : 'text-slate-300 border-slate-700 hover:bg-slate-800/80'
    } ${className}`}
    {...rest}
  >
    {color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />}
    {children}
  </button>
);

/** Segmented control: one option active at a time. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string; icon?: React.ReactNode; hint?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/70 border border-slate-700/60">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          title={o.hint}
          onClick={() => onChange(o.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            value === o.id ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Shown when text/data could not be loaded. Never substitute fake content: offer a retry instead. */
export const LoadError: React.FC<{ message?: string; onRetry: () => void }> = ({
  message = 'تعذّر تحميل النص. تحقّق من اتصالك بالإنترنت ثم حاول مرة أخرى.',
  onRetry,
}) => (
  <div role="alert" className="flex flex-col items-center justify-center h-full gap-4 text-center p-6" dir="rtl">
    <p className="text-slate-300 font-cairo text-base max-w-sm leading-relaxed">{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors"
    >
      إعادة المحاولة
    </button>
  </div>
);

