import { useEffect, useState } from "react";
import { BarChart3, Banknote, CreditCard, Wallet, ChevronRight, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { Sale, SaleWithItems, User } from "../types";
import { useCurrency } from "../context/CurrencyContext";
import Modal from "../components/Modal";

interface Props { user: User }

const PAY_ICON: Record<string, typeof Banknote> = {
  cash:   Banknote,
  card:   CreditCard,
  wallet: Wallet,
};

type DateRange = "today" | "week" | "month" | "all";

function rangeLabel(r: DateRange) {
  return r === "today" ? "Today" : r === "week" ? "This week" : r === "month" ? "This month" : "All time";
}

function toISOStart(r: DateRange): string | undefined {
  const now = new Date();
  if (r === "today") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  if (r === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (r === "month") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return undefined;
}

function SaleDetailModal({ saleId, user, onClose }: { saleId: number; user: User; onClose: () => void }) {
  const { fmt } = useCurrency();
  const [detail, setDetail] = useState<SaleWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => {
    api.getSaleById(saleId)
      .then(setDetail)
      .catch(() => setError("Failed to load sale details"))
      .finally(() => setLoading(false));
  }, [saleId]);

  const handleVoid = async () => {
    if (!detail) return;
    setVoiding(true); setError("");
    try {
      await api.voidSale(detail.id, user.id);
      onClose();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? String(e));
      setVoiding(false);
    }
  };

  const canVoid = (user.role === "admin" || user.role === "manager") && detail?.status === "completed";

  return (
    <Modal title={`Sale #${saleId}`} onClose={onClose}>
      <div className="p-6 space-y-4 min-w-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#14B8A6]/30 border-t-[#14B8A6] rounded-full animate-spin" />
          </div>
        ) : !detail ? (
          <p className="text-slate-500 text-sm">Sale not found.</p>
        ) : (
          <>
            {/* Header meta */}
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-[#131F35] border border-[#1E3050] text-slate-400">
                {new Date(detail.created_at).toLocaleString()}
              </span>
              <span className={`px-2.5 py-1 rounded-full font-medium ${
                detail.status === "completed"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/15 text-red-400 border border-red-500/20"
              }`}>
                {detail.status}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#131F35] border border-[#1E3050] text-slate-400 capitalize">
                {detail.payment_method}
              </span>
            </div>

            {/* Items */}
            <div className="space-y-1.5">
              {detail.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm px-3 py-2.5 bg-[#0D1526] border border-[#1A2D45] rounded-xl">
                  <div>
                    <span className="text-white font-medium">Product #{item.product_id}</span>
                    <span className="text-slate-500 text-xs ml-2">× {item.quantity}</span>
                    {item.discount > 0 && (
                      <span className="text-emerald-400 text-xs ml-2">−{fmt(item.discount)}</span>
                    )}
                  </div>
                  <span className="text-[#14B8A6] font-bold tabular-nums">{fmt(item.subtotal)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1.5 pt-2 border-t border-[#1E3050] text-sm">
              {detail.discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount</span>
                  <span className="tabular-nums">−{fmt(detail.discount)}</span>
                </div>
              )}
              {detail.tax > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>TVA</span>
                  <span className="tabular-nums">{fmt(detail.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-bold text-base pt-1">
                <span>Total</span>
                <span className="tabular-nums">{fmt(detail.total_amount)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Paid</span>
                <span className="tabular-nums">{fmt(detail.amount_paid)}</span>
              </div>
              {detail.change_given > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Change</span>
                  <span className="tabular-nums">{fmt(detail.change_given)}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {canVoid && (
              <div className="flex justify-end pt-2 border-t border-[#1E3050]">
                <button
                  onClick={handleVoid}
                  disabled={voiding}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  <AlertTriangle size={13} />
                  {voiding ? "Voiding…" : "Void sale & restore stock"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export default function ReportsScreen({ user }: Props) {
  const { fmt } = useCurrency();
  const [range, setRange]       = useState<DateRange>("today");
  const [sales, setSales]       = useState<Sale[]>([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const load = (r: DateRange) => {
    setLoading(true);
    api.getSales({ dateFrom: toISOStart(r), limit: 200 })
      .then(setSales)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(range); }, [range]);

  const totalRevenue  = sales.reduce((s, t) => s + t.total_amount, 0);
  const totalDiscount = sales.reduce((s, t) => s + t.discount, 0);
  const avgTicket     = sales.length > 0 ? totalRevenue / sales.length : 0;

  const byMethod = sales.reduce<Record<string, number>>((acc, s) => {
    acc[s.payment_method] = (acc[s.payment_method] ?? 0) + s.total_amount;
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto bg-[#020817] p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center">
            <BarChart3 size={17} className="text-[#14B8A6]" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Reports</h1>
            <p className="text-slate-500 text-xs mt-0.5">Sales history & summary</p>
          </div>
        </div>

        {/* Date range tabs */}
        <div className="flex bg-[#0D1526] border border-[#1A2D45] rounded-xl p-1 gap-0.5">
          {(["today", "week", "month", "all"] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                range === r ? "bg-[#14B8A6] text-slate-900" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {rangeLabel(r)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Transactions",   value: String(sales.length),  sub: rangeLabel(range) },
          { label: "Total Revenue",  value: fmt(totalRevenue),      sub: "after discounts" },
          { label: "Avg Ticket",     value: fmt(avgTicket),         sub: "per transaction" },
          { label: "Total Discount", value: fmt(totalDiscount),     sub: "given out" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-[#060E1A] border border-[#0F1E38] rounded-2xl p-4">
            <p className="text-slate-500 text-xs mb-1">{label}</p>
            <p className="text-white font-bold text-2xl tabular-nums">{value}</p>
            <p className="text-slate-600 text-[11px] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Payment breakdown */}
      {Object.keys(byMethod).length > 0 && (
        <div className="flex gap-3">
          {Object.entries(byMethod).map(([method, amount]) => {
            const Icon = PAY_ICON[method] ?? Banknote;
            const pct  = totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0;
            return (
              <div key={method} className="flex items-center gap-3 bg-[#060E1A] border border-[#0F1E38] rounded-xl px-4 py-3">
                <Icon size={15} className="text-[#14B8A6]" />
                <div>
                  <p className="text-white text-sm font-semibold capitalize tabular-nums">{fmt(amount)}</p>
                  <p className="text-slate-500 text-xs capitalize">{method} — {pct}%</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sales list */}
      <div className="bg-[#060E1A] border border-[#0F1E38] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#0F1E38]">
          <p className="text-white font-semibold text-sm">{sales.length} transactions</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#14B8A6]/30 border-t-[#14B8A6] rounded-full animate-spin" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <BarChart3 size={44} strokeWidth={1} className="text-slate-800" />
            <p className="text-slate-500 text-sm">No transactions yet for {rangeLabel(range).toLowerCase()}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#0F1E38]">
            {sales.map((sale) => {
              const Icon = PAY_ICON[sale.payment_method] ?? Banknote;
              return (
                <button
                  key={sale.id}
                  onClick={() => setSelected(sale.id)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-[#0D1526] transition-colors cursor-pointer text-left"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#0D1526] border border-[#1A2D45] flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-slate-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">Sale #{sale.id}</p>
                    <p className="text-slate-500 text-xs">
                      {new Date(sale.created_at).toLocaleString()} · {sale.payment_method}
                    </p>
                  </div>

                  {sale.discount > 0 && (
                    <span className="text-xs text-emerald-400 tabular-nums">−{fmt(sale.discount)}</span>
                  )}

                  <span className="text-[#14B8A6] font-bold text-sm tabular-nums">{fmt(sale.total_amount)}</span>
                  <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected !== null && (
        <SaleDetailModal
          saleId={selected}
          user={user}
          onClose={() => { setSelected(null); load(range); }}
        />
      )}
    </div>
  );
}
