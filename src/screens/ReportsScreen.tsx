import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3, Banknote, CreditCard, Flame, Package, RefreshCw,
  TrendingDown, TrendingUp, Users, Zap,
} from "lucide-react";
import { api } from "../lib/api";
import {
  CashierStatsRow, DailySalesRow, DailyWasteRow,
  SalesSummary, TopCustomerRow, TopProductRow, TopWasterRow, User, WasteSummary,
} from "../types";
import { useCurrency } from "../context/CurrencyContext";

interface Props { user: User }

type Period = "today" | "yesterday" | "7d" | "30d" | "month" | "all";
type View   = "sales" | "waste";

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

  if (p === "today")     return { from: startOf(now).toISOString(), to: endOf(now).toISOString() };
  if (p === "yesterday") { const y = new Date(now); y.setDate(y.getDate() - 1); return { from: startOf(y).toISOString(), to: endOf(y).toISOString() }; }
  if (p === "7d")        { const f = new Date(now); f.setDate(f.getDate() - 6); return { from: startOf(f).toISOString(), to: endOf(now).toISOString() }; }
  if (p === "30d")       { const f = new Date(now); f.setDate(f.getDate() - 29); return { from: startOf(f).toISOString(), to: endOf(now).toISOString() }; }
  if (p === "month")     { const f = new Date(now.getFullYear(), now.getMonth(), 1); return { from: startOf(f).toISOString(), to: endOf(now).toISOString() }; }
  return { from: null, to: null };
}

// ── Generic bar chart ─────────────────────────────────────────────────────────
interface BarDatum { date: string; value: number; sub: string }

