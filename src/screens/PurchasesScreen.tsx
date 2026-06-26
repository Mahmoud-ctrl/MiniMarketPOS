import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle, ChevronDown, Package, Plus,
  RefreshCw, Search, Truck, X, XCircle,
} from "lucide-react";
import { api } from "../lib/api";
import { Category, Product, Purchase, PurchaseItem, PurchaseWithItems, Supplier, User } from "../types";
import Modal from "../components/Modal";
import CategorySelect from "../components/CategorySelect";
import { useCurrency } from "../context/CurrencyContext";

interface Props { user: User }

const fmtDate = (s: string) =>
  new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Purchase["status"] }) {
  const { t } = useTranslation();
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-full">
        {t("purchases.badge.pending")}
      </span>
    );
  if (status === "received")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-full">
        <CheckCircle size={10} /> {t("purchases.badge.received")}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-500/10 border border-slate-500/20 text-slate-500 text-xs rounded-full">
      <XCircle size={10} /> {t("purchases.badge.cancelled")}
    </span>
  );
}

// ── Shared input styles ────────────────────────────────────────────────────────
const iCls = "w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--bd-base)] focus:border-[#14B8A6]/50 focus:outline-none rounded-xl text-[var(--tx-base)] text-sm placeholder-slate-600 transition-colors";
const selCls = iCls + " cursor-pointer";

// ── Create PO Modal ────────────────────────────────────────────────────────────
interface LineItem {
  product: Product;
  quantity: string;
  unit_cost: string;
}

