import { useContext, useState, useEffect } from "react";
import { ThemeContext } from "./ThemeContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const { dark, toggle } = useContext(ThemeContext);
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); setMenuOpen(false); }, [location.pathname]);

  const navLinks = [
    { to: "/history", label: "History", icon: "📜" },
    { to: "/snippets", label: "Snippets", icon: "📚" },
    { to: "/reports", label: "Reports", icon: "📊" },
    { to: "/explain", label: "Explain", icon: "🧠" },
    { to: "/chat", label: "Chat", icon: "💬" },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate("/");
    setMenuOpen(false);
  };

  return (
    <>
      <nav className={`sticky top-0 z-50 flex justify-between items-center px-5 lg:px-10 py-2.5 transition-all duration-500 ${
        scrolled
          ? dark
            ? "bg-slate-950/80 backdrop-blur-2xl border-b border-white/[0.08] shadow-xl shadow-black/30"
            : "bg-white/85 backdrop-blur-2xl border-b border-gray-200/80 shadow-lg shadow-gray-200/40"
          : dark
            ? "bg-transparent backdrop-blur-xl border-b border-white/[0.05]"
            : "bg-white/60 backdrop-blur-xl border-b border-gray-100"
      }`}>
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden ring-1 ring-white/20 shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-shadow duration-300 bg-black/10">
            <img
              src="/AI Code Reviewer & Secuity Auditor.jpeg"
              alt="AI Code Reviewer and Security Auditor logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className={`text-lg font-medium tracking-wide leading-tight transition-colors ${dark ? "text-white" : "text-gray-900"}`}>
              AI Code <span className="font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Reviewer</span>
            </h1>
            <p className={`text-[10px] leading-tight transition-colors ${dark ? "text-gray-500" : "text-gray-400"}`}>Security Auditor</p>
          </div>
        </Link>

        {/* Nav Links (authenticated, desktop) */}
        {isAuthenticated() && (
          <div className="hidden lg:flex items-center gap-0.5">
            {navLinks.map(l => (
              <Link key={l.to} to={l.to}
                className={`relative px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-300 group ${
                  isActive(l.to)
                    ? dark
                      ? "text-white"
                      : "text-indigo-700"
                    : dark
                      ? "text-gray-400 hover:text-white"
                      : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {isActive(l.to) && (
                  <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/15 to-purple-500/15 border border-indigo-500/25 animate-fade-scale" />
                )}
                <span className="relative flex items-center gap-1.5">
                  <span className="text-xs group-hover:scale-110 transition-transform duration-200">{l.icon}</span>
                  {l.label}
                </span>
              </Link>
            ))}
            {isAdmin() && (
              <Link to="/admin"
                className={`relative px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-300 group ${
                  isActive("/admin")
                    ? dark ? "text-purple-300" : "text-purple-700"
                    : dark
                      ? "text-gray-400 hover:text-white"
                      : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {isActive("/admin") && (
                  <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/15 to-pink-500/15 border border-purple-500/25 animate-fade-scale" />
                )}
                <span className="relative flex items-center gap-1.5">
                  <span className="text-xs group-hover:scale-110 transition-transform duration-200">🛡️</span>
                  Admin
                </span>
              </Link>
            )}
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <button onClick={toggle}
            className={`relative p-2.5 rounded-xl transition-all duration-300 group ${
              dark ? "hover:bg-white/10 text-gray-400 hover:text-yellow-300" : "hover:bg-gray-100 text-gray-500 hover:text-indigo-600"
            }`}
            aria-label="Toggle theme">
            <div className="relative w-5 h-5">
              {dark ? (
                <svg className="w-5 h-5 transition-transform duration-500 group-hover:rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 transition-transform duration-500 group-hover:-rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </div>
          </button>

          {isAuthenticated() ? (
            <>
              {/* Mobile hamburger */}
              <button onClick={() => setMobileOpen(!mobileOpen)}
                className={`lg:hidden p-2.5 rounded-xl transition-all duration-300 ${dark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
                aria-label="Menu">
                <div className="w-5 h-5 flex flex-col justify-center items-center gap-1">
                  <span className={`block h-0.5 w-5 rounded-full transition-all duration-300 ${dark ? "bg-white" : "bg-gray-700"} ${mobileOpen ? "rotate-45 translate-y-[3px]" : ""}`} />
                  <span className={`block h-0.5 w-5 rounded-full transition-all duration-300 ${dark ? "bg-white" : "bg-gray-700"} ${mobileOpen ? "opacity-0" : ""}`} />
                  <span className={`block h-0.5 w-5 rounded-full transition-all duration-300 ${dark ? "bg-white" : "bg-gray-700"} ${mobileOpen ? "-rotate-45 -translate-y-[3px]" : ""}`} />
                </div>
              </button>

              {/* User menu (desktop) */}
              <div className="relative hidden sm:block">
                <button onClick={() => setMenuOpen(!menuOpen)}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-300 ${
                    dark ? "hover:bg-white/[0.08] text-white" : "hover:bg-gray-100 text-gray-800"
                  }`}>
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-indigo-500/20">
                      {user?.username?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900"></div>
                  </div>
                  <span className="text-sm font-medium">{user?.username}</span>
                  <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${menuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className={`absolute right-0 top-14 w-56 rounded-2xl shadow-2xl z-50 border overflow-hidden animate-fade-scale ${
                      dark ? "bg-slate-900/95 backdrop-blur-xl border-white/10" : "bg-white/95 backdrop-blur-xl border-gray-200"
                    }`}>
                      <div className={`px-4 py-3 border-b ${dark ? "border-white/[0.08]" : "border-gray-100"}`}>
                        <p className={`text-sm font-semibold ${dark ? "text-white" : "text-gray-900"}`}>{user?.username}</p>
                        <p className={`text-xs mt-0.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>{user?.email}</p>
                        {user?.is_admin && (
                          <span className="inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20">Admin</span>
                        )}
                      </div>
                      <div className="p-1.5">
                        <button onClick={handleLogout}
                          className={`w-full text-left px-3 py-2.5 text-sm rounded-xl transition-all duration-200 flex items-center gap-2.5 ${
                            dark ? "text-red-400 hover:bg-red-500/10" : "text-red-500 hover:bg-red-50"
                          }`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login"
                className={`px-5 py-2 text-sm rounded-xl font-medium transition-all duration-300 border ${
                  dark
                    ? "border-white/15 text-white/80 hover:bg-white/[0.08] hover:border-white/25"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                }`}>
                Login
              </Link>
              <Link to="/login?tab=register"
                className="relative px-5 py-2 text-sm rounded-xl font-semibold text-white overflow-hidden group transition-all duration-300 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40">
                <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></span>
                <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="relative">Sign Up</span>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile nav drawer */}
      {isAuthenticated() && (
        <>
          {mobileOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
          <div className={`fixed top-0 right-0 h-full w-72 z-50 lg:hidden transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          } ${dark ? "bg-slate-950/95 backdrop-blur-2xl border-l border-white/[0.08]" : "bg-white/95 backdrop-blur-2xl border-l border-gray-200"}`}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                  {user?.username?.[0]?.toUpperCase() || "U"}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${dark ? "text-white" : "text-gray-900"}`}>{user?.username}</p>
                  <p className={`text-xs ${dark ? "text-gray-500" : "text-gray-400"}`}>{user?.email}</p>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)} className={`p-2 rounded-lg ${dark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-3 space-y-1 stagger-children">
              {navLinks.map(l => (
                <Link key={l.to} to={l.to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 animate-slide-left ${
                    isActive(l.to)
                      ? dark
                        ? "bg-gradient-to-r from-indigo-500/15 to-purple-500/15 text-white border border-indigo-500/20"
                        : "bg-indigo-50 text-indigo-700 border border-indigo-200/50"
                      : dark
                        ? "text-gray-400 hover:text-white hover:bg-white/[0.06]"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}>
                  <span>{l.icon}</span>{l.label}
                </Link>
              ))}
              {isAdmin() && (
                <Link to="/admin"
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 animate-slide-left ${
                    isActive("/admin")
                      ? dark ? "bg-purple-500/15 text-purple-300 border border-purple-500/20" : "bg-purple-50 text-purple-700 border border-purple-200/50"
                      : dark ? "text-gray-400 hover:text-white hover:bg-white/[0.06]" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}>
                  <span>🛡️</span>Admin
                </Link>
              )}
            </div>
            <div className="absolute bottom-0 inset-x-0 p-4 border-t border-white/[0.08]">
              <button onClick={handleLogout}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  dark ? "text-red-400 hover:bg-red-500/10 border border-red-500/20" : "text-red-500 hover:bg-red-50 border border-red-200"
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}