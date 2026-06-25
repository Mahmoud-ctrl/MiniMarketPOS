import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, CheckCircle2, Delete, Printer, User, X } from "lucide-react";
import { api } from "../lib/api";
import { Customer, Sale } from "../types";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";

type PayMode = "full" | "partial" | "debt";

export interface SaleCompleteData {
  sale:          Sale;
  amountPaid:    number;
  paidPrimary:   string;
  paidSecondary: string;
  method:        "cash" | "credit";
}

interface Props {
  cashierId:      number;
  sessionId:      number | null;
  onClose:        () => void;
  onSaleComplete: (data: SaleCompleteData) => void;
}

const NUMPAD_KEYS = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  [".", "0", "⌫"],
] as const;

export default function CheckoutModal({ cashierId, sessionId, onClose, onSaleComplete }: Props) {
  const { baseCurrency, exchangeRate, symbol, altSymbol, fmt, fmtAlt, fromDb, toDb, inputDecimals } = useCurrency();
  const { items, discount, subtotal, tva } = useCart();

  const [mode,        setMode]       = useState<PayMode>("full");
  const [tendered,    setTendered]   = useState("");
  const [useAlt,      setUseAlt]     = useState(false);
  const [customer,    setCustomer]   = useState<Customer | null>(null);
  const [query,       setQuery]      = useState("");
  const [suggestions, setSugg]       = useState<Customer[]>([]);
  const [showSugg,    setShowSugg]   = useState(false);
  const [processing,  setProcessing] = useState(false);
  const [error,       setError]      = useState<string | null>(null);
  const suggRef = useRef<HTMLDivElement>(null);

  const isUSD = baseCurrency === "USD";

  // ── Alt-currency helpers ────────────────────────────────────────────────────
  const altDecimals = isUSD ? 0 : 2;

  const altToDb = (s: string): number => {
    const n = parseFloat(s || "0");
    if (isNaN(n)) return 0;
    return isUSD ? Math.round((n / exchangeRate) * 100) : Math.round(n * exchangeRate);
  };

  const altFromDb = (n: number): string =>
    isUSD
      ? String(Math.round((n / 100) * exchangeRate))
      : (n / exchangeRate).toFixed(2);

  const activeDecimals = useAlt ? altDecimals : inputDecimals;
  const activeFmt      = useAlt ? fmtAlt : fmt;
  const activeFromDb   = useAlt ? altFromDb : fromDb;
  const activeToCents  = (s: string) => useAlt ? altToDb(s) : toDb(s);

  // ── Totals ──────────────────────────────────────────────────────────────────
  const total         = subtotal - discount + tva;
  const tenderedCents = activeToCents(tendered);
  const change        = mode === "full" ? Math.max(0, tenderedCents - total) : 0;
  const debtAmount    = mode === "debt"
    ? total
    : mode === "partial" ? Math.max(0, total - tenderedCents) : 0;

  const canConfirm =
    items.length > 0 && !processing &&
    (mode === "full"
      ? tenderedCents >= total
      : customer !== null && (mode === "debt" || (tenderedCents > 0 && tenderedCents < total)));

  // ── Numpad ──────────────────────────────────────────────────────────────────
  const appendKey = useCallback((key: string) => {
    setTendered(prev => {
      if (key === "⌫") return prev.slice(0, -1);
      if (key === ".") {
        if (activeDecimals === 0 || prev.includes(".")) return prev;
        return (prev === "" ? "0" : prev) + ".";
      }
      if (key === "00" || key === "000") {
        if (prev === "" || prev === "0") return "0";
        return prev + key;
      }
      if (prev === "0") return key;
      const dotIdx = prev.indexOf(".");
      if (dotIdx >= 0 && prev.length - dotIdx - 1 >= activeDecimals) return prev;
      return prev + key;
    });
  }, [activeDecimals]);

  const setExact = useCallback(
    () => setTendered(activeFromDb(total)),
    [activeFromDb, total],
  );

  const switchCurrency = (toAlt: boolean) => {
    setUseAlt(toAlt);
    setTendered("");
  };

  // ── Customer search ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (query.length < 1) { setSugg([]); return; }
    const t = setTimeout(async () => {
      try { setSugg(await api.searchCustomers(query)); setShowSugg(true); }
      catch { /* silent */ }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggRef.current && !suggRef.current.contains(e.target as Node)) setShowSugg(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Checkout ────────────────────────────────────────────────────────────────
  const handleConfirm = async (shouldPrint: boolean) => {
    if (!canConfirm) return;
    setProcessing(true);
    setError(null);
    try {
      const amountPaid = mode === "debt" ? 0 : tenderedCents;
      const sale = await api.createSale({
        session_id:     sessionId ?? undefined,
        cashier_id:     cashierId,
        customer_id:    customer?.id,
        items: items.map(i => ({
          product_id: i.product.id,
          quantity:   i.quantity,
          unit_price: i.unit_price,
          unit_cost:  i.product.cost_price,
          price_tier: i.price_tier,
          discount:   i.discount * i.quantity,
          tva_amount: i.product.apply_tva
            ? Math.round(i.unit_price * i.quantity * i.product.tva_rate) : 0,
        })),
        discount,
        amount_paid:    amountPaid,
        payment_method: mode === "full" ? "cash" : "credit",
      });

      const paidPrimary = amountPaid > 0
        ? (useAlt ? `${altSymbol} ${tendered}` : fmt(amountPaid))
        : "";
      const paidSecondary = amountPaid > 0
        ? (useAlt ? fmt(amountPaid) : fmtAlt(amountPaid))
        : "";

      if (shouldPrint) window.print();

      onSaleComplete({
        sale,
        amountPaid,
        paidPrimary,
        paidSecondary,
        method: mode === "full" ? "cash" : "credit",
      });
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Sale failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const selectCustomer = (c: Customer) => { setCustomer(c); setQuery(""); setShowSugg(false); };

  const createAndSelect = async () => {
    const name = query.trim();
    if (!name) return;
    try { selectCustomer(await api.createCustomerQuick(name)); }
    catch (e: unknown) { setError((e as { message?: string })?.message ?? "Failed to create customer"); }
  };

  // ── Currency toggle pill ────────────────────────────────────────────────────
  const CurrencyToggle = () => (
    <div className="flex items-center gap-1 bg-[var(--bg-deep)] border border-[var(--bd-base)] rounded-lg p-0.5">
      <button
        onClick={() => switchCurrency(false)}
        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
          !useAlt ? "bg-[#14B8A6] text-slate-900" : "text-slate-500 hover:text-slate-300"
        }`}
      >
        {symbol}
      </button>
      <button
        onClick={() => switchCurrency(true)}
        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
          useAlt ? "bg-[#14B8A6] text-slate-900" : "text-slate-500 hover:text-slate-300"
        }`}
      >
        {altSymbol}
      </button>
    </div>
  );

  // ── Main checkout screen ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div
        className="bg-[var(--bg-panel)] border border-[var(--bd-base)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 940, maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--bd-base)] flex-shrink-0">
          <h2 className="text-[var(--tx-base)] font-bold text-lg">Checkout</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg-raised)] text-slate-500 hover:text-[var(--tx-base)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: order summary */}
          <div className="w-[360px] flex-shrink-0 border-r border-[var(--bd-base)] flex flex-col">
            <div className="px-5 py-3 border-b border-[var(--bd-faint)] flex-shrink-0">
              <span className="text-slate-500 text-xs uppercase tracking-widest">Order Summary</span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {items.map(item => (
                <div key={item.product.id} className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[var(--tx-base)] text-sm font-medium leading-snug truncate">{item.product.name}</div>
                    <div className="text-slate-500 text-xs mt-0.5 tabular-nums">{fmt(item.unit_price)} × {item.quantity}</div>
                  </div>
                  <div className="text-[var(--tx-base)] text-sm font-semibold tabular-nums flex-shrink-0">
                    {fmt(item.unit_price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--bd-base)] px-5 py-5 space-y-2.5 flex-shrink-0">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal</span><span className="tabular-nums">{fmt(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-emerald-400">
                  <span>Discount</span><span className="tabular-nums">−{fmt(discount)}</span>
                </div>
              )}
              {tva > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>TVA</span><span className="tabular-nums">{fmt(tva)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-3 border-t border-[var(--bd-base)]">
                <span className="text-[var(--tx-base)] font-bold text-base">Total</span>
                <div className="text-right">
                  <div className="text-[#14B8A6] font-bold text-3xl tabular-nums">{fmt(total)}</div>
                  <div className="text-slate-500 text-xs tabular-nums mt-0.5">{fmtAlt(total)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: payment */}
          <div className="flex-1 flex flex-col gap-5 p-6 overflow-y-auto">

            {/* Mode tabs */}
            <div className="grid grid-cols-3 gap-3">
              {(["full", "partial", "debt"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setTendered(""); setError(null); }}
                  className={`py-3.5 rounded-xl font-semibold text-sm border transition-all cursor-pointer ${
                    mode === m
                      ? "bg-[#14B8A6]/15 border-[#14B8A6]/50 text-[#14B8A6]"
                      : "bg-[var(--bg-base)] border-[var(--bd-base)] text-slate-400 hover:border-[var(--bd-strong)] hover:text-slate-300"
                  }`}
                >
                  {m === "full" ? "Full Payment" : m === "partial" ? "Partial" : "Full Debt"}
                </button>
              ))}
            </div>

            {/* Customer — required for partial / debt */}
            {(mode === "partial" || mode === "debt") && (
              <div ref={suggRef} className="relative">
                <div className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                  <span className="uppercase tracking-widest">Customer</span>
                  <span className="text-red-400 text-[10px]">required</span>
                </div>
                {customer ? (
                  <div className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-card)] border border-[#14B8A6]/40 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-[#14B8A6]/15 flex items-center justify-center flex-shrink-0">
                      <User size={15} className="text-[#14B8A6]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[var(--tx-base)] text-sm font-semibold">{customer.name}</div>
                      {customer.phone && <div className="text-slate-500 text-xs">{customer.phone}</div>}
                    </div>
                    <button onClick={() => setCustomer(null)} className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Search by name or phone…"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onFocus={() => query.length > 0 && setShowSugg(true)}
                      className="w-full px-4 py-3 bg-[var(--bg-base)] border border-[var(--bd-base)] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl text-[var(--tx-base)] text-sm placeholder-slate-600 transition-colors"
                    />
                    {showSugg && (suggestions.length > 0 || query.trim().length > 0) && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-modal)] border border-[var(--bd-base)] rounded-xl overflow-hidden z-20 shadow-xl">
                        {suggestions.map(c => (
                          <button key={c.id} onMouseDown={() => selectCustomer(c)} className="w-full text-left px-4 py-3 hover:bg-[var(--bg-raised)] transition-colors flex items-center gap-3 cursor-pointer">
                            <User size={14} className="text-slate-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[var(--tx-base)] text-sm">{c.name}</div>
                              {c.phone && <div className="text-slate-500 text-xs">{c.phone}</div>}
                            </div>
                          </button>
                        ))}
                        {query.trim().length > 0 && (
                          <button onMouseDown={createAndSelect} className="w-full text-left px-4 py-3 border-t border-[var(--bd-faint)] hover:bg-[var(--bg-raised)] transition-colors text-[#14B8A6] text-sm cursor-pointer">
                            + Create new: &ldquo;{query.trim()}&rdquo;
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Numpad (Full + Partial) */}
            {mode !== "debt" && (
              <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-3">

                  <div className="bg-[var(--bg-deep)] border border-[var(--bd-base)] rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-500 text-xs uppercase tracking-wider">
                        {mode === "partial" ? "Paying now" : "Tendered"}
                      </span>
                      <CurrencyToggle />
                    </div>
                    <div className="text-[var(--tx-base)] text-3xl font-bold tabular-nums text-right">
                      {tendered
                        ? <>{useAlt ? altSymbol : symbol} {tendered}</>
                        : <span className="text-slate-600">—</span>}
                    </div>
                    {tendered && tenderedCents > 0 && (
                      <div className="text-slate-500 text-xs tabular-nums text-right mt-1 flex items-center justify-end gap-1">
                        <ArrowLeftRight size={10} />
                        {activeFmt(tenderedCents)}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={setExact}
                    className="w-full py-2.5 rounded-xl bg-[var(--bg-raised)] border border-[var(--bd-base)] hover:border-[#14B8A6]/50 text-slate-400 hover:text-[#14B8A6] text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Exact — {fmt(total)}{useAlt && <span className="text-slate-600 font-normal"> ({fmtAlt(total)})</span>}
                  </button>

                  <div className="grid grid-cols-3 gap-2">
                    {(activeDecimals === 0
                      ? [["7","8","9"],["4","5","6"],["1","2","3"],["00","0","⌫"]]
                      : NUMPAD_KEYS
                    ).flat().map((key, idx) => (
                      <button
                        key={idx}
                        onClick={() => appendKey(key)}
                        className={`h-14 rounded-xl text-lg font-semibold border transition-all active:scale-95 cursor-pointer ${
                          key === "⌫"
                            ? "bg-[var(--bg-raised)] border-[var(--bd-base)] text-red-400 hover:border-red-400/40 hover:bg-red-400/10"
                            : "bg-[var(--bg-card)] border-[var(--bd-base)] text-[var(--tx-base)] hover:border-[#14B8A6]/40 hover:text-[#14B8A6]"
                        }`}
                      >
                        {key === "⌫" ? <Delete size={18} className="mx-auto" /> : key}
                      </button>
                    ))}
                  </div>

                  {activeDecimals === 0 && (
                    <button
                      onClick={() => appendKey("000")}
                      className="w-full h-12 rounded-xl text-lg font-semibold border bg-[var(--bg-card)] border-[var(--bd-base)] text-[var(--tx-base)] hover:border-[#14B8A6]/40 hover:text-[#14B8A6] transition-all active:scale-95 cursor-pointer"
                    >
                      000
                    </button>
                  )}

                  <button
                    onClick={() => setTendered("")}
                    className="w-full h-11 rounded-xl text-sm font-bold border bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all active:scale-95 cursor-pointer tracking-widest"
                  >
                    AC
                  </button>
                </div>

                <div className="w-44 flex flex-col justify-end gap-3">
                  {mode === "full" && tenderedCents > 0 && tenderedCents >= total && (
                    <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 text-center">
                      <div className="text-emerald-400 text-[11px] uppercase tracking-wider mb-1.5">Change</div>
                      <div className="text-emerald-400 font-bold text-2xl tabular-nums">{activeFmt(change)}</div>
                    </div>
                  )}
                  {mode === "full" && tenderedCents > 0 && tenderedCents < total && (
                    <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 text-center">
                      <div className="text-red-400 text-[11px] uppercase tracking-wider mb-1.5">Short by</div>
                      <div className="text-red-400 font-bold text-2xl tabular-nums">{activeFmt(total - tenderedCents)}</div>
                    </div>
                  )}
                  {mode === "partial" && tenderedCents > 0 && debtAmount > 0 && (
                    <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl p-4 text-center">
                      <div className="text-orange-400 text-[11px] uppercase tracking-wider mb-1.5">Remaining Debt</div>
                      <div className="text-orange-400 font-bold text-2xl tabular-nums">{activeFmt(debtAmount)}</div>
                    </div>
                  )}
                  {mode === "partial" && tenderedCents >= total && tenderedCents > 0 && (
                    <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 text-center">
                      <div className="text-red-400 text-xs text-center leading-snug">Amount ≥ total.<br />Use Full Payment.</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Debt info card */}
            {mode === "debt" && (
              <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl p-6 text-center">
                <div className="text-orange-400 text-sm mb-3">Full amount will be recorded as customer debt</div>
                <div className="text-orange-400 font-bold text-4xl tabular-nums mb-1">{fmt(total)}</div>
                <div className="text-orange-400/60 text-sm tabular-nums">{fmtAlt(total)}</div>
              </div>
            )}

            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
            )}

            <div className="mt-auto flex gap-3">
              <button
                onClick={() => handleConfirm(true)}
                disabled={!canConfirm}
                className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl font-bold text-sm border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--bg-card)] hover:bg-[var(--bg-raised)] border-[var(--bd-base)] hover:border-[#14B8A6]/50 text-[var(--tx-base)] hover:text-[#14B8A6] active:scale-[0.98]"
              >
                {processing ? (
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                ) : (
                  <Printer size={16} />
                )}
                Print
              </button>
              <button
                onClick={() => handleConfirm(false)}
                disabled={!canConfirm}
                className="flex-1 py-4 rounded-xl font-bold text-[15px] transition-all duration-150 flex items-center justify-center gap-2.5 cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed bg-[#14B8A6] hover:bg-[#0D9488] active:scale-[0.98] text-slate-900 shadow-[#14B8A6]/25"
              >
                {processing ? (
                  <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    {mode === "full" && `Charge ${fmt(total)}`}
                    {mode === "partial" && tendered
                      ? `Pay ${fmt(tenderedCents)} · Debt ${fmt(debtAmount)}`
                      : mode === "partial" ? "Enter amount paid" : ""}
                    {mode === "debt" && `Record ${fmt(total)} as Debt`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
