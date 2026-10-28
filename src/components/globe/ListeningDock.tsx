import React from 'react';
import { Headphones, Loader2, Pause, Play, Repeat, SkipBack, SkipForward, X, ChevronsLeft, ChevronsRight, WifiOff, AlertTriangle } from 'lucide-react';
import { SURAHS_LIST } from '../../data/surahs';
import { RECITERS } from '../../services/quranApi';
import { ListenError, ListenState, surahPlayer } from '../../services/surahPlayer';
import { globalAudio, PLAYBACK_RATES } from '../../services/audioManager';
import { IconButton } from '../ui/kit';
import { MECCAN_HEX, MEDINAN_HEX } from './globeEngine';

interface Props {
  state: ListenState;
}

const ERROR_TEXT: Record<Exclude<ListenError, null>, { icon: React.ReactNode; text: string }> = {
  offline: { icon: <WifiOff className="w-3.5 h-3.5" />, text: 'لا يوجد اتصال بالإنترنت. التلاوة تحتاج اتصالاً، اضغط تشغيل بعد عودته.' },
  network: { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: 'تعذّر تحميل التلاوة من الخادم. جرّب قارئاً آخر أو اضغط تشغيل لإعادة المحاولة.' },
  blocked: { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: 'منع المتصفح التشغيل التلقائي. اضغط زر التشغيل للبدء.' },
};

/** Floating player that follows the surah being recited on the globe. */
export const ListeningDock: React.FC<Props> = ({ state }) => {
  const [rate, setRate] = React.useState(() => globalAudio.getRate());

  if (!state.active || state.surah === null) return null;

  const meta = SURAHS_LIST[state.surah - 1];
  const accent = meta.revelationType === 'Meccan' ? MECCAN_HEX : MEDINAN_HEX;
  const pct = state.total > 0 ? (state.ayah / state.total) * 100 : 0;

  return (
    <div
      role="region"
      data-tour="listen-dock"
      aria-label="مشغّل التلاوة"
      className="absolute top-[4.6rem] left-1/2 -translate-x-1/2 z-20 w-[min(94%,31rem)] rounded-2xl bg-slate-950/85 backdrop-blur-md border shadow-xl px-3.5 py-2.5 animate-fade-in"
      style={{ borderColor: `${accent}66`, boxShadow: `0 0 28px ${accent}22` }}
      dir="rtl"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
          style={{ background: `${accent}1f`, borderColor: `${accent}55`, color: accent }}
        >
          <Headphones className="w-4 h-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <span className="truncate">سورة {meta.name}</span>
            <span className="text-xs font-bold text-slate-400 shrink-0">
              {state.ayah} / {state.total}
            </span>
          </div>
          <div
            className="mt-1 h-1 rounded-full bg-slate-800 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={state.total}
            aria-valuenow={state.ayah}
            aria-label="تقدّم السورة"
          >
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: accent }} />
          </div>
        </div>

        <IconButton label="إيقاف الاستماع" size="sm" onClick={() => surahPlayer.stop()}>
          <X className="w-4 h-4" />
        </IconButton>
      </div>

      {state.error && (
        <div role="alert" className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
          <span className="mt-0.5 shrink-0">{ERROR_TEXT[state.error].icon}</span>
          <span>{ERROR_TEXT[state.error].text}</span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <IconButton label="السورة السابقة" size="sm" onClick={() => surahPlayer.prevSurah()} disabled={state.surah <= 1}>
            <ChevronsRight className="w-4 h-4" />
          </IconButton>
          <IconButton label="الآية السابقة" size="sm" onClick={() => surahPlayer.prevAyah()}>
            <SkipForward className="w-4 h-4" />
          </IconButton>
          <button
            type="button"
            onClick={() => surahPlayer.togglePlay()}
            aria-label={state.playing ? 'إيقاف مؤقت' : 'تشغيل'}
            title={state.playing ? 'إيقاف مؤقت' : 'تشغيل'}
            className="w-9 h-9 mx-1 rounded-full flex items-center justify-center text-slate-950 shadow-lg transition-transform hover:scale-105"
            style={{ background: accent }}
          >
            {state.loading && state.playing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : state.playing ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 translate-x-[-1px]" />
            )}
          </button>
          <IconButton label="الآية التالية" size="sm" onClick={() => surahPlayer.nextAyah()}>
            <SkipBack className="w-4 h-4" />
          </IconButton>
          <IconButton label="السورة التالية" size="sm" onClick={() => surahPlayer.nextSurah()} disabled={state.surah >= 114}>
            <ChevronsLeft className="w-4 h-4" />
          </IconButton>
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => surahPlayer.setAutoNext(!state.autoNext)}
            aria-pressed={state.autoNext}
            title={state.autoNext ? 'الانتقال التلقائي للسورة التالية: مفعّل' : 'الانتقال التلقائي للسورة التالية: متوقف'}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${
              state.autoNext
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            <Repeat className="w-3 h-3" />
            <span className="hidden sm:inline">السورة التالية تلقائياً</span>
            <span className="sm:hidden">تلقائي</span>
          </button>
          <select
            value={state.reciterId}
            onChange={(e) => surahPlayer.setReciter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 text-xs font-bold text-amber-200 focus:outline-none focus:border-amber-500 max-w-[7.5rem] truncate"
            title="القارئ"
            aria-label="القارئ"
          >
            {RECITERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.arabicName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const i = PLAYBACK_RATES.findIndex((r) => r === rate);
              const next = PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length];
              globalAudio.setRate(next);
              setRate(next);
            }}
            title="سرعة التلاوة"
            aria-label={`سرعة التلاوة ${rate}`}
            className="px-2 py-1 rounded-lg text-xs font-bold border bg-slate-900 text-amber-200 border-slate-700 hover:border-amber-500/50 tabular-nums"
          >
            {rate}×
          </button>
        </div>
      </div>
    </div>
  );
};