function BarChart({ data, fmt, color = "#14B8A6", emptyMsg = "No data in this period" }: {
  data: BarDatum[]; fmt: (n: number) => string; color?: string; emptyMsg?: string;
}) {
  if (data.length === 0) return (
    <div className="flex items-center justify-center h-36 text-slate-600 text-sm">{emptyMsg}</div>
  );

  const max = Math.max(...data.map(d => d.value), 1);
  const label = (date: string) => {
    const d = new Date(date + "T00:00:00");
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div className="flex items-end gap-1 h-36 px-1">
      {data.map(d => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative min-w-0">
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[var(--bg-modal)] border border-[var(--bd-base)] rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
              <div className="text-[var(--tx-base)] font-semibold">{fmt(d.value)}</div>
              <div className="text-slate-500">{d.sub}</div>
              <div className="text-slate-600">{d.date}</div>
            </div>
            <div
              className="w-full rounded-t-md transition-all cursor-default hover:opacity-80"
              style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: color }}
            />
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
function HBar({ value, max, color = "bg-[#14B8A6]", children }: {
  value: number; max: number; color?: string; children: React.ReactNode;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      {children}
      <div className="h-1.5 bg-[var(--bg-raised)] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Summary stat card ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: string | number;
  icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl px-5 py-4">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        <Icon size={15} className={color} />
      </div>
      <div className={`font-bold text-2xl tabular-nums ${color}`}>{value}</div>
      <div className="text-slate-500 text-xs mt-1">{label}</div>
    </div>
  );
}

// ── Sales tab ─────────────────────────────────────────────────────────────────
function SalesTab({ summary, daily, products, customers, cashiers, loading, fmt }: {
  summary: SalesSummary | null;
  daily: DailySalesRow[];
  products: TopProductRow[];
  customers: TopCustomerRow[];
  cashiers: CashierStatsRow[];
  loading: boolean;
  fmt: (n: number) => string;
}) {
  const { t } = useTranslation();
  const maxProductRev    = Math.max(...products.map(p => p.revenue),    1);
  const maxCustomerSpend = Math.max(...customers.map(c => c.total_spent), 1);
  const maxCashierSales  = Math.max(...cashiers.map(c => c.total_sales),  1);
  const cashPct   = summary ? (summary.cash_collected   / Math.max(summary.total_revenue, 1)) * 100 : 0;
  const creditPct = summary ? (summary.credit_collected / Math.max(summary.total_revenue, 1)) * 100 : 0;

  const dailyBars: BarDatum[] = daily.map(d => ({
    date: d.date, value: d.revenue, sub: `${d.transactions} txn`,
  }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label={t("reports.summary.revenue")}       value={fmt(summary?.total_revenue     ?? 0)} icon={TrendingUp} color="text-[#14B8A6]"  bg="bg-[#14B8A6]/10" />
        <StatCard label={t("reports.summary.transactions")} value={summary?.transaction_count ?? 0}       icon={Zap}        color="text-indigo-400" bg="bg-indigo-500/10" />
        <StatCard label={t("reports.summary.avgOrder")}     value={fmt(summary?.average_order     ?? 0)} icon={BarChart3}  color="text-sky-400"    bg="bg-sky-500/10"   />
        <StatCard label={t("reports.summary.discountGiven")}value={fmt(summary?.total_discount    ?? 0)} icon={Banknote}   color="text-emerald-400" bg="bg-emerald-500/10" />
      </div>

      {/* Payment split + daily chart */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl px-5 py-4">
          <div className="text-slate-500 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
            <Banknote size={13} /> {t("reports.paymentSplit")}
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">{t("reports.cash")}</span>
                <span className="text-[var(--tx-base)] font-semibold tabular-nums">{fmt(summary?.cash_collected ?? 0)}</span>
              </div>
              <div className="h-2 bg-[var(--bg-raised)] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${cashPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">{t("reports.credit")}</span>
                <span className="text-[var(--tx-base)] font-semibold tabular-nums">{fmt(summary?.credit_collected ?? 0)}</span>
              </div>
              <div className="h-2 bg-[var(--bg-raised)] rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full transition-all duration-500" style={{ width: `${creditPct}%` }} />
              </div>
            </div>
            <div className="flex justify-between text-sm pt-1 border-t border-[var(--bd-faint)]">
              <span className="text-orange-400">{t("reports.debtAdded")}</span>
              <span className="text-orange-400 font-semibold tabular-nums">{fmt(summary?.debt_added ?? 0)}</span>
            </div>
          </div>
        </div>

        <div className="col-span-2 bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl px-5 py-4">
          <div className="text-slate-500 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart3 size={13} /> {t("reports.dailySales")}
          </div>
          {loading
            ? <div className="flex items-center justify-center h-36 text-slate-600 text-sm">{t("common.loading")}</div>
            : <BarChart data={dailyBars} fmt={fmt} emptyMsg={t("reports.noData")} />}
        </div>
      </div>

      {/* Products + Customers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-4">
            <Package size={13} /> {t("reports.topProducts")}
          </div>
          {loading ? (
            <div className="text-slate-600 text-sm text-center py-6">{t("common.loading")}</div>
          ) : products.length === 0 ? (
            <div className="text-slate-600 text-sm text-center py-6">{t("reports.noData")}</div>
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

        <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-4">
            <Users size={13} /> {t("reports.topCustomers")}
          </div>
          {loading ? (
            <div className="text-slate-600 text-sm text-center py-6">{t("common.loading")}</div>
          ) : customers.length === 0 ? (
            <div className="text-slate-600 text-sm text-center py-6">{t("reports.noData")}</div>
          ) : (
            <div className="space-y-4">
              {customers.map((c, i) => (
                <HBar key={c.customer_id} value={c.total_spent} max={maxCustomerSpend}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-600 text-xs w-4 text-right flex-shrink-0">#{i + 1}</span>
                      <span className="text-[var(--tx-base)] text-sm truncate">{c.customer_name}</span>
                      {c.balance_due > 0 && <span className="text-orange-400 text-[10px] flex-shrink-0">debt</span>}
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

      {/* Cashier performance */}
      {cashiers.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-4">
            <CreditCard size={13} /> {t("reports.cashierPerf")}
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
  );
}

// ── Waste tab ─────────────────────────────────────────────────────────────────
function WasteTab({ summary, daily, wasters, loading, fmt }: {
  summary: WasteSummary | null;
  daily: DailyWasteRow[];
  wasters: TopWasterRow[];
  loading: boolean;
  fmt: (n: number) => string;
}) {
  const { t } = useTranslation();
  const maxWasteValue = Math.max(...wasters.map(w => w.waste_value), 1);

  const dailyBars: BarDatum[] = daily.map(d => ({
    date: d.date,
    value: d.waste_value,
    sub: `${d.waste_events} event${d.waste_events !== 1 ? "s" : ""}`,
  }));

  const hasData = (summary?.total_waste_events ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label={t("reports.wasteSummary.totalLoss")}
          value={fmt(summary?.total_waste_value ?? 0)}
          icon={TrendingDown}
          color="text-red-400"
          bg="bg-red-500/10"
        />
        <StatCard
          label={t("reports.wasteSummary.events")}
          value={summary?.total_waste_events ?? 0}
          icon={Flame}
          color="text-orange-400"
          bg="bg-orange-500/10"
        />
        <StatCard
          label={t("reports.wasteSummary.unitsWasted")}
          value={(summary?.total_waste_qty ?? 0) % 1 === 0
            ? String(summary?.total_waste_qty ?? 0)
            : (summary?.total_waste_qty ?? 0).toFixed(2)}
          icon={Package}
          color="text-amber-400"
          bg="bg-amber-500/10"
        />
      </div>

      {!hasData && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600 gap-3">
          <Flame size={40} strokeWidth={1} className="text-slate-700" />
          <p className="text-sm">{t("reports.noWaste")}</p>
          <p className="text-xs text-slate-700">{t("reports.noWasteHint")}</p>
        </div>
      )}

      {(hasData || loading) && (
        <>
          {/* Daily waste chart */}
          <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-slate-500 text-xs uppercase tracking-wider flex items-center gap-2">
                <BarChart3 size={13} /> {t("reports.dailyWaste")}
              </div>
              <span className="text-slate-600 text-xs">cost × qty wasted per day</span>
            </div>
            {loading
              ? <div className="flex items-center justify-center h-36 text-slate-600 text-sm">{t("common.loading")}</div>
              : <BarChart data={dailyBars} fmt={fmt} color="#f97316" emptyMsg={t("reports.noWaste")} />}
          </div>

          {/* Top wasters table */}
          <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-5">
              <Flame size={13} className="text-orange-400" /> {t("reports.topWasters")}
            </div>
            {loading ? (
              <div className="text-slate-600 text-sm text-center py-6">{t("common.loading")}</div>
            ) : wasters.length === 0 ? (
              <div className="text-slate-600 text-sm text-center py-6">{t("reports.noWaste")}</div>
            ) : (
              <div className="space-y-5">
                {wasters.map((w, i) => (
                  <HBar key={w.product_id} value={w.waste_value} max={maxWasteValue} color="bg-orange-400">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-600 text-xs w-4 text-right flex-shrink-0">#{i + 1}</span>
                        <span className="text-[var(--tx-base)] text-sm truncate">{w.product_name}</span>
                        <span className="text-slate-600 text-xs flex-shrink-0">{w.unit}</span>
                      </div>
                      <div className="flex items-center gap-5 flex-shrink-0 text-right">
                        <div>
                          <div className="text-red-400 text-sm font-semibold tabular-nums">{fmt(w.waste_value)}</div>
                          <div className="text-slate-600 text-[11px]">loss</div>
                        </div>
                        <div>
                          <div className="text-slate-300 text-sm tabular-nums">
                            {w.waste_qty % 1 === 0 ? w.waste_qty.toFixed(0) : w.waste_qty.toFixed(2)} {w.unit}
                          </div>
                          <div className="text-slate-600 text-[11px]">wasted</div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-sm tabular-nums">{w.waste_events}×</div>
                          <div className="text-slate-600 text-[11px]">events</div>
                        </div>
                      </div>
                    </div>
                  </HBar>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ReportsScreen({ user: _user }: Props) {
  const { t } = useTranslation();
  const { fmt } = useCurrency();

  const [period,  setPeriod]  = useState<Period>("7d");
  const [view,    setView]    = useState<View>("sales");
  const [loading, setLoading] = useState(false);

  // Sales state
  const [summary,   setSummary]   = useState<SalesSummary | null>(null);
  const [daily,     setDaily]     = useState<DailySalesRow[]>([]);
  const [products,  setProducts]  = useState<TopProductRow[]>([]);
  const [customers, setCustomers] = useState<TopCustomerRow[]>([]);
  const [cashiers,  setCashiers]  = useState<CashierStatsRow[]>([]);

  // Waste state
  const [wasteSummary, setWasteSummary] = useState<WasteSummary | null>(null);
  const [dailyWaste,   setDailyWaste]   = useState<DailyWasteRow[]>([]);
  const [wasters,      setWasters]      = useState<TopWasterRow[]>([]);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    const { from, to } = periodRange(p);
    try {
      const [s, d, pr, cu, ca, ws, dw, tw] = await Promise.all([
        api.getSalesSummary(from, to),
        api.getDailySales(from, to),
        api.getTopProducts(from, to, 10),
        api.getTopCustomers(from, to, 10),
        api.getCashierStats(from, to),
        api.getWasteSummary(from, to),
        api.getDailyWaste(from, to),
        api.getTopWasters(from, to, 10),
      ]);
      setSummary(s);    setDaily(d);       setProducts(pr);
      setCustomers(cu); setCashiers(ca);
      setWasteSummary(ws); setDailyWaste(dw); setWasters(tw);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-root)]">

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--bd-faint)] bg-[var(--bg-panel)] flex-shrink-0">

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl p-1">
          <button
            onClick={() => setView("sales")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${view === "sales" ? "bg-[#14B8A6] text-slate-900" : "text-slate-500 hover:text-[var(--tx-base)]"}`}
          >
            <TrendingUp size={12} /> {t("reports.sales")}
          </button>
          <button
            onClick={() => setView("waste")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${view === "waste" ? "bg-orange-500 text-white" : "text-slate-500 hover:text-[var(--tx-base)]"}`}
          >
            <Flame size={12} /> {t("reports.waste")}
          </button>
        </div>

        <div className="text-slate-600 text-xs">
          {PERIODS.find(p => p.id === period)?.label}
        </div>

        <div className="flex-1" />

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

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {view === "sales" ? (
          <SalesTab
            summary={summary} daily={daily} products={products}
            customers={customers} cashiers={cashiers}
            loading={loading} fmt={fmt}
          />
        ) : (
          <WasteTab
            summary={wasteSummary} daily={dailyWaste} wasters={wasters}
            loading={loading} fmt={fmt}
          />
        )}
      </div>

    </div>
  );
}
