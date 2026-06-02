import { useState, useEffect, useCallback, useContext } from "react";
import { ThemeContext } from "../components/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Toast from "../components/Toast";
import axios from "axios";
import { generateProfessionalPDF } from "../utils/pdfGenerator";
import { exportToCSV } from "../utils/csvExporter";

const API = "http://localhost:5000";

const SCORE_COLOR = (s) => (s >= 80 ? "#22c55e" : s >= 60 ? "#f97316" : s >= 40 ? "#ef4444" : "#a855f7");

function generateJSON(scan) {
  const blob = new Blob([JSON.stringify(scan, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `scan-report-${scan.id || Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Reports() {
  const { dark } = useContext(ThemeContext);
  const { token, isAuthenticated } = useAuth();

  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState(null);
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });
  const showToast = useCallback((m, s = "info") => setToast({ open: true, message: m, severity: s }), []);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!isAuthenticated()) { setLoading(false); return; }
    axios
      .get(`${API}/api/scans`, { params: { limit: 20, offset: 0 }, headers })
      .then((r) => setScans(r.data.scans))
      .catch(() => showToast("Failed to load scans", "error"))
      .finally(() => setLoading(false));
  }, [token]);

  const fetchAndExport = async (scanId, format) => {
    try {
      const res = await axios.get(`${API}/api/scans/${scanId}`, { headers });
      const data = res.data;
      if (format === "pdf") generateProfessionalPDF(data, null);
      else if (format === "csv") exportToCSV(data);
      else generateJSON(data);
      showToast(`${format.toUpperCase()} exported!`, "success");
    } catch {
      showToast("Export failed", "error");
    }
  };

  const bg = dark
    ? "bg-gradient-to-b from-[#0a0b14] via-[#0f1121] to-[#0a0b14] text-white"
    : "bg-gradient-to-b from-gray-50 via-white to-gray-50 text-gray-900";
  const card = dark
    ? "backdrop-blur-2xl bg-gradient-to-b from-white/[0.1] to-white/[0.04] border-white/[0.12] shadow-2xl shadow-black/40"
    : "backdrop-blur-2xl bg-gradient-to-b from-white/95 to-white/80 border-gray-200/80 shadow-2xl shadow-gray-400/30";

  if (!isAuthenticated()) {
    return (
      <div className={`relative min-h-screen overflow-hidden ${bg}`}>
        {/* Background blobs */}
        <div className={`absolute -top-40 -left-40 w-[900px] h-[900px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-indigo-600/20" : "bg-indigo-400/10"}`} style={{animationDuration:'20s'}} />
        <div className={`absolute top-40 right-0 w-[800px] h-[800px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-purple-600/20" : "bg-purple-400/10"}`} style={{animationDuration:'25s', animationDelay:'3s'}} />
        <Navbar />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-20 text-center">
          <div className={`rounded-2xl border backdrop-blur-xl p-10 ${card}`}>
            <p className="text-5xl mb-4">🔐</p>
            <h2 className={`text-2xl font-bold mb-2 ${dark ? "text-white" : "text-gray-900"}`}>Login Required</h2>
            <p className={`${dark ? "text-gray-400" : "text-gray-500"}`}>Please login to export reports.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen overflow-hidden transition-colors duration-300 ${bg}`}>
      {/* Background blobs */}
      <div className={`absolute -top-40 -left-40 w-[900px] h-[900px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-indigo-600/20" : "bg-indigo-400/10"}`} style={{animationDuration:'20s'}} />
      <div className={`absolute top-40 right-0 w-[800px] h-[800px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-purple-600/20" : "bg-purple-400/10"}`} style={{animationDuration:'25s', animationDelay:'3s'}} />
      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-indigo-700/20" : "bg-indigo-500/8"}`} style={{animationDuration:'30s', animationDelay:'5s'}} />

      <Navbar />
      <Toast toast={toast} onClose={() => setToast((p) => ({ ...p, open: false }))} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6 page-enter">
          <span className="text-2xl">📄</span>
          <div>
            <h1 className={`text-2xl font-bold ${dark ? "text-white" : "text-gray-900"}`}>Reports & Export</h1>
            <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-400"}`}>Download scan results as PDF, CSV, or JSON</p>
          </div>
        </div>

        {/* Format info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: "📕", label: "PDF Report", desc: "Professional formatted report with charts and tables", color: "text-red-400" },
            { icon: "📊", label: "CSV Export", desc: "Spreadsheet-compatible data for analysis", color: "text-emerald-400" },
            { icon: "📦", label: "JSON Export", desc: "Machine-readable data for integrations", color: "text-blue-400" },
          ].map((f, i) => (
            <div key={i} className={`relative group rounded-xl border backdrop-blur-2xl p-5 shadow-2xl ${
              dark ? "bg-gradient-to-b from-white/[0.1] to-white/[0.04] border-white/[0.12] shadow-black/40" : "bg-gradient-to-b from-white/95 to-white/80 border-gray-200/80 shadow-gray-400/30"
            }`}>
              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-600/20 blur-2xl rounded-xl opacity-0 group-hover:opacity-100 transition duration-500 pointer-events-none" />
              <span className="text-2xl">{f.icon}</span>
              <h3 className={`font-semibold mt-2 ${f.color}`}>{f.label}</h3>
              <p className={`text-xs mt-1 ${dark ? "text-gray-400" : "text-gray-400"}`}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Scans Table */}
        <div className={`rounded-2xl border backdrop-blur-xl overflow-hidden ${card}`}>
          <div className="px-6 py-4 border-b" style={{ borderColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
            <h3 className={`font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Select a scan to export</h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin"></div>
            </div>
          ) : scans.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-2">📭</p>
              <p className={`${dark ? "text-gray-400" : "text-gray-400"}`}>No scans to export yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={dark ? "bg-white/[0.02]" : "bg-gray-50"}>
                    {["Date", "Source", "Score", "Issues", "Export"].map((h) => (
                      <th key={h} className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${dark ? "text-gray-400" : "text-gray-400"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => (
                    <tr key={scan.id} className={`border-t transition ${dark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-gray-100 hover:bg-gray-50"}`}>
                      <td className={`px-5 py-3 text-sm ${dark ? "text-gray-300" : "text-gray-600"}`}>{new Date(scan.created_at).toLocaleDateString()}</td>
                      <td className={`px-5 py-3 text-sm max-w-[200px] truncate ${dark ? "text-white" : "text-gray-900"}`}>{scan.source_identifier}</td>
                      <td className="px-5 py-3">
                        <span className="text-sm font-bold" style={{ color: SCORE_COLOR(scan.overall_score) }}>{scan.overall_score}</span>
                      </td>
                      <td className={`px-5 py-3 text-sm ${dark ? "text-gray-300" : "text-gray-600"}`}>{scan.issue_counts?.total || scan.issue_counts?.critical + scan.issue_counts?.high + scan.issue_counts?.medium + scan.issue_counts?.low || 0}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => fetchAndExport(scan.id, "pdf")}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">PDF</button>
                          <button onClick={() => fetchAndExport(scan.id, "csv")}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition">CSV</button>
                          <button onClick={() => fetchAndExport(scan.id, "json")}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">JSON</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}