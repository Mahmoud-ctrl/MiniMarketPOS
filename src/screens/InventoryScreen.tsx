import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown, Flame, History, Package,
  Plus, RefreshCw, Search, Snowflake, Trash2, TrendingDown,
  Filter, X
} from "lucide-react";
import { api } from "../lib/api";
import { generateEAN13 } from "../lib/barcode";
import { Category, PerishableAlert, PriceHistoryEntry, ProductStock, Supplier, User } from "../types";
import Modal from "../components/Modal";
import CategorySelect from "../components/CategorySelect";
import AddProductModal from "./AddProductModal";
import { useCurrency } from "../context/CurrencyContext";
import { PageHeader } from "../components/PageHeader";
import { PillGroup } from "../components/PillGroup";

interface Props { user: User }

const orNull = (s: string) => s.trim() || null;
const toPct  = (f: number) => (f * 100).toFixed(1);

// Vercel/Editorial style muted neon palette
const CAT_COLORS = [
  "#14B8A6", "#6366F1", "#F59E0B", "#10B981",
  "#EF4444", "#8B5CF6", "#06B6D4", "#F97316",
  "#EC4899", "#84CC16",
];
const catColor = (id: number | null) =>
  id == null ? "#475569" : CAT_COLORS[id % CAT_COLORS.length];

function stockColor(qty: number, min: number) {
  if (qty <= 0)              return "text-red-400";
  if (qty <= min && min > 0) return "text-amber-400";
  return "text-emerald-400";
}

function expiryBadge(days: number | null): React.ReactNode {
  if (days === null) return null;
  if (days < 0)  return <span className="inline-flex items-center px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] rounded-full font-medium">Expired</span>;
  if (days === 0) return <span className="inline-flex items-center px-1.5 py-0.5 bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] rounded-full font-medium">Today</span>;
  if (days === 1) return <span className="inline-flex items-center px-1.5 py-0.5 bg-orange-500/15 border border-orange-500/25 text-orange-400 text-[10px] rounded-full font-medium">Tomorrow</span>;
  if (days <= 3)  return <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] rounded-full font-medium">{days}d</span>;
  return <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] rounded-full font-medium">{days}d</span>;
}

// ── Product form state ──────────────────────────────────────────────────────────
interface PF {
  barcode: string; internal_code: string; name: string;
  category_id: string; supplier_id: string;
  item_type: string; unit: string; packaging_qty: string;
  cost_price: string; sell_price_retail: string;
  sell_price_wholesale: string; sell_price_special: string;
  tva_rate: string; apply_tva: boolean; apply_discount: boolean; sold_by_amount: boolean;
  min_stock: string; expiry_date: string;
  is_perishable: boolean; default_shelf_life_days: string;
  is_variable_price: boolean; is_favorite: boolean;
}

function stockToPF(p: ProductStock, fromDb: (n: number) => string): PF {
  return {
    barcode:               p.barcode              ?? "",
    internal_code:         p.internal_code        ?? "",
    name:                  p.name,
    category_id:           p.category_id          != null ? String(p.category_id) : "",
    supplier_id:           p.supplier_id          != null ? String(p.supplier_id) : "",
    item_type:             p.item_type,
    unit:                  p.unit,
    packaging_qty:         String(p.packaging_qty),
    cost_price:            fromDb(p.cost_price),
    sell_price_retail:     fromDb(p.sell_price_retail),
    sell_price_wholesale:  fromDb(p.sell_price_wholesale),
    sell_price_special:    fromDb(p.sell_price_special),
    tva_rate:              toPct(p.tva_rate),
    apply_tva:             p.apply_tva,
    apply_discount:        p.apply_discount,
    sold_by_amount:        p.sold_by_amount,
    min_stock:             String(p.min_stock),
    expiry_date:           p.expiry_date ?? "",
    is_perishable:         p.is_perishable,
    default_shelf_life_days: p.default_shelf_life_days != null ? String(p.default_shelf_life_days) : "",
    is_variable_price:     p.is_variable_price,
    is_favorite:           p.is_favorite,
  };
}

