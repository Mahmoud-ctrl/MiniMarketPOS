import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText, Search, X, Banknote, CreditCard, Wallet,
  Printer, AlertTriangle, ChevronRight, ScanBarcode, UserCircle,
  Calendar, Filter, RotateCcw, CheckCircle2,
} from "lucide-react";
import { api } from "../lib/api";
import { Sale, SaleReturnItem, SaleWithItems, User } from "../types";
import { useCurrency } from "../context/CurrencyContext";
import Modal from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { PillGroup } from "../components/PillGroup";
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

// ── Return modal ──────────────────────────────────────────────────────────────
function ReturnModal({
  detail, user, onClose, onReturned,
}: {
  detail:     SaleWithItems;
  user:       User;
  onClose:    () => void;
  onReturned: () => void;
}) {
  const { t } = useTranslation();
  const { fmt } = useCurrency();

  const [prior,       setPrior]      = useState<SaleReturnItem[]>([]);
  const [returnQtys,  setReturnQtys] = useState<Record<number, number>>({});
  const [resellable,  setResellable] = useState<Record<number, boolean>>({});
  const [processing,  setProcessing] = useState(false);
  const [error,       setError]      = useState("");
  const [done,        setDone]       = useState(false);

  useEffect(() => {
    api.getSaleReturnItems(detail.id).then(rows => {
      setPrior(rows);
      const qtys: Record<number, number> = {};
      const res:  Record<number, boolean> = {};
      for (const item of detail.items) { qtys[item.id] = 0; res[item.id] = true; }
      setReturnQtys(qtys);
      setResellable(res);
    }).catch(() => {});
  }, [detail.id, detail.items]);

  const returnedMap: Record<number, number> = {};
  for (const p of prior) {
    returnedMap[p.sale_item_id] = (returnedMap[p.sale_item_id] ?? 0) + p.quantity;
  }

  const refundTotal = detail.items.reduce((s, item) => {
    const qty = returnQtys[item.id] ?? 0;
    return s + item.unit_price * qty;
  }, 0);

  const hasAny = Object.values(returnQtys).some(q => q > 0);

  const handleSubmit = async () => {
    setProcessing(true); setError("");
    try {
      const items = detail.items
        .filter(i => (returnQtys[i.id] ?? 0) > 0)
        .map(i => ({
          sale_item_id:  i.id,
          quantity:      returnQtys[i.id],
          is_resellable: resellable[i.id] ?? true,
        }));
      await api.createPartialReturn({
        original_sale_id: detail.id,
        cashier_id:       user.id,
        items,
      });
      setDone(true);
      onReturned();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Return failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal title={t("transactions.return.title", { id: detail.id })} onClose={onClose}>
      <div className="p-6 space-y-4 w-[520px] max-w-full">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 size={40} className="text-emerald-400" />
            <p className="text-[var(--tx-base)] font-bold">{t("transactions.return.success")}</p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-bold rounded-xl cursor-pointer"
            >
              {t("common.close")}
            </button>
          </div>
        ) : (
          <>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{t("transactions.return.itemsLabel")}</div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {detail.items.map(item => {
                const alreadyReturned = returnedMap[item.id] ?? 0;
                const maxReturn = item.quantity - alreadyReturned;
                if (maxReturn <= 0) return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl opacity-40">
                    <div className="flex-1 min-w-0">
                      <div className="text-[var(--tx-base)] text-sm font-medium truncate">{item.product_name}</div>
                      <div className="text-slate-500 text-xs">{t("transactions.return.alreadyReturned")}</div>
                    </div>
                  </div>
                );
                return (
                  <div key={item.id} className="px-4 py-3 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-[var(--tx-base)] text-sm font-medium truncate">{item.product_name}</div>
                        <div className="text-slate-500 text-xs tabular-nums">
                          {fmt(item.unit_price)} · {t("transactions.return.soldQty", { qty: item.quantity })}
                          {alreadyReturned > 0 && ` · ${t("transactions.return.returnedQty", { qty: alreadyReturned })}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => setReturnQtys(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] ?? 0) - 1) }))}
                          className="w-7 h-7 rounded-lg bg-[var(--bg-card)] border border-[var(--bd-base)] text-slate-400 hover:text-[var(--tx-base)] flex items-center justify-center transition-colors cursor-pointer"
                        >−</button>
                        <span className="text-[var(--tx-base)] font-bold text-sm tabular-nums w-6 text-center">
                          {returnQtys[item.id] ?? 0}
                        </span>
                        <button
                          onClick={() => setReturnQtys(prev => ({ ...prev, [item.id]: Math.min(maxReturn, (prev[item.id] ?? 0) + 1) }))}
                          className="w-7 h-7 rounded-lg bg-[var(--bg-card)] border border-[var(--bd-base)] text-slate-400 hover:text-[#14B8A6] flex items-center justify-center transition-colors cursor-pointer"
                        >+</button>
                        <button
                          onClick={() => setReturnQtys(prev => ({ ...prev, [item.id]: maxReturn }))}
                          className="text-xs text-slate-600 hover:text-slate-400 transition-colors cursor-pointer px-1"
                        >{t("transactions.return.all")}</button>
                      </div>
                    </div>
                    {(returnQtys[item.id] ?? 0) > 0 && (
                      <div className="flex items-center gap-4 pt-1">
                        <span className="text-xs text-slate-500">{t("transactions.return.condition")}</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`resellable-${item.id}`}
                            checked={resellable[item.id] !== false}
                            onChange={() => setResellable(prev => ({ ...prev, [item.id]: true }))}
                            className="accent-[#14B8A6]"
                          />
                          <span className="text-xs text-[var(--tx-base)]">{t("transactions.return.resellable")}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`resellable-${item.id}`}
                            checked={resellable[item.id] === false}
                            onChange={() => setResellable(prev => ({ ...prev, [item.id]: false }))}
                            className="accent-red-400"
                          />
                          <span className="text-xs text-red-400">{t("transactions.return.damaged")}</span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {refundTotal > 0 && (
              <div className="flex justify-between items-center px-4 py-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                <span className="text-emerald-400 text-sm font-semibold">{t("transactions.return.refundTotal")}</span>
                <span className="text-emerald-400 font-bold text-lg tabular-nums">{fmt(refundTotal)}</span>
              </div>
            )}

            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--bd-base)] text-slate-400 text-sm font-semibold hover:text-[var(--tx-base)] transition-colors cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!hasAny || processing}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {processing ? (
                  <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                ) : (
                  <RotateCcw size={14} />
                )}
                {t("transactions.return.submit")}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
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
  const [detail,     setDetail]     = useState<SaleWithItems | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [voiding,    setVoiding]    = useState(false);
  const [error,      setError]      = useState("");
  const [showReturn, setShowReturn] = useState(false);
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

  const canVoid   = (detail?.status === "completed" || detail?.status === "pending") &&
    (user.role === "admin" || user.role === "manager");
  const canReturn = (detail?.status === "completed" || detail?.status === "pending" || detail?.status === "refunded") &&
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
            <div className="flex gap-2 pt-1 flex-wrap">
              <button
                onClick={handleReprint}
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-card)] hover:bg-[var(--bg-raised)] border border-[var(--bd-base)] text-slate-300 text-sm font-medium rounded-xl transition-colors cursor-pointer"
              >
                <Printer size={14} /> {t("transactions.reprint")}
              </button>

              {canReturn && (
                <button
                  onClick={() => setShowReturn(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw size={14} /> {t("transactions.returnItems")}
                </button>
              )}

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

            {showReturn && detail && (
              <ReturnModal
                detail={detail}
                user={user}
                onClose={() => setShowReturn(false)}
                onReturned={() => { onVoided(); setShowReturn(false); }}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}


// ── Transaction card ───────────────────────────────────────────────────────────
function TransactionCard({
  sale, index, onSelect, fmt, t,
}: {
  sale:     Sale;
  index:    number;
  onSelect: (id: number) => void;
  fmt:      (n: number) => string;
  t:        ReturnType<typeof useTranslation>["t"];
}) {
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
    <motion.button
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.18), ease: "easeOut" }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => onSelect(sale.id)}
      className="group relative h-52 text-left rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between overflow-hidden bg-[var(--bg-panel)] border border-[var(--bd-base)] hover:border-[var(--tx-base)] hover:shadow-xl cursor-pointer"
    >
      {/* Status accent stripe (top edge) */}
      <div className={`absolute top-0 inset-x-6 h-[2px] opacity-20 transition-opacity group-hover:opacity-100 ${accentColor}`} />

      {/* Top content */}
      <div className="flex-1 pr-1">
        <div className="flex justify-between items-start">
          <p className="text-lg font-bold leading-tight line-clamp-2 text-[var(--tx-base)] max-w-[75%]">
            #{sale.id}
          </p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyle}`}>
            {badgeLabel}
          </span>
        </div>
        
        <div className="flex flex-col mt-2">
          {sale.customer_name ? (
            <span className="text-xs font-semibold uppercase tracking-widest text-[#14B8A6] truncate flex items-center gap-1">
              <UserCircle size={12} className="flex-shrink-0" />
              {sale.customer_name}
            </span>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 truncate">
              {t("transactions.customer.walkIn", "Walk-in")}
            </span>
          )}
          <span className="text-xs text-slate-400 mt-1 truncate capitalize flex items-center gap-1.5">
            <Icon size={12} /> {sale.payment_method} · {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Bottom metrics */}
      <div className="mt-2 flex items-end justify-between z-0">
        <div>
          <div className={`text-3xl font-black tabular-nums tracking-tight leading-none ${isVoid ? "text-slate-600 line-through" : "text-[#14B8A6]"}`}>
            {fmt(sale.total_amount)}
          </div>
          {sale.discount > 0 && (
            <div className="text-xs font-bold uppercase tracking-widest mt-1 text-emerald-500">
              −{fmt(sale.discount)}
            </div>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-[var(--bg-base)] border border-[var(--bd-base)] flex items-center justify-center transition-colors group-hover:border-[var(--tx-base)]">
          <ChevronRight size={14} className="text-slate-400 group-hover:text-[var(--tx-base)]" />
        </div>
      </div>
    </motion.button>
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
      <PageHeader
        icon={<ScrollText size={22} className="text-[#14B8A6]" />}
        title={t("transactions.title")}
        subtitle={t("transactions.subtitle")}
        stats={
          sales.length > 0 ? (
            <div className="text-end">
              <div className="text-[#14B8A6] font-bold text-xl tabular-nums">{fmt(periodTotal)}</div>
              <div className="text-slate-500 text-xs">{sales.filter(s => s.status !== "void").length} {t("transactions.status.completed").toLowerCase()}</div>
            </div>
          ) : null
        }
        searchBlock={
          <div className="relative group">
            <ScanBarcode size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#14B8A6] transition-colors pointer-events-none" />
            <input
              ref={barcodeRef}
              type="text"
              placeholder={t("transactions.searchPlaceholder")}
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              className="w-full bg-[var(--bg-panel)] border border-[var(--bd-base)] focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20 focus:outline-none rounded-2xl ps-12 pe-10 py-3 text-[var(--tx-base)] text-sm font-medium placeholder-slate-400 shadow-sm transition-all"
            />
            {barcode && (
              <button
                onClick={() => setBarcode("")}
                className="absolute end-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--tx-base)] cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>
        }
        filtersBlock={
          <>
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
          </>
        }
      />

      {/* ── Grid ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <AnimatePresence initial={false} mode="popLayout">
                {sales.map((sale, idx) => (
                  <TransactionCard
                    key={sale.id}
                    sale={sale}
                    index={idx}
                    onSelect={setSelected}
                    fmt={fmt}
                    t={t}
                  />
                ))}
              </AnimatePresence>
            </div>

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