import { useState, useEffect, useCallback, useContext } from "react";
import { ThemeContext } from "../components/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Toast from "../components/Toast";
import axios from "axios";

const API = "http://localhost:5000";

const SCORE_COLOR = (s) => (s >= 80 ? "#22c55e" : s >= 60 ? "#f97316" : s >= 40 ? "#ef4444" : "#a855f7");

export default function ScanHistory() {
  const { dark } = useContext(ThemeContext);
  const { token, isAuthenticated } = useAuth();

  const [scans, setScans] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedScan, setSelectedScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [page, setPage] = useState(0);
  const [totalScans, setTotalScans] = useState(0);
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });
  const showToast = useCallback((message, severity = "info") => setToast({ open: true, message, severity }), []);

  const pageSize = 10;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isAuthenticated()) {
      fetchScans();
      fetchAnalytics();
    } else {
      setLoading(false);
    }
  }, [token, page]);

  const fetchScans = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/scans`, { params: { limit: pageSize, offset: page * pageSize }, headers });
      setScans(res.data.scans);
      setTotalScans(res.data.total);
    } catch (err) {
      setError(err.response?.status === 401 ? "Please login to view scan history" : "Failed to fetch history");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/api/analytics/overview`, { headers });
      setAnalytics(res.data);
    } catch {}
  };

  const fetchScanDetails = async (id) => {
    try {
      const res = await axios.get(`${API}/api/scans/${id}`, { headers });
      setSelectedScan(res.data);
      setShowDetails(true);
    } catch {
      showToast("Failed to load details", "error");
    }
  };

  const deleteScan = async (id) => {
    if (!window.confirm("Delete this scan?")) return;
    try {
      await axios.delete(`${API}/api/scans/${id}`, { headers });
      showToast("Scan deleted", "success");
      fetchScans();
      fetchAnalytics();
    } catch {
      showToast("Delete failed", "error");
    }
  };

  const bg = dark
    ? "bg-gradient-to-b from-[#0a0b14] via-[#0f1121] to-[#0a0b14] text-white"
    : "bg-gradient-to-b from-gray-50 via-white to-gray-50 text-gray-900";

  const card = dark
    ? "backdrop-blur-2xl bg-gradient-to-b from-white/[0.1] to-white/[0.04] border-white/[0.12] shadow-2xl shadow-black/40"
    : "backdrop-blur-2xl bg-gradient-to-b from-white/95 to-white/80 border-gray-200/80 shadow-2xl shadow-gray-400/20";

  if (!isAuthenticated()) {
    return (
        <div className={`relative min-h-screen overflow-hidden ${bg}`}>
        {/* Background blobs */}
        <div className={`absolute -top-40 -left-40 w-[900px] h-[900px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-indigo-600/20" : "bg-indigo-400/8"}`} style={{animationDuration:'20s'}} />
        <div className={`absolute top-40 right-0 w-[800px] h-[800px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-purple-600/20" : "bg-purple-400/8"}`} style={{animationDuration:'25s', animationDelay:'3s'}} />
        <Navbar />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-20 text-center">
          <div className={`rounded-2xl border backdrop-blur-xl p-10 ${card}`}>
            <p className="text-5xl mb-4">🔐</p>
            <h2 className={`text-2xl font-bold mb-2 ${dark ? "text-white" : "text-gray-900"}`}>Login Required</h2>
            <p className={`${dark ? "text-gray-400" : "text-gray-500"}`}>Please login to view your scan history.</p>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (d) => new Date(d).toLocaleString();

  return (
    <div className={`relative min-h-screen overflow-hidden transition-colors duration-300 ${bg}`}>
      {/* Background blobs */}
      <div className={`absolute -top-40 -left-40 w-[900px] h-[900px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-indigo-600/20" : "bg-indigo-400/8"}`} style={{animationDuration:'20s'}} />
      <div className={`absolute top-40 right-0 w-[800px] h-[800px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-purple-600/20" : "bg-purple-400/8"}`} style={{animationDuration:'25s', animationDelay:'3s'}} />
      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-pink-700/15" : "bg-pink-400/5"}`} style={{animationDuration:'30s', animationDelay:'6s'}} />

      <Navbar />
      <Toast toast={toast} onClose={() => setToast((p) => ({ ...p, open: false }))} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter">
        <h1 className={`text-2xl font-bold mb-6 ${dark ? "text-white" : "text-gray-900"}`}>Scan History & <span class="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Analytics</span></h1>

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
            {[
              { icon: "📊", label: "Total Scans", value: analytics.total_scans, sub: `${analytics.recent_scans_count || 0} in last 30 days` },
              { icon: "🎯", label: "Avg Score", value: analytics.average_score, color: SCORE_COLOR(analytics.average_score) },
              { icon: "🐛", label: "Total Issues", value: analytics.total_issues_found, sub: "across all scans" },
              { icon: "📁", label: "Files Analyzed", value: analytics.total_files_scanned || "—", sub: "cumulative" },
            ].map((s, i) => (
              <div key={i} className={`relative group rounded-xl border backdrop-blur-2xl p-5 transition-all duration-300 hover:-translate-y-1 shadow-2xl animate-fade-in-up ${
                dark ? "bg-gradient-to-b from-white/[0.1] to-white/[0.04] border-white/[0.12] shadow-black/40 hover:border-white/[0.18]" : "bg-gradient-to-b from-white/95 to-white/80 border-gray-200/80 shadow-gray-400/20 hover:shadow-gray-400/30"
              }`}>
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <p className="text-2xl mb-1">{s.icon}</p>
                <p className={`text-xs font-medium uppercase tracking-wider ${dark ? "text-gray-400" : "text-gray-400"}`}>{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color ? "" : dark ? "text-white" : "text-gray-900"}`} style={s.color ? { color: s.color } : {}}>
                  {s.value}
                </p>
                {s.sub && <p className={`text-xs mt-1 ${dark ? "text-gray-400" : "text-gray-400"}`}>{s.sub}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

        {/* Scans Table */}
        <div className={`rounded-2xl border backdrop-blur-xl overflow-hidden ${card}`}>
          <div className="px-6 py-4 border-b" style={{ borderColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
            <h3 className={`font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Recent Scans</h3>
          </div>

          {loading && scans.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin"></div>
            </div>
          ) : scans.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-2">📭</p>
              <p className={`${dark ? "text-gray-400" : "text-gray-400"}`}>No scans yet. Run your first scan!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={dark ? "bg-white/[0.02]" : "bg-gray-50"}>
                    {["Date", "Source", "Type", "Score", "Issues", "Actions"].map((h) => (
                      <th key={h} className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                        dark ? "text-gray-400" : "text-gray-400"
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => (
                    <tr key={scan.id} className={`border-t transition-all duration-200 ${dark ? "border-white/[0.04] hover:bg-white/[0.03]" : "border-gray-100 hover:bg-indigo-50/30"}`}>
                      <td className={`px-5 py-3 text-sm ${dark ? "text-gray-300" : "text-gray-600"}`}>{formatDate(scan.created_at)}</td>
                      <td className={`px-5 py-3 text-sm max-w-[200px] truncate ${dark ? "text-white" : "text-gray-900"}`}>{scan.source_identifier}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          scan.scan_type === "github" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        }`}>{scan.scan_type?.toUpperCase()}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-12 h-1.5 rounded-full overflow-hidden ${dark ? "bg-white/[0.06]" : "bg-gray-200"}`}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${scan.overall_score}%`, background: SCORE_COLOR(scan.overall_score) }}></div>
                          </div>
                          <span className="text-sm font-bold" style={{ color: SCORE_COLOR(scan.overall_score) }}>{scan.overall_score}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          {scan.issue_counts?.critical > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">{scan.issue_counts.critical}C</span>}
                          {scan.issue_counts?.high > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400">{scan.issue_counts.high}H</span>}
                          {scan.issue_counts?.medium > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400">{scan.issue_counts.medium}M</span>}
                          {scan.issue_counts?.low > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400">{scan.issue_counts.low}L</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => fetchScanDetails(scan.id)} title="View"
                            className={`p-1.5 rounded-lg transition ${dark ? "hover:bg-indigo-500/10 text-gray-500 hover:text-indigo-400" : "hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"}`}>👁️</button>
                          <button onClick={() => deleteScan(scan.id)} title="Delete"
                            className={`p-1.5 rounded-lg transition ${dark ? "hover:bg-red-500/10 text-gray-500 hover:text-red-400" : "hover:bg-red-50 text-gray-400 hover:text-red-500"}`}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalScans > 0 && (
            <div className={`flex items-center justify-between px-6 py-3 border-t ${dark ? "border-white/[0.06]" : "border-gray-100"}`}>
              <span className={`text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalScans)} of {totalScans}
              </span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(page - 1)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-30 ${
                    dark ? "bg-white/[0.06] text-gray-300 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>← Previous</button>
                <button disabled={(page + 1) * pageSize >= totalScans} onClick={() => setPage(page + 1)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-30 ${
                    dark ? "bg-white/[0.06] text-gray-300 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>Next →</button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {showDetails && selectedScan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDetails(false)}>
            <div onClick={(e) => e.stopPropagation()}
              className={`rounded-2xl border backdrop-blur-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 mx-4 animate-fade-in-up shadow-2xl ${
                dark ? "bg-slate-950/95 border-white/[0.1]" : "bg-white/95 border-gray-200 shadow-xl"
              }`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-bold ${dark ? "text-white" : "text-gray-900"}`}>Scan Details</h3>
                <button onClick={() => setShowDetails(false)}
                  className={`p-2 rounded-lg transition ${dark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>✕</button>
              </div>

              {/* Scan info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className={`text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>Source</p>
                  <p className={`text-sm font-medium ${dark ? "text-white" : "text-gray-900"}`}>{selectedScan.source_identifier}</p>
                </div>
                <div>
                  <p className={`text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>Score</p>
                  <p className="text-2xl font-bold" style={{ color: SCORE_COLOR(selectedScan.overall_score) }}>{selectedScan.overall_score}</p>
                </div>
              </div>

              {/* Issues list */}
              <h4 className={`text-sm font-semibold mb-3 ${dark ? "text-white" : "text-gray-900"}`}>
                Issues ({selectedScan.issues?.length || 0})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedScan.issues?.length > 0 ? selectedScan.issues.map((issue, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${dark ? "bg-white/[0.03]" : "bg-gray-50"}`}>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold text-white shrink-0 ${
                      issue.severity === "Critical" ? "bg-red-500" : issue.severity === "High" ? "bg-orange-500" : issue.severity === "Medium" ? "bg-yellow-500" : "bg-cyan-500"
                    }`}>{issue.severity}</span>
                    <div className="min-w-0">
                      <p className={`text-sm ${dark ? "text-gray-200" : "text-gray-700"}`}>{issue.description}</p>
                      {issue.file && <p className={`text-xs mt-0.5 ${dark ? "text-gray-400" : "text-gray-400"}`}>📁 {issue.file}</p>}
                    </div>
                  </div>
                )) : (
                  <p className={`text-center py-6 ${dark ? "text-gray-400" : "text-gray-400"}`}>No issues found 🎉</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
