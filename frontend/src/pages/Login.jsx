import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ThemeContext } from "../components/ThemeContext";
import axios from "axios";

const API = "http://localhost:5000";

export default function Login() {
  const { dark, setDark } = useContext(ThemeContext);
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState(searchParams.get("tab") === "register" ? "register" : "login");
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Inline field validation state
  const [fieldStatus, setFieldStatus] = useState({ username: null, email: null }); // null | {ok:bool, msg:string}
  const debounceTimers = useRef({});

  // Registration email verification state
  const [regStep, setRegStep] = useState(1); // 1=fill form, 2=verify OTP
  const [regOtp, setRegOtp] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // Forgot password state  (1=email, 2=verify OTP, 3=set new password)
  const [forgotStep, setForgotStep] = useState(0);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetCodeVerified, setResetCodeVerified] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useEffect(() => { if (isAuthenticated()) navigate("/"); }, [isAuthenticated, navigate]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ── Inline availability check (debounced) ──
  const checkField = useCallback((field, value) => {
    if (debounceTimers.current[field]) clearTimeout(debounceTimers.current[field]);
    if (!value || value.length < (field === "username" ? 2 : 5)) {
      setFieldStatus(prev => ({ ...prev, [field]: null }));
      return;
    }
    debounceTimers.current[field] = setTimeout(async () => {
      try {
        const res = await axios.post(`${API}/api/auth/check-availability`, { [field]: value });
        const info = res.data[field];
        if (info) setFieldStatus(prev => ({ ...prev, [field]: info.available ? null : { ok: false, msg: info.message } }));
      } catch { /* ignore */ }
    }, 500);
  }, []);

  const handleFormChange = (k) => (e) => {
    const v = e.target.value;
    setForm(prev => ({ ...prev, [k]: v }));
    if (tab === "register" && regStep === 1 && (k === "username" || k === "email")) {
      checkField(k, v);
    }
  };

  // ── LOGIN ──
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      await login(form.username, form.password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Authentication failed");
    } finally { setLoading(false); }
  };

  // ── REGISTER STEP 1: Validate fields then send verification OTP ──
  const handleSendVerification = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (!form.username || !form.email || !form.password) {
        setError("All fields are required"); setLoading(false); return;
      }
      if (form.password.length < 8) { setError("Password must be at least 8 characters"); setLoading(false); return; }
      if (form.password !== form.confirm) { setError("Passwords do not match"); setLoading(false); return; }

      // Pre-check username & email availability before sending OTP
      const chk = await axios.post(`${API}/api/auth/check-availability`, { username: form.username, email: form.email });
      if (chk.data.username && !chk.data.username.available) {
        setFieldStatus(prev => ({ ...prev, username: { ok: false, msg: chk.data.username.message } }));
        setError(chk.data.username.message); setLoading(false); return;
      }
      if (chk.data.email && !chk.data.email.available) {
        setFieldStatus(prev => ({ ...prev, email: { ok: false, msg: chk.data.email.message } }));
        setError(chk.data.email.message); setLoading(false); return;
      }

      await axios.post(`${API}/api/auth/send-verification`, { email: form.email });
      setRegStep(2);
      setResendTimer(60);
      setSuccess("Verification code sent to your email!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send verification code");
    } finally { setLoading(false); }
  };

  // ── REGISTER STEP 2: Verify OTP then register ──
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      await axios.post(`${API}/api/auth/verify-email`, { email: form.email, code: regOtp });
      await register(form.username, form.email, form.password);
      setSuccess("Account created successfully! Redirecting...");
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      setError(err.response?.data?.error || "Verification failed");
    } finally { setLoading(false); }
  };

  // ── Resend registration OTP ──
  const handleResendRegOtp = async () => {
    if (resendTimer > 0) return;
    setError(""); setLoading(true);
    try {
      await axios.post(`${API}/api/auth/send-verification`, { email: form.email });
      setResendTimer(60);
      setSuccess("New verification code sent!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to resend code");
    } finally { setLoading(false); }
  };

  // ── FORGOT PASSWORD STEP 1: Send reset OTP ──
  const handleForgotRequest = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await axios.post(`${API}/api/auth/forgot-password`, { email: resetEmail });
      setSuccess(res.data.message || "Reset code sent to your email.");
      setForgotStep(2);
      setResendTimer(60);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to request reset code");
    } finally { setLoading(false); }
  };

  // ── FORGOT PASSWORD STEP 2: Verify OTP only ──
  const handleVerifyResetCode = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      await axios.post(`${API}/api/auth/verify-reset-code`, { email: resetEmail, code: resetCode });
      setResetCodeVerified(true);
      setForgotStep(3);
      setSuccess("Code verified! Set your new password below.");
    } catch (err) {
      setError(err.response?.data?.error || "Invalid or expired code");
    } finally { setLoading(false); }
  };

  // ── FORGOT PASSWORD STEP 3: Set new password ──
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (newPassword.length < 8) { setError("Password must be at least 8 characters"); setLoading(false); return; }
      if (newPassword !== confirmNewPassword) { setError("Passwords do not match"); setLoading(false); return; }
      const res = await axios.post(`${API}/api/auth/reset-password`, {
        email: resetEmail, code: resetCode, new_password: newPassword,
      });
      setSuccess(res.data.message || "Password reset successful!");
      setTimeout(() => {
        goBackToLogin();
        setTab("login");
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reset password");
    } finally { setLoading(false); }
  };

  // ── Resend forgot-password OTP ──
  const handleResendResetOtp = async () => {
    if (resendTimer > 0) return;
    setError(""); setLoading(true);
    try {
      await axios.post(`${API}/api/auth/forgot-password`, { email: resetEmail });
      setResendTimer(60);
      setSuccess("New reset code sent to your email!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to resend code");
    } finally { setLoading(false); }
  };

  const goBackToLogin = () => {
    setForgotStep(0); setError(""); setSuccess("");
    setResetEmail(""); setResetCode(""); setResetCodeVerified(false);
    setNewPassword(""); setConfirmNewPassword("");
  };

  const resetRegState = () => {
    setRegStep(1); setRegOtp(""); setError(""); setSuccess("");
    setFieldStatus({ username: null, email: null });
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const inputCls = `w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all duration-300 ${
    dark ? "bg-white/[0.06] border border-white/[0.12] text-white placeholder-gray-500 focus:border-indigo-500/60 focus:bg-white/[0.09] focus:shadow-[0_0_20px_rgba(99,102,241,0.15)]"
         : "bg-gray-50/80 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500/60 focus:bg-white focus:shadow-[0_0_20px_rgba(99,102,241,0.1)]"
  }`;

  const otpInputCls = `${inputCls} text-center text-lg tracking-[0.5em] font-mono`;

  // ── Shared UI pieces ──
  const ErrorBox = () => error ? <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-scale flex items-center gap-2"><svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</div> : null;
  const SuccessBox = () => success ? <div className={`px-4 py-3 rounded-xl border text-sm animate-fade-scale flex items-center gap-2 ${dark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-300 text-emerald-700"}`}><svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{success}</div> : null;
  const Spinner = () => loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" style={{animation: 'spin 0.6s linear infinite'}} /> : null;

  const FieldHint = ({ field }) => {
    const s = fieldStatus[field];
    if (!s || s.ok) return null;
    return (
      <p className="text-xs mt-1 flex items-center gap-1 text-red-400">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        {s.msg}
      </p>
    );
  };

  const PrimaryBtn = ({ children, className = "", ...props }) => (
    <button {...props}
      className={`relative w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 btn-press hover:shadow-xl hover:brightness-110 ${className}`}>
      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/15 pointer-events-none" />
      <Spinner /><span className="relative">{children}</span>
    </button>
  );

  const ResendBtn = ({ onClick }) => (
    <button type="button" onClick={onClick} disabled={resendTimer > 0 || loading}
      className={`text-xs font-medium transition ${resendTimer > 0 ? (dark ? "text-gray-500" : "text-gray-400") : "text-indigo-400 hover:text-indigo-300"}`}>
      {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
    </button>
  );

  return (
    <div className={`relative min-h-screen overflow-hidden font-sans flex flex-col transition-colors duration-300 ${
      dark ? "bg-gradient-to-b from-[#0a0b14] via-[#0f1121] to-[#0a0b14] text-white"
           : "bg-gradient-to-b from-gray-50 via-white to-gray-50 text-gray-900"
    }`}>
      {/* ── Animated background gradients ── */}
      <div className={`absolute -top-40 -left-40 w-[900px] h-[900px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-indigo-600/20" : "bg-indigo-400/8"}`} style={{animationDuration:'18s'}} />
      <div className={`absolute top-40 right-0 w-[800px] h-[800px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-purple-600/20" : "bg-purple-400/8"}`} style={{animationDuration:'22s', animationDelay:'2s'}} />
      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] blur-[180px] rounded-full pointer-events-none animate-blob ${dark ? "bg-pink-700/15" : "bg-pink-400/6"}`} style={{animationDuration:'25s', animationDelay:'4s'}} />
      {/* Decorative floating dots */}
      <div className={`absolute top-1/4 left-1/4 w-2 h-2 rounded-full animate-float pointer-events-none ${dark ? "bg-indigo-400/30" : "bg-indigo-400/20"}`} style={{animationDuration:'4s'}} />
      <div className={`absolute top-1/3 right-1/3 w-1.5 h-1.5 rounded-full animate-float pointer-events-none ${dark ? "bg-purple-400/25" : "bg-purple-400/15"}`} style={{animationDuration:'5s', animationDelay:'1s'}} />
      <div className={`absolute bottom-1/4 right-1/4 w-2.5 h-2.5 rounded-full animate-float pointer-events-none ${dark ? "bg-pink-400/20" : "bg-pink-400/10"}`} style={{animationDuration:'6s', animationDelay:'2s'}} />

      {/* ── Navbar ── */}
      <nav className={`relative z-20 flex justify-between items-center px-6 sm:px-10 py-3 backdrop-blur-2xl transition-all duration-300 ${
        dark ? "bg-white/[0.03] border-b border-white/[0.08]"
             : "bg-white/60 border-b border-gray-100"
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
        <button onClick={() => setDark(!dark)}
          className={`p-2.5 rounded-xl transition-all duration-300 group ${dark ? "hover:bg-white/10 text-gray-400 hover:text-yellow-300" : "hover:bg-gray-100 text-gray-500 hover:text-indigo-600"}`}>
          {dark ? (
            <svg className="w-5 h-5 transition-transform duration-500 group-hover:rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-5 h-5 transition-transform duration-500 group-hover:-rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
        </button>
      </nav>

      {/* ── Auth Card ── */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 relative z-10">
        <div className="relative group w-full max-w-md animate-fade-in-up" style={{animationDuration:'0.7s'}}>
          {/* Hover glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-2xl rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

          <div className={`relative backdrop-blur-2xl rounded-2xl p-7 sm:p-8 shadow-2xl transition-all duration-500 ${
            dark ? "bg-gradient-to-b from-white/[0.1] to-white/[0.04] border border-white/[0.12] shadow-black/40 hover:border-white/[0.18]"
                 : "bg-gradient-to-b from-white/95 to-white/80 border border-gray-200/80 shadow-gray-400/20 hover:shadow-gray-400/30"
          }`}>
            {/* Inner shine */}
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br via-transparent to-transparent pointer-events-none ${dark ? "from-white/[0.06]" : "from-white/50"}`} />

            <div className="relative z-10">

              {/* ════════════════════════════════════════════════ */}
              {/* ── FORGOT PASSWORD FLOW ──                      */}
              {/* ════════════════════════════════════════════════ */}
              {forgotStep > 0 ? (
                <>
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center">
                      <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-1">
                      {forgotStep === 1 ? "Forgot Password" : forgotStep === 2 ? "Verify Code" : "Set New Password"}
                    </h2>
                    <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-500"}`}>
                      {forgotStep === 1
                        ? "Enter your email to receive a reset code"
                        : forgotStep === 2
                          ? "Enter the 6-digit code sent to your email"
                          : "Create a strong new password"}
                    </p>
                  </div>

                  {/* Step 1: Enter email */}
                  {forgotStep === 1 && (
                    <form onSubmit={handleForgotRequest} className="space-y-4">
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>Email Address</label>
                        <input value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                          type="email" required placeholder="you@example.com" className={inputCls} />
                      </div>
                      <ErrorBox />
                      <PrimaryBtn type="submit" disabled={loading} className="bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-500/30">
                        Send Reset Code
                      </PrimaryBtn>
                      <button type="button" onClick={goBackToLogin}
                        className={`w-full py-2.5 text-sm font-medium rounded-xl transition ${dark ? "text-gray-400 hover:text-white hover:bg-white/5" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
                        ← Back to Sign In
                      </button>
                    </form>
                  )}

                  {/* Step 2: Verify OTP only */}
                  {forgotStep === 2 && (
                    <form onSubmit={handleVerifyResetCode} className="space-y-4">
                      {/* Email sent confirmation */}
                      <div className={`px-4 py-3 rounded-xl border text-sm flex items-start gap-2 ${dark ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" : "bg-indigo-50 border-indigo-300 text-indigo-700"}`}>
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        <div>
                          <span>Code sent to <strong>{resetEmail}</strong></span>
                          <div className="mt-1"><ResendBtn onClick={handleResendResetOtp} /></div>
                        </div>
                      </div>

                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>Reset Code</label>
                        <input value={resetCode} onChange={(e) => setResetCode(e.target.value)}
                          type="text" required maxLength={6} placeholder="Enter 6-digit code" className={otpInputCls} autoFocus />
                      </div>

                      <ErrorBox />
                      <SuccessBox />

                      <PrimaryBtn type="submit" disabled={loading} className="bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-500/30">
                        Verify Code
                      </PrimaryBtn>

                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setForgotStep(1); setError(""); setSuccess(""); setResetCode(""); }}
                          className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition ${dark ? "text-gray-400 hover:text-white hover:bg-white/5" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
                          ← Change Email
                        </button>
                        <button type="button" onClick={goBackToLogin}
                          className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition ${dark ? "text-gray-400 hover:text-white hover:bg-white/5" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
                          Back to Sign In
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Step 3: Set new password (only after OTP verified) */}
                  {forgotStep === 3 && (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      {/* Verified badge */}
                      <div className={`px-4 py-3 rounded-xl border text-sm flex items-center gap-2 ${dark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-300 text-emerald-700"}`}>
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>Code verified for <strong>{resetEmail}</strong></span>
                      </div>

                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>New Password</label>
                        <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                          type="password" required minLength={8} placeholder="••••••••" className={inputCls} autoFocus />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>Confirm New Password</label>
                        <input value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
                          type="password" required minLength={8} placeholder="••••••••" className={inputCls} />
                      </div>

                      <ErrorBox />
                      <SuccessBox />

                      <PrimaryBtn type="submit" disabled={loading} className="bg-gradient-to-r from-indigo-500 to-purple-600 shadow-indigo-500/50">
                        Reset Password
                      </PrimaryBtn>

                      <button type="button" onClick={goBackToLogin}
                        className={`w-full py-2.5 text-sm font-medium rounded-xl transition ${dark ? "text-gray-400 hover:text-white hover:bg-white/5" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
                        Back to Sign In
                      </button>
                    </form>
                  )}
                </>

              /* ════════════════════════════════════════════════ */
              /* ── NORMAL LOGIN / REGISTER ──                    */
              /* ════════════════════════════════════════════════ */
              ) : (
              <>
              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-1">
                  {tab === "login" ? "Welcome Back" : (regStep === 2 ? "Verify Email" : "Create Account")}
                </h2>
                <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-500"}`}>
                  {tab === "login"
                    ? "Sign in to your account"
                    : regStep === 2
                      ? `Enter the code sent to ${form.email}`
                      : "Join and start scanning code"}
                </p>
              </div>

              {/* Tabs (only visible while NOT in OTP verify step) */}
              {regStep === 1 && (
                <div className={`flex rounded-xl p-1 mb-6 ${dark ? "bg-white/[0.05]" : "bg-gray-100/80"}`}>
                  {["login", "register"].map(t => (
                    <button key={t} onClick={() => { setTab(t); setError(""); setSuccess(""); resetRegState(); }}
                      className={`relative flex-1 py-2.5 text-sm font-semibold rounded-lg capitalize transition-all duration-300 ${
                        tab === t
                          ? "text-white shadow-lg shadow-indigo-500/25"
                          : dark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-700"
                      }`}>
                      {tab === t && <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-purple-600 animate-fade-scale" />}
                      <span className="relative">{t === "login" ? "Sign In" : "Create Account"}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ── SIGN IN FORM ── */}
              {tab === "login" && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>Username or Email</label>
                    <input value={form.username} onChange={set("username")} type="text" required
                      placeholder="username or email" className={inputCls} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`block text-xs font-medium ${dark ? "text-gray-400" : "text-gray-500"}`}>Password</label>
                      <button type="button" onClick={() => { setForgotStep(1); setError(""); }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition">
                        Forgot Password?
                      </button>
                    </div>
                    <input value={form.password} onChange={set("password")} type="password" required
                      minLength={1} placeholder="••••••••" className={inputCls} />
                  </div>
                  <ErrorBox />
                  <PrimaryBtn type="submit" disabled={loading} className="bg-gradient-to-r from-indigo-500 to-purple-600 shadow-indigo-500/50">
                    Sign In
                  </PrimaryBtn>
                </form>
              )}

              {/* ── REGISTER FORM - Step 1: Fill details with inline validation ── */}
              {tab === "register" && regStep === 1 && (
                <form onSubmit={handleSendVerification} className="space-y-4">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>Username</label>
                    <input value={form.username} onChange={handleFormChange("username")} required placeholder="johndoe"
                      className={`${inputCls} ${fieldStatus.username && !fieldStatus.username.ok ? "!border-red-500/50 !ring-red-500/30" : ""}`} />
                    <FieldHint field="username" />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>Email</label>
                    <input value={form.email} onChange={handleFormChange("email")} type="email" required placeholder="you@example.com"
                      className={`${inputCls} ${fieldStatus.email && !fieldStatus.email.ok ? "!border-red-500/50 !ring-red-500/30" : ""}`} />
                    <FieldHint field="email" />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>Password</label>
                    <input value={form.password} onChange={handleFormChange("password")} type="password" required minLength={8} placeholder="••••••••" className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>Confirm Password</label>
                    <input value={form.confirm} onChange={handleFormChange("confirm")} type="password" required placeholder="••••••••" className={inputCls} />
                  </div>
                  <ErrorBox />
                  <PrimaryBtn type="submit" disabled={loading || (fieldStatus.username?.ok === false) || (fieldStatus.email?.ok === false)}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 shadow-indigo-500/50">
                    Verify Email & Continue
                  </PrimaryBtn>
                </form>
              )}

              {/* ── REGISTER FORM - Step 2: Enter OTP ── */}
              {tab === "register" && regStep === 2 && (
                <form onSubmit={handleVerifyAndRegister} className="space-y-4">
                  {/* Email sent info */}
                  <div className={`px-4 py-3 rounded-xl border text-sm flex items-start gap-2 ${dark ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" : "bg-indigo-50 border-indigo-300 text-indigo-700"}`}>
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <div>
                      <span>Verification code sent to <strong>{form.email}</strong></span>
                      <div className="mt-1"><ResendBtn onClick={handleResendRegOtp} /></div>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>Verification Code</label>
                    <input value={regOtp} onChange={(e) => setRegOtp(e.target.value)}
                      type="text" required maxLength={6} placeholder="Enter 6-digit code" className={otpInputCls} autoFocus />
                  </div>

                  <ErrorBox />
                  <SuccessBox />

                  <PrimaryBtn type="submit" disabled={loading} className="bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/50">
                    Verify & Create Account
                  </PrimaryBtn>

                  <button type="button" onClick={() => { setRegStep(1); setError(""); setSuccess(""); }}
                    className={`w-full py-2.5 text-sm font-medium rounded-xl transition ${dark ? "text-gray-400 hover:text-white hover:bg-white/5" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
                    ← Back to Edit Details
                  </button>
                </form>
              )}

              {/* Toggle between Login/Register */}
              {regStep === 1 && (
                <p className={`text-center text-xs mt-5 ${dark ? "text-gray-400" : "text-gray-400"}`}>
                  {tab === "login" ? "Don't have an account? " : "Already have an account? "}
                  <button onClick={() => { setTab(tab === "login" ? "register" : "login"); resetRegState(); }}
                    className="text-indigo-400 hover:text-indigo-300 font-medium">
                    {tab === "login" ? "Sign Up" : "Sign In"}
                  </button>
                </p>
              )}
              </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}