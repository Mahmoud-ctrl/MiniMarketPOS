import {
  createContext, useCallback, useContext, useMemo,
  useReducer, type ReactNode,
} from "react";
import type { CartItem, PriceTier, Product } from "../types";

// ── Reducer ───────────────────────────────────────────────────────────────────

type Action =
  | { type: "ADD";     product: Product; unitPrice: number; tier: PriceTier }
  | { type: "SET_QTY"; productId: number; qty: number }
  | { type: "REMOVE";  productId: number }
  | { type: "CLEAR" }
  | { type: "SET_TIER"; tier: PriceTier };

interface CartState {
  items: CartItem[];
  priceTier: PriceTier;
}

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case "ADD": {
      const idx = state.items.findIndex((i) => i.product.id === action.product.id);
      if (idx >= 0) {
        const next = [...state.items];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return { ...state, items: next };
      }
      return {
        ...state,
        items: [...state.items, {
          product:    action.product,
          quantity:   1,
          unit_price: action.unitPrice,
          price_tier: action.tier,
          discount:   0,
        }],
      };
    }
    case "SET_QTY": {
      if (action.qty <= 0)
        return { ...state, items: state.items.filter((i) => i.product.id !== action.productId) };
      return {
        ...state,
        items: state.items.map((i) =>
          i.product.id === action.productId ? { ...i, quantity: action.qty } : i
        ),
      };
    }
    case "REMOVE":
      return { ...state, items: state.items.filter((i) => i.product.id !== action.productId) };
    case "CLEAR":
      return { ...state, items: [] };
    case "SET_TIER":
      return { ...state, priceTier: action.tier };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface CartCtxValue {
  items:          CartItem[];
  priceTier:      PriceTier;
  itemCount:      number;
  subtotal:       number;
  discount:       number;
  tva:            number;
  addToCart:      (product: Product) => void;
  changeQty:      (productId: number, delta: number) => void;
  setQty:         (productId: number, qty: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart:      () => void;
  setPriceTier:   (tier: PriceTier) => void;
}

const CartCtx = createContext<CartCtxValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

function priceFor(p: Product, tier: PriceTier): number {
  if (tier === "wholesale") return p.sell_price_wholesale;
  if (tier === "special")   return p.sell_price_special;
  return p.sell_price_retail;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [], priceTier: "retail" });

  const addToCart = useCallback(
    (product: Product) => {
      if (product.is_frozen) return;
      dispatch({
        type:      "ADD",
        product,
        unitPrice: priceFor(product, state.priceTier),
        tier:      state.priceTier,
      });
    },
    [state.priceTier],
  );

  const derived = useMemo(() => {
    const subtotal = state.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const discount = state.items.reduce((s, i) => s + i.discount * i.quantity, 0);
    const tva      = state.items.reduce((s, i) =>
      i.product.apply_tva
        ? s + Math.round(i.unit_price * i.quantity * i.product.tva_rate)
        : s, 0);
    return { itemCount: state.items.reduce((s, i) => s + i.quantity, 0), subtotal, discount, tva };
  }, [state.items]);

  const value: CartCtxValue = {
    items:     state.items,
    priceTier: state.priceTier,
    ...derived,
    addToCart,
    changeQty: (id, delta) => {
      const item = state.items.find((i) => i.product.id === id);
      if (item) dispatch({ type: "SET_QTY", productId: id, qty: item.quantity + delta });
    },
    setQty:         (id, qty) => dispatch({ type: "SET_QTY",  productId: id, qty }),
    removeFromCart: (id)      => dispatch({ type: "REMOVE",   productId: id }),
    clearCart:      ()        => dispatch({ type: "CLEAR" }),
    setPriceTier:   (tier)    => dispatch({ type: "SET_TIER", tier }),
  };

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCart(): CartCtxValue {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be inside <CartProvider>");
  return ctx;
}
