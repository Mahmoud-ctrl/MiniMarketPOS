import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3, BoxesIcon, Home, LogOut,
  Package, QrCode, Search, Settings, Users, Zap,
} from "lucide-react";
import { api } from "../lib/api";
import { CartItem, Category, PriceTier, Product, User } from "../types";
import CartPanel from "../components/CartPanel";
import InventoryScreen from "./InventoryScreen";
import SettingsScreen from "./SettingsScreen";

interface Props {
  user: User;
  onLogout: () => void;
}

type Screen = "pos" | "inventory" | "reports" | "customers" | "settings";

const fmt = (n: number) => `$${(n / 100).toFixed(2)}`;

const NAV: { id: Screen; icon: typeof Home; label: string }[] = [
  { id: "pos",       icon: Home,     label: "POS"       },
  { id: "inventory", icon: Package,  label: "Inventory" },
  { id: "reports",   icon: BarChart3,label: "Reports"   },
  { id: "customers", icon: Users,    label: "Customers" },
  { id: "settings",  icon: Settings, label: "Settings"  },
];

export default function POSScreen({ user, onLogout }: Props) {
  const [screen, setScreen]         = useState<Screen>("pos");
  const [products, setProducts]     = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart]             = useState<CartItem[]>([]);
  const [search, setSearch]         = useState("");
  const [activeCat, setActiveCat]   = useState<number | null>(null);
  const [loadingProd, setLoadingProd] = useState(false);
  const [sessionId, setSessionId]   = useState<number | null>(null);
  const [priceTier, setPriceTier]   = useState<PriceTier>("retail");
  const [toast, setToast]           = useState<string | null>(null);
  const searchRef                   = useRef<HTMLInputElement>(null);

  // Load categories once
  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
    api.getActiveSession(user.id)
      .then((s) => s && setSessionId(s.id))
      .catch(console.error);
  }, [user.id]);

  // Load products when search / category changes
  useEffect(() => {
    setLoadingProd(true);
    api
      .getProducts({ search: search || undefined, category_id: activeCat ?? undefined, limit: 80 })
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoadingProd(false));
  }, [search, activeCat]);

  // Barcode scan: focus search on any keydown in POS screen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (screen !== "pos") return;
      if (e.target !== searchRef.current && !e.ctrlKey && !e.metaKey && /^\w$/.test(e.key)) {
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const addToCart = useCallback(
    (product: Product) => {
      if (product.is_frozen) { showToast("Product is frozen"); return; }
      const price =
        priceTier === "wholesale" ? product.sell_price_wholesale :
        priceTier === "special"   ? product.sell_price_special   :
        product.sell_price_retail;

      setCart((prev) => {
        const existing = prev.find((i) => i.product.id === product.id);
        if (existing) {
          return prev.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return [...prev, { product, quantity: 1, unit_price: price, price_tier: priceTier, discount: 0 }];
      });
    },
    [priceTier]
  );

  const changeQty = (productId: number, delta: number) => {
    setCart((prev) => {
      const updated = prev.map((i) =>
        i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i
      );
      return updated.filter((i) => i.quantity > 0);
    });
  };

  const removeFromCart = (productId: number) =>
    setCart((prev) => prev.filter((i) => i.product.id !== productId));

  const handleSaleComplete = () => {
    setCart([]);
    showToast("✓ Sale completed");
    searchRef.current?.focus();
  };

  return (
    <div className="h-screen flex bg-[#020817] overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div className="w-16 flex-shrink-0 flex flex-col items-center py-4 gap-1 border-r border-[#1E3050] bg-[#0D1526]">
        {/* Logo */}
        <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/25 flex items-center justify-center mb-4">
          <Zap size={17} className="text-[#14B8A6]" />
        </div>

        {NAV.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => setScreen(id)}
            className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer ${
              screen === id
                ? "bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/30"
                : "text-slate-600 hover:text-slate-400 hover:bg-[#131F35]"
            }`}
          >
            <Icon size={18} />
            <span className="absolute left-12 bg-[#131F35] border border-[#1E3050] text-white text-xs px-2 py-1 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
              {label}
            </span>
          </button>
        ))}

        <div className="flex-1" />

        {/* User avatar */}
        <button
          title={`${user.full_name} — logout`}
          onClick={onLogout}
          className="group relative w-9 h-9 rounded-full bg-[#14B8A6] text-slate-900 font-bold text-sm flex items-center justify-center cursor-pointer hover:bg-red-500 hover:text-white transition-colors duration-200"
        >
          {user.full_name.charAt(0).toUpperCase()}
          <span className="absolute left-11 bg-[#131F35] border border-[#1E3050] text-white text-xs px-2 py-1 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl flex items-center gap-1.5">
            <LogOut size={10} /> Logout
          </span>
        </button>
      </div>

      {/* ── Main content ─────────────────────────────────────── */}
      {screen === "inventory" ? (
        <InventoryScreen user={user} />
      ) : screen === "settings" ? (
        <SettingsScreen user={user} />
      ) : screen !== "pos" ? (
        <div className="flex-1 flex items-center justify-center text-slate-600">
          <div className="text-center space-y-2">
            {(() => { const { icon: Icon } = NAV.find(n => n.id === screen)!; return <Icon size={48} strokeWidth={1} className="mx-auto mb-4 text-slate-700" />; })()}
            <p className="text-slate-400 font-medium">{NAV.find(n => n.id === screen)?.label}</p>
            <p className="text-sm">Coming soon</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Top bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1E3050] bg-[#0D1526]">
              {/* Search */}
              <div className="flex-1 relative max-w-lg">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products or scan barcode…"
                  className="w-full pl-9 pr-4 py-2 bg-[#131F35] border border-[#1E3050] focus:border-[#14B8A6]/50 focus:outline-none rounded-xl text-white text-sm placeholder-slate-600 transition-colors"
                />
              </div>

              {/* Barcode scan hint */}
              <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                <QrCode size={13} />
                <span>Scan ready</span>
              </div>

              {/* Price tier */}
              <div className="flex items-center gap-1 bg-[#131F35] border border-[#1E3050] rounded-xl p-1">
                {(["retail","wholesale","special"] as PriceTier[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPriceTier(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                      priceTier === t
                        ? "bg-[#14B8A6] text-slate-900"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Session / cashier */}
              <div className="flex items-center gap-2 text-xs text-slate-500 border-l border-[#1E3050] pl-3">
                <BoxesIcon size={13} />
                <span>{user.full_name}</span>
                {!sessionId && (
                  <button
                    onClick={async () => {
                      const s = await api.openCashSession(user.id, 0);
                      setSessionId(s.id);
                      showToast("Session opened");
                    }}
                    className="text-[#14B8A6] hover:underline cursor-pointer"
                  >
                    Open session
                  </button>
                )}
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#1E3050] overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveCat(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                  activeCat === null
                    ? "bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/30"
                    : "text-slate-500 hover:text-slate-300 hover:bg-[#131F35]"
                }`}
              >
                All products
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id === activeCat ? null : c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                    activeCat === c.id
                      ? "bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/30"
                      : "text-slate-500 hover:text-slate-300 hover:bg-[#131F35]"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingProd ? (
                <div className="grid grid-cols-4 gap-3">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-2xl bg-[#131F35]/60 border border-[#1E3050] animate-pulse" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
                  <Package size={48} strokeWidth={1} />
                  <p className="text-sm">No products found</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {products.map((p) => {
                    const price =
                      priceTier === "wholesale" ? p.sell_price_wholesale :
                      priceTier === "special"   ? p.sell_price_special   :
                      p.sell_price_retail;
                    const inCart = cart.find((c) => c.product.id === p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => addToCart(p)}
                        disabled={p.is_frozen}
                        className={`group relative text-left p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer active:scale-[0.97] ${
                          p.is_frozen
                            ? "opacity-40 cursor-not-allowed bg-[#131F35] border-[#1E3050]"
                            : inCart
                            ? "bg-[#14B8A6]/10 border-[#14B8A6]/40 shadow-lg shadow-[#14B8A6]/5"
                            : "bg-[#131F35] border-[#1E3050] hover:bg-[#1A2A44] hover:border-[#243558] hover:shadow-lg"
                        }`}
                      >
                        {/* Cart badge */}
                        {inCart && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#14B8A6] text-slate-900 text-[10px] font-bold flex items-center justify-center">
                            {inCart.quantity}
                          </div>
                        )}

                        {/* Category color bar */}
                        <div className="w-8 h-1 rounded-full bg-[#14B8A6]/40 mb-2.5" />

                        <div className="text-white text-sm font-medium leading-snug line-clamp-2 mb-2">
                          {p.name}
                        </div>

                        <div className="flex items-end justify-between">
                          <div className="text-[#14B8A6] font-bold text-base tabular">
                            {fmt(price)}
                          </div>
                          <div className={`text-[10px] font-medium ${p.is_frozen ? "text-slate-500" : "text-emerald-400"}`}>
                            {p.unit}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-4 px-4 py-1.5 border-t border-[#1E3050] bg-[#0D1526] text-[10px] text-slate-600">
              <span>{products.length} products</span>
              <span>·</span>
              <span>{new Date().toLocaleTimeString()}</span>
              {!sessionId && <span className="text-amber-500">· No open session</span>}
            </div>
          </div>

          {/* ── Cart ──────────────────────────────────────────── */}
          <CartPanel
            items={cart}
            onQuantityChange={changeQty}
            onRemove={removeFromCart}
            onClear={() => setCart([])}
            cashierId={user.id}
            sessionId={sessionId}
            onSaleComplete={handleSaleComplete}
          />
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#131F35] border border-[#1E3050] text-white text-sm px-4 py-2.5 rounded-xl shadow-xl fade-in z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
