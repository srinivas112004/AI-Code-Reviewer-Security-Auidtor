import { useState, useContext, useRef, useEffect, useCallback } from "react";
import { ThemeContext } from "../components/ThemeContext";
import Navbar from "../components/Navbar";
import axios from "axios";

const API = "http://localhost:5000";
const LANGUAGES = [
  "auto-detect","python","javascript","typescript","java","csharp","cpp","c","go",
  "rust","ruby","php","swift","kotlin","scala","sql","html","css","shell","yaml","json",
];

/* ── Typewriter for a single AI message ── */
function TypewriterMessage({ text, speed = 30, onDone, renderFn }) {
  const [displayed, setDisplayed] = useState("");
  const idx = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!text) { setDisplayed(""); onDone?.(); return; }
    idx.current = 0;
    setDisplayed("");

    // Type faster for longer messages
    const effectiveSpeed = text.length > 600 ? Math.max(15, speed - 8) : text.length > 300 ? Math.max(20, speed - 5) : speed;

    timerRef.current = setInterval(() => {
      // Type 1-3 chars at a time based on speed
      const step = effectiveSpeed <= 3 ? 3 : effectiveSpeed <= 5 ? 2 : 1;
      idx.current = Math.min(idx.current + step, text.length);
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) {
        clearInterval(timerRef.current);
        onDone?.();
      }
    }, effectiveSpeed);

    return () => clearInterval(timerRef.current);
  }, [text, speed]);

  const skip = useCallback(() => {
    clearInterval(timerRef.current);
    setDisplayed(text || "");
    onDone?.();
  }, [text, onDone]);

  return (
    <div className="relative">
      {renderFn(displayed)}
      {displayed.length < (text?.length || 0) && (
        <>
          <span className="inline-block w-[2px] h-[1em] bg-emerald-400 ml-0.5 animate-pulse align-middle" />
          <button onClick={skip}
            className="absolute -bottom-6 right-0 text-[10px] px-2 py-0.5 rounded opacity-60 hover:opacity-100 transition text-gray-400 hover:text-white">
            Skip ⏭
          </button>
        </>
      )}
    </div>
  );
}

