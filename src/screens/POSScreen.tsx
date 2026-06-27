import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3, BoxesIcon, ChevronLeft, ChevronRight, Home, LogOut, Moon, Sun,
  Package, QrCode, ScrollText, Search, Settings, Star, Truck, Users, Zap, DoorOpen,
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

// fmt is provided by useCurrency — see inside POSScreen component

// Distinct color per category (derived from id)
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
  const [sessionId, setSessionId]         = useState<number | null>(null);
  const [toast, setToast]                 = useState<string | null>(null);
  const [varPriceProduct, setVarPrice]    = useState<Product | null>(null);
  const [varPriceInput, setVarPriceInput] = useState("");
  const searchRef                         = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
    api.getActiveSession(user.id)
      .then((s) => s && setSessionId(s.id))
      .catch(console.error);
    api.getProducts({ favorites_only: true, limit: 30 })
      .then(setFavorites)
      .catch(console.error);
  }, [user.id]);

  useEffect(() => {
    if (!search && activeCat === null && !browseAll) {
      setProducts([]);
      setLoadingProd(false);
      return;
    }
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
  }, [search, activeCat, categories, browseAll]);

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

  // Global POS keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (screen !== "pos") return;
      const active = document.activeElement;
      const inInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;

      // F2 → focus search bar
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); return; }
      // F3 → open cash drawer / log no-sale
      if (e.key === "F3" && !inInput) { e.preventDefault(); handleNoSale(); return; }

      // Any printable key (not in input) → jump to search
      if (!inInput && e.target !== searchRef.current && !e.ctrlKey && !e.metaKey && /^\w$/.test(e.key)) {
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen, handleNoSale]);

  const handleSaleComplete = () => {
    showToast(t("pos.saleCompleted"));
    searchRef.current?.focus();
  };

  // Enter key in search = barcode scan lookup
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

  // Adding a product — intercept variable-price items to show price dialog
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
    <div className="h-screen flex bg-[var(--bg-deep)] overflow-hidden">

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <div className="w-20 flex-shrink-0 flex flex-col items-center py-5 gap-1 border-e border-[var(--bd-faint)] bg-[var(--bg-panel)]">
        {/* Logo */}
        <div className="w-10 h-10 rounded-2xl bg-[#14B8A6] flex items-center justify-center mb-5 shadow-lg shadow-[#14B8A6]/30">
          <Zap size={18} className="text-[#020817]" fill="currentColor" />
        </div>

        {NAV.map(({ id, icon: Icon, labelKey }) => (
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
            <span className="text-[10px] font-semibold tracking-wide leading-none">{t(labelKey)}</span>
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
            {theme === "dark" ? t("nav.light") : t("nav.dark")}
          </span>
        </button>

        {/* Language toggle */}
        <button
          title={language === "en" ? "Switch to Arabic / تحويل للعربية" : "Switch to English"}
          onClick={toggleLanguage}
          className="flex flex-col items-center gap-1.5 w-14 py-3 rounded-xl text-slate-600 hover:text-[#14B8A6] hover:bg-[#14B8A6]/10 transition-all cursor-pointer"
        >
          <span className="text-[13px] font-bold leading-none">
            {language === "en" ? "ع" : "EN"}
          </span>
          <span className="text-[10px] font-semibold tracking-wide leading-none">
            {language === "en" ? "عربي" : "English"}
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
            <p className="text-slate-400 font-semibold text-lg">{t(NAV.find((n) => n.id === screen)!.labelKey)}</p>
            <p className="text-sm text-slate-600">{t("nav.comingSoon")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* ── Top bar ────────────────────────────────────────── */}
            <div className="flex items-center gap-4 px-5 py-3.5 border-b border-[var(--bd-faint)] bg-[var(--bg-panel)]">
              {/* Search */}
              <div className="flex-1 relative max-w-xl">
                <Search size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKey}
                  placeholder={t("pos.searchPlaceholder")}
                  className="w-full ps-10 pe-4 py-2.5 bg-[var(--bg-base)] border border-[var(--bd-base)] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl text-[var(--tx-base)] text-sm placeholder-slate-500 transition-colors"
                />
              </div>

              {/* Barcode indicator */}
              <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                <QrCode size={13} />
                <span>{t("pos.scanReady")}</span>
              </div>

              {/* No-sale button */}
              <button
                onClick={handleNoSale}
                title={`${t("pos.noSale")} (F3)`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-600 hover:text-amber-400 hover:bg-amber-400/10 border border-transparent hover:border-amber-400/20 transition-all text-xs font-semibold cursor-pointer"
              >
                <DoorOpen size={14} />
                {t("pos.noSale")}
                <kbd className="text-[9px] font-mono px-1 py-0.5 rounded border border-[var(--bd-base)] bg-[var(--bg-base)] text-slate-600 font-normal">F3</kbd>
              </button>

              {/* Price tier switcher */}
              <div className="flex items-center gap-0.5 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl p-1">
                {(["retail", "wholesale", "special"] as PriceTier[]).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setPriceTier(tier)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                      priceTier === tier
                        ? "bg-[#14B8A6] text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {t(`pos.${tier}`)}
                  </button>
                ))}
              </div>

              {/* Session / cashier info */}
              <div className="flex items-center gap-2 text-xs text-slate-500 border-s border-[var(--bd-base)] ps-4">
                <BoxesIcon size={13} />
                <span className="text-slate-400 font-medium">{user.full_name}</span>
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
                    className="text-red-400 hover:text-red-300 hover:underline cursor-pointer ms-1"
                  >
                    {t("pos.closeSession")}
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
                    className="text-[#14B8A6] hover:underline cursor-pointer ms-1"
                  >
                    {t("pos.openSession")}
                  </button>
                )}
              </div>
            </div>

            {/* ── Favorites / quick-key strip ────────────────────── */}
            {favorites.length > 0 && (
              <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[var(--bd-faint)] bg-[var(--bg-deep)] overflow-x-auto scrollbar-hide">
                <Star size={12} className="text-amber-400 flex-shrink-0" fill="currentColor" />
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
                      className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        p.is_frozen ? "opacity-40 cursor-not-allowed bg-[var(--bg-base)] border-[var(--bd-base)]"
                        : inCart    ? "bg-[#14B8A6]/15 border-[#14B8A6]/40 text-[#14B8A6]"
                                    : "bg-[var(--bg-base)] border-[var(--bd-base)] text-[var(--tx-base)] hover:border-[#14B8A6]/40 hover:text-[#14B8A6]"
                      }`}
                    >
                      <span className="truncate max-w-[100px]">{p.name}</span>
                      <span className="text-slate-500 font-normal tabular-nums">{fmt(price)}</span>
                      {inCart && (
                        <span className="min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[#14B8A6] text-slate-900 text-[10px] font-bold px-1">
                          {inCart.quantity}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Category / Product area ────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-5">
              {showCatGrid ? (
                /* ── Category card grid ── */
                <div className="grid grid-cols-3 gap-4">
                  {/* All Items card */}
                  <button
                    onClick={() => setBrowseAll(true)}
                    className="group text-left rounded-2xl overflow-hidden border border-[var(--bd-base)] transition-all duration-150 cursor-pointer active:scale-[0.97] bg-[var(--bg-base)] hover:bg-[var(--bg-card)] hover:shadow-xl hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-center py-7" style={{ background: "linear-gradient(180deg,rgba(20,184,166,.12) 0%,rgba(20,184,166,.04) 100%)" }}>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#14B8A6", boxShadow: "0 8px 24px rgba(20,184,166,.4)" }}>
                        <Package size={26} className="text-slate-900" />
                      </div>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-2 border-t border-[var(--bd-base)]">
                      <span className="text-[var(--tx-base)] font-bold text-sm">{t("pos.allItems")}</span>
                      {isRTL
                        ? <ChevronLeft size={15} className="text-slate-600 group-hover:text-[#14B8A6] flex-shrink-0 transition-colors" />
                        : <ChevronRight size={15} className="text-slate-600 group-hover:text-[#14B8A6] flex-shrink-0 transition-colors" />
                      }
                    </div>
                  </button>

                  {/* Per-category cards */}
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCat(c.id)}
                      className="group text-left rounded-2xl overflow-hidden border transition-all duration-150 cursor-pointer active:scale-[0.97] bg-[var(--bg-base)] hover:bg-[var(--bg-card)] hover:shadow-xl hover:-translate-y-0.5"
                      style={{ borderColor: `${catColor(c.id)}22` }}
                    >
                      <div
                        className="flex items-center justify-center py-7"
                        style={{ background: `linear-gradient(180deg,${catColor(c.id)}1a 0%,${catColor(c.id)}08 100%)` }}
                      >
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold"
                          style={{ backgroundColor: catColor(c.id), boxShadow: `0 8px 24px ${catColor(c.id)}45` }}
                        >
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div
                        className="px-4 py-3 flex items-center justify-between gap-2 border-t"
                        style={{ borderColor: `${catColor(c.id)}18` }}
                      >
                        <span className="text-[var(--tx-base)] font-bold text-sm truncate">{c.name}</span>
                        {isRTL
                          ? <ChevronLeft size={15} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                          : <ChevronRight size={15} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                        }
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                /* ── Product grid (category or search or all) ── */
                <>
                  {/* Breadcrumb back row */}
                  {(activeCat !== null || browseAll) && !search && (
                    <div className="flex items-center gap-3 mb-5">
                      <button
                        onClick={() => { setActiveCat(null); setBrowseAll(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-500 hover:text-[var(--tx-base)] hover:bg-[var(--bg-base)] border border-transparent hover:border-[var(--bd-base)] text-sm font-semibold transition-all cursor-pointer"
                      >
                        {isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        {t("pos.categories")}
                      </button>
                      <div className="h-4 w-px bg-[var(--bd-base)]" />
                      <div className="flex items-center gap-2">
                        {activeCat !== null && (
                          <>
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: catColor(activeCat) }} />
                            <span className="text-[var(--tx-base)] font-bold text-sm">
                              {categories.find((c) => c.id === activeCat)?.name}
                            </span>
                          </>
                        )}
                        {browseAll && (
                          <span className="text-[var(--tx-base)] font-bold text-sm">{t("pos.allItems")}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {loadingProd ? (
                    <div className="grid grid-cols-3 gap-4">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="h-36 rounded-2xl bg-[var(--bg-base)]/60 border border-[var(--bd-base)] animate-pulse" />
                      ))}
                    </div>
                  ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-700">
                      <Package size={52} strokeWidth={1} className="text-slate-800" />
                      <p className="text-slate-500 text-sm">{t("pos.noProductsFound")}</p>
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
                            onClick={() => handleAddProduct(p)}
                            disabled={p.is_frozen}
                            className={`group relative text-left rounded-2xl border transition-all duration-150 cursor-pointer active:scale-[0.97] flex flex-col overflow-hidden ${
                              p.is_frozen
                                ? "opacity-40 cursor-not-allowed bg-[var(--bg-base)] border-[var(--bd-base)]"
                                : inCart
                                ? "bg-[var(--bg-card)] border-[#14B8A6]/50 shadow-lg shadow-[#14B8A6]/10"
                                : "bg-[var(--bg-base)] border-[var(--bd-base)] hover:border-[var(--bd-strong)] hover:bg-[var(--bg-card)] hover:shadow-xl hover:shadow-black/10"
                            }`}
                          >
                            {/* Left accent bar */}
                            <div
                              className="absolute inset-y-0 start-0 w-[3px]"
                              style={{ backgroundColor: inCart ? "#14B8A6" : color }}
                            />

                            {/* Cart badge */}
                            {inCart && (
                              <div className="absolute top-2.5 end-2.5 min-w-[20px] h-5 px-1 rounded-full bg-[#14B8A6] text-slate-900 text-[10px] font-bold flex items-center justify-center shadow">
                                {inCart.quantity}
                              </div>
                            )}

                            <div className="ps-4 pe-3.5 py-3.5 flex flex-col flex-1 gap-2.5">
                              <p className="text-[var(--tx-base)] text-sm font-semibold leading-snug line-clamp-2 flex-1">
                                {p.name}
                              </p>
                              <div className="flex items-end justify-between mt-auto">
                                <div>
                                  <div className="text-[#14B8A6] font-bold text-xl tabular-nums leading-none">
                                    {fmt(price)}
                                  </div>
                                  {showAlt && (
                                    <div className="text-slate-600 text-[10px] tabular-nums mt-0.5">
                                      {fmtAlt(price)}
                                    </div>
                                  )}
                                </div>
                                <span className="text-slate-500 text-xs font-medium">{p.unit}</span>
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

            {/* ── Status bar ─────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-5 py-2 border-t border-[var(--bd-faint)] bg-[var(--bg-panel)] text-[11px] text-slate-500">
              <span>{showCatGrid ? t("pos.categoryCount", { count: categories.length }) : t("pos.products", { count: products.length })}</span>
              <span className="text-slate-800">·</span>
              <span>{new Date().toLocaleTimeString()}</span>
              {!sessionId && <span className="text-amber-500">· {t("pos.noSession")}</span>}
              <div className="ms-auto flex items-center gap-3 text-slate-700">
                {([
                  ["F2", t("shortcuts.search")],
                  ["F3", t("shortcuts.noSale")],
                  ["F5", t("shortcuts.checkout")],
                  ["F6", t("shortcuts.quickPay")],
                  ["F8", t("shortcuts.newTab")],
                  ["F9", t("shortcuts.hold")],
                ] as [string, string][]).map(([key, label]) => (
                  <span key={key} className="flex items-center gap-1">
                    <kbd className="text-[9px] font-mono px-1 py-0.5 rounded border border-[var(--bd-base)] bg-[var(--bg-base)] text-slate-600">{key}</kbd>
                    <span className="text-slate-700 hidden xl:inline">{label}</span>
                  </span>
                ))}
              </div>
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

      {/* Variable-price dialog */}
      {varPriceProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[var(--bg-panel)] border border-[var(--bd-base)] rounded-2xl shadow-2xl p-6 w-80 space-y-4">
            <div>
              <h3 className="text-[var(--tx-base)] font-bold text-base">{t("pos.variablePrice")}</h3>
              <p className="text-slate-500 text-xs mt-0.5 truncate">{varPriceProduct.name}</p>
            </div>
            <input
              autoFocus
              type="number"
              min="0"
              step="0.01"
              placeholder={t("pos.enterAmount")}
              value={varPriceInput}
              onChange={e => setVarPriceInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmVarPrice(); if (e.key === "Escape") setVarPrice(null); }}
              className="w-full px-4 py-3 bg-[var(--bg-base)] border border-[var(--bd-base)] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl text-[var(--tx-base)] text-2xl font-bold tabular-nums placeholder-slate-600"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setVarPrice(null)}
                className="flex-1 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--bd-base)] text-slate-400 text-sm font-semibold hover:text-[var(--tx-base)] transition-colors cursor-pointer"
              >
                {t("pos.cancel")}
              </button>
              <button
                onClick={confirmVarPrice}
                disabled={!varPriceInput || parseFloat(varPriceInput) <= 0}
                className="flex-1 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {t("pos.confirm")}
              </button>
            </div>
          </div>
        </div>
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
