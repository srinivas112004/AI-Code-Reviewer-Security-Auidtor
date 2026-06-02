import { Link, useNavigate } from "react-router-dom";
import { useState, useRef, useCallback, useMemo, useContext, useEffect } from "react";
import { ThemeContext } from "../components/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import Toast from "../components/Toast";
import CodeDiff from "../components/CodeDiff";
import ModelComparison from "../components/ModelComparison";
import { exportToCSV } from "../utils/csvExporter";
import { generateProfessionalPDF } from "../utils/pdfGenerator";
import axios from "axios";
import { Chart as ChartJS, ArcElement, Tooltip as CTooltip, Legend, CategoryScale, LinearScale, BarElement, RadialLinearScale, PointElement, LineElement, Filler } from "chart.js";
import { Doughnut, Bar, Radar, PolarArea } from "react-chartjs-2";

ChartJS.register(ArcElement, CTooltip, Legend, CategoryScale, LinearScale, BarElement, RadialLinearScale, PointElement, LineElement, Filler);

const API = "http://localhost:5000";
const SEVERITY_COLORS = { Critical: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#06b6d4" };
const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const LANGUAGES = ["python","javascript","typescript","java","csharp","cpp","c","go","rust","ruby","php","swift","kotlin","scala","sql","html","css","shell","yaml","json","xml","dockerfile","terraform"];

/* ─── Score Gauge ─── */
function ScoreGauge({ score, dark }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f97316" : score >= 40 ? "#ef4444" : "#a855f7";
  const pct = Math.min(score, 100);
  return (
    <div className="flex flex-col items-center animate-fade-in-up">
      <div className="relative w-32 h-32">
        <div className="absolute inset-0 rounded-full" style={{boxShadow:`0 0 40px ${color}30, 0 0 80px ${color}15`}} />
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} strokeWidth="3" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${pct} ${100 - pct}`} className="transition-all duration-[1.5s] ease-out" style={{filter:`drop-shadow(0 0 6px ${color}60)`}} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold ${dark ? "text-white" : "text-gray-900"}`}>{score}</span>
        </div>
      </div>
      <span className={`mt-2 text-sm font-medium ${dark ? "text-gray-400" : "text-gray-500"}`}>Security Score</span>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ label, value, sub, color, dark }) {
  return (
    <div className={`relative rounded-xl p-5 border backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-indigo-500/10 shadow-2xl group ${
      dark ? "bg-gradient-to-b from-white/[0.1] to-white/[0.04] border-white/[0.12] shadow-black/40 hover:border-white/[0.2]"
           : "bg-gradient-to-b from-white/95 to-white/80 border-gray-200/80 shadow-gray-400/20 hover:shadow-gray-400/30"
    }`}>
      <div className={`absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
      <p className={`text-xs font-medium uppercase tracking-wider ${dark ? "text-gray-400" : "text-gray-500"}`}>{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || (dark ? "text-white" : "text-gray-900")}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${dark ? "text-gray-400" : "text-gray-500"}`}>{sub}</p>}
    </div>
  );
}

