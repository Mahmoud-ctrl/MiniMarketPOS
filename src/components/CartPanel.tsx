import { Minus, Plus, ShoppingBag, Banknote, CreditCard, Wallet, X } from "lucide-react";
import { api } from "../lib/api";
import { useState } from "react";
import { useCart } from "../context/CartContext";

interface Props {
  cashierId:      number;
  sessionId:      number | null;
  onSaleComplete: () => void;
}

type PayMethod = "cash" | "card" | "wallet";

const fmt = (n: number) => `$${(n / 100).toFixed(2)}`;

const PAY_OPTIONS: { id: PayMethod; icon: typeof Banknote; label: string }[] = [
  { id: "cash",   icon: Banknote,   label: "Cash"   },
  { id: "card",   icon: CreditCard, label: "Card"   },
  { id: "wallet", icon: Wallet,     label: "Wallet" },
];

export default function CartPanel({ cashierId, sessionId, onSaleComplete }: Props) {
  const { items, changeQty, removeFromCart, clearCart, subtotal, discount, tva } = useCart();

  const [payMethod,  setPayMethod]  = useState<PayMethod>("cash");
  const [tendered,   setTendered]   = useState("");
  const [processing, setProcessing] = useState(false);

  const total     = subtotal - discount + tva;
  const tenderedN = Math.round(parseFloat(tendered || "0") * 100);
  const change    = tenderedN - total;
  const canCharge = items.length > 0 && (payMethod !== "cash" || tenderedN >= total);

  const handleCheckout = async () => {
    if (!canCharge || processing) return;
    setProcessing(true);
    try {
      await api.createSale({
        session_id:     sessionId ?? undefined,
        cashier_id:     cashierId,
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
        discount:       discount,
        amount_paid:    payMethod === "cash" ? tenderedN : total,
        payment_method: payMethod,
      });
      clearCart();
      onSaleComplete();
      setTendered("");
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="w-[400px] flex-shrink-0 flex flex-col border-l border-[#0F1E38] bg-[#060E1A]">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#0F1E38]">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${items.length ? "bg-[#14B8A6]/15" : "bg-[#0D1526]"}`}>
            <ShoppingBag size={16} className={items.length ? "text-[#14B8A6]" : "text-slate-700"} />
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-none">Order</div>
            <div className="text-slate-600 text-[11px] mt-0.5">
              {items.length === 0 ? "Empty" : `${items.reduce((s, i) => s + i.quantity, 0)} items`}
            </div>
          </div>
        </div>
        {items.length > 0 && (
          <button
            onClick={clearCart}
            className="text-slate-600 hover:text-red-400 text-xs transition-colors cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Items ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <ShoppingBag size={44} strokeWidth={1} className="text-slate-800" />
            <p className="text-sm text-slate-600">Scan or tap a product to add it</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.product.id}
              className="fade-in bg-[#0D1526] border border-[#1A2D45] rounded-xl p-4"
            >
              {/* Name + remove */}
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

              {/* Unit price × qty controls = line total */}
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
                  <span className="text-white text-sm font-bold w-7 text-center tabular-nums">
                    {item.quantity}
                  </span>
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

      {/* ── Totals + payment ────────────────────────────────────── */}
      <div className="border-t border-[#0F1E38] p-5 space-y-4">

        {/* Breakdown */}
        {items.length > 0 && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="tabular-nums">{fmt(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount</span>
                <span className="tabular-nums">−{fmt(discount)}</span>
              </div>
            )}
            {tva > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>TVA</span>
                <span className="tabular-nums">{fmt(tva)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2.5 border-t border-[#1A2D45]">
              <span className="text-white font-bold">Total</span>
              <span className="text-[#14B8A6] font-bold text-2xl tabular-nums">{fmt(total)}</span>
            </div>
          </div>
        )}

        {/* Payment method */}
        <div className="grid grid-cols-3 gap-2">
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
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Cash tendered */}
        {payMethod === "cash" && (
          <div className="space-y-2">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount tendered…"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="w-full bg-[#0D1526] border border-[#1A2D45] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 tabular-nums transition-colors"
            />
            {tenderedN >= total && total > 0 && (
              <div className="flex justify-between text-emerald-400 text-sm font-semibold px-1">
                <span>Change</span>
                <span className="tabular-nums">{fmt(change)}</span>
              </div>
            )}
          </div>
        )}

        {/* Charge button */}
        <button
          onClick={handleCheckout}
          disabled={!canCharge || processing}
          className="w-full py-4 rounded-xl font-bold text-[15px] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed
            bg-[#14B8A6] hover:bg-[#0D9488] active:scale-[0.98] text-slate-900 shadow-[#14B8A6]/25"
        >
          {processing ? (
            <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
          ) : (
            items.length > 0 ? `Charge ${fmt(total)}` : "Add items to charge"
          )}
        </button>
      </div>
    </div>
  );
}
