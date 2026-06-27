import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle, Package, Plus,
  RefreshCw, Search, Truck, X, XCircle, Calendar, Filter
} from "lucide-react";
import { api } from "../lib/api";
import { Category, Product, Purchase, PurchaseItem, PurchaseWithItems, Supplier, User } from "../types";
import Modal from "../components/Modal";
import CategorySelect from "../components/CategorySelect";
import { useCurrency } from "../context/CurrencyContext";
import { PageHeader } from "../components/PageHeader";
import { PillGroup } from "../components/PillGroup";

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
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<Purchase | null>(null);
  const [viewing, setViewing]   = useState<Purchase | null>(null);
  const [voiding, setVoiding]   = useState<Purchase | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "received" | "cancelled">("all");
  const [range, setRange] = useState<"today" | "week" | "month" | "all">("all");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getPurchases({});
      setPurchases(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.getSuppliers().then(setSuppliers).catch(console.error);
    load();
  }, []);

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

  const filtered = useMemo(() => {
    const now = new Date();
    return purchases.filter(p => {
      const matchS = filterStatus === "all" || p.status === filterStatus;
      const term = search.toLowerCase();
      const matchQ = (p.supplier_name ?? "").toLowerCase().includes(term) ||
                     (p.reference_no ?? "").toLowerCase().includes(term) ||
                     String(p.id).includes(term);
      let matchD = true;
      if (range !== "all") {
        const pd = new Date(p.created_at);
        const diff = now.getTime() - pd.getTime();
        const days = diff / (1000 * 3600 * 24);
        if (range === "today") matchD = days <= 1;
        else if (range === "week") matchD = days <= 7;
        else if (range === "month") matchD = days <= 30;
      }
      return matchS && matchQ && matchD;
    });
  }, [purchases, filterStatus, search, range]);

  const dateOpts = [
    { id: "today", label: t("transactions.dateRange.today", "Today") },
    { id: "week", label: t("transactions.dateRange.week", "This Week") },
    { id: "month", label: t("transactions.dateRange.month", "This Month") },
    { id: "all", label: t("transactions.dateRange.all", "All Time") },
  ] as any;

  const statusOpts = [
    { id: "all", label: t("purchases.status.all") },
    { id: "pending", label: t("purchases.status.pending") },
    { id: "received", label: t("purchases.status.received") },
    { id: "cancelled", label: t("purchases.status.cancelled") },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-deep)] text-[var(--tx-base)] relative z-10">
      {/* Header */}
      <PageHeader
        icon={<Truck size={22} className="text-[#14B8A6]" />}
        title={t("purchases.title")}
        subtitle={t("purchases.orders", { count: purchases.length })}
        actions={
          <>
            <button onClick={load} className="w-12 h-12 rounded-2xl bg-[var(--bg-panel)] border border-[var(--bd-base)] text-slate-500 hover:text-[var(--tx-base)] hover:border-[var(--tx-base)] shadow-sm flex items-center justify-center transition-all cursor-pointer active:scale-95">
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-6 py-3 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-black text-sm uppercase tracking-wider rounded-2xl shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] transition-all cursor-pointer active:scale-95"
            >
              <Plus size={18} /> {t("purchases.newPO")}
            </button>
          </>
        }
        searchBlock={
          <div className="relative group max-w-sm">
            <Search size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#14B8A6] transition-colors pointer-events-none" />
            <input
              type="text"
              placeholder={t("purchases.searchPlaceholder")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--bg-panel)] border border-[var(--bd-base)] focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20 focus:outline-none rounded-2xl ps-12 pe-4 py-3 text-[var(--tx-base)] text-sm font-medium placeholder-slate-400 shadow-sm transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute end-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--tx-base)] cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>
        }
        filtersBlock={
          <>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Calendar size={13} />
            </div>
            <PillGroup options={dateOpts as any} value={range} onChange={setRange} />
            <div className="w-px h-5 bg-[var(--bd-base)]" />
            <div className="flex items-center gap-1.5 text-slate-600">
              <Filter size={13} />
            </div>
            <PillGroup options={statusOpts as any} value={filterStatus} onChange={setFilterStatus} />
          </>
        }
      />

      {/* Table -> Grid */}
      <div className="flex-1 overflow-auto p-8 pt-4 scrollbar-hide">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-52 rounded-3xl bg-[var(--bg-panel)] border border-[var(--bd-faint)] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-6 text-center">
            <div className="w-20 h-20 rounded-full bg-[var(--bg-panel)] border border-[var(--bd-base)] flex items-center justify-center">
              <Package size={32} className="text-slate-400" />
            </div>
            <p className="text-slate-500 text-lg font-medium">{search || filterStatus !== "all" ? t("purchases.noResults") : t("purchases.noOrders")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(p => {
              const isVoid = p.status === "cancelled";
              const isPending = p.status === "pending";
              const accentColor = isVoid ? "bg-slate-500/60" : isPending ? "bg-amber-400/70" : "bg-emerald-500/70";
              
              return (
                <div
                  key={p.id}
                  className="group relative h-52 text-left rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between overflow-hidden bg-[var(--bg-panel)] border border-[var(--bd-base)] hover:border-[var(--tx-base)] hover:shadow-xl"
                >
                  {/* Status accent stripe (top edge) */}
                  <div className={`absolute top-0 inset-x-6 h-[2px] opacity-20 transition-opacity group-hover:opacity-100 ${accentColor}`} />

                  {/* Top content */}
                  <div className="flex-1 pr-1 cursor-pointer" onClick={() => setViewing(p)}>
                    <div className="flex justify-between items-start">
                      <p className="text-lg font-bold leading-tight line-clamp-2 text-[var(--tx-base)] max-w-[75%]">
                        {p.supplier_name ?? "—"}
                      </p>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="flex flex-col mt-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 truncate">
                        {p.reference_no ?? `PO #${p.id}`}
                      </span>
                      <span className="text-xs text-slate-400 mt-1 truncate">
                        {fmtDate(p.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Middle metrics */}
                  <div className="mt-auto mb-3 flex items-end justify-between z-0 cursor-pointer" onClick={() => setViewing(p)}>
                    <div>
                      <div className={`text-3xl font-black tabular-nums tracking-tight leading-none text-[#14B8A6]`}>
                        {fmt(p.total_amount)}
                      </div>
                      <div className="text-xs font-bold uppercase tracking-widest mt-1 text-slate-500">
                        Total
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons (Always visible, moved to bottom) */}
                  <div className="pt-3 border-t border-[var(--bd-faint)] flex items-center gap-2 z-10 overflow-x-auto scrollbar-hide shrink-0">
                    {p.status === "pending" && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setReceiving(p); }}
                          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-[var(--bg-base)] border border-emerald-500/20 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {t("purchases.actions.receive")}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancel(p); }}
                          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-[var(--bg-base)] hover:bg-red-500 text-slate-400 hover:text-[var(--bg-base)] border border-[var(--bd-base)] hover:border-red-500 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {t("purchases.actions.cancel")}
                        </button>
                      </>
                    )}
                    {p.status === "received" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setVoiding(p); }}
                        className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-[var(--bg-base)] hover:bg-red-500 text-slate-400 hover:text-[var(--bg-base)] border border-[var(--bd-base)] hover:border-red-500 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {t("purchases.actions.void")}
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewing(p); }}
                      className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-[var(--bg-base)] hover:bg-[var(--tx-base)] border border-[var(--bd-base)] text-slate-400 hover:text-[var(--bg-base)] rounded-xl transition-colors cursor-pointer whitespace-nowrap ms-auto"
                    >
                      {t("purchases.actions.view")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
