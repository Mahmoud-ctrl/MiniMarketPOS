import { useEffect, useRef, useState } from "react";
import {
  ScrollText, Search, X, Banknote, CreditCard, Wallet,
  Printer, AlertTriangle, ChevronRight, ScanBarcode, UserCircle,
} from "lucide-react";
import { api } from "../lib/api";
import { Sale, SaleWithItems, User } from "../types";
import { useCurrency } from "../context/CurrencyContext";
import Modal from "../components/Modal";
import { buildReceiptHtml, doPrint } from "../lib/receipt";

interface Props { user: User }

type DateRange    = "today" | "week" | "month" | "all";
type StatusFilter = "all" | "pending" | "completed" | "void";
type PayFilter    = "all" | "cash" | "card" | "wallet";

const PAY_ICON: Record<string, typeof Banknote> = {
  cash: Banknote, card: CreditCard, wallet: Wallet,
};

function toISOStart(r: DateRange): string | undefined {
  const now = new Date();
  if (r === "today") { now.setHours(0, 0, 0, 0); return now.toISOString(); }
  if (r === "week")  { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d.toISOString(); }
  if (r === "month") { const d = new Date(now); d.setDate(d.getDate() - 29); d.setHours(0,0,0,0); return d.toISOString(); }
  return undefined;
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function TransactionDetail({
  saleId, user, onClose, onVoided,
}: {
  saleId:   number;
  user:     User;
  onClose:  () => void;
  onVoided: () => void;
}) {
  const { fmt, fmtAlt, symbol, altSymbol } = useCurrency();
  const [detail,  setDetail]  = useState<SaleWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState(false);
  const [error,   setError]   = useState("");
  const [storeInfo, setStoreInfo] = useState({ name: "", address: "", phone: "", tagline: "", logo: "" });

  useEffect(() => {
    Promise.all([
      api.getSaleById(saleId),
      api.getSettings(),
    ]).then(([sale, settings]) => {
      setDetail(sale);
      const get = (k: string) => settings.find(s => s.key === k)?.value ?? "";
      setStoreInfo({ name: get("store_name"), address: get("store_address"), phone: get("store_phone"), tagline: get("store_tagline"), logo: get("store_logo") });
    }).catch(() => setError("Failed to load transaction"))
      .finally(() => setLoading(false));
  }, [saleId]);

  const handleVoid = async () => {
    if (!detail) return;
    setVoiding(true); setError("");
    try {
      await api.voidSale(detail.id, user.id);
      onVoided();
      onClose();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? String(e));
      setVoiding(false);
    }
  };

  const handleReprint = () => {
    if (!detail) return;
    const change = detail.change_given;
    const html = buildReceiptHtml({
      saleId:        detail.id,
      cashierName:   user.full_name,
      items:         detail.items.map(i => ({ name: i.product_name, unit_price: i.unit_price, quantity: i.quantity })),
      subtotal:      detail.subtotal,
      discount:      detail.discount,
      tva:           detail.tax,
      total:         detail.total_amount,
      payMethod:     detail.payment_method,
      paidPrimary:   fmt(detail.amount_paid),
      paidSecondary: "",
      changeAmt:     change,
      isPending:     change < 0,
      fmt, fmtAlt, symbol, altSymbol,
      storeName:    storeInfo.name,
      storeAddress: storeInfo.address,
      storePhone:   storeInfo.phone,
      storeTagline: storeInfo.tagline,
      storeLogo:    storeInfo.logo,
    });
    doPrint(html);
  };

  const canVoid = (detail?.status === "completed" || detail?.status === "pending") &&
    (user.role === "admin" || user.role === "manager");

  return (
    <Modal title={`Transaction #${saleId}`} onClose={onClose}>
      <div className="p-6 space-y-4 w-[480px]">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#14B8A6]/30 border-t-[#14B8A6] rounded-full animate-spin" />
          </div>
        ) : !detail ? (
          <p className="text-slate-500 text-sm">Transaction not found.</p>
        ) : (
          <>
            {/* Meta chips */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-[#131F35] border border-[#1E3050] text-slate-400">
                {new Date(detail.created_at).toLocaleString()}
              </span>
              <span className={`px-2.5 py-1 rounded-full font-medium border ${
                detail.status === "completed"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                  : detail.status === "pending"
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                    : "bg-red-500/15 text-red-400 border-red-500/20"
              }`}>
                {detail.status}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#131F35] border border-[#1E3050] text-slate-400 capitalize">
                {detail.payment_method}
              </span>
              {detail.customer_name && (
                <span className="px-2.5 py-1 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/20 text-[#14B8A6] flex items-center gap-1">
                  <UserCircle size={11} />
                  {detail.customer_name}
                </span>
              )}
            </div>

            {/* Items */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {detail.items.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm px-3 py-2.5 bg-[#0D1526] border border-[#1A2D45] rounded-xl">
                  <div>
                    <span className="text-white font-medium">{item.product_name}</span>
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
              <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-[#1E3050]">
                <span>Total</span>
                <div className="text-right">
                  <div className="tabular-nums">{fmt(detail.total_amount)}</div>
                  <div className="text-slate-500 text-xs font-normal tabular-nums">{fmtAlt(detail.total_amount)}</div>
                </div>
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

            {/* Notes */}
            {detail.notes && (
              <div className="px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs">
                {detail.notes}
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-xs">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1 border-t border-[#1E3050]">
              <button
                onClick={handleReprint}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#131F35] hover:bg-[#1A2A44] border border-[#1E3050] text-slate-300 text-sm font-medium rounded-xl transition-colors cursor-pointer"
              >
                <Printer size={14} /> Reprint
              </button>

              {canVoid && (
                <button
                  onClick={handleVoid}
                  disabled={voiding}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 ml-auto"
                >
                  <AlertTriangle size={14} />
                  {voiding ? "Voiding…" : "Void & restore stock"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
const PAGE = 50;

export default function TransactionsScreen({ user }: Props) {
  const { fmt } = useCurrency();

  const [sales,   setSales]   = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset,  setOffset]  = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  // Filters
  const [barcode,     setBarcode]     = useState("");
  const [range,       setRange]       = useState<DateRange>("all");
  const [statusF,     setStatusF]     = useState<StatusFilter>("all");
  const [payF,        setPayF]        = useState<PayFilter>("all");
  const barcodeRef = useRef<HTMLInputElement>(null);

  const fetchSales = async (reset = false) => {
    const nextOffset = reset ? 0 : offset;
    setLoading(true);
    try {
      const rows = await api.getSales({
        dateFrom:      toISOStart(range),
        barcode:       barcode.trim() || undefined,
        status:        statusF === "all" ? undefined : statusF,
        paymentMethod: payF   === "all" ? undefined : payF,
        limit:         PAGE + 1,
        offset:        nextOffset,
      });
      const page = rows.slice(0, PAGE);
      setSales(prev => reset ? page : [...prev, ...page]);
      setHasMore(rows.length > PAGE);
      setOffset(nextOffset + PAGE);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  // Refetch whenever filters change
  useEffect(() => {
    setOffset(0);
    fetchSales(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, statusF, payF, barcode]);

  const handleVoided = () => fetchSales(true);

  const DATE_TABS: { id: DateRange; label: string }[] = [
    { id: "today", label: "Today" }, { id: "week", label: "Week" },
    { id: "month", label: "Month" }, { id: "all",  label: "All"  },
  ];
  const STATUS_TABS: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All" }, { id: "pending", label: "Pending" }, { id: "completed", label: "Completed" }, { id: "void", label: "Voided" },
  ];
  const PAY_TABS: { id: PayFilter; label: string }[] = [
    { id: "all", label: "All" }, { id: "cash", label: "Cash" },
    { id: "card", label: "Card" }, { id: "wallet", label: "Wallet" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#020817]">

      {/* ── Header + filters ────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 space-y-4 border-b border-[#0F1E38]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center">
            <ScrollText size={17} className="text-[#14B8A6]" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Transactions</h1>
            <p className="text-slate-500 text-xs mt-0.5">Search, reprint, or void sales</p>
          </div>
        </div>

        {/* Barcode search */}
        <div className="relative max-w-sm">
          <ScanBarcode size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            ref={barcodeRef}
            type="text"
            placeholder="Scan or type product barcode…"
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            className="w-full bg-[#0D1526] border border-[#1A2D45] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl pl-10 pr-9 py-2.5 text-white text-sm placeholder-slate-600 transition-colors"
          />
          {barcode && (
            <button
              onClick={() => setBarcode("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter rows */}
        <div className="flex flex-wrap gap-3">
          {/* Date range */}
          <div className="flex bg-[#0D1526] border border-[#1A2D45] rounded-xl p-1 gap-0.5">
            {DATE_TABS.map(t => (
              <button key={t.id} onClick={() => setRange(t.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${range === t.id ? "bg-[#14B8A6] text-slate-900" : "text-slate-500 hover:text-slate-300"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="flex bg-[#0D1526] border border-[#1A2D45] rounded-xl p-1 gap-0.5">
            {STATUS_TABS.map(t => (
              <button key={t.id} onClick={() => setStatusF(t.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${statusF === t.id ? "bg-[#14B8A6] text-slate-900" : "text-slate-500 hover:text-slate-300"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Payment method */}
          <div className="flex bg-[#0D1526] border border-[#1A2D45] rounded-xl p-1 gap-0.5">
            {PAY_TABS.map(t => (
              <button key={t.id} onClick={() => setPayF(t.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${payF === t.id ? "bg-[#14B8A6] text-slate-900" : "text-slate-500 hover:text-slate-300"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Transaction list ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading && sales.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#14B8A6]/30 border-t-[#14B8A6] rounded-full animate-spin" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Search size={44} strokeWidth={1} className="text-slate-800" />
            <p className="text-slate-500 text-sm">No transactions found</p>
          </div>
        ) : (
          <div className="divide-y divide-[#0F1E38]">
            {sales.map(sale => {
              const Icon = PAY_ICON[sale.payment_method] ?? Banknote;
              const isVoid    = sale.status === "void";
              const isPending = sale.status === "pending";
              return (
                <button
                  key={sale.id}
                  onClick={() => setSelected(sale.id)}
                  className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-[#0D1526] transition-colors cursor-pointer text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#0D1526] border border-[#1A2D45] flex items-center justify-center flex-shrink-0">
                    <Icon size={15} className={isVoid ? "text-slate-700" : "text-slate-400"} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isVoid ? "text-slate-600" : "text-white"}`}>
                      Sale #{sale.id}
                      {sale.customer_name && (
                        <span className="text-[#14B8A6] text-xs font-normal ml-2">· {sale.customer_name}</span>
                      )}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {new Date(sale.created_at).toLocaleString()} · {sale.payment_method}
                    </p>
                  </div>

                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    isVoid
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : isPending
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}>
                    {isVoid ? "voided" : isPending ? "pending" : "completed"}
                  </span>

                  {sale.discount > 0 && (
                    <span className="text-xs text-emerald-400 tabular-nums">−{fmt(sale.discount)}</span>
                  )}

                  <span className={`font-bold text-sm tabular-nums ${isVoid ? "text-slate-600 line-through" : "text-[#14B8A6]"}`}>
                    {fmt(sale.total_amount)}
                  </span>
                  <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
                </button>
              );
            })}

            {hasMore && (
              <div className="flex justify-center py-5">
                <button
                  onClick={() => fetchSales(false)}
                  disabled={loading}
                  className="px-6 py-2.5 bg-[#0D1526] hover:bg-[#131F35] border border-[#1A2D45] text-slate-400 text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selected !== null && (
        <TransactionDetail
          saleId={selected}
          user={user}
          onClose={() => setSelected(null)}
          onVoided={handleVoided}
        />
      )}
    </div>
  );
}