function pfToPayload(f: PF, toDb: (s: string) => number) {
  return {
    barcode:               orNull(f.barcode),
    internal_code:         orNull(f.internal_code),
    name:                  f.name.trim(),
    category_id:           f.category_id ? Number(f.category_id) : null,
    supplier_id:           f.supplier_id ? Number(f.supplier_id) : null,
    item_type:             f.item_type   || "consumable",
    unit:                  f.unit        || "pcs",
    packaging_qty:         parseInt(f.packaging_qty || "1"),
    cost_price:            toDb(f.cost_price),
    sell_price_retail:     toDb(f.sell_price_retail),
    sell_price_wholesale:  toDb(f.sell_price_wholesale),
    sell_price_special:    toDb(f.sell_price_special),
    tva_rate:              parseFloat(f.tva_rate || "0") / 100,
    apply_tva:             f.apply_tva,
    apply_discount:        f.apply_discount,
    sold_by_amount:        f.sold_by_amount,
    min_stock:             parseFloat(f.min_stock || "0"),
    expiry_date:           orNull(f.expiry_date),
    is_perishable:         f.is_perishable,
    default_shelf_life_days: f.default_shelf_life_days ? parseInt(f.default_shelf_life_days) : null,
    is_variable_price:     f.is_variable_price,
    is_favorite:           f.is_favorite,
  };
}

// ── Shared field + toggle ───────────────────────────────────────────────────────
function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const iCls   = "w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--bd-base)] focus:border-[#14B8A6]/50 focus:outline-none rounded-xl text-[var(--tx-base)] text-sm placeholder-slate-600 transition-colors";
const selCls = iCls + " cursor-pointer";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 cursor-pointer group">
      <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${checked ? "bg-[#14B8A6]" : "bg-[var(--bg-raised)] border border-[var(--bd-base)]"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-4" : "left-0.5"}`} />
      </div>
      <span className="text-sm text-slate-400 group-hover:text-slate-300">{label}</span>
    </button>
  );
}

