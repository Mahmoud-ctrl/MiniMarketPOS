import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollText, Search, X, Banknote, CreditCard, Wallet,
  Printer, AlertTriangle, ChevronRight, ScanBarcode, UserCircle,
  Calendar, Filter,
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
  const { t } = useTranslation();
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
    }).catch(() => setError(t("transactions.failedLoad")))
      .finally(() => setLoading(false));
  }, [saleId, t]);

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

  const statusStyle = detail
    ? detail.status === "completed"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
      : detail.status === "pending"
        ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
        : "bg-red-500/15 text-red-400 border-red-500/20"
    : "";

  return (
    <Modal title={t("transactions.saleId", { id: saleId })} onClose={onClose}>
      <div className="p-6 space-y-4 w-[500px] max-w-full">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#14B8A6]/30 border-t-[#14B8A6] rounded-full animate-spin" />
          </div>
        ) : !detail ? (
          <p className="text-slate-500 text-sm">{t("transactions.notFound")}</p>
        ) : (
          <>
            {/* Status + meta strip */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--bd-base)] text-slate-400">
                <Calendar size={11} />
                {new Date(detail.created_at).toLocaleString()}
              </span>
              <span className={`px-2.5 py-1 rounded-full font-semibold border capitalize ${statusStyle}`}>
                {detail.status}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--bd-base)] text-slate-400 capitalize">
                {detail.payment_method}
              </span>
              {detail.customer_name && (
                <span className="px-2.5 py-1 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/20 text-[#14B8A6] flex items-center gap-1">
                  <UserCircle size={11} />
                  {detail.customer_name}
                </span>
              )}
            </div>

            {/* Items list */}
            <div className="space-y-1 max-h-52 overflow-y-auto rounded-xl border border-[var(--bd-base)] divide-y divide-[var(--bd-base)]">
              {detail.items.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm px-4 py-2.5 bg-[var(--bg-base)]">
                  <div className="flex-1 min-w-0">
                    <span className="text-[var(--tx-base)] font-medium">{item.product_name}</span>
                    <span className="text-slate-500 text-xs ms-2">× {item.quantity}</span>
                    {item.discount > 0 && (
                      <span className="text-emerald-400 text-xs ms-2">−{fmt(item.discount)}</span>
                    )}
                  </div>
                  <span className="text-[#14B8A6] font-bold tabular-nums">{fmt(item.subtotal)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1.5 text-sm bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl px-4 py-3">
              {detail.discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>{t("transactions.detail.discount")}</span>
                  <span className="tabular-nums">−{fmt(detail.discount)}</span>
                </div>
              )}
              {detail.tax > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>{t("transactions.detail.tva")}</span>
                  <span className="tabular-nums">{fmt(detail.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--tx-base)] font-bold text-base pt-1.5 mt-1.5 border-t border-[var(--bd-base)]">
                <span>{t("transactions.detail.total")}</span>
                <div className="text-end">
                  <div className="tabular-nums text-[#14B8A6]">{fmt(detail.total_amount)}</div>
                  <div className="text-slate-500 text-xs font-normal tabular-nums">{fmtAlt(detail.total_amount)}</div>
                </div>
              </div>
              <div className="flex justify-between text-slate-400 text-xs pt-1">
                <span>{t("transactions.detail.paid")}</span>
                <span className="tabular-nums">{fmt(detail.amount_paid)}</span>
              </div>
              {detail.change_given > 0 && (
                <div className="flex justify-between text-slate-400 text-xs">
                  <span>{t("transactions.detail.change")}</span>
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
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleReprint}
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-card)] hover:bg-[var(--bg-raised)] border border-[var(--bd-base)] text-slate-300 text-sm font-medium rounded-xl transition-colors cursor-pointer"
              >
                <Printer size={14} /> {t("transactions.reprint")}
              </button>

              {canVoid && (
                <button
                  onClick={handleVoid}
                  disabled={voiding}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 ms-auto"
                >
                  <AlertTriangle size={14} />
                  {voiding ? t("transactions.voiding") : t("transactions.void")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Pill group helper ─────────────────────────────────────────────────────────
function PillGroup<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; label: string }[];
  value:   T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl p-1 gap-0.5">
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            value === o.id
              ? "bg-[#14B8A6] text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
const PAGE = 50;

export default function TransactionsScreen({ user }: Props) {
  const { t } = useTranslation();
  const { fmt } = useCurrency();

  const [sales,    setSales]    = useState<Sale[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [hasMore,  setHasMore]  = useState(false);
  const [offset,   setOffset]   = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const [barcode,  setBarcode]  = useState("");
  const [range,    setRange]    = useState<DateRange>("all");
  const [statusF,  setStatusF]  = useState<StatusFilter>("all");
  const [payF,     setPayF]     = useState<PayFilter>("all");
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

  useEffect(() => {
    setOffset(0);
    fetchSales(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, statusF, payF, barcode]);

  const handleVoided = () => fetchSales(true);

  const dateOpts: { id: DateRange; label: string }[] = [
    { id: "today", label: t("transactions.dateRange.today") },
    { id: "week",  label: t("transactions.dateRange.week")  },
    { id: "month", label: t("transactions.dateRange.month") },
    { id: "all",   label: t("transactions.dateRange.all")   },
  ];
  const statusOpts: { id: StatusFilter; label: string }[] = [
    { id: "all",       label: t("transactions.status.all")       },
    { id: "pending",   label: t("transactions.status.pending")   },
    { id: "completed", label: t("transactions.status.completed") },
    { id: "void",      label: t("transactions.status.void")      },
  ];
  const payOpts: { id: PayFilter; label: string }[] = [
    { id: "all",    label: t("transactions.payment.all")    },
    { id: "cash",   label: t("transactions.payment.cash")   },
    { id: "card",   label: t("transactions.payment.card")   },
    { id: "wallet", label: t("transactions.payment.wallet") },
  ];

  const periodTotal = sales.reduce((s, x) => s + (x.status !== "void" ? x.total_amount : 0), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-deep)]">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-[var(--bd-faint)] space-y-4 bg-[var(--bg-panel)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center">
              <ScrollText size={18} className="text-[#14B8A6]" />
            </div>
            <div>
              <h1 className="text-[var(--tx-base)] font-bold text-lg leading-tight">{t("transactions.title")}</h1>
              <p className="text-slate-500 text-xs">{t("transactions.subtitle")}</p>
            </div>
          </div>
          {sales.length > 0 && (
            <div className="text-end">
              <div className="text-[#14B8A6] font-bold text-xl tabular-nums">{fmt(periodTotal)}</div>
              <div className="text-slate-500 text-xs">{sales.filter(s => s.status !== "void").length} {t("transactions.status.completed").toLowerCase()}</div>
            </div>
          )}
        </div>

        {/* Barcode search */}
        <div className="relative max-w-sm">
          <ScanBarcode size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            ref={barcodeRef}
            type="text"
            placeholder={t("transactions.searchPlaceholder")}
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            className="w-full bg-[var(--bg-base)] border border-[var(--bd-base)] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl ps-10 pe-9 py-2.5 text-[var(--tx-base)] text-sm placeholder-slate-600 transition-colors"
          />
          {barcode && (
            <button
              onClick={() => setBarcode("")}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Calendar size={13} />
          </div>
          <PillGroup options={dateOpts}   value={range}   onChange={setRange}   />
          <div className="w-px h-5 bg-[var(--bd-base)]" />
          <PillGroup options={statusOpts} value={statusF} onChange={setStatusF} />
          <div className="w-px h-5 bg-[var(--bd-base)]" />
          <div className="flex items-center gap-1.5 text-slate-600">
            <Filter size={13} />
          </div>
          <PillGroup options={payOpts}    value={payF}    onChange={setPayF}    />
        </div>
      </div>

      {/* ── List ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && sales.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#14B8A6]/30 border-t-[#14B8A6] rounded-full animate-spin" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Search size={44} strokeWidth={1} className="text-slate-800" />
            <p className="text-slate-500 text-sm">{t("transactions.noTransactions")}</p>
          </div>
        ) : (
          <>
            {sales.map(sale => {
              const Icon      = PAY_ICON[sale.payment_method] ?? Banknote;
              const isVoid    = sale.status === "void";
              const isPending = sale.status === "pending";

              const accentColor = isVoid
                ? "bg-red-500/60"
                : isPending
                  ? "bg-amber-400/70"
                  : "bg-emerald-500/70";

              const badgeStyle = isVoid
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : isPending
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

              const badgeLabel = isVoid
                ? t("transactions.status.void")
                : isPending
                  ? t("transactions.status.pending")
                  : t("transactions.status.completed");

              return (
                <button
                  key={sale.id}
                  onClick={() => setSelected(sale.id)}
                  className="w-full flex items-stretch gap-0 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl overflow-hidden hover:border-[var(--bd-strong)] hover:shadow-lg hover:shadow-black/20 transition-all cursor-pointer text-start group"
                >
                  {/* Status accent stripe */}
                  <div className={`w-1 flex-shrink-0 ${accentColor}`} />

                  <div className="flex items-center gap-3 px-4 py-3.5 flex-1 min-w-0">
                    {/* Payment icon */}
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isVoid ? "bg-[var(--bg-card)] border-[var(--bd-base)]" : "bg-[var(--bg-card)] border-[var(--bd-base)] group-hover:border-[var(--bd-strong)]"
                    }`}>
                      <Icon size={15} className={isVoid ? "text-slate-700" : "text-slate-400"} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-sm ${isVoid ? "text-slate-600" : "text-[var(--tx-base)]"}`}>
                          #{sale.id}
                        </span>
                        {sale.customer_name && (
                          <span className="flex items-center gap-1 text-[#14B8A6] text-xs">
                            <UserCircle size={11} /> {sale.customer_name}
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyle}`}>
                          {badgeLabel}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5 capitalize">
                        {new Date(sale.created_at).toLocaleString()} · {sale.payment_method}
                      </p>
                    </div>

                    {/* Amount */}
                    <div className="text-end flex-shrink-0">
                      <div className={`font-bold text-base tabular-nums ${isVoid ? "text-slate-600 line-through" : "text-[#14B8A6]"}`}>
                        {fmt(sale.total_amount)}
                      </div>
                      {sale.discount > 0 && (
                        <div className="text-emerald-400 text-[11px] tabular-nums">−{fmt(sale.discount)}</div>
                      )}
                    </div>

                    <ChevronRight size={14} className="text-slate-700 group-hover:text-slate-400 transition-colors flex-shrink-0" />
                  </div>
                </button>
              );
            })}

            {hasMore && (
              <div className="flex justify-center py-4">
                <button
                  onClick={() => fetchSales(false)}
                  disabled={loading}
                  className="px-6 py-2.5 bg-[var(--bg-base)] hover:bg-[var(--bg-card)] border border-[var(--bd-base)] text-slate-400 text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? t("common.loading") : t("transactions.loadMore")}
                </button>
              </div>
            )}
          </>
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
