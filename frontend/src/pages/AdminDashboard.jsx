import { useState, useEffect, useCallback, useContext } from "react";
import { ThemeContext } from "../components/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Toast from "../components/Toast";
import axios from "axios";
import { Chart as ChartJS, ArcElement, Tooltip as CTooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler } from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, CTooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

const API = "http://localhost:5000/api";

const SCORE_COLOR = (s) => (s >= 80 ? "#22c55e" : s >= 60 ? "#f97316" : s >= 40 ? "#ef4444" : "#a855f7");

export default function AdminDashboard() {
  const { dark } = useContext(ThemeContext);
  const { user, token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [dashboardData, setDashboardData] = useState(null);
  const [users, setUsers] = useState([]);
  const [scans, setScans] = useState([]);
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });
  const showToast = useCallback((m, s = "info") => setToast({ open: true, message: m, severity: s }), []);

  // Edit user
  const [editDialog, setEditDialog] = useState({ open: false, user: null });
  const [editForm, setEditForm] = useState({ is_admin: false, is_active: true });
  // Delete user
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dRes, uRes, sRes] = await Promise.all([
        axios.get(`${API}/admin/dashboard`, { headers }),
        axios.get(`${API}/admin/users`, { headers }),
        axios.get(`${API}/admin/all-scans?limit=50`, { headers }),
      ]);
      setDashboardData(dRes.data);
      setUsers(uRes.data.users);
      setScans(sRes.data.scans);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [token]);

  const handleEditUser = (u) => {
    setEditForm({ is_admin: u.is_admin, is_active: u.is_active });
    setEditDialog({ open: true, user: u });
  };

  const handleSaveUser = async () => {
    try {
      await axios.put(`${API}/admin/users/${editDialog.user.id}`, editForm, { headers });
      setEditDialog({ open: false, user: null });
      showToast("User updated", "success");
      fetchAll();
    } catch (err) {
      showToast(err.response?.data?.error || "Update failed", "error");
    }
  };

  const handleDeleteUser = async () => {
    try {
      await axios.delete(`${API}/admin/users/${deleteDialog.user.id}`, { headers });
      setDeleteDialog({ open: false, user: null });
      showToast("User deleted", "success");
      fetchAll();
    } catch (err) {
      showToast(err.response?.data?.error || "Delete failed", "error");
    }
  };

  const bg = dark
    ? "bg-gradient-to-b from-[#0a0b14] via-[#0f1121] to-[#0a0b14] text-white"
    : "bg-gradient-to-b from-gray-50 via-white to-gray-50 text-gray-900";
  const card = dark
    ? "backdrop-blur-2xl bg-gradient-to-b from-white/[0.1] to-white/[0.04] border-white/[0.12] shadow-2xl shadow-black/40"
    : "backdrop-blur-2xl bg-gradient-to-b from-white/95 to-white/80 border-gray-200/80 shadow-2xl shadow-gray-400/30";

  // Charts
  const lineData = {
    labels: dashboardData?.scans?.per_day?.map((d) => d.date?.slice(5)) || [],
    datasets: [{
      label: "Scans",
      data: dashboardData?.scans?.per_day?.map((d) => d.count) || [],
      borderColor: "#818cf8",
      backgroundColor: dark ? "rgba(129,140,248,0.1)" : "rgba(129,140,248,0.15)",
      fill: true, tension: 0.4, pointRadius: 3,
    }],
  };

  const doughData = {
    labels: ["Critical", "High", "Medium", "Low"],
    datasets: [{
      data: [
        dashboardData?.issues?.critical || 0,
        dashboardData?.issues?.high || 0,
        dashboardData?.issues?.total ? Math.floor(dashboardData.issues.total * 0.3) : 0,
        dashboardData?.issues?.total ? Math.floor(dashboardData.issues.total * 0.2) : 0,
      ],
      backgroundColor: ["#ef444480", "#f9731680", "#eab30880", "#06b6d480"],
      borderColor: ["#ef4444", "#f97316", "#eab308", "#06b6d4"],
      borderWidth: 2,
    }],
  };

  const lineOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: dark ? "#6b7280" : "#9ca3af" } } },
    scales: {
      x: { ticks: { color: dark ? "#4b5563" : "#9ca3af" }, grid: { color: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" } },
      y: { ticks: { color: dark ? "#4b5563" : "#9ca3af" }, grid: { color: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" } },
    },
  };

  const doughOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "bottom", labels: { color: dark ? "#6b7280" : "#9ca3af", font: { size: 11 } } } },
  };

  if (loading) {
    return (
      <div className={`relative min-h-screen overflow-hidden ${bg}`}>
        {/* Background blobs */}
        <div className={`absolute -top-40 -left-40 w-[900px] h-[900px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-indigo-600/20" : "bg-indigo-400/10"}`} style={{animationDuration:'20s'}} />
        <div className={`absolute top-40 right-0 w-[800px] h-[800px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-purple-600/20" : "bg-purple-400/10"}`} style={{animationDuration:'25s', animationDelay:'3s'}} />
        <Navbar />
        <div className="relative z-10 flex items-center justify-center py-32">
          <div className="w-10 h-10 border-4 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "overview", label: "📊 Overview" },
    { key: "users", label: "👥 Users" },
    { key: "scans", label: "🔒 Scans" },
  ];

  return (
    <div className={`relative min-h-screen overflow-hidden transition-colors duration-300 ${bg}`}>
      {/* Background blobs */}
      <div className={`absolute -top-40 -left-40 w-[900px] h-[900px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-indigo-600/20" : "bg-indigo-400/10"}`} style={{animationDuration:'20s'}} />
      <div className={`absolute top-40 right-0 w-[800px] h-[800px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-purple-600/20" : "bg-purple-400/10"}`} style={{animationDuration:'25s', animationDelay:'3s'}} />
      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-indigo-700/20" : "bg-indigo-500/8"}`} style={{animationDuration:'30s', animationDelay:'6s'}} />

      <Navbar />
      <Toast toast={toast} onClose={() => setToast((p) => ({ ...p, open: false }))} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-2xl font-bold ${dark ? "text-white" : "text-gray-900"}`}>Admin Dashboard</h1>
            <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-400"}`}>Welcome back, {user?.username}</p>
          </div>
          <button onClick={fetchAll}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition border ${
              dark ? "border-white/10 text-gray-300 hover:bg-white/[0.06]" : "border-gray-200 text-gray-600 hover:bg-gray-100"
            }`}>🔄 Refresh</button>
        </div>

        {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: "👥", label: "Total Users", value: dashboardData?.users?.total || 0, sub: `${dashboardData?.users?.new_this_week || 0} new this week`, color: "text-indigo-400" },
            { icon: "🔒", label: "Total Scans", value: dashboardData?.scans?.total || 0, sub: `${dashboardData?.scans?.this_week || 0} this week`, color: "text-cyan-400" },
            { icon: "🎯", label: "Avg Score", value: dashboardData?.scans?.average_score || 0, sub: "overall average", color: "text-emerald-400" },
            { icon: "🐛", label: "Critical Issues", value: dashboardData?.issues?.critical || 0, sub: `${dashboardData?.issues?.total || 0} total`, color: "text-red-400" },
          ].map((s, i) => (
            <div key={i} className={`relative group rounded-xl border backdrop-blur-2xl p-5 transition-all hover:scale-[1.02] shadow-2xl ${
              dark ? "bg-gradient-to-b from-white/[0.1] to-white/[0.04] border-white/[0.12] shadow-black/40" : "bg-gradient-to-b from-white/95 to-white/80 border-gray-200/80 shadow-gray-400/30"
            }`}>
              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-600/20 blur-2xl rounded-xl opacity-0 group-hover:opacity-100 transition duration-500 pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{s.icon}</span>
              </div>
              <p className={`text-xs font-medium uppercase tracking-wider ${dark ? "text-gray-400" : "text-gray-400"}`}>{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              {s.sub && <p className={`text-xs mt-1 ${dark ? "text-gray-400" : "text-gray-400"}`}>{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className={`flex rounded-xl p-1 mb-6 w-fit ${dark ? "bg-white/[0.04]" : "bg-gray-100"}`}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === t.key
                  ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-400 shadow-sm"
                  : dark ? "text-gray-500 hover:text-gray-300" : "text-gray-500 hover:text-gray-800"
              }`}>{t.label}</button>
          ))}
        </div>

        {/* ═══ Overview Tab ═══ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Line chart */}
              <div className={`lg:col-span-2 rounded-2xl border backdrop-blur-xl p-6 ${card}`}>
                <h3 className={`font-semibold mb-4 ${dark ? "text-white" : "text-gray-900"}`}>Scans Per Day (Last 7 Days)</h3>
                <div className="h-64">
                  <Line data={lineData} options={lineOpts} />
                </div>
              </div>
              {/* Doughnut */}
              <div className={`rounded-2xl border backdrop-blur-xl p-6 ${card}`}>
                <h3 className={`font-semibold mb-4 ${dark ? "text-white" : "text-gray-900"}`}>Issue Distribution</h3>
                <div className="h-64">
                  <Doughnut data={doughData} options={doughOpts} />
                </div>
              </div>
            </div>

            {/* Recent scans table */}
            <div className={`rounded-2xl border backdrop-blur-xl overflow-hidden ${card}`}>
              <div className="px-6 py-4 border-b" style={{ borderColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
                <h3 className={`font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Recent Scans</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={dark ? "bg-white/[0.02]" : "bg-gray-50"}>
                      {["Source", "Type", "Score", "Issues", "Date"].map((h) => (
                        <th key={h} className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${dark ? "text-gray-400" : "text-gray-400"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData?.recent_scans?.slice(0, 5).map((scan) => (
                      <tr key={scan.id} className={`border-t ${dark ? "border-white/[0.04]" : "border-gray-100"}`}>
                        <td className={`px-5 py-3 text-sm max-w-[200px] truncate ${dark ? "text-white" : "text-gray-900"}`}>{scan.source_identifier?.substring(0, 40)}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            scan.scan_type === "github" ? "bg-purple-500/10 text-purple-400" : "bg-indigo-500/10 text-indigo-400"
                          }`}>{scan.scan_type}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-12 h-1.5 rounded-full overflow-hidden ${dark ? "bg-white/[0.06]" : "bg-gray-200"}`}>
                              <div className="h-full rounded-full" style={{ width: `${scan.overall_score}%`, background: SCORE_COLOR(scan.overall_score) }}></div>
                            </div>
                            <span className="text-xs font-bold" style={{ color: SCORE_COLOR(scan.overall_score) }}>{scan.overall_score}</span>
                          </div>
                        </td>
                        <td className={`px-5 py-3 text-sm ${dark ? "text-gray-300" : "text-gray-600"}`}>{scan.issue_counts?.total || 0}</td>
                        <td className={`px-5 py-3 text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>{new Date(scan.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Users Tab ═══ */}
        {activeTab === "users" && (
          <div className={`rounded-2xl border backdrop-blur-xl overflow-hidden ${card}`}>
            <div className="px-6 py-4 border-b" style={{ borderColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
              <h3 className={`font-semibold ${dark ? "text-white" : "text-gray-900"}`}>User Management ({users.length} users)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={dark ? "bg-white/[0.02]" : "bg-gray-50"}>
                    {["User", "Email", "Role", "Status", "Scans", "Joined", "Actions"].map((h) => (
                      <th key={h} className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${dark ? "text-gray-400" : "text-gray-400"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={`border-t transition ${dark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-gray-100 hover:bg-gray-50"}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                            {u.username?.charAt(0).toUpperCase()}
                          </div>
                          <span className={`text-sm font-medium ${dark ? "text-white" : "text-gray-900"}`}>{u.username}</span>
                        </div>
                      </td>
                      <td className={`px-5 py-3 text-sm ${dark ? "text-gray-400" : "text-gray-500"}`}>{u.email}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          u.is_admin ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        }`}>{u.is_admin ? "👑 Admin" : "👤 User"}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          u.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        }`}>{u.is_active ? "Active" : "Inactive"}</span>
                      </td>
                      <td className={`px-5 py-3 text-sm font-medium ${dark ? "text-white" : "text-gray-900"}`}>{u.total_scans}</td>
                      <td className={`px-5 py-3 text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => handleEditUser(u)} title="Edit"
                            className={`p-1.5 rounded-lg transition ${dark ? "hover:bg-indigo-500/10 text-gray-500 hover:text-indigo-400" : "hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"}`}>✏️</button>
                          {u.id !== user?.id && (
                            <button onClick={() => setDeleteDialog({ open: true, user: u })} title="Delete"
                              className={`p-1.5 rounded-lg transition ${dark ? "hover:bg-red-500/10 text-gray-500 hover:text-red-400" : "hover:bg-red-50 text-gray-400 hover:text-red-500"}`}>🗑️</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ Scans Tab ═══ */}
        {activeTab === "scans" && (
          <div className={`rounded-2xl border backdrop-blur-xl overflow-hidden ${card}`}>
            <div className="px-6 py-4 border-b" style={{ borderColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
              <h3 className={`font-semibold ${dark ? "text-white" : "text-gray-900"}`}>All Scans ({scans.length})</h3>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className={dark ? "bg-[#0f1121]" : "bg-gray-50"}>
                    {["ID", "Source", "Type", "Score", "Issues", "Files", "Duration", "Date"].map((h) => (
                      <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${dark ? "text-gray-400" : "text-gray-400"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => (
                    <tr key={scan.id} className={`border-t transition ${dark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-gray-100 hover:bg-gray-50"}`}>
                      <td className={`px-4 py-3 text-sm font-mono ${dark ? "text-gray-400" : "text-gray-500"}`}>#{scan.id}</td>
                      <td className={`px-4 py-3 text-sm max-w-[180px] truncate ${dark ? "text-white" : "text-gray-900"}`} title={scan.source_identifier}>{scan.source_identifier}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          scan.scan_type === "github" ? "bg-purple-500/10 text-purple-400" : "bg-indigo-500/10 text-indigo-400"
                        }`}>{scan.scan_type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-10 h-1.5 rounded-full overflow-hidden ${dark ? "bg-white/[0.06]" : "bg-gray-200"}`}>
                            <div className="h-full rounded-full" style={{ width: `${scan.overall_score}%`, background: SCORE_COLOR(scan.overall_score) }}></div>
                          </div>
                          <span className="text-xs font-bold" style={{ color: SCORE_COLOR(scan.overall_score) }}>{scan.overall_score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {scan.issue_counts?.critical > 0 && <span className="px-1 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">{scan.issue_counts.critical}</span>}
                          {scan.issue_counts?.high > 0 && <span className="px-1 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400">{scan.issue_counts.high}</span>}
                          <span className={`text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>{scan.issue_counts?.total || 0}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-sm ${dark ? "text-gray-300" : "text-gray-600"}`}>{scan.files_scanned}</td>
                      <td className={`px-4 py-3 text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>{scan.scan_duration ? `${scan.scan_duration}s` : "—"}</td>
                      <td className={`px-4 py-3 text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>{new Date(scan.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ Edit User Modal ═══ */}
        {editDialog.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditDialog({ open: false, user: null })}>
            <div onClick={(e) => e.stopPropagation()}
              className={`rounded-2xl border backdrop-blur-xl w-full max-w-md p-6 mx-4 animate-fade-in-up ${
                dark ? "bg-[#0f1121] border-white/[0.1]" : "bg-white border-gray-200 shadow-xl"
              }`}>
              <h3 className={`text-lg font-bold mb-4 ${dark ? "text-white" : "text-gray-900"}`}>Edit User: {editDialog.user?.username}</h3>

              <div className="space-y-4">
                {/* Admin toggle */}
                <label className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition ${
                  dark ? "bg-white/[0.03] hover:bg-white/[0.05]" : "bg-gray-50 hover:bg-gray-100"
                }`}>
                  <div>
                    <p className={`font-medium ${dark ? "text-white" : "text-gray-900"}`}>Admin Access</p>
                    <p className={`text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>Grant administrator privileges</p>
                  </div>
                  <div className="relative">
                    <input type="checkbox" checked={editForm.is_admin} onChange={(e) => setEditForm({ ...editForm, is_admin: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-checked:bg-purple-500 rounded-full transition-colors"></div>
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </div>
                </label>

                {/* Active toggle */}
                <label className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition ${
                  dark ? "bg-white/[0.03] hover:bg-white/[0.05]" : "bg-gray-50 hover:bg-gray-100"
                }`}>
                  <div>
                    <p className={`font-medium ${dark ? "text-white" : "text-gray-900"}`}>Active Account</p>
                    <p className={`text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>Allow user to log in</p>
                  </div>
                  <div className="relative">
                    <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-checked:bg-emerald-500 rounded-full transition-colors"></div>
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditDialog({ open: false, user: null })}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                    dark ? "bg-white/[0.06] text-gray-300 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>Cancel</button>
                <button onClick={handleSaveUser}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition shadow-lg shadow-indigo-500/30">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Delete User Modal ═══ */}
        {deleteDialog.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteDialog({ open: false, user: null })}>
            <div onClick={(e) => e.stopPropagation()}
              className={`rounded-2xl border backdrop-blur-xl w-full max-w-md p-6 mx-4 animate-fade-in-up ${
                dark ? "bg-[#0f1121] border-white/[0.1]" : "bg-white border-gray-200 shadow-xl"
              }`}>
              <h3 className={`text-lg font-bold mb-2 ${dark ? "text-white" : "text-gray-900"}`}>Confirm Delete</h3>
              <p className={`text-sm mb-6 ${dark ? "text-gray-400" : "text-gray-500"}`}>
                Are you sure you want to delete user <strong className={dark ? "text-white" : "text-gray-900"}>{deleteDialog.user?.username}</strong>? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteDialog({ open: false, user: null })}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                    dark ? "bg-white/[0.06] text-gray-300 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>Cancel</button>
                <button onClick={handleDeleteUser}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition">
                  Delete User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
