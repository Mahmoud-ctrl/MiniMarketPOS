import { useEffect, useRef, useState } from "react";
import {
  BarChart3, BoxesIcon, Home, LogOut, Moon, Sun,
  Package, QrCode, ScrollText, Search, Settings, Truck, Users, Zap,
} from "lucide-react";
import { api } from "../lib/api";
import { Category, PriceTier, Product, User } from "../types";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import { useTheme } from "../context/ThemeContext";
import CartPanel from "../components/CartPanel";
import InventoryScreen from "./InventoryScreen";
import PurchasesScreen from "./PurchasesScreen";
import ReportsScreen from "./ReportsScreen";
import SettingsScreen from "./SettingsScreen";
import TransactionsScreen from "./TransactionsScreen";
import CustomersScreen from "./CustomersScreen";

interface Props {
  user: User;
  onLogout: () => void;
}

type Screen = "pos" | "inventory" | "purchases" | "reports" | "transactions" | "customers" | "settings";

// fmt is provided by useCurrency — see inside POSScreen component

// Distinct color per category (derived from id)
const CAT_COLORS = [
  "#14B8A6", "#6366F1", "#F59E0B", "#10B981",
  "#EF4444", "#8B5CF6", "#06B6D4", "#F97316",
  "#EC4899", "#84CC16",
];
const catColor = (id: number | null) =>
  id == null ? "#475569" : CAT_COLORS[id % CAT_COLORS.length];

const NAV: { id: Screen; icon: typeof Home; label: string }[] = [
  { id: "pos",          icon: Home,       label: "POS"          },
  { id: "inventory",    icon: Package,    label: "Inventory"    },
  { id: "purchases",    icon: Truck,      label: "Purchases"    },
  { id: "transactions", icon: ScrollText, label: "Transactions" },
  { id: "reports",      icon: BarChart3,  label: "Reports"      },
  { id: "customers",    icon: Users,      label: "Customers"    },
  { id: "settings",     icon: Settings,   label: "Settings"     },
];

