import { useState, useContext, useEffect, useRef } from "react";
import { ThemeContext } from "../components/ThemeContext";
import Navbar from "../components/Navbar";
import axios from "axios";

const API = "http://localhost:5000";
const LANGUAGES = [
  "auto-detect","python","javascript","typescript","java","csharp","cpp","c","go",
  "rust","ruby","php","swift","kotlin","scala","sql","html","css","shell","yaml","json",
];

const TYPE_ICONS = {
  function: "ƒ", class: "◆", loop: "↻", conditional: "⑂", import: "↓", config: "⚙", other: "•",
};
const TYPE_COLORS = {
  function: "from-indigo-500 to-blue-500",
  class: "from-purple-500 to-pink-500",
  loop: "from-amber-500 to-orange-500",
  conditional: "from-emerald-500 to-teal-500",
  import: "from-cyan-500 to-blue-400",
  config: "from-gray-500 to-slate-500",
  other: "from-gray-400 to-gray-500",
};

/* ── Typewriter component ── */
function Typewriter({ text, speed = 30, onDone, className }) {
  const [displayed, setDisplayed] = useState("");
  const idx = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!text) { setDisplayed(""); onDone?.(); return; }
    idx.current = 0;
    setDisplayed("");

    timerRef.current = setInterval(() => {
      idx.current += 1;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) {
        clearInterval(timerRef.current);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(timerRef.current);
  }, [text, speed]);

  return (
    <span className={className}>
      {displayed}
      {displayed.length < (text?.length || 0) && (
        <span className="inline-block w-[2px] h-[1em] bg-indigo-400 ml-0.5 animate-pulse align-middle" />
      )}
    </span>
  );
}

