import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3, BoxesIcon, ChevronLeft, ChevronRight, Home, LogOut, Moon, Sun,
  Package, QrCode, ScrollText, Search, Settings, Star, Truck, Users, Zap, RefreshCw,
} from "lucide-react";
import { api } from "../lib/api";
import { Category, PriceTier, Product, User } from "../types";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
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

// Vercel/Editorial style muted neon palette
const CAT_COLORS = [
  "#14B8A6", "#6366F1", "#F59E0B", "#10B981",
  "#EF4444", "#8B5CF6", "#06B6D4", "#F97316",
  "#EC4899", "#84CC16",
];
const catColor = (id: number | null) =>
  id == null ? "#475569" : CAT_COLORS[id % CAT_COLORS.length];

const NAV: { id: Screen; icon: typeof Home; labelKey: string }[] = [
  { id: "pos",          icon: Home,       labelKey: "nav.pos"          },
  { id: "inventory",    icon: Package,    labelKey: "nav.inventory"    },
  { id: "purchases",    icon: Truck,      labelKey: "nav.purchases"    },
  { id: "transactions", icon: ScrollText, labelKey: "nav.transactions" },
  { id: "reports",      icon: BarChart3,  labelKey: "nav.reports"      },
  { id: "customers",    icon: Users,      labelKey: "nav.customers"    },
  { id: "settings",     icon: Settings,   labelKey: "nav.settings"     },
];

