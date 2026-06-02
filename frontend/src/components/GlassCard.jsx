import { useContext } from "react";
import { ThemeContext } from "./ThemeContext";

export default function GlassCard({ children, className = "" }) {
  const { dark } = useContext(ThemeContext);
  return (
    <div className={`
      relative group
      rounded-2xl
      p-[1px]
      bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-pink-500/20
      hover:-translate-y-1
      transition-all duration-500
      ${className}
    `}>
      <div className={`
        rounded-2xl
        backdrop-blur-2xl
        border
        p-8
        transition-all duration-300
        ${dark
          ? "bg-slate-900/70 border-white/[0.08] shadow-[0_0_40px_rgba(139,92,246,0.15)] group-hover:shadow-[0_0_60px_rgba(139,92,246,0.25)] group-hover:border-white/[0.15]"
          : "bg-white/80 border-gray-200/80 shadow-xl shadow-gray-200/30 group-hover:shadow-2xl group-hover:shadow-gray-300/30"
        }
      `}>
        {children}
      </div>
    </div>
  );
}