// ── Product Form Modal (edit) ───────────────────────────────────────────────────
function ProductFormModal({
  initial, editId, categories, suppliers, userId, onClose, onSaved,
}: {
  initial: PF; editId: number | null;
  categories: Category[]; suppliers: Supplier[];
  userId?: number | null;
  onClose: () => void; onSaved: () => void;
}) {
  const { symbol, fmtNum, toDb, inputStep } = useCurrency();
  const [f, setF]           = useState<PF>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (key: keyof PF) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(prev => ({ ...prev, [key]: e.target.value }));

  const cost   = parseFloat(f.cost_price       || "0");
  const retail = parseFloat(f.sell_price_retail || "0");
  const showStrip = cost > 0 && retail > 0;
  const margin    = showStrip ? ((retail - cost) / cost) * 100 : 0;
  const profit    = showStrip ? retail - cost : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim())       { setError("Name is required");         return; }
    if (!f.sell_price_retail) { setError("Retail price is required"); return; }
    setSaving(true); setError("");
    try {
      const payload = pfToPayload(f, toDb);
      if (editId != null) await api.updateProduct(editId, payload, userId ?? null);
      else                await api.createProduct(payload as Parameters<typeof api.createProduct>[0]);
      onSaved();
    } catch (err: unknown) {
      const raw = (err as { message?: string })?.message ?? String(err);
      const msg = raw.includes("products_barcode_key")       ? "Barcode already in use."
                : raw.includes("products_internal_code_key") ? "Internal code already in use."
                : raw;
      setError(msg);
    } finally { setSaving(false); }
  };

  return (
    <Modal title={editId != null ? "Edit Product" : "Add Product"} onClose={onClose} width="max-w-2xl">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">

        {/* Identity */}
        <section className="space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Identity</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Product Name" required>
                <input className={iCls} value={f.name} onChange={set("name")} placeholder="e.g. Marlboro Red" autoFocus />
              </Field>
            </div>
            <Field label="Unit">
              <input className={iCls} value={f.unit} onChange={set("unit")} placeholder="pcs / kg / bottle" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Barcode">
              <div className="flex gap-2">
                <input className={iCls} value={f.barcode} onChange={set("barcode")} placeholder="EAN-13 / UPC" />
                <button type="button" onClick={() => setF(p => ({ ...p, barcode: generateEAN13() }))}
                  className="flex-shrink-0 px-3 py-2 bg-[var(--bg-card)] border border-[var(--bd-base)] hover:border-[#14B8A6]/50 text-slate-400 hover:text-[#14B8A6] rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5">
                  <RefreshCw size={12} /> Gen
                </button>
              </div>
            </Field>
            <Field label="Internal Code">
              <input className={iCls} value={f.internal_code} onChange={set("internal_code")} placeholder="SKU / store code" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Category">
              <CategorySelect value={f.category_id} onChange={v => setF(prev => ({ ...prev, category_id: v }))} categories={categories} className={selCls} />
            </Field>
            <Field label="Supplier">
              <select className={selCls} value={f.supplier_id} onChange={set("supplier_id")}>
                <option value="">— None —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Item Type">
              <select className={selCls} value={f.item_type} onChange={set("item_type")}>
                <option value="consumable">Consumable</option>
                <option value="non_consumable">Non-consumable</option>
                <option value="service">Service</option>
              </select>
            </Field>
          </div>
        </section>

        {/* Pricing */}
        <section className="space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pricing ({symbol})</p>
          {showStrip && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl text-xs">
              <span className="text-slate-400">Cost <strong className="text-[var(--tx-base)]">{fmtNum(cost)}</strong></span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-400">Retail <strong className="text-[#14B8A6]">{fmtNum(retail)}</strong></span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-400">Margin <strong className={margin >= 0 ? "text-emerald-400" : "text-red-400"}>{margin.toFixed(1)}%</strong></span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-400">Profit <strong className={profit >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtNum(profit)}</strong></span>
            </div>
          )}
          <div className="grid grid-cols-4 gap-3">
            <Field label="Cost Price">
              <input className={iCls} type="number" min="0" step={inputStep} value={f.cost_price} onChange={set("cost_price")} placeholder="0" />
            </Field>
            <Field label="Retail" required>
              <input className={iCls} type="number" min="0" step={inputStep} value={f.sell_price_retail} onChange={set("sell_price_retail")} placeholder="0" />
            </Field>
            <Field label="Wholesale">
              <input className={iCls} type="number" min="0" step={inputStep} value={f.sell_price_wholesale} onChange={set("sell_price_wholesale")} placeholder="0" />
            </Field>
            <Field label="Special">
              <input className={iCls} type="number" min="0" step={inputStep} value={f.sell_price_special} onChange={set("sell_price_special")} placeholder="0" />
            </Field>
          </div>
          <div className="flex items-end gap-3">
            <div className="w-36">
              <Field label="TVA Rate (%)">
                <input className={iCls} type="number" min="0" max="100" step="0.1" value={f.tva_rate} onChange={set("tva_rate")} placeholder="0" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-5 pb-2">
              <Toggle checked={f.apply_tva}     onChange={v => setF(p => ({ ...p, apply_tva: v }))}     label="Apply TVA on sale" />
              <Toggle checked={f.apply_discount} onChange={v => setF(p => ({ ...p, apply_discount: v }))} label="Discountable" />
              <Toggle checked={f.sold_by_amount} onChange={v => setF(p => ({ ...p, sold_by_amount: v }))} label="Sell by amount" />
            </div>
          </div>
        </section>

        {/* Stock */}
        <section className="space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Stock</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Min Stock (reorder)">
              <input className={iCls} type="number" min="0" step="1" value={f.min_stock} onChange={set("min_stock")} placeholder="0" />
            </Field>
            <Field label="Packaging Qty">
              <input className={iCls} type="number" min="1" step="1" value={f.packaging_qty} onChange={set("packaging_qty")} placeholder="1" />
            </Field>
            <Field label="Expiry Date">
              <input className={iCls} type="date" value={f.expiry_date} onChange={set("expiry_date")} />
            </Field>
          </div>
        </section>

        {/* POS Behaviour */}
        <section className="space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">POS Behaviour</p>
          <div className="flex flex-wrap items-center gap-6">
            <Toggle checked={f.is_favorite}       onChange={v => setF(p => ({ ...p, is_favorite: v }))}       label="Show in favorites strip" />
            <Toggle checked={f.is_variable_price} onChange={v => setF(p => ({ ...p, is_variable_price: v }))} label="Variable / open price" />
          </div>
        </section>

        {/* Freshness */}
        <section className="space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Freshness</p>
          <div className="flex items-center gap-6">
            <Toggle checked={f.is_perishable} onChange={v => setF(p => ({ ...p, is_perishable: v }))} label="Perishable item" />
          </div>
          {f.is_perishable && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Typical shelf life (days)">
                <input
                  className={iCls} type="number" min="1" step="1"
                  value={f.default_shelf_life_days}
                  onChange={set("default_shelf_life_days")}
                  placeholder="Leave blank — system learns from waste logs"
                />
              </Field>
              <div className="flex items-end pb-1">
                <p className="text-xs text-slate-500 leading-relaxed">
                  The system updates this automatically every time you log waste for this product.
                </p>
              </div>
            </div>
          )}
        </section>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bd-base)]">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Saving…" : editId != null ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Adjust Stock Modal ─────────────────────────────────────────────────────────
