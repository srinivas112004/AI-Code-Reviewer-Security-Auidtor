import { useEffect, useState } from "react";

const colors = {
  success: { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-400", icon: "✓", glow: "shadow-emerald-500/10" },
  error: { bg: "bg-red-500/15", border: "border-red-500/30", text: "text-red-400", icon: "✕", glow: "shadow-red-500/10" },
  warning: { bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400", icon: "⚠", glow: "shadow-amber-500/10" },
  info: { bg: "bg-blue-500/15", border: "border-blue-500/30", text: "text-blue-400", icon: "ℹ", glow: "shadow-blue-500/10" },
};

export default function Toast({ toast, onClose }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (toast?.open) {
      setProgress(100);
      const duration = 4000;
      const interval = 30;
      const step = (interval / duration) * 100;
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev <= 0) { clearInterval(timer); onClose(); return 0; }
          return prev - step;
        });
      }, interval);
      return () => clearInterval(timer);
    }
  }, [toast?.open, toast?.message]);

  if (!toast?.open) return null;

  const c = colors[toast.severity] || colors.info;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-slide-up">
      <div className={`relative overflow-hidden flex items-center gap-3 px-5 py-3.5 rounded-xl border backdrop-blur-2xl shadow-2xl ${c.bg} ${c.border} ${c.glow}`}>
        <span className={`text-lg ${c.text}`}>{c.icon}</span>
        <span className={`text-sm font-medium ${c.text}`}>{toast.message}</span>
        <button onClick={onClose} className={`ml-2 ${c.text} hover:opacity-70 transition-opacity`}>✕</button>
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
          <div className={`h-full transition-all duration-75 ease-linear rounded-full ${c.text.replace('text-', 'bg-')}`} style={{width: `${progress}%`, opacity: 0.5}} />
        </div>
      </div>
    </div>
  );
}
