import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ScanHistory from "./pages/ScanHistory";
import AdminDashboard from "./pages/AdminDashboard";
import SnippetLibrary from "./pages/SnippetLibrary";
import Reports from "./pages/Reports";
import CodeExplain from "./pages/CodeExplain";
import CodeChat from "./pages/CodeChat";
import ErrorBoundary from "./components/ErrorBoundary";
import { useAuth } from "./contexts/AuthContext";
import "./App.css";

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated() ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  return isAdmin() ? children : <Navigate to="/" />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><ScanHistory /></ProtectedRoute>} />
          <Route path="/snippets" element={<ProtectedRoute><SnippetLibrary /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />          <Route path="/explain"  element={<ProtectedRoute><CodeExplain /></ProtectedRoute>} />
          <Route path="/chat"     element={<ProtectedRoute><CodeChat /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}