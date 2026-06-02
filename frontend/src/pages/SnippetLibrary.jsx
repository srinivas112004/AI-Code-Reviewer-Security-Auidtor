import { useState, useEffect, useCallback, useContext } from "react";
import { ThemeContext } from "../components/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Toast from "../components/Toast";
import axios from "axios";

const API = "http://localhost:5000";

const LANG_COLORS = {
  Python: "#3776ab", JavaScript: "#f7df1e", Java: "#ed8b00", PHP: "#777bb3",
  "C#": "#68217a", Go: "#00add8", Ruby: "#cc342d", Rust: "#dea584", TypeScript: "#3178c6",
};

/* ─── Snippet Card ─── */
function SnippetCard({ pattern, dark, onCopy }) {
  const [expanded, setExpanded] = useState(false);
  const langColor = LANG_COLORS[pattern.language] || "#818cf8";

  return (
    <div className={`relative group rounded-xl border transition-all shadow-xl ${
      dark ? "backdrop-blur-2xl bg-gradient-to-b from-white/[0.10] to-white/[0.04] border-white/[0.15] hover:border-white/[0.25] shadow-black/30" : "backdrop-blur-2xl bg-gradient-to-b from-white/95 to-white/80 border-gray-200 hover:border-gray-300 shadow-gray-400/20"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className={`font-semibold text-sm ${dark ? "text-white" : "text-gray-900"}`}>{pattern.title}</h3>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: `${langColor}22`, color: langColor, border: `1px solid ${langColor}44` }}>
              {pattern.language}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
              {pattern.vulnerability}
            </span>
            {pattern.cwe && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-400">{pattern.cwe}</span>
            )}
          </div>
          <p className={`text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>{pattern.description}</p>
        </div>
        <span className={`text-lg ml-3 transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className={`px-5 pb-5 border-t ${dark ? "border-white/[0.06]" : "border-gray-100"}`}>
          <div className="pt-4 space-y-4">
            {/* Insecure Code */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-red-400 tracking-wide">❌ INSECURE</span>
                <button onClick={() => onCopy(pattern.insecure_code)}
                  className={`text-xs px-2 py-0.5 rounded transition ${dark ? "text-gray-500 hover:text-gray-300 hover:bg-white/[0.06]" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}>📋</button>
              </div>
              <pre className={`p-3 rounded-lg text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap border ${
                dark ? "bg-red-500/[0.04] border-red-500/10 text-gray-300" : "bg-red-50 border-red-200 text-gray-700"
              }`}>{pattern.insecure_code}</pre>
            </div>

            {/* Secure Code */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-emerald-400 tracking-wide">✅ SECURE</span>
                <button onClick={() => onCopy(pattern.secure_code)}
                  className={`text-xs px-2 py-0.5 rounded transition ${dark ? "text-gray-500 hover:text-gray-300 hover:bg-white/[0.06]" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}>📋</button>
              </div>
              <pre className={`p-3 rounded-lg text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap border ${
                dark ? "bg-emerald-500/[0.04] border-emerald-500/10 text-gray-200" : "bg-emerald-50 border-emerald-200 text-gray-700"
              }`}>{pattern.secure_code}</pre>
            </div>

            {/* Explanation */}
            <div className={`p-3 rounded-lg border ${dark ? "bg-indigo-500/[0.04] border-indigo-500/15" : "bg-indigo-50 border-indigo-200"}`}>
              <p className="text-xs font-bold text-indigo-400 mb-1">💡 Why This Works</p>
              <p className={`text-xs leading-relaxed ${dark ? "text-gray-300" : "text-gray-600"}`}>{pattern.explanation}</p>
            </div>

            {/* References */}
            {pattern.references?.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>🔗</span>
                {pattern.references.map((ref, i) => (
                  <span key={i} className={`px-2 py-0.5 rounded text-[10px] ${dark ? "bg-white/[0.04] text-gray-400" : "bg-gray-100 text-gray-400"}`}>{ref}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════ */
/*              SNIPPET LIBRARY PAGE               */
/* ═══════════════════════════════════════════════ */
export default function SnippetLibrary() {
  const { dark } = useContext(ThemeContext);
  const { token } = useAuth();

  const [patterns, setPatterns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ languages: [], vulnerabilities: [] });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [totalAll, setTotalAll] = useState(0);

  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });
  const showToast = useCallback((m, s = "info") => setToast({ open: true, message: m, severity: s }), []);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchSnippets = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCategory) params.set("category", selectedCategory);
      if (selectedLanguage) params.set("language", selectedLanguage);

      const res = await axios.get(`${API}/api/snippets?${params.toString()}`, { headers });
      setPatterns(res.data.patterns || []);
      setCategories(res.data.categories || []);
      setFilterOptions(res.data.filters || { languages: [], vulnerabilities: [] });
      setTotalAll(res.data.total_all || 0);
    } catch {
      showToast("Failed to load snippets", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSnippets(); }, [token, selectedCategory, selectedLanguage]);

  useEffect(() => {
    const t = setTimeout(fetchSnippets, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => showToast("Copied!", "success")).catch(() => showToast("Copy failed", "error"));
  };

  const bg = dark
    ? "bg-gradient-to-b from-[#0a0b14] via-[#0f1121] to-[#0a0b14] text-white"
    : "bg-gradient-to-b from-gray-50 via-white to-gray-50 text-gray-900";
  const card = dark
    ? "backdrop-blur-2xl bg-gradient-to-b from-white/[0.1] to-white/[0.04] border-white/[0.12] shadow-2xl shadow-black/40"
    : "backdrop-blur-2xl bg-gradient-to-b from-white/95 to-white/80 border-gray-200/80 shadow-2xl shadow-gray-400/30";

  return (
    <div className={`relative min-h-screen overflow-hidden transition-colors duration-300 ${bg}`}>
      {/* Background blobs */}
      <div className={`absolute -top-40 -left-40 w-[900px] h-[900px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-indigo-600/20" : "bg-indigo-400/10"}`} style={{animationDuration:'20s'}} />
      <div className={`absolute top-40 right-0 w-[800px] h-[800px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-purple-600/20" : "bg-purple-400/10"}`} style={{animationDuration:'25s', animationDelay:'3s'}} />
      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-indigo-700/20" : "bg-indigo-500/8"}`} style={{animationDuration:'30s', animationDelay:'5s'}} />

      <Navbar />
      <Toast toast={toast} onClose={() => setToast((p) => ({ ...p, open: false }))} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 page-enter">
          <span className="text-2xl">📚</span>
          <div>
            <h1 className={`text-2xl font-bold ${dark ? "text-white" : "text-gray-900"}`}>Secure Code Patterns</h1>
            <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-400"}`}>{totalAll} patterns available</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className={`rounded-2xl border backdrop-blur-xl p-5 mb-6 ${card}`}>
          {/* Search */}
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patterns by name, vulnerability, or language..."
            className={`w-full px-4 py-3 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
              dark ? "bg-white/[0.06] border border-white/[0.12] text-white placeholder-gray-400" : "bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400"
            }`} />

          {/* Category chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => setSelectedCategory("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                !selectedCategory ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : dark ? "bg-white/[0.04] text-gray-500 hover:text-gray-300" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}>All</button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setSelectedCategory(selectedCategory === cat.id ? "" : cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedCategory === cat.id ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : dark ? "bg-white/[0.04] text-gray-500 hover:text-gray-300" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}>{cat.icon} {cat.name}</button>
            ))}
          </div>

          {/* Language chips */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>🔧</span>
            <button onClick={() => setSelectedLanguage("")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                !selectedLanguage ? "bg-white/[0.12] text-white" : dark ? "bg-white/[0.04] text-gray-400" : "bg-gray-100 text-gray-500"
              }`}>All Languages</button>
            {filterOptions.languages.map((lang) => {
              const c = LANG_COLORS[lang] || "#818cf8";
              return (
                <button key={lang} onClick={() => setSelectedLanguage(selectedLanguage === lang ? "" : lang)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition`}
                  style={selectedLanguage === lang
                    ? { background: `${c}33`, color: c, border: `1px solid ${c}66` }
                    : { background: dark ? "rgba(255,255,255,0.04)" : "#f3f4f6", color: dark ? "#6b7280" : "#9ca3af", border: "1px solid transparent" }
                  }>{lang}</button>
              );
            })}
          </div>
        </div>

        {/* Patterns */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin mb-3"></div>
            <span className={`text-sm ${dark ? "text-gray-400" : "text-gray-400"}`}>Loading patterns...</span>
          </div>
        ) : patterns.length === 0 ? (
          <div className={`rounded-2xl border backdrop-blur-xl p-10 text-center ${card}`}>
            <p className="text-3xl mb-2">🔍</p>
            <p className={`${dark ? "text-gray-400" : "text-gray-500"}`}>No patterns found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div>
            <p className={`text-xs mb-3 ${dark ? "text-gray-400" : "text-gray-400"}`}>
              Showing {patterns.length} of {totalAll} patterns
            </p>
            <div className="space-y-3">
              {patterns.map((p) => (
                <SnippetCard key={p.id} pattern={p} dark={dark} onCopy={handleCopy} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