function AdjustModal({
  product, userId, onClose, onSaved,
}: { product: ProductStock; userId: number; onClose: () => void; onSaved: () => void }) {
  const [delta, setDelta]   = useState("");
  const [type, setType]     = useState("adjustment");
  const [notes, setNotes]   = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const presets = [1, 5, 10, 50, 100];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = parseFloat(delta);
    if (isNaN(d) || d === 0) { setError("Enter a non-zero quantity"); return; }
    setSaving(true); setError("");
    try {
      await api.adjustInventory({
        product_id:     product.product_id,
        quantity_delta: d,
        movement_type:  type,
        notes:          notes.trim() || null,
        created_by:     userId,
      });
      onSaved();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? String(err));
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Adjust Stock" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl px-4 py-3">
          <p className="text-[var(--tx-base)] font-medium">{product.name}</p>
          <p className={`text-lg font-bold tabular mt-0.5 ${stockColor(product.stock_qty, product.min_stock)}`}>
            {product.stock_qty} {product.unit} in stock
          </p>
        </div>
        <Field label="Movement Type">
          <select className={selCls} value={type} onChange={e => setType(e.target.value)}>
            <option value="opening">Opening stock</option>
            <option value="adjustment">Adjustment / recount</option>
            <option value="damage">Damage / shrinkage</option>
            <option value="return_in">Return in (from customer)</option>
            <option value="return_out">Return out (to supplier)</option>
          </select>
        </Field>
        <Field label="Quantity delta (use − for removal)">
          <div className="space-y-2">
            <div className="flex gap-1 flex-wrap">
              {presets.map(p => (
                <button key={p} type="button" onClick={() => setDelta(String(p))}
                  className="px-2.5 py-1 bg-[var(--bg-card)] border border-[var(--bd-base)] hover:border-[#14B8A6]/40 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer">
                  +{p}
                </button>
              ))}
              {presets.map(p => (
                <button key={-p} type="button" onClick={() => setDelta(String(-p))}
                  className="px-2.5 py-1 bg-[var(--bg-card)] border border-[var(--bd-base)] hover:border-red-500/40 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer">
                  -{p}
                </button>
              ))}
            </div>
            <input className={iCls} type="number" step="any" value={delta} onChange={e => setDelta(e.target.value)} placeholder="Enter custom amount" />
          </div>
        </Field>
        <Field label="Notes (optional)">
          <input className={iCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for adjustment…" />
        </Field>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bd-base)]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Saving…" : "Apply"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Waste Modal ────────────────────────────────────────────────────────────────
