import {
  createContext, useCallback, useContext, useEffect, useMemo,
  useReducer, useState, type ReactNode,
} from "react";
import { api } from "../lib/api";
import type { CartItem, PriceTier, Product, Promotion } from "../types";

// ── Per-tab state ─────────────────────────────────────────────────────────────

interface Tab {
  id:        number;
  label:     string;
  items:     CartItem[];
  priceTier: PriceTier;
  isHeld:    boolean;
}

interface MultiCartState {
  tabs:        Tab[];
  activeTabId: number;
  nextId:      number;
  nextLineId:  number;
}

function makeTab(id: number): Tab {
  return { id, label: `Order ${id}`, items: [], priceTier: "retail", isHeld: false };
}

const INITIAL: MultiCartState = {
  tabs:        [makeTab(1)],
  activeTabId: 1,
  nextId:      2,
  nextLineId:  1,
};

// ── Reducer ───────────────────────────────────────────────────────────────────

type Action =
  | { type: "ADD_TAB" }
  | { type: "REMOVE_TAB";    tabId: number }
  | { type: "SWITCH_TAB";    tabId: number }
  | { type: "ADD";           product: Product; unitPrice: number; tier: PriceTier; unitMultiplier: number; unitLabel: string }
  | { type: "SET_QTY";       lineId: number; qty: number }
  | { type: "REMOVE";        lineId: number }
  | { type: "CLEAR" }
  | { type: "SET_TIER";      tier: PriceTier }
  | { type: "SET_UNIT";      lineId: number; multiplier: number; label: string; baseUnitPrice: number }
  | { type: "HOLD_TAB" }
  | { type: "MOVE_LINE";     lineId: number; toTabId: number }
  | { type: "MERGE_TABS";    fromTabId: number };

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
      const lineId   = state.nextLineId;
      const newState = { ...state, nextLineId: lineId + 1 };
      return updateActive(newState, t => {
        // Variable-price products always get a new line
        if (action.product.is_variable_price) {
          return {
            ...t,
            items: [...t.items, {
              lineId, product: action.product, quantity: 1,
              unit_price: action.unitPrice, price_tier: action.tier,
              discount: 0, unit_multiplier: action.unitMultiplier, unit_label: action.unitLabel,
            }],
          };
        }
        // Regular: merge if same product + same unit_multiplier
        const idx = t.items.findIndex(
          i => i.product.id === action.product.id && i.unit_multiplier === action.unitMultiplier,
        );
        if (idx >= 0) {
          const next = [...t.items];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          return { ...t, items: next };
        }
        return {
          ...t,
          items: [...t.items, {
            lineId, product: action.product, quantity: 1,
            unit_price: action.unitPrice, price_tier: action.tier,
            discount: 0, unit_multiplier: action.unitMultiplier, unit_label: action.unitLabel,
          }],
        };
      });
    }

    case "SET_QTY":
      return updateActive(state, t => ({
        ...t,
        items: action.qty <= 0
          ? t.items.filter(i => i.lineId !== action.lineId)
          : t.items.map(i => i.lineId === action.lineId ? { ...i, quantity: action.qty } : i),
      }));

    case "REMOVE":
      return updateActive(state, t => ({ ...t, items: t.items.filter(i => i.lineId !== action.lineId) }));

    case "CLEAR":
      return updateActive(state, t => ({ ...t, items: [] }));

    case "SET_TIER":
      return updateActive(state, t => ({ ...t, priceTier: action.tier }));

    case "SET_UNIT":
      return updateActive(state, t => ({
        ...t,
        items: t.items.map(i => {
          if (i.lineId !== action.lineId) return i;
          return { ...i, unit_price: action.baseUnitPrice * action.multiplier, unit_multiplier: action.multiplier, unit_label: action.label };
        }),
      }));

    case "HOLD_TAB":
      return updateActive(state, t => ({ ...t, isHeld: !t.isHeld }));

    case "MOVE_LINE": {
      const activeTab = state.tabs.find(t => t.id === state.activeTabId);
      if (!activeTab) return state;
      const line = activeTab.items.find(i => i.lineId === action.lineId);
      if (!line) return state;

      return {
        ...state,
        tabs: state.tabs.map(t => {
          if (t.id === state.activeTabId) {
            return { ...t, items: t.items.filter(i => i.lineId !== action.lineId) };
          }
          if (t.id === action.toTabId) {
            if (!line.product.is_variable_price) {
              const existing = t.items.findIndex(
                i => i.product.id === line.product.id && i.unit_multiplier === line.unit_multiplier,
              );
              if (existing >= 0) {
                const next = [...t.items];
                next[existing] = { ...next[existing], quantity: next[existing].quantity + line.quantity };
                return { ...t, items: next };
              }
            }
            return { ...t, items: [...t.items, line] };
          }
          return t;
        }),
      };
    }

    case "MERGE_TABS": {
      const fromTab = state.tabs.find(t => t.id === action.fromTabId);
      if (!fromTab || state.tabs.length <= 1) return state;

      return {
        ...state,
        tabs: state.tabs
          .filter(t => t.id !== action.fromTabId)
          .map(t => {
            if (t.id !== state.activeTabId) return t;
            let items = [...t.items];
            for (const line of fromTab.items) {
              if (!line.product.is_variable_price) {
                const existing = items.findIndex(
                  i => i.product.id === line.product.id && i.unit_multiplier === line.unit_multiplier,
                );
                if (existing >= 0) {
                  items[existing] = { ...items[existing], quantity: items[existing].quantity + line.quantity };
                  continue;
                }
              }
              items = [...items, line];
            }
            return { ...t, items };
          }),
      };
    }

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface TabSummary { id: number; label: string; itemCount: number; isHeld: boolean; }

