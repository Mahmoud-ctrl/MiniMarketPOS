import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Store, ShieldCheck, Sun, Moon, Globe, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { User } from "../types";
import PinPad from "../components/PinPad";
import { useTheme } from "../context/ThemeContext";

interface Props {
  onLogin: (user: User) => void;
}

// Upgraded role badges with subtle gradients for a premium feel
const roleStyle: Record<string, string> = {
  admin:   "bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-600 border border-amber-500/30 dark:text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]",
  manager: "bg-gradient-to-r from-blue-500/20 to-cyan-500/10 text-blue-600 border border-blue-500/30 dark:text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)]",
  cashier: "bg-gradient-to-r from-slate-500/20 to-gray-500/10 text-slate-700 border border-slate-500/30 dark:text-slate-300 dark:border-slate-500/40",
};

export default function LoginScreen({ onLogin }: Props) {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  
  const [users, setUsers]               = useState<User[]>([]);
  const [selected, setSelected]         = useState<User | null>(null);
  const [pin, setPin]                   = useState("");
  const [error, setError]               = useState("");
  const [shake, setShake]               = useState(false);
  const [loading, setLoading]           = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Toggle Language Handler (assuming EN and AR for example, adjust as needed)
  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('en') ? 'ar' : 'en';
    i18n.changeLanguage(nextLang);
  };

  useEffect(() => {
    api.getUsers()
      .then(setUsers)
      .catch(() => setError("Could not load users"))
      .finally(() => setLoadingUsers(false));
  }, []);

  const selectUser = (u: User) => {
    setSelected(u);
    setPin("");
    setError("");
  };

  const addDigit = (d: string) => {
    setError("");
    setPin((p) => (p.length < 6 ? p + d : p));
  };

  const handleSubmit = async () => {
    if (!selected || pin.length < 4) return;
    setLoading(true);
    try {
      const result = await api.login(selected.username, pin);
      onLogin(result.user);
    } catch {
      setError(t("login.pinError"));
      setShake(true);
      setPin("");
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center overflow-hidden bg-[var(--bg-deep)] transition-colors duration-500 relative">
      
      {/* Decorative Glow Orbs - Added pulse animation for life */}
      <div
        className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full pointer-events-none blur-[120px] opacity-40 dark:opacity-20 animate-pulse"
        style={{ background: "radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 70%)", animationDuration: '8s' }}
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full pointer-events-none blur-[100px] opacity-20 dark:opacity-10"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)" }}
      />

      {/* Top Right Controls Island (Theme + Language) */}
      <div className="absolute top-6 right-6 flex items-center gap-3 z-50">
        <button 
          onClick={toggleLanguage}
          className="group flex items-center gap-2 px-4 py-3 rounded-2xl bg-[var(--bg-panel)]/80 backdrop-blur-md border border-[var(--bd-base)] text-[var(--tx-base)] hover:bg-[var(--bg-raised)] hover:border-[#14B8A6]/50 hover:shadow-[0_0_15px_rgba(20,184,166,0.15)] transition-all duration-300 cursor-pointer"
          aria-label="Toggle Language"
        >
          <Globe size={18} className="text-[var(--tx-muted)] group-hover:text-[#14B8A6] transition-colors" />
          <span className="text-xs font-bold uppercase tracking-widest">{i18n.language.substring(0, 2)}</span>
        </button>

        <button 
          onClick={toggleTheme}
          className="group p-3 rounded-2xl bg-[var(--bg-panel)]/80 backdrop-blur-md border border-[var(--bd-base)] text-[var(--tx-base)] hover:bg-[var(--bg-raised)] hover:border-[#14B8A6]/50 hover:shadow-[0_0_15px_rgba(20,184,166,0.15)] transition-all duration-300 cursor-pointer"
          aria-label="Toggle Theme"
        >
          {theme === "dark" ? (
            <Sun size={20} className="text-[var(--tx-muted)] group-hover:text-amber-400 transition-colors" />
          ) : (
            <Moon size={20} className="text-[var(--tx-muted)] group-hover:text-indigo-400 transition-colors" />
          )}
        </button>
      </div>

      <div className="relative z-10 w-full max-w-[1000px] px-6 flex flex-col gap-10 items-center">
        
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-4 mb-4">
            <div className="relative w-16 h-16 rounded-3xl bg-gradient-to-br from-[#14B8A6]/20 to-transparent border border-[#14B8A6]/30 flex items-center justify-center shadow-[0_0_30px_rgba(20,184,166,0.2)] transform hover:scale-105 transition-transform duration-300">
              <div className="absolute inset-0 rounded-3xl bg-[#14B8A6]/10 animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>
              <Store size={32} className="text-[#14B8A6] drop-shadow-md" />
            </div>
            <h1 className="text-5xl font-black text-[var(--tx-base)] tracking-tight drop-shadow-sm">
              MiniMarket <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14B8A6] to-teal-400">POS</span>
            </h1>
          </div>
          <p className="text-[var(--tx-muted)] text-sm font-semibold tracking-widest uppercase opacity-80">{t("login.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_340px] gap-8 w-full">
          
          {/* Cashier List Panel */}
          <div className="bg-[var(--bg-panel)]/60 backdrop-blur-2xl border border-[var(--bd-base)] rounded-[2rem] shadow-2xl p-8 flex flex-col transition-all duration-300 hover:border-[var(--bd-strong)]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[var(--tx-muted)] text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse"></span>
                {t("login.whosClockingIn")}
              </h2>
            </div>

            {loadingUsers ? (
              <div className="flex-1 flex items-center justify-center py-12 text-[var(--tx-muted)]">
                <div className="w-10 h-10 border-4 border-[var(--bd-strong)] border-t-[#14B8A6] rounded-full animate-spin shadow-[0_0_15px_rgba(20,184,166,0.3)]" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-[var(--tx-muted)] text-sm gap-3">
                <ShieldCheck size={32} className="opacity-50" />
                <p>{t("login.noUsers")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-h-[380px] pr-2 custom-scrollbar">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => selectUser(u)}
                    className={`group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 text-left cursor-pointer overflow-hidden ${
                      selected?.id === u.id
                        ? "bg-gradient-to-br from-[#14B8A6]/10 to-transparent border-[#14B8A6]/50 shadow-[0_8px_30px_rgba(20,184,166,0.2)] ring-1 ring-[#14B8A6]/30"
                        : "bg-[var(--bg-card)] border-[var(--bd-faint)] hover:border-[#14B8A6]/30 hover:bg-[var(--bg-raised)] hover:shadow-lg hover:-translate-y-1"
                    }`}
                  >
                    {/* Active User Indicator Line */}
                    {selected?.id === u.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#14B8A6] rounded-l-2xl shadow-[0_0_10px_#14B8A6]"></div>
                    )}

                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0 transition-all duration-300 ${
                        selected?.id === u.id
                          ? "bg-[#14B8A6] text-white shadow-[0_0_20px_rgba(20,184,166,0.4)] scale-110"
                          : "bg-[var(--bg-panel)] text-[var(--tx-muted)] group-hover:text-[#14B8A6] border border-[var(--bd-base)] group-hover:border-[#14B8A6]/30"
                      }`}
                    >
                      {u.full_name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className={`font-bold text-base truncate transition-colors duration-300 ${selected?.id === u.id ? "text-[#14B8A6]" : "text-[var(--tx-base)] group-hover:text-[var(--tx-base)]"}`}>
                        {u.full_name}
                      </div>
                      <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider mt-2 inline-block ${roleStyle[u.role] || roleStyle.cashier}`}>
                        {u.role}
                      </span>
                    </div>

                    <ChevronRight 
                      size={20} 
                      className={`transition-all duration-300 ${selected?.id === u.id ? "text-[#14B8A6] opacity-100 translate-x-0" : "text-[var(--tx-muted)] opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0"}`} 
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PIN Panel */}
          <div
            className={`bg-[var(--bg-panel)]/60 backdrop-blur-2xl border border-[var(--bd-base)] rounded-[2rem] shadow-2xl p-8 flex flex-col items-center justify-between gap-6 transition-all duration-300 hover:border-[var(--bd-strong)] ${shake ? "shake ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]" : ""}`}
          >
            {/* Selected user profile display */}
            <div className="w-full text-center flex flex-col items-center justify-center min-h-[7rem]">
              {selected ? (
                <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                  <div className="relative mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#14B8A6] to-teal-500 text-white font-black text-2xl flex items-center justify-center shadow-[0_8px_20px_rgba(20,184,166,0.4)]">
                      {selected.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-[var(--bg-panel)] rounded-full"></div>
                  </div>
                  <div className="text-[var(--tx-base)] font-black text-lg">{selected.full_name}</div>
                  <div className="text-[var(--tx-muted)] text-sm font-medium mt-0.5 opacity-70">@{selected.username}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-[var(--tx-muted)] opacity-70">
                  <div className="w-16 h-16 rounded-full bg-[var(--bg-raised)] border-2 border-dashed border-[var(--bd-strong)] flex items-center justify-center mb-1 transition-all duration-500 hover:rotate-12">
                    <ShieldCheck size={28} strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-semibold tracking-wide">{t("login.selectCashier")}</span>
                </div>
              )}
            </div>

            {/* Enhanced PIN Dots */}
            <div className="flex gap-4 my-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                    i < pin.length
                      ? "bg-[#14B8A6] scale-125 shadow-[0_0_15px_rgba(20,184,166,0.8)]"
                      : "bg-[var(--bg-raised)] border-2 border-[var(--bd-strong)]"
                  }`}
                />
              ))}
            </div>

            {/* Error Message */}
            <div className={`text-red-500 font-bold text-sm text-center transition-all duration-300 bg-red-500/10 px-4 py-2 rounded-lg w-full ${error ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
              {error || "‎"}
            </div>

            {/* Pad */}
            <div className="w-full">
              <PinPad
                onDigit={addDigit}
                onBackspace={() => setPin((p) => p.slice(0, -1))}
                onSubmit={handleSubmit}
                disabled={!selected}
                loading={loading}
              />
            </div>
          </div>
        </div>

        <p className="text-center text-[var(--tx-muted)] text-xs font-bold tracking-widest mt-4 opacity-50 hover:opacity-100 transition-opacity cursor-default">
          {t("login.copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </div>
  );
}