function WasteModal({
  product, userId, onClose, onSaved,
}: { product: ProductStock; userId: number; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty]       = useState("");
  const [notes, setNotes]   = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const presets = [0.5, 1, 2, 5];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(qty);
    if (isNaN(q) || q <= 0)              { setError("Enter a positive quantity"); return; }
    if (q > product.stock_qty)           { setError(`Max is ${product.stock_qty} ${product.unit}`); return; }
    setSaving(true); setError("");
    try {
      await api.logWaste({
        product_id: product.product_id,
        quantity:   q,
        notes:      notes.trim() || null,
        created_by: userId,
      });
      onSaved();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? String(err));
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Log Waste" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <p className="text-[var(--tx-base)] font-medium">{product.name}</p>
          <p className="text-red-400 text-sm mt-0.5 tabular">{product.stock_qty} {product.unit} in stock</p>
        </div>

        <Field label={`Quantity to write off (${product.unit})`}>
          <div className="space-y-2">
            <div className="flex gap-1 flex-wrap">
              {presets.map(p => (
                <button key={p} type="button" onClick={() => setQty(String(p))}
                  className="px-2.5 py-1 bg-[var(--bg-card)] border border-[var(--bd-base)] hover:border-red-500/40 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer">
                  {p}
                </button>
              ))}
              <button type="button" onClick={() => setQty(String(product.stock_qty))}
                className="px-2.5 py-1 bg-[var(--bg-card)] border border-red-500/30 hover:border-red-500/60 text-red-400 text-xs rounded-lg transition-colors cursor-pointer">
                All ({product.stock_qty})
              </button>
            </div>
            <input className={iCls} type="number" step="any" min="0.01" value={qty}
              onChange={e => setQty(e.target.value)} placeholder={`Amount in ${product.unit}`} autoFocus />
          </div>
        </Field>

        <Field label="Reason (optional)">
          <input className={iCls} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Mold, overripe, dropped…" />
        </Field>

        <p className="text-xs text-slate-500">
          Shelf-life estimate updates automatically after each waste log.
        </p>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bd-base)]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Logging…" : "Mark as Waste"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Price History Modal ────────────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  cost_price:           "Cost Price",
  sell_price_retail:    "Retail Price",
  sell_price_wholesale: "Wholesale Price",
  sell_price_special:   "Special Price",
};