// PromoCartItem is a derived (read-only) line computed from promotions — never stored in state
export interface PromoCartItem extends CartItem {
  is_promo:   true;
  promo_name: string;
}

interface CartCtxValue {
  items:          CartItem[];
  promoItems:     PromoCartItem[];
  priceTier:      PriceTier;
  itemCount:      number;
  subtotal:       number;
  discount:       number;
  tva:            number;
  addToCart:      (product: Product, overridePrice?: number, unitMultiplier?: number, unitLabel?: string) => void;
  changeQty:      (lineId: number, delta: number) => void;
  setQty:         (lineId: number, qty: number) => void;
  removeFromCart: (lineId: number) => void;
  clearCart:      () => void;
  setPriceTier:   (tier: PriceTier) => void;
  setUnit:        (lineId: number, multiplier: number, label: string, baseUnitPrice: number) => void;
  holdTab:        () => void;
  moveLineToTab:  (lineId: number, toTabId: number) => void;
  mergeTabs:      (fromTabId: number) => void;
  tabs:           TabSummary[];
  activeTabId:    number;
  addTab:         () => void;
  removeTab:      (tabId: number) => void;
  switchTab:      (tabId: number) => void;
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
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    api.getPromotions().then(setPromotions).catch(() => {});
  }, []);

  const activeTab = state.tabs.find(t => t.id === state.activeTabId) ?? state.tabs[0];

  const addToCart = useCallback(
    (product: Product, overridePrice?: number, unitMultiplier = 1, unitLabel?: string) => {
      if (product.is_frozen) return;
      const basePrice = priceFor(product, activeTab.priceTier);
      const unitPrice = overridePrice !== undefined ? overridePrice : basePrice * unitMultiplier;
      dispatch({
        type: "ADD",
        product,
        unitPrice,
        tier: activeTab.priceTier,
        unitMultiplier,
        unitLabel: unitLabel ?? product.unit,
      });
    },
    [activeTab.priceTier],
  );

  const { subtotal, discount, tva, itemCount, promoItems } = useMemo(() => {
    const { items } = activeTab;

    // Compute BOGO promo lines (read-only, derived)
    const promos: PromoCartItem[] = [];
    let promoId = -1;
    for (const item of items) {
      const promo = promotions.find(p => p.product_id === item.product.id && p.is_active);
      if (promo) {
        const freeQty = Math.floor(item.quantity / promo.buy_qty) * promo.get_qty;
        if (freeQty > 0) {
          promos.push({
            is_promo:   true,
            promo_name: promo.name,
            lineId:          promoId--,
            product:         item.product,
            quantity:        freeQty,
            unit_price:      item.unit_price,
            price_tier:      item.price_tier,
            discount:        item.unit_price, // 100% off — net = 0
            unit_multiplier: item.unit_multiplier,
            unit_label:      item.unit_label,
          });
        }
      }
    }

    const allItems = [...items, ...promos];
    const subtotal  = allItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const discount  = allItems.reduce((s, i) => s + i.discount  * i.quantity, 0);
    const tva       = items.reduce((s, i) =>
      i.product.apply_tva ? s + Math.round(i.unit_price * i.quantity * i.product.tva_rate) : s, 0);
    const itemCount = items.reduce((s, i) => s + i.quantity, 0);

    return { subtotal, discount, tva, itemCount, promoItems: promos };
  }, [activeTab.items, promotions]);

  const tabSummaries: TabSummary[] = useMemo(
    () => state.tabs.map(t => ({
      id:        t.id,
      label:     t.label,
      itemCount: t.items.reduce((s, i) => s + i.quantity, 0),
      isHeld:    t.isHeld,
    })),
    [state.tabs],
  );

  const value: CartCtxValue = {
    items:     activeTab.items,
    promoItems,
    priceTier: activeTab.priceTier,
    subtotal, discount, tva, itemCount,
    addToCart,
    changeQty: (lineId, delta) => {
      const item = activeTab.items.find(i => i.lineId === lineId);
      if (item) dispatch({ type: "SET_QTY", lineId, qty: item.quantity + delta });
    },
    setQty:         (lineId, qty)   => dispatch({ type: "SET_QTY",    lineId, qty }),
    removeFromCart: (lineId)        => dispatch({ type: "REMOVE",     lineId }),
    clearCart:      ()              => dispatch({ type: "CLEAR" }),
    setPriceTier:   (tier)          => dispatch({ type: "SET_TIER",   tier }),
    setUnit:        (lineId, multiplier, label, baseUnitPrice) =>
                                       dispatch({ type: "SET_UNIT",   lineId, multiplier, label, baseUnitPrice }),
    holdTab:        ()              => dispatch({ type: "HOLD_TAB" }),
    moveLineToTab:  (lineId, toTabId) => dispatch({ type: "MOVE_LINE", lineId, toTabId }),
    mergeTabs:      (fromTabId)     => dispatch({ type: "MERGE_TABS", fromTabId }),
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
