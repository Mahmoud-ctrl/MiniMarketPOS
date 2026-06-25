import {
  createContext, useCallback, useContext, useMemo,
  useReducer, type ReactNode,
} from "react";
import type { CartItem, PriceTier, Product } from "../types";

// ── Per-tab state ─────────────────────────────────────────────────────────────

interface Tab {
  id:        number;
  label:     string;
  items:     CartItem[];
  priceTier: PriceTier;
}

interface MultiCartState {
  tabs:        Tab[];
  activeTabId: number;
  nextId:      number;
}

function makeTab(id: number): Tab {
  return { id, label: `Order ${id}`, items: [], priceTier: "retail" };
}

const INITIAL: MultiCartState = {
  tabs:        [makeTab(1)],
  activeTabId: 1,
  nextId:      2,
};

// ── Reducer ───────────────────────────────────────────────────────────────────

type Action =
  | { type: "ADD_TAB" }
  | { type: "REMOVE_TAB"; tabId: number }
  | { type: "SWITCH_TAB"; tabId: number }
  | { type: "ADD";     product: Product; unitPrice: number; tier: PriceTier }
  | { type: "SET_QTY"; productId: number; qty: number }
  | { type: "REMOVE";  productId: number }
  | { type: "CLEAR" }
  | { type: "SET_TIER"; tier: PriceTier };

function updateActive(state: MultiCartState, fn: (t: Tab) => Tab): MultiCartState {
  return { ...state, tabs: state.tabs.map(t => t.id === state.activeTabId ? fn(t) : t) };
}

function reducer(state: MultiCartState, action: Action): MultiCartState {
  switch (action.type) {

    case "ADD_TAB": {
      const tab = makeTab(state.nextId);
      return { ...state, tabs: [...state.tabs, tab], activeTabId: tab.id, nextId: state.nextId + 1 };
    }

    case "REMOVE_TAB": {
      if (state.tabs.length <= 1) return state;
      const remaining = state.tabs.filter(t => t.id !== action.tabId);
      const newActive = state.activeTabId === action.tabId
        ? remaining[Math.max(0, state.tabs.findIndex(t => t.id === action.tabId) - 1)].id
        : state.activeTabId;
      return { ...state, tabs: remaining, activeTabId: newActive };
    }

    case "SWITCH_TAB":
      return { ...state, activeTabId: action.tabId };

    case "ADD": {
      return updateActive(state, t => {
        const idx = t.items.findIndex(i => i.product.id === action.product.id);
        if (idx >= 0) {
          const next = [...t.items];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          return { ...t, items: next };
        }
        return { ...t, items: [...t.items, { product: action.product, quantity: 1, unit_price: action.unitPrice, price_tier: action.tier, discount: 0 }] };
      });
    }

    case "SET_QTY":
      return updateActive(state, t => ({
        ...t,
        items: action.qty <= 0
          ? t.items.filter(i => i.product.id !== action.productId)
          : t.items.map(i => i.product.id === action.productId ? { ...i, quantity: action.qty } : i),
      }));

    case "REMOVE":
      return updateActive(state, t => ({ ...t, items: t.items.filter(i => i.product.id !== action.productId) }));

    case "CLEAR":
      return updateActive(state, t => ({ ...t, items: [] }));

    case "SET_TIER":
      return updateActive(state, t => ({ ...t, priceTier: action.tier }));

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface TabSummary { id: number; label: string; itemCount: number; }

interface CartCtxValue {
  // Active tab data (same API as before — nothing else changes)
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
  // Tab management
  tabs:        TabSummary[];
  activeTabId: number;
  addTab:      () => void;
  removeTab:   (tabId: number) => void;
  switchTab:   (tabId: number) => void;
}

const CartCtx = createContext<CartCtxValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

function priceFor(p: Product, tier: PriceTier): number {
  if (tier === "wholesale") return p.sell_price_wholesale;
  if (tier === "special")   return p.sell_price_special;
  return p.sell_price_retail;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const activeTab = state.tabs.find(t => t.id === state.activeTabId) ?? state.tabs[0];

  const addToCart = useCallback(
    (product: Product) => {
      if (product.is_frozen) return;
      dispatch({ type: "ADD", product, unitPrice: priceFor(product, activeTab.priceTier), tier: activeTab.priceTier });
    },
    [activeTab.priceTier],
  );

  const derived = useMemo(() => {
    const { items } = activeTab;
    const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const discount = items.reduce((s, i) => s + i.discount * i.quantity, 0);
    const tva      = items.reduce((s, i) =>
      i.product.apply_tva ? s + Math.round(i.unit_price * i.quantity * i.product.tva_rate) : s, 0);
    return { itemCount: items.reduce((s, i) => s + i.quantity, 0), subtotal, discount, tva };
  }, [activeTab]);

  const tabSummaries: TabSummary[] = useMemo(
    () => state.tabs.map(t => ({
      id:        t.id,
      label:     t.label,
      itemCount: t.items.reduce((s, i) => s + i.quantity, 0),
    })),
    [state.tabs],
  );

  const value: CartCtxValue = {
    items:     activeTab.items,
    priceTier: activeTab.priceTier,
    ...derived,
    addToCart,
    changeQty: (id, delta) => {
      const item = activeTab.items.find(i => i.product.id === id);
      if (item) dispatch({ type: "SET_QTY", productId: id, qty: item.quantity + delta });
    },
    setQty:         (id, qty) => dispatch({ type: "SET_QTY",  productId: id, qty }),
    removeFromCart: (id)      => dispatch({ type: "REMOVE",   productId: id }),
    clearCart:      ()        => dispatch({ type: "CLEAR" }),
    setPriceTier:   (tier)    => dispatch({ type: "SET_TIER", tier }),
    tabs:        tabSummaries,
    activeTabId: state.activeTabId,
    addTab:      () => dispatch({ type: "ADD_TAB" }),
    removeTab:   (tabId) => dispatch({ type: "REMOVE_TAB", tabId }),
    switchTab:   (tabId) => dispatch({ type: "SWITCH_TAB", tabId }),
  };

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCart(): CartCtxValue {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be inside <CartProvider>");
  return ctx;
}
