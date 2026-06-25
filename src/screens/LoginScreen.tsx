import { useEffect, useState } from "react";
import { Store, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { User } from "../types";
import PinPad from "../components/PinPad";

interface Props {
  onLogin: (user: User) => void;
}

const roleStyle: Record<string, string> = {
  admin:   "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  manager: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  cashier: "bg-slate-700/60 text-slate-400 border border-slate-600/40",
};

export default function LoginScreen({ onLogin }: Props) {
  const [users, setUsers]               = useState<User[]>([]);
  const [selected, setSelected]         = useState<User | null>(null);
  const [pin, setPin]                   = useState("");
  const [error, setError]               = useState("");
  const [shake, setShake]               = useState(false);
  const [loading, setLoading]           = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

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
      setError("Incorrect PIN — try again");
      setShake(true);
      setPin("");
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, #0F2040 0%, #020817 55%)" }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />

      {/* Glow orb */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(20,184,166,0.08) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-3xl px-4 flex flex-col gap-6">
        {/* Brand */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center">
              <Store size={22} className="text-[#14B8A6]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--tx-base)] tracking-tight">
              MiniMarket <span className="text-[#14B8A6]">POS</span>
            </h1>
          </div>
          <p className="text-slate-500 text-sm">Select your profile and enter your PIN to continue</p>
        </div>

        <div className="grid grid-cols-[1fr_300px] gap-4">
          {/* Cashier list */}
          <div className="bg-[var(--bg-base)]/80 backdrop-blur border border-[var(--bd-base)] rounded-2xl p-5">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-4">
              Who's clocking in?
            </p>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-12 text-slate-600">
                <div className="w-6 h-6 border-2 border-slate-700 border-t-[#14B8A6] rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-slate-600 text-sm">
                No users found. Create one in settings.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => selectUser(u)}
                    className={`group flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-150 text-left cursor-pointer ${
                      selected?.id === u.id
                        ? "bg-[#14B8A6]/10 border-[#14B8A6]/40 shadow-lg shadow-[#14B8A6]/5"
                        : "bg-[var(--bg-card)]/60 border-[var(--bd-base)] hover:bg-[var(--bg-raised)] hover:border-[var(--bd-strong)]"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 transition-all duration-150 ${
                        selected?.id === u.id
                          ? "bg-[#14B8A6] text-slate-900"
                          : "bg-[var(--bg-raised)] text-slate-300 group-hover:bg-[var(--bg-raised)]"
                      }`}
                    >
                      {u.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[var(--tx-base)] font-medium text-sm truncate">{u.full_name}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize mt-1 inline-block ${roleStyle[u.role]}`}>
                        {u.role}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PIN panel */}
          <div
            className={`bg-[var(--bg-base)]/80 backdrop-blur border border-[var(--bd-base)] rounded-2xl p-5 flex flex-col items-center gap-5 ${shake ? "shake" : ""}`}
          >
            {/* Selected user or placeholder */}
            <div className="w-full text-center h-20 flex flex-col items-center justify-center">
              {selected ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-[#14B8A6] text-slate-900 font-bold text-lg flex items-center justify-center mb-1.5">
                    {selected.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-[var(--tx-base)] font-semibold text-sm">{selected.full_name}</div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-600">
                  <ShieldCheck size={28} strokeWidth={1.5} />
                  <span className="text-xs">Select a cashier</span>
                </div>
              )}
            </div>

            {/* PIN dots */}
            <div className="flex gap-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
                    i < pin.length
                      ? "bg-[#14B8A6] scale-110 shadow-sm shadow-[#14B8A6]/50"
                      : "bg-[var(--bg-card)] border border-[var(--bd-strong)]"
                  }`}
                />
              ))}
            </div>

            {/* Error */}
            <div className={`text-red-400 text-xs text-center transition-opacity ${error ? "opacity-100" : "opacity-0"} min-h-[16px]`}>
              {error || "‎"}
            </div>

            {/* Pad */}
            <PinPad
              onDigit={addDigit}
              onBackspace={() => setPin((p) => p.slice(0, -1))}
              onSubmit={handleSubmit}
              disabled={!selected}
              loading={loading}
            />
          </div>
        </div>

        <p className="text-center text-slate-700 text-xs">
          © {new Date().getFullYear()} MiniMarket POS — All rights reserved
        </p>
      </div>
    </div>
  );
}
