import {
  Minus, Plus, ShoppingBag, X, CheckCircle, Printer,
  ChevronLeft, ChevronRight, PlusCircle,
} from "lucide-react";
import { api } from "../lib/api";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "../context/CartContext";
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
  paidPrimary:   string;
  paidSecondary: string;
  amountPaid:    number;
  method:        "cash" | "credit";
}

function ReceiptView({
  sale, items, method, paidPrimary, paidSecondary, amountPaid,
  cashierName, storeInfo, onDone,
}: {
  sale:          Sale;
  items:         CartItem[];
  method:        "cash" | "credit";
  paidPrimary:   string;
  paidSecondary: string;
  amountPaid:    number;
  cashierName:   string;
  storeInfo:     { name: string; address: string; phone: string; tagline: string; logo: string };
  onDone:        () => void;
}) {
  const { fmt, fmtAlt, showAlt, symbol, altSymbol } = useCurrency();
  const change    = amountPaid - sale.total_amount;
  const isPending = change < 0;

  const handlePrint = () => {
    const html = buildReceiptHtml({
      saleId: sale.id, cashierName,
      items: items.map(i => ({ name: i.product.name, unit_price: i.unit_price, quantity: i.quantity })),
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
            {isPending ? "Sale Complete — Debt Recorded" : "Sale Complete"}
          </p>
          <p className="text-slate-500 text-xs mt-1">Receipt #{sale.id}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
        {items.map((item) => (
          <div key={item.product.id} className="flex items-center justify-between text-sm px-3 py-2 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl">
            <div className="flex-1 min-w-0">
              <span className="text-[var(--tx-base)] font-medium truncate block">{item.product.name}</span>
              <span className="text-slate-500 text-xs">{fmt(item.unit_price)} × {item.quantity}</span>
            </div>
            <span className="text-slate-400 font-semibold tabular-nums ml-3">
              {fmt(item.unit_price * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--bd-faint)] px-5 py-4 space-y-2">
        {sale.discount > 0 && (
          <div className="flex justify-between text-sm text-emerald-400">
            <span>Discount</span><span className="tabular-nums">−{fmt(sale.discount)}</span>
          </div>
        )}
        {sale.tax > 0 && (
          <div className="flex justify-between text-sm text-slate-500">
            <span>TVA</span><span className="tabular-nums">{fmt(sale.tax)}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-1 border-t border-[var(--bd-base)]">
          <span className="text-[var(--tx-base)] font-bold">Total</span>
          <div className="text-right">
            <div className="text-[#14B8A6] font-bold text-xl tabular-nums">{fmt(sale.total_amount)}</div>
            {showAlt && <div className="text-slate-500 text-xs tabular-nums">{fmtAlt(sale.total_amount)}</div>}
          </div>
        </div>
        {method === "cash" && amountPaid > 0 && Math.abs(change) > 0 && (
          <div className={`flex justify-between items-center px-3 py-2.5 rounded-xl border text-sm font-bold ${
            isPending
              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}>
            <span>{isPending ? "Still owed" : "Change"}</span>
            <div className="text-right">
              <div className="tabular-nums">{fmt(Math.abs(change))}</div>
              {showAlt && <div className="text-xs opacity-70 tabular-nums">{fmtAlt(Math.abs(change))}</div>}
            </div>
          </div>
        )}
        {method === "credit" && (
          <div className="flex justify-between items-center px-3 py-2.5 rounded-xl border bg-orange-500/10 border-orange-500/20 text-orange-400 text-sm font-bold">
            <span>Recorded as debt</span>
            <div className="tabular-nums">{fmt(sale.total_amount - amountPaid)}</div>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--bg-card)] hover:bg-[var(--bg-raised)] border border-[var(--bd-base)] text-slate-400 text-sm font-medium rounded-xl transition-colors cursor-pointer flex-shrink-0"
          >
            <Printer size={15} /> Print
          </button>
          <button
            onClick={onDone}
            className="flex-1 py-3 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] active:scale-[0.98] text-slate-900 font-bold text-[15px] transition-all cursor-pointer shadow-lg shadow-[#14B8A6]/25"
          >
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Book navigator ────────────────────────────────────────────────────────────

function BookNav({
  tabs, activeTabId, activeIdx, onPrev, onNext, onJump, onAdd, onRemove,
}: {
  tabs:        { id: number; label: string; itemCount: number; confirmed: boolean }[];
  activeTabId: number;
  activeIdx:   number;
  onPrev:      () => void;
  onNext:      () => void;
  onJump:      (id: number) => void;
  onAdd:       () => void;
  onRemove:    (id: number) => void;
}) {
  const active = tabs[activeIdx];

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--bd-faint)]">

      <button
        onClick={onPrev}
        disabled={activeIdx === 0}
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-[var(--tx-base)] hover:bg-[var(--bg-base)] disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
        title="Previous order (←)"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[var(--tx-base)] font-semibold text-sm leading-none truncate">
            {active?.label}
          </span>
          {active?.confirmed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium leading-none">
              done
            </span>
          )}
          {active && active.itemCount > 0 && !active.confirmed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#14B8A6]/15 text-[#14B8A6] font-medium leading-none tabular-nums">
              {active.itemCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onJump(t.id)}
              title={t.label}
              className={`rounded-full transition-all cursor-pointer ${
                t.id === activeTabId
                  ? "w-4 h-1.5 bg-[#14B8A6]"
                  : t.confirmed
                  ? "w-1.5 h-1.5 bg-emerald-600/60 hover:bg-emerald-400"
                  : t.itemCount > 0
                  ? "w-1.5 h-1.5 bg-slate-500 hover:bg-slate-300"
                  : "w-1.5 h-1.5 bg-[var(--bd-base)] hover:bg-slate-500"
              }`}
            />
          ))}
        </div>

        <span className="text-slate-700 text-[10px] leading-none select-none">
          {activeIdx + 1} / {tabs.length} · ← → to navigate · Ctrl+N new
        </span>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {tabs.length > 1 && active && (
          <button
            onClick={() => onRemove(active.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            title="Close this order"
          >
            <X size={13} />
          </button>
        )}
        <button
          onClick={onAdd}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-[#14B8A6] hover:bg-[#14B8A6]/10 transition-colors cursor-pointer"
          title="New order (Ctrl+N)"
        >
          <PlusCircle size={17} />
        </button>
      </div>

      <button
        onClick={onNext}
        disabled={activeIdx === tabs.length - 1}
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-[var(--tx-base)] hover:bg-[var(--bg-base)] disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
        title="Next order (→)"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ── Main CartPanel ────────────────────────────────────────────────────────────

export default function CartPanel({ user, sessionId, onSaleComplete }: Props) {
  const { fmt, fmtAlt, showAlt } = useCurrency();
  const {
    items, changeQty, setQty, removeFromCart, clearCart, subtotal, discount, tva,
    tabs, activeTabId, addTab, removeTab, switchTab,
  } = useCart();

  // Per-tab receipt state
  const [receipts,  setReceipts]  = useState<Record<number, ReceiptData>>({});
  const [showCheckout, setShowCheckout] = useState(false);

  const receipt = receipts[activeTabId];

  // Store info for printing
  const [storeInfo, setStoreInfo] = useState({ name: "", address: "", phone: "", tagline: "", logo: "" });
  useEffect(() => {
    api.getSettings().then(settings => {
      const get = (k: string) => settings.find(s => s.key === k)?.value ?? "";
      setStoreInfo({ name: get("store_name"), address: get("store_address"), phone: get("store_phone"), tagline: get("store_tagline"), logo: get("store_logo") });
    }).catch(() => {});
  }, []);

  const total    = subtotal - discount + tva;
  const canStart = items.length > 0 && sessionId !== null;

  // Enrich tabs with confirmed flag for BookNav
  const bookTabs = useMemo(
    () => tabs.map(t => ({ ...t, confirmed: !!receipts[t.id] })),
    [tabs, receipts],
  );
  const activeIdx = bookTabs.findIndex(t => t.id === activeTabId);

  const goPrev = () => { if (activeIdx > 0) switchTab(bookTabs[activeIdx - 1].id); };
  const goNext = () => { if (activeIdx < bookTabs.length - 1) switchTab(bookTabs[activeIdx + 1].id); };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft"  && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); goNext(); }
      if (e.key === "n"          && (e.ctrlKey || e.metaKey))              { e.preventDefault(); addTab(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, bookTabs.length]);

  // Called by CheckoutModal on success — take snapshot, store receipt, clear cart
  const handleSaleComplete = (data: SaleCompleteData) => {
    const snapshot = [...items];
    clearCart();
    setShowCheckout(false);
    setReceipts(prev => ({
      ...prev,
      [activeTabId]: {
        sale:          data.sale,
        snapshot,
        paidPrimary:   data.paidPrimary,
        paidSecondary: data.paidSecondary,
        amountPaid:    data.amountPaid,
        method:        data.method,
      },
    }));
    onSaleComplete();
  };

  const clearReceipt = () =>
    setReceipts(prev => { const n = { ...prev }; delete n[activeTabId]; return n; });

  const handleRemoveTab = (tabId: number) => {
    setReceipts(prev => { const n = { ...prev }; delete n[tabId]; return n; });
    removeTab(tabId);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="w-[400px] flex-shrink-0 flex flex-col border-l border-[var(--bd-faint)] bg-[var(--bg-panel)]">

        <BookNav
          tabs={bookTabs}
          activeTabId={activeTabId}
          activeIdx={activeIdx}
          onPrev={goPrev}
          onNext={goNext}
          onJump={switchTab}
          onAdd={addTab}
          onRemove={handleRemoveTab}
        />

        {receipt ? (
          <ReceiptView
            sale={receipt.sale}
            items={receipt.snapshot}
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
                  {items.length === 0 ? "Empty cart" : `${items.reduce((s, i) => s + i.quantity, 0)} items`}
                </span>
              </div>
              {items.length > 0 && (
                <button onClick={clearCart} className="text-slate-600 hover:text-red-400 text-xs transition-colors cursor-pointer">
                  Clear
                </button>
              )}
            </div>

            {/* ── Items ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <ShoppingBag size={44} strokeWidth={1} className="text-slate-800" />
                  <p className="text-sm text-slate-600">Scan or tap a product to add it</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.product.id} className="fade-in bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="text-[var(--tx-base)] text-sm font-semibold leading-snug line-clamp-2 flex-1">
                        {item.product.name}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
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
                          onClick={() => changeQty(item.product.id, -1)}
                          className="w-7 h-7 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-raised)] text-slate-400 hover:text-[var(--tx-base)] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v > 0) setQty(item.product.id, v);
                          }}
                          onFocus={e => e.target.select()}
                          className="w-10 text-[var(--tx-base)] text-sm font-bold text-center tabular-nums bg-transparent border border-transparent focus:border-[#14B8A6]/50 focus:outline-none rounded focus:bg-[var(--bg-base)] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() => changeQty(item.product.id, 1)}
                          className="w-7 h-7 rounded-lg bg-[var(--bg-card)] hover:bg-[#14B8A6]/20 hover:text-[#14B8A6] text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="flex-1 text-right text-[var(--tx-base)] font-bold text-sm tabular-nums">
                        {fmt(item.unit_price * item.quantity)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── Footer ── */}
            <div className="border-t border-[var(--bd-faint)] p-5 space-y-4">

              {/* Totals */}
              {items.length > 0 && (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span><span className="tabular-nums">{fmt(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Discount</span><span className="tabular-nums">−{fmt(discount)}</span>
                    </div>
                  )}
                  {tva > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>TVA</span><span className="tabular-nums">{fmt(tva)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-2 border-t border-[var(--bd-base)]">
                    <span className="text-[var(--tx-base)] font-bold">Total</span>
                    <div className="text-right">
                      <div className="text-[#14B8A6] font-bold text-2xl tabular-nums">{fmt(total)}</div>
                      {showAlt && <div className="text-slate-500 text-xs tabular-nums">{fmtAlt(total)}</div>}
                    </div>
                  </div>
                </div>
              )}

              {/* Checkout button */}
              <button
                onClick={() => setShowCheckout(true)}
                disabled={!canStart}
                className="w-full py-4 rounded-xl font-bold text-[15px] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 shadow-[#14B8A6]/25"
              >
                {!sessionId
                  ? "Open a session to sell"
                  : items.length === 0
                  ? "Add items to charge"
                  : `Checkout — ${fmt(total)}`}
              </button>
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
