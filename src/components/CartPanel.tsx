import {
  Minus, Plus, ShoppingBag, Banknote, CreditCard, Wallet,
  X, CheckCircle, Printer, ChevronLeft, ChevronRight, PlusCircle,
  UserCircle, Search,
} from "lucide-react";
import { api } from "../lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import { CartItem, Customer, Sale, User } from "../types";
import CashModal from "./CashModal";
import { buildReceiptHtml, doPrint } from "../lib/receipt";

interface Props {
  user:           User;
  sessionId:      number | null;
  onSaleComplete: () => void;
}

type PayMethod = "cash" | "card" | "wallet" | "credit";

const PAY_OPTIONS: { id: PayMethod; icon: typeof Banknote; label: string }[] = [
  { id: "cash",   icon: Banknote,    label: "Cash"   },
  { id: "card",   icon: CreditCard,  label: "Card"   },
  { id: "wallet", icon: Wallet,      label: "Wallet" },
  { id: "credit", icon: UserCircle,  label: "Credit" },
];

// ── Receipt view ──────────────────────────────────────────────────────────────

function ReceiptView({
  sale, items, payMethod, paidPrimary, paidSecondary, amountPaid,
  cashierName, storeInfo, onDone,
}: {
  sale:          Sale;
  items:         CartItem[];
  payMethod:     PayMethod;
  paidPrimary:   string;
  paidSecondary: string;
  amountPaid:    number;
  cashierName:   string;
  storeInfo:     { name: string; address: string; phone: string; tagline: string; logo: string };
  onDone:        () => void;
}) {
  const { fmt, fmtAlt, symbol, altSymbol } = useCurrency();
  const change    = amountPaid - sale.total_amount;
  const isPending = change < 0;

  const handlePrint = () => {
    const html = buildReceiptHtml({
      saleId: sale.id, cashierName,
      items: items.map(i => ({ name: i.product.name, unit_price: i.unit_price, quantity: i.quantity })),
      subtotal: sale.subtotal, discount: sale.discount, tva: sale.tax, total: sale.total_amount,
      payMethod, paidPrimary, paidSecondary,
      changeAmt: Math.abs(change), isPending,
      fmt, fmtAlt, symbol, altSymbol,
      storeName: storeInfo.name, storeAddress: storeInfo.address,
      storePhone: storeInfo.phone, storeTagline: storeInfo.tagline, storeLogo: storeInfo.logo,
    });
    doPrint(html);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col items-center justify-center gap-3 py-6 border-b border-[#0F1E38]">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
          isPending ? "bg-amber-500/15 border border-amber-500/30" : "bg-emerald-500/15 border border-emerald-500/30"
        }`}>
          <CheckCircle size={28} className={isPending ? "text-amber-400" : "text-emerald-400"} />
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-base leading-none">
            {isPending ? "Sale Complete — Change Pending" : "Sale Complete"}
          </p>
          <p className="text-slate-500 text-xs mt-1">Receipt #{sale.id}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
        {items.map((item) => (
          <div key={item.product.id} className="flex items-center justify-between text-sm px-3 py-2 bg-[#0D1526] border border-[#1A2D45] rounded-xl">
            <div className="flex-1 min-w-0">
              <span className="text-white font-medium truncate block">{item.product.name}</span>
              <span className="text-slate-500 text-xs">{fmt(item.unit_price)} × {item.quantity}</span>
            </div>
            <span className="text-slate-300 font-semibold tabular-nums ml-3">
              {fmt(item.unit_price * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-[#0F1E38] px-5 py-4 space-y-2">
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
        <div className="flex justify-between items-center pt-1 border-t border-[#1A2D45]">
          <span className="text-white font-bold">Total</span>
          <div className="text-right">
            <div className="text-[#14B8A6] font-bold text-xl tabular-nums">{fmt(sale.total_amount)}</div>
            <div className="text-slate-500 text-xs tabular-nums">{fmtAlt(sale.total_amount)}</div>
          </div>
        </div>
        {payMethod === "cash" && amountPaid > 0 && Math.abs(change) > 0 && (
          <div className={`flex justify-between items-center px-3 py-2.5 rounded-xl border text-sm font-bold ${
            isPending
              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}>
            <span>{isPending ? "Owed to customer" : "Change"}</span>
            <div className="text-right">
              <div className="tabular-nums">{fmt(Math.abs(change))}</div>
              <div className="text-xs opacity-70 tabular-nums">{fmtAlt(Math.abs(change))}</div>
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[#131F35] hover:bg-[#1A2A44] border border-[#1E3050] text-slate-300 text-sm font-medium rounded-xl transition-colors cursor-pointer flex-shrink-0"
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

// ── Receipt data per tab ──────────────────────────────────────────────────────

interface ReceiptData {
  sale:          Sale;
  snapshot:      CartItem[];
  paidPrimary:   string;
  paidSecondary: string;
  amountPaid:    number;
  method:        PayMethod;
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
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[#0F1E38]">

      {/* Prev arrow */}
      <button
        onClick={onPrev}
        disabled={activeIdx === 0}
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-white hover:bg-[#0D1526] disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
        title="Previous order (←)"
      >
        <ChevronLeft size={18} />
      </button>

      {/* Center */}
      <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
        {/* Label + status badge */}
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm leading-none truncate">
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

        {/* Page dots — one per order, clickable to jump */}
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
                  : "w-1.5 h-1.5 bg-[#1A2D45] hover:bg-slate-500"
              }`}
            />
          ))}
        </div>

        <span className="text-slate-700 text-[10px] leading-none select-none">
          {activeIdx + 1} / {tabs.length} · ← → to navigate · Ctrl+N new
        </span>
      </div>

      {/* Close current + add new */}
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

      {/* Next arrow */}
      <button
        onClick={onNext}
        disabled={activeIdx === tabs.length - 1}
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-white hover:bg-[#0D1526] disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
        title="Next order (→)"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ── Main CartPanel ────────────────────────────────────────────────────────────

export default function CartPanel({ user, sessionId, onSaleComplete }: Props) {
  const { fmt, fmtAlt } = useCurrency();
  const {
    items, changeQty, setQty, removeFromCart, clearCart, subtotal, discount, tva,
    tabs, activeTabId, addTab, removeTab, switchTab,
  } = useCart();

  const [payMethod,     setPayMethod]    = useState<PayMethod>("cash");
  const [showCashModal, setShowCashModal] = useState(false);
  const [processing,    setProcessing]   = useState(false);
  const [error,         setError]        = useState<string | null>(null);

  // Customer state stored per-tab (keyed by tab ID)
  const [tabCustomers,    setTabCustomers]    = useState<Record<number, Customer | null>>({});
  const [custSearch,      setCustSearch]       = useState("");
  const [custResults,     setCustResults]      = useState<Customer[]>([]);
  const [custDropOpen,    setCustDropOpen]     = useState(false);
  const [creatingCust,    setCreatingCust]     = useState(false);
  // Mini new-customer form shown inline in the POS
  const [newCustForm,     setNewCustForm]      = useState<{ name: string; phone: string } | null>(null);
  const custRef = useRef<HTMLDivElement>(null);

  // Derive the active tab's customer
  const customer = tabCustomers[activeTabId] ?? null;
  const setCustomer = (c: Customer | null) =>
    setTabCustomers(prev => ({ ...prev, [activeTabId]: c }));

  // Clear the search UI when the active tab changes
  useEffect(() => {
    setCustSearch("");
    setCustResults([]);
    setCustDropOpen(false);
    setNewCustForm(null);
  }, [activeTabId]);

  // Search customers as the user types
  useEffect(() => {
    if (!custSearch.trim()) { setCustResults([]); return; }
    const t = setTimeout(() => {
      api.searchCustomers(custSearch).then(setCustResults).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [custSearch]);

  // Close customer dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (custRef.current && !custRef.current.contains(e.target as Node)) {
        setCustDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Receipt per-tab so switching while viewing a receipt works correctly
  const [receipts, setReceipts] = useState<Record<number, ReceiptData>>({});
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

  // Build enriched tabs for the book nav (adds "confirmed" flag)
  const bookTabs = useMemo(
    () => tabs.map(t => ({ ...t, confirmed: !!receipts[t.id] })),
    [tabs, receipts],
  );
  const activeIdx = bookTabs.findIndex(t => t.id === activeTabId);

  const goPrev = () => { if (activeIdx > 0) switchTab(bookTabs[activeIdx - 1].id); };
  const goNext = () => { if (activeIdx < bookTabs.length - 1) switchTab(bookTabs[activeIdx + 1].id); };

  // Keyboard shortcuts — skip when typing in an input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft"  && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); goNext(); }
      if (e.key === "n"          && (e.ctrlKey || e.metaKey))               { e.preventDefault(); addTab(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, bookTabs.length]);

  const handleCheckout = async (amountPaid: number, paidPrimary: string, paidSecondary: string) => {
    // Credit requires a customer
    if (payMethod === "credit" && !customer) {
      setError("Select a customer for credit sales");
      return;
    }
    setProcessing(true);
    setError(null);
    setShowCashModal(false);
    const snapshot = [...items];
    const outstanding = total - amountPaid;
    const notes = outstanding > 0 && customer
      ? `Credit for ${customer.name}: ${fmt(outstanding)} outstanding`
      : outstanding > 0
        ? `Change owed to customer: ${fmt(outstanding)} (${fmtAlt(outstanding)})`
        : undefined;

    try {
      const sale = await api.createSale({
        session_id:     sessionId ?? undefined,
        cashier_id:     user.id,
        customer_id:    customer?.id,
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity:   i.quantity,
          unit_price: i.unit_price,
          unit_cost:  i.product.cost_price,
          price_tier: i.price_tier,
          discount:   i.discount * i.quantity,
          tva_amount: i.product.apply_tva
            ? Math.round(i.unit_price * i.quantity * i.product.tva_rate)
            : 0,
        })),
        discount,
        amount_paid:    amountPaid,
        payment_method: payMethod,
        notes,
      });
      clearCart();
      setCustomer(null);
      setCustSearch("");
      setReceipts(prev => ({
        ...prev,
        [activeTabId]: { sale, snapshot, paidPrimary, paidSecondary, amountPaid, method: payMethod },
      }));
      onSaleComplete();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? String(e));
    } finally {
      setProcessing(false);
    }
  };

  const clearReceipt  = () => setReceipts(prev => { const n = { ...prev }; delete n[activeTabId]; return n; });
  const handleRemoveTab = (tabId: number) => {
    setReceipts(prev => { const n = { ...prev }; delete n[tabId]; return n; });
    setTabCustomers(prev => { const n = { ...prev }; delete n[tabId]; return n; });
    setNewCustForm(null);
    removeTab(tabId);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="w-[400px] flex-shrink-0 flex flex-col border-l border-[#0F1E38] bg-[#060E1A]">

        {/* Book-style order navigator */}
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
          /* ── Confirmed page: receipt ──────────────────────────────────── */
          <ReceiptView
            sale={receipt.sale}
            items={receipt.snapshot}
            payMethod={receipt.method}
            paidPrimary={receipt.paidPrimary}
            paidSecondary={receipt.paidSecondary}
            amountPaid={receipt.amountPaid}
            cashierName={user.full_name}
            storeInfo={storeInfo}
            onDone={clearReceipt}
          />
        ) : (
          /* ── Open page: cart ──────────────────────────────────────────── */
          <>
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#0F1E38]">
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

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <ShoppingBag size={44} strokeWidth={1} className="text-slate-800" />
                  <p className="text-sm text-slate-600">Scan or tap a product to add it</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.product.id} className="fade-in bg-[#0D1526] border border-[#1A2D45] rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="text-white text-sm font-semibold leading-snug line-clamp-2 flex-1">
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
                          className="w-7 h-7 rounded-lg bg-[#131F35] hover:bg-[#1A2A44] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
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
                          className="w-10 text-white text-sm font-bold text-center tabular-nums bg-transparent border border-transparent focus:border-[#14B8A6]/50 focus:outline-none rounded focus:bg-[#0D1526] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() => changeQty(item.product.id, 1)}
                          className="w-7 h-7 rounded-lg bg-[#131F35] hover:bg-[#14B8A6]/20 hover:text-[#14B8A6] text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="flex-1 text-right text-white font-bold text-sm tabular-nums">
                        {fmt(item.unit_price * item.quantity)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[#0F1E38] p-5 space-y-4">
              {items.length > 0 && (
                <div className="space-y-1.5 text-sm">
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
                  <div className="flex justify-between items-baseline pt-2 border-t border-[#1A2D45]">
                    <span className="text-white font-bold">Total</span>
                    <div className="text-right">
                      <div className="text-[#14B8A6] font-bold text-2xl tabular-nums">{fmt(total)}</div>
                      <div className="text-slate-500 text-xs tabular-nums">{fmtAlt(total)}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                {PAY_OPTIONS.map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setPayMethod(id)}
                    className={`py-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1.5 border transition-all cursor-pointer ${
                      payMethod === id
                        ? "bg-[#14B8A6]/15 border-[#14B8A6]/50 text-[#14B8A6]"
                        : "bg-[#0D1526] border-[#1A2D45] text-slate-500 hover:border-[#2A4060] hover:text-slate-300"
                    }`}
                  >
                    <Icon size={16} />{label}
                  </button>
                ))}
              </div>

              {/* Customer selector — shown when credit is selected or customer is already picked */}
              {(payMethod === "credit" || customer) && (
                <div ref={custRef} className="relative">
                  {customer ? (
                    <div className="flex items-center justify-between px-3 py-2.5 bg-[#0D1526] border border-[#14B8A6]/40 rounded-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserCircle size={14} className="text-[#14B8A6] flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-white text-xs font-semibold truncate">{customer.name}</p>
                          {customer.phone && <p className="text-slate-500 text-[10px]">{customer.phone}</p>}
                        </div>
                      </div>
                      <button onClick={() => { setCustomer(null); setCustSearch(""); }} className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  ) : newCustForm !== null ? (
                    /* ── Inline new-customer form ─────────────────────── */
                    <div className="bg-[#0D1526] border border-[#14B8A6]/30 rounded-xl p-3 space-y-2">
                      <p className="text-[#14B8A6] text-xs font-semibold">New customer</p>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Full name *"
                        value={newCustForm.name}
                        onChange={e => setNewCustForm(f => f && ({ ...f, name: e.target.value }))}
                        className="w-full bg-[#131F35] border border-[#1A2D45] focus:border-[#14B8A6]/60 focus:outline-none rounded-lg px-3 py-2 text-white text-xs placeholder-slate-600 transition-colors"
                      />
                      <input
                        type="text"
                        placeholder="Phone (optional)"
                        value={newCustForm.phone}
                        onChange={e => setNewCustForm(f => f && ({ ...f, phone: e.target.value }))}
                        className="w-full bg-[#131F35] border border-[#1A2D45] focus:border-[#14B8A6]/60 focus:outline-none rounded-lg px-3 py-2 text-white text-xs placeholder-slate-600 transition-colors"
                      />
                      <div className="flex gap-2 pt-0.5">
                        <button
                          onClick={() => setNewCustForm(null)}
                          className="flex-1 py-2 rounded-lg text-slate-400 hover:text-white text-xs transition-colors cursor-pointer bg-[#131F35] hover:bg-[#1A2A44]"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={creatingCust || !newCustForm.name.trim()}
                          onClick={async () => {
                            if (!newCustForm.name.trim()) return;
                            setCreatingCust(true);
                            try {
                              const nc = await api.createCustomer(
                                newCustForm.name.trim(),
                                newCustForm.phone.trim() || null,
                              );
                              setCustomer(nc);
                              setNewCustForm(null);
                            } catch (e: unknown) {
                              setError((e as { message?: string })?.message ?? "Failed to create customer");
                            } finally { setCreatingCust(false); }
                          }}
                          className="flex-1 py-2 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] disabled:opacity-50 text-slate-900 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          {creatingCust ? "Creating…" : "Create & assign"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search customer by name or phone…"
                          value={custSearch}
                          onChange={e => { setCustSearch(e.target.value); setCustDropOpen(true); }}
                          onFocus={() => setCustDropOpen(true)}
                          className="w-full bg-[#0D1526] border border-[#1A2D45] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl pl-8 pr-3 py-2.5 text-white text-xs placeholder-slate-600 transition-colors"
                        />
                      </div>
                      {custDropOpen && (custSearch.trim() || custResults.length > 0) && (
                        <div className="absolute z-20 w-full mt-1 bg-[#0D1526] border border-[#1A2D45] rounded-xl overflow-hidden shadow-xl">
                          {custResults.map(c => (
                            <button
                              key={c.id}
                              onClick={() => { setCustomer(c); setCustSearch(""); setCustDropOpen(false); }}
                              className="w-full text-left px-3 py-2.5 hover:bg-[#131F35] transition-colors cursor-pointer"
                            >
                              <p className="text-white text-xs font-medium">{c.name}</p>
                              {c.phone && <p className="text-slate-500 text-[10px]">{c.phone}</p>}
                            </button>
                          ))}
                          {custSearch.trim() && (
                            <button
                              onClick={() => {
                                setCustDropOpen(false);
                                setNewCustForm({ name: custSearch.trim(), phone: "" });
                                setCustSearch("");
                              }}
                              className="w-full text-left px-3 py-2.5 border-t border-[#1A2D45] text-[#14B8A6] text-xs hover:bg-[#131F35] transition-colors cursor-pointer"
                            >
                              + Create "{custSearch.trim()}"
                            </button>
                          )}
                          {!custSearch.trim() && custResults.length === 0 && (
                            <p className="px-3 py-2.5 text-slate-600 text-xs">Type to search customers</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-xs">
                  {error}
                </div>
              )}

              <button
                onClick={() => {
                  if (!canStart || processing) return;
                  if (payMethod === "credit") handleCheckout(0, "", "");
                  else if (payMethod === "cash") setShowCashModal(true);
                  else handleCheckout(total, "", "");
                }}
                disabled={!canStart || processing || (payMethod === "credit" && !customer)}
                className={`w-full py-4 rounded-xl font-bold text-[15px] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] ${
                  payMethod === "credit"
                    ? "bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-amber-500/25"
                    : "bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 shadow-[#14B8A6]/25"
                }`}
              >
                {processing ? (
                  <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                ) : !sessionId        ? "Open a session to sell"
                  : items.length === 0 ? "Add items to charge"
                  : payMethod === "credit" && !customer ? "Select a customer"
                  : payMethod === "credit" ? `Put ${fmt(total)} on credit`
                  : `Charge ${fmt(total)}`}
              </button>
            </div>
          </>
        )}
      </div>

      {showCashModal && (
        <CashModal
          total={total}
          onConfirm={(combined, primary, secondary) => handleCheckout(combined, primary, secondary)}
          onCancel={() => setShowCashModal(false)}
        />
      )}
    </>
  );
}
