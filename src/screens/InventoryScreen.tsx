import { useEffect, useState } from "react";
import {
  AlertTriangle, Package, Pencil, Plus, RefreshCw,
  Search, Snowflake, Trash2, TrendingDown,
} from "lucide-react";
import { api } from "../lib/api";
import { Category, ProductStock, Supplier, User } from "../types";
import Modal from "../components/Modal";

interface Props { user: User }

const fmt    = (n: number) => `$${(n / 100).toFixed(2)}`;
const orNull = (s: string) => s.trim() || null;
const toStr  = (n: number | null | undefined, decimals = 2) =>
  n == null ? "" : (n / 100).toFixed(decimals);
const toPct  = (f: number) => (f * 100).toFixed(1);

function stockColor(qty: number, min: number) {
  if (qty <= 0)   return "text-red-400";
  if (qty <= min && min > 0) return "text-amber-400";
  return "text-emerald-400";
}

// ── Product form state ─────────────────────────────────────────────────────────
interface PF {
  barcode: string; internal_code: string; name: string;
  category_id: string; supplier_id: string;
  item_type: string; unit: string; packaging_qty: string;
  cost_price: string; sell_price_retail: string;
  sell_price_wholesale: string; sell_price_special: string;
  tva_rate: string; apply_tva: boolean; apply_discount: boolean; sold_by_amount: boolean;
  min_stock: string; expiry_date: string;
}

const emptyPF: PF = {
  barcode: "", internal_code: "", name: "",
  category_id: "", supplier_id: "",
  item_type: "consumable", unit: "pcs", packaging_qty: "1",
  cost_price: "", sell_price_retail: "",
  sell_price_wholesale: "", sell_price_special: "",
  tva_rate: "0", apply_tva: false, apply_discount: true, sold_by_amount: false,
  min_stock: "0", expiry_date: "",
};

function stockToPF(p: ProductStock): PF {
  return {
    barcode:              p.barcode              ?? "",
    internal_code:        p.internal_code        ?? "",
    name:                 p.name,
    category_id:          p.category_id          != null ? String(p.category_id) : "",
    supplier_id:          p.supplier_id          != null ? String(p.supplier_id) : "",
    item_type:            p.item_type,
    unit:                 p.unit,
    packaging_qty:        String(p.packaging_qty),
    cost_price:           toStr(p.cost_price),
    sell_price_retail:    toStr(p.sell_price_retail),
    sell_price_wholesale: toStr(p.sell_price_wholesale),
    sell_price_special:   toStr(p.sell_price_special),
    tva_rate:             toPct(p.tva_rate),
    apply_tva:            p.apply_tva,
    apply_discount:       p.apply_discount,
    sold_by_amount:       p.sold_by_amount,
    min_stock:            String(p.min_stock),
    expiry_date:          p.expiry_date ?? "",
  };
}

function pfToPayload(f: PF) {
  const c = (s: string) => Math.round(parseFloat(s || "0") * 100);
  return {
    barcode:              orNull(f.barcode),
    internal_code:        orNull(f.internal_code),
    name:                 f.name.trim(),
    category_id:          f.category_id ? Number(f.category_id) : null,
    supplier_id:          f.supplier_id ? Number(f.supplier_id) : null,
    item_type:            f.item_type   || "consumable",
    unit:                 f.unit        || "pcs",
    packaging_qty:        parseInt(f.packaging_qty || "1"),
    cost_price:           c(f.cost_price),
    sell_price_retail:    c(f.sell_price_retail),
    sell_price_wholesale: c(f.sell_price_wholesale),
    sell_price_special:   c(f.sell_price_special),
    tva_rate:             parseFloat(f.tva_rate || "0") / 100,
    apply_tva:            f.apply_tva,
    apply_discount:       f.apply_discount,
    sold_by_amount:       f.sold_by_amount,
    min_stock:            parseFloat(f.min_stock || "0"),
    expiry_date:          orNull(f.expiry_date),
  };
}

// ── Reusable input ─────────────────────────────────────────────────────────────
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

const iCls = "w-full px-3 py-2 bg-[#131F35] border border-[#1E3050] focus:border-[#14B8A6]/50 focus:outline-none rounded-xl text-white text-sm placeholder-slate-600 transition-colors";
const selCls = iCls + " cursor-pointer";

// ── Toggle ─────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 cursor-pointer group"
    >
      <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${checked ? "bg-[#14B8A6]" : "bg-[#1A2A44] border border-[#1E3050]"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-4" : "left-0.5"}`} />
      </div>
      <span className="text-sm text-slate-400 group-hover:text-slate-300">{label}</span>
    </button>
  );
}