export default function CodeExplain() {
  const { dark } = useContext(ThemeContext);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("auto-detect");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [expandedBlocks, setExpandedBlocks] = useState({});

  // Typing animation state machine
  const [typingPhase, setTypingPhase] = useState("idle"); // idle | summary | blocks | tips | done
  const [revealedBlocks, setRevealedBlocks] = useState(0);
  const [revealedTips, setRevealedTips] = useState(0);
  const [skipAll, setSkipAll] = useState(false);

  const handleExplain = async () => {
    if (!code.trim()) return setError("Please paste some code first.");
    setError(""); setResult(null); setLoading(true);
    setTypingPhase("idle"); setRevealedBlocks(0); setRevealedTips(0); setSkipAll(false);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API}/api/explain`, { code, language },
        { headers: { Authorization: `Bearer ${token}` } });
      setResult(res.data);
      const expanded = {};
      (res.data.blocks || []).forEach((_, i) => { expanded[i] = true; });
      setExpandedBlocks(expanded);
      setTypingPhase("summary");
    } catch (e) {
      setError(e.response?.data?.error || "Failed to explain code. Please try again.");
    } finally { setLoading(false); }
  };

  const onSummaryDone = () => {
    if (result?.blocks?.length) setTypingPhase("blocks");
    else if (result?.tips?.length) setTypingPhase("tips");
    else setTypingPhase("done");
  };

  const onBlockDone = () => {
    const next = revealedBlocks + 1;
    setRevealedBlocks(next);
    if (next >= (result?.blocks?.length || 0)) {
      if (result?.tips?.length) setTypingPhase("tips");
      else setTypingPhase("done");
    }
  };

  const onTipDone = () => {
    const next = revealedTips + 1;
    setRevealedTips(next);
    if (next >= (result?.tips?.length || 0)) setTypingPhase("done");
  };

  const handleSkip = () => {
    setSkipAll(true);
    setRevealedBlocks(result?.blocks?.length || 0);
    setRevealedTips(result?.tips?.length || 0);
    setTypingPhase("done");
  };

  const toggleBlock = (i) => setExpandedBlocks(p => ({ ...p, [i]: !p[i] }));

  const bg = dark
    ? "min-h-screen bg-gradient-to-b from-[#0a0b14] via-[#0f1121] to-[#0a0b14] text-white"
    : "min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 text-gray-900";

  const cardCls = dark
    ? "bg-white/[0.04] border border-white/[0.08] backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/40"
    : "bg-white/80 border border-gray-200 backdrop-blur-2xl rounded-2xl shadow-xl shadow-gray-300/40";

  const inputCls = `w-full rounded-xl px-4 py-3 text-sm transition-all duration-200 outline-none
    ${dark ? "bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-gray-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
           : "bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"}`;

  const isTyping = typingPhase !== "idle" && typingPhase !== "done";

  return (
    <div className={bg}>
      <Navbar />
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute top-20 left-1/4 w-96 h-96 rounded-full blur-[120px] animate-blob ${dark ? "bg-indigo-600/10" : "bg-indigo-300/20"}`} style={{animationDuration:'20s'}} />
          <div className={`absolute bottom-20 right-1/4 w-96 h-96 rounded-full blur-[120px] animate-blob ${dark ? "bg-purple-600/10" : "bg-purple-300/20"}`} style={{animationDuration:'25s', animationDelay:'3s'}} />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-10">
          {/* Header */}
          <div className="text-center mb-8 page-enter">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-full px-5 py-2 mb-4">
              <span className="text-lg">🧠</span>
              <span className={`text-sm font-medium ${dark ? "text-indigo-300" : "text-indigo-600"}`}>AI-Powered Code Explanation</span>
            </div>
            <h1 className={`text-3xl md:text-4xl font-bold mb-2 ${dark ? "text-white" : "text-gray-900"}`}>
              Understand Your Code <span className="bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">Instantly</span>
            </h1>
            <p className={`text-base ${dark ? "text-gray-400" : "text-gray-500"}`}>
              Paste any code and get a clear, beginner-friendly explanation of every function, loop, and logic block.
            </p>
          </div>

          {/* Input Area */}
          <div className={`${cardCls} p-6 mb-8`}>
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <select value={language} onChange={(e) => setLanguage(e.target.value)}
                className={`${inputCls} md:w-52`}>
                {LANGUAGES.map(l => <option key={l} value={l} className={dark ? "bg-slate-900" : ""}>{l === "auto-detect" ? "🔍 Auto-Detect" : l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
              </select>
              <button onClick={handleExplain} disabled={loading || !code.trim()}
                className={`px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300 shadow-lg
                  ${loading || !code.trim()
                    ? "bg-gray-500 cursor-not-allowed opacity-50"
                    : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-95"
                  }`}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing…
                  </span>
                ) : "✨ Explain Code"}
              </button>
            </div>
            <textarea value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your code here…"
              rows={14}
              className={`${inputCls} font-mono text-[13px] leading-relaxed resize-y`}
              spellCheck={false} />
            <div className="flex justify-between items-center mt-2">
              <span className={`text-xs ${dark ? "text-gray-500" : "text-gray-400"}`}>{code.length.toLocaleString()} characters</span>
              {code.length > 0 && (
                <button onClick={() => { setCode(""); setResult(null); setError(""); setTypingPhase("idle"); }}
                  className={`text-xs px-3 py-1 rounded-lg transition ${dark ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className={`${cardCls} p-4 mb-6 border-l-4 border-red-500`}>
              <div className="flex items-center gap-2 text-red-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className={`${cardCls} p-6 space-y-4`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg animate-pulse ${dark ? "bg-white/10" : "bg-gray-200"}`} />
                <div className={`h-4 w-48 rounded animate-pulse ${dark ? "bg-white/10" : "bg-gray-200"}`} />
              </div>
              {[1,2,3].map(i => (
                <div key={i} className={`rounded-xl p-4 ${dark ? "bg-white/[0.03]" : "bg-gray-50"}`}>
                  <div className={`h-4 w-40 rounded mb-3 animate-pulse ${dark ? "bg-white/10" : "bg-gray-200"}`} />
                  <div className={`h-3 w-full rounded mb-2 animate-pulse ${dark ? "bg-white/[0.06]" : "bg-gray-100"}`} />
                  <div className={`h-3 w-3/4 rounded animate-pulse ${dark ? "bg-white/[0.06]" : "bg-gray-100"}`} />
                </div>
              ))}
            </div>
          )}

          {/* ── Results with typing effect ── */}
          {result && !loading && (
            <div className="space-y-6">

              {/* Skip Button */}
              {isTyping && (
                <div className="flex justify-end">
                  <button onClick={handleSkip}
                    className={`text-xs px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
                      dark ? "bg-white/[0.06] text-gray-300 hover:bg-white/10 border border-white/[0.1]"
                           : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
                    }`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    Skip Animation
                  </button>
                </div>
              )}

              {/* Summary Card */}
              <div className={`${cardCls} p-6`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg shadow-lg shadow-indigo-500/30">
                    📋
                  </div>
                  <div>
                    <h2 className={`text-lg font-bold ${dark ? "text-white" : "text-gray-900"}`}>Summary</h2>
                    {result.language && result.language !== "auto-detect" && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${dark ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-100 text-indigo-600"}`}>
                        {result.language}
                      </span>
                    )}
                  </div>
                </div>
                <p className={`text-sm leading-relaxed ${dark ? "text-gray-300" : "text-gray-600"}`}>
                  {skipAll ? result.summary : (
                    <Typewriter text={result.summary} speed={30} onDone={onSummaryDone} />
                  )}
                </p>
              </div>

              {/* Code Blocks — revealed one by one */}
              {result.blocks && result.blocks.length > 0 && (typingPhase === "blocks" || typingPhase === "tips" || typingPhase === "done") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className={`text-lg font-bold ${dark ? "text-white" : "text-gray-900"}`}>
                      Code Breakdown ({result.blocks.length} blocks)
                    </h2>
                    {typingPhase === "done" && (
                      <button onClick={() => {
                        const allExpanded = Object.values(expandedBlocks).every(Boolean);
                        const next = {};
                        result.blocks.forEach((_, i) => { next[i] = !allExpanded; });
                        setExpandedBlocks(next);
                      }}
                        className={`text-xs px-3 py-1.5 rounded-lg transition ${dark ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
                        {Object.values(expandedBlocks).every(Boolean) ? "Collapse All" : "Expand All"}
                      </button>
                    )}
                  </div>

                  {result.blocks.map((block, i) => {
                    if (!skipAll && i > revealedBlocks) return null;
                    const typeColor = TYPE_COLORS[block.type] || TYPE_COLORS.other;
                    const typeIcon = TYPE_ICONS[block.type] || TYPE_ICONS.other;
                    const open = expandedBlocks[i];
                    const blockDone = skipAll || i < revealedBlocks || typingPhase !== "blocks";

                    return (
                      <div key={i} className={`${cardCls} overflow-hidden transition-all duration-500`}
                        style={{ animation: !skipAll && i === revealedBlocks ? "fadeSlideIn 0.4s ease-out" : undefined }}>
                        <button onClick={() => toggleBlock(i)}
                          className={`w-full flex items-center gap-3 p-4 text-left transition ${dark ? "hover:bg-white/[0.03]" : "hover:bg-gray-50"}`}>
                          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${typeColor} flex items-center justify-center text-white text-sm font-bold shadow-lg flex-shrink-0`}>
                            {typeIcon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-semibold text-sm ${dark ? "text-white" : "text-gray-900"}`}>{block.name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                                dark ? "bg-white/10 text-gray-400" : "bg-gray-100 text-gray-500"
                              }`}>{block.type}</span>
                              {block.line_range && (
                                <span className={`text-[10px] ${dark ? "text-gray-500" : "text-gray-400"}`}>{block.line_range}</span>
                              )}
                            </div>
                            <p className={`text-xs mt-0.5 truncate ${dark ? "text-gray-400" : "text-gray-500"}`}>{block.purpose}</p>
                          </div>
                          <svg className={`w-5 h-5 transition-transform duration-200 flex-shrink-0 ${open ? "rotate-180" : ""} ${dark ? "text-gray-400" : "text-gray-500"}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {open && (
                          <div className={`px-4 pb-4 pt-0 border-t ${dark ? "border-white/[0.06]" : "border-gray-100"}`}>
                            <div className="pl-12 pt-3">
                              <p className={`text-sm leading-relaxed mb-3 ${dark ? "text-gray-300" : "text-gray-600"}`}>
                                {blockDone ? block.explanation : (
                                  <Typewriter text={block.explanation} speed={25} onDone={onBlockDone} />
                                )}
                              </p>
                              {(blockDone) && block.concepts && block.concepts.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {block.concepts.map((c, j) => (
                                    <span key={j} className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                                      dark ? "bg-purple-500/15 text-purple-300 border border-purple-500/20"
                                           : "bg-purple-50 text-purple-600 border border-purple-200"
                                    }`}>
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tips */}
              {result.tips && result.tips.length > 0 && (typingPhase === "tips" || typingPhase === "done") && (
                <div className={`${cardCls} p-6`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">💡</span>
                    <h2 className={`text-lg font-bold ${dark ? "text-white" : "text-gray-900"}`}>Tips & Best Practices</h2>
                  </div>
                  <ul className="space-y-2">
                    {result.tips.map((tip, i) => {
                      if (!skipAll && i > revealedTips) return null;
                      const tipDone = skipAll || i < revealedTips || typingPhase === "done";
                      return (
                        <li key={i} className={`flex items-start gap-2 text-sm ${dark ? "text-gray-300" : "text-gray-600"}`}>
                          <span className="text-indigo-400 mt-0.5">▸</span>
                          <span>{tipDone ? tip : <Typewriter text={tip} speed={25} onDone={onTipDone} />}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
