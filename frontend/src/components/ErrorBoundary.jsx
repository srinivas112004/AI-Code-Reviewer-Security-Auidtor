import React from "react";

/**
 * React Error Boundary Component (Tailwind-styled)
 * Catches JavaScript errors in child components and displays a fallback UI.
 * Logs errors to backend for debugging.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Error info:", errorInfo);

    this.setState((prev) => ({ errorInfo, errorCount: prev.errorCount + 1 }));

    // Log to backend
    try {
      const token = localStorage.getItem("token");
      if (token) {
        fetch("http://localhost:5000/api/client-error", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            error: error.toString(),
            stack: error.stack,
            componentStack: errorInfo?.componentStack,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
          }),
        }).catch(() => {});
      }
    } catch {
      // Silently fail
    }
  }

  handleRetry = () => this.setState({ hasError: false, error: null, errorInfo: null });
  handleGoHome = () => (window.location.href = "/");
  handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const isDev = import.meta.env?.DEV;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0a0b14] via-[#0f1121] to-[#0a0b14] p-6">
        {/* Blur blobs */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] blur-[180px] rounded-full bg-red-600/15 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] blur-[180px] rounded-full bg-indigo-600/15 pointer-events-none" />

        <div className="relative max-w-lg w-full backdrop-blur-2xl bg-gradient-to-b from-white/[0.12] to-white/[0.05] border border-red-500/30 rounded-2xl shadow-2xl shadow-black/40 p-8 text-center">
          {/* Inner shine */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10">
            {/* Error Icon */}
            <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-5 animate-pulse">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Something Went Wrong</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              An unexpected error occurred. Don't worry, your data is safe. You can try refreshing the page or going back to the home screen.
            </p>

            {/* Dev error details */}
            {isDev && this.state.error && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6 text-left max-h-48 overflow-auto">
                <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack && (
                    <>
                      {"\n\nComponent Stack:"}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={this.handleRetry}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition shadow-lg shadow-indigo-500/30 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-5 py-2.5 rounded-xl border border-white/20 text-white text-sm font-medium hover:bg-white/5 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Go Home
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2.5 rounded-xl text-gray-500 text-sm hover:text-white transition"
              >
                Reload Page
              </button>
            </div>

            {/* Error count warning */}
            {this.state.errorCount > 2 && (
              <p className="mt-4 text-xs text-amber-400">
                This error has occurred {this.state.errorCount} times. Try clearing your browser cache or contact support.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