export default function POSScreen({ user, onLogout }: Props) {
  const { fmt, fmtAlt, showAlt } = useCurrency();
  const { theme, toggleTheme } = useTheme();
  const { addToCart, priceTier, setPriceTier, items: cartItems } = useCart();

  const [screen, setScreen]           = useState<Screen>("pos");
  const [products, setProducts]       = useState<Product[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [search, setSearch]           = useState("");
  const [activeCat, setActiveCat]     = useState<number | null>(null);
  const [loadingProd, setLoadingProd] = useState(false);
  const [sessionId, setSessionId]     = useState<number | null>(null);
  const [toast, setToast]             = useState<string | null>(null);
  const searchRef                     = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
    api.getActiveSession(user.id)
      .then((s) => s && setSessionId(s.id))
      .catch(console.error);
  }, [user.id]);

  useEffect(() => {
    setLoadingProd(true);
    // If the selected category has children, fetch without category filter and
    // narrow client-side so both the parent and all its children are included.
    const childIds = activeCat != null
      ? categories.filter(c => c.parent_id === activeCat).map(c => c.id)
      : [];
    const isRoot = childIds.length > 0;

    api
      .getProducts({
        search:      search || undefined,
        category_id: activeCat != null && !isRoot ? activeCat : undefined,
        limit:       isRoot ? 300 : 80,
      })
      .then(data => {
        if (isRoot) {
          const relevant = new Set([activeCat!, ...childIds]);
          setProducts(data.filter(p => p.category_id != null && relevant.has(p.category_id)));
        } else {
          setProducts(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingProd(false));
  }, [search, activeCat, categories]);

  // Focus search on any printable keystroke while on POS screen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (screen !== "pos") return;
      const active = document.activeElement;
      const inInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
      if (!inInput && e.target !== searchRef.current && !e.ctrlKey && !e.metaKey && /^\w$/.test(e.key)) {
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSaleComplete = () => {
    showToast("✓ Sale completed");
    searchRef.current?.focus();
  };

  // Enter key in search = barcode scan lookup
  const handleSearchKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !search.trim()) return;
    try {
      const p = await api.getProductByBarcode(search.trim());
      if (p) { addToCart(p); setSearch(""); }
      else   showToast("Product not found");
    } catch {
      showToast("Barcode lookup failed");
    }
  };

  return (
    <div className="h-screen flex bg-[var(--bg-deep)] overflow-hidden">

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <div className="w-20 flex-shrink-0 flex flex-col items-center py-5 gap-1 border-r border-[var(--bd-faint)] bg-[var(--bg-panel)]">
        {/* Logo */}
        <div className="w-10 h-10 rounded-2xl bg-[#14B8A6] flex items-center justify-center mb-5 shadow-lg shadow-[#14B8A6]/30">
          <Zap size={18} className="text-[#020817]" fill="currentColor" />
        </div>

        {NAV.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            className={`flex flex-col items-center gap-1.5 w-14 py-3 rounded-xl transition-all duration-150 cursor-pointer ${
              screen === id
                ? "bg-[#14B8A6]/15 text-[#14B8A6]"
                : "text-slate-600 hover:text-slate-400 hover:bg-[var(--bg-base)]"
            }`}
          >
            <Icon size={19} />
            <span className="text-[10px] font-semibold tracking-wide leading-none">{label}</span>
          </button>
        ))}

        <div className="flex-1" />

        {/* Theme toggle */}
        <button
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
          className="flex flex-col items-center gap-1.5 w-14 py-3 rounded-xl text-slate-600 hover:text-[#14B8A6] hover:bg-[#14B8A6]/10 transition-all cursor-pointer"
        >
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          <span className="text-[10px] font-semibold tracking-wide leading-none">
            {theme === "dark" ? "Light" : "Dark"}
          </span>
        </button>

        {/* User avatar / logout */}
        <button
          title={`Logout ${user.full_name}`}
          onClick={onLogout}
          className="group flex flex-col items-center gap-1.5 w-14 py-3 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-[#14B8A6] group-hover:bg-red-500 text-slate-900 group-hover:text-[var(--tx-base)] text-xs font-bold flex items-center justify-center transition-colors">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <LogOut size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      {screen === "inventory" ? (
        <InventoryScreen user={user} />
      ) : screen === "purchases" ? (
        <PurchasesScreen user={user} />
      ) : screen === "transactions" ? (
        <TransactionsScreen user={user} />
      ) : screen === "customers" ? (
        <CustomersScreen user={user} />
      ) : screen === "reports" ? (
        <ReportsScreen user={user} />
      ) : screen === "settings" ? (
        <SettingsScreen user={user} />
      ) : screen !== "pos" ? (
        <div className="flex-1 flex items-center justify-center text-slate-700">
          <div className="text-center space-y-3">
            {(() => {
              const { icon: Icon } = NAV.find((n) => n.id === screen)!;
              return <Icon size={52} strokeWidth={1} className="mx-auto text-slate-800" />;
            })()}
            <p className="text-slate-400 font-semibold text-lg">{NAV.find((n) => n.id === screen)?.label}</p>
            <p className="text-sm text-slate-600">Coming soon</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* ── Top bar ────────────────────────────────────────── */}
            <div className="flex items-center gap-4 px-5 py-3.5 border-b border-[var(--bd-faint)] bg-[var(--bg-panel)]">
              {/* Search */}
              <div className="flex-1 relative max-w-xl">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKey}
                  placeholder="Search products or scan barcode…"
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-base)] border border-[var(--bd-base)] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl text-[var(--tx-base)] text-sm placeholder-slate-500 transition-colors"
                />
              </div>

              {/* Barcode indicator */}
              <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                <QrCode size={13} />
                <span>Scan ready</span>
              </div>

              {/* Price tier switcher */}
              <div className="flex items-center gap-0.5 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl p-1">
                {(["retail", "wholesale", "special"] as PriceTier[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPriceTier(t)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                      priceTier === t
                        ? "bg-[#14B8A6] text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {t === "retail" ? "مفرق" : t === "wholesale" ? "جملة" : "خاص"}
                  </button>
                ))}
              </div>

              {/* Session / cashier info */}
              <div className="flex items-center gap-2 text-xs text-slate-500 border-l border-[var(--bd-base)] pl-4">
                <BoxesIcon size={13} />
                <span className="text-slate-400 font-medium">{user.full_name}</span>
                {sessionId ? (
                  <button
                    onClick={async () => {
                      try {
                        await api.closeSession(sessionId);
                        setSessionId(null);
                        showToast("Session closed");
                      } catch {
                        showToast("Failed to close session");
                      }
                    }}
                    className="text-red-400 hover:text-red-300 hover:underline cursor-pointer ml-1"
                  >
                    Close session
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        const s = await api.openCashSession(user.id, 0);
                        setSessionId(s.id);
                        showToast("Session opened");
                      } catch {
                        showToast("Failed to open session");
                      }
                    }}
                    className="text-[#14B8A6] hover:underline cursor-pointer ml-1"
                  >
                    Open session
                  </button>
                )}
              </div>
            </div>

            {/* ── Category tabs ──────────────────────────────────── */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--bd-faint)] overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveCat(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                  activeCat === null
                    ? "bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/30"
                    : "text-slate-500 hover:text-slate-300 hover:bg-[var(--bg-base)] border border-transparent"
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id === activeCat ? null : c.id)}
                  style={activeCat === c.id ? { borderColor: `${catColor(c.id)}50`, color: catColor(c.id), backgroundColor: `${catColor(c.id)}15` } : undefined}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 border ${
                    activeCat === c.id
                      ? ""
                      : "text-slate-500 hover:text-slate-300 hover:bg-[var(--bg-base)] border-transparent"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* ── Product grid ───────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-5">
              {loadingProd ? (
                <div className="grid grid-cols-3 gap-4">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="h-36 rounded-2xl bg-[var(--bg-base)]/60 border border-[var(--bd-base)] animate-pulse" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-700">
                  <Package size={52} strokeWidth={1} className="text-slate-800" />
                  <p className="text-slate-500 text-sm">No products found</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {products.map((p) => {
                    const price =
                      priceTier === "wholesale" ? p.sell_price_wholesale :
                      priceTier === "special"   ? p.sell_price_special   :
                      p.sell_price_retail;
                    const inCart = cartItems.find((ci) => ci.product.id === p.id);
                    const color  = catColor(p.category_id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (p.is_frozen) { showToast("Product is frozen"); return; }
                          addToCart(p);
                        }}
                        disabled={p.is_frozen}
                        className={`group relative text-left rounded-2xl border transition-all duration-150 cursor-pointer active:scale-[0.97] flex flex-col ${
                          p.is_frozen
                            ? "opacity-40 cursor-not-allowed bg-[var(--bg-base)] border-[var(--bd-base)]"
                            : inCart
                            ? "bg-[var(--bg-base)] border-[#14B8A6]/40 shadow-lg shadow-[#14B8A6]/10"
                            : "bg-[var(--bg-base)] border-[var(--bd-base)] hover:border-[var(--bd-strong)] hover:bg-[var(--bg-card)] hover:shadow-xl hover:shadow-black/10"
                        }`}
                      >
                        {/* Category color stripe */}
                        <div
                          className="h-[3px] w-full rounded-t-2xl flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />

                        {/* Cart badge */}
                        {inCart && (
                          <div className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-[#14B8A6] text-slate-900 text-[11px] font-bold flex items-center justify-center shadow-lg shadow-[#14B8A6]/40 z-10">
                            {inCart.quantity}
                          </div>
                        )}

                        <div className="p-4 flex flex-col flex-1">
                          <div className="text-[var(--tx-base)] text-[15px] font-semibold leading-snug line-clamp-2 mb-auto">
                            {p.name}
                          </div>
                          <div className="flex items-baseline justify-between mt-4 pt-3 border-t border-[var(--bd-base)]">
                            <div>
                              <div className="text-[#14B8A6] font-bold text-xl tabular-nums leading-none">
                                {fmt(price)}
                              </div>
                              {showAlt && (
                                <div className="text-slate-600 text-[10px] tabular-nums leading-tight mt-0.5">
                                  {fmtAlt(price)}
                                </div>
                              )}
                            </div>
                            <div className="text-slate-600 text-[11px] font-medium">
                              {p.unit}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Status bar ─────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-5 py-2 border-t border-[var(--bd-faint)] bg-[var(--bg-panel)] text-[11px] text-slate-500">
              <span>{products.length} products</span>
              <span className="text-slate-800">·</span>
              <span>{new Date().toLocaleTimeString()}</span>
              {!sessionId && <span className="text-amber-500">· No open session</span>}
            </div>
          </div>

          {/* ── Cart ──────────────────────────────────────────────── */}
          <CartPanel
            user={user}
            sessionId={sessionId}
            onSaleComplete={handleSaleComplete}
          />
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--bg-base)] border border-[var(--bd-base)] text-[var(--tx-base)] text-sm px-5 py-3 rounded-xl shadow-2xl fade-in z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
