import { useState } from "react";

/**
 * Model Comparison Component
 * Shows available AI models, comparison results, and consensus data.
 */
export default function ModelComparison({ availableModels, comparisonResult, onCompare, isLoading, dark }) {
  const [expanded, setExpanded] = useState(false);

  if (!comparisonResult && !availableModels?.length) return null;

  const consensus = comparisonResult?.comparison?.consensus;
  const modelResults = comparisonResult?.comparison?.model_results;

  const getAgreementColor = (pct) => {
    if (pct >= 80) return "#22c55e";
    if (pct >= 50) return "#f97316";
    return "#ef4444";
  };

  return (
    <div className={`rounded-2xl border p-5 backdrop-blur-2xl shadow-2xl ${
      dark ? "bg-gradient-to-b from-white/[0.12] to-white/[0.05] border-white/[0.2] shadow-black/40"
           : "bg-gradient-to-b from-white/90 to-white/70 border-gray-200 shadow-gray-400/30"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔄</span>
          <h3 className={`font-bold ${dark ? "text-white" : "text-gray-900"}`}>AI Model Comparison</h3>
        </div>
        <button onClick={() => setExpanded(!expanded)}
          className={`text-xs px-2 py-1 rounded-lg transition ${dark ? "text-gray-400 hover:bg-white/[0.06]" : "text-gray-500 hover:bg-gray-100"}`}>
          {expanded ? "▲ Less" : "▼ More"}
        </button>
      </div>

      {/* Available Models */}
      {availableModels && (
        <div className="flex gap-2 flex-wrap mb-3">
          {availableModels.map((m, idx) => (
            <span key={idx} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
              m.available
                ? (dark ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-600 border-emerald-200")
                : (dark ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-red-50 text-red-600 border-red-200")
            }`}>
              {m.name} {m.available ? "✓" : "✗"}
            </span>
          ))}
        </div>
      )}

      {/* Compare Button */}
      {onCompare && !comparisonResult && (
        <button onClick={onCompare} disabled={isLoading}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90 transition shadow-lg shadow-indigo-500/30 disabled:opacity-40 flex items-center gap-2">
          {isLoading ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "🔀"}
          {isLoading ? "Comparing..." : "Compare Models"}
        </button>
      )}

      {/* Consensus Summary */}
      {consensus && (
        <div className={`rounded-xl p-3 border mb-3 ${dark ? "bg-purple-500/[0.06] border-purple-500/20" : "bg-purple-50 border-purple-200"}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1">
              <p className={`text-xs font-medium mb-1 ${dark ? "text-gray-400" : "text-gray-500"}`}>Model Agreement</p>
              <div className="flex items-center gap-2">
                <div className={`flex-1 h-2 rounded-full overflow-hidden ${dark ? "bg-white/[0.06]" : "bg-gray-200"}`}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${consensus.overall_agreement || 0}%`, backgroundColor: getAgreementColor(consensus.overall_agreement) }} />
                </div>
                <span className="text-xs font-bold" style={{ color: getAgreementColor(consensus.overall_agreement) }}>{consensus.overall_agreement}%</span>
              </div>
            </div>
            {consensus.confidence_level && (
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                consensus.confidence_level.startsWith("High") ? "bg-emerald-500/10 text-emerald-400"
                : consensus.confidence_level.startsWith("Medium") ? "bg-amber-500/10 text-amber-400"
                : "bg-red-500/10 text-red-400"
              }`}>{consensus.confidence_level}</span>
            )}
          </div>
        </div>
      )}

      {/* Expanded: Model-by-Model Results */}
      {expanded && modelResults && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {Object.entries(modelResults).map(([key, result]) => (
            <div key={key} className={`rounded-xl p-3 border ${dark ? "bg-white/[0.03] border-white/[0.08]" : "bg-gray-50 border-gray-200"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-bold ${dark ? "text-white" : "text-gray-900"}`}>{result.model}</span>
                {result.error ? (
                  <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">Error</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">{result.issues_count} issues</span>
                )}
              </div>
              {result.latency_ms && (
                <p className={`text-[10px] ${dark ? "text-gray-400" : "text-gray-400"}`}>⏱ {result.latency_ms}ms</p>
              )}
              {result.error && (
                <p className="text-[10px] text-red-400 mt-1">{result.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Multi-model info */}
      {comparisonResult?.comparison?.models_used?.length > 1 && (
        <div className={`mt-3 rounded-lg p-3 text-xs ${dark ? "bg-blue-500/[0.06] border border-blue-500/20 text-blue-300" : "bg-blue-50 border border-blue-200 text-blue-600"}`}>
          <strong>Multi-model scan:</strong> {comparisonResult.comparison.total_models} models used. Results are consensus-scored.
        </div>
      )}
    </div>
  );
}
