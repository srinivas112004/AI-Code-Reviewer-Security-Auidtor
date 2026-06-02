import { useState } from "react";

const LINE_COLORS = {
  added:     { bg: "rgba(46,160,67,0.12)", border: "#2ea043", prefix: "+" },
  removed:   { bg: "rgba(248,81,73,0.12)", border: "#f85149", prefix: "-" },
  unchanged: { bg: "transparent",          border: "transparent", prefix: " " },
};

function DiffLine({ line, lineNum }) {
  const c = LINE_COLORS[line.type] || LINE_COLORS.unchanged;
  return (
    <div className="flex font-mono text-xs leading-relaxed hover:bg-white/[0.02]"
      style={{ borderLeft: `3px solid ${c.border}`, backgroundColor: c.bg }}>
      <span className="w-10 min-w-[2.5rem] text-right pr-1 pl-1 select-none text-white/30 border-r border-white/[0.06]">{lineNum}</span>
      <span className={`w-5 min-w-[1.25rem] text-center select-none font-bold ${
        line.type === "added" ? "text-green-500" : line.type === "removed" ? "text-red-400" : "text-white/20"
      }`}>{c.prefix}</span>
      <span className={`flex-1 pl-1 pr-2 whitespace-pre-wrap break-all ${
        line.type === "removed" ? "text-white/60 line-through" : "text-gray-200"
      }`}>{line.content}</span>
    </div>
  );
}

function CodeBlock({ code, title, color, onCopy, dark }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08]"
        style={{ backgroundColor: `${color}10` }}>
        <span className="text-xs font-bold tracking-wide" style={{ color }}>{title}</span>
        {onCopy && (
          <button onClick={onCopy} className="text-white/50 hover:text-white/80 transition" title="Copy">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        )}
      </div>
      <div className="font-mono text-xs leading-relaxed p-3 whitespace-pre-wrap break-all text-gray-200 max-h-96 overflow-y-auto">
        {code}
      </div>
    </div>
  );
}

export default function CodeDiff({ originalCode, fixedCode, inlineDiff, dark, onCopy }) {
  const [viewMode, setViewMode] = useState("inline");
  const diffLines = inlineDiff || [];
  const addedCount = diffLines.filter((l) => l.type === "added").length;
  const removedCount = diffLines.filter((l) => l.type === "removed").length;

  const handleCopy = (code) => {
    if (onCopy) onCopy(code);
    else navigator.clipboard.writeText(code);
  };

  return (
    <div className={`rounded-xl border overflow-hidden mb-3 ${dark ? "bg-black/30 border-white/[0.1]" : "bg-gray-900 border-gray-700"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08] bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span className="text-xs font-bold text-white">Code Diff</span>
          {diffLines.length > 0 && (
            <>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-bold">+{addedCount}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-bold">-{removedCount}</span>
            </>
          )}
        </div>
        <div className={`flex rounded-lg overflow-hidden border ${dark ? "border-white/[0.1]" : "border-gray-600"}`}>
          <button onClick={() => setViewMode("inline")}
            className={`px-2 py-1 text-[10px] transition ${viewMode === "inline" ? "bg-indigo-500/20 text-indigo-400" : "text-gray-500 hover:text-gray-300"}`}
            title="Inline diff">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <button onClick={() => setViewMode("sideBySide")}
            className={`px-2 py-1 text-[10px] transition ${viewMode === "sideBySide" ? "bg-indigo-500/20 text-indigo-400" : "text-gray-500 hover:text-gray-300"}`}
            title="Side by side">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 4h6m-6 16h6M3 12h18" /></svg>
          </button>
        </div>
      </div>

      {/* Diff Content */}
      {viewMode === "inline" ? (
        <div className="max-h-[500px] overflow-y-auto">
          {diffLines.length > 0 ? (
            diffLines.map((line, idx) => <DiffLine key={idx} line={line} lineNum={idx + 1} />)
          ) : (
            <div className="flex flex-col">
              {originalCode && (
                <div className="p-3">
                  <span className="text-xs font-bold text-red-400">Original:</span>
                  <pre className="font-mono text-xs text-gray-200 whitespace-pre-wrap mt-1">{originalCode}</pre>
                </div>
              )}
              {fixedCode && (
                <div className="p-3 border-t border-white/[0.08]">
                  <span className="text-xs font-bold text-green-400">Fixed:</span>
                  <pre className="font-mono text-xs text-gray-200 whitespace-pre-wrap mt-1">{fixedCode}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex max-h-[500px] overflow-y-auto">
          <CodeBlock code={originalCode || ""} title="BEFORE (Vulnerable)" color="#f85149" dark={dark}
            onCopy={() => handleCopy(originalCode)} />
          <div className="w-px bg-white/[0.08]" />
          <CodeBlock code={fixedCode || ""} title="AFTER (Fixed)" color="#2ea043" dark={dark}
            onCopy={() => handleCopy(fixedCode)} />
        </div>
      )}
    </div>
  );
}