function CreatePOModal({
  suppliers, user, onClose, onSaved,
}: {
  suppliers: Supplier[]; user: User;
  onClose: () => void; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { fmt, fromDb, toDb, inputStep } = useCurrency();
  const [supplierId, setSupplierId] = useState("");
  const [referenceNo, setReferenceNo] = useState(() => {
    const now = new Date();
    const d = now.getFullYear().toString()
      + String(now.getMonth() + 1).padStart(2, "0")
      + String(now.getDate()).padStart(2, "0");
    const r = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `PO-${d}-${r}`;
  });
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catId, setCatId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    if (!productSearch.trim() && !catId) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      api.getProducts({
        search:      productSearch.trim() || undefined,
        category_id: catId ? Number(catId) : undefined,
        limit:       10,
      })
        .then(setSearchResults)
        .catch(console.error);
    }, 200);
    return () => clearTimeout(timer);
  }, [productSearch, catId]);

  const addProduct = (p: Product) => {
    if (lines.some(l => l.product.id === p.id)) return;
    setLines(prev => [...prev, {
      product: p,
      quantity: "1",
      unit_cost: fromDb(p.cost_price),
    }]);
    setProductSearch("");
    setSearchResults([]);
    setShowDropdown(false);
  };

  const removeLine = (idx: number) =>
    setLines(prev => prev.filter((_, i) => i !== idx));

  const updateLine = (idx: number, field: "quantity" | "unit_cost", val: string) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));

  const total = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity || "0");
    const cost = parseFloat(l.unit_cost || "0");
    return sum + toDb(String(qty * cost));
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) { setError(t("purchases.createModal.atLeastOne")); return; }
    for (const l of lines) {
      if (!parseFloat(l.quantity) || parseFloat(l.quantity) <= 0)
        { setError(`Invalid quantity for ${l.product.name}`); return; }
      if (!parseFloat(l.unit_cost) || parseFloat(l.unit_cost) < 0)
        { setError(`Invalid unit cost for ${l.product.name}`); return; }
    }
    setSaving(true); setError("");
    try {
      await api.createPurchase({
        supplier_id:  supplierId ? Number(supplierId) : null,
        created_by:   user.id,
        reference_no: referenceNo.trim() || null,
        notes:        notes.trim() || null,
        items: lines.map(l => ({
          product_id: l.product.id,
          quantity:   parseFloat(l.quantity),
          unit_cost:  toDb(l.unit_cost),
        })),
      });
      onSaved();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t("purchases.createModal.title")} onClose={onClose} width="max-w-3xl">
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Header fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t("purchases.createModal.supplier")}</label>
              <select className={selCls} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">— {t("common.none")} —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t("purchases.createModal.referenceNo")}</label>
              <input className={iCls} value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="INV-2024-001" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t("purchases.createModal.notes")}</label>
              <input className={iCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t("common.optional")} />
            </div>
          </div>

          {/* Product search */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t("purchases.createModal.addItem")}</label>
            <div className="flex gap-2">
              <CategorySelect
                value={catId}
                onChange={v => { setCatId(v); setShowDropdown(true); }}
                categories={categories}
                className={`${selCls} w-44 flex-shrink-0`}
                placeholder={t("common.allCategories")}
              />
              <div className="relative flex-1">
                <Search size={13} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  className={`${iCls} ps-8`}
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder={t("purchases.createModal.searchProduct")}
                  autoComplete="off"
                />
                {showDropdown && (searchResults.length > 0 || (productSearch.trim() && searchResults.length === 0)) && (
                  <div className="absolute top-full start-0 end-0 z-30 mt-1 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl shadow-2xl overflow-hidden">
                    {searchResults.length === 0 ? (
                      <p className="px-4 py-3 text-slate-500 text-sm">{t("purchases.createModal.noProducts")}</p>
                    ) : searchResults.map(p => (
                      <button key={p.id} type="button" onMouseDown={() => addProduct(p)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-card)] transition-colors text-start cursor-pointer">
                        <div>
                          <p className="text-[var(--tx-base)] text-sm">{p.name}</p>
                          <p className="text-slate-500 text-xs">
                            {p.unit}
                            {p.barcode ? ` · ${p.barcode}` : ""}
                            {p.internal_code ? ` · ${p.internal_code}` : ""}
                            {" · "}{fmt(p.cost_price)}
                          </p>
                        </div>
                        <Plus size={14} className="text-[#14B8A6] flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {showDropdown && !productSearch.trim() && catId && searchResults.length > 0 && (
              <div className="mt-1 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl shadow-2xl overflow-hidden">
                {searchResults.map(p => (
                  <button key={p.id} type="button" onMouseDown={() => addProduct(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-card)] transition-colors text-start cursor-pointer">
                    <div>
                      <p className="text-[var(--tx-base)] text-sm">{p.name}</p>
                      <p className="text-slate-500 text-xs">
                        {p.unit}{p.barcode ? ` · ${p.barcode}` : ""} · {fmt(p.cost_price)}
                      </p>
                    </div>
                    <Plus size={14} className="text-[#14B8A6] flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Line items table */}
          {lines.length > 0 && (
            <div className="rounded-xl border border-[var(--bd-base)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-base)] border-b border-[var(--bd-base)]">
                  <tr>
                    {[
                      t("purchases.createModal.columns.product"),
                      t("purchases.createModal.columns.unit"),
                      t("purchases.createModal.columns.qty"),
                      t("purchases.createModal.columns.unitCost"),
                      t("purchases.createModal.columns.subtotal"),
                      "",
                    ].map((h, i) => (
                      <th key={i} className="px-3 py-2.5 text-start text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const subtotal = toDb(String(parseFloat(l.quantity || "0") * parseFloat(l.unit_cost || "0")));
                    return (
                      <tr key={l.product.id} className="border-b border-[var(--bd-base)]/40">
                        <td className="px-3 py-2.5">
                          <p className="text-[var(--tx-base)] font-medium">{l.product.name}</p>
                          {l.product.barcode && <p className="text-slate-600 text-xs">{l.product.barcode}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 text-xs">{l.product.unit}</td>
                        <td className="px-3 py-2.5 w-24">
                          <input type="number" min="0.01" step="any" className={iCls}
                            value={l.quantity} onChange={e => updateLine(i, "quantity", e.target.value)} />
                        </td>
                        <td className="px-3 py-2.5 w-32">
                          <input type="number" min="0" step={inputStep} className={iCls}
                            value={l.unit_cost} onChange={e => updateLine(i, "unit_cost", e.target.value)} />
                        </td>
                        <td className="px-3 py-2.5 text-[#14B8A6] font-medium tabular-nums">{fmt(subtotal)}</td>
                        <td className="px-3 py-2.5">
                          <button type="button" onClick={() => removeLine(i)}
                            className="w-6 h-6 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors cursor-pointer">
                            <X size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[var(--bg-base)] border-t border-[var(--bd-base)]">
                  <tr>
                    <td colSpan={4} className="px-3 py-2.5 text-end text-sm text-slate-400 font-medium">
                      {t("purchases.createModal.total")}
                    </td>
                    <td className="px-3 py-2.5 text-[#14B8A6] font-bold tabular-nums">{fmt(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {lines.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-[var(--bd-base)] rounded-xl text-slate-600">
              <Package size={32} strokeWidth={1} className="mb-2" />
              <p className="text-sm">{t("purchases.createModal.emptyItems")}</p>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-[var(--bd-base)] bg-[var(--bg-base)]">
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-xs">
              {lines.length > 0 && (
                <>{lines.length} {t("purchases.createModal.columns.product").toLowerCase()} · <span className="text-[#14B8A6] font-semibold">{fmt(total)}</span></>
              )}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={saving || lines.length === 0}
                className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
                {saving ? t("purchases.createModal.creating") : `${t("purchases.createModal.createPO")}${lines.length > 0 ? ` · ${fmt(total)}` : ""}`}
              </button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ── Receive Confirm Modal ──────────────────────────────────────────────────────
function ReceiveModal({
  purchase, user, onClose, onSaved,
}: { purchase: Purchase; user: User; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const { fmt } = useCurrency();
  const [detail, setDetail] = useState<PurchaseWithItems | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => {
    api.getPurchaseById(purchase.id).then(setDetail).catch(console.error);
  }, [purchase.id]);

  const handleConfirm = async () => {
    setSaving(true); setError("");
    try {
      await api.receivePurchase(purchase.id, user.id);
      onSaved();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t("purchases.receiveModal.title")} onClose={onClose} width="max-w-lg">
      <div className="p-6 space-y-4">
        <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl px-4 py-3 space-y-0.5">
          <p className="text-[var(--tx-base)] font-medium">
            PO #{purchase.id}{purchase.reference_no ? ` · ${purchase.reference_no}` : ""}
          </p>
          {purchase.supplier_name && (
            <p className="text-slate-400 text-sm">{purchase.supplier_name}</p>
          )}
        </div>

        {detail ? (
          <div className="rounded-xl border border-[var(--bd-base)] overflow-hidden text-sm">
            <table className="w-full">
              <thead className="bg-[var(--bg-base)] border-b border-[var(--bd-base)]">
                <tr>
                  <th className="px-3 py-2 text-start text-xs text-slate-500 uppercase">{t("purchases.createModal.columns.product")}</th>
                  <th className="px-3 py-2 text-end text-xs text-slate-500 uppercase">{t("purchases.createModal.columns.qty")}</th>
                  <th className="px-3 py-2 text-end text-xs text-slate-500 uppercase">{t("purchases.createModal.columns.unitCost")}</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item: PurchaseItem) => (
                  <tr key={item.id} className="border-b border-[var(--bd-base)]/40">
                    <td className="px-3 py-2.5 text-[var(--tx-base)]">{item.product_name}</td>
                    <td className="px-3 py-2.5 text-end text-slate-400 tabular-nums">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-3 py-2.5 text-end text-[#14B8A6] tabular-nums">
                      {fmt(item.unit_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-20 bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl animate-pulse" />
        )}

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 text-xs text-emerald-400 space-y-1">
          <p>✓ {t("purchases.receiveModal.stockAdded")}</p>
          <p>✓ {t("purchases.receiveModal.priceUpdate")}</p>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex justify-end gap-2 pt-1 border-t border-[var(--bd-base)]">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">
            {t("common.cancel")}
          </button>
          <button onClick={handleConfirm} disabled={saving || !detail}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-[var(--tx-base)] font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? t("purchases.receiveModal.confirming") : t("purchases.receiveModal.confirm")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Detail Modal ───────────────────────────────────────────────────────────────
function DetailModal({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const { t } = useTranslation();
  const { fmt } = useCurrency();
  const [detail, setDetail] = useState<PurchaseWithItems | null>(null);

  useEffect(() => {
    api.getPurchaseById(purchase.id).then(setDetail).catch(console.error);
  }, [purchase.id]);

  return (
    <Modal title={`Purchase Order #${purchase.id}`} onClose={onClose} width="max-w-lg">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: t("purchases.detail.supplier"), value: purchase.supplier_name ?? "—" },
            { label: t("purchases.detail.reference"), value: purchase.reference_no ?? "—" },
            { label: t("purchases.detail.created"),  value: fmtDate(purchase.created_at) },
            { label: t("purchases.detail.received"), value: purchase.received_at ? fmtDate(purchase.received_at) : "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{label}</p>
              <p className="text-[var(--tx-base)]">{value}</p>
            </div>
          ))}
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{t("purchases.detail.status")}</p>
            <StatusBadge status={purchase.status} />
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{t("purchases.detail.total")}</p>
            <p className="text-[#14B8A6] font-bold tabular-nums">{fmt(purchase.total_amount)}</p>
          </div>
        </div>

        {purchase.notes && (
          <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl px-4 py-3 text-sm text-slate-400">
            {purchase.notes}
          </div>
        )}

        {detail ? (
          <div className="rounded-xl border border-[var(--bd-base)] overflow-hidden text-sm">
            <table className="w-full">
              <thead className="bg-[var(--bg-base)] border-b border-[var(--bd-base)]">
                <tr>
                  <th className="px-3 py-2 text-start text-xs text-slate-500 uppercase">{t("purchases.createModal.columns.product")}</th>
                  <th className="px-3 py-2 text-end text-xs text-slate-500 uppercase">{t("purchases.createModal.columns.qty")}</th>
                  <th className="px-3 py-2 text-end text-xs text-slate-500 uppercase">{t("purchases.createModal.columns.unitCost")}</th>
                  <th className="px-3 py-2 text-end text-xs text-slate-500 uppercase">{t("purchases.createModal.columns.subtotal")}</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item: PurchaseItem) => (
                  <tr key={item.id} className="border-b border-[var(--bd-base)]/40">
                    <td className="px-3 py-2.5 text-[var(--tx-base)]">{item.product_name}</td>
                    <td className="px-3 py-2.5 text-end text-slate-400 tabular-nums">{item.quantity} {item.unit}</td>
                    <td className="px-3 py-2.5 text-end text-slate-300 tabular-nums">{fmt(item.unit_cost)}</td>
                    <td className="px-3 py-2.5 text-end text-[#14B8A6] tabular-nums">{fmt(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-20 bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl animate-pulse" />
        )}

        <div className="flex justify-end pt-1 border-t border-[var(--bd-base)]">
          <button onClick={onClose}
            className="px-5 py-2 bg-[var(--bg-card)] hover:bg-[var(--bg-raised)] text-slate-300 text-sm rounded-xl transition-colors cursor-pointer">
            {t("common.close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Void Confirm Modal ─────────────────────────────────────────────────────────
function VoidModal({
  purchase, user, onClose, onSaved,
}: { purchase: Purchase; user: User; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const handleVoid = async () => {
    setSaving(true); setError("");
    try {
      await api.voidPurchase(purchase.id, user.id);
      onSaved();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t("purchases.voidModal.title")} onClose={onClose} width="max-w-sm">
      <div className="p-6 space-y-4">
        <p className="text-slate-300 text-sm">
          PO #{purchase.id}{purchase.reference_no ? ` (${purchase.reference_no})` : ""}?
        </p>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400 space-y-1">
          <p>⚠ {t("purchases.voidModal.stockDeducted")}</p>
          <p>⚠ {t("purchases.voidModal.priceNotReverted")}</p>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-1 border-t border-[var(--bd-base)]">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">
            {t("common.cancel")}
          </button>
          <button onClick={handleVoid} disabled={saving}
            className="px-5 py-2 bg-red-500 hover:bg-red-600 text-[var(--tx-base)] font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? t("purchases.voidModal.voiding") : t("purchases.voidModal.void")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function PurchasesScreen({ user }: Props) {
  const { t } = useTranslation();
  const { fmt } = useCurrency();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "received" | "cancelled">("all");
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<Purchase | null>(null);
  const [viewing, setViewing]   = useState<Purchase | null>(null);
  const [voiding, setVoiding]   = useState<Purchase | null>(null);
  const [cancelError, setCancelError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getPurchases({
        status: statusFilter === "all" ? null : statusFilter,
      });
      setPurchases(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.getSuppliers().then(setSuppliers).catch(console.error);
  }, []);

  useEffect(() => { load(); }, [statusFilter]);

  const handleSaved = () => {
    setCreating(false);
    setReceiving(null);
    setVoiding(null);
    load();
  };

  const handleCancel = async (p: Purchase) => {
    setCancelError("");
    try {
      await api.cancelPurchase(p.id);
      load();
    } catch (err: unknown) {
      setCancelError((err as { message?: string })?.message ?? String(err));
    }
  };

  const filtered = search.trim()
    ? purchases.filter(p =>
        (p.supplier_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.reference_no  ?? "").toLowerCase().includes(search.toLowerCase()) ||
        String(p.id).includes(search))
    : purchases;

  const counts = {
    pending:   purchases.filter(p => p.status === "pending").length,
    received:  purchases.filter(p => p.status === "received").length,
    cancelled: purchases.filter(p => p.status === "cancelled").length,
  };

  const statusKeys: { id: "all" | "pending" | "received" | "cancelled"; labelKey: string }[] = [
    { id: "all",       labelKey: "purchases.status.all"       },
    { id: "pending",   labelKey: "purchases.status.pending"   },
    { id: "received",  labelKey: "purchases.status.received"  },
    { id: "cancelled", labelKey: "purchases.status.cancelled" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--bd-base)] bg-[var(--bg-base)]">
        <div>
          <h1 className="text-[var(--tx-base)] font-semibold text-base flex items-center gap-2">
            <Truck size={16} className="text-[#14B8A6]" /> {t("purchases.title")}
          </h1>
          <p className="text-slate-500 text-xs">{t("purchases.orders", { count: purchases.length })}</p>
        </div>
        <div className="flex-1" />

        {/* Status filter pills */}
        <div className="flex items-center gap-1">
          {statusKeys.map(({ id, labelKey }) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                statusFilter === id
                  ? "bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/30"
                  : "text-slate-500 hover:text-slate-300 border border-transparent hover:border-[var(--bd-base)]"
              }`}
            >
              {t(labelKey)}{id !== "all" && counts[id] > 0 ? ` (${counts[id]})` : ""}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-48">
          <Search size={13} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t("purchases.searchPlaceholder")}
            className="w-full ps-8 pe-3 py-1.5 bg-[var(--bg-card)] border border-[var(--bd-base)] focus:border-[#14B8A6]/50 focus:outline-none rounded-xl text-[var(--tx-base)] text-sm placeholder-slate-600 transition-colors"
          />
        </div>

        <button onClick={load} className="w-8 h-8 rounded-xl bg-[var(--bg-card)] border border-[var(--bd-base)] text-slate-500 hover:text-[var(--tx-base)] flex items-center justify-center transition-colors cursor-pointer">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>

        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
        >
          <Plus size={15} /> {t("purchases.newPO")}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="sticky top-0 bg-[var(--bg-base)] border-b border-[var(--bd-base)] z-10">
            <tr>
              {[
                t("purchases.columns.date"),
                t("purchases.columns.supplier"),
                t("purchases.columns.reference"),
                t("purchases.columns.items"),
                t("purchases.columns.total"),
                t("purchases.columns.status"),
                "",
              ].map((h, i) => (
                <th key={i} className="px-4 py-3 text-start text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-[var(--bd-base)]/40">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-[var(--bg-card)] rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-slate-600">
                  <Package size={36} strokeWidth={1} className="mx-auto mb-2" />
                  <p>{search || statusFilter !== "all" ? t("purchases.noResults") : t("purchases.noOrders")}</p>
                </td>
              </tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-b border-[var(--bd-base)]/40 hover:bg-[var(--bg-card)]/40 transition-colors group">
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                  {fmtDate(p.created_at)}
                </td>
                <td className="px-4 py-3">
                  <p className="text-[var(--tx-base)] font-medium">{p.supplier_name ?? <span className="text-slate-600">—</span>}</p>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {p.reference_no ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  <ChevronDown size={12} className="inline me-1 text-slate-600" />
                  <button onClick={() => setViewing(p)} className="text-[#14B8A6] hover:underline cursor-pointer text-xs">
                    {t("purchases.viewItems")}
                  </button>
                </td>
                <td className="px-4 py-3 text-[#14B8A6] font-medium tabular-nums">
                  {fmt(p.total_amount)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {p.status === "pending" && (
                      <>
                        <button
                          onClick={() => setReceiving(p)}
                          className="px-2.5 py-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg transition-colors cursor-pointer"
                        >
                          {t("purchases.actions.receive")}
                        </button>
                        <button
                          onClick={() => handleCancel(p)}
                          className="px-2.5 py-1 text-xs bg-[var(--bg-raised)] hover:bg-red-500/10 border border-[var(--bd-base)] hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                        >
                          {t("purchases.actions.cancel")}
                        </button>
                      </>
                    )}
                    {p.status === "received" && (
                      <button
                        onClick={() => setVoiding(p)}
                        className="px-2.5 py-1 text-xs bg-[var(--bg-raised)] hover:bg-red-500/10 border border-[var(--bd-base)] hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                      >
                        {t("purchases.actions.void")}
                      </button>
                    )}
                    <button
                      onClick={() => setViewing(p)}
                      className="px-2.5 py-1 text-xs bg-[var(--bg-raised)] hover:bg-[var(--bg-raised)] border border-[var(--bd-base)] text-slate-400 hover:text-[var(--tx-base)] rounded-lg transition-colors cursor-pointer"
                    >
                      {t("purchases.actions.view")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cancel error toast */}
      {cancelError && (
        <div className="fixed bottom-6 start-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500/30 text-red-300 text-sm px-5 py-3 rounded-xl shadow-2xl z-50">
          {cancelError}
          <button onClick={() => setCancelError("")} className="ms-3 text-red-400 hover:text-[var(--tx-base)] cursor-pointer">✕</button>
        </div>
      )}

      {/* Modals */}
      {creating && (
        <CreatePOModal
          suppliers={suppliers} user={user}
          onClose={() => setCreating(false)} onSaved={handleSaved}
        />
      )}
      {receiving && (
        <ReceiveModal
          purchase={receiving} user={user}
          onClose={() => setReceiving(null)} onSaved={handleSaved}
        />
      )}
      {viewing && (
        <DetailModal purchase={viewing} onClose={() => setViewing(null)} />
      )}
      {voiding && (
        <VoidModal
          purchase={voiding} user={user}
          onClose={() => setVoiding(null)} onSaved={handleSaved}
        />
      )}
    </div>
  );
}
