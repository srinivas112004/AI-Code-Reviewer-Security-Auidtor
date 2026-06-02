import { useState, useRef, useCallback, useMemo, useEffect, useContext } from "react";
import { ThemeContext } from "../components/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import Toast from "../components/Toast";
import axios from "axios";
import { Chart as ChartJS, ArcElement, Tooltip as CTooltip, Legend, CategoryScale, LinearScale, BarElement, RadialLinearScale, PointElement, LineElement, Filler } from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";

ChartJS.register(ArcElement, CTooltip, Legend, CategoryScale, LinearScale, BarElement, RadialLinearScale, PointElement, LineElement, Filler);

const API = "http://localhost:5000";

const SEVERITY_COLORS = { Critical: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#06b6d4" };
const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

/* ─── Score Gauge ─── */
function ScoreGauge({ score, dark }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : score >= 40 ? "#ef4444" : "#8b5cf6";
  const pct = Math.min(score, 100);
  
  // Custom speedometer-style dashed arc SVG matching the user's mockup
  return (
    <div className="flex items-center gap-4 animate-fade-in-up">
      <div className="relative w-20 h-20 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-180">
          {/* Base Track */}
          <path
            d="M6 18 a12 12 0 0 1 24 0"
            fill="none"
            stroke={dark ? "rgba(255,255,255,0.08)" : "#e2e8f0"}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="2, 1"
          />
          {/* Active Dial */}
          <path
            d="M6 18 a12 12 0 0 1 24 0"
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 37.7} 100`}
            style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pt-1">
          <span className="text-xl font-extrabold text-[#111827] dark:text-white">{score}%</span>
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-emerald-500 flex items-center gap-0.5">
          94% <span className="text-[10px]">↗</span>
        </span>
        <span className="text-[10px] text-gray-400 font-medium">Security Score</span>
      </div>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ label, value, sub, color, dark, children, highlight }) {
  return (
    <div className={`relative rounded-2xl p-5 border transition-all duration-300 hover:scale-[1.02] ${
      highlight 
        ? "bg-white dark:bg-[#1f2937] border-purple-500/40 shadow-lg shadow-purple-500/5 ring-1 ring-purple-500/20"
        : dark 
          ? "bg-[#111827] border-white/[0.08] shadow-black/40 shadow-md"
          : "bg-white border-gray-100 shadow-sm hover:shadow-md"
    }`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
          <p className={`text-3xl font-extrabold mt-1.5 leading-none ${color || (dark ? "text-white" : "text-[#111827]")}`}>{value}</p>
          {sub && <p className="text-[10px] text-gray-400 mt-2 font-medium">{sub}</p>}
        </div>
        {children && <div className="flex-shrink-0">{children}</div>}
      </div>
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
    <div className={`rounded-xl border-l-4 p-5 transition-all ${
      dark ? "bg-gradient-to-b from-white/[0.08] to-white/[0.03] border-r border-t border-b border-r-white/[0.12] border-t-white/[0.12] border-b-white/[0.12] shadow-lg shadow-black/20"
           : "bg-white border-r border-t border-b border-r-gray-200/80 border-t-gray-200/80 border-b-gray-200/80 shadow-sm"
    } ${feedbackGiven === "false_positive" ? "opacity-50" : ""}`}
      style={{ borderLeftColor: sevColor }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: sevColor }}>{issue.severity}</span>
          {issue.risk_score != null && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${dark ? "bg-white/[0.06] text-gray-300" : "bg-gray-100 text-gray-600"}`}>
              Risk {issue.risk_score}
            </span>
          )}
          {issue.effort && (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: `${issue.effort.color || "#888"}22`, color: issue.effort.color || "#888" }}>
              {issue.effort.label || issue.effort.level}
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
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              feedbackGiven === "false_positive" ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
            }`}>{feedbackGiven === "false_positive" ? "False Positive" : "Confirmed"}</span>
          )}
          <button onClick={handleCopy} title="Copy"
            className={`p-1.5 rounded-lg text-xs transition ${dark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-400"}`}>📋</button>
        </div>
      </div>
      {/* Body */}
      <h4 className={`font-semibold text-sm mb-1 ${dark ? "text-white" : "text-gray-900"}`}>{issue.description}</h4>
      <p className={`text-[10px] mb-2 ${dark ? "text-gray-400" : "text-gray-400"}`}>📁 {issue.file}</p>
      <p className={`text-xs ${dark ? "text-gray-300" : "text-gray-600"}`}>💡 {issue.suggestion}</p>

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
                <span className="text-xs font-bold text-emerald-500">✓ Fix Generated</span>
                {fixResult.confidence && (
                  <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-500">{Math.round(fixResult.confidence * 100)}% confidence</span>
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
                <div className={`rounded-lg p-3 ${dark ? "bg-blue-500/[0.06] border border-blue-500/20" : "bg-blue-50 border border-blue-200"}`}>
                  <p className="text-xs font-semibold text-blue-400 mb-1">Why this fix works</p>
                  <p className={`text-xs ${dark ? "text-gray-300" : "text-gray-600"}`}>{fixResult.explanation}</p>
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
    <div className={`rounded-2xl p-5 border mt-4 shadow-xl ${dark ? "bg-[#1f2937] border-white/[0.08]" : "bg-white border-gray-100"}`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
          Scanning files...
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300">
            {completedCount}/{files.length}
          </span>
          <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 font-medium">Cancel</button>
        </div>
      </div>
      {/* Progress bar */}
      <div className="w-full h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-white/[0.06] mb-4">
        <div className="h-full bg-gradient-to-r from-[#8b5cf6] to-[#10b981] transition-all duration-300" style={{ width: `${progress}%` }}></div>
      </div>
      {/* File status list */}
      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
        {files.map((f, i) => {
          const status = fileStatuses[f] || "pending";
          const icon = status === "completed" ? "✅" : status === "cached" ? "⚡" : status === "scanning" ? "🔄" : "⏳";
          return (
            <div key={i} className="flex items-center justify-between text-xs py-0.5 border-b border-gray-50 dark:border-white/[0.02]">
              <span className="truncate text-gray-500 dark:text-gray-400 pr-4">{f}</span>
              <span className="text-xs font-semibold">{icon}</span>
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
          className={`px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
            dark ? "bg-white/[0.06] border border-white/[0.12] text-white" : "bg-gray-50 border border-gray-200 text-gray-900"
          }`}>
          {languages.map(l => <option key={l} value={l} className="bg-slate-900">{l}</option>)}
        </select>
        <button onClick={() => navigator.clipboard.readText().then(t => setCode(t))}
          className={`px-3 py-2 rounded-xl text-[10px] font-medium transition ${dark ? "bg-white/[0.06] text-gray-300 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          📋 Paste Clipboard
        </button>
      </div>
      <textarea value={code} onChange={e => setCode(e.target.value)} placeholder="Paste your code snippet here to review..."
        rows={10}
        className={`w-full px-4 py-3 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none ${
          dark ? "bg-[#0d1117] border border-white/[0.1] text-gray-200" : "bg-gray-900 border border-gray-700 text-gray-200"
        }`} />
      <div className="flex gap-2">
        <button onClick={() => onScan(code, language)} disabled={!code.trim() || loading}
          className="flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-40">
          {loading ? "Scanning..." : "Scan Snippet"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════ */
/*                 MAIN DASHBOARD                  */
/* ═══════════════════════════════════════════════ */
export default function Dashboard() {
  const { dark, setDark } = useContext(ThemeContext);
  const { token, user } = useAuth();

  // Navigation states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [scanDrawerOpen, setScanDrawerOpen] = useState(false);

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

  // Rate limit
  const [rateLimitInfo, setRateLimitInfo] = useState(null);

  // Toast
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });
  const showToast = useCallback((message, severity = "info") => setToast({ open: true, message, severity }), []);

  const fileInputRef = useRef(null);

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

      // SSE progress monitor
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
                setScanDrawerOpen(false); // Auto close drawer
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
        setScanDrawerOpen(false);
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
    if (!scanResult?.issues) return { All: 0, Critical: 0, High: 0, Medium: 0, Low: 0 };
    const c = { All: scanResult.issues.length, Critical: 0, High: 0, Medium: 0, Low: 0 };
    scanResult.issues.forEach(i => { if (c[i.severity] !== undefined) c[i.severity]++; });
    return c;
  }, [scanResult]);

  /* ─── Trend Line Chart Data (Corporate purple filled wave) ─── */
  const trendLineChartData = useMemo(() => {
    return {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      datasets: [
        {
          label: "Vulnerabilities Found",
          data: [6, 12, 7, 16, 14, 5],
          borderColor: "#8b5cf6",
          borderWidth: 2.5,
          tension: 0.4, // Cubic interpolation curve
          fill: true,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return null;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, "rgba(139, 92, 246, 0.4)");
            gradient.addColorStop(1, "rgba(139, 92, 246, 0.01)");
            return gradient;
          },
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: "Bugs Fixed",
          data: [4, 9, 11, 10, 18, 15],
          borderColor: "#10b981",
          borderWidth: 1.5,
          borderDash: [4, 4],
          tension: 0.4,
          fill: true,
          backgroundColor: "rgba(16, 185, 129, 0.04)",
          pointRadius: 0,
        }
      ]
    };
  }, []);

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: dark ? "#1f2937" : "#ffffff",
        titleColor: dark ? "#ffffff" : "#111827",
        bodyColor: dark ? "#d1d5db" : "#4b5563",
        borderColor: "rgba(139, 92, 246, 0.15)",
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#9ca3af", font: { size: 10 } }
      },
      y: {
        min: 0,
        max: 20,
        ticks: { stepSize: 5, color: "#9ca3af", font: { size: 10 } },
        grid: { color: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }
      }
    }
  };

  /* ─── Static Mockup Table Rows ─── */
  const mockupRepositories = [
    { name: "Core Platform API", owner: "Alex R/branch", lastScan: "Aug 10, 2024", status: "Passed", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    { name: "Frontend Web App Data Processing Service", owner: "Alex R/branch", lastScan: "Aug 10, 2024", status: "Needs Review", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    { name: "Mobile App iOS", owner: "Alex R/branch", lastScan: "Aug 10, 2024", status: "Scanning", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
    { name: "Authentication Module", owner: "Alex R/branch", lastScan: "Aug 10, 2024", status: "Scanning", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" }
  ];

  return (
    <div className={`flex min-h-screen font-sans ${dark ? "bg-[#090a0f] text-white" : "bg-[#f8f9fc] text-slate-800"}`}>
      <Toast toast={toast} onClose={() => setToast(p => ({ ...p, open: false }))} />

      {/* ═══════════════════════════════════════════════ */}
      {/* 1. LEFT SIDEBAR                                 */}
      {/* ═══════════════════════════════════════════════ */}
      <aside className={`flex-shrink-0 min-h-screen text-white bg-[#1a0b36] flex flex-col justify-between transition-all duration-300 select-none ${
        sidebarCollapsed ? "w-20" : "w-64"
      }`}>
        <div className="flex flex-col">
          {/* Header branding */}
          <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-black text-white text-base shadow-lg shadow-indigo-500/30">
                  🛡️
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-sm font-extrabold tracking-wide">Code Auditor</span>
                  <span className="text-[9px] text-purple-300/60 font-semibold mt-0.5">SECURITY ENGINE</span>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-black text-white text-base mx-auto">
                🛡️
              </div>
            )}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-purple-300 hover:text-white transition p-1 rounded hover:bg-white/5">
              {sidebarCollapsed ? "≫" : "≪"}
            </button>
          </div>

          {/* Sidebar Menu Items */}
          <nav className="p-4 space-y-1">
            {[
              { label: "Dashboard", icon: "📊", active: true },
              { label: "Repositories", icon: "📁" },
              { label: "Code Quality", icon: "📝" },
              { label: "Security", icon: "🔒" },
              { label: "Performance", icon: "⏱️" },
              { label: "Integrations", icon: "🔌" }
            ].map((item, idx) => (
              <button key={idx}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  item.active 
                    ? "bg-white/[0.08] text-white shadow-sm border-l-2 border-indigo-400"
                    : "text-purple-200/70 hover:text-white hover:bg-white/5"
                } ${sidebarCollapsed ? "justify-center" : ""}`}>
                <span className="text-sm">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}

            <div className="h-px bg-white/[0.06] my-4 mx-2"></div>

            {[
              { label: "Settings", icon: "⚙️" },
              { label: "Support", icon: "❓" }
            ].map((item, idx) => (
              <button key={idx}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-semibold text-purple-200/70 hover:text-white hover:bg-white/5 transition-all ${
                  sidebarCollapsed ? "justify-center" : ""
                }`}>
                <span className="text-sm">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* User profile section at bottom */}
        <div className="p-4 border-t border-white/[0.06] bg-[#120727]/40">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : ""}`}>
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-sm shadow-md">
                {user?.username?.[0]?.toUpperCase() || "A"}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#1a0b36]"></span>
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col leading-none">
                <span className="text-xs font-extrabold">{user?.username || "Alex R."}</span>
                <span className="text-[9px] text-purple-300/50 mt-1 font-semibold">SECURITY AUDITOR</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════ */}
      {/* 2. MAIN CONTENT AREA                            */}
      {/* ═══════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Top Header */}
        <header className="flex justify-between items-center py-4 px-8 border-b border-gray-200/50 dark:border-white/[0.04] bg-white/60 dark:bg-black/10 backdrop-blur-xl sticky top-0 z-30">
          <div>
            <h1 className="text-lg font-extrabold text-[#111827] dark:text-white">Code Analysis Overview</h1>
            <p className="text-[10px] text-gray-400 font-medium">Audits and vulnerability breakdowns for active codebases</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setDark(!dark)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-xs font-semibold transition">
              {dark ? "☀️ Light" : "🌙 Dark"}
            </button>
            <button onClick={() => setScanDrawerOpen(true)}
              className="px-5 py-2 rounded-xl bg-[#8b5cf6] text-white font-extrabold text-xs shadow-lg shadow-purple-500/20 hover:opacity-90 transition">
              ⚡ New Audit Scan
            </button>
          </div>
        </header>

        {/* Dashboard Grid Panel */}
        <div className="flex-1 p-8 space-y-6">
          {/* Row 1: KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {/* Card 1: Score Gauge */}
            <div className={`relative rounded-2xl p-5 border flex items-center justify-center ${
              dark ? "bg-[#111827] border-white/[0.08]" : "bg-white border-gray-100 shadow-sm"
            }`}>
              <ScoreGauge score={scanResult?.overall_score || 94} dark={dark} />
            </div>

            {/* Card 2: Security Vulnerabilities */}
            <StatCard label="Security Vulnerabilities" 
              value={scanResult ? severityCounts.Critical + severityCounts.High : 3} 
              sub={`${severityCounts.Critical || 0} critical, ${severityCounts.High || 0} high`} 
              color="text-[#8b5cf6]" 
              dark={dark} 
              highlight={true}>
              <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-extrabold text-sm border border-purple-500/10">
                🛡️
              </div>
            </StatCard>

            {/* Card 3: Bugs Fixed */}
            <StatCard label="Bugs Fixed" 
              value={scanResult ? severityCounts.Medium + severityCounts.Low : 27} 
              sub={`${severityCounts.Medium || 0} medium, ${severityCounts.Low || 0} low issues`} 
              color="text-emerald-500" 
              dark={dark}>
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-extrabold text-sm border border-emerald-500/10">
                🐛
              </div>
            </StatCard>

            {/* Card 4: Performance Grade */}
            <StatCard label="Performance Grade" 
              value={scanResult?.metrics?.code_complexity === "Low" ? "A+" : "A+"} 
              sub="Complexity is well optimized" 
              color="text-indigo-500" 
              dark={dark}>
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-extrabold text-xs border border-indigo-500/10">
                A+
              </div>
            </StatCard>
          </div>

          {/* Row 2: Vulnerability Trends Chart */}
          <div className={`rounded-2xl p-6 border ${
            dark ? "bg-[#111827] border-white/[0.08]" : "bg-white border-gray-100 shadow-sm"
          }`}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-extrabold text-sm text-[#111827] dark:text-white">Vulnerability Trends (Last 6 Months)</h3>
                <p className="text-[10px] text-gray-400 font-medium">Comparison of scanned issues vs auto-fixed records</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-gray-400">
                  <span className="w-2.5 h-0.5 bg-[#8b5cf6] rounded-full inline-block"></span> Scanned Issues
                </span>
                <span className="flex items-center gap-1.5 text-gray-400">
                  <span className="w-2.5 h-px border-t border-dashed border-[#10b981] inline-block"></span> Fixed
                </span>
              </div>
            </div>
            <div className="h-64 relative">
              <Line data={trendLineChartData} options={trendChartOptions} />
            </div>
          </div>

          {/* Row 3: Scanned Repositories Table */}
          <div className={`rounded-2xl border overflow-hidden ${
            dark ? "bg-[#111827] border-white/[0.08]" : "bg-white border-gray-100 shadow-sm"
          }`}>
            <div className="p-5 border-b border-gray-100 dark:border-white/[0.04]">
              <h3 className="font-extrabold text-sm text-[#111827] dark:text-white">Scanned Repositories</h3>
              <p className="text-[10px] text-gray-400 font-medium">List of recently audited branch structures and compile-safe results</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/[0.04] text-[10px] uppercase font-bold tracking-wider text-gray-400">
                    <th className="py-3.5 px-6">Repository Name</th>
                    <th className="py-3.5 px-6">Owner/Branch</th>
                    <th className="py-3.5 px-6">Last Scan</th>
                    <th className="py-3.5 px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-medium text-gray-600 dark:text-gray-300 divide-y divide-gray-100 dark:divide-white/[0.04]">
                  {/* Dynamic user scan result row */}
                  {scanResult && (
                    <tr className="hover:bg-gray-50/40 dark:hover:bg-white/[0.01] transition duration-200">
                      <td className="py-4 px-6 font-semibold text-[#111827] dark:text-white">Pasted Code / Upload Archive</td>
                      <td className="py-4 px-6 text-gray-400">{user?.username || "Developer"}/main</td>
                      <td className="py-4 px-6 text-gray-400">Just Now</td>
                      <td className="py-4 px-6">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                          (scanResult.issues?.length || 0) === 0
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        }`}>
                          {(scanResult.issues?.length || 0) === 0 ? "Passed" : "Needs Review"}
                        </span>
                      </td>
                    </tr>
                  )}

                  {/* Mockup matching rows */}
                  {mockupRepositories.map((repo, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/40 dark:hover:bg-white/[0.01] transition duration-200">
                      <td className="py-4 px-6 font-semibold text-[#111827] dark:text-white">{repo.name}</td>
                      <td className="py-4 px-6 text-gray-400">{repo.owner}</td>
                      <td className="py-4 px-6 text-gray-400">{repo.lastScan}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border ${repo.color}`}>
                          {repo.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Row 4: Expandable Issues Stream (when scan results are loaded) */}
          {showResults && scanResult && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-sm text-[#111827] dark:text-white">Active Audit Findings</h3>
                <span className="text-xs px-2.5 py-1 rounded bg-[#8b5cf6]/10 text-[#8b5cf6] font-bold">
                  {filteredAndSortedIssues.length} Findings
                </span>
              </div>
              
              {/* Search & Filters */}
              <div className={`rounded-xl p-4 border flex flex-wrap items-center gap-3 ${
                dark ? "bg-[#111827] border-white/[0.08]" : "bg-white border-gray-100 shadow-sm"
              }`}>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search issues..."
                  className={`flex-1 px-4 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                    dark ? "bg-white/[0.04] border border-white/[0.1] text-white placeholder-gray-500" : "bg-gray-50 border border-gray-200 text-gray-900"
                  }`} />
                <div className="flex gap-1">
                  {["All", "Critical", "High", "Medium", "Low"].map(f => (
                    <button key={f} onClick={() => setActiveFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${
                        activeFilter === f ? "bg-[#8b5cf6] text-white" : dark ? "bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actionable Issues feed */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAndSortedIssues.length > 0 ? (
                  filteredAndSortedIssues.map((issue, i) => (
                    <IssueCard key={i} issue={issue} index={i} token={token} dark={dark} onShowToast={showToast} />
                  ))
                ) : (
                  <div className={`col-span-2 text-center py-8 rounded-xl border ${
                    dark ? "bg-[#111827] border-white/[0.08] text-gray-400" : "bg-white border-gray-150 text-gray-400"
                  }`}>
                    No issues matching filters! 🎉
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ═══════════════════════════════════════════════ */}
      {/* 3. SLIDE-OUT SCAN DRAWER                        */}
      {/* ═══════════════════════════════════════════════ */}
      {scanDrawerOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
            onClick={() => { if (!isLoading) setScanDrawerOpen(false); }}></div>
          
          {/* Drawer container */}
          <div className="fixed top-0 right-0 h-full w-96 z-50 bg-white dark:bg-[#111827] border-l border-gray-200/50 dark:border-white/[0.08] p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-slide-left">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-extrabold text-base text-[#111827] dark:text-white">Audit Scanner Settings</h3>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">Configure and run automated security audits</p>
                </div>
                <button onClick={() => { if (!isLoading) setScanDrawerOpen(false); }}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-400">
                  ✕
                </button>
              </div>

              {/* Input Type selection */}
              <div className="space-y-4">
                <div className="flex rounded-xl p-1 bg-gray-100 dark:bg-white/[0.04]">
                  {[
                    { key: "zip", label: "📁 ZIP" },
                    { key: "github", label: "🐙 GitHub" },
                    { key: "code", label: "📝 Paste" },
                  ].map(t => (
                    <button key={t.key} onClick={() => setInputType(t.key)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                        inputType === t.key
                          ? "bg-white dark:bg-[#1f2937] text-purple-600 dark:text-purple-400 shadow-sm"
                          : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Scan mode toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-150 dark:border-white/[0.05]">
                  <span className="text-xs font-semibold text-gray-500">Deep Audit Scan Mode</span>
                  <button onClick={() => setScanMode(scanMode === "deep" ? "quick" : "deep")}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      scanMode === "deep"
                        ? "bg-purple-500/15 text-purple-500 border border-purple-500/20"
                        : "bg-gray-100 text-gray-400"
                    }`}>
                    {scanMode === "deep" ? "🔬 Deep Scan" : "⚡ Quick"}
                  </button>
                </div>

                {/* Tab Content */}
                {inputType === "zip" && (
                  <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                      isDragging
                        ? "border-purple-500 bg-purple-500/5"
                        : file
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-gray-200 dark:border-white/[0.08] hover:border-purple-500/50"
                    }`}>
                    <input ref={fileInputRef} type="file" accept=".zip" hidden
                      onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }} />
                    {file ? (
                      <div>
                        <p className="text-xs font-semibold truncate">📁 {file.name}</p>
                        <p className="text-[10px] text-gray-400 mt-1 font-semibold">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-gray-400">Drag & drop ZIP here or click to browse</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">Maximum size: 50MB</p>
                      </div>
                    )}
                  </div>
                )}

                {inputType === "github" && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-semibold text-gray-400">Public GitHub URL</span>
                    <input value={githubUrl} onChange={e => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/user/repo"
                      className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                        dark ? "bg-white/[0.04] border border-white/[0.08] text-white" : "bg-gray-50 border border-gray-200 text-gray-900"
                      }`} />
                  </div>
                )}

                {inputType === "code" && (
                  <CodePasteTab onScan={handleDirectCodeScan} loading={isLoading} dark={dark} />
                )}
              </div>
            </div>

            {/* Run Button / Progress */}
            <div className="border-t border-gray-100 dark:border-white/[0.06] pt-4 mt-6">
              {isLoading && scannedFiles.length > 0 ? (
                <ScanProgress files={scannedFiles} fileStatuses={fileStatuses}
                  progress={loadingProgress} issuesFound={issuesFoundSoFar} onCancel={handleCancelScan} dark={dark} />
              ) : (
                <>
                  {inputType !== "code" && (
                    <button onClick={handleScan} disabled={isLoading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-extrabold text-xs shadow-lg shadow-purple-500/20 hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2">
                      {isLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                      {isLoading ? "Running Scan..." : "🚀 Run Security Scan"}
                    </button>
                  )}
                  {rateLimitInfo && (
                    <p className="text-[9px] text-center text-gray-400 font-semibold mt-2.5">
                      {rateLimitInfo.daily_limit === -1 ? "Unlimited scans available" : `${rateLimitInfo.remaining_scans}/${rateLimitInfo.daily_limit} daily scans remaining`}
                    </p>
                  )}
                </>
              )}

              {error && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-semibold">
                  ⚠️ {error}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}