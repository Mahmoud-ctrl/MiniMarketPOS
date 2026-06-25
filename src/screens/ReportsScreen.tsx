import { useCallback, useEffect, useState } from "react";
import {
  BarChart3, Banknote, CreditCard, Package, RefreshCw, TrendingUp, Users, Zap,
} from "lucide-react";
import { api } from "../lib/api";
import { CashierStatsRow, DailySalesRow, SalesSummary, TopCustomerRow, TopProductRow, User } from "../types";
import { useCurrency } from "../context/CurrencyContext";

interface Props { user: User }

type Period = "today" | "yesterday" | "7d" | "30d" | "month" | "all";

const PERIODS: { id: Period; label: string }[] = [
  { id: "today",     label: "Today"      },
  { id: "yesterday", label: "Yesterday"  },
  { id: "7d",        label: "7 Days"     },
  { id: "30d",       label: "30 Days"    },
  { id: "month",     label: "This Month" },
  { id: "all",       label: "All Time"   },
];

function periodRange(p: Period): { from: string | null; to: string | null } {
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOf   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

  if (p === "today") {
    return { from: startOf(now).toISOString(), to: endOf(now).toISOString() };
  }
  if (p === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { from: startOf(y).toISOString(), to: endOf(y).toISOString() };
  }
  if (p === "7d") {
    const f = new Date(now); f.setDate(f.getDate() - 6);
    return { from: startOf(f).toISOString(), to: endOf(now).toISOString() };
  }
  if (p === "30d") {
    const f = new Date(now); f.setDate(f.getDate() - 29);
    return { from: startOf(f).toISOString(), to: endOf(now).toISOString() };
  }
  if (p === "month") {
    const f = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: startOf(f).toISOString(), to: endOf(now).toISOString() };
  }
  return { from: null, to: null };
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
function BarChart({ data, fmt }: { data: DailySalesRow[]; fmt: (n: number) => string }) {
  if (data.length === 0) return (
    <div className="flex items-center justify-center h-36 text-slate-600 text-sm">No sales in this period</div>
  );

  const max = Math.max(...data.map(d => d.revenue), 1);
  const label = (date: string) => {
    const d = new Date(date + "T00:00:00");
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div className="flex items-end gap-1 h-36 px-1">
      {data.map(d => {
        const pct = (d.revenue / max) * 100;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative min-w-0">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[var(--bg-modal)] border border-[var(--bd-base)] rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
              <div className="text-[var(--tx-base)] font-semibold">{fmt(d.revenue)}</div>
              <div className="text-slate-500">{d.transactions} txn</div>
              <div className="text-slate-600">{d.date}</div>
            </div>
            {/* Bar */}
            <div
              className="w-full bg-[#14B8A6]/80 hover:bg-[#14B8A6] rounded-t-md transition-all cursor-default"
              style={{ height: `${Math.max(pct, 2)}%` }}
            />
            {/* Date label — only show every few bars if many */}
            {(data.length <= 15 || data.indexOf(d) % Math.ceil(data.length / 15) === 0) && (
              <span className="text-[9px] text-slate-600 tabular-nums leading-none">{label(d.date)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Horizontal bar row ────────────────────────────────────────────────────────
function HBar({ value, max, children }: { value: number; max: number; children: React.ReactNode }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      {children}
      <div className="h-1.5 bg-[var(--bg-raised)] rounded-full overflow-hidden">
        <div className="h-full bg-[#14B8A6] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ReportsScreen({ user: _user }: Props) {
  const { fmt } = useCurrency();

  const [period,     setPeriod]     = useState<Period>("7d");
  const [summary,    setSummary]    = useState<SalesSummary | null>(null);
  const [daily,      setDaily]      = useState<DailySalesRow[]>([]);
  const [products,   setProducts]   = useState<TopProductRow[]>([]);
  const [customers,  setCustomers]  = useState<TopCustomerRow[]>([]);
  const [cashiers,   setCashiers]   = useState<CashierStatsRow[]>([]);
  const [loading,    setLoading]    = useState(false);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    const { from, to } = periodRange(p);
    try {
      const [s, d, pr, cu, ca] = await Promise.all([
        api.getSalesSummary(from, to),
        api.getDailySales(from, to),
        api.getTopProducts(from, to, 10),
        api.getTopCustomers(from, to, 10),
        api.getCashierStats(from, to),
      ]);
      setSummary(s);
      setDaily(d);
      setProducts(pr);
      setCustomers(cu);
      setCashiers(ca);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const maxProductRev  = Math.max(...products.map(p => p.revenue),  1);
  const maxCustomerSpend = Math.max(...customers.map(c => c.total_spent), 1);
  const maxCashierSales  = Math.max(...cashiers.map(c => c.total_sales), 1);

  const cashPct   = summary ? (summary.cash_collected   / Math.max(summary.total_revenue, 1)) * 100 : 0;
  const creditPct = summary ? (summary.credit_collected / Math.max(summary.total_revenue, 1)) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-root)]">

      {/* ── Header ── */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--bd-faint)] bg-[var(--bg-panel)] flex-shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 rounded-xl bg-[#14B8A6]/15 flex items-center justify-center">
            <BarChart3 size={16} className="text-[#14B8A6]" />
          </div>
          <div>
            <h1 className="text-[var(--tx-base)] font-bold text-lg leading-none">Reports</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {PERIODS.find(p => p.id === period)?.label}
            </p>
          </div>
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-1 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl p-1">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                period === p.id
                  ? "bg-[#14B8A6] text-slate-900"
                  : "text-slate-500 hover:text-[var(--tx-base)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => load(period)}
          disabled={loading}
          className="w-8 h-8 rounded-lg bg-[var(--bg-base)] border border-[var(--bd-base)] hover:border-[#14B8A6]/50 text-slate-500 hover:text-[#14B8A6] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Revenue",       value: fmt(summary?.total_revenue     ?? 0), icon: TrendingUp,  color: "text-[#14B8A6]",   bg: "bg-[#14B8A6]/10"   },
            { label: "Transactions",  value: summary?.transaction_count ?? 0,       icon: Zap,         color: "text-indigo-400",   bg: "bg-indigo-500/10"  },
            { label: "Avg Order",     value: fmt(summary?.average_order     ?? 0), icon: BarChart3,   color: "text-sky-400",      bg: "bg-sky-500/10"     },
            { label: "Discount Given",value: fmt(summary?.total_discount    ?? 0), icon: Banknote,    color: "text-emerald-400",  bg: "bg-emerald-500/10" },
          ].map(card => (
            <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl px-5 py-4">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                <card.icon size={15} className={card.color} />
              </div>
              <div className={`font-bold text-2xl tabular-nums ${card.color}`}>{card.value}</div>
              <div className="text-slate-500 text-xs mt-1">{card.label}</div>
            </div>
          ))}
        </div>

        {/* ── Second row: extra stats ── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl px-5 py-4">
            <div className="text-slate-500 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <Banknote size={13} /> Payment Split
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Cash</span>
                  <span className="text-[var(--tx-base)] font-semibold tabular-nums">{fmt(summary?.cash_collected ?? 0)}</span>
                </div>
                <div className="h-2 bg-[var(--bg-raised)] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${cashPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Credit</span>
                  <span className="text-[var(--tx-base)] font-semibold tabular-nums">{fmt(summary?.credit_collected ?? 0)}</span>
                </div>
                <div className="h-2 bg-[var(--bg-raised)] rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-400 rounded-full transition-all duration-500" style={{ width: `${creditPct}%` }} />
                </div>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-[var(--bd-faint)]">
                <span className="text-orange-400">Debt Added</span>
                <span className="text-orange-400 font-semibold tabular-nums">{fmt(summary?.debt_added ?? 0)}</span>
              </div>
            </div>
          </div>

          <div className="col-span-2 bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl px-5 py-4">
            <div className="text-slate-500 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart3 size={13} /> Daily Sales
            </div>
            {loading
              ? <div className="flex items-center justify-center h-36 text-slate-600 text-sm">Loading…</div>
              : <BarChart data={daily} fmt={fmt} />}
          </div>
        </div>

        {/* ── Products + Customers ── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Top Products */}
          <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-4">
              <Package size={13} /> Top Products
            </div>
            {loading ? (
              <div className="text-slate-600 text-sm text-center py-6">Loading…</div>
            ) : products.length === 0 ? (
              <div className="text-slate-600 text-sm text-center py-6">No sales in this period</div>
            ) : (
              <div className="space-y-4">
                {products.map((p, i) => (
                  <HBar key={p.product_id} value={p.revenue} max={maxProductRev}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-600 text-xs w-4 text-right flex-shrink-0">#{i + 1}</span>
                        <span className="text-[var(--tx-base)] text-sm truncate">{p.product_name}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[var(--tx-base)] text-sm font-semibold tabular-nums">{fmt(p.revenue)}</div>
                        <div className="text-slate-600 text-[11px] tabular-nums">×{p.quantity_sold % 1 === 0 ? p.quantity_sold.toFixed(0) : p.quantity_sold.toFixed(1)}</div>
                      </div>
                    </div>
                  </HBar>
                ))}
              </div>
            )}
          </div>

          {/* Top Customers */}
          <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-4">
              <Users size={13} /> Top Customers
            </div>
            {loading ? (
              <div className="text-slate-600 text-sm text-center py-6">Loading…</div>
            ) : customers.length === 0 ? (
              <div className="text-slate-600 text-sm text-center py-6">No customer sales in this period</div>
            ) : (
              <div className="space-y-4">
                {customers.map((c, i) => (
                  <HBar key={c.customer_id} value={c.total_spent} max={maxCustomerSpend}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-600 text-xs w-4 text-right flex-shrink-0">#{i + 1}</span>
                        <span className="text-[var(--tx-base)] text-sm truncate">{c.customer_name}</span>
                        {c.balance_due > 0 && (
                          <span className="text-orange-400 text-[10px] flex-shrink-0">debt</span>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[var(--tx-base)] text-sm font-semibold tabular-nums">{fmt(c.total_spent)}</div>
                        <div className="text-slate-600 text-[11px]">{c.visit_count} visit{c.visit_count !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  </HBar>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Cashier Performance ── */}
        {cashiers.length > 0 && (
          <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-4">
              <CreditCard size={13} /> Cashier Performance
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--bd-base)]">
                  {["Cashier", "Transactions", "Total Sales", "Avg Order", "Share"].map(h => (
                    <th key={h} className="text-left pb-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cashiers.map(c => {
                  const share = maxCashierSales > 0 ? (c.total_sales / maxCashierSales) * 100 : 0;
                  return (
                    <tr key={c.cashier_id} className="border-b border-[var(--bd-base)]/40">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#14B8A6]/15 text-[#14B8A6] text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {c.cashier_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[var(--tx-base)] text-sm">{c.cashier_name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-400 text-sm tabular-nums">{c.transaction_count}</td>
                      <td className="py-3 pr-4 text-[var(--tx-base)] text-sm font-semibold tabular-nums">{fmt(c.total_sales)}</td>
                      <td className="py-3 pr-4 text-slate-400 text-sm tabular-nums">{fmt(c.average_order)}</td>
                      <td className="py-3 w-32">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[var(--bg-raised)] rounded-full overflow-hidden">
                            <div className="h-full bg-[#14B8A6] rounded-full" style={{ width: `${share}%` }} />
                          </div>
                          <span className="text-slate-500 text-xs tabular-nums w-8 text-right">{share.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
