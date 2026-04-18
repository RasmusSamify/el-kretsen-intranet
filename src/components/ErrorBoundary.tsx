import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-ink-50">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-red-100 shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl bg-red-50 text-red-600 inline-flex items-center justify-center">
                <AlertTriangle size={20} strokeWidth={2.25} />
              </span>
              <div>
                <h2 className="font-bold text-ink-900 text-lg">Något gick fel</h2>
                <p className="text-ink-500 text-sm">Klient-fel — se detaljer nedan.</p>
              </div>
            </div>
            <pre className="text-xs font-mono bg-ink-50 p-4 rounded-xl border border-ink-100 overflow-x-auto whitespace-pre-wrap">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => location.reload()}
              className="mt-4 w-full py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-colors"
            >
              Ladda om sidan
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