export default function POSScreen({ user, onLogout }: Props) {
  const { t } = useTranslation();
  const { fmt, fmtAlt, showAlt } = useCurrency();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, isRTL } = useLanguage();
  const { addToCart, priceTier, setPriceTier, items: cartItems } = useCart();

  const [screen, setScreen]               = useState<Screen>("pos");
  const [products, setProducts]           = useState<Product[]>([]);
  const [favorites, setFavorites]         = useState<Product[]>([]);
  const [categories, setCategories]       = useState<Category[]>([]);
  const [search, setSearch]               = useState("");
  const [activeCat, setActiveCat]         = useState<number | null>(null);
  const [browseAll, setBrowseAll]         = useState(false);
  const [loadingProd, setLoadingProd]     = useState(false);
  const [navCollapsed, setNavCollapsed]   = useState(true);
  const [sessionId, setSessionId]         = useState<number | null>(null);
  const [toast, setToast]                 = useState<string | null>(null);
  const [varPriceProduct, setVarPrice]    = useState<Product | null>(null);
  const [varPriceInput, setVarPriceInput] = useState("");
  const [refreshKey, setRefreshKey]       = useState(0);
  const searchRef                         = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
    api.getActiveSession(user.id)
      .then((s) => s && setSessionId(s.id))
      .catch(console.error);
    api.getProducts({ favorites_only: true, limit: 30 })
      .then(setFavorites)
      .catch(console.error);
  }, [user.id, refreshKey]);

  useEffect(() => {
    if (!search && activeCat === null && !browseAll) {
      setProducts([]);
      setLoadingProd(false);
      return;
    }
    setLoadingProd(true);
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
  }, [search, activeCat, categories, browseAll, refreshKey]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleNoSale = useCallback(async () => {
    try {
      await api.logNoSale(user.id, sessionId, null);
      showToast(t("pos.noSaleLogged"));
    } catch {
      showToast("No sale log failed");
    }
  }, [user.id, sessionId, t, showToast]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (screen !== "pos") return;
      const active = document.activeElement;
      const inInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;

      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === "F3" && !inInput) { e.preventDefault(); handleNoSale(); return; }

      if (!inInput && e.target !== searchRef.current && !e.ctrlKey && !e.metaKey && /^\w$/.test(e.key)) {
        const isModalOpen = document.querySelector('.fixed.inset-0.z-50, .fixed.inset-0.z-\\[100\\]');
        if (!isModalOpen) {
          searchRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen, handleNoSale]);

  const handleSaleComplete = () => {
    showToast(t("pos.saleCompleted"));
    searchRef.current?.focus();
  };

  const handleSearchKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !search.trim()) return;
    try {
      const p = await api.getProductByBarcode(search.trim());
      if (p) { handleAddProduct(p); setSearch(""); }
      else   showToast(t("pos.productNotFound"));
    } catch {
      showToast(t("pos.barcodeFail"));
    }
  };

  const handleAddProduct = (p: Product) => {
    if (p.is_frozen) { showToast(t("pos.productFrozen")); return; }
    if (p.is_variable_price) { setVarPrice(p); setVarPriceInput(""); return; }
    addToCart(p);
  };

  const confirmVarPrice = () => {
    if (!varPriceProduct) return;
    const cents = Math.round(parseFloat(varPriceInput) * 100);
    if (!isNaN(cents) && cents > 0) {
      addToCart(varPriceProduct, cents);
    }
    setVarPrice(null);
  };

  const showCatGrid = !search && activeCat === null && !browseAll;

  return (
    <div className="h-screen flex bg-[var(--bg-deep)] text-[var(--tx-base)] overflow-hidden font-sans selection:bg-[#14B8A6]/30">

      {/* ── Editorial Sidebar ────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 flex flex-col py-8 gap-2 border-e border-[var(--bd-faint)] bg-[var(--bg-panel)] relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ${navCollapsed ? "w-24 items-center" : "w-64 px-4"}`}>
        {/* Volt Brand Logo & Toggle */}
        <div className={`flex items-center mb-8 relative ${navCollapsed ? "justify-center" : "justify-between px-2"}`}>
          <div className="w-12 h-12 rounded-xl bg-[var(--tx-base)] text-[var(--bg-base)] flex items-center justify-center shadow-2xl transition-transform hover:scale-105 cursor-pointer flex-shrink-0">
            <Zap size={22} fill="currentColor" />
          </div>
          
          {!navCollapsed && (
            <span className="font-black text-lg text-[var(--tx-base)] tracking-tight whitespace-nowrap overflow-hidden">
              MiniMarket
            </span>
          )}

          <button 
            onClick={() => setNavCollapsed(!navCollapsed)}
            className={`flex items-center justify-center rounded-lg text-slate-400 hover:text-[var(--tx-base)] hover:bg-[var(--bg-base)] transition-colors cursor-pointer ${navCollapsed ? "absolute -right-3.5 top-12 bg-[var(--bg-panel)] border border-[var(--bd-base)] shadow-md rounded-full w-7 h-7" : "w-8 h-8"}`}
          >
            {navCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {NAV.map(({ id, icon: Icon, labelKey }) => {
          const isActive = screen === id;
          return (
            <button
              key={id}
              onClick={() => setScreen(id)}
              className={`relative flex items-center gap-3 rounded-2xl transition-all duration-300 cursor-pointer group flex-shrink-0 overflow-hidden ${
                navCollapsed ? "flex-col justify-center w-16 h-16 mx-auto" : "flex-row px-4 py-3.5 w-full"
              } ${
                isActive
                  ? "text-[#14B8A6] bg-[#14B8A6]/10 shadow-inner"
                  : "text-slate-500 hover:text-[var(--tx-base)] hover:bg-[var(--bg-base)]"
              }`}
            >
              {isActive && (
                <div className={`absolute bg-[#14B8A6] shadow-[0_0_8px_#14B8A6] ${navCollapsed ? "left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full" : "left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"}`} />
              )}
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`transition-transform flex-shrink-0 ${navCollapsed ? "group-active:scale-95 group-hover:-translate-y-0.5" : "group-active:scale-95"}`} />
              
              {navCollapsed ? (
                <span className="text-[10px] font-bold tracking-widest uppercase opacity-80 mt-1.5">{t(labelKey)}</span>
              ) : (
                <span className="text-sm font-bold tracking-widest uppercase opacity-90 whitespace-nowrap">{t(labelKey)}</span>
              )}
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Toggles Container - Glassmorphic Pill */}
        <div className={`flex items-center gap-2 p-2 rounded-2xl bg-[var(--bg-base)] border border-[var(--bd-faint)] shadow-sm mx-auto flex-shrink-0 ${navCollapsed ? "flex-col" : "flex-row justify-center w-full"}`}>
          {/* Theme toggle */}
          <button
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
            className="w-12 h-12 flex items-center justify-center rounded-xl text-slate-500 hover:text-[var(--tx-base)] hover:bg-[var(--bg-panel)] transition-all cursor-pointer active:scale-90 flex-shrink-0"
          >
            {theme === "dark" ? <Sun size={20} strokeWidth={2} /> : <Moon size={20} strokeWidth={2} />}
          </button>

          <div className={navCollapsed ? "w-6 h-px bg-[var(--bd-faint)] flex-shrink-0" : "w-px h-6 bg-[var(--bd-faint)] flex-shrink-0"} />

          {/* Language toggle */}
          <button
            title={language === "en" ? "Switch to Arabic" : "Switch to English"}
            onClick={toggleLanguage}
            className="w-12 h-12 flex items-center justify-center rounded-xl text-slate-500 hover:text-[#14B8A6] hover:bg-[#14B8A6]/10 transition-all cursor-pointer font-bold active:scale-90 flex-shrink-0"
          >
            {language === "en" ? <span className="text-lg leading-none">ع</span> : <span className="text-sm tracking-wider leading-none">EN</span>}
          </button>
        </div>

        {/* User avatar / logout */}
        <button
          title={`Logout ${user.full_name}`}
          onClick={onLogout}
          className={`group relative mt-4 rounded-xl flex items-center overflow-hidden transition-all cursor-pointer ring-1 ring-[var(--bd-base)] hover:ring-red-500/50 mx-auto flex-shrink-0 ${navCollapsed ? "w-12 h-12 justify-center" : "w-full h-14 px-3"}`}
        >
          <div className="absolute inset-0 bg-[var(--bg-base)] group-hover:bg-red-500/10 transition-colors" />
          
          <div className="relative z-10 flex items-center w-full gap-3">
            <div className={`flex items-center justify-center font-bold text-sm bg-[var(--bg-panel)] rounded-lg transition-opacity group-hover:opacity-0 flex-shrink-0 ${navCollapsed ? "w-full h-full absolute inset-0" : "w-8 h-8"}`}>
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            {!navCollapsed && (
              <span className="text-[var(--tx-base)] text-sm font-bold group-hover:opacity-0 transition-opacity flex-1 text-left truncate">
                {user.full_name}
              </span>
            )}
          </div>

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10">
             <LogOut size={18} className="text-red-500 scale-75 group-hover:scale-100 transition-transform" />
             {!navCollapsed && <span className="text-red-500 text-sm font-bold ml-2">Logout</span>}
          </div>
        </button>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div key={screen} className="flex-1 flex overflow-hidden animate-fade-in">
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
          <div className="flex-1 flex items-center justify-center bg-[var(--bg-deep)]">
            <div className="text-center space-y-4 animate-fade-in">
              <div className="w-24 h-24 rounded-3xl bg-[var(--bg-panel)] shadow-xl flex items-center justify-center mx-auto border border-[var(--bd-faint)]">
                {(() => {
                  const { icon: Icon } = NAV.find((n) => n.id === screen)!;
                  return <Icon size={40} strokeWidth={1.5} className="text-slate-400" />;
                })()}
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[var(--tx-base)]">{t(NAV.find((n) => n.id === screen)!.labelKey)}</h2>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">{t("nav.comingSoon")}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-deep)] relative z-10">

              {/* ── Command Bar (Top) ────────────────────────────────────────── */}
              <div className="flex items-center gap-6 px-8 py-5 bg-[var(--bg-deep)]/80 backdrop-blur-xl border-b border-[var(--bd-faint)] sticky top-0 z-30">
                
                {/* Search - Spotlight Style */}
                <div className="flex-1 relative max-w-2xl group">
                  <div className="absolute inset-y-0 start-4 flex items-center pointer-events-none">
                    <Search size={18} className="text-slate-400 group-focus-within:text-[#14B8A6] transition-colors" />
                  </div>
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearchKey}
                    placeholder={t("pos.searchPlaceholder")}
                    className="w-full ps-12 pe-16 py-3.5 bg-[var(--bg-panel)] border border-[var(--bd-base)] rounded-2xl text-[var(--tx-base)] text-base font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] shadow-sm transition-all"
                  />
                  <div className="absolute inset-y-0 end-4 flex items-center gap-2 pointer-events-none">
                    <QrCode size={16} className="text-slate-400" />
                  </div>
                </div>

                {/* Tools & Status */}
                <div className="flex items-center gap-4 ms-auto">
                  <button
                    onClick={() => setRefreshKey(k => k + 1)}
                    className="w-11 h-11 flex items-center justify-center rounded-2xl bg-[var(--bg-panel)] border border-[var(--bd-base)] hover:border-[var(--tx-base)] text-slate-500 hover:text-[var(--tx-base)] transition-all cursor-pointer shadow-sm active:scale-95"
                    title={t("pos.refresh", "Refresh Data")}
                  >
                    <RefreshCw size={18} />
                  </button>

                  {/* Price Tier Switcher */}
                  <div className="flex p-1 bg-[var(--bg-panel)] border border-[var(--bd-base)] rounded-xl shadow-sm">
                    {(["retail", "wholesale", "special"] as PriceTier[]).map((tier) => (
                      <button
                        key={tier}
                        onClick={() => setPriceTier(tier)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          priceTier === tier
                            ? "bg-[var(--tx-base)] text-[var(--bg-base)] shadow-md"
                            : "text-slate-500 hover:text-[var(--tx-base)]"
                        }`}
                      >
                        {t(`pos.${tier}`)}
                      </button>
                    ))}
                  </div>

                  <div className="w-px h-8 bg-[var(--bd-base)] mx-2" />

                  {/* Session Pill */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--bg-panel)] border border-[var(--bd-base)] rounded-xl shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[var(--bg-base)] flex items-center justify-center border border-[var(--bd-base)]">
                        <BoxesIcon size={12} className="text-[var(--tx-base)]" />
                      </div>
                      <span className="text-sm font-semibold text-[var(--tx-base)] tracking-tight">{user.full_name}</span>
                    </div>
                    <div className="w-px h-4 bg-[var(--bd-base)]" />
                    {sessionId ? (
                      <button
                        onClick={async () => {
                          try {
                            await api.closeSession(sessionId);
                            setSessionId(null);
                            showToast(t("pos.sessionClosed"));
                          } catch {
                            showToast(t("pos.sessionFailClose"));
                          }
                        }}
                        className="text-xs font-bold text-red-500 hover:text-red-400 transition-colors uppercase tracking-widest cursor-pointer flex items-center gap-1"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Close
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            const s = await api.openCashSession(user.id, 0);
                            setSessionId(s.id);
                            showToast(t("pos.sessionOpened"));
                          } catch {
                            showToast(t("pos.sessionFailOpen"));
                          }
                        }}
                        className="text-xs font-bold text-[#14B8A6] hover:text-[#0D9488] transition-colors uppercase tracking-widest cursor-pointer flex items-center gap-1"
                      >
                        Open
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Favorites Quick Strip ────────────────────── */}
              {favorites.length > 0 && (
                <div className="flex items-center gap-3 px-8 py-4 border-b border-[var(--bd-faint)] bg-[var(--bg-panel)] overflow-x-auto scrollbar-hide">
                  <Star size={14} className="text-[#14B8A6] flex-shrink-0 drop-shadow-[0_0_8px_rgba(20,184,166,0.5)]" fill="currentColor" />
                  {favorites.map(p => {
                    const price = priceTier === "wholesale" ? p.sell_price_wholesale
                                : priceTier === "special"   ? p.sell_price_special
                                : p.sell_price_retail;
                    const inCart = cartItems.find(ci => ci.product.id === p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleAddProduct(p)}
                        disabled={p.is_frozen}
                        className={`flex-shrink-0 group relative flex items-center gap-3 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all duration-200 cursor-pointer active:scale-95 ${
                          p.is_frozen ? "opacity-40 cursor-not-allowed bg-[var(--bg-base)] border-[var(--bd-base)]"
                          : inCart    ? "bg-[var(--bg-base)] border-[#14B8A6] text-[var(--tx-base)] shadow-[0_4px_14px_0_rgba(20,184,166,0.15)]"
                                      : "bg-[var(--bg-base)] border-[var(--bd-base)] text-[var(--tx-base)] hover:border-[var(--tx-base)] hover:shadow-md"
                        }`}
                      >
                        <span className="truncate max-w-[120px] font-semibold">{p.name}</span>
                        <span className={`tabular-nums ${inCart ? "text-[#14B8A6]" : "text-slate-500"}`}>{fmt(price)}</span>
                        {inCart && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-[#14B8A6] text-slate-900 text-[10px] font-bold px-1 ring-2 ring-[var(--bg-panel)]">
                            {inCart.quantity}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Main Canvas (Categories / Products) ────────────────────────── */}
              <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                {showCatGrid ? (
                  /* ── Category Grid (Brutalist Minimal) ── */
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {/* All Items Card */}
                    <button
                      onClick={() => setBrowseAll(true)}
                      className="group relative h-40 flex flex-col justify-between p-6 text-left rounded-3xl overflow-hidden border border-[var(--bd-base)] bg-[var(--bg-panel)] transition-all duration-300 cursor-pointer active:scale-[0.98] hover:border-[var(--tx-base)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-[#14B8A6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="w-12 h-12 rounded-full bg-[var(--bg-base)] border border-[var(--bd-base)] flex items-center justify-center z-10 transition-transform group-hover:scale-110">
                        <Package size={20} className="text-[#14B8A6]" />
                      </div>
                      <div className="z-10 flex items-end justify-between w-full">
                        <span className="text-xl font-bold tracking-tight text-[var(--tx-base)]">{t("pos.allItems")}</span>
                        {isRTL ? <ChevronLeft size={20} className="text-slate-400 group-hover:text-[var(--tx-base)]" /> : <ChevronRight size={20} className="text-slate-400 group-hover:text-[var(--tx-base)]" />}
                      </div>
                    </button>

                    {/* Per-category cards */}
                    {categories.map((c) => {
                      const color = catColor(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => setActiveCat(c.id)}
                          className="group relative h-40 flex flex-col justify-between p-6 text-left rounded-3xl overflow-hidden border border-[var(--bd-base)] bg-[var(--bg-panel)] transition-all duration-300 cursor-pointer active:scale-[0.98] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
                          style={{ '--hover-color': color } as React.CSSProperties}
                        >
                          {/* Hover accent glow */}
                          <div 
                            className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500" 
                            style={{ backgroundColor: color }} 
                          />
                          
                          <div className="w-12 h-12 rounded-full flex items-center justify-center z-10 font-bold text-lg border border-[var(--bd-base)] bg-[var(--bg-base)] text-[var(--tx-base)] transition-transform group-hover:scale-110 shadow-sm" style={{ borderColor: `${color}40` }}>
                            <span style={{ color }}>{c.name.charAt(0).toUpperCase()}</span>
                          </div>
                          
                          <div className="z-10 flex items-end justify-between w-full gap-4">
                            <span className="text-xl font-bold tracking-tight text-[var(--tx-base)] truncate">{c.name}</span>
                            {isRTL ? <ChevronLeft size={20} className="text-slate-400 group-hover:text-[var(--tx-base)] flex-shrink-0" /> : <ChevronRight size={20} className="text-slate-400 group-hover:text-[var(--tx-base)] flex-shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* ── Product Grid ── */
                  <>
                    {/* Cinematic Breadcrumb */}
                    {(activeCat !== null || browseAll) && !search && (
                      <div className="flex items-center gap-4 mb-8">
                        <button
                          onClick={() => { setActiveCat(null); setBrowseAll(false); }}
                          className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--bg-panel)] border border-[var(--bd-base)] text-slate-500 hover:text-[var(--tx-base)] hover:border-[var(--tx-base)] transition-all cursor-pointer shadow-sm"
                        >
                          {isRTL ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </button>
                        <h2 className="text-3xl font-bold tracking-tight text-[var(--tx-base)] flex items-center gap-3">
                          {activeCat !== null ? (
                            <>
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: catColor(activeCat), boxShadow: `0 0 12px ${catColor(activeCat)}` }} />
                              {categories.find((c) => c.id === activeCat)?.name}
                            </>
                          ) : t("pos.allItems")}
                        </h2>
                      </div>
                    )}

                    {loadingProd ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div key={i} className="h-44 rounded-3xl bg-[var(--bg-panel)] border border-[var(--bd-faint)] animate-pulse" />
                        ))}
                      </div>
                    ) : products.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 gap-6 text-center">
                        <div className="w-20 h-20 rounded-full bg-[var(--bg-panel)] border border-[var(--bd-base)] flex items-center justify-center">
                          <Package size={32} className="text-slate-400" />
                        </div>
                        <p className="text-slate-500 text-lg font-medium">{t("pos.noProductsFound")}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
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
                              onClick={() => handleAddProduct(p)}
                              disabled={p.is_frozen}
                              className={`group relative h-52 text-left rounded-3xl p-6 transition-all duration-300 cursor-pointer active:scale-[0.98] flex flex-col justify-between overflow-hidden ${
                                p.is_frozen
                                  ? "opacity-50 cursor-not-allowed bg-[var(--bg-base)] border border-[var(--bd-base)] grayscale"
                                  : inCart
                                  ? "bg-[var(--bg-panel)] border-2 border-[#14B8A6] shadow-[0_8px_30px_rgba(20,184,166,0.15)]"
                                  : "bg-[var(--bg-panel)] border border-[var(--bd-base)] hover:border-[var(--tx-base)] hover:shadow-xl"
                              }`}
                            >
                              {/* Subtle category hint line */}
                              {!inCart && !p.is_frozen && (
                                <div className="absolute top-0 left-6 right-6 h-[2px] opacity-20 transition-opacity group-hover:opacity-100" style={{ backgroundColor: color }} />
                              )}

                              {/* Cart badge */}
                              {inCart && (
                                <div className="absolute top-4 end-4 min-w-[28px] h-7 px-2 rounded-full bg-[#14B8A6] text-slate-900 text-xs font-black tracking-widest flex items-center justify-center shadow-lg transform rotate-3">
                                  x{inCart.quantity}
                                </div>
                              )}

                              <div className="flex-1 pr-6">
                                <p className="text-lg font-bold leading-tight line-clamp-2 text-[var(--tx-base)]">
                                  {p.name}
                                </p>
                                <span className="text-xs font-semibold uppercase tracking-widest mt-2 block text-slate-500">
                                  {p.unit}
                                </span>
                              </div>

                              <div className="mt-4 flex items-end justify-between">
                                <div>
                                  <div className={`text-2xl font-black tabular-nums tracking-tight leading-none ${inCart ? "text-[#14B8A6]" : "text-[var(--tx-base)]"}`}>
                                    {fmt(price)}
                                  </div>
                                  {showAlt && (
                                    <div className="text-xs font-medium tabular-nums mt-1 text-slate-400">
                                      {fmtAlt(price)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── Editorial Footer / Shortcuts ─────────────────────────────────────── */}
              <div className="flex items-center justify-between px-8 py-3 border-t border-[var(--bd-faint)] bg-[var(--bg-panel)] backdrop-blur-md">
                <div className="flex items-center gap-4 text-xs font-medium text-slate-500 uppercase tracking-widest">
                  <span>{showCatGrid ? t("pos.categoryCount", { count: categories.length }) : t("pos.products", { count: products.length })}</span>
                  <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {!sessionId && (
                    <>
                      <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                      <span className="text-amber-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" />{t("pos.noSession")}</span>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-6">
                  {([
                    ["F2", t("shortcuts.search")],
                    ["F3", t("shortcuts.noSale")],
                    ["F5", t("shortcuts.checkout")],
                    ["F6", t("shortcuts.quickPay")],
                  ] as [string, string][]).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2 group cursor-default">
                      <kbd className="text-[10px] font-mono px-2 py-1 rounded-md border border-[var(--bd-base)] bg-[var(--bg-base)] text-slate-500 font-bold shadow-sm group-hover:border-[var(--tx-base)] group-hover:text-[var(--tx-base)] transition-colors">{key}</kbd>
                      <span className="text-xs font-semibold text-slate-500 hidden xl:inline uppercase tracking-wider">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Cart Side Panel ──────────────────────────────────────────────── */}
            <div className="h-full flex flex-col border-l border-[var(--bd-faint)] shadow-[0_0_40px_rgba(0,0,0,0.05)] z-20">
              <CartPanel
                user={user}
                sessionId={sessionId}
                onSaleComplete={handleSaleComplete}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Cinematic Variable Price Dialog ─────────────────────────────────── */}
      {varPriceProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity" onClick={() => setVarPrice(null)} />
          <div className="relative bg-[var(--bg-panel)] border border-[var(--bd-base)] rounded-3xl shadow-2xl p-8 w-full max-w-sm flex flex-col gap-6 animate-fade-in">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-[#14B8A6]/10 text-[#14B8A6] flex items-center justify-center mx-auto mb-4 border border-[#14B8A6]/20">
                <Zap size={20} />
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-[var(--tx-base)]">{t("pos.variablePrice")}</h3>
              <p className="text-slate-500 text-sm font-medium">{varPriceProduct.name}</p>
            </div>
            
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">$</span>
              <input
                autoFocus
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={varPriceInput}
                onChange={e => setVarPriceInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") confirmVarPrice(); if (e.key === "Escape") setVarPrice(null); }}
                className="w-full pl-10 pr-4 py-4 bg-[var(--bg-base)] border-2 border-[var(--bd-base)] focus:border-[#14B8A6] focus:outline-none rounded-2xl text-[var(--tx-base)] text-3xl font-black tabular-nums placeholder-slate-300 transition-colors text-center"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setVarPrice(null)}
                className="flex-1 py-4 rounded-2xl bg-[var(--bg-base)] border border-[var(--bd-base)] text-[var(--tx-base)] text-sm font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                {t("pos.cancel")}
              </button>
              <button
                onClick={confirmVarPrice}
                disabled={!varPriceInput || parseFloat(varPriceInput) <= 0}
                className="flex-1 py-4 rounded-2xl bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 text-sm font-black uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] cursor-pointer"
              >
                {t("pos.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Toast ───────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[var(--tx-base)] text-[var(--bg-base)] font-bold text-sm px-6 py-3 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.2)] animate-fade-in z-[110] flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
          {toast}
        </div>
      )}
    </div>
  );
}