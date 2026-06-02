import { useState, useRef, useCallback, useMemo, useEffect, useContext } from "react";
import { ThemeContext } from "../components/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Toast from "../components/Toast";
import axios from "axios";
import { Chart as ChartJS, ArcElement, Tooltip as CTooltip, Legend, CategoryScale, LinearScale, BarElement, RadialLinearScale, PointElement, LineElement } from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(ArcElement, CTooltip, Legend, CategoryScale, LinearScale, BarElement, RadialLinearScale, PointElement, LineElement);

const API = "http://localhost:5000";

const SEVERITY_COLORS = { Critical: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#06b6d4" };
const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

/* ─── Score Gauge ─── */
function ScoreGauge({ score, dark }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f97316" : score >= 40 ? "#ef4444" : "#a855f7";
  const pct = Math.min(score, 100);
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} strokeWidth="3" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${pct} ${100 - pct}`} className="transition-all duration-1000" />
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
    <div className={`relative rounded-xl p-5 border backdrop-blur-2xl transition-all hover:scale-[1.02] shadow-2xl ${
      dark ? "bg-gradient-to-b from-white/[0.12] to-white/[0.05] border-white/[0.2] shadow-black/40" : "bg-gradient-to-b from-white/90 to-white/70 border-gray-200 shadow-gray-400/30"
    }`}>
      <p className={`text-xs font-medium uppercase tracking-wider ${dark ? "text-gray-400" : "text-gray-400"}`}>{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || (dark ? "text-white" : "text-gray-900")}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${dark ? "text-gray-400" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}

/* ─── Issue Card ─── */
function IssueCard({ issue, index, token, dark, onShowToast }) {
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(issue.user_feedback || null);
  const [showFix, setShowFix] = useState(false);
  const [fixResult, setFixResult] = useState(null);
  const [fixLoading, setFixLoading] = useState(false);

  const sevColor = SEVERITY_COLORS[issue.severity] || "#6b7280";

  const handleFeedback = async (type) => {
    if (!token || feedbackLoading) return;
    setFeedbackLoading(true);
    try {
      await axios.post(`${API}/api/feedback`, {
        issue_index: index, issue_description: issue.description,
        issue_severity: issue.severity, issue_file: issue.file,
        feedback_type: type, reason: type === "false_positive" ? "User marked as false positive" : "User confirmed issue",
      }, { headers: { Authorization: `Bearer ${token}` } });
      setFeedbackGiven(type);
      onShowToast(type === "false_positive" ? "Marked as false positive" : "Issue confirmed", "success");
    } catch {
      onShowToast("Failed to submit feedback", "error");
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleGenerateFix = async () => {
    if (fixLoading) return;
    setFixLoading(true);
    try {
      const res = await axios.post(`${API}/api/fix/generate`, {
        code: "", issue: { description: issue.description, severity: issue.severity, suggestion: issue.suggestion },
        file_path: issue.file || "file",
      }, { headers: { Authorization: `Bearer ${token}` } });
      setFixResult(res.data);
      onShowToast("Fix generated!", "success");
    } catch (err) {
      onShowToast(err.response?.data?.error || "Fix generation failed", "error");
    } finally {
      setFixLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${issue.description}\nSuggestion: ${issue.suggestion}\nFile: ${issue.file}`);
    onShowToast("Copied!", "success");
  };

  return (
    <div className={`rounded-xl border-l-4 p-5 transition-all animate-fade-in-up ${
      dark ? "bg-gradient-to-b from-white/[0.10] to-white/[0.04] border-r border-t border-b border-r-white/[0.15] border-t-white/[0.15] border-b-white/[0.15] shadow-lg shadow-black/20 backdrop-blur-2xl"
           : "bg-gradient-to-b from-white/95 to-white/80 border-r border-t border-b border-r-gray-200 border-t-gray-200 border-b-gray-200 shadow-md shadow-gray-400/20 backdrop-blur-2xl"
    } ${feedbackGiven === "false_positive" ? "opacity-50" : ""}`}
      style={{ borderLeftColor: sevColor, animationDelay: `${index * 0.05}s` }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white" style={{ background: sevColor }}>{issue.severity}</span>
          {issue.risk_score != null && (
            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${dark ? "bg-white/[0.06] text-gray-300" : "bg-gray-100 text-gray-600"}`}>
              Risk {issue.risk_score}
            </span>
          )}
          {issue.effort && (
            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold`}
              style={{ background: `${issue.effort.color || "#888"}22`, color: issue.effort.color || "#888" }}>
              {issue.effort.label || issue.effort.level}
            </span>
          )}
          {issue.confidence != null && (
            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
              issue.confidence >= 0.7 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}>
              {Math.round(issue.confidence * 100)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {token && !feedbackGiven && (
            <>
              <button onClick={() => handleFeedback("false_positive")} disabled={feedbackLoading} title="False positive"
                className={`p-1.5 rounded-lg text-xs transition ${dark ? "hover:bg-red-500/10 text-gray-500 hover:text-red-400" : "hover:bg-red-50 text-gray-400 hover:text-red-500"}`}>🚫</button>
              <button onClick={() => handleFeedback("confirmed")} disabled={feedbackLoading} title="Confirm"
                className={`p-1.5 rounded-lg text-xs transition ${dark ? "hover:bg-green-500/10 text-gray-500 hover:text-green-400" : "hover:bg-green-50 text-gray-400 hover:text-green-500"}`}>✅</button>
            </>
          )}
          {feedbackGiven && (
            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
              feedbackGiven === "false_positive" ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
            }`}>{feedbackGiven === "false_positive" ? "False Positive" : "Confirmed"}</span>
          )}
          <button onClick={handleCopy} title="Copy"
            className={`p-1.5 rounded-lg text-xs transition ${dark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-400"}`}>📋</button>
        </div>
      </div>
      {/* Body */}
      <h4 className={`font-semibold mb-1 ${dark ? "text-white" : "text-gray-900"}`}>{issue.description}</h4>
      <p className={`text-xs mb-2 ${dark ? "text-gray-400" : "text-gray-400"}`}>📁 {issue.file}</p>
      <p className={`text-sm ${dark ? "text-gray-300" : "text-gray-600"}`}>💡 {issue.suggestion}</p>

      {/* AI Fix */}
      {token && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
          <button onClick={() => { setShowFix(!showFix); if (!fixResult && !showFix) handleGenerateFix(); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              dark ? "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
            }`}>
            {fixLoading ? <span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin"></span> : "🔧"}
            {showFix ? "Hide Fix" : "Generate AI Fix"}
          </button>

          {showFix && fixResult && (
            <div className={`mt-3 rounded-xl p-4 border ${dark ? "bg-white/[0.02] border-white/[0.08]" : "bg-gray-50 border-gray-200"}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-emerald-400">✓ Fix Generated</span>
                {fixResult.confidence && (
                  <span className={`px-2 py-0.5 text-xs rounded-md ${
                    fixResult.confidence >= 0.8 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                  }`}>{Math.round(fixResult.confidence * 100)}% confidence</span>
                )}
                {fixResult.generation_time_ms && (
                  <span className={`text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>{fixResult.generation_time_ms}ms</span>
                )}
              </div>
              {fixResult.fixed_code && (
                <div className={`rounded-lg overflow-hidden border mb-3 ${dark ? "bg-[#0d1117] border-white/[0.08]" : "bg-gray-900 border-gray-700"}`}>
                  <div className="flex items-center justify-between px-3 py-2 bg-white/[0.04] border-b border-white/[0.06]">
                    <span className="text-xs text-gray-400">Fixed Code</span>
                    <button onClick={() => { navigator.clipboard.writeText(fixResult.fixed_code); onShowToast("Copied!", "success"); }}
                      className="text-xs text-indigo-400 hover:text-indigo-300">Copy</button>
                  </div>
                  <pre className="p-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-64">{fixResult.fixed_code}</pre>
                </div>
              )}
              {fixResult.explanation && (
                <div className={`rounded-lg p-3 mb-2 ${dark ? "bg-blue-500/[0.06] border border-blue-500/20" : "bg-blue-50 border border-blue-200"}`}>
                  <p className="text-xs font-semibold text-blue-400 mb-1">Why this fix works</p>
                  <p className={`text-xs ${dark ? "text-gray-300" : "text-gray-600"}`}>{fixResult.explanation}</p>
                </div>
              )}
              {fixResult.security_notes && (
                <div className={`rounded-lg p-3 ${dark ? "bg-amber-500/[0.06] border border-amber-500/20" : "bg-amber-50 border border-amber-200"}`}>
                  <p className="text-xs font-semibold text-amber-400 mb-1">Security Notes</p>
                  <p className={`text-xs ${dark ? "text-gray-300" : "text-gray-600"}`}>{fixResult.security_notes}</p>
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
function ScanProgress({ files, fileStatuses, progress, issuesFound, eta, cacheHits, cacheMisses, onCancel, dark }) {
  return (
    <div className={`rounded-xl p-5 border mt-4 backdrop-blur-2xl shadow-2xl ${dark ? "bg-gradient-to-b from-white/[0.12] to-white/[0.05] border-white/[0.2] shadow-black/40" : "bg-gradient-to-b from-white/90 to-white/70 border-gray-200 shadow-gray-400/30"}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Scanning...</h3>
        <div className="flex items-center gap-3">
          {issuesFound > 0 && <span className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400">🐛 {issuesFound} issues</span>}
          {eta && <span className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400">⏱ {eta}s left</span>}
          {(cacheHits > 0 || cacheMisses > 0) && (
            <span className="text-xs px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400">⚡ {cacheHits} cached</span>
          )}
          <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition font-medium">Cancel</button>
        </div>
      </div>
      {/* Progress bar */}
      <div className={`w-full h-2 rounded-full overflow-hidden mb-4 ${dark ? "bg-white/[0.06]" : "bg-gray-200"}`}>
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
      </div>
      {/* File list */}
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {files.map((f, i) => {
          const status = fileStatuses[f] || "pending";
          const icon = status === "completed" ? "✅" : status === "cached" ? "⚡" : status === "scanning" ? "🔄" : "⏳";
          return (
            <div key={i} className={`flex items-center gap-2 text-xs py-1 ${
              status === "scanning" ? (dark ? "text-indigo-400" : "text-indigo-600") : dark ? "text-gray-400" : "text-gray-400"
            }`}>
              <span>{icon}</span>
              <span className="truncate">{f}</span>
              {status === "scanning" && <span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin ml-auto"></span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Code Paste Tab ─── */
function CodePasteTab({ onScan, loading, dark }) {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const languages = ["python","javascript","typescript","java","csharp","cpp","c","go","rust","ruby","php","swift","kotlin","scala","sql","html","css","shell","yaml","json","xml","markdown","dockerfile","terraform"];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <select value={language} onChange={e => setLanguage(e.target.value)}
          className={`px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
            dark ? "bg-white/[0.06] border border-white/[0.12] text-white" : "bg-gray-50 border border-gray-200 text-gray-900"
          }`}>
          {languages.map(l => <option key={l} value={l} className="bg-slate-900">{l}</option>)}
        </select>
        <button onClick={() => navigator.clipboard.readText().then(t => setCode(t))}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition ${dark ? "bg-white/[0.06] text-gray-300 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          📋 Paste
        </button>
        <span className={`text-xs ml-auto ${dark ? "text-gray-400" : "text-gray-400"}`}>{code.split("\n").length} lines</span>
      </div>
      <textarea value={code} onChange={e => setCode(e.target.value)} placeholder="Paste your code here..."
        rows={14}
        className={`w-full px-4 py-3 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none ${
          dark ? "bg-[#0d1117] border border-white/[0.1] text-gray-200 placeholder-gray-500" : "bg-gray-900 border border-gray-700 text-gray-200 placeholder-gray-500"
        }`} />
      <div className="flex gap-2">
        <button onClick={() => onScan(code, language)} disabled={!code.trim() || loading}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition shadow-lg shadow-indigo-500/30 disabled:opacity-40">
          {loading ? "Scanning..." : "Scan Code"}
        </button>
        <button onClick={() => setCode("")}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${dark ? "bg-white/[0.06] text-gray-300 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          Clear
        </button>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════ */
/*                 MAIN DASHBOARD                  */
/* ═══════════════════════════════════════════════ */
export default function Dashboard() {
  const { dark } = useContext(ThemeContext);
  const { token } = useAuth();

  // Scan state
  const [inputType, setInputType] = useState("zip");
  const [file, setFile] = useState(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [scanMode, setScanMode] = useState("deep");
  const [isDragging, setIsDragging] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // SSE progress
  const [scannedFiles, setScannedFiles] = useState([]);
  const [fileStatuses, setFileStatuses] = useState({});
  const [issuesFoundSoFar, setIssuesFoundSoFar] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(null);
  const [cacheHits, setCacheHits] = useState(0);
  const [cacheMisses, setCacheMisses] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const eventSourceRef = useRef(null);

  // Results UI
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("severity");
  const [sortOrder, setSortOrder] = useState("desc");
  const [chartType, setChartType] = useState("doughnut");

  // Rate limit
  const [rateLimitInfo, setRateLimitInfo] = useState(null);

  // Toast
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });
  const showToast = useCallback((message, severity = "info") => setToast({ open: true, message, severity }), []);

  const fileInputRef = useRef(null);
  const chartRef = useRef(null);

  // Fetch rate limit
  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/api/rate-limit/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setRateLimitInfo(r.data)).catch(() => {});
  }, [token]);

  /* ─── Scan handlers ─── */
  const handleScan = async () => {
    if (inputType === "zip" && !file) { showToast("Please select a ZIP file", "warning"); return; }
    if (inputType === "github" && !githubUrl.trim()) { showToast("Please enter GitHub URL", "warning"); return; }

    setIsLoading(true);
    setError("");
    setScanResult(null);
    setShowResults(false);
    setLoadingProgress(5);
    setIssuesFoundSoFar(0);
    setEtaSeconds(null);
    setCacheHits(0);
    setCacheMisses(0);

    try {
      // Step 1: Initiate scan
      let initRes;
      if (inputType === "zip") {
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

      // Step 2: SSE
      await new Promise((resolve, reject) => {
        const es = new EventSource(`${API}/api/scan/process/${session_id}?token=${token}`);
        eventSourceRef.current = es;

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === "scanning") {
              setFileStatuses(prev => ({ ...prev, [data.file]: "scanning" }));
              setLoadingProgress(10 + ((data.index || 0) / (data.total || 1)) * 80);
              if (data.issues_found != null) setIssuesFoundSoFar(data.issues_found);
              if (data.eta_seconds != null) setEtaSeconds(data.eta_seconds);
              if (data.cache_hits != null) setCacheHits(data.cache_hits);
              if (data.cache_misses != null) setCacheMisses(data.cache_misses);
            } else if (data.type === "completed") {
              setFileStatuses(prev => ({ ...prev, [data.file]: data.cached ? "cached" : "completed" }));
              if (data.issues_found != null) setIssuesFoundSoFar(data.issues_found);
            } else if (data.type === "result") {
              es.close();
              setLoadingProgress(100);
              setTimeout(() => {
                setScanResult(data.data);
                setShowResults(true);
                setIsLoading(false);
                setCurrentSessionId(null);
              }, 500);
              resolve();
            } else if (data.type === "cancelled") {
              es.close();
              setIsLoading(false);
              setCurrentSessionId(null);
              showToast("Scan cancelled", "warning");
              resolve();
            } else if (data.type === "error") {
              es.close();
              setError(data.message || "Scan error");
              setIsLoading(false);
              reject(new Error(data.message));
            }
          } catch (err) {
            console.error("SSE parse error:", err);
          }
        };

        es.onerror = () => {
          es.close();
          setIsLoading(false);
          reject(new Error("Connection lost"));
        };
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Scan failed");
      setIsLoading(false);
    }
  };

  const handleDirectCodeScan = async (code, language) => {
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
      }, 500);
    } catch (err) {
      setError(err.response?.data?.error || "Direct scan failed");
      setIsLoading(false);
    }
  };

  const handleCancelScan = () => {
    if (currentSessionId) {
      axios.post(`${API}/api/scan/cancel/${currentSessionId}`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    if (eventSourceRef.current) eventSourceRef.current.close();
    setIsLoading(false);
    setCurrentSessionId(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".zip")) { setFile(f); } 
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

  /* ─── Export ─── */
  const handleExportJSON = () => {
    if (!scanResult) return;
    const blob = new Blob([JSON.stringify(scanResult, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `scan-result-${Date.now()}.json`; a.click(); URL.revokeObjectURL(a.href);
    showToast("JSON exported!", "success");
  };

  /* ─── Chart data ─── */
  const vulnChartData = useMemo(() => {
    if (!scanResult?.issues) return null;
    return {
      labels: ["Critical", "High", "Medium", "Low"],
      datasets: [{
        data: [severityCounts.Critical, severityCounts.High, severityCounts.Medium, severityCounts.Low],
        backgroundColor: ["#ef444480", "#f9731680", "#eab30880", "#06b6d480"],
        borderColor: ["#ef4444", "#f97316", "#eab308", "#06b6d4"],
        borderWidth: 2,
      }],
    };
  }, [scanResult, severityCounts]);

  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: dark ? "#9ca3af" : "#6b7280", font: { size: 11 } } } } };

  /* ─── Priority Matrix Data ─── */
  const priorityItems = scanResult?.fix_first || [];
  const riskMatrix = scanResult?.risk_matrix || {};

  // ─── Render ───
  const bg = dark
    ? "bg-gradient-to-b from-[#0a0b14] via-[#0f1121] to-[#0a0b14] text-white"
    : "bg-gradient-to-b from-gray-50 via-white to-gray-50 text-gray-900";

  const card = dark
    ? "backdrop-blur-2xl bg-gradient-to-b from-white/[0.12] to-white/[0.05] border border-white/[0.2] shadow-2xl shadow-black/40"
    : "backdrop-blur-2xl bg-gradient-to-b from-white/90 to-white/70 border border-gray-200 shadow-2xl shadow-gray-400/30";

  return (
    <div className={`relative min-h-screen overflow-hidden transition-colors duration-300 ${bg}`}>
      {/* Background blobs (Landing style) */}
      <div className={`absolute -top-40 -left-40 w-[900px] h-[900px] blur-[180px] rounded-full pointer-events-none ${dark ? "bg-indigo-600/25" : "bg-indigo-400/10"}`} />
      <div className={`absolute top-40 right-0 w-[800px] h-[800px] blur-[180px] rounded-full pointer-events-none ${dark ? "bg-purple-600/25" : "bg-purple-400/10"}`} />
      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] blur-[180px] rounded-full pointer-events-none ${dark ? "bg-indigo-700/20" : "bg-indigo-500/8"}`} />

      <Navbar />
      <Toast toast={toast} onClose={() => setToast(p => ({ ...p, open: false }))} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ═══ INPUT SECTION ═══ */}
        <div className={`rounded-2xl border backdrop-blur-xl p-6 mb-8 ${card}`}>
          {/* Input type tabs */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className={`flex rounded-xl p-1 ${dark ? "bg-white/[0.04]" : "bg-gray-100"}`}>
              {[
                { key: "zip", label: "📁 ZIP Upload" },
                { key: "github", label: "🐙 GitHub URL" },
                { key: "code", label: "📝 Paste Code" },
              ].map(t => (
                <button key={t.key} onClick={() => setInputType(t.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    inputType === t.key
                      ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-400 shadow-sm"
                      : dark ? "text-gray-500 hover:text-gray-300" : "text-gray-500 hover:text-gray-800"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            {/* Scan mode */}
            <div className={`flex rounded-xl p-1 ml-auto ${dark ? "bg-white/[0.04]" : "bg-gray-100"}`}>
              {[
                { key: "quick", label: "⚡ Quick" },
                { key: "deep", label: "🔬 Deep" },
              ].map(m => (
                <button key={m.key} onClick={() => setScanMode(m.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    scanMode === m.key
                      ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-400"
                      : dark ? "text-gray-500 hover:text-gray-300" : "text-gray-500 hover:text-gray-800"
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ZIP Input */}
          {inputType === "zip" && (
            <div>
              <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-indigo-500 bg-indigo-500/10"
                    : file
                      ? (dark ? "border-emerald-500/30 bg-emerald-500/5" : "border-emerald-300 bg-emerald-50")
                      : (dark ? "border-white/[0.12] hover:border-white/[0.25] hover:bg-white/[0.02]" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50")
                }`}>
                <input ref={fileInputRef} type="file" accept=".zip" hidden
                  onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }} />
                {file ? (
                  <div>
                    <p className="text-lg">📁 <span className="font-semibold">{file.name}</span></p>
                    <p className={`text-sm mt-1 ${dark ? "text-gray-400" : "text-gray-400"}`}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className={`text-lg ${dark ? "text-gray-400" : "text-gray-500"}`}>Drop your .zip file here or click to browse</p>
                    <p className={`text-sm mt-1 ${dark ? "text-gray-400" : "text-gray-400"}`}>Maximum 50MB</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GitHub Input */}
          {inputType === "github" && (
            <div className="flex gap-3">
              <input value={githubUrl} onChange={e => setGithubUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                className={`flex-1 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                  dark ? "bg-white/[0.06] border border-white/[0.12] text-white placeholder-gray-400" : "bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400"
                }`} />
            </div>
          )}

          {/* Code Paste */}
          {inputType === "code" && (
            <CodePasteTab onScan={handleDirectCodeScan} loading={isLoading} dark={dark} />
          )}

          {/* Scan Button (for zip/github) */}
          {inputType !== "code" && (
            <div className="mt-4 flex items-center gap-4">
              <button onClick={handleScan} disabled={isLoading}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-purple-600 text-white font-semibold hover:opacity-90 transition shadow-lg shadow-indigo-500/30 disabled:opacity-40 flex items-center gap-2">
                {isLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                {isLoading ? "Scanning..." : "🚀 Scan Now"}
              </button>
              {rateLimitInfo && (
                <span className={`text-xs px-3 py-1.5 rounded-lg ${
                  rateLimitInfo.remaining_scans > 3 ? "bg-emerald-500/10 text-emerald-400" :
                  rateLimitInfo.remaining_scans > 0 ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                }`}>
                  {rateLimitInfo.daily_limit === -1 ? "Unlimited scans" : `${rateLimitInfo.remaining_scans}/${rateLimitInfo.daily_limit} scans`}
                </span>
              )}
            </div>
          )}

          {/* Progress bar */}
          {isLoading && loadingProgress > 0 && (
            <div className={`mt-4 w-full h-1.5 rounded-full overflow-hidden ${dark ? "bg-white/[0.06]" : "bg-gray-200"}`}>
              <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${loadingProgress}%` }}></div>
            </div>
          )}

          {/* SSE Progress */}
          {isLoading && scannedFiles.length > 0 && (
            <ScanProgress files={scannedFiles} fileStatuses={fileStatuses}
              progress={loadingProgress} issuesFound={issuesFoundSoFar} eta={etaSeconds}
              cacheHits={cacheHits} cacheMisses={cacheMisses} onCancel={handleCancelScan} dark={dark} />
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
          )}
        </div>

        {/* ═══ RESULTS SECTION ═══ */}
        {showResults && scanResult && (
          <div className="animate-fade-in-up">
            {/* Results header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className={`text-2xl font-bold ${dark ? "text-white" : "text-gray-900"}`}>Scan Results</h2>
                <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-400"}`}>
                  {scanResult.files_scanned} files scanned • {scanResult.issues?.length || 0} issues found
                  {scanResult.scan_mode && ` • ${scanResult.scan_mode} mode`}
                  {scanResult.scan_duration && ` • ${scanResult.scan_duration.toFixed(1)}s`}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleExportJSON}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition border ${dark ? "border-white/10 text-gray-300 hover:bg-white/[0.06]" : "border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
                  📥 JSON
                </button>
              </div>
            </div>

            {/* Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className={`rounded-2xl border backdrop-blur-xl p-6 flex items-center justify-center ${card}`}>
                <ScoreGauge score={scanResult.overall_score || 0} dark={dark} />
              </div>
              <div className="space-y-4">
                <StatCard label="Issues Found" value={scanResult.issues?.length || 0} 
                  sub={`${severityCounts.Critical || 0} critical`} color="text-red-400" dark={dark} />
                <StatCard label="Files Scanned" value={scanResult.files_scanned || 0} dark={dark} />
              </div>
              <div className="space-y-4">
                <StatCard label="Code Complexity" value={scanResult.metrics?.code_complexity || "N/A"} dark={dark} />
                <StatCard label="Duplication" value={`${scanResult.metrics?.duplication_percentage || 0}%`} dark={dark} />
              </div>
              {/* Vulnerability chart */}
              <div className={`rounded-xl border backdrop-blur-xl p-4 ${card}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium ${dark ? "text-gray-400" : "text-gray-500"}`}>Distribution</span>
                  <div className="flex gap-1">
                    {["doughnut", "bar"].map(t => (
                      <button key={t} onClick={() => setChartType(t)}
                        className={`text-[10px] px-2 py-0.5 rounded ${chartType === t ? "bg-indigo-500/20 text-indigo-400" : dark ? "text-gray-400" : "text-gray-400"}`}>
                        {t === "doughnut" ? "🍩" : "📊"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-36">
                  {vulnChartData && (chartType === "doughnut"
                    ? <Doughnut ref={chartRef} data={vulnChartData} options={chartOpts} />
                    : <Bar data={vulnChartData} options={{ ...chartOpts, scales: { x: { ticks: { color: dark ? "#6b7280" : "#9ca3af" } }, y: { ticks: { color: dark ? "#6b7280" : "#9ca3af" } } } }} />
                  )}
                </div>
              </div>
            </div>

            {/* Priority Matrix (Day 4) */}
            {priorityItems.length > 0 && (
              <div className={`rounded-2xl border backdrop-blur-xl p-6 mb-8 ${card}`}>
                <h3 className={`text-lg font-bold mb-4 ${dark ? "text-white" : "text-gray-900"}`}>🎯 Fix This First</h3>
                <div className="space-y-2">
                  {priorityItems.slice(0, 5).map((item, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${dark ? "bg-white/[0.02]" : "bg-gray-50"}`}>
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        i === 0 ? "bg-red-500/20 text-red-400" : i === 1 ? "bg-orange-500/20 text-orange-400" : "bg-amber-500/20 text-amber-400"
                      }`}>#{i + 1}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: SEVERITY_COLORS[item.severity] }}>{item.severity}</span>
                      <span className={`flex-1 text-sm truncate ${dark ? "text-gray-300" : "text-gray-700"}`}>{item.description}</span>
                      {item.risk_score && <span className={`text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>Risk: {item.risk_score}</span>}
                      {item.effort?.label && (
                        <span className="px-2 py-0.5 rounded text-xs" style={{ color: item.effort.color, background: `${item.effort.color}15` }}>{item.effort.label}</span>
                      )}
                    </div>
                  ))}
                </div>
                {riskMatrix.total_estimated_hours && (
                  <p className={`mt-3 text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>
                    Estimated total fix time: <span className="font-semibold text-indigo-400">{riskMatrix.total_estimated_hours}h</span>
                  </p>
                )}
              </div>
            )}

            {/* Search & Filters */}
            <div className={`rounded-2xl border backdrop-blur-xl p-5 mb-6 ${card}`}>
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search issues..."
                    className={`w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                      dark ? "bg-white/[0.06] border border-white/[0.1] text-white placeholder-gray-400" : "bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400"
                    }`} />
                </div>
                {/* Severity filters */}
                <div className="flex gap-1.5 flex-wrap">
                  {["All", "Critical", "High", "Medium", "Low"].map(f => (
                    <button key={f} onClick={() => setActiveFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        activeFilter === f
                          ? `text-white ${f === "All" ? "bg-indigo-500" : ""}`
                          : dark ? "bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                      style={activeFilter === f && f !== "All" ? { background: SEVERITY_COLORS[f] } : {}}>
                      {f} {severityCounts[f] !== undefined ? `(${severityCounts[f]})` : ""}
                    </button>
                  ))}
                </div>
                {/* Sort */}
                <div className="flex gap-1">
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    className={`px-2 py-1.5 rounded-lg text-xs focus:outline-none ${
                      dark ? "bg-white/[0.06] border border-white/[0.1] text-gray-300" : "bg-gray-100 border border-gray-200 text-gray-600"
                    }`}>
                    <option value="severity">Severity</option>
                    <option value="risk">Risk</option>
                    <option value="file">File</option>
                    <option value="description">Name</option>
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
                  <IssueCard key={i} issue={issue} index={i} token={token} dark={dark} onShowToast={showToast} />
                ))
              ) : (
                <div className={`text-center py-10 rounded-xl border ${card}`}>
                  <p className={`text-lg ${dark ? "text-gray-400" : "text-gray-400"}`}>
                    {searchQuery ? `No issues matching "${searchQuery}"` : "No issues for this filter 🎉"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}