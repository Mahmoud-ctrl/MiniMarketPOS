import { useEffect, useState } from "react";
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
  new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Purchase["status"] }) {
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-full">
        Pending
      </span>
    );
  if (status === "received")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-full">
        <CheckCircle size={10} /> Received
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-500/10 border border-slate-500/20 text-slate-500 text-xs rounded-full">
      <XCircle size={10} /> Cancelled
    </span>
  );
}

// ── Shared input styles ────────────────────────────────────────────────────────
const iCls = "w-full px-3 py-2 bg-[#131F35] border border-[#1E3050] focus:border-[#14B8A6]/50 focus:outline-none rounded-xl text-white text-sm placeholder-slate-600 transition-colors";
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

  // Product search — covers name, barcode, and internal code on the backend
  useEffect(() => {
    if (!productSearch.trim() && !catId) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      api.getProducts({
        search:      productSearch.trim() || undefined,
        category_id: catId ? Number(catId) : undefined,
        limit:       10,
      })
        .then(setSearchResults)
        .catch(console.error);
    }, 200);
    return () => clearTimeout(t);
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
    if (lines.length === 0) { setError("Add at least one item"); return; }
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
    <Modal title="New Purchase Order" onClose={onClose} width="max-w-3xl">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">

        {/* Header fields */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Supplier</label>
            <select className={selCls} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">— None —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Reference / Invoice No.</label>
            <input className={iCls} value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="INV-2024-001" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <input className={iCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
          </div>
        </div>

        {/* Product search */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Add Item</label>
          <div className="flex gap-2">
            {/* Category filter */}
            <CategorySelect
              value={catId}
              onChange={v => { setCatId(v); setShowDropdown(true); }}
              categories={categories}
              className={`${selCls} w-44 flex-shrink-0`}
              placeholder="All categories"
            />

            {/* Search input */}
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                className={`${iCls} pl-8`}
                value={productSearch}
                onChange={e => { setProductSearch(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search by name, barcode or SKU…"
                autoComplete="off"
              />

              {/* Results dropdown */}
              {showDropdown && (searchResults.length > 0 || (productSearch.trim() && searchResults.length === 0)) && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-[#0C1828] border border-[#1A2D45] rounded-xl shadow-2xl overflow-hidden">
                  {searchResults.length === 0 ? (
                    <p className="px-4 py-3 text-slate-500 text-sm">No products found</p>
                  ) : searchResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={() => addProduct(p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#131F35] transition-colors text-left cursor-pointer"
                    >
                      <div>
                        <p className="text-white text-sm">{p.name}</p>
                        <p className="text-slate-500 text-xs">
                          {p.unit}
                          {p.barcode ? ` · ${p.barcode}` : ""}
                          {p.internal_code ? ` · ${p.internal_code}` : ""}
                          {" · "}Cost: {fmt(p.cost_price)}
                        </p>
                      </div>
                      <Plus size={14} className="text-[#14B8A6] flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Category browse: show results on category select even without text */}
          {showDropdown && !productSearch.trim() && catId && searchResults.length > 0 && (
            <div className="mt-1 bg-[#0C1828] border border-[#1A2D45] rounded-xl shadow-2xl overflow-hidden">
              {searchResults.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={() => addProduct(p)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#131F35] transition-colors text-left cursor-pointer"
                >
                  <div>
                    <p className="text-white text-sm">{p.name}</p>
                    <p className="text-slate-500 text-xs">
                      {p.unit}
                      {p.barcode ? ` · ${p.barcode}` : ""}
                      · Cost: {fmt(p.cost_price)}
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
          <div className="rounded-xl border border-[#1E3050] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0A1020] border-b border-[#1E3050]">
                <tr>
                  {["Product", "Unit", "Qty", "Unit Cost ($)", "Subtotal", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const subtotal = toDb(String(parseFloat(l.quantity || "0") * parseFloat(l.unit_cost || "0")));
                  return (
                    <tr key={l.product.id} className="border-b border-[#1E3050]/40">
                      <td className="px-3 py-2.5">
                        <p className="text-white font-medium">{l.product.name}</p>
                        {l.product.barcode && <p className="text-slate-600 text-xs">{l.product.barcode}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 text-xs">{l.product.unit}</td>
                      <td className="px-3 py-2.5 w-24">
                        <input
                          type="number" min="0.01" step="any"
                          className={iCls}
                          value={l.quantity}
                          onChange={e => updateLine(i, "quantity", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2.5 w-32">
                        <input
                          type="number" min="0" step={inputStep}
                          className={iCls}
                          value={l.unit_cost}
                          onChange={e => updateLine(i, "unit_cost", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-[#14B8A6] font-medium tabular">
                        {fmt(subtotal)}
                      </td>
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
              <tfoot className="bg-[#0A1020] border-t border-[#1E3050]">
                <tr>
                  <td colSpan={4} className="px-3 py-2.5 text-right text-sm text-slate-400 font-medium">Total</td>
                  <td className="px-3 py-2.5 text-[#14B8A6] font-bold">{fmt(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-[#1E3050]">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-[#1A2A44] transition-colors cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Creating…" : "Create Purchase Order"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Receive Confirm Modal ──────────────────────────────────────────────────────
function ReceiveModal({
  purchase, user, onClose, onSaved,
}: { purchase: Purchase; user: User; onClose: () => void; onSaved: () => void }) {
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
    <Modal title="Confirm Receipt" onClose={onClose} width="max-w-lg">
      <div className="p-6 space-y-4">
        <div className="bg-[#131F35] border border-[#1E3050] rounded-xl px-4 py-3 space-y-0.5">
          <p className="text-white font-medium">
            PO #{purchase.id}{purchase.reference_no ? ` · ${purchase.reference_no}` : ""}
          </p>
          {purchase.supplier_name && (
            <p className="text-slate-400 text-sm">{purchase.supplier_name}</p>
          )}
        </div>

        {detail ? (
          <div className="rounded-xl border border-[#1E3050] overflow-hidden text-sm">
            <table className="w-full">
              <thead className="bg-[#0A1020] border-b border-[#1E3050]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-slate-500 uppercase">Product</th>
                  <th className="px-3 py-2 text-right text-xs text-slate-500 uppercase">Qty</th>
                  <th className="px-3 py-2 text-right text-xs text-slate-500 uppercase">Unit Cost</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item: PurchaseItem) => (
                  <tr key={item.id} className="border-b border-[#1E3050]/40">
                    <td className="px-3 py-2.5 text-white">{item.product_name}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400 tabular">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[#14B8A6] tabular">
                      {fmt(item.unit_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-20 bg-[#131F35] border border-[#1E3050] rounded-xl animate-pulse" />
        )}

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 text-xs text-emerald-400 space-y-1">
          <p>✓ Stock will be added for all items</p>
          <p>✓ Product cost prices will update to delivery unit costs</p>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex justify-end gap-2 pt-1 border-t border-[#1E3050]">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-[#1A2A44] transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={saving || !detail}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Receiving…" : "Confirm Receipt"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Detail Modal ───────────────────────────────────────────────────────────────
function DetailModal({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const { fmt } = useCurrency();
  const [detail, setDetail] = useState<PurchaseWithItems | null>(null);

  useEffect(() => {
    api.getPurchaseById(purchase.id).then(setDetail).catch(console.error);
  }, [purchase.id]);

  return (
    <Modal title={`Purchase Order #${purchase.id}`} onClose={onClose} width="max-w-lg">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Supplier</p>
            <p className="text-white">{purchase.supplier_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Reference</p>
            <p className="text-white">{purchase.reference_no ?? "—"}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Created</p>
            <p className="text-white">{fmtDate(purchase.created_at)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Received</p>
            <p className="text-white">{purchase.received_at ? fmtDate(purchase.received_at) : "—"}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Status</p>
            <StatusBadge status={purchase.status} />
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total</p>
            <p className="text-[#14B8A6] font-bold">{fmt(purchase.total_amount)}</p>
          </div>
        </div>

        {purchase.notes && (
          <div className="bg-[#131F35] border border-[#1E3050] rounded-xl px-4 py-3 text-sm text-slate-400">
            {purchase.notes}
          </div>
        )}

        {detail ? (
          <div className="rounded-xl border border-[#1E3050] overflow-hidden text-sm">
            <table className="w-full">
              <thead className="bg-[#0A1020] border-b border-[#1E3050]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-slate-500 uppercase">Product</th>
                  <th className="px-3 py-2 text-right text-xs text-slate-500 uppercase">Qty</th>
                  <th className="px-3 py-2 text-right text-xs text-slate-500 uppercase">Unit Cost</th>
                  <th className="px-3 py-2 text-right text-xs text-slate-500 uppercase">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item: PurchaseItem) => (
                  <tr key={item.id} className="border-b border-[#1E3050]/40">
                    <td className="px-3 py-2.5 text-white">{item.product_name}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400 tabular">{item.quantity} {item.unit}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300 tabular">{fmt(item.unit_cost)}</td>
                    <td className="px-3 py-2.5 text-right text-[#14B8A6] tabular">{fmt(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-20 bg-[#131F35] border border-[#1E3050] rounded-xl animate-pulse" />
        )}

        <div className="flex justify-end pt-1 border-t border-[#1E3050]">
          <button onClick={onClose}
            className="px-5 py-2 bg-[#131F35] hover:bg-[#1A2A44] text-slate-300 text-sm rounded-xl transition-colors cursor-pointer">
            Close
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
    <Modal title="Void Purchase" onClose={onClose} width="max-w-sm">
      <div className="p-6 space-y-4">
        <p className="text-slate-300 text-sm">
          Void PO #{purchase.id}
          {purchase.reference_no ? ` (${purchase.reference_no})` : ""}?
          This will reverse all stock movements from this delivery.
        </p>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400 space-y-1">
          <p>⚠ Stock will be deducted for all items</p>
          <p>⚠ Product cost prices will not be reverted automatically</p>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-1 border-t border-[#1E3050]">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-[#1A2A44] transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={handleVoid} disabled={saving}
            className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Voiding…" : "Void Purchase"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function PurchasesScreen({ user }: Props) {
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1E3050] bg-[#0D1526]">
        <div>
          <h1 className="text-white font-semibold text-base flex items-center gap-2">
            <Truck size={16} className="text-[#14B8A6]" /> Purchases
          </h1>
          <p className="text-slate-500 text-xs">{purchases.length} orders</p>
        </div>
        <div className="flex-1" />

        {/* Status filter pills */}
        <div className="flex items-center gap-1">
          {(["all", "pending", "received", "cancelled"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer capitalize ${
                statusFilter === s
                  ? "bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/30"
                  : "text-slate-500 hover:text-slate-300 border border-transparent hover:border-[#1E3050]"
              }`}
            >
              {s === "all" ? "All" : `${s.charAt(0).toUpperCase() + s.slice(1)} ${counts[s] > 0 ? `(${counts[s]})` : ""}`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-48">
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
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
        >
          <Plus size={15} /> New PO
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="sticky top-0 bg-[#0A1020] border-b border-[#1E3050] z-10">
            <tr>
              {["Date", "Supplier", "Reference", "Items", "Total", "Status", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
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
                  <p>{search || statusFilter !== "all" ? "No results" : "No purchase orders yet"}</p>
                </td>
              </tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-b border-[#1E3050]/40 hover:bg-[#131F35]/40 transition-colors group">
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                  {fmtDate(p.created_at)}
                </td>
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{p.supplier_name ?? <span className="text-slate-600">—</span>}</p>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {p.reference_no ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {/* We don't load items in list — show total instead */}
                  <ChevronDown size={12} className="inline mr-1 text-slate-600" />
                  <button onClick={() => setViewing(p)} className="text-[#14B8A6] hover:underline cursor-pointer text-xs">
                    View items
                  </button>
                </td>
                <td className="px-4 py-3 text-[#14B8A6] font-medium tabular">
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
                          Receive
                        </button>
                        <button
                          onClick={() => handleCancel(p)}
                          className="px-2.5 py-1 text-xs bg-[#1A2A44] hover:bg-red-500/10 border border-[#1E3050] hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {p.status === "received" && (
                      <button
                        onClick={() => setVoiding(p)}
                        className="px-2.5 py-1 text-xs bg-[#1A2A44] hover:bg-red-500/10 border border-[#1E3050] hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                      >
                        Void
                      </button>
                    )}
                    <button
                      onClick={() => setViewing(p)}
                      className="px-2.5 py-1 text-xs bg-[#1A2A44] hover:bg-[#243558] border border-[#1E3050] text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    >
                      View
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500/30 text-red-300 text-sm px-5 py-3 rounded-xl shadow-2xl z-50">
          {cancelError}
          <button onClick={() => setCancelError("")} className="ml-3 text-red-400 hover:text-white cursor-pointer">✕</button>
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
