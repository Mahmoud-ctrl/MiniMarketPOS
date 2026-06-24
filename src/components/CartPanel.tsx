import { Minus, Plus, Trash2, ShoppingBag, Banknote, CreditCard, Wallet } from "lucide-react";
import { CartItem } from "../types";
import { api } from "../lib/api";
import { useState } from "react";

interface Props {
  items: CartItem[];
  onQuantityChange: (productId: number, delta: number) => void;
  onRemove: (productId: number) => void;
  onClear: () => void;
  cashierId: number;
  sessionId: number | null;
  onSaleComplete: () => void;
}

type PayMethod = "cash" | "card" | "wallet";

const fmt = (n: number) => `$${(n / 100).toFixed(2)}`;

export default function CartPanel({
  items,
  onQuantityChange,
  onRemove,
  onClear,
  cashierId,
  sessionId,
  onSaleComplete,
}: Props) {
  const [payMethod, setPayMethod]   = useState<PayMethod>("cash");
  const [tendered, setTendered]     = useState("");
  const [processing, setProcessing] = useState(false);

  const subtotal  = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const discount  = items.reduce((s, i) => s + i.discount * i.quantity, 0);
  const tax       = items.reduce((s, i) => {
    if (!i.product.apply_tva) return s;
    return s + Math.round(i.unit_price * i.quantity * i.product.tva_rate);
  }, 0);
  const total     = subtotal - discount + tax;
  const tenderedN = Math.round(parseFloat(tendered || "0") * 100);
  const change    = tenderedN - total;

  const canCheckout = items.length > 0 && (payMethod !== "cash" || tenderedN >= total);

  const handleCheckout = async () => {
    if (!canCheckout || processing) return;
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
      onSaleComplete();
      setTendered("");
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="w-[360px] flex-shrink-0 flex flex-col border-l border-[#1E3050] bg-[#0D1526]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E3050]">
        <div className="flex items-center gap-2 text-white font-semibold">
          <ShoppingBag size={16} className="text-[#14B8A6]" />
          <span>Cart</span>
          {items.length > 0 && (
            <span className="bg-[#14B8A6] text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="text-slate-500 hover:text-red-400 text-xs transition-colors cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
            <ShoppingBag size={40} strokeWidth={1} />
            <p className="text-sm">Scan or tap a product to add it</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.product.id}
              className="fade-in flex items-center gap-2 bg-[#131F35] border border-[#1E3050] rounded-xl px-3 py-2.5 group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate leading-tight">
                  {item.product.name}
                </div>
                <div className="text-[#14B8A6] text-xs tabular mt-0.5">
                  {fmt(item.unit_price)} × {item.quantity}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onQuantityChange(item.product.id, -1)}
                  className="w-6 h-6 rounded-lg bg-[#1A2A44] hover:bg-[#243558] text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Minus size={12} />
                </button>
                <span className="text-white text-sm font-medium w-6 text-center tabular">
                  {item.quantity}
                </span>
                <button
                  onClick={() => onQuantityChange(item.product.id, 1)}
                  className="w-6 h-6 rounded-lg bg-[#1A2A44] hover:bg-[#14B8A6]/30 hover:text-[#14B8A6] text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Plus size={12} />
                </button>
              </div>

              <div className="text-white text-sm font-semibold tabular w-16 text-right">
                {fmt(item.unit_price * item.quantity)}
              </div>

              <button
                onClick={() => onRemove(item.product.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Totals + payment */}
      <div className="border-t border-[#1E3050] p-4 space-y-3">
        {/* Breakdown */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span className="tabular">{fmt(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-400">
              <span>Discount</span>
              <span className="tabular">−{fmt(discount)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>TVA</span>
              <span className="tabular">{fmt(tax)}</span>
            </div>
          )}
          <div className="flex justify-between text-white font-bold text-base pt-1.5 border-t border-[#1E3050]">
            <span>Total</span>
            <span className="tabular text-[#14B8A6]">{fmt(total)}</span>
          </div>
        </div>

        {/* Payment method */}
        <div className="grid grid-cols-3 gap-1.5">
          {(["cash", "card", "wallet"] as PayMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => setPayMethod(m)}
              className={`py-2 rounded-xl text-xs font-semibold capitalize flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                payMethod === m
                  ? "bg-[#14B8A6]/15 border-[#14B8A6]/50 text-[#14B8A6]"
                  : "bg-[#131F35] border-[#1E3050] text-slate-400 hover:border-[#243558] hover:text-slate-300"
              }`}
            >
              {m === "cash"   && <Banknote  size={14} />}
              {m === "card"   && <CreditCard size={14} />}
              {m === "wallet" && <Wallet     size={14} />}
              {m}
            </button>
          ))}
        </div>

        {/* Cash tendered */}
        {payMethod === "cash" && (
          <div className="space-y-1.5">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount tendered…"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="w-full bg-[#131F35] border border-[#1E3050] focus:border-[#14B8A6]/50 focus:outline-none rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 tabular transition-colors"
            />
            {tenderedN >= total && total > 0 && (
              <div className="flex justify-between text-emerald-400 text-sm font-semibold px-1">
                <span>Change</span>
                <span className="tabular">{fmt(change)}</span>
              </div>
            )}
          </div>
        )}

        {/* Checkout button */}
        <button
          onClick={handleCheckout}
          disabled={!canCheckout || processing}
          className="w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed
            bg-[#14B8A6] hover:bg-[#0D9488] active:scale-[0.98] text-slate-900 shadow-[#14B8A6]/20"
        >
          {processing ? (
            <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
          ) : (
            <>Charge {fmt(total)}</>
          )}
        </button>
      </div>
    </div>
  );
}
