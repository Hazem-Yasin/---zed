import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Changing this value clears a previous error (e.g. the active view). */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/** Keeps a crash in one screen (e.g. WebGL) from blanking the whole app. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error: Error) {
    console.error('View crashed:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-center justify-center h-full gap-4 text-center p-6" dir="rtl">
        <p className="text-lg font-bold text-amber-300">حدث خطأ غير متوقع في هذه الشاشة</p>
        <p className="text-slate-400 text-sm max-w-sm">يمكنك إعادة المحاولة، أو الانتقال إلى شاشة أخرى من القائمة.</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }
}
