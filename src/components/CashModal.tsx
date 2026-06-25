import { Banknote, X } from "lucide-react";
import { useState } from "react";
import { useCurrency } from "../context/CurrencyContext";

interface Props {
  total:     number;   // base-currency DB units
  onConfirm: (amountPaid: number, paidPrimary: string, paidSecondary: string) => void;
  onCancel:  () => void;
}

export default function CashModal({ total, onConfirm, onCancel }: Props) {
  const {
    fmt, fmtAlt, toDb, inputStep,
    baseCurrency, exchangeRate, symbol, altSymbol,
  } = useCurrency();

  const [paidPrimary,   setPaidPrimary]   = useState("");
  const [paidSecondary, setPaidSecondary] = useState("");

  const altStep = baseCurrency === "USD" ? "1" : "0.01";

  // Convert both fields to base-currency DB integers
  const primaryDb = toDb(paidPrimary);
  const secondaryDb = (() => {
    const v = parseFloat(paidSecondary || "0");
    if (!v || isNaN(v)) return 0;
    return baseCurrency === "USD"
      ? Math.round((v / exchangeRate) * 100)   // LBP → USD cents
      : Math.round(v * exchangeRate);            // USD → LBP
  })();

  const combined  = primaryDb + secondaryDb;
  const change    = combined - total;
  const isPending = change < 0;
  const hasInput  = combined > 0;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="bg-[#0B1628] border border-[#1E3050] rounded-2xl w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E3050]">
          <div className="flex items-center gap-2">
            <Banknote size={17} className="text-[#14B8A6]" />
            <span className="text-white font-bold text-sm">Cash Payment</span>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Total due */}
          <div className="bg-[#060E1A] border border-[#0F1E38] rounded-xl px-4 py-4 text-center space-y-1">
            <p className="text-slate-500 text-xs">Total due</p>
            <p className="text-white font-bold text-3xl tabular-nums">{fmt(total)}</p>
            <p className="text-slate-500 text-sm tabular-nums">{fmtAlt(total)}</p>
            <p className="text-slate-700 text-[11px] mt-1">
              Rate: $1 = ل.ل {exchangeRate.toLocaleString("en-US")}
            </p>
          </div>

          {/* Payment inputs */}
          <div className="space-y-2.5">
            <div>
              <label className="block text-[11px] text-slate-400 font-medium mb-1.5">
                Customer paid in {symbol} — {baseCurrency}
              </label>
              <input
                type="number"
                min="0"
                step={inputStep}
                placeholder="0"
                value={paidPrimary}
                onChange={e => setPaidPrimary(e.target.value)}
                autoFocus
                className="w-full bg-[#131F35] border border-[#1E3050] focus:border-[#14B8A6]/70 focus:outline-none rounded-xl px-4 py-3 text-white text-xl font-bold placeholder-slate-700 tabular-nums transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 font-medium mb-1.5">
                Customer paid in {altSymbol} — {baseCurrency === "USD" ? "LBP" : "USD"}
              </label>
              <input
                type="number"
                min="0"
                step={altStep}
                placeholder="0"
                value={paidSecondary}
                onChange={e => setPaidSecondary(e.target.value)}
                className="w-full bg-[#131F35] border border-[#1E3050] focus:border-[#14B8A6]/70 focus:outline-none rounded-xl px-4 py-3 text-white text-xl font-bold placeholder-slate-700 tabular-nums transition-colors"
              />
            </div>
          </div>

          {/* Change box — shown as soon as user enters anything */}
          {hasInput && (
            <div className={`rounded-xl border px-4 py-4 ${
              isPending
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-emerald-500/10 border-emerald-500/30"
            }`}>
              <p className={`text-xs font-semibold mb-2 ${isPending ? "text-amber-400" : "text-emerald-400"}`}>
                {isPending ? "Still owed to customer" : "Return to customer"}
              </p>
              <div className={`text-3xl font-bold tabular-nums ${isPending ? "text-amber-400" : "text-white"}`}>
                {fmt(Math.abs(change))}
              </div>
              <div className={`text-base tabular-nums mt-1 ${isPending ? "text-amber-400/70" : "text-slate-400"}`}>
                {fmtAlt(Math.abs(change))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2.5 pt-1">
            <button
              onClick={onCancel}
              className="px-5 py-3 bg-[#131F35] hover:bg-[#1A2A44] border border-[#1E3050] text-slate-400 hover:text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(combined, paidPrimary, paidSecondary)}
              disabled={!hasInput}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] ${
                isPending && hasInput
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-900"
                  : "bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900"
              }`}
            >
              {isPending && hasInput
                ? `Charge — return ${fmt(-change)} later`
                : "Complete Sale"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