export default function CodeChat() {
  const { dark } = useContext(ThemeContext);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("auto-detect");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [codeCollapsed, setCodeCollapsed] = useState(false);
  const [typingIdx, setTypingIdx] = useState(-1); // index of message currently being typed
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingIdx]);

  const handleAsk = async (q) => {
    const query = (q || question).trim();
    if (!query) return;
    if (!code.trim()) return setError("Please paste your code first.");
    setError("");

    const userMsg = { role: "user", content: query };
    setMessages(prev => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);

    if (!codeCollapsed) setCodeCollapsed(true);

    try {
      const token = localStorage.getItem("token");
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await axios.post(`${API}/api/chat`,
        { code, language, question: query, history },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const aiMsg = {
        role: "assistant",
        content: res.data.answer || "I couldn't generate a response.",
        references: res.data.references || [],
        followUps: res.data.follow_up_questions || [],
        typed: false, // will be set true after typing finishes
      };
      setMessages(prev => {
        const next = [...prev, aiMsg];
        setTypingIdx(next.length - 1);
        return next;
      });
    } catch (e) {
      const errMsg = e.response?.data?.error || "Failed to get answer.";
      setMessages(prev => [...prev, { role: "assistant", content: `❌ ${errMsg}`, references: [], followUps: [], typed: true }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const onTypingDone = useCallback(() => {
    setTypingIdx(-1);
    setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, typed: true } : m));
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); }
  };

  const clearChat = () => {
    setMessages([]);
    setCodeCollapsed(false);
    setError("");
    setTypingIdx(-1);
  };

  const bg = dark
    ? "min-h-screen bg-gradient-to-b from-[#0a0b14] via-[#0f1121] to-[#0a0b14] text-white"
    : "min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 text-gray-900";

  const cardCls = dark
    ? "bg-white/[0.04] border border-white/[0.08] backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/40"
    : "bg-white/80 border border-gray-200 backdrop-blur-2xl rounded-2xl shadow-xl shadow-gray-300/40";

  const inputCls = `w-full rounded-xl px-4 py-3 text-sm transition-all duration-200 outline-none
    ${dark ? "bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-gray-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
           : "bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"}`;

  /* ── Copy-to-clipboard code block (ChatGPT style) ── */
  function CodeBlockWithCopy({ code: codeStr, lang }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
      navigator.clipboard.writeText(codeStr.trim()).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };
    const displayLang = lang || "code";
    return (
      <div className={`my-3 rounded-xl overflow-hidden border ${dark ? "border-white/[0.1] bg-[#0d1117]" : "border-gray-200 bg-[#f6f8fa]"}`}>
        {/* Header bar */}
        <div className={`flex items-center justify-between px-4 py-2 text-xs ${
          dark ? "bg-white/[0.06] text-gray-400 border-b border-white/[0.06]"
               : "bg-gray-100 text-gray-500 border-b border-gray-200"
        }`}>
          <span className="font-medium">{displayLang}</span>
          <button onClick={copy}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${
              copied
                ? "text-emerald-400"
                : dark ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-200"
            }`}>
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Copy code
              </>
            )}
          </button>
        </div>
        {/* Code body */}
        <pre className={`px-4 py-3 overflow-x-auto text-[13px] font-mono leading-relaxed ${dark ? "text-gray-300" : "text-gray-800"}`}>
          <code>{codeStr}</code>
        </pre>
      </div>
    );
  }

  /* Helper: render plain text lines with markdown formatting */
  const renderTextLines = (txt, elements, keyPrefix) => {
    const lines = txt.split("\n");
    lines.forEach((line, li) => {
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      processed = processed.replace(/`([^`]+)`/g, `<code class="${dark ? "bg-white/10 text-indigo-300" : "bg-gray-100 text-indigo-600"} px-1.5 py-0.5 rounded text-xs font-mono">$1</code>`);
      if (/^[-•*]\s/.test(processed)) {
        processed = `<span class="text-indigo-400 mr-1">▸</span>${processed.replace(/^[-•*]\s/, "")}`;
      }
      if (processed.trim()) {
        elements.push(<p key={`${keyPrefix}-${li}`} className={`${li > 0 ? "mt-1" : ""} text-sm leading-relaxed`} dangerouslySetInnerHTML={{ __html: processed }} />);
      }
    });
  };

  /* Render markdown text — handles BOTH complete and unclosed (still-typing) code fences */
  const renderMarkdown = useCallback((text) => {
    if (!text) return null;
    const elements = [];
    let rest = text;
    let seg = 0;

    while (rest) {
      // Find next opening code fence: ```lang\n
      const openMatch = rest.match(/```([\w+-]*)\s*\n/);
      if (!openMatch) {
        // No more fences — render remaining as text
        if (rest.trim()) renderTextLines(rest, elements, `t${seg}`);
        break;
      }

      // Render text before the fence
      const before = rest.slice(0, openMatch.index);
      if (before.trim()) renderTextLines(before, elements, `t${seg}`);
      seg++;

      const lang = openMatch[1];
      const afterOpen = rest.slice(openMatch.index + openMatch[0].length);

      // Look for closing ``` (on its own or after a newline)
      const closeIdx = afterOpen.indexOf("```");
      if (closeIdx !== -1) {
        // Complete code block
        elements.push(<CodeBlockWithCopy key={`c${seg}`} lang={lang} code={afterOpen.slice(0, closeIdx)} />);
        rest = afterOpen.slice(closeIdx + 3);
      } else {
        // Unclosed fence — still being typed — render what we have so far as a code block
        elements.push(<CodeBlockWithCopy key={`c${seg}`} lang={lang} code={afterOpen} />);
        rest = "";
      }
      seg++;
    }

    return elements;
  }, [dark]);

  return (
    <div className={bg}>
      <Navbar />
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute top-20 left-1/4 w-96 h-96 rounded-full blur-[120px] animate-blob ${dark ? "bg-emerald-600/10" : "bg-emerald-300/20"}`} style={{animationDuration:'20s'}} />
          <div className={`absolute bottom-20 right-1/4 w-96 h-96 rounded-full blur-[120px] animate-blob ${dark ? "bg-indigo-600/10" : "bg-indigo-300/20"}`} style={{animationDuration:'25s', animationDelay:'3s'}} />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-10">
          {/* Header */}
          <div className="text-center mb-8 page-enter">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 border border-emerald-500/20 rounded-full px-5 py-2 mb-4">
              <span className="text-lg">💬</span>
              <span className={`text-sm font-medium ${dark ? "text-emerald-300" : "text-emerald-600"}`}>Chat with Your Code</span>
            </div>
            <h1 className={`text-3xl md:text-4xl font-bold mb-2 ${dark ? "text-white" : "text-gray-900"}`}>
              Ask Anything About Your <span className="bg-gradient-to-r from-emerald-400 to-indigo-500 bg-clip-text text-transparent">Code</span>
            </h1>
            <p className={`text-base ${dark ? "text-gray-400" : "text-gray-500"}`}>
              Paste your code, then ask questions — find bugs, understand logic, get performance tips, and more.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: Code Panel */}
            <div className="lg:col-span-2">
              <div className={`${cardCls} p-4 sticky top-24`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📄</span>
                    <h3 className={`text-sm font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Your Code</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {messages.length > 0 && (
                      <button onClick={() => setCodeCollapsed(!codeCollapsed)}
                        className={`text-xs px-2 py-1 rounded-lg transition ${dark ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
                        {codeCollapsed ? "Expand" : "Collapse"}
                      </button>
                    )}
                    <select value={language} onChange={(e) => setLanguage(e.target.value)}
                      className={`text-xs rounded-lg px-2 py-1 ${dark ? "bg-white/[0.06] border border-white/[0.12] text-gray-300" : "bg-gray-50 border border-gray-200 text-gray-600"}`}>
                      {LANGUAGES.map(l => <option key={l} value={l} className={dark ? "bg-slate-900" : ""}>{l === "auto-detect" ? "Auto" : l}</option>)}
                    </select>
                  </div>
                </div>

                {!codeCollapsed ? (
                  <>
                    <textarea value={code} onChange={(e) => setCode(e.target.value)}
                      placeholder="Paste your code here…"
                      rows={16}
                      className={`${inputCls} font-mono text-[13px] leading-relaxed resize-y`}
                      spellCheck={false} />
                    <div className="flex justify-between items-center mt-2">
                      <span className={`text-xs ${dark ? "text-gray-500" : "text-gray-400"}`}>{code.length.toLocaleString()} chars</span>
                      {code.length > 0 && (
                        <button onClick={() => { setCode(""); clearChat(); }}
                          className={`text-xs px-3 py-1 rounded-lg transition ${dark ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
                          Clear
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className={`p-3 rounded-xl text-xs font-mono max-h-28 overflow-hidden relative ${
                    dark ? "bg-black/30 text-gray-400" : "bg-gray-50 text-gray-500"
                  }`}>
                    <pre className="whitespace-pre-wrap">{code.slice(0, 400)}{code.length > 400 ? "…" : ""}</pre>
                    <div className={`absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t ${dark ? "from-black/60" : "from-gray-50"}`} />
                  </div>
                )}
              </div>
            </div>

            {/* Right: Chat Panel */}
            <div className="lg:col-span-3 flex flex-col">
              <div className={`${cardCls} flex-1 flex flex-col overflow-hidden`} style={{ minHeight: "500px", maxHeight: "75vh" }}>
                {/* Chat Header */}
                <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? "border-white/[0.06]" : "border-gray-100"}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className={`text-sm font-medium ${dark ? "text-white" : "text-gray-900"}`}>AI Assistant</span>
                  </div>
                  {messages.length > 0 && (
                    <button onClick={clearChat}
                      className={`text-xs px-3 py-1 rounded-lg transition ${dark ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
                      Clear Chat
                    </button>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {messages.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                        dark ? "bg-white/[0.04] border border-white/[0.08]" : "bg-gray-50 border border-gray-200"
                      }`}>
                        <span className="text-3xl">💬</span>
                      </div>
                      <p className={`text-sm font-medium mb-2 ${dark ? "text-gray-300" : "text-gray-600"}`}>
                        Start a conversation about your code
                      </p>
                      <p className={`text-xs mb-6 ${dark ? "text-gray-500" : "text-gray-400"}`}>
                        Try asking one of these:
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center max-w-md">
                        {[
                          "What does this code do?",
                          "Where could there be a bug?",
                          "How can I make this faster?",
                          "Explain the main function",
                          "Are there any security issues?",
                          "How can I improve readability?",
                        ].map((q, i) => (
                          <button key={i} onClick={() => handleAsk(q)}
                            disabled={!code.trim()}
                            className={`text-xs px-3 py-1.5 rounded-full transition border ${
                              !code.trim() ? "opacity-40 cursor-not-allowed" : ""
                            } ${dark
                              ? "bg-white/[0.04] border-white/[0.1] text-gray-300 hover:bg-white/10 hover:border-indigo-500/30"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-300"
                            }`}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg, i) => {
                    const isUser = msg.role === "user";
                    const isCurrentlyTyping = !isUser && i === typingIdx && !msg.typed;

                    return (
                      <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                        style={{ animation: "fadeSlideIn 0.3s ease-out" }}>
                        <div className={`max-w-[85%] ${isUser ? "order-2" : ""}`}>
                          <div className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
                            {/* Avatar */}
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                              isUser
                                ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                                : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                            }`}>
                              {isUser ? "U" : "AI"}
                            </div>

                            {/* Bubble */}
                            <div className={`rounded-2xl px-4 py-3 ${
                              isUser
                                ? dark ? "bg-indigo-500/20 border border-indigo-500/30" : "bg-indigo-50 border border-indigo-200"
                                : dark ? "bg-white/[0.04] border border-white/[0.08]" : "bg-gray-50 border border-gray-200"
                            }`}>
                              <div className={`${dark ? "text-gray-200" : "text-gray-700"}`}>
                                {isUser ? (
                                  <p className="text-sm">{msg.content}</p>
                                ) : isCurrentlyTyping ? (
                                  <TypewriterMessage
                                    text={msg.content}
                                    speed={8}
                                    onDone={onTypingDone}
                                    renderFn={renderMarkdown}
                                  />
                                ) : (
                                  renderMarkdown(msg.content)
                                )}
                              </div>

                              {/* References — show only after typing */}
                              {!isUser && (msg.typed || !isCurrentlyTyping) && msg.references && msg.references.length > 0 && (
                                <div className={`mt-3 pt-2 border-t ${dark ? "border-white/[0.06]" : "border-gray-200"}`}>
                                  <p className={`text-[10px] uppercase tracking-wider font-medium mb-1.5 ${dark ? "text-gray-500" : "text-gray-400"}`}>References</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {msg.references.map((ref, j) => (
                                      <span key={j} className={`text-[11px] px-2 py-0.5 rounded-full ${
                                        dark ? "bg-white/[0.06] text-gray-400" : "bg-gray-100 text-gray-500"
                                      }`} title={ref.detail}>
                                        📍 {ref.line_hint}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Follow-ups — show only after typing */}
                              {!isUser && (msg.typed || !isCurrentlyTyping) && msg.followUps && msg.followUps.length > 0 && (
                                <div className={`mt-3 pt-2 border-t ${dark ? "border-white/[0.06]" : "border-gray-200"}`}>
                                  <p className={`text-[10px] uppercase tracking-wider font-medium mb-1.5 ${dark ? "text-gray-500" : "text-gray-400"}`}>Follow-up</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {msg.followUps.map((fq, k) => (
                                      <button key={k} onClick={() => handleAsk(fq)}
                                        className={`text-[11px] px-2.5 py-1 rounded-full transition border ${
                                          dark
                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20"
                                            : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                                        }`}>
                                        {fq}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Loading indicator (before AI responds) */}
                  {loading && (
                    <div className="flex justify-start" style={{ animation: "fadeSlideIn 0.3s ease-out" }}>
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AI</div>
                        <div className={`rounded-2xl px-4 py-3 ${dark ? "bg-white/[0.04] border border-white/[0.08]" : "bg-gray-50 border border-gray-200"}`}>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className={`px-5 py-3 border-t ${dark ? "border-white/[0.06]" : "border-gray-100"}`}>
                  {error && (
                    <div className="text-xs text-red-400 mb-2 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" /></svg>
                      {error}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input ref={inputRef}
                      type="text" value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={code.trim() ? "Ask a question about your code…" : "Paste code first, then ask questions…"}
                      disabled={loading || !code.trim()}
                      className={`flex-1 ${inputCls} ${!code.trim() ? "opacity-50 cursor-not-allowed" : ""}`} />
                    <button onClick={() => handleAsk()}
                      disabled={loading || !question.trim() || !code.trim()}
                      className={`px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300 shadow-lg flex-shrink-0 ${
                        loading || !question.trim() || !code.trim()
                          ? "bg-gray-500 cursor-not-allowed opacity-50"
                          : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-95"
                      }`}>
                      {loading ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
