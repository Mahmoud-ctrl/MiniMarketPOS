import { useState } from "react";
import { ArrowLeft, ArrowRight, Box, RefreshCw, Scale, Zap } from "lucide-react";
import { api } from "../lib/api";
import { Category, Supplier, User } from "../types";
import Modal from "../components/Modal";
import CategorySelect from "../components/CategorySelect";
import { generateEAN13 } from "../lib/barcode";
import { useCurrency } from "../context/CurrencyContext";

interface CommonProps {
  categories: Category[];
  suppliers:  Supplier[];
  user:       User;
  onBack:     () => void;
  onClose:    () => void;
  onSaved:    () => void;
}

type Mode = "picker" | "quick" | "box" | "weighed";

function parseDbError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err);
  if (msg.includes("products_barcode_key"))
    return "This barcode is already in use — generate a new one or leave it blank.";
  if (msg.includes("products_internal_code_key"))
    return "This internal code is already in use — use a different one or leave it blank.";
  return msg;
}

const iCls  = "w-full px-3 py-2 bg-[#131F35] border border-[#1E3050] focus:border-[#14B8A6]/50 focus:outline-none rounded-xl text-white text-sm placeholder-slate-600 transition-colors";
const selCls = iCls + " cursor-pointer";
const roiCls = "w-full px-3 py-2 bg-[#0D1526] border border-[#1E3050] rounded-xl text-slate-400 text-sm";

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

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 cursor-pointer group">
      <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${checked ? "bg-[#14B8A6]" : "bg-[#1A2A44] border border-[#1E3050]"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-4" : "left-0.5"}`} />
      </div>
      <span className="text-sm text-slate-400 group-hover:text-slate-300">{label}</span>
    </button>
  );
}

function BarcodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <input className={iCls} value={value} onChange={e => onChange(e.target.value)} placeholder="Scan or type barcode" />
      <button
        type="button"
        onClick={() => onChange(generateEAN13())}
        title="Auto-generate EAN-13"
        className="flex-shrink-0 px-3 py-2 bg-[#131F35] border border-[#1E3050] hover:border-[#14B8A6]/50 text-slate-400 hover:text-[#14B8A6] rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
      >
        <RefreshCw size={12} /> Gen
      </button>
    </div>
  );
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all ${i + 1 === step ? "w-6 h-2 bg-[#14B8A6]" : i + 1 < step ? "w-2 h-2 bg-[#14B8A6]/50" : "w-2 h-2 bg-[#1E3050]"}`}
        />
      ))}
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors cursor-pointer">
      <ArrowLeft size={13} /> Back
    </button>
  );
}

function FormFooter({ onClose, saving, label }: { onClose: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-3 border-t border-[#1E3050]">
      <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-[#1A2A44] transition-colors cursor-pointer">
        Cancel
      </button>
      <button type="submit" disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
        {saving ? "Saving…" : label}
      </button>
    </div>
  );
}

// ── Mode Picker ──────────────────────────────────────────────────────────────────
function ModePicker({ onSelect }: { onSelect: (m: Mode) => void }) {
  const modes: { id: Mode; Icon: React.ElementType; label: string; desc: string }[] = [
    { id: "quick",   Icon: Zap,   label: "Quick Item",     desc: "Known unit price — drinks, cigarettes, packaged goods" },
    { id: "box",     Icon: Box,   label: "Box Import",     desc: "Pay for a box, calculate per-unit cost and price automatically" },
    { id: "weighed", Icon: Scale, label: "Weighed / Bulk", desc: "Sold by weight or volume — fruits, vegetables, bulk goods" },
  ];
  return (
    <div className="p-6 space-y-3">
      <p className="text-slate-400 text-sm mb-1">How is this product sold?</p>
      {modes.map(({ id, Icon, label, desc }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className="w-full flex items-start gap-4 p-4 bg-[#131F35] border border-[#1E3050] hover:border-[#14B8A6]/40 hover:bg-[#1A2A44] rounded-2xl text-left transition-all group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#14B8A6]/20 transition-colors">
            <Icon size={17} className="text-[#14B8A6]" />
          </div>
          <div>
            <p className="text-white font-medium text-sm">{label}</p>
            <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Mode 1: Quick Item ───────────────────────────────────────────────────────────
function QuickItemForm({ categories, suppliers, user, onBack, onClose, onSaved }: CommonProps) {
  const { toDb, inputStep } = useCurrency();
  const [f, setF] = useState({
    name: "", barcode: "", internal_code: "",
    category_id: "", supplier_id: "",
    item_type: "consumable", unit: "pcs",
    cost_price: "", sell_price_retail: "",
    sell_price_wholesale: "", sell_price_special: "",
    tva_rate: "0", apply_tva: false, apply_discount: true,
    opening_stock: "", min_stock: "0", expiry_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim())        { setError("Name is required");         return; }
    if (!f.sell_price_retail)  { setError("Retail price is required"); return; }
    setSaving(true); setError("");
    try {
      const product = await api.createProduct({
        barcode:              f.barcode.trim()        || null,
        internal_code:        f.internal_code.trim()  || null,
        name:                 f.name.trim(),
        category_id:          f.category_id ? Number(f.category_id) : null,
        supplier_id:          f.supplier_id ? Number(f.supplier_id) : null,
        item_type:            f.item_type,
        unit:                 f.unit || "pcs",
        cost_price:           toDb(f.cost_price),
        sell_price_retail:    toDb(f.sell_price_retail),
        sell_price_wholesale: toDb(f.sell_price_wholesale),
        sell_price_special:   toDb(f.sell_price_special),
        tva_rate:             parseFloat(f.tva_rate || "0") / 100,
        apply_tva:            f.apply_tva,
        apply_discount:       f.apply_discount,
        min_stock:            parseFloat(f.min_stock || "0"),
        expiry_date:          f.expiry_date || null,
      });
      // Product saved — close modal now. Stock adjustment is best-effort.
      onSaved();
      const qty = parseFloat(f.opening_stock || "0");
      if (qty > 0) {
        api.adjustInventory({
          product_id:     product.id,
          quantity_delta: qty,
          movement_type:  "opening",
          notes:          null,
          created_by:     user.id,
        }).catch(console.error);
      }
    } catch (err: unknown) {
      setError(parseDbError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <BackBtn onClick={onBack} />
        <span className="text-xs text-slate-500">Quick Item</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Product Name" required>
          <input className={iCls} value={f.name} onChange={set("name")} placeholder="e.g. Pepsi 330ml" autoFocus />
        </Field>
        <Field label="Unit">
          <input className={iCls} value={f.unit} onChange={set("unit")} placeholder="pcs / bottle / pack" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <CategorySelect
            value={f.category_id}
            onChange={v => setF(prev => ({ ...prev, category_id: v }))}
            categories={categories}
            className={selCls}
          />
        </Field>
        <Field label="Supplier">
          <select className={selCls} value={f.supplier_id} onChange={set("supplier_id")}>
            <option value="">— None —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Barcode">
          <BarcodeInput value={f.barcode} onChange={v => setF(p => ({ ...p, barcode: v }))} />
        </Field>
        <Field label="Internal Code">
          <input className={iCls} value={f.internal_code} onChange={set("internal_code")} placeholder="SKU / store code" />
        </Field>
      </div>

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Pricing</p>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Cost">
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
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Field label="Opening Stock">
          <input className={iCls} type="number" min="0" step="any" value={f.opening_stock} onChange={set("opening_stock")} placeholder="0" />
        </Field>
        <Field label="Min Stock">
          <input className={iCls} type="number" min="0" step="1" value={f.min_stock} onChange={set("min_stock")} placeholder="0" />
        </Field>
        <Field label="TVA Rate (%)">
          <input className={iCls} type="number" min="0" max="100" step="0.1" value={f.tva_rate} onChange={set("tva_rate")} placeholder="0" />
        </Field>
        <Field label="Expiry Date">
          <input className={iCls} type="date" value={f.expiry_date} onChange={set("expiry_date")} />
        </Field>
      </div>

      <div className="flex gap-5">
        <Toggle checked={f.apply_tva}     onChange={v => setF(p => ({ ...p, apply_tva: v }))}     label="Apply TVA on sale" />
        <Toggle checked={f.apply_discount} onChange={v => setF(p => ({ ...p, apply_discount: v }))} label="Discountable" />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      <FormFooter onClose={onClose} saving={saving} label="Add Product" />
    </form>
  );
}

// ── Mode 2: Box Import ───────────────────────────────────────────────────────────
interface BoxS1 {
  name: string; category_id: string; supplier_id: string;
  box_cost: string; units_per_box: string; boxes_received: string;
  apply_tva_purchase: boolean; tva_pct: string;
  create_box_product: boolean;
}
interface BoxS2 {
  pricing_mode: "price" | "margin";
  retail_str: string; margin_str: string;
  wholesale: string; special: string;
  box_sell: string; min_stock: string;
}
interface BoxS3 {
  unit_barcode: string; internal_code: string; box_barcode: string;
}

function BoxImportForm({ categories, suppliers, user, onBack, onClose, onSaved }: CommonProps) {
  const { scale, inputStep, fmtNum, symbol } = useCurrency();
  const [step, setStep] = useState(1);
  const [s1, setS1] = useState<BoxS1>({
    name: "", category_id: "", supplier_id: "",
    box_cost: "", units_per_box: "", boxes_received: "1",
    apply_tva_purchase: false, tva_pct: "19",
    create_box_product: false,
  });
  const [s2, setS2] = useState<BoxS2>({
    pricing_mode: "price", retail_str: "", margin_str: "",
    wholesale: "", special: "", box_sell: "", min_stock: "0",
  });
  const [s3, setS3] = useState<BoxS3>({ unit_barcode: "", internal_code: "", box_barcode: "" });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  // Live computations
  const boxCost      = parseFloat(s1.box_cost     || "0");
  const unitsPerBox  = Math.max(1, parseInt(s1.units_per_box  || "1") || 1);
  const boxesRcvd    = Math.max(1, parseInt(s1.boxes_received || "1") || 1);
  const tvaFactor    = s1.apply_tva_purchase ? 1 + parseFloat(s1.tva_pct || "0") / 100 : 1;
  const effectiveCost = boxCost * tvaFactor;
  const costPerUnit  = effectiveCost / unitsPerBox;

  const finalRetail = s2.pricing_mode === "price"
    ? parseFloat(s2.retail_str || "0")
    : costPerUnit * (1 + parseFloat(s2.margin_str || "0") / 100);

  const displayMargin = costPerUnit > 0 && finalRetail > 0
    ? (finalRetail / costPerUnit - 1) * 100
    : 0;

  const totalUnits = boxesRcvd * unitsPerBox;

  const switchMode = (m: "price" | "margin") => {
    if (m === s2.pricing_mode) return;
    if (m === "margin") {
      // pre-fill margin from current retail
      const mg = costPerUnit > 0 && parseFloat(s2.retail_str) > 0
        ? ((parseFloat(s2.retail_str) / costPerUnit - 1) * 100).toFixed(1)
        : s2.margin_str;
      setS2(p => ({ ...p, pricing_mode: "margin", margin_str: mg }));
    } else {
      // pre-fill retail from current margin
      const rt = costPerUnit > 0 && parseFloat(s2.margin_str) > 0
        ? (costPerUnit * (1 + parseFloat(s2.margin_str) / 100)).toFixed(2)
        : s2.retail_str;
      setS2(p => ({ ...p, pricing_mode: "price", retail_str: rt }));
    }
  };

  const validateStep1 = () => {
    if (!s1.name.trim())                               return "Product name is required";
    if (!s1.box_cost || parseFloat(s1.box_cost) <= 0) return "Box cost must be greater than 0";
    if (!s1.units_per_box || unitsPerBox < 1)         return "Units per box must be at least 1";
    return "";
  };

  const validateStep2 = () => {
    if (finalRetail <= 0) return "Retail price must be greater than 0";
    return "";
  };

  const goNext = () => {
    const err = step === 1 ? validateStep1() : step === 2 ? validateStep2() : "";
    if (err) { setError(err); return; }
    setError("");
    setStep(s => s + 1);
  };

  const goBack = () => { setError(""); setStep(s => s - 1); };

  const handleSubmit = async () => {
    setSaving(true); setError("");
    try {
      const c = (n: number) => Math.round(n * scale);

      // 1. Create unit product — critical, must succeed
      const unit = await api.createProduct({
        barcode:              s3.unit_barcode.trim() || null,
        internal_code:        s3.internal_code.trim() || null,
        name:                 s1.name.trim(),
        category_id:          s1.category_id ? Number(s1.category_id) : null,
        supplier_id:          s1.supplier_id ? Number(s1.supplier_id) : null,
        unit:                 "pcs",
        packaging_qty:        1,
        cost_price:           c(costPerUnit),
        sell_price_retail:    c(finalRetail),
        sell_price_wholesale: s2.wholesale ? c(parseFloat(s2.wholesale)) : 0,
        sell_price_special:   s2.special   ? c(parseFloat(s2.special))   : 0,
        min_stock:            parseFloat(s2.min_stock || "0"),
      });

      // Unit product saved — close modal now. Remaining steps are best-effort.
      onSaved();

      // 2. Add stock
      api.receiveStock({
        product_id: unit.id,
        quantity:   totalUnits,
        notes:      `Box import: ${boxesRcvd} box(es) × ${unitsPerBox} units`,
        created_by: user.id,
      }).catch(console.error);

      // 3. Optional box product
      if (s1.create_box_product) {
        const boxRetail = s2.box_sell
          ? c(parseFloat(s2.box_sell))
          : c(finalRetail * unitsPerBox);
        api.createProduct({
          barcode:           s3.box_barcode.trim() || null,
          name:              `${s1.name.trim()} ×${unitsPerBox}`,
          category_id:       s1.category_id ? Number(s1.category_id) : null,
          supplier_id:       s1.supplier_id ? Number(s1.supplier_id) : null,
          unit:              "box",
          packaging_qty:     unitsPerBox,
          cost_price:        c(effectiveCost),
          sell_price_retail: boxRetail,
          min_stock:         0,
        }).catch(console.error);
      }
    } catch (err: unknown) {
      const msg = parseDbError(err);
      setError(msg);
      if (msg.includes("barcode") || msg.includes("internal code")) {
        setStep(3);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <BackBtn onClick={step === 1 ? onBack : goBack} />
        <StepDots step={step} total={3} />
        <span className="text-xs text-slate-500">Box Import</span>
      </div>

      {/* ── Step 1: Purchase ── */}
      {step === 1 && (
        <div className="space-y-4">
          <Field label="Item Name (individual unit)" required>
            <input className={iCls} value={s1.name} onChange={e => setS1(p => ({ ...p, name: e.target.value }))} placeholder='e.g. "Pepsi 330ml"' autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <CategorySelect
                value={s1.category_id}
                onChange={v => setS1(p => ({ ...p, category_id: v }))}
                categories={categories}
                className={selCls}
              />
            </Field>
            <Field label="Supplier">
              <select className={selCls} value={s1.supplier_id} onChange={e => setS1(p => ({ ...p, supplier_id: e.target.value }))}>
                <option value="">— None —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label={`Box Cost — total paid (${symbol})`} required>
              <input className={iCls} type="number" min="0" step={inputStep} value={s1.box_cost} onChange={e => setS1(p => ({ ...p, box_cost: e.target.value }))} placeholder="12.00" />
            </Field>
            <Field label="Units per Box" required>
              <input className={iCls} type="number" min="1" step="1" value={s1.units_per_box} onChange={e => setS1(p => ({ ...p, units_per_box: e.target.value }))} placeholder="24" />
            </Field>
            <Field label="Boxes Received">
              <input className={iCls} type="number" min="1" step="1" value={s1.boxes_received} onChange={e => setS1(p => ({ ...p, boxes_received: e.target.value }))} placeholder="1" />
            </Field>
          </div>

          <div className="flex items-center gap-4">
            <Toggle checked={s1.apply_tva_purchase} onChange={v => setS1(p => ({ ...p, apply_tva_purchase: v }))} label="TVA on purchase" />
            {s1.apply_tva_purchase && (
              <div className="flex items-center gap-2">
                <input className={`${iCls} w-20`} type="number" min="0" max="100" step="0.1" value={s1.tva_pct} onChange={e => setS1(p => ({ ...p, tva_pct: e.target.value }))} />
                <span className="text-slate-400 text-sm">%</span>
              </div>
            )}
          </div>

          <div className="p-3 bg-[#131F35] border border-[#1E3050] rounded-xl space-y-2">
            <Toggle checked={s1.create_box_product} onChange={v => setS1(p => ({ ...p, create_box_product: v }))} label="Also sell as a box product (for wholesale)" />
            {s1.create_box_product && (
              <p className="text-xs text-slate-500 ml-11">
                Will create "<strong className="text-slate-300">{s1.name || "Product"} ×{s1.units_per_box || "N"}</strong>" as a separate sellable item
              </p>
            )}
          </div>

          {boxCost > 0 && (
            <div className="flex items-center gap-4 px-4 py-3 bg-[#0D1526] border border-[#1E3050] rounded-xl text-xs text-slate-400">
              <span>Cost/unit: <strong className="text-[#14B8A6]">{fmtNum(costPerUnit)}</strong></span>
              <span className="text-slate-600">·</span>
              <span>Total units: <strong className="text-white">{totalUnits}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Selling ── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Live strip */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[#0D1526] border border-[#1E3050] rounded-xl text-xs">
            <span className="text-slate-400">Cost/unit: <strong className="text-[#14B8A6]">{fmtNum(costPerUnit)}</strong></span>
            {finalRetail > 0 && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Margin: <strong className={displayMargin >= 0 ? "text-emerald-400" : "text-red-400"}>{displayMargin.toFixed(1)}%</strong></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Profit/unit: <strong className={finalRetail - costPerUnit >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtNum(finalRetail - costPerUnit)}</strong></span>
              </>
            )}
          </div>

          {/* Price / Margin toggle */}
          <div className="flex bg-[#131F35] border border-[#1E3050] rounded-xl p-1 w-fit">
            {(["price", "margin"] as const).map(m => (
              <button key={m} type="button" onClick={() => switchMode(m)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${s2.pricing_mode === m ? "bg-[#14B8A6] text-slate-900" : "text-slate-500 hover:text-slate-300"}`}>
                {m === "price" ? "Enter price" : "Enter margin %"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Retail Price per Unit (${symbol})`} required>
              {s2.pricing_mode === "price"
                ? <input className={iCls} type="number" min="0" step={inputStep} value={s2.retail_str} onChange={e => setS2(p => ({ ...p, retail_str: e.target.value }))} placeholder="0.00" autoFocus />
                : <input className={roiCls} readOnly value={finalRetail > 0 ? finalRetail.toFixed(2) : ""} placeholder="Calculated from margin" />
              }
            </Field>
            <Field label="Profit Margin (%)">
              {s2.pricing_mode === "margin"
                ? <input className={iCls} type="number" step="0.1" value={s2.margin_str} onChange={e => setS2(p => ({ ...p, margin_str: e.target.value }))} placeholder="50" autoFocus />
                : <input className={roiCls} readOnly value={costPerUnit > 0 && parseFloat(s2.retail_str) > 0 ? displayMargin.toFixed(1) : ""} placeholder="Calculated from price" />
              }
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Wholesale Price (${symbol}) — optional`}>
              <input className={iCls} type="number" min="0" step={inputStep} value={s2.wholesale} onChange={e => setS2(p => ({ ...p, wholesale: e.target.value }))} placeholder="0.00" />
            </Field>
            <Field label={`Special Price (${symbol}) — optional`}>
              <input className={iCls} type="number" min="0" step={inputStep} value={s2.special} onChange={e => setS2(p => ({ ...p, special: e.target.value }))} placeholder="0.00" />
            </Field>
          </div>

          {s1.create_box_product && (
            <Field label={`Box Sell Price (${symbol}) — "${s1.name} ×${unitsPerBox}" — leave blank to auto-calculate`}>
              <input
                className={iCls} type="number" min="0" step={inputStep}
                value={s2.box_sell}
                onChange={e => setS2(p => ({ ...p, box_sell: e.target.value }))}
                placeholder={finalRetail > 0 ? `Auto: ${(finalRetail * unitsPerBox).toFixed(2)}` : "0.00"}
              />
            </Field>
          )}

          <Field label="Min Stock Level">
            <input className={iCls} type="number" min="0" step="1" value={s2.min_stock} onChange={e => setS2(p => ({ ...p, min_stock: e.target.value }))} placeholder="0" />
          </Field>
        </div>
      )}

      {/* ── Step 3: Codes ── */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">Assign barcodes — or skip and add them later from the edit screen.</p>

          <Field label="Unit Barcode">
            <BarcodeInput value={s3.unit_barcode} onChange={v => setS3(p => ({ ...p, unit_barcode: v }))} />
          </Field>
          <Field label="Internal Code — optional">
            <input className={iCls} value={s3.internal_code} onChange={e => setS3(p => ({ ...p, internal_code: e.target.value }))} placeholder="SKU / store code" />
          </Field>

          {s1.create_box_product && (
            <Field label={`Box Barcode — "${s1.name} ×${unitsPerBox}"`}>
              <BarcodeInput value={s3.box_barcode} onChange={v => setS3(p => ({ ...p, box_barcode: v }))} />
            </Field>
          )}

          {/* Summary */}
          <div className="p-4 bg-[#0D1526] border border-[#1E3050] rounded-xl space-y-2 text-xs">
            <p className="text-slate-500 font-medium uppercase tracking-wider mb-2">Summary</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <span className="text-slate-500">Product</span>
              <span className="text-white">{s1.name}</span>
              <span className="text-slate-500">Cost / unit</span>
              <span className="text-slate-300">{fmtNum(costPerUnit)}</span>
              <span className="text-slate-500">Retail / unit</span>
              <span className="text-[#14B8A6] font-medium">{fmtNum(finalRetail)}</span>
              <span className="text-slate-500">Margin</span>
              <span className={displayMargin >= 0 ? "text-emerald-400" : "text-red-400"}>{displayMargin.toFixed(1)}%</span>
              <span className="text-slate-500">Stock added</span>
              <span className="text-emerald-400">+{totalUnits} units ({boxesRcvd} × {unitsPerBox})</span>
              {s1.create_box_product && (
                <>
                  <span className="text-slate-500">Box product</span>
                  <span className="text-white">{s1.name} ×{unitsPerBox}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

      {/* Navigation */}
      <div className="flex justify-between gap-2 mt-5 pt-4 border-t border-[#1E3050]">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-[#1A2A44] transition-colors cursor-pointer">
          Cancel
        </button>
        {step < 3 ? (
          <button type="button" onClick={goNext} className="flex items-center gap-1.5 px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors cursor-pointer">
            Next <ArrowRight size={14} />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Creating…" : s1.create_box_product ? "Create Products" : "Create Product"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Mode 3: Weighed / Bulk ───────────────────────────────────────────────────────
function WeighedItemForm({ categories, suppliers, user: _user, onBack, onClose, onSaved }: CommonProps) {
  const { toDb, inputStep, symbol } = useCurrency();
  const [f, setF] = useState({
    name: "", barcode: "", category_id: "", supplier_id: "",
    unit: "kg", cost_price: "", sell_price_retail: "",
    sell_price_wholesale: "", tva_rate: "0", apply_tva: false,
    min_stock: "0", expiry_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim())       { setError("Name is required");        return; }
    if (!f.sell_price_retail) { setError("Sell price is required");  return; }
    setSaving(true); setError("");
    try {
      await api.createProduct({
        barcode:              f.barcode.trim() || null,
        name:                 f.name.trim(),
        category_id:          f.category_id ? Number(f.category_id) : null,
        supplier_id:          f.supplier_id ? Number(f.supplier_id) : null,
        unit:                 f.unit,
        cost_price:           toDb(f.cost_price),
        sell_price_retail:    toDb(f.sell_price_retail),
        sell_price_wholesale: toDb(f.sell_price_wholesale),
        tva_rate:             parseFloat(f.tva_rate || "0") / 100,
        apply_tva:            f.apply_tva,
        apply_discount:       true,
        sold_by_amount:       true,
        min_stock:            parseFloat(f.min_stock || "0"),
        expiry_date:          f.expiry_date || null,
      });
      onSaved(); // Close as soon as product is saved
    } catch (err: unknown) {
      setError(parseDbError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <BackBtn onClick={onBack} />
        <span className="text-xs text-slate-500">Weighed / Bulk</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Product Name" required>
          <input className={iCls} value={f.name} onChange={set("name")} placeholder='e.g. "Apples"' autoFocus />
        </Field>
        <Field label="Unit">
          <select className={selCls} value={f.unit} onChange={set("unit")}>
            <option value="kg">kg — kilogram</option>
            <option value="g">g — gram</option>
            <option value="lb">lb — pound</option>
            <option value="liter">liter</option>
            <option value="ml">ml — milliliter</option>
            <option value="piece">piece</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <CategorySelect
            value={f.category_id}
            onChange={v => setF(prev => ({ ...prev, category_id: v }))}
            categories={categories}
            className={selCls}
          />
        </Field>
        <Field label="Supplier">
          <select className={selCls} value={f.supplier_id} onChange={set("supplier_id")}>
            <option value="">— None —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Barcode — optional">
        <BarcodeInput value={f.barcode} onChange={v => setF(p => ({ ...p, barcode: v }))} />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label={`Cost per ${f.unit} (${symbol})`}>
          <input className={iCls} type="number" min="0" step={inputStep} value={f.cost_price} onChange={set("cost_price")} placeholder="0.00" />
        </Field>
        <Field label={`Retail per ${f.unit} (${symbol})`} required>
          <input className={iCls} type="number" min="0" step={inputStep} value={f.sell_price_retail} onChange={set("sell_price_retail")} placeholder="0.00" />
        </Field>
        <Field label={`Wholesale per ${f.unit} (${symbol})`}>
          <input className={iCls} type="number" min="0" step={inputStep} value={f.sell_price_wholesale} onChange={set("sell_price_wholesale")} placeholder="0.00" />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="TVA Rate (%)">
          <input className={iCls} type="number" min="0" max="100" step="0.1" value={f.tva_rate} onChange={set("tva_rate")} placeholder="0" />
        </Field>
        <Field label="Min Stock">
          <input className={iCls} type="number" min="0" step="0.1" value={f.min_stock} onChange={set("min_stock")} placeholder="0" />
        </Field>
        <Field label="Expiry Date">
          <input className={iCls} type="date" value={f.expiry_date} onChange={set("expiry_date")} />
        </Field>
      </div>

      <Toggle checked={f.apply_tva} onChange={v => setF(p => ({ ...p, apply_tva: v }))} label="Apply TVA on sale" />

      <div className="px-3 py-2 bg-[#14B8A6]/10 border border-[#14B8A6]/20 rounded-xl text-xs text-[#14B8A6]">
        ✓ Sell by amount is enabled — the cashier will enter the weight/quantity at checkout
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      <FormFooter onClose={onClose} saving={saving} label="Add Product" />
    </form>
  );
}

// ── Container ────────────────────────────────────────────────────────────────────
export default function AddProductModal({
  categories, suppliers, user, onClose, onSaved,
}: Omit<CommonProps, "onBack">) {
  const [mode, setMode] = useState<Mode>("picker");
  const common = { categories, suppliers, user, onBack: () => setMode("picker"), onClose, onSaved };

  return (
    <Modal title="Add Product" onClose={onClose} width="max-w-2xl">
      {mode === "picker"  && <ModePicker onSelect={setMode} />}
      {mode === "quick"   && <QuickItemForm   {...common} />}
      {mode === "box"     && <BoxImportForm   {...common} />}
      {mode === "weighed" && <WeighedItemForm {...common} />}
    </Modal>
  );
}