// ── Product Form Modal ─────────────────────────────────────────────────────────
function ProductFormModal({
  initial, editId, categories, suppliers, onClose, onSaved,
}: {
  initial: PF; editId: number | null;
  categories: Category[]; suppliers: Supplier[];
  onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<PF>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof PF) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) { setError("Name is required"); return; }
    if (!f.sell_price_retail) { setError("Retail price is required"); return; }
    setSaving(true); setError("");
    try {
      const payload = pfToPayload(f);
      if (editId != null) {
        await api.updateProduct(editId, payload);
      } else {
        await api.createProduct(payload);
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? String(err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editId != null ? "Edit Product" : "Add Product"} onClose={onClose} width="max-w-2xl">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Basic */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Product Name" required>
            <input className={iCls} value={f.name} onChange={set("name")} placeholder="e.g. Marlboro Red" />
          </Field>
          <Field label="Barcode">
            <input className={iCls} value={f.barcode} onChange={set("barcode")} placeholder="EAN-13 / UPC" />
          </Field>
          <Field label="Internal Code">
            <input className={iCls} value={f.internal_code} onChange={set("internal_code")} placeholder="SKU / store code" />
          </Field>
          <Field label="Item Type">
            <select className={selCls} value={f.item_type} onChange={set("item_type")}>
              <option value="consumable">Consumable</option>
              <option value="non_consumable">Non-consumable</option>
              <option value="service">Service</option>
            </select>
          </Field>
        </div>

        {/* Classification */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Category">
            <select className={selCls} value={f.category_id} onChange={set("category_id")}>
              <option value="">— None —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Supplier">
            <select className={selCls} value={f.supplier_id} onChange={set("supplier_id")}>
              <option value="">— None —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Unit">
            <input className={iCls} value={f.unit} onChange={set("unit")} placeholder="pcs / kg / L / box" />
          </Field>
        </div>

        {/* Pricing */}
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Pricing (in $)</p>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Cost Price" required>
              <input className={iCls} type="number" min="0" step="0.01" value={f.cost_price} onChange={set("cost_price")} placeholder="0.00" />
            </Field>
            <Field label="Retail" required>
              <input className={iCls} type="number" min="0" step="0.01" value={f.sell_price_retail} onChange={set("sell_price_retail")} placeholder="0.00" />
            </Field>
            <Field label="Wholesale">
              <input className={iCls} type="number" min="0" step="0.01" value={f.sell_price_wholesale} onChange={set("sell_price_wholesale")} placeholder="0.00" />
            </Field>
            <Field label="Special">
              <input className={iCls} type="number" min="0" step="0.01" value={f.sell_price_special} onChange={set("sell_price_special")} placeholder="0.00" />
            </Field>
          </div>
        </div>

        {/* Tax, Toggles, Stock */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="TVA Rate (%)">
            <input className={iCls} type="number" min="0" max="100" step="0.1" value={f.tva_rate} onChange={set("tva_rate")} placeholder="0" />
          </Field>
          <Field label="Min Stock (reorder level)">
            <input className={iCls} type="number" min="0" step="1" value={f.min_stock} onChange={set("min_stock")} placeholder="0" />
          </Field>
          <Field label="Pkg Qty">
            <input className={iCls} type="number" min="1" step="1" value={f.packaging_qty} onChange={set("packaging_qty")} placeholder="1" />
          </Field>
          <Field label="Expiry Date (optional)">
            <input className={iCls} type="date" value={f.expiry_date} onChange={set("expiry_date")} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-5 pt-1">
          <Toggle checked={f.apply_tva}     onChange={v => setF(p => ({ ...p, apply_tva: v }))}     label="Apply TVA" />
          <Toggle checked={f.apply_discount} onChange={v => setF(p => ({ ...p, apply_discount: v }))} label="Discountable" />
          <Toggle checked={f.sold_by_amount} onChange={v => setF(p => ({ ...p, sold_by_amount: v }))} label="Sell by amount" />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-[#1E3050]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-[#1A2A44] transition-colors cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Adjust Stock" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="bg-[#131F35] border border-[#1E3050] rounded-xl px-4 py-3">
          <p className="text-white font-medium">{product.name}</p>
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
                  className="px-2.5 py-1 bg-[#131F35] border border-[#1E3050] hover:border-[#14B8A6]/40 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer">
                  +{p}
                </button>
              ))}
              {presets.map(p => (
                <button key={-p} type="button" onClick={() => setDelta(String(-p))}
                  className="px-2.5 py-1 bg-[#131F35] border border-[#1E3050] hover:border-red-500/40 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer">
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

        <div className="flex justify-end gap-2 pt-2 border-t border-[#1E3050]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-[#1A2A44] transition-colors cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Saving…" : "Apply"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function InventoryScreen({ user }: Props) {
  const [stocks, setStocks]         = useState<ProductStock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [search, setSearch]         = useState("");
  const [showLow, setShowLow]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [adjusting, setAdjusting]   = useState<ProductStock | null>(null);
  const [editing, setEditing]       = useState<ProductStock | null>(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [confirmDeact, setConfirmDeact] = useState<ProductStock | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = showLow ? await api.getLowStock() : await api.getProductStock();
      setStocks(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
    api.getSuppliers().then(setSuppliers).catch(console.error);
  }, []);

  useEffect(() => { load(); }, [showLow]);

  const filtered = search.trim()
    ? stocks.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode ?? "").includes(search) ||
        (p.internal_code ?? "").includes(search))
    : stocks;

  const handleSaved = () => {
    setShowAdd(false); setEditing(null); setAdjusting(null);
    load();
  };

  const toggleFreeze = async (p: ProductStock) => {
    try { await api.toggleProductFrozen(p.product_id); load(); } catch (e) { console.error(e); }
  };

  const handleDeactivate = async () => {
    if (!confirmDeact) return;
    try { await api.deactivateProduct(confirmDeact.product_id); setConfirmDeact(null); load(); } catch (e) { console.error(e); }
  };

  const lowCount = stocks.filter(p => p.low_stock_flag).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1E3050] bg-[#0D1526]">
        <div>
          <h1 className="text-white font-semibold text-base">Inventory</h1>
          <p className="text-slate-500 text-xs">{stocks.length} products</p>
        </div>
        <div className="flex-1" />

        {/* Low stock badge */}
        {lowCount > 0 && (
          <button
            onClick={() => setShowLow(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${showLow ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-[#131F35] border border-[#1E3050] text-amber-400 hover:border-amber-500/30"}`}
          >
            <AlertTriangle size={12} />
            {lowCount} low stock
          </button>
        )}

        {/* Search */}
        <div className="relative w-56">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-8 pr-3 py-1.5 bg-[#131F35] border border-[#1E3050] focus:border-[#14B8A6]/50 focus:outline-none rounded-xl text-white text-sm placeholder-slate-600 transition-colors"
          />
        </div>

        <button onClick={load} className="w-8 h-8 rounded-xl bg-[#131F35] border border-[#1E3050] text-slate-500 hover:text-white flex items-center justify-center transition-colors cursor-pointer">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>

        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
        >
          <Plus size={15} />
          Add Product
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="sticky top-0 bg-[#0A1020] border-b border-[#1E3050] z-10">
            <tr>
              {["Product", "Category", "Stock", "Cost", "Retail", "Status", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-[#1E3050]/40">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-[#131F35] rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-slate-600">
                  <Package size={36} strokeWidth={1} className="mx-auto mb-2" />
                  <p>{search ? "No results" : "No products yet"}</p>
                </td>
              </tr>
            ) : filtered.map(p => (
              <tr key={p.product_id} className="border-b border-[#1E3050]/40 hover:bg-[#131F35]/40 transition-colors group">
                <td className="px-4 py-3">
                  <div className="text-white font-medium leading-tight">{p.name}</div>
                  <div className="text-slate-600 text-xs mt-0.5 tabular">
                    {p.barcode ?? p.internal_code ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {p.category_name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-semibold tabular ${stockColor(p.stock_qty, p.min_stock)}`}>
                    {p.stock_qty}
                  </span>
                  <span className="text-slate-600 text-xs ml-1">{p.unit}</span>
                  {p.low_stock_flag && (
                    <TrendingDown size={12} className="inline ml-1.5 text-amber-400" />
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 tabular text-xs">{fmt(p.cost_price)}</td>
                <td className="px-4 py-3 text-[#14B8A6] font-medium tabular">{fmt(p.sell_price_retail)}</td>
                <td className="px-4 py-3">
                  {p.is_frozen ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs rounded-full">
                      <Snowflake size={10} /> Frozen
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-full">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setAdjusting(p)} title="Adjust stock"
                      className="w-7 h-7 rounded-lg bg-[#1A2A44] hover:bg-[#243558] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer">
                      <Plus size={13} />
                    </button>
                    <button onClick={() => setEditing(p)} title="Edit product"
                      className="w-7 h-7 rounded-lg bg-[#1A2A44] hover:bg-[#243558] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => toggleFreeze(p)} title={p.is_frozen ? "Unfreeze" : "Freeze"}
                      className="w-7 h-7 rounded-lg bg-[#1A2A44] hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 flex items-center justify-center transition-colors cursor-pointer">
                      <Snowflake size={13} />
                    </button>
                    <button onClick={() => setConfirmDeact(p)} title="Deactivate"
                      className="w-7 h-7 rounded-lg bg-[#1A2A44] hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showAdd && (
        <ProductFormModal
          initial={emptyPF} editId={null}
          categories={categories} suppliers={suppliers}
          onClose={() => setShowAdd(false)} onSaved={handleSaved}
        />
      )}
      {editing && (
        <ProductFormModal
          initial={stockToPF(editing)} editId={editing.product_id}
          categories={categories} suppliers={suppliers}
          onClose={() => setEditing(null)} onSaved={handleSaved}
        />
      )}
      {adjusting && (
        <AdjustModal
          product={adjusting} userId={user.id}
          onClose={() => setAdjusting(null)} onSaved={handleSaved}
        />
      )}
      {confirmDeact && (
        <Modal title="Deactivate Product" onClose={() => setConfirmDeact(null)}>
          <div className="p-6 space-y-4">
            <p className="text-slate-300 text-sm">
              Deactivate <strong className="text-white">{confirmDeact.name}</strong>? It will no longer appear in the POS.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeact(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-[#1A2A44] transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleDeactivate} className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 font-medium text-sm rounded-xl border border-red-500/20 transition-colors cursor-pointer">Deactivate</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