function PriceHistoryModal({
  product, onClose,
}: { product: ProductStock; onClose: () => void }) {
  const { fmt } = useCurrency();
  const [entries, setEntries] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPriceHistory(product.product_id)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [product.product_id]);

  return (
    <Modal title={`Price History — ${product.name}`} onClose={onClose} width="max-w-2xl">
      <div className="p-6">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-[var(--bg-card)] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <History size={36} strokeWidth={1} className="mx-auto mb-2 text-slate-600" />
            <p className="text-sm">No price changes recorded yet.</p>
            <p className="text-xs mt-1 text-slate-600">Changes will appear here after editing prices.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map(e => (
              <div key={e.id}
                className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[var(--tx-base)] text-sm font-medium">
                      {FIELD_LABELS[e.field_name] ?? e.field_name}
                    </span>
                    <span className="text-slate-600 text-xs">
                      {e.changed_by_name ?? "Unknown"}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {new Date(e.changed_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm tabular-nums flex-shrink-0">
                  {e.old_value !== null ? (
                    <span className="text-slate-500 line-through">{fmt(e.old_value)}</span>
                  ) : (
                    <span className="text-slate-600 text-xs italic">new</span>
                  )}
                  <span className="text-slate-600">→</span>
                  <span className="text-[#14B8A6] font-semibold">{fmt(e.new_value)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Perishable Alerts Banner ───────────────────────────────────────────────────
function PerishableBanner({ alerts, onWaste }: {
  alerts: PerishableAlert[];
  onWaste: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);

  const urgent  = alerts.filter(a => a.days_until_expiry !== null && a.days_until_expiry <= 1);
  const warning = alerts.filter(a => a.days_until_expiry !== null && a.days_until_expiry > 1 && a.days_until_expiry <= 3);
  const unknown = alerts.filter(a => a.days_until_expiry === null);

  if (alerts.length === 0) return null;

  return (
    <div className="mx-6 mt-3 rounded-2xl border border-orange-500/25 bg-orange-500/8 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left cursor-pointer hover:bg-orange-500/5 transition-colors"
      >
        <Flame size={14} className="text-orange-400 flex-shrink-0" />
        <span className="text-orange-300 text-xs font-medium flex-1">
          {urgent.length > 0 && <span className="text-red-400">{urgent.length} expiring today/overdue</span>}
          {urgent.length > 0 && warning.length > 0 && <span className="text-orange-400"> · </span>}
          {warning.length > 0 && <span className="text-amber-400">{warning.length} within 3 days</span>}
          {(urgent.length > 0 || warning.length > 0) && unknown.length > 0 && <span className="text-slate-500"> · </span>}
          {unknown.length > 0 && <span className="text-slate-500">{unknown.length} no estimate yet</span>}
        </span>
        <ChevronDown size={13} className={`text-slate-500 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-orange-500/15 pt-2.5">
          {alerts.map(a => (
            <div key={a.product_id} className="flex items-center gap-2 text-xs">
              {expiryBadge(a.days_until_expiry)}
              <span className="text-[var(--tx-base)] truncate flex-1">{a.name}</span>
              <span className="text-slate-500 tabular">{a.stock_qty} {a.unit}</span>
              {a.estimated_expiry && (
                <span className="text-slate-600 tabular hidden sm:block">{a.estimated_expiry}</span>
              )}
              <button
                type="button"
                onClick={() => onWaste(a.product_id)}
                className="flex-shrink-0 px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-[10px] transition-colors cursor-pointer"
              >
                Waste
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function InventoryScreen({ user }: Props) {
  const { t } = useTranslation();
  const { fmt, fromDb } = useCurrency();
  const [stocks, setStocks]           = useState<ProductStock[]>([]);
  const [alerts, setAlerts]           = useState<PerishableAlert[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [search, setSearch]           = useState("");
  const [showLow, setShowLow]         = useState(false);
  const [filterCat, setFilterCat]     = useState<number | "all">("all");
  const [loading, setLoading]         = useState(false);
  const [adjusting, setAdjusting]         = useState<ProductStock | null>(null);
  const [editing, setEditing]             = useState<ProductStock | null>(null);
  const [wasting, setWasting]             = useState<ProductStock | null>(null);
  const [viewingHistory, setViewingHistory] = useState<ProductStock | null>(null);
  const [showAdd, setShowAdd]             = useState(false);
  const [confirmDeact, setConfirmDeact]   = useState<ProductStock | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [data, alertData] = await Promise.all([
        showLow ? api.getLowStock() : api.getProductStock(),
        api.getPerishableAlerts(),
      ]);
      setStocks(data);
      setAlerts(alertData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
    api.getSuppliers().then(setSuppliers).catch(console.error);
  }, []);

  useEffect(() => { load(); }, [showLow]);

  const alertMap = new Map(alerts.map(a => [a.product_id, a]));

  const filtered = stocks.filter(p => {
    const matchCat = filterCat === "all" || p.category_id === filterCat;
    const term = search.toLowerCase();
    const matchQ = !term ||
                   p.name.toLowerCase().includes(term) ||
                   (p.barcode ?? "").includes(term) ||
                   (p.internal_code ?? "").includes(term);
    return matchCat && matchQ;
  });

  const catOpts = [
    { id: "all", label: "All Categories" },
    ...categories.map(c => ({ id: c.id, label: c.name }))
  ] as any;

  const lowCount = stocks.filter(p => p.low_stock_flag).length;

  const statusOpts = [
    { id: "all", label: "All Stock" },
    { id: "low", label: `Low Stock${lowCount > 0 ? ` (${lowCount})` : ""}` },
  ] as any;

  const handleSaved = () => {
    setShowAdd(false); setEditing(null); setAdjusting(null); setWasting(null); setViewingHistory(null);
    load();
  };

  const toggleFreeze = async (p: ProductStock) => {
    try { await api.toggleProductFrozen(p.product_id); load(); } catch (e) { console.error(e); }
  };

  const handleDeactivate = async () => {
    if (!confirmDeact) return;
    try { await api.deactivateProduct(confirmDeact.product_id); setConfirmDeact(null); load(); } catch (e) { console.error(e); }
  };

  const openWasteById = (id: number) => {
    const p = stocks.find(s => s.product_id === id);
    if (p) setWasting(p);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-deep)] text-[var(--tx-base)] relative z-10">
      {/* Header */}
      <PageHeader
        icon={<Package size={22} className="text-[#14B8A6]" />}
        title={t("inventory.title")}
        subtitle={t("pos.products", { count: stocks.length })}
        actions={
          <>
            <button onClick={load} className="w-12 h-12 rounded-2xl bg-[var(--bg-panel)] border border-[var(--bd-base)] text-slate-500 hover:text-[var(--tx-base)] hover:border-[var(--tx-base)] shadow-sm flex items-center justify-center transition-all cursor-pointer active:scale-95">
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-6 py-3 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-black text-sm uppercase tracking-wider rounded-2xl shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] transition-all cursor-pointer active:scale-95"
            >
              <Plus size={18} />
              {t("inventory.addProduct")}
            </button>
          </>
        }
        searchBlock={
          <div className="relative group max-w-sm">
            <Search size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#14B8A6] transition-colors pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t("inventory.searchPlaceholder")}
              className="w-full ps-12 pe-4 py-3 bg-[var(--bg-panel)] border border-[var(--bd-base)] rounded-2xl text-[var(--tx-base)] text-sm font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] shadow-sm transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute end-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--tx-base)] cursor-pointer">
                <X size={15} />
              </button>
            )}
          </div>
        }
        filtersBlock={
          <>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Filter size={13} />
            </div>
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="px-4 py-2 bg-[var(--bg-panel)] border border-[var(--bd-base)] rounded-xl text-[var(--tx-base)] text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-[#14B8A6] shadow-sm appearance-none pr-8 cursor-pointer relative"
            >
              {catOpts.map((o: any) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <div className="w-px h-5 bg-[var(--bd-base)]" />
            <PillGroup
              options={statusOpts}
              value={showLow ? "low" : "all"}
              onChange={(v) => setShowLow(v === "low")}
            />
          </>
        }
      />

      {/* Perishable alerts banner */}
      <PerishableBanner alerts={alerts} onWaste={openWasteById} />

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
            <p className="text-slate-500 text-lg font-medium">{search ? t("inventory.noResults") : t("inventory.noProducts")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(p => {
              const alert = alertMap.get(p.product_id);
              const color = catColor(p.category_id ?? null);
              
              return (
                <div
                  key={p.product_id}
                  className={`group relative h-52 text-left rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between overflow-hidden ${
                    p.is_frozen
                      ? "opacity-50 bg-[var(--bg-base)] border border-[var(--bd-base)] grayscale"
                      : "bg-[var(--bg-panel)] border border-[var(--bd-base)] hover:border-[var(--tx-base)] hover:shadow-xl"
                  }`}
                >
                  {/* Subtle category hint line */}
                  {!p.is_frozen && (
                    <div className="absolute top-0 left-6 right-6 h-[2px] opacity-20 transition-opacity group-hover:opacity-100" style={{ backgroundColor: color }} />
                  )}

                  {/* Top content */}
                  <div className="flex-1 pr-1 cursor-pointer" onClick={() => setEditing(p)}>
                    <div className="flex justify-between items-start">
                      <p className="text-lg font-bold leading-tight line-clamp-2 text-[var(--tx-base)] max-w-[85%]">
                        {p.name}
                      </p>
                      {p.is_perishable && (
                        <Flame size={16} className="text-orange-400 flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 truncate">
                        {p.category_name ?? "—"}
                      </span>
                      {p.low_stock_flag && <TrendingDown size={14} className="text-amber-500 flex-shrink-0" />}
                    </div>
                  </div>

                  {/* Middle metrics */}
                  <div className="mt-auto mb-3 flex items-end justify-between z-0 cursor-pointer" onClick={() => setEditing(p)}>
                    <div>
                      <div className={`text-3xl font-black tabular-nums tracking-tight leading-none ${stockColor(p.stock_qty, p.min_stock)}`}>
                        {p.stock_qty}
                      </div>
                      <div className="text-xs font-bold uppercase tracking-widest mt-1 text-slate-500 flex items-center gap-1.5">
                        {p.unit}
                        {alert && (
                          <div className="scale-75 origin-left -ml-1">
                            {expiryBadge(alert.days_until_expiry)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-[var(--tx-base)] font-bold tabular-nums">
                        {fmt(p.sell_price_retail)}
                      </div>
                      <div className="text-slate-500 text-xs tabular-nums mt-0.5">
                        {t("inventory.columns.cost")}: {fmt(p.cost_price)}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons (Always visible for touch, moved to bottom) */}
                  <div className="pt-3 border-t border-[var(--bd-faint)] flex items-center gap-1.5 z-10 overflow-x-auto scrollbar-hide shrink-0">
                    {p.is_perishable && (
                      <button onClick={(e) => { e.stopPropagation(); setWasting(p); }} title="Log waste"
                        className="w-9 h-9 flex-shrink-0 rounded-xl bg-[var(--bg-raised)] hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer border border-[var(--bd-faint)]">
                        <Flame size={15} />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setAdjusting(p); }} title="Adjust stock"
                      className="w-9 h-9 flex-shrink-0 rounded-xl bg-[var(--bg-raised)] hover:bg-teal-500/20 text-slate-400 hover:text-[#14B8A6] flex items-center justify-center transition-colors cursor-pointer border border-[var(--bd-faint)]">
                      <Plus size={15} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setViewingHistory(p); }} title="Price history"
                      className="w-9 h-9 flex-shrink-0 rounded-xl bg-[var(--bg-raised)] hover:bg-violet-500/20 text-slate-400 hover:text-violet-400 flex items-center justify-center transition-colors cursor-pointer border border-[var(--bd-faint)]">
                      <History size={15} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleFreeze(p); }} title={p.is_frozen ? "Unfreeze" : "Freeze"}
                      className="w-9 h-9 flex-shrink-0 rounded-xl bg-[var(--bg-raised)] hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 flex items-center justify-center transition-colors cursor-pointer border border-[var(--bd-faint)]">
                      <Snowflake size={15} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeact(p); }} title="Deactivate"
                      className="w-9 h-9 flex-shrink-0 rounded-xl bg-[var(--bg-raised)] hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer border border-[var(--bd-faint)]">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <AddProductModal
          categories={categories} suppliers={suppliers} user={user}
          onClose={() => setShowAdd(false)} onSaved={handleSaved}
        />
      )}
      {editing && (
        <ProductFormModal
          initial={stockToPF(editing, fromDb)} editId={editing.product_id}
          categories={categories} suppliers={suppliers}
          userId={user.id}
          onClose={() => setEditing(null)} onSaved={handleSaved}
        />
      )}
      {viewingHistory && (
        <PriceHistoryModal product={viewingHistory} onClose={() => setViewingHistory(null)} />
      )}
      {adjusting && (
        <AdjustModal
          product={adjusting} userId={user.id}
          onClose={() => setAdjusting(null)} onSaved={handleSaved}
        />
      )}
      {wasting && (
        <WasteModal
          product={wasting} userId={user.id}
          onClose={() => setWasting(null)} onSaved={handleSaved}
        />
      )}
      {confirmDeact && (
        <Modal title="Deactivate Product" onClose={() => setConfirmDeact(null)}>
          <div className="p-6 space-y-4">
            <p className="text-slate-300 text-sm">
              Deactivate <strong className="text-[var(--tx-base)]">{confirmDeact.name}</strong>? It will no longer appear in the POS.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeact(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleDeactivate} className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 font-medium text-sm rounded-xl border border-red-500/20 transition-colors cursor-pointer">Deactivate</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