/* ─── Issue Card ─── */
function IssueCard({ issue, index, token, dark, onShowToast, code: parentCode }) {
  const [feedbackGiven, setFeedbackGiven] = useState(issue.user_feedback || null);
  const [showFix, setShowFix] = useState(false);
  const [fixResult, setFixResult] = useState(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [multiFixes, setMultiFixes] = useState(null);
  const [multiLoading, setMultiLoading] = useState(false);
  const [activeFixTab, setActiveFixTab] = useState("single");
  const sevColor = SEVERITY_COLORS[issue.severity] || "#6b7280";

  const handleFeedback = async (type) => {
    if (!token) return;
    try {
      await axios.post(`${API}/api/feedback`, {
        issue_index: index, issue_description: issue.description,
        issue_severity: issue.severity, issue_file: issue.file,
        feedback_type: type, reason: type === "false_positive" ? "User marked as false positive" : "User confirmed issue",
      }, { headers: { Authorization: `Bearer ${token}` } });
      setFeedbackGiven(type);
      onShowToast(type === "false_positive" ? "Marked as false positive" : "Issue confirmed", "success");
    } catch { onShowToast("Failed to submit feedback", "error"); }
  };

  const handleGenerateFix = async () => {
    if (fixLoading) return;
    setFixLoading(true);
    try {
      const res = await axios.post(`${API}/api/fix/generate`, {
        code: issue.code_snippet || parentCode || "",
        issue: { description: issue.description, severity: issue.severity, suggestion: issue.suggestion },
        file_path: issue.file || "file",
      }, { headers: { Authorization: `Bearer ${token}` } });
      setFixResult(res.data);
      setActiveFixTab("single");
      onShowToast("Fix generated!", "success");
    } catch (err) { onShowToast(err.response?.data?.error || "Fix generation failed", "error"); }
    finally { setFixLoading(false); }
  };

  const handleMultipleFixes = async () => {
    if (multiLoading) return;
    setMultiLoading(true);
    try {
      const res = await axios.post(`${API}/api/fix/multiple`, {
        code: issue.code_snippet || parentCode || "",
        issue: { description: issue.description, severity: issue.severity, suggestion: issue.suggestion },
        file_path: issue.file || "file",
      }, { headers: { Authorization: `Bearer ${token}` } });
      setMultiFixes(res.data);
      setActiveFixTab("alternatives");
      onShowToast(`${res.data.fixes?.length || 0} alternative fixes generated!`, "success");
    } catch (err) { onShowToast(err.response?.data?.error || "Multiple fixes generation failed", "error"); }
    finally { setMultiLoading(false); }
  };

  const handleDownloadPatch = async (fixedCode, filename) => {
    try {
      const res = await axios.post(`${API}/api/fix/download`, {
        fixed_code: fixedCode,
        file_path: filename || issue.file || "patched_file",
      }, { headers: { Authorization: `Bearer ${token}` }, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename || issue.file || "patched_file");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onShowToast("Patched file downloaded!", "success");
    } catch { onShowToast("Download failed", "error"); }
  };

  const renderFixContent = (fix, showDownload = true) => (
    <div className={`mt-3 rounded-xl p-4 border ${dark ? "bg-white/[0.02] border-white/[0.08]" : "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-bold text-emerald-400">✓ Fix Generated</span>
        {fix.confidence != null && <span className={`px-2 py-0.5 text-xs rounded-md ${fix.confidence >= 0.8 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>{Math.round(fix.confidence * 100)}%</span>}
        {fix.generation_time != null && <span className={`px-2 py-0.5 text-xs rounded-md ${dark ? "bg-white/[0.06] text-gray-400" : "bg-gray-100 text-gray-500"}`}>⏱ {fix.generation_time.toFixed(1)}s</span>}
      </div>
      {fix.fixed_code && (
        <>
          <CodeDiff
            originalCode={fix.original_code || ""}
            fixedCode={fix.fixed_code}
            inlineDiff={fix.inline_diff || []}
            dark={dark}
            onCopy={(code) => { navigator.clipboard.writeText(code); onShowToast("Copied!", "success"); }}
          />
          {showDownload && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => { navigator.clipboard.writeText(fix.fixed_code); onShowToast("Copied!", "success"); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${dark ? "bg-white/[0.06] text-gray-300 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                📋 Copy Fixed Code
              </button>
              <button onClick={() => handleDownloadPatch(fix.fixed_code, issue.file)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${dark ? "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`}>
                ⬇️ Download Patched File
              </button>
            </div>
          )}
        </>
      )}
      {fix.explanation && (
        <div className={`mt-3 rounded-lg p-3 ${dark ? "bg-blue-500/[0.06] border border-blue-500/20" : "bg-blue-50 border border-blue-200"}`}>
          <p className="text-xs font-semibold text-blue-400 mb-1">Why this fix works</p>
          <p className={`text-xs ${dark ? "text-gray-300" : "text-gray-600"}`}>{fix.explanation}</p>
        </div>
      )}
      {fix.security_notes && (
        <div className={`mt-2 rounded-lg p-3 ${dark ? "bg-amber-500/[0.06] border border-amber-500/20" : "bg-amber-50 border border-amber-200"}`}>
          <p className="text-xs font-semibold text-amber-400 mb-1">🔒 Security Notes</p>
          <p className={`text-xs ${dark ? "text-gray-300" : "text-gray-600"}`}>{fix.security_notes}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`rounded-xl border-l-4 p-5 transition-all ${
      dark ? "bg-gradient-to-b from-white/[0.10] to-white/[0.04] border-r border-t border-b border-r-white/[0.15] border-t-white/[0.15] border-b-white/[0.15] shadow-lg shadow-black/20 backdrop-blur-2xl"
           : "bg-gradient-to-b from-white/95 to-white/80 border-r border-t border-b border-r-gray-200 border-t-gray-200 border-b-gray-200 shadow-md shadow-gray-400/20 backdrop-blur-2xl"
    } ${feedbackGiven === "false_positive" ? "opacity-50" : ""}`}
      style={{ borderLeftColor: sevColor }}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white" style={{ background: sevColor }}>{issue.severity}</span>
          {issue.risk_score != null && <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${dark ? "bg-white/[0.06] text-gray-300" : "bg-gray-100 text-gray-600"}`}>Risk {issue.risk_score}</span>}
          {issue.confidence != null && <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${issue.confidence >= 0.7 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>{Math.round(issue.confidence * 100)}%</span>}
        </div>
        <div className="flex items-center gap-1">
          {token && !feedbackGiven && (
            <>
              <button onClick={() => handleFeedback("false_positive")} title="False positive" className={`p-1.5 rounded-lg text-xs transition ${dark ? "hover:bg-red-500/10 text-gray-500 hover:text-red-400" : "hover:bg-red-50 text-gray-400 hover:text-red-500"}`}>🚫</button>
              <button onClick={() => handleFeedback("confirmed")} title="Confirm" className={`p-1.5 rounded-lg text-xs transition ${dark ? "hover:bg-green-500/10 text-gray-500 hover:text-green-400" : "hover:bg-green-50 text-gray-400 hover:text-green-500"}`}>✅</button>
            </>
          )}
          {feedbackGiven && <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${feedbackGiven === "false_positive" ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>{feedbackGiven === "false_positive" ? "False Positive" : "Confirmed"}</span>}
          <button onClick={() => { navigator.clipboard.writeText(`${issue.description}\nSuggestion: ${issue.suggestion}\nFile: ${issue.file}`); onShowToast("Copied!", "success"); }} title="Copy" className={`p-1.5 rounded-lg text-xs transition ${dark ? "hover:bg-white/10 text-gray-500" : "hover:bg-gray-100 text-gray-400"}`}>📋</button>
        </div>
      </div>
      <h4 className={`font-semibold mb-1 ${dark ? "text-white" : "text-gray-900"}`}>{issue.description}</h4>
      <p className={`text-xs mb-2 ${dark ? "text-gray-400" : "text-gray-500"}`}>📁 {issue.file}</p>
      <p className={`text-sm ${dark ? "text-gray-300" : "text-gray-600"}`}>💡 {issue.suggestion}</p>
      {token && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { setShowFix(!showFix); if (!fixResult && !showFix) handleGenerateFix(); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${dark ? "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`}>
              {fixLoading ? <span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" /> : "🔧"}
              {showFix ? "Hide Fix" : "Generate AI Fix"}
            </button>
            <button onClick={() => { setShowFix(true); handleMultipleFixes(); }}
              disabled={multiLoading}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${dark ? "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20" : "bg-purple-50 text-purple-600 hover:bg-purple-100"} disabled:opacity-40`}>
              {multiLoading ? <span className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /> : "🔀"}
              {multiLoading ? "Generating..." : "Multiple Fixes"}
            </button>
          </div>
          {showFix && (fixResult || multiFixes) && (
            <div className="mt-3">
              {/* Tab selector */}
              {(fixResult && multiFixes) && (
                <div className={`flex gap-1 p-1 rounded-lg mb-3 ${dark ? "bg-white/[0.04]" : "bg-gray-100"}`}>
                  <button onClick={() => setActiveFixTab("single")}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${activeFixTab === "single" ? "bg-indigo-500 text-white shadow" : dark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
                    Recommended Fix
                  </button>
                  <button onClick={() => setActiveFixTab("alternatives")}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${activeFixTab === "alternatives" ? "bg-purple-500 text-white shadow" : dark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
                    Alternatives ({multiFixes.fixes?.length || 0})
                  </button>
                </div>
              )}
              {/* Single fix result */}
              {(activeFixTab === "single" && fixResult) && renderFixContent(fixResult)}
              {/* Multiple fix alternatives */}
              {(activeFixTab === "alternatives" && multiFixes?.fixes) && (
                <div className="space-y-3">
                  {multiFixes.fixes.map((alt, altIdx) => (
                    <div key={altIdx}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${dark ? "bg-white/[0.06] text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                          #{altIdx + 1} {alt.approach || `Alternative ${altIdx + 1}`}
                        </span>
                        {alt.confidence != null && (
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${alt.confidence >= 0.8 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                            {Math.round(alt.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      {(alt.pros || alt.cons) && (
                        <div className="flex gap-4 mb-2">
                          {alt.pros && (
                            <div className="flex-1">
                              <p className="text-[10px] font-bold text-emerald-400 mb-1">✓ Pros</p>
                              {(Array.isArray(alt.pros) ? alt.pros : [alt.pros]).map((p, pi) => (
                                <p key={pi} className={`text-[10px] ${dark ? "text-gray-400" : "text-gray-500"}`}>• {p}</p>
                              ))}
                            </div>
                          )}
                          {alt.cons && (
                            <div className="flex-1">
                              <p className="text-[10px] font-bold text-red-400 mb-1">✗ Cons</p>
                              {(Array.isArray(alt.cons) ? alt.cons : [alt.cons]).map((c, ci) => (
                                <p key={ci} className={`text-[10px] ${dark ? "text-gray-400" : "text-gray-500"}`}>• {c}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {renderFixContent(alt)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Scan Progress ─── */
function ScanProgress({ files, fileStatuses, progress, issuesFound, eta, cacheHits, onCancel, dark }) {
  const completedCount = Object.values(fileStatuses).filter(s => s === "completed" || s === "cached").length;
  return (
    <div className={`rounded-2xl p-5 border mt-6 backdrop-blur-2xl shadow-2xl ${dark ? "bg-gradient-to-b from-white/[0.12] to-white/[0.05] border-white/[0.2] shadow-black/40" : "bg-gradient-to-b from-white/90 to-white/70 border-gray-200 shadow-gray-400/30"}`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className={`font-semibold ${dark ? "text-white" : "text-gray-900"}`}>🔄 Scanning in Progress...</h3>
          <span className={`text-xs font-medium px-2 py-1 rounded-lg ${dark ? "bg-white/[0.06] text-gray-300" : "bg-gray-100 text-gray-600"}`}>
            {completedCount} / {files.length} files • {Math.round(progress)}%
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {issuesFound > 0 && <span className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400">🐛 {issuesFound} issues</span>}
          {eta != null && <span className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400">⏱ {eta}s left</span>}
          {cacheHits > 0 && <span className="text-xs px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400">⚡ {cacheHits} cached</span>}
          <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition font-medium">Cancel</button>
        </div>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {files.map((f, i) => {
          const status = fileStatuses[f] || "pending";
          const icon = status === "completed" ? "✅" : status === "cached" ? "⚡" : status === "scanning" ? "🔄" : "⏳";
          return (
            <div key={i} className={`flex items-center gap-2 text-xs py-1 ${status === "scanning" ? (dark ? "text-indigo-400" : "text-indigo-600") : dark ? "text-gray-400" : "text-gray-500"}`}>
              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-center select-none">{icon}</span>
              <span className="truncate">{f}</span>
              {status === "scanning" && (
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 ml-auto">
                  <span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" style={{ backfaceVisibility: 'hidden', transform: 'translateZ(0)' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════ */
/*                     LANDING PAGE                          */
/* ══════════════════════════════════════════════════════════ */
export default function Landing() {
  const { dark, setDark } = useContext(ThemeContext);
  const { token, isAuthenticated, user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  // Active tab
  const [activeTab, setActiveTab] = useState("zip");

  // ZIP state
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // GitHub state
  const [githubUrl, setGithubUrl] = useState("");

  // Code paste state
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");

  // Scan state
  const [scanMode, setScanMode] = useState("deep");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);

  // SSE progress
  const [scannedFiles, setScannedFiles] = useState([]);
  const [fileStatuses, setFileStatuses] = useState({});
  const [issuesFoundSoFar, setIssuesFoundSoFar] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(null);
  const [cacheHits, setCacheHits] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const eventSourceRef = useRef(null);

  // Results
  const [scanResult, setScanResult] = useState(null);
  const [showResults, setShowResults] = useState(false);

  // Results UI
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("severity");
  const [sortOrder, setSortOrder] = useState("desc");
  const [chartType, setChartType] = useState("doughnut");

  // Toast
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });
  const showToast = useCallback((message, severity = "info") => setToast({ open: true, message, severity }), []);

  const resultsRef = useRef(null);
  const chartRef = useRef(null);

  // Navbar menu
  const [menuOpen, setMenuOpen] = useState(false);

  // Rate limit
  const [rateLimitInfo, setRateLimitInfo] = useState(null);

  // Model comparison
  const [availableModels, setAvailableModels] = useState([]);

  /* ─── Fetch rate limit on mount & after scans ─── */
  const fetchRateLimitStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/api/rate-limit/status`, { headers: { Authorization: `Bearer ${token}` } });
      setRateLimitInfo(res.data);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { fetchRateLimitStatus(); }, [fetchRateLimitStatus]);

  /* ─── Fetch available models ─── */
  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/api/models`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setAvailableModels(res.data?.models || res.data || []))
      .catch(() => {});
  }, [token]);

  /* ─── Auth guard for scan ─── */
  const requireAuth = () => {
    if (!isAuthenticated()) {
      showToast("Please login to scan code", "warning");
      setTimeout(() => navigate("/login"), 800);
      return false;
    }
    return true;
  };

  /* ─── ZIP scan ─── */
  const handleZipScan = async () => {
    if (!requireAuth()) return;
    if (!file) { showToast("Please select a ZIP file", "warning"); return; }
    await startStreamScan("zip");
  };

  /* ─── GitHub scan ─── */
  const handleGithubScan = async () => {
    if (!requireAuth()) return;
    if (!githubUrl.trim()) { showToast("Please enter a GitHub URL", "warning"); return; }
    await startStreamScan("github");
  };

  /* ─── Code paste scan ─── */
  const handleCodeScan = async () => {
    if (!requireAuth()) return;
    if (!code.trim()) { showToast("Please paste some code", "warning"); return; }
    setIsLoading(true);
    setError("");
    setScanResult(null);
    setShowResults(false);
    setLoadingProgress(30);
    try {
      const res = await axios.post(`${API}/api/scan/direct`, { code, language, scan_mode: scanMode }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLoadingProgress(100);
      setTimeout(() => {
        setScanResult(res.data);
        setShowResults(true);
        setIsLoading(false);
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 500);
      fetchRateLimitStatus();
    } catch (err) {
      const errCode = err.response?.data?.error_code;
      if (errCode === "SCAN_LIMIT_EXCEEDED" || errCode === "RATE_LIMIT_EXCEEDED") {
        setError(`Scan limit reached. ${err.response?.data?.error || "Please try again later."}`);
        fetchRateLimitStatus();
      } else {
        setError(err.response?.data?.error || "Direct scan failed");
      }
      setIsLoading(false);
    }
  };

  /* ─── Stream scan (ZIP / GitHub) ─── */
  const startStreamScan = async (type) => {
    setIsLoading(true);
    setError("");
    setScanResult(null);
    setShowResults(false);
    setLoadingProgress(5);
    setScannedFiles([]);
    setFileStatuses({});
    setIssuesFoundSoFar(0);
    setEtaSeconds(null);
    setCacheHits(0);

    try {
      let initRes;
      if (type === "zip") {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("scan_mode", scanMode);
        initRes = await axios.post(`${API}/api/scan/stream`, fd, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        });
      } else {
        initRes = await axios.post(`${API}/api/scan/stream`, { github_url: githubUrl, scan_mode: scanMode }, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      const { session_id, files_to_scan } = initRes.data;
      setCurrentSessionId(session_id);
      setScannedFiles(files_to_scan || []);
      const statusMap = {};
      (files_to_scan || []).forEach(f => { statusMap[f] = "pending"; });
      setFileStatuses(statusMap);
      setLoadingProgress(10);

      await new Promise((resolve, reject) => {
        const es = new EventSource(`${API}/api/scan/process/${session_id}?token=${token}`);
        eventSourceRef.current = es;
        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === "scanning") {
              setFileStatuses(prev => {
                const next = { ...prev, [data.file]: "scanning" };
                const done = Object.values(next).filter(s => s === "completed" || s === "cached").length;
                const total = Object.keys(next).length || 1;
                setLoadingProgress(5 + (done / total) * 90);
                return next;
              });
              if (data.issues_found != null) setIssuesFoundSoFar(data.issues_found);
              if (data.eta_seconds != null) setEtaSeconds(data.eta_seconds);
              if (data.cache_hits != null) setCacheHits(data.cache_hits);
            } else if (data.type === "completed") {
              setFileStatuses(prev => {
                const next = { ...prev, [data.file]: data.cached ? "cached" : "completed" };
                const done = Object.values(next).filter(s => s === "completed" || s === "cached").length;
                const total = Object.keys(next).length || 1;
                setLoadingProgress(5 + (done / total) * 90);
                return next;
              });
              if (data.issues_found != null) setIssuesFoundSoFar(data.issues_found);
            } else if (data.type === "result") {
              es.close();
              setLoadingProgress(100);
              setTimeout(() => {
                setScanResult(data.data);
                setShowResults(true);
                setIsLoading(false);
                setCurrentSessionId(null);
                resultsRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 500);              fetchRateLimitStatus();              resolve();
            } else if (data.type === "cancelled") {
              es.close(); setIsLoading(false); setCurrentSessionId(null);
              showToast("Scan cancelled", "warning"); resolve();
            } else if (data.type === "error") {
              es.close(); setError(data.message || "Scan error"); setIsLoading(false); reject(new Error(data.message));
            }
          } catch (err) { console.error("SSE parse error:", err); }
        };
        es.onerror = () => { es.close(); setIsLoading(false); reject(new Error("Connection lost")); };
      });
    } catch (err) {
      const errCode = err.response?.data?.error_code;
      if (errCode === "SCAN_LIMIT_EXCEEDED" || errCode === "RATE_LIMIT_EXCEEDED") {
        setError(`Scan limit reached. ${err.response?.data?.error || "Please try again later."}`);
        fetchRateLimitStatus();
      } else {
        setError(err.response?.data?.error || err.message || "Scan failed");
      }
      setIsLoading(false);
    }
  };

  const handleCancelScan = () => {
    if (currentSessionId) axios.post(`${API}/api/scan/cancel/${currentSessionId}`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    if (eventSourceRef.current) eventSourceRef.current.close();
    setIsLoading(false);
    setCurrentSessionId(null);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".zip")) setFile(f);
    else showToast("Only .zip files accepted", "warning");
  };

  /* ─── Filtered Issues ─── */
  const filteredAndSortedIssues = useMemo(() => {
    if (!scanResult?.issues) return [];
    let items = [...scanResult.issues];
    if (activeFilter !== "All") items = items.filter(i => i.severity === activeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.description?.toLowerCase().includes(q) || i.file?.toLowerCase().includes(q) || i.suggestion?.toLowerCase().includes(q));
    }
    items.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "severity") cmp = (SEVERITY_ORDER[a.severity] || 9) - (SEVERITY_ORDER[b.severity] || 9);
      else if (sortBy === "risk") cmp = (b.risk_score || 0) - (a.risk_score || 0);
      else if (sortBy === "file") cmp = (a.file || "").localeCompare(b.file || "");
      else cmp = (a.description || "").localeCompare(b.description || "");
      return sortOrder === "desc" ? cmp : -cmp;
    });
    return items;
  }, [scanResult, activeFilter, searchQuery, sortBy, sortOrder]);

  const severityCounts = useMemo(() => {
    if (!scanResult?.issues) return {};
    const c = { All: scanResult.issues.length, Critical: 0, High: 0, Medium: 0, Low: 0 };
    scanResult.issues.forEach(i => { if (c[i.severity] !== undefined) c[i.severity]++; });
    return c;
  }, [scanResult]);

  const vulnChartData = useMemo(() => {
    if (!scanResult?.issues) return null;
    return {
      labels: ["Critical", "High", "Medium", "Low"],
      datasets: [{ data: [severityCounts.Critical, severityCounts.High, severityCounts.Medium, severityCounts.Low],
        backgroundColor: ["#ef444480", "#f9731680", "#eab30880", "#06b6d480"],
        borderColor: ["#ef4444", "#f97316", "#eab308", "#06b6d4"], borderWidth: 2 }],
    };
  }, [scanResult, severityCounts]);

  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: dark ? "#9ca3af" : "#6b7280", font: { size: 11 } } } } };
  const priorityItems = scanResult?.fix_first || [];
  const riskMatrix = scanResult?.risk_matrix || {};

  /* ─── Export ─── */
  const handleExportJSON = () => {
    if (!scanResult) return;
    const blob = new Blob([JSON.stringify(scanResult, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `scan-result-${Date.now()}.json`; a.click(); URL.revokeObjectURL(a.href);
    showToast("JSON exported!", "success");
  };

  const handleExportCSV = () => {
    if (!scanResult) return;
    exportToCSV(scanResult);
    showToast("CSV exported!", "success");
  };

  const handleExportPDF = () => {
    if (!scanResult) return;
    generateProfessionalPDF(scanResult, chartRef);
    showToast("PDF exported!", "success");
  };

  const card = dark
    ? "backdrop-blur-2xl bg-gradient-to-b from-white/[0.1] to-white/[0.04] border border-white/[0.12] shadow-2xl shadow-black/40 hover:border-white/[0.18] transition-all duration-300"
    : "backdrop-blur-2xl bg-gradient-to-b from-white/95 to-white/80 border border-gray-200/80 shadow-2xl shadow-gray-400/20 hover:shadow-gray-400/30 transition-all duration-300";

  return (
    <div className={`relative min-h-screen overflow-hidden font-sans transition-colors duration-300 ${
      dark ? "bg-gradient-to-b from-[#0a0b14] via-[#0f1121] to-[#0a0b14] text-white"
           : "bg-gradient-to-b from-gray-50 via-white to-gray-50 text-gray-900"
    }`}>

      {/* Animated background gradients */}
      <div className={`absolute -top-40 -left-40 w-[900px] h-[900px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-indigo-600/20" : "bg-indigo-400/8"}`} style={{animationDuration:'20s'}} />
      <div className={`absolute top-40 right-0 w-[800px] h-[800px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-purple-600/20" : "bg-purple-400/8"}`} style={{animationDuration:'25s', animationDelay:'3s'}} />
      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-pink-700/15" : "bg-pink-400/5"}`} style={{animationDuration:'30s', animationDelay:'6s'}} />

      <Toast toast={toast} onClose={() => setToast(p => ({ ...p, open: false }))} />

      {/* ── Navbar ── */}
      <nav className={`relative z-20 flex justify-between items-center px-5 lg:px-10 py-2.5 backdrop-blur-2xl transition-all duration-300 ${
        dark ? "bg-white/[0.03] border-b border-white/[0.08]" : "bg-white/60 border-b border-gray-100"
      }`}>
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden ring-1 ring-white/20 shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-shadow duration-300 bg-black/10">
            <img
              src="/AI Code Reviewer & Secuity Auditor.jpeg"
              alt="AI Code Reviewer and Security Auditor logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className={`text-lg font-medium tracking-wide leading-tight transition-colors ${dark ? 'text-white' : 'text-gray-900'}`}>AI Code <span className="font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Reviewer</span></h1>
            <p className={`text-[10px] leading-tight transition-colors ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Security Auditor</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {isAuthenticated() && (
            <div className="hidden md:flex items-center gap-1 mr-2">
              {[
                { to: "/history", label: "History", icon: "📜" },
                { to: "/snippets", label: "Snippets", icon: "📚" },
                { to: "/reports", label: "Reports", icon: "📊" },
                { to: "/explain", label: "Explain", icon: "🧠" },
                { to: "/chat", label: "Chat", icon: "💬" },
              ].map(l => (
                <Link key={l.to} to={l.to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    dark ? "text-gray-400 hover:text-white hover:bg-white/[0.06]" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}>
                  <span className="mr-1">{l.icon}</span>{l.label}
                </Link>
              ))}
              {isAdmin() && (
                <Link to="/admin" className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${dark ? "text-gray-400 hover:text-white hover:bg-white/[0.06]" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}>
                  <span className="mr-1">🛡️</span>Admin
                </Link>
              )}
            </div>
          )}

          <button onClick={() => setDark(!dark)}
            className={`p-2.5 rounded-xl transition-all duration-300 group ${dark ? "hover:bg-white/10 text-gray-400 hover:text-yellow-300" : "hover:bg-gray-100 text-gray-500 hover:text-indigo-600"}`} aria-label="Toggle theme">
            {dark ? (
              <svg className="w-5 h-5 transition-transform duration-500 group-hover:rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-5 h-5 transition-transform duration-500 group-hover:-rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>

          {isAuthenticated() ? (
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${dark ? "hover:bg-white/10 text-white" : "hover:bg-gray-100 text-gray-800"}`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                  {user?.username?.[0]?.toUpperCase() || "U"}
                </div>
                <span className="hidden sm:block text-sm font-medium">{user?.username}</span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className={`absolute right-0 top-12 w-48 rounded-xl shadow-2xl z-50 border py-2 ${dark ? "bg-slate-900 border-white/10" : "bg-white border-gray-200"}`}>
                    <div className={`px-4 py-2 text-xs font-medium border-b mb-1 ${dark ? "text-gray-400 border-white/10" : "text-gray-500 border-gray-100"}`}>
                      {user?.email} {user?.is_admin && <span className="ml-1 text-purple-400">(admin)</span>}
                    </div>
                    <button onClick={() => { logout(); setMenuOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition ${dark ? "text-red-400 hover:bg-white/5" : "text-red-500 hover:bg-red-50"}`}>
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className={`px-5 py-2 text-sm border rounded-lg transition backdrop-blur-sm shadow-lg ${
                dark ? "border-white/30 hover:bg-white/10 text-white/90 shadow-black/10" : "border-gray-300 hover:bg-gray-100 text-gray-700 shadow-gray-300/20"
              }`}>Login</Link>
              <Link to="/login?tab=register" className="px-5 py-2 text-sm rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:opacity-90 transition shadow-lg shadow-indigo-500/30">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="relative z-10 text-center mt-14 px-6 w-full page-enter">
        <h2 className="text-4xl md:text-[3.2rem] font-bold leading-tight mb-4">
          Transform Code into{" "}
          <span className="shimmer-text">
            Secure, Production-Ready Software
          </span>
        </h2>
        <p className={`text-base md:text-lg mb-8 max-w-3xl mx-auto animate-fade-in ${dark ? "text-gray-400" : "text-gray-600"}`} style={{animationDelay:'0.2s'}}>
          Upload your project, connect GitHub, or paste code — AI scans for vulnerabilities instantly.
        </p>

        {/* ── Scan Mode Selector ── */}
        <div className="flex justify-center gap-3 mb-4 animate-fade-in" style={{animationDelay:'0.3s'}}>
          <div className={`flex rounded-xl p-1 ${dark ? "bg-white/[0.05]" : "bg-gray-100/80"}`}>
            {[{ key: "quick", label: "⚡ Quick Scan" }, { key: "deep", label: "🔬 Deep Scan" }].map(m => (
              <button key={m.key} onClick={() => setScanMode(m.key)}
                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                  scanMode === m.key
                    ? "text-white shadow-lg shadow-indigo-500/25"
                    : dark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
                }`}>
                {scanMode === m.key && <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600" />}
                <span className="relative">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Rate Limit Indicator ── */}
        {rateLimitInfo && rateLimitInfo.tier === 'admin' && (
          <div className="flex justify-center mb-8">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-xl text-sm ${
              dark ? "bg-purple-500/10 border-purple-500/30 text-purple-400" : "bg-purple-50 border-purple-200 text-purple-600"
            }`}>
              <span className="font-semibold">🛡️ Unlimited Scans</span>
              <span className={`text-xs ${dark ? "text-gray-300" : "text-gray-500"}`}>(Admin Access)</span>
            </div>
          </div>
        )}
        {rateLimitInfo && rateLimitInfo.is_limited && (
          <div className="flex justify-center mb-8">
            <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-xl border backdrop-blur-xl text-sm ${
              rateLimitInfo.remaining_scans === 0
                ? (dark ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-red-50 border-red-200 text-red-600")
                : rateLimitInfo.remaining_scans <= 3
                  ? (dark ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-600")
                  : (dark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600")
            }`}>
              <span className="font-semibold">
                {rateLimitInfo.remaining_scans === 0 ? "🚫" : rateLimitInfo.remaining_scans <= 3 ? "⚠️" : "✨"}
                {" "}{rateLimitInfo.remaining_scans} / {rateLimitInfo.daily_limit} scans remaining
              </span>
              <span className={`text-xs ${dark ? "text-gray-300" : "text-gray-500"}`}>
                ({rateLimitInfo.tier} tier)
              </span>
              {rateLimitInfo.remaining_scans === 0 && rateLimitInfo.reset_date && (
                <span className={`text-xs ${dark ? "text-gray-300" : "text-gray-500"}`}>
                  Resets {new Date(rateLimitInfo.reset_date).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        )}
        {(!rateLimitInfo || (!rateLimitInfo.is_limited && rateLimitInfo.tier !== 'admin')) && <div className="mb-8" />}

        {/* ── Three Input Cards ── */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto px-4 min-h-[280px] stagger-children">

          {/* ────── Card 1 — ZIP Upload ────── */}
          <div className={`relative group cursor-pointer animate-fade-in-up transition-all duration-300 ${activeTab === "zip" ? "ring-2 ring-indigo-500/40 rounded-2xl" : ""}`}
            onClick={() => setActiveTab("zip")}>
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-2xl rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className={`relative backdrop-blur-2xl rounded-2xl p-6 h-full flex flex-col shadow-2xl transition-all duration-300 ${
              dark ? "bg-gradient-to-b from-white/[0.1] to-white/[0.04] border border-white/[0.12] shadow-black/40 hover:border-white/[0.18]"
                   : "bg-gradient-to-b from-white/95 to-white/80 border border-gray-200/80 shadow-gray-400/20 hover:shadow-gray-400/30"
            }`}>
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br via-transparent to-transparent pointer-events-none ${dark ? "from-white/[0.08]" : "from-white/40"}`} />
              <div className="relative z-10 flex flex-col items-center flex-1">
                <div className="mb-4">
                  <svg width="64" height="64" viewBox="0 0 100 100" fill="none">
                    <defs>
                      <linearGradient id="fb" x1="10" y1="30" x2="90" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#fbbf24" /><stop offset="1" stopColor="#f59e0b" /></linearGradient>
                      <linearGradient id="ft" x1="10" y1="20" x2="50" y2="40" gradientUnits="userSpaceOnUse"><stop stopColor="#fcd34d" /><stop offset="1" stopColor="#f59e0b" /></linearGradient>
                      <linearGradient id="ff" x1="10" y1="45" x2="90" y2="85" gradientUnits="userSpaceOnUse"><stop stopColor="#fde68a" /><stop offset="1" stopColor="#fbbf24" /></linearGradient>
                    </defs>
                    <rect x="10" y="28" width="80" height="52" rx="6" fill="url(#fb)" />
                    <path d="M10 28 C10 24, 14 20, 18 20 L38 20 C40 20, 42 21, 43 23 L48 28 Z" fill="url(#ft)" />
                    <rect x="10" y="38" width="80" height="42" rx="5" fill="url(#ff)" />
                    <rect x="38" y="42" width="30" height="24" rx="3" fill="white" fillOpacity="0.9" />
                    <rect x="38" y="42" width="30" height="7" rx="3" fill="#f59e0b" fillOpacity="0.6" />
                    <text x="53" y="60" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#92400e" fontFamily="sans-serif">ZIP</text>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Drop Project ZIP</h3>

                {activeTab === "zip" ? (
                  <div className="w-full mt-2 flex flex-col flex-1">
                    <div onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                      onDragLeave={(e) => { e.stopPropagation(); setIsDragging(false); }}
                      onDrop={(e) => { e.stopPropagation(); handleDrop(e); }}
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex-1 flex items-center justify-center ${
                        isDragging ? "border-indigo-500 bg-indigo-500/10"
                          : file ? (dark ? "border-emerald-500/30 bg-emerald-500/5" : "border-emerald-300 bg-emerald-50")
                          : (dark ? "border-white/[0.15] hover:border-white/[0.3]" : "border-gray-300 hover:border-gray-400")
                      }`}>
                      <input ref={fileInputRef} type="file" accept=".zip" hidden onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }} />
                      {file ? (
                        <div>
                          <p className="font-semibold">📁 {file.name}</p>
                          <p className={`text-xs mt-1 ${dark ? "text-gray-300" : "text-gray-500"}`}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      ) : (
                        <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-500"}`}>Drop .zip here or click to browse</p>
                      )}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleZipScan(); }} disabled={isLoading || !file}
                      className="mt-3 w-full py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:opacity-90 transition shadow-lg shadow-indigo-500/50 disabled:opacity-40 flex items-center justify-center gap-2">
                      {isLoading && activeTab === "zip" && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {isLoading && activeTab === "zip" ? "Scanning..." : "🚀 Scan ZIP"}
                    </button>
                  </div>
                ) : (
                  <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-500"}`}>.zip file (Full repository)</p>
                )}
              </div>
            </div>
          </div>

          {/* ────── Card 2 — GitHub URL ────── */}
          <div className={`relative group cursor-pointer animate-fade-in-up transition-all duration-300 ${activeTab === "github" ? "ring-2 ring-indigo-500/40 rounded-2xl" : ""}`}
            onClick={() => setActiveTab("github")}>
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-2xl rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className={`relative backdrop-blur-2xl rounded-2xl p-6 h-full flex flex-col shadow-2xl transition-all duration-300 ${
              dark ? "bg-gradient-to-b from-white/[0.1] to-white/[0.04] border border-white/[0.12] shadow-black/40 hover:border-white/[0.18]"
                   : "bg-gradient-to-b from-white/95 to-white/80 border border-gray-200/80 shadow-gray-400/20 hover:shadow-gray-400/30"
            }`}>
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br via-transparent to-transparent pointer-events-none ${dark ? "from-white/[0.08]" : "from-white/50"}`} />
              <div className="relative z-10 flex flex-col items-center flex-1">
                <div className="mb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-b from-[#2d333b] to-[#1c2028] flex items-center justify-center border border-white/10 shadow-lg shadow-black/30">
                    <svg width="36" height="36" viewBox="0 0 98 96" fill="white"><path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/></svg>
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">Connect GitHub</h3>

                {activeTab === "github" ? (
                  <div className="w-full mt-1 flex flex-col flex-1">
                    <div className="w-full relative mb-3">
                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? "text-gray-400" : "text-gray-500"}`}>
                        <svg width="16" height="16" viewBox="0 0 98 96" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/></svg>
                      </span>
                      <input value={githubUrl} onChange={e => setGithubUrl(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                          dark ? "bg-white/[0.07] border border-white/[0.15] text-gray-200 placeholder-gray-400" : "bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400"
                        }`}
                        placeholder="https://github.com/user/repo" />
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleGithubScan(); }} disabled={isLoading || !githubUrl.trim()}
                      className="w-full py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:opacity-90 transition shadow-lg shadow-indigo-500/50 disabled:opacity-40 flex items-center justify-center gap-2">
                      {isLoading && activeTab === "github" && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {isLoading && activeTab === "github" ? "Scanning..." : "🚀 Scan Repository"}
                    </button>
                  </div>
                ) : (
                  <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-500"}`}>Paste a GitHub repository URL</p>
                )}
              </div>
            </div>
          </div>

          {/* ────── Card 3 — Paste Code ────── */}
          <div className={`relative group cursor-pointer animate-fade-in-up transition-all duration-300 ${activeTab === "code" ? "ring-2 ring-indigo-500/40 rounded-2xl" : ""}`}
            onClick={() => setActiveTab("code")}>
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-2xl rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className={`relative backdrop-blur-2xl rounded-2xl p-6 h-full flex flex-col shadow-2xl transition-all duration-300 ${
              dark ? "bg-gradient-to-b from-white/[0.1] to-white/[0.04] border border-white/[0.12] shadow-black/40 hover:border-white/[0.18]"
                   : "bg-gradient-to-b from-white/95 to-white/80 border border-gray-200/80 shadow-gray-400/20 hover:shadow-gray-400/30"
            }`}>
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br via-transparent to-transparent pointer-events-none ${dark ? "from-white/[0.08]" : "from-white/50"}`} />
              <div className="relative z-10 flex flex-col items-center flex-1">
                <div className="mb-4">
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${dark ? "bg-gradient-to-br from-indigo-500/30 to-purple-500/30" : "bg-gradient-to-br from-indigo-400/30 to-purple-400/30"}`}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={dark ? "text-indigo-300" : "text-indigo-600"}>
                      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">Paste Code</h3>

                {activeTab === "code" ? (
                  <div className="w-full mt-1 flex flex-col flex-1 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <select value={language} onChange={e => setLanguage(e.target.value)} onClick={e => e.stopPropagation()}
                        className={`px-2 py-1.5 rounded-lg text-xs focus:outline-none ${dark ? "bg-white/[0.06] border border-white/[0.12] text-white" : "bg-gray-50 border border-gray-200 text-gray-900"}`}>
                        {LANGUAGES.map(l => <option key={l} value={l} className="bg-slate-900">{l}</option>)}
                      </select>
                      <span className={`text-xs ml-auto ${dark ? "text-gray-400" : "text-gray-500"}`}>{code.split("\n").length} lines</span>
                    </div>
                    <textarea value={code} onChange={e => setCode(e.target.value)} onClick={e => e.stopPropagation()}
                      placeholder="Paste your code here..."
                      rows={6}
                      className={`w-full px-3 py-2 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none flex-1 ${
                        dark ? "bg-[#0d1117] border border-white/[0.1] text-gray-200 placeholder-gray-500" : "bg-gray-900 border border-gray-700 text-gray-200 placeholder-gray-500"
                      }`} />
                    <button onClick={(e) => { e.stopPropagation(); handleCodeScan(); }} disabled={isLoading || !code.trim()}
                      className="mt-3 w-full py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:opacity-90 transition shadow-lg shadow-indigo-500/50 disabled:opacity-40 flex items-center justify-center gap-2">
                      {isLoading && activeTab === "code" && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {isLoading && activeTab === "code" ? "Scanning..." : "🚀 Scan Code"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={`w-full rounded-lg overflow-hidden border text-left ${dark ? "bg-[#0d1117] border-white/[0.08]" : "bg-gray-900 border-gray-700"}`}>
                      <div className={`flex items-center gap-2 px-3 py-2 border-b ${dark ? "bg-white/[0.04] border-white/[0.06]" : "bg-gray-800 border-gray-700"}`}>
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" /><div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                      </div>
                      <div className="p-3 font-mono text-[10px] leading-relaxed text-gray-400">
                        <p><span className="text-gray-600">1</span>  <span className="text-purple-400">function</span> <span className="text-blue-400">example</span>() {'{'}</p>
                        <p className="ml-4"><span className="text-gray-600">2</span>    <span className="text-pink-400">return</span> <span className="text-green-400">"code"</span>;</p>
                        <p><span className="text-gray-600">3</span>  {'}'}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SSE Progress */}
        {isLoading && scannedFiles.length > 0 && (
          <div className="max-w-6xl mx-auto px-4">
            <ScanProgress files={scannedFiles} fileStatuses={fileStatuses}
              progress={loadingProgress} issuesFound={issuesFoundSoFar} eta={etaSeconds}
              cacheHits={cacheHits} onCancel={handleCancelScan} dark={dark} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="max-w-6xl mx-auto px-4 mt-4">
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════ */}
      {/*            RESULTS SECTION          */}
      {/* ═══════════════════════════════════ */}
      {showResults && scanResult && (
        <div ref={resultsRef} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className={`text-2xl font-bold ${dark ? "text-white" : "text-gray-900"}`}>Scan Results</h2>
              <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-500"}`}>
                {scanResult.files_scanned} files scanned • {scanResult.issues?.length || 0} issues found
                {scanResult.scan_mode && ` • ${scanResult.scan_mode} mode`}
                {scanResult.scan_duration && ` • ${scanResult.scan_duration.toFixed(1)}s`}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleExportJSON}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition border ${dark ? "border-white/10 text-gray-300 hover:bg-white/[0.06]" : "border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
                📥 JSON
              </button>
              <button onClick={handleExportCSV}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition border ${dark ? "border-white/10 text-gray-300 hover:bg-white/[0.06]" : "border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
                📊 CSV
              </button>
              <button onClick={handleExportPDF}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition border ${dark ? "border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10" : "border-indigo-200 text-indigo-600 hover:bg-indigo-50"}`}>
                📄 PDF Report
              </button>
            </div>
          </div>

          {/* Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className={`rounded-2xl p-6 flex items-center justify-center ${card}`}>
              <ScoreGauge score={scanResult.overall_score || 0} dark={dark} />
            </div>
            <div className="space-y-4">
              <StatCard label="Issues Found" value={scanResult.issues?.length || 0} sub={`${severityCounts.Critical || 0} critical`} color="text-red-400" dark={dark} />
              <StatCard label="Files Scanned" value={scanResult.files_scanned || 0} dark={dark} />
            </div>
            <div className="space-y-4">
              <StatCard label="Code Complexity" value={scanResult.metrics?.code_complexity || "N/A"} dark={dark} />
              <StatCard label="Duplication" value={`${scanResult.metrics?.duplication_percentage || 0}%`} dark={dark} />
            </div>
            <div className={`rounded-xl p-4 ${card}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${dark ? "text-gray-400" : "text-gray-500"}`}>Distribution</span>
                <div className="flex gap-1">
                  {["doughnut", "bar", "polar"].map(t => (
                    <button key={t} onClick={() => setChartType(t)}
                      className={`text-[10px] px-2 py-0.5 rounded ${chartType === t ? "bg-indigo-500/20 text-indigo-400" : dark ? "text-gray-400" : "text-gray-500"}`}>
                      {t === "doughnut" ? "🍩" : t === "bar" ? "📊" : "🎯"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-36">
                {vulnChartData && (chartType === "doughnut"
                  ? <Doughnut ref={chartRef} data={vulnChartData} options={chartOpts} />
                  : chartType === "polar"
                    ? <PolarArea data={vulnChartData} options={{ ...chartOpts, scales: { r: { ticks: { display: false }, grid: { color: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" } } } }} />
                    : <Bar data={vulnChartData} options={{ ...chartOpts, scales: { x: { ticks: { color: dark ? "#6b7280" : "#9ca3af" } }, y: { ticks: { color: dark ? "#6b7280" : "#9ca3af" } } } }} />
                )}
              </div>
            </div>
          </div>

          {/* Model Comparison */}
          {availableModels.length > 0 && (
            <div className="mb-8">
              <ModelComparison availableModels={availableModels} dark={dark} />
            </div>
          )}

          {/* Additional Charts */}
          {scanResult?.issues?.length > 0 && (() => {
            const fileTypeMap = {};
            scanResult.issues.forEach(issue => {
              const file = issue.file || "";
              const ext = file.includes(".") ? `.${file.split(".").pop().toLowerCase()}` : "other";
              fileTypeMap[ext] = (fileTypeMap[ext] || 0) + 1;
            });
            const fileTypes = Object.entries(fileTypeMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
            const metricsRadar = scanResult.metrics ? {
              labels: ["Security Score", "Complexity", "Duplication", "Dependencies", "Coverage"],
              datasets: [{
                label: "Metrics",
                data: [
                  scanResult.overall_score || 0,
                  Math.min(100, (scanResult.metrics.code_complexity === "N/A" ? 50 : parseInt(scanResult.metrics.code_complexity) || 50)),
                  100 - (scanResult.metrics.duplication_percentage || 0),
                  100 - Math.min(100, (scanResult.metrics.vulnerable_dependencies || 0) * 20),
                  scanResult.metrics.test_coverage || 50,
                ],
                backgroundColor: dark ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.1)",
                borderColor: "#6366f1",
                borderWidth: 2,
                pointBackgroundColor: "#6366f1",
              }],
            } : null;

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {/* Issues by File Type */}
                <div className={`rounded-2xl p-5 ${card}`}>
                  <h4 className={`text-sm font-bold mb-3 ${dark ? "text-white" : "text-gray-900"}`}>📁 Issues by File Type</h4>
                  <div className="h-48">
                    <Bar data={{
                      labels: fileTypes.map(([ext]) => ext),
                      datasets: [{
                        label: "Issues",
                        data: fileTypes.map(([, count]) => count),
                        backgroundColor: fileTypes.map((_, i) => [`#6366f180`, `#8b5cf680`, `#a855f780`, `#ec489980`, `#f4364680`, `#f9731680`, `#eab30880`, `#22c55e80`][i % 8]),
                        borderColor: fileTypes.map((_, i) => [`#6366f1`, `#8b5cf6`, `#a855f7`, `#ec4899`, `#f43646`, `#f97316`, `#eab308`, `#22c55e`][i % 8]),
                        borderWidth: 1,
                        borderRadius: 4,
                      }],
                    }} options={{ ...chartOpts, scales: { x: { ticks: { color: dark ? "#6b7280" : "#9ca3af" } }, y: { ticks: { color: dark ? "#6b7280" : "#9ca3af" }, beginAtZero: true } }, plugins: { legend: { display: false } } }} />
                  </div>
                </div>
                {/* Metrics Radar */}
                {metricsRadar && (
                  <div className={`rounded-2xl p-5 ${card}`}>
                    <h4 className={`text-sm font-bold mb-3 ${dark ? "text-white" : "text-gray-900"}`}>🎯 Code Health Radar</h4>
                    <div className="h-48">
                      <Radar data={metricsRadar} options={{
                        responsive: true, maintainAspectRatio: false,
                        scales: { r: { angleLines: { color: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }, grid: { color: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }, ticks: { display: false }, pointLabels: { color: dark ? "#9ca3af" : "#6b7280", font: { size: 10 } }, min: 0, max: 100 } },
                        plugins: { legend: { display: false } },
                      }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Priority Matrix */}
          {priorityItems.length > 0 && (
            <div className={`rounded-2xl p-6 mb-8 ${card}`}>
              <h3 className={`text-lg font-bold mb-4 ${dark ? "text-white" : "text-gray-900"}`}>🎯 Fix This First</h3>

              {/* Risk Distribution Bar */}
              {scanResult?.issues?.length > 0 && (() => {
                const total = scanResult.issues.length;
                const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
                scanResult.issues.forEach(i => { if (counts[i.severity] !== undefined) counts[i.severity]++; });
                return (
                  <div className="mb-4">
                    <p className={`text-xs font-medium mb-1.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>Risk Distribution</p>
                    <div className="flex w-full h-3 rounded-full overflow-hidden">
                      {["Critical", "High", "Medium", "Low"].map(sev => {
                        const pct = (counts[sev] / total) * 100;
                        if (pct === 0) return null;
                        return <div key={sev} style={{ width: `${pct}%`, background: SEVERITY_COLORS[sev] }} className="transition-all duration-500" title={`${sev}: ${counts[sev]} (${Math.round(pct)}%)`} />;
                      })}
                    </div>
                    <div className="flex gap-3 mt-1.5">
                      {["Critical", "High", "Medium", "Low"].map(sev => counts[sev] > 0 && (
                        <span key={sev} className="flex items-center gap-1 text-[10px]">
                          <span className="w-2 h-2 rounded-full" style={{ background: SEVERITY_COLORS[sev] }} />
                          <span className={dark ? "text-gray-300" : "text-gray-500"}>{sev} ({counts[sev]})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Effort Breakdown Grid */}
              {(() => {
                const effortCounts = { low: 0, medium: 0, high: 0 };
                (scanResult?.issues || []).forEach(i => {
                  if (i.severity === "Low" || i.severity === "Medium") effortCounts.low++;
                  else if (i.severity === "High") effortCounts.medium++;
                  else effortCounts.high++;
                });
                return (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: "Low Effort", count: effortCounts.low, color: "emerald", desc: "< 1 hour" },
                      { label: "Medium Effort", count: effortCounts.medium, color: "amber", desc: "1-4 hours" },
                      { label: "High Effort", count: effortCounts.high, color: "red", desc: "> 4 hours" },
                    ].map(e => (
                      <div key={e.label} className={`rounded-xl p-3 text-center ${dark ? "bg-white/[0.04]" : "bg-gray-50"}`}>
                        <p className={`text-lg font-bold text-${e.color}-400`}>{e.count}</p>
                        <p className={`text-[10px] font-medium ${dark ? "text-gray-400" : "text-gray-500"}`}>{e.label}</p>
                        <p className={`text-[9px] ${dark ? "text-gray-400" : "text-gray-500"}`}>{e.desc}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className="space-y-2">
                {priorityItems.slice(0, 5).map((item, i) => {
                  const effort = item.severity === "Critical" ? "High (> 4h)" : item.severity === "High" ? "Medium (1-4h)" : item.severity === "Medium" ? "Low (< 1h)" : "Minimal (< 30m)";
                  const effortColor = item.severity === "Critical" ? "text-red-400 bg-red-500/10" : item.severity === "High" ? "text-amber-400 bg-amber-500/10" : "text-emerald-400 bg-emerald-500/10";
                  return (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${dark ? "bg-white/[0.02]" : "bg-gray-50"}`}>
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        i === 0 ? "bg-red-500/20 text-red-400" : i === 1 ? "bg-orange-500/20 text-orange-400" : "bg-amber-500/20 text-amber-400"
                      }`}>#{i + 1}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: SEVERITY_COLORS[item.severity] }}>{item.severity}</span>
                      <span className={`flex-1 text-sm truncate ${dark ? "text-gray-300" : "text-gray-700"}`}>{item.description}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${effortColor}`}>{effort}</span>
                      {item.risk_score && <span className={`text-xs ${dark ? "text-gray-300" : "text-gray-500"}`}>Risk: {item.risk_score}</span>}
                    </div>
                  );
                })}
              </div>
              {riskMatrix.total_estimated_hours && (
                <p className={`mt-3 text-xs ${dark ? "text-gray-300" : "text-gray-500"}`}>
                  Estimated fix time: <span className="font-semibold text-indigo-400">{riskMatrix.total_estimated_hours}h</span>
                </p>
              )}
            </div>
          )}

          {/* Search & Filters */}
          <div className={`rounded-2xl p-5 mb-6 ${card}`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search issues..."
                  className={`w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                    dark ? "bg-white/[0.06] border border-white/[0.1] text-white placeholder-gray-400" : "bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400"
                  }`} />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {["All", "Critical", "High", "Medium", "Low"].map(f => (
                  <button key={f} onClick={() => setActiveFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      activeFilter === f ? `text-white ${f === "All" ? "bg-indigo-500" : ""}` : dark ? "bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                    style={activeFilter === f && f !== "All" ? { background: SEVERITY_COLORS[f] } : {}}>
                    {f} {severityCounts[f] !== undefined ? `(${severityCounts[f]})` : ""}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className={`px-2 py-1.5 rounded-lg text-xs focus:outline-none ${dark ? "bg-white/[0.06] border border-white/[0.1] text-gray-300" : "bg-gray-100 border border-gray-200 text-gray-600"}`}>
                  <option value="severity">Severity</option><option value="risk">Risk</option><option value="file">File</option>
                </select>
                <button onClick={() => setSortOrder(p => p === "desc" ? "asc" : "desc")}
                  className={`px-2 py-1.5 rounded-lg text-xs transition ${dark ? "bg-white/[0.06] text-gray-400 hover:bg-white/[0.1]" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                  {sortOrder === "desc" ? "↓" : "↑"}
                </button>
              </div>
            </div>
          </div>

          {/* Issues List */}
          <div className="space-y-3">
            <h3 className={`text-lg font-bold mb-2 ${dark ? "text-white" : "text-gray-900"}`}>
              Actionable Issues ({filteredAndSortedIssues.length})
            </h3>
            {filteredAndSortedIssues.length > 0 ? (
              filteredAndSortedIssues.map((issue, i) => (
                <IssueCard key={i} issue={issue} index={i} token={token} dark={dark} onShowToast={showToast} code={activeTab === "code" ? code : ""} />
              ))
            ) : (
              <div className={`text-center py-10 rounded-xl ${card}`}>
                <p className={`text-lg ${dark ? "text-gray-400" : "text-gray-500"}`}>
                  {searchQuery ? `No issues matching "${searchQuery}"` : "No issues for this filter 🎉"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Features Section (shown when no results) ── */}
      {!showResults && (
        <div className="relative z-10 mt-20 pb-20 px-6 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-3">Powered by Advanced AI Security</h3>
            <p className={`text-lg ${dark ? "text-gray-400" : "text-gray-600"}`}>Comprehensive code analysis and vulnerability detection</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>, title: "AI Code Review", desc: "Intelligent analysis of code quality, patterns, and best practices", color: dark ? "text-indigo-300" : "text-indigo-600" },
              { icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />, title: "Security Auditor", desc: "Detect vulnerabilities, exploits, and security risks in real-time", color: dark ? "text-purple-300" : "text-purple-600" },
              { icon: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>, title: "Threat Detection", desc: "Identify SQL injection, XSS, CSRF and other critical threats", color: dark ? "text-red-300" : "text-red-600" },
              { icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>, title: "Instant Reports", desc: "Get detailed reports with actionable fixes and recommendations", color: dark ? "text-green-300" : "text-green-600" },
            ].map((f, i) => (
              <div key={i} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-600/20 blur-2xl rounded-2xl opacity-0 group-hover:opacity-100 transition duration-500" />
                <div className={`relative backdrop-blur-2xl rounded-2xl p-6 h-full shadow-2xl ${
                  dark ? "bg-gradient-to-b from-white/[0.12] to-white/[0.05] border border-white/[0.2] shadow-black/40" : "bg-white/90 border border-gray-200 shadow-gray-400/20"
                }`}>
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br via-transparent to-transparent pointer-events-none ${dark ? "from-white/[0.08]" : "from-white/50"}`} />
                  <div className="relative z-10">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${dark ? "bg-gradient-to-br from-indigo-500/30 to-purple-500/30" : "bg-gradient-to-br from-indigo-400/30 to-purple-400/30"}`}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={f.color}>{f.icon}</svg>
                    </div>
                    <h4 className="text-lg font-semibold mb-2">{f.title}</h4>
                    <p className={`text-sm leading-relaxed ${dark ? "text-gray-400" : "text-gray-600"}`}>{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}