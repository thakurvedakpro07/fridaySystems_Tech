import { Component } from "react";

/**
 * Catches runtime errors in any descendant component tree and shows a fallback UI
 * instead of crashing the whole page. Wrap sections of the app that can fail
 * independently (e.g. a dashboard panel, a complex form).
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponentThatMightCrash />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>Custom fallback</p>}>
 *     ...
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production, send to an error tracker here (Sentry, etc.)
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary] Caught error:", error, info.componentStack);
    }
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Something went wrong</h2>
        <p className="text-sm text-slate-500 mb-5 max-w-xs">
          An unexpected error occurred in this section. Refreshing the page usually fixes it.
        </p>
        <div className="flex gap-3">
          <button
            onClick={this.handleReset}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-slate-200
                       text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-600 text-white
                       hover:bg-indigo-700 transition-colors"
          >
            Reload page
          </button>
        </div>
        {import.meta.env.DEV && this.state.error && (
          <pre className="mt-5 text-left text-xs text-rose-700 bg-rose-50 border border-rose-200
                          rounded-lg px-4 py-3 max-w-lg overflow-auto whitespace-pre-wrap">
            {this.state.error.toString()}
          </pre>
        )}
      </div>
    );
  }
}
