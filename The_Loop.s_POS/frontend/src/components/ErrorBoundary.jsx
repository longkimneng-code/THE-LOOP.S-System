import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[The Loops Runtime Error caught by ErrorBoundary]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    localStorage.removeItem('loops_auth_token');
    localStorage.removeItem('the_loops_theme');
    localStorage.removeItem('loops_finance_theme');
    localStorage.removeItem('loops_stock_role');
    localStorage.removeItem('loops_finance_role');
    localStorage.removeItem('loops_last_app_view');
    if (typeof window !== 'undefined' && window.__loops_setAppView) {
      try { window.__loops_setAppView('POS'); } catch (e) {}
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-obsidian-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans select-none">
          <div className="w-full max-w-lg bg-obsidian-900 border border-obsidian-750 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100 font-display">Application State Recovery</h2>
                <p className="text-xs text-slate-400">A component encountered a rendering issue.</p>
              </div>
            </div>

            <div className="p-3 bg-obsidian-950 rounded-xl border border-obsidian-800 text-xs font-mono text-rose-300 overflow-x-auto max-h-40">
              {this.state.error?.toString() || 'Unknown runtime error'}
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 text-xs font-bold text-slate-200 flex items-center justify-center space-x-2 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Application</span>
              </button>

              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 text-xs font-bold flex items-center justify-center space-x-2 transition shadow-md shadow-brass-500/20"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Session Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

