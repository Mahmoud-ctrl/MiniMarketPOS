import {
  Minus, Plus, ShoppingBag, X, CheckCircle, Printer,
  ChevronLeft, ChevronRight, PlusCircle, Gift, Pause, ArrowRightLeft, GitMerge, Package2, Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart, type PromoCartItem } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import { CartItem, Sale, User } from "../types";
import CheckoutModal, { SaleCompleteData } from "./CheckoutModal";
import { buildReceiptHtml, doPrint } from "../lib/receipt";

interface Props {
  user:           User;
  sessionId:      number | null;
  onSaleComplete: () => void;
}

// ── Receipt view ──────────────────────────────────────────────────────────────

interface ReceiptData {
  sale:          Sale;
  snapshot:      CartItem[];
  promoSnapshot: PromoCartItem[];
  paidPrimary:   string;
  paidSecondary: string;
  amountPaid:    number;
  method:        "cash" | "credit";
}

function ReceiptView({
  sale, items, promoItems, method, paidPrimary, paidSecondary, amountPaid,
  cashierName, storeInfo, onDone,
}: {
  sale:          Sale;
  items:         CartItem[];
  promoItems:    PromoCartItem[];
  method:        "cash" | "credit";
  paidPrimary:   string;
  paidSecondary: string;
  amountPaid:    number;
  cashierName:   string;
  storeInfo:     { name: string; address: string; phone: string; tagline: string; logo: string };
  onDone:        () => void;
}) {
  const { t } = useTranslation();
  const { fmt, fmtAlt, showAlt, symbol, altSymbol } = useCurrency();
  const change    = amountPaid - sale.total_amount;
  const isPending = change < 0;

  const handlePrint = () => {
    const allItems = [
      ...items.map(i => ({ name: i.product.name, unit_price: i.unit_price, quantity: i.quantity })),
      ...promoItems.map(i => ({ name: `${i.product.name} [FREE]`, unit_price: 0, quantity: i.quantity })),
    ];
    const html = buildReceiptHtml({
      saleId: sale.id, cashierName,
      items: allItems,
      subtotal: sale.subtotal, discount: sale.discount, tva: sale.tax, total: sale.total_amount,
      payMethod: method, paidPrimary, paidSecondary,
      changeAmt: Math.abs(change), isPending,
      fmt, fmtAlt, symbol, altSymbol,
      storeName: storeInfo.name, storeAddress: storeInfo.address,
      storePhone: storeInfo.phone, storeTagline: storeInfo.tagline, storeLogo: storeInfo.logo,
    });
    doPrint(html);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col items-center justify-center gap-3 py-6 border-b border-[var(--bd-faint)]">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
          isPending ? "bg-amber-500/15 border border-amber-500/30" : "bg-emerald-500/15 border border-emerald-500/30"
        }`}>
          <CheckCircle size={28} className={isPending ? "text-amber-400" : "text-emerald-400"} />
        </div>
        <div className="text-center">
          <p className="text-[var(--tx-base)] font-bold text-base leading-none">
            {isPending ? t("cart.saleCompleteDebt") : t("cart.saleComplete")}
          </p>
          <p className="text-slate-500 text-xs mt-1">{t("cart.receipt", { id: sale.id })}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
        {items.map((item) => (
          <div key={item.lineId} className="flex items-center justify-between text-sm px-3 py-2 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl">
            <div className="flex-1 min-w-0">
              <span className="text-[var(--tx-base)] font-medium truncate block">{item.product.name}</span>
              <span className="text-slate-500 text-xs">{fmt(item.unit_price)} × {item.quantity}</span>
            </div>
            <span className="text-slate-400 font-semibold tabular-nums ms-3">
              {fmt(item.unit_price * item.quantity)}
            </span>
          </div>
        ))}
        {promoItems.map((item) => (
          <div key={item.lineId} className="flex items-center justify-between text-sm px-3 py-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <Gift size={12} className="text-emerald-400 flex-shrink-0" />
              <span className="text-emerald-400 font-medium truncate">{item.product.name}</span>
              <span className="text-emerald-400/60 text-xs">× {item.quantity}</span>
            </div>
            <span className="text-emerald-400 font-bold text-xs ms-2">{t("cart.freeItem")}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--bd-faint)] px-5 py-4 space-y-2">
        {sale.discount > 0 && (
          <div className="flex justify-between text-sm text-emerald-400">
            <span>{t("cart.discount")}</span><span className="tabular-nums">−{fmt(sale.discount)}</span>
          </div>
        )}
        {sale.tax > 0 && (
          <div className="flex justify-between text-sm text-slate-500">
            <span>{t("cart.tva")}</span><span className="tabular-nums">{fmt(sale.tax)}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-1 border-t border-[var(--bd-base)]">
          <span className="text-[var(--tx-base)] font-bold">{t("cart.total")}</span>
          <div className="text-end">
            <div className="text-[#14B8A6] font-bold text-xl tabular-nums">{fmt(sale.total_amount)}</div>
            {showAlt && <div className="text-slate-600 text-[10px] tabular-nums leading-tight mt-0.5">{fmtAlt(sale.total_amount)}</div>}
          </div>
        </div>
        {method === "cash" && amountPaid > 0 && Math.abs(change) > 0 && (
          <div className={`flex justify-between items-center px-3 py-2.5 rounded-xl border text-sm font-bold ${
            isPending
              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}>
            <span>{isPending ? t("cart.stillOwed") : t("cart.change")}</span>
            <div className="text-end">
              <div className="tabular-nums">{fmt(Math.abs(change))}</div>
              {showAlt && <div className="text-xs opacity-70 tabular-nums">{fmtAlt(Math.abs(change))}</div>}
            </div>
          </div>
        )}
        {method === "credit" && (
          <div className="flex justify-between items-center px-3 py-2.5 rounded-xl border bg-orange-500/10 border-orange-500/20 text-orange-400 text-sm font-bold">
            <span>{t("cart.recordedAsDebt")}</span>
            <div className="tabular-nums">{fmt(sale.total_amount - amountPaid)}</div>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--bg-card)] hover:bg-[var(--bg-raised)] border border-[var(--bd-base)] text-slate-400 text-sm font-medium rounded-xl transition-colors cursor-pointer flex-shrink-0"
          >
            <Printer size={15} /> {t("cart.print")}
          </button>
          <button
            onClick={onDone}
            className="flex-1 py-3 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] active:scale-[0.98] text-slate-900 font-bold text-[15px] transition-all cursor-pointer shadow-lg shadow-[#14B8A6]/25"
          >
            {t("cart.newSale")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Book navigator ────────────────────────────────────────────────────────────

function BookNav({
  tabs, activeTabId, activeIdx, onPrev, onNext, onJump, onAdd, onRemove, onHold, onMerge,
}: {
  tabs:        { id: number; label: string; itemCount: number; confirmed: boolean; isHeld: boolean }[];
  activeTabId: number;
  activeIdx:   number;
  onPrev:      () => void;
  onNext:      () => void;
  onJump:      (id: number) => void;
  onAdd:       () => void;
  onRemove:    (id: number) => void;
  onHold:      () => void;
  onMerge:     (fromTabId: number) => void;
}) {
  const { t } = useTranslation();
  const active = tabs[activeIdx];
  const [showMerge, setShowMerge] = useState(false);
  const otherTabs = tabs.filter(t => t.id !== activeTabId && !t.confirmed);

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--bd-faint)]">

      <button
        onClick={onPrev}
        disabled={activeIdx === 0}
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-[var(--tx-base)] hover:bg-[var(--bg-base)] disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[var(--tx-base)] font-semibold text-sm leading-none truncate">
            {active?.label}
          </span>
          {active?.isHeld && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium leading-none">
              {t("cart.heldBadge")}
            </span>
          )}
          {active?.confirmed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium leading-none">
              {t("cart.orderDone")}
            </span>
          )}
          {active && active.itemCount > 0 && !active.confirmed && !active.isHeld && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#14B8A6]/15 text-[#14B8A6] font-medium leading-none tabular-nums">
              {active.itemCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onJump(tab.id)}
              className={`rounded-full transition-all cursor-pointer ${
                tab.id === activeTabId
                  ? "w-4 h-1.5 bg-[#14B8A6]"
                  : tab.confirmed
                  ? "w-1.5 h-1.5 bg-emerald-600/60 hover:bg-emerald-400"
                  : tab.isHeld
                  ? "w-1.5 h-1.5 bg-amber-500/60 hover:bg-amber-400"
                  : tab.itemCount > 0
                  ? "w-1.5 h-1.5 bg-slate-500 hover:bg-slate-300"
                  : "w-1.5 h-1.5 bg-[var(--bd-base)] hover:bg-slate-500"
              }`}
            />
          ))}
        </div>

        <span className="text-slate-700 text-[10px] leading-none select-none">
          {t("cart.orderNav", { current: activeIdx + 1, total: tabs.length })}
        </span>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Hold toggle */}
        {active && !active.confirmed && (
          <button
            onClick={onHold}
            title={active.isHeld ? t("cart.unhold") : t("cart.hold")}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
              active.isHeld
                ? "text-amber-400 bg-amber-400/15 hover:bg-amber-400/25"
                : "text-slate-700 hover:text-amber-400 hover:bg-amber-400/10"
            }`}
          >
            <Pause size={13} />
          </button>
        )}

        {/* Merge */}
        {otherTabs.length > 0 && active && !active.confirmed && (
          <div className="relative">
            <button
              onClick={() => setShowMerge(v => !v)}
              title={t("cart.merge")}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-700 hover:text-purple-400 hover:bg-purple-400/10 transition-colors cursor-pointer"
            >
              <GitMerge size={13} />
            </button>
            {showMerge && (
              <div className="absolute bottom-full right-0 mb-1 bg-[var(--bg-panel)] border border-[var(--bd-base)] rounded-xl shadow-xl z-10 overflow-hidden min-w-[140px]">
                <div className="px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider border-b border-[var(--bd-base)]">
                  {t("cart.mergeFrom")}
                </div>
                {otherTabs.map(ot => (
                  <button
                    key={ot.id}
                    onClick={() => { onMerge(ot.id); setShowMerge(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--tx-base)] hover:bg-[var(--bg-raised)] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="font-medium">{ot.label}</span>
                    {ot.itemCount > 0 && <span className="text-slate-500 text-xs">({ot.itemCount})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Remove tab */}
        {tabs.length > 1 && active && (
          <button
            onClick={() => onRemove(active.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            title={t("cart.closeOrder")}
          >
            <X size={13} />
          </button>
        )}

        {/* Add tab */}
        <button
          onClick={onAdd}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-[#14B8A6] hover:bg-[#14B8A6]/10 transition-colors cursor-pointer"
          title={t("cart.newOrder")}
        >
          <PlusCircle size={17} />
        </button>
      </div>

      <button
        onClick={onNext}
        disabled={activeIdx === tabs.length - 1}
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-[var(--tx-base)] hover:bg-[var(--bg-base)] disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ── Main CartPanel ────────────────────────────────────────────────────────────

export default function CartPanel({ user, sessionId, onSaleComplete }: Props) {
  const { t } = useTranslation();
  const { fmt, fmtAlt, showAlt, symbol, altSymbol, fromDb, exchangeRate } = useCurrency();
  const {
    items, promoItems, changeQty, setQty, removeFromCart, clearCart,
    subtotal, discount, tva,
    tabs, activeTabId, addTab, removeTab, switchTab,
    holdTab, moveLineToTab, mergeTabs, setUnit,
  } = useCart();

  const [receipts,     setReceipts]     = useState<Record<number, ReceiptData>>({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [moveMenuLine, setMoveMenuLine] = useState<number | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError,   setQuickError]   = useState<string | null>(null);

  const receipt = receipts[activeTabId];

  const [storeInfo, setStoreInfo] = useState({ name: "", address: "", phone: "", tagline: "", logo: "" });
  useEffect(() => {
    api.getSettings().then(settings => {
      const get = (k: string) => settings.find(s => s.key === k)?.value ?? "";
      setStoreInfo({ name: get("store_name"), address: get("store_address"), phone: get("store_phone"), tagline: get("store_tagline"), logo: get("store_logo") });
    }).catch(() => {});
  }, []);

  const total    = subtotal - discount + tva;
  const canStart = items.length > 0 && sessionId !== null;

  const bookTabs = useMemo(
    () => tabs.map(tab => ({ ...tab, confirmed: !!receipts[tab.id] })),
    [tabs, receipts],
  );
  const activeIdx = bookTabs.findIndex(tab => tab.id === activeTabId);

  const goPrev = () => { if (activeIdx > 0) switchTab(bookTabs[activeIdx - 1].id); };
  const goNext = () => { if (activeIdx < bookTabs.length - 1) switchTab(bookTabs[activeIdx + 1].id); };

  // Declared here; populated after all handlers are defined below
  const kbRef = useRef<{
    goPrev: () => void; goNext: () => void; addTab: () => void; holdTab: () => void; clearCart: () => void;
    canStart: boolean; showCheckout: boolean; setShowCheckout: (v: boolean) => void;
    handleQuickCheckout: () => Promise<void>;
    receipt: ReceiptData | undefined; quickLoading: boolean;
  } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      const ctx = kbRef.current;
      if (!ctx) return;
      if (e.key === "ArrowLeft"  && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); ctx.goPrev(); }
      if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); ctx.goNext(); }
      if ((e.key === "n" && (e.ctrlKey || e.metaKey)) || e.key === "F8")   { e.preventDefault(); ctx.addTab(); }
      if (e.key === "F9")                                                    { e.preventDefault(); ctx.holdTab(); }
      if (e.key === "Delete" && !ctx.showCheckout && !ctx.receipt)          { e.preventDefault(); ctx.clearCart(); }
      if (e.key === "F5" && ctx.canStart && !ctx.showCheckout && !ctx.receipt) {
        e.preventDefault(); ctx.setShowCheckout(true);
      }
      if (e.key === "F6" && ctx.canStart && !ctx.showCheckout && !ctx.receipt && !ctx.quickLoading) {
        e.preventDefault(); ctx.handleQuickCheckout();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaleComplete = (data: SaleCompleteData) => {
    const snapshot      = [...items];
    const promoSnapshot = [...promoItems];
    clearCart();
    setShowCheckout(false);
    setReceipts(prev => ({
      ...prev,
      [activeTabId]: {
        sale:          data.sale,
        snapshot,
        promoSnapshot,
        paidPrimary:   data.paidPrimary,
        paidSecondary: data.paidSecondary,
        amountPaid:    data.amountPaid,
        method:        data.method,
      },
    }));
    onSaleComplete();
  };

  // F6 — quick cash sale with exact amount, auto-prints receipt, no modal
  const handleQuickCheckout = async () => {
    if (!canStart || showCheckout || quickLoading) return;
    const itemsSnap = [...items];
    const promoSnap = [...promoItems];
    const saleTotal = total;
    setQuickLoading(true);
    setQuickError(null);
    try {
      const saleItems = [
        ...itemsSnap.map(i => ({
          product_id: i.product.id,
          quantity:   i.quantity * i.unit_multiplier,
          unit_price: i.unit_multiplier > 1 ? Math.round(i.unit_price / i.unit_multiplier) : i.unit_price,
          unit_cost:  i.product.cost_price,
          price_tier: i.price_tier,
          discount:   i.discount * i.quantity,
          tva_amount: i.product.apply_tva
            ? Math.round(i.unit_price * i.quantity * i.product.tva_rate) : 0,
        })),
        ...promoSnap.map(i => ({
          product_id: i.product.id,
          quantity:   i.quantity * i.unit_multiplier,
          unit_price: i.unit_multiplier > 1 ? Math.round(i.unit_price / i.unit_multiplier) : i.unit_price,
          unit_cost:  i.product.cost_price,
          price_tier: i.price_tier,
          discount:   i.unit_price * i.quantity,
          tva_amount: 0,
        })),
      ];
      const sale = await api.createSale({
        session_id:             sessionId ?? undefined,
        cashier_id:             user.id,
        items:                  saleItems,
        discount,
        amount_paid:            saleTotal,
        payment_method:         "cash",
        paid_primary:           saleTotal,
        paid_secondary:         0,
        exchange_rate_snapshot: Math.round(exchangeRate),
      });
      // Print before clearing cart
      const allPrintItems = [
        ...itemsSnap.map(i => ({ name: i.product.name, unit_price: i.unit_price, quantity: i.quantity })),
        ...promoSnap.map(i => ({ name: `${i.product.name} [FREE]`, unit_price: 0, quantity: i.quantity })),
      ];
      const qcPaidPrimary = fromDb(saleTotal); // bare number string; receipt.ts prepends symbol
      const html = buildReceiptHtml({
        saleId:       sale.id,
        cashierName:  user.full_name,
        items:        allPrintItems,
        subtotal:     sale.subtotal,
        discount:     sale.discount,
        tva:          sale.tax,
        total:        sale.total_amount,
        payMethod:    "cash",
        paidPrimary:  qcPaidPrimary,
        paidSecondary: "",
        changeAmt:    0,
        isPending:    false,
        fmt, fmtAlt, symbol, altSymbol,
        storeName:    storeInfo.name,
        storeAddress: storeInfo.address,
        storePhone:   storeInfo.phone,
        storeTagline: storeInfo.tagline,
        storeLogo:    storeInfo.logo,
      });
      doPrint(html);
      handleSaleComplete({
        sale,
        amountPaid:    saleTotal,
        paidPrimary:   qcPaidPrimary,
        paidSecondary: "",
        method:        "cash",
      });
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "Quick checkout failed";
      setQuickError(msg);
      setTimeout(() => setQuickError(null), 3500);
    } finally {
      setQuickLoading(false);
    }
  };

  // Always keep ref in sync so the keyboard handler sees the latest state
  kbRef.current = { goPrev, goNext, addTab, holdTab, clearCart, canStart, showCheckout, setShowCheckout, handleQuickCheckout, receipt, quickLoading };

  const clearReceipt = () =>
    setReceipts(prev => { const n = { ...prev }; delete n[activeTabId]; return n; });

  const handleRemoveTab = (tabId: number) => {
    setReceipts(prev => { const n = { ...prev }; delete n[tabId]; return n; });
    removeTab(tabId);
  };

  const checkoutLabel = !sessionId
    ? t("cart.checkoutNoSession")
    : items.length === 0
    ? t("cart.checkoutEmpty")
    : t("cart.checkout", { amount: fmt(total) });

  const otherTabs = bookTabs.filter(t => t.id !== activeTabId && !t.confirmed);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="w-[400px] h-full flex-shrink-0 flex flex-col border-s border-[var(--bd-faint)] bg-[var(--bg-panel)]">

        <BookNav
          tabs={bookTabs}
          activeTabId={activeTabId}
          activeIdx={activeIdx}
          onPrev={goPrev}
          onNext={goNext}
          onJump={switchTab}
          onAdd={addTab}
          onRemove={handleRemoveTab}
          onHold={holdTab}
          onMerge={mergeTabs}
        />

        {receipt ? (
          <ReceiptView
            sale={receipt.sale}
            items={receipt.snapshot}
            promoItems={receipt.promoSnapshot}
            method={receipt.method}
            paidPrimary={receipt.paidPrimary}
            paidSecondary={receipt.paidSecondary}
            amountPaid={receipt.amountPaid}
            cashierName={user.full_name}
            storeInfo={storeInfo}
            onDone={clearReceipt}
          />
        ) : (
          <>
            {/* ── Cart header ── */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--bd-faint)]">
              <div className="flex items-center gap-2">
                <ShoppingBag size={14} className={items.length ? "text-[#14B8A6]" : "text-slate-700"} />
                <span className="text-slate-500 text-xs">
                  {items.length === 0
                    ? t("cart.empty")
                    : t("cart.items", { count: items.reduce((s, i) => s + i.quantity, 0) })}
                </span>
              </div>
              {items.length > 0 && (
                <button onClick={clearCart} className="text-slate-600 hover:text-red-400 text-xs transition-colors cursor-pointer">
                  {t("cart.clear")}
                </button>
              )}
            </div>

            {/* ── Items ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <ShoppingBag size={44} strokeWidth={1} className="text-slate-800" />
                  <p className="text-sm text-slate-600">{t("cart.emptyHint")}</p>
                </div>
              ) : (
                <>
                  {items.map((item) => {
                    const hasPack = item.product.packaging_qty > 1;
                    const isPack  = item.unit_multiplier > 1;
                    const basePrice = isPack
                      ? Math.round(item.unit_price / item.unit_multiplier)
                      : item.unit_price;

                    return (
                      <div key={item.lineId} className="fade-in bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-[var(--tx-base)] text-sm font-semibold leading-snug line-clamp-2">
                              {item.product.name}
                            </div>
                            {item.product.is_variable_price && (
                              <span className="text-[10px] text-purple-400 font-medium">variable price</span>
                            )}
                          </div>

                          {/* Split / move to another tab */}
                          {otherTabs.length > 0 && (
                            <div className="relative flex-shrink-0">
                              <button
                                onClick={() => setMoveMenuLine(moveMenuLine === item.lineId ? null : item.lineId)}
                                className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-700 hover:text-[#14B8A6] hover:bg-[#14B8A6]/10 transition-colors cursor-pointer"
                                title={t("cart.moveTo")}
                              >
                                <ArrowRightLeft size={11} />
                              </button>
                              {moveMenuLine === item.lineId && (
                                <div className="absolute top-full right-0 mt-1 bg-[var(--bg-panel)] border border-[var(--bd-base)] rounded-xl shadow-xl z-10 min-w-[130px] overflow-hidden">
                                  {otherTabs.map(ot => (
                                    <button
                                      key={ot.id}
                                      onClick={() => { moveLineToTab(item.lineId, ot.id); setMoveMenuLine(null); }}
                                      className="w-full text-left px-3 py-2 text-xs text-[var(--tx-base)] hover:bg-[var(--bg-raised)] flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <ArrowRightLeft size={10} className="text-slate-500" />
                                      {ot.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <button
                            onClick={() => removeFromCart(item.lineId)}
                            className="text-slate-700 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0 mt-0.5"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs tabular-nums">{fmt(item.unit_price)}</span>
                          <span className="text-slate-700 text-xs">×</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => changeQty(item.lineId, -1)}
                              className="w-7 h-7 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-raised)] text-slate-400 hover:text-[var(--tx-base)] flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={e => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v > 0) setQty(item.lineId, v);
                              }}
                              onFocus={e => e.target.select()}
                              className="w-10 text-[var(--tx-base)] text-sm font-bold text-center tabular-nums bg-transparent border border-transparent focus:border-[#14B8A6]/50 focus:outline-none rounded focus:bg-[var(--bg-base)] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              onClick={() => changeQty(item.lineId, 1)}
                              className="w-7 h-7 rounded-lg bg-[var(--bg-card)] hover:bg-[#14B8A6]/20 hover:text-[#14B8A6] text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          {/* Pack/piece toggle */}
                          {hasPack && (
                            <button
                              onClick={() => {
                                if (isPack) {
                                  setUnit(item.lineId, 1, item.product.unit, basePrice);
                                } else {
                                  setUnit(item.lineId, item.product.packaging_qty, `pack×${item.product.packaging_qty}`, basePrice);
                                }
                              }}
                              title={isPack ? t("cart.pieceMode") : t("cart.packMode")}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                isPack
                                  ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                                  : "bg-[var(--bg-card)] border-[var(--bd-base)] text-slate-500 hover:border-indigo-400/40 hover:text-indigo-400"
                              }`}
                            >
                              <Package2 size={10} />
                              {isPack ? `×${item.unit_multiplier}` : item.unit_label}
                            </button>
                          )}

                          <div className="flex-1 text-end text-[var(--tx-base)] font-bold text-sm tabular-nums">
                            {fmt(item.unit_price * item.quantity)}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* BOGO promo lines (read-only) */}
                  {promoItems.map((item) => (
                    <div key={item.lineId} className="fade-in bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                      <Gift size={14} className="text-emerald-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-emerald-400 text-sm font-semibold leading-snug truncate">{item.product.name}</div>
                        <div className="text-emerald-400/60 text-[10px]">{item.promo_name} · ×{item.quantity}</div>
                      </div>
                      <span className="text-emerald-400 font-bold text-xs px-2 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/20">
                        {t("cart.freeItem")}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="border-t border-[var(--bd-faint)] p-5 space-y-4">
              {items.length > 0 && (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>{t("cart.subtotal")}</span><span className="tabular-nums">{fmt(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>{t("cart.discount")}</span><span className="tabular-nums">−{fmt(discount)}</span>
                    </div>
                  )}
                  {tva > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>{t("cart.tva")}</span><span className="tabular-nums">{fmt(tva)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-2 border-t border-[var(--bd-base)]">
                    <span className="text-[var(--tx-base)] font-bold">{t("cart.total")}</span>
                    <div className="text-end">
                      <div className="text-[#14B8A6] font-bold text-2xl tabular-nums">{fmt(total)}</div>
                      {showAlt && <div className="text-slate-500 text-xs tabular-nums">{fmtAlt(total)}</div>}
                    </div>
                  </div>
                </div>
              )}

              {quickError && (
                <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
                  {quickError}
                </div>
              )}
              <div className="flex gap-2">
                {/* F6 Quick Pay: exact cash + instant print, no modal */}
                <button
                  onClick={handleQuickCheckout}
                  disabled={!canStart || quickLoading}
                  title={t("cart.quickPay") + " (F6)"}
                  className="flex items-center gap-1.5 px-4 py-4 rounded-xl font-bold text-sm border transition-all cursor-pointer bg-[var(--bg-card)] border-[var(--bd-base)] hover:border-[#14B8A6]/50 text-slate-400 hover:text-[#14B8A6] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {quickLoading
                    ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    : (
                      <>
                        <Zap size={15} />
                        <span>Print</span>
                      </>
                    )
                  }
                  <kbd className="text-[9px] font-mono px-1 py-0.5 rounded border border-[var(--bd-base)] bg-[var(--bg-base)] text-slate-600 font-normal">F6</kbd>
                </button>
                <button
                  onClick={() => setShowCheckout(true)}
                  disabled={!canStart}
                  className="flex-1 py-4 rounded-xl font-bold text-[15px] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 shadow-[#14B8A6]/25"
                >
                  {checkoutLabel}
                  {canStart && <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-900/20 bg-slate-900/15 text-slate-900/60 font-normal">F5</kbd>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showCheckout && (
        <CheckoutModal
          cashierId={user.id}
          sessionId={sessionId}
          onClose={() => setShowCheckout(false)}
          onSaleComplete={handleSaleComplete}
        />
      )}
    </>
  );
}
