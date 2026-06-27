import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, DollarSign, Globe, Keyboard, Pencil, Plus, Store, Tag, Trash2, Truck, Upload, User as UserIcon, Users } from "lucide-react";
import { api } from "../lib/api";
import { Category, Supplier, User } from "../types";
import { groupCategories } from "../lib/categories";
import { useCurrency } from "../context/CurrencyContext";
import { useLanguage } from "../context/LanguageContext";
import Modal from "../components/Modal";

interface Props { user: User }

type Tab = "store" | "users" | "categories" | "suppliers" | "currency" | "language" | "shortcuts";

const iCls   = "w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--bd-base)] focus:border-[#14B8A6]/50 focus:outline-none rounded-xl text-[var(--tx-base)] text-sm placeholder-slate-600 transition-colors";
const selCls = iCls + " cursor-pointer";

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

const roleStyle: Record<string, string> = {
  admin:   "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  manager: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  cashier: "bg-slate-700/60 text-slate-400 border border-slate-600/40",
};

// ── Users tab ──────────────────────────────────────────────────────────────────
function UsersTab({ currentUser }: { currentUser: User }) {
  const { t } = useTranslation();
  const [users, setUsers]         = useState<User[]>([]);
  const [showAdd, setShowAdd]     = useState(false);
  const [pinTarget, setPinTarget] = useState<User | null>(null);

  const load = () => api.getUsers().then(setUsers).catch(console.error);
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-400 text-sm">{t("settings.userForm.userCount", { n: users.length })}</p>
        {currentUser.role === "admin" && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-xs rounded-xl transition-colors cursor-pointer">
            <Plus size={13} /> {t("settings.userForm.addUser")}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-[var(--bg-raised)] text-slate-300 font-bold text-sm flex items-center justify-center flex-shrink-0">
              {u.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[var(--tx-base)] font-medium text-sm">{u.full_name}</div>
              <div className="text-slate-500 text-xs">@{u.username}</div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${roleStyle[u.role]}`}>
              {u.role}
            </span>
            {(currentUser.role === "admin" || currentUser.id === u.id) && (
              <button onClick={() => setPinTarget(u)}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-[var(--tx-base)] bg-[var(--bg-raised)] hover:bg-[var(--bg-raised)] rounded-lg transition-colors cursor-pointer">
                {t("settings.userForm.updatePin")}
              </button>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <AddUserModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      )}
      {pinTarget && (
        <ChangePinModal user={pinTarget} onClose={() => setPinTarget(null)} onSaved={() => setPinTarget(null)} />
      )}
    </div>
  );
}

function AddUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [username, setUsername]   = useState("");
  const [fullName, setFullName]   = useState("");
  const [role, setRole]           = useState("cashier");
  const [pin, setPin]             = useState("");
  const [confirmPin, setConfirm]  = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !fullName.trim()) { setError("Username and name are required"); return; }
    if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) { setError("PIN must be 4–6 digits"); return; }
    if (pin !== confirmPin) { setError("PINs do not match"); return; }
    setSaving(true); setError("");
    try {
      await api.createUser(username.trim(), fullName.trim(), role, pin);
      onSaved();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? String(err));
    } finally { setSaving(false); }
  };

  return (
    <Modal title={t("settings.userForm.addUser")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-3">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}
        <Field label={t("settings.userForm.fullName")} required>
          <input className={iCls} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Smith" />
        </Field>
        <Field label={t("settings.userForm.username")} required>
          <input className={iCls} value={username} onChange={e => setUsername(e.target.value)} placeholder="jsmith" />
        </Field>
        <Field label={t("settings.userForm.role")}>
          <select className={selCls} value={role} onChange={e => setRole(e.target.value)}>
            <option value="cashier">{t("settings.userForm.roles.cashier")}</option>
            <option value="manager">{t("settings.userForm.roles.manager")}</option>
            <option value="admin">{t("settings.userForm.roles.admin")}</option>
          </select>
        </Field>
        <Field label={t("settings.userForm.pin")} required>
          <input className={iCls} type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" />
        </Field>
        <Field label={t("settings.userForm.confirmPin")} required>
          <input className={iCls} type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={e => setConfirm(e.target.value)} placeholder="••••" />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bd-base)]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">{t("common.cancel")}</button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? t("settings.userForm.creating") : t("settings.userForm.createUser")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ChangePinModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [pin, setPin]       = useState("");
  const [confirm, setConf]  = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [done, setDone]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) { setError("PIN must be 4–6 digits"); return; }
    if (pin !== confirm) { setError("PINs do not match"); return; }
    setSaving(true); setError("");
    try {
      await api.setPin(user.id, pin);
      setDone(true);
      setTimeout(onSaved, 1000);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? String(err));
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`${t("settings.userForm.updatePin")} — ${user.full_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-3">
        {done ? (
          <div className="flex flex-col items-center gap-2 py-4 text-emerald-400">
            <Check size={32} />
            <p className="font-medium">{t("settings.userForm.pinUpdated")}</p>
          </div>
        ) : (
          <>
            <Field label={t("settings.userForm.pin")} required>
              <input className={iCls} type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" />
            </Field>
            <Field label={t("settings.userForm.confirmPin")} required>
              <input className={iCls} type="password" inputMode="numeric" maxLength={6} value={confirm} onChange={e => setConf(e.target.value)} placeholder="••••" />
            </Field>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bd-base)]">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">{t("common.cancel")}</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
                {saving ? t("settings.userForm.saving") : t("settings.userForm.updatePin")}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

// ── Categories tab ─────────────────────────────────────────────────────────────
function CategoriesTab() {
  const { t } = useTranslation();
  const [cats, setCats]       = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [addingUnder, setAddingUnder] = useState<number | null | "closed">("closed");
  const [deleting, setDeleting]       = useState<Category | null>(null);

  const load = () => api.getCategories().then(setCats).catch(console.error);
  useEffect(() => { load(); }, []);

  const groups  = groupCategories(cats);
  const rootCats = cats.filter(c => c.parent_id === null);

  const btnRow = "w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-400 text-sm">{t("settings.categoryForm.categoryCount", { n: cats.length })}</p>
        <button
          onClick={() => setAddingUnder(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
        >
          <Plus size={13} /> {t("settings.categoryForm.add")}
        </button>
      </div>

      <div className="space-y-1.5">
        {groups.map(({ parent, children }) => (
          <div key={parent.id}>
            {/* Parent row */}
            <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl px-4 py-3 group">
              <div className="w-7 h-7 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center flex-shrink-0">
                <Tag size={13} className="text-[#14B8A6]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--tx-base)] font-medium text-sm">{parent.name}</span>
                  {children.length > 0 && (
                    <span className="text-slate-600 text-[10px] bg-[var(--bg-raised)] px-1.5 py-0.5 rounded-md">
                      {children.length} sub
                    </span>
                  )}
                </div>
                {parent.description && <div className="text-slate-500 text-xs truncate">{parent.description}</div>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setAddingUnder(parent.id)}
                  className="px-2 py-1 text-[11px] text-[#14B8A6] bg-[#14B8A6]/10 hover:bg-[#14B8A6]/20 border border-[#14B8A6]/20 rounded-lg transition-colors cursor-pointer"
                >
                  + {t("settings.categoryForm.sub")}
                </button>
                <button onClick={() => setEditing(parent)} className={`${btnRow} bg-[var(--bg-raised)] hover:bg-[var(--bg-raised)] text-slate-400 hover:text-[var(--tx-base)]`}><Pencil size={12} /></button>
                <button onClick={() => setDeleting(parent)} className={`${btnRow} bg-[var(--bg-raised)] hover:bg-red-500/20 text-slate-400 hover:text-red-400`}><Trash2 size={12} /></button>
              </div>
            </div>

            {/* Child rows */}
            {children.map(child => (
              <div key={child.id} className="ml-6 mt-0.5 flex items-center gap-3 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-xl px-4 py-2.5 group relative">
                <ChevronRight size={12} className="text-slate-700 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-slate-300 text-sm">{child.name}</span>
                  {child.description && <div className="text-slate-600 text-xs truncate">{child.description}</div>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditing(child)} className={`${btnRow} bg-[var(--bg-card)] hover:bg-[var(--bg-raised)] text-slate-400 hover:text-[var(--tx-base)]`}><Pencil size={12} /></button>
                  <button onClick={() => setDeleting(child)} className={`${btnRow} bg-[var(--bg-card)] hover:bg-red-500/20 text-slate-400 hover:text-red-400`}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        ))}
        {cats.length === 0 && <p className="text-center py-8 text-slate-600 text-sm">{t("settings.categoryForm.noCategories")}</p>}
      </div>

      {addingUnder !== "closed" && (
        <CategoryModal
          cat={null}
          preselectedParentId={addingUnder}
          rootCats={rootCats}
          onClose={() => setAddingUnder("closed")}
          onSaved={() => { setAddingUnder("closed"); load(); }}
        />
      )}
      {editing && (
        <CategoryModal
          cat={editing}
          preselectedParentId={undefined}
          rootCats={rootCats}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {deleting && (
        <Modal title={t("settings.categoryForm.delete")} onClose={() => setDeleting(null)}>
          <div className="p-6 space-y-4">
            <p className="text-slate-300 text-sm">
              {deleting.parent_id === null && cats.some(c => c.parent_id === deleting.id)
                ? t("settings.categoryForm.deleteWithSubs", { name: deleting.name })
                : t("settings.categoryForm.deleteConfirm",  { name: deleting.name })}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">{t("common.cancel")}</button>
              <button
                onClick={async () => { await api.deleteCategory(deleting.id); setDeleting(null); load(); }}
                className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 font-medium text-sm rounded-xl border border-red-500/20 transition-colors cursor-pointer"
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CategoryModal({
  cat, preselectedParentId, rootCats, onClose, onSaved,
}: {
  cat:                 Category | null;
  preselectedParentId: number | null | undefined;
  rootCats:            Category[];
  onClose:             () => void;
  onSaved:             () => void;
}) {
  const { t } = useTranslation();
  const [name, setName]     = useState(cat?.name ?? "");
  const [desc, setDesc]     = useState(cat?.description ?? "");
  const [parentId, setParentId] = useState<string>(
    cat?.parent_id != null         ? String(cat.parent_id)          :
    preselectedParentId != null    ? String(preselectedParentId)     : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const pid = parentId ? Number(parentId) : null;
    try {
      if (cat) {
        await api.updateCategory(cat.id, name.trim(), desc.trim() || null, pid);
      } else {
        await api.createCategory({ name: name.trim(), description: desc.trim() || null, parent_id: pid });
      }
      onSaved();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? String(err));
    } finally { setSaving(false); }
  };

  // Only root categories are valid parents (no 3rd level)
  const parentOptions = rootCats.filter(c => c.id !== cat?.id);

  const modalTitle = cat
    ? t("settings.categoryForm.edit")
    : parentId ? t("settings.categoryForm.addSub") : t("settings.categoryForm.add");

  return (
    <Modal title={modalTitle} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-3">
        <Field label={t("settings.categoryForm.name")} required>
          <input className={iCls} value={name} onChange={e => setName(e.target.value)} placeholder={parentId ? "e.g. Soft Drinks" : "e.g. Beverages"} autoFocus />
        </Field>
        <Field label={t("settings.categoryForm.parentCategory")}>
          <select className={selCls} value={parentId} onChange={e => setParentId(e.target.value)}>
            <option value="">{t("settings.categoryForm.noneTopLevel")}</option>
            {parentOptions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label={t("settings.categoryForm.description")}>
          <input className={iCls} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t("common.optional")} />
        </Field>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bd-base)]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">{t("common.cancel")}</button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? t("common.saving") : cat ? t("common.save") : t("settings.categoryForm.add")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Suppliers tab ──────────────────────────────────────────────────────────────
function SuppliersTab() {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editing, setEditing]     = useState<Supplier | null>(null);
  const [showAdd, setShowAdd]     = useState(false);

  const load = () => api.getSuppliers().then(setSuppliers).catch(console.error);
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-400 text-sm">{t("settings.supplierForm.supplierCount", { n: suppliers.length })}</p>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-xs rounded-xl transition-colors cursor-pointer">
          <Plus size={13} /> {t("settings.supplierForm.add")}
        </button>
      </div>

      <div className="space-y-1.5">
        {suppliers.map(s => (
          <div key={s.id} className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl px-4 py-3 group">
            <div className="w-7 h-7 rounded-lg bg-[var(--bg-raised)] flex items-center justify-center flex-shrink-0">
              <Truck size={13} className="text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[var(--tx-base)] font-medium text-sm">{s.name}</div>
              <div className="text-slate-500 text-xs flex gap-3">
                {s.phone && <span>{s.phone}</span>}
                {s.email && <span>{s.email}</span>}
                {s.address && <span className="truncate max-w-[200px]">{s.address}</span>}
              </div>
            </div>
            <button onClick={() => setEditing(s)} className="w-7 h-7 rounded-lg bg-[var(--bg-raised)] hover:bg-[var(--bg-raised)] text-slate-400 hover:text-[var(--tx-base)] flex items-center justify-center transition-colors cursor-pointer opacity-0 group-hover:opacity-100"><Pencil size={12} /></button>
          </div>
        ))}
        {suppliers.length === 0 && <p className="text-center py-8 text-slate-600 text-sm">{t("settings.supplierForm.noSuppliers")}</p>}
      </div>

      {(showAdd || editing) && (
        <SupplierModal
          supplier={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={() => { setShowAdd(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName]     = useState(supplier?.name    ?? "");
  const [phone, setPhone]   = useState(supplier?.phone   ?? "");
  const [email, setEmail]   = useState(supplier?.email   ?? "");
  const [addr, setAddr]     = useState(supplier?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const orNull = (s: string) => s.trim() || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      if (supplier) {
        await api.updateSupplier(supplier.id, name.trim(), orNull(phone), orNull(email), orNull(addr));
      } else {
        await api.createSupplier({ name: name.trim(), phone: orNull(phone), email: orNull(email), address: orNull(addr) });
      }
      onSaved();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? String(err));
    } finally { setSaving(false); }
  };

  return (
    <Modal title={supplier ? t("settings.supplierForm.edit") : t("settings.supplierForm.add")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-3">
        <Field label={t("settings.supplierForm.name")} required>
          <input className={iCls} value={name} onChange={e => setName(e.target.value)} placeholder={t("settings.supplierForm.name")} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("settings.supplierForm.phone")}>
            <input className={iCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
          </Field>
          <Field label={t("settings.supplierForm.email")}>
            <input className={iCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="orders@supplier.com" />
          </Field>
        </div>
        <Field label={t("settings.supplierForm.address")}>
          <input className={iCls} value={addr} onChange={e => setAddr(e.target.value)} placeholder="Street, City" />
        </Field>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bd-base)]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">{t("common.cancel")}</button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? t("common.saving") : supplier ? t("common.save") : t("settings.supplierForm.add")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Store config tab ───────────────────────────────────────────────────────────
function StoreConfigTab() {
  const { t } = useTranslation();
  const [name,    setName]    = useState("");
  const [address, setAddress] = useState("");
  const [phone,   setPhone]   = useState("");
  const [email,   setEmail]   = useState("");
  const [tagline, setTagline] = useState("");
  const [logo,    setLogo]    = useState("");
  const [logoWarn, setLogoWarn] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    api.getSettings().then(settings => {
      for (const s of settings) {
        if (s.key === "store_name")    setName(s.value);
        if (s.key === "store_address") setAddress(s.value);
        if (s.key === "store_phone")   setPhone(s.value);
        if (s.key === "store_email")   setEmail(s.value);
        if (s.key === "store_tagline") setTagline(s.value);
        if (s.key === "store_logo")    setLogo(s.value);
      }
    }).catch(console.error);
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoWarn(file.size > 500_000);
    const reader = new FileReader();
    reader.onload = ev => setLogo(ev.target?.result as string ?? "");
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSetting("store_name",    name);
      await api.updateSetting("store_address", address);
      await api.updateSetting("store_phone",   phone);
      await api.updateSetting("store_email",   email);
      await api.updateSetting("store_tagline", tagline);
      await api.updateSetting("store_logo",    logo);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const taCls = `${iCls} resize-none`;

  return (
    <div className="max-w-lg space-y-5">

      {/* Logo */}
      <div>
        <label className="block text-xs text-slate-400 mb-2">{t("settings.store.logo")}</label>
        <div className="flex items-start gap-4">
          {/* Preview */}
          <div className="w-20 h-20 flex-shrink-0 rounded-xl bg-[var(--bg-card)] border border-[var(--bd-base)] flex items-center justify-center overflow-hidden">
            {logo ? (
              <img src={logo} alt="Store logo" className="w-full h-full object-contain p-1" />
            ) : (
              <Store size={28} className="text-slate-700" />
            )}
          </div>

          {/* Controls */}
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--bd-base)] hover:border-[#14B8A6]/50 text-slate-400 hover:text-[#14B8A6] text-xs rounded-xl transition-colors cursor-pointer">
              <Upload size={12} /> {t("settings.store.uploadImage")}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoChange} />
            </label>
            {logo && (
              <button
                onClick={() => { setLogo(""); setLogoWarn(false); }}
                className="block text-xs text-slate-600 hover:text-red-400 transition-colors cursor-pointer"
              >
                {t("settings.store.removeLogo")}
              </button>
            )}
            <p className="text-slate-600 text-[11px]">{t("settings.store.receiptHint")}</p>
            {logoWarn && (
              <p className="text-amber-400 text-[11px]">{t("settings.store.imageWarn")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Store name */}
      <Field label={t("settings.store.storeName")} required>
        <input className={iCls} value={name} onChange={e => setName(e.target.value)} placeholder="My Mini Market" />
      </Field>

      <Field label={t("settings.store.address")}>
        <textarea
          rows={3}
          className={taCls}
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder={"123 Main St\nBeirut, Lebanon"}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("settings.store.phone")}>
          <input className={iCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+961 1 234 567" />
        </Field>
        <Field label={t("settings.store.email")}>
          <input className={iCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="store@example.com" />
        </Field>
      </div>

      <Field label={t("settings.store.tagline")}>
        <input className={iCls} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Thank you for shopping with us!" />
      </Field>

      <div className="pt-2 border-t border-[var(--bd-base)]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saved ? <><Check size={14} /> {t("settings.store.saved")}</> : saving ? t("common.saving") : t("settings.store.save")}
        </button>
      </div>
    </div>
  );
}

// ── Currency tab ───────────────────────────────────────────────────────────────
function CurrencyTab() {
  const { t } = useTranslation();
  const { baseCurrency, exchangeRate, showAlt, setSetting } = useCurrency();

  const [rate,    setRate]    = useState(String(exchangeRate));
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  // Keep local rate in sync if context updates externally
  const [localBase, setLocalBase]   = useState(baseCurrency);
  const [localAlt,  setLocalAlt]    = useState(showAlt);

  const handleSave = async () => {
    const rateNum = parseInt(rate || "0");
    if (rateNum <= 0) return;
    setSaving(true);
    try {
      await setSetting("base_currency",     localBase);
      await setSetting("exchange_rate",     String(rateNum));
      await setSetting("show_alt_currency", String(localAlt));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const usdExample = localBase === "USD"
    ? `$1.00 = ل.ل ${parseInt(rate || "0").toLocaleString("en-US")}`
    : `ل.ل ${parseInt(rate || "0").toLocaleString("en-US")} = $1.00`;

  return (
    <div className="max-w-md space-y-6">
      <div>
        <p className="text-[var(--tx-base)] font-semibold text-sm mb-1">{t("settings.currency.baseCurrency")}</p>
        <p className="text-slate-500 text-xs mb-3">{t("settings.currency.baseCurrencyHint")}</p>
        <div className="flex gap-3">
          {(["USD", "LBP"] as const).map(c => (
            <button
              key={c}
              onClick={() => setLocalBase(c)}
              className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                localBase === c
                  ? "bg-[#14B8A6]/15 border-[#14B8A6]/50 text-[#14B8A6]"
                  : "bg-[var(--bg-card)] border-[var(--bd-base)] text-slate-400 hover:border-[#14B8A6]/30 hover:text-slate-200"
              }`}
            >
              {c === "USD" ? "$ USD — Dollar" : "ل.ل LBP — Lebanese Pound"}
            </button>
          ))}
        </div>
        {localBase !== baseCurrency && (
          <p className="mt-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            {t("settings.currency.baseCurrencyWarn")}
          </p>
        )}
      </div>

      <div>
        <p className="text-[var(--tx-base)] font-semibold text-sm mb-1">{t("settings.currency.exchangeRate")}</p>
        <p className="text-slate-500 text-xs mb-3">{t("settings.currency.exchangeRateHint")}</p>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm whitespace-nowrap">1 USD =</span>
          <input
            type="number"
            min="1"
            step="1"
            value={rate}
            onChange={e => setRate(e.target.value)}
            className={iCls + " max-w-[160px] text-center tabular-nums"}
            placeholder="89500"
          />
          <span className="text-slate-400 text-sm">ل.ل</span>
        </div>
        {parseInt(rate || "0") > 0 && (
          <p className="mt-2 text-slate-500 text-xs">{usdExample}</p>
        )}
      </div>

      <div>
        <p className="text-[var(--tx-base)] font-semibold text-sm mb-1">{t("settings.currency.showAlt")}</p>
        <p className="text-slate-500 text-xs mb-3">{t("settings.currency.showAltHint")}</p>
        <button
          onClick={() => setLocalAlt(v => !v)}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${localAlt ? "bg-[#14B8A6]" : "bg-[var(--bg-raised)] border border-[var(--bd-base)]"}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${localAlt ? "left-4" : "left-0.5"}`} />
          </div>
          <span className="text-sm text-slate-400 group-hover:text-slate-300">
            {localAlt ? t("settings.currency.enabled") : t("settings.currency.disabled")}
          </span>
        </button>
      </div>

      <div className="pt-2 border-t border-[var(--bd-base)]">
        <button
          onClick={handleSave}
          disabled={saving || parseInt(rate || "0") <= 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saved ? <><Check size={14} /> {t("settings.store.saved")}</> : saving ? t("common.saving") : t("settings.currency.save")}
        </button>
      </div>
    </div>
  );
}

// ── Language tab ───────────────────────────────────────────────────────────────
function LanguageTab() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

  const options: { lang: "en" | "ar"; label: string; native: string; dir: string }[] = [
    { lang: "en", label: t("settings.language.english"), native: "English",  dir: "ltr" },
    { lang: "ar", label: t("settings.language.arabic"),  native: "العربية", dir: "rtl" },
  ];

  return (
    <div className="max-w-md space-y-6">
      <div>
        <p className="text-[var(--tx-base)] font-semibold text-sm mb-1">{t("settings.language.title")}</p>
        <p className="text-slate-500 text-xs mb-5">{t("settings.language.subtitle")}</p>

        <div className="flex gap-3">
          {options.map(({ lang, label, native, dir }) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-5 rounded-2xl border-2 transition-all cursor-pointer ${
                language === lang
                  ? "bg-[#14B8A6]/10 border-[#14B8A6] text-[#14B8A6]"
                  : "bg-[var(--bg-card)] border-[var(--bd-base)] text-slate-400 hover:border-[#14B8A6]/40 hover:text-slate-200"
              }`}
            >
              <span className="text-2xl font-bold" dir={dir}>{native}</span>
              <span className="text-xs font-medium">{label}</span>
              {language === lang && (
                <span className="text-[10px] bg-[#14B8A6]/20 text-[#14B8A6] px-2 py-0.5 rounded-full font-medium">
                  {t("settings.language.currentLabel")}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shortcuts reference tab ────────────────────────────────────────────────────
function ShortcutsTab() {
  const { t } = useTranslation();

  const KBD = ({ k }: { k: string }) => (
    <kbd className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded-lg border border-[var(--bd-strong)] bg-[var(--bg-raised)] text-[var(--tx-base)] text-[11px] font-mono font-semibold shadow-sm">
      {k}
    </kbd>
  );

  const Row = ({ keys, alt, desc }: { keys: string[]; alt?: string; desc: string }) => (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--bd-base)] last:border-b-0">
      <div className="flex items-center gap-1.5 flex-shrink-0 w-44">
        {keys.map(k => <KBD key={k} k={k} />)}
        {alt && (
          <>
            <span className="text-slate-600 text-xs mx-0.5">or</span>
            <KBD k={alt} />
          </>
        )}
      </div>
      <span className="text-slate-400 text-sm">{desc}</span>
    </div>
  );

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <h3 className="flex items-center gap-2 text-[var(--tx-base)] font-semibold text-sm mb-2">
        <span className="w-2 h-2 rounded-full bg-[#14B8A6] flex-shrink-0" />
        {label}
      </h3>
      <div className="bg-[var(--bg-card)] border border-[var(--bd-base)] rounded-xl overflow-hidden">
        {children}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <p className="text-slate-500 text-xs mb-6">{t("shortcutsRef.subtitle")}</p>
      <div className="space-y-6">
        <Section label={t("shortcutsRef.posScreen")}>
          <Row keys={["F2"]}         desc={t("shortcutsRef.focusSearch")} />
          <Row keys={["F3"]}         desc={t("shortcutsRef.noSale")} />
          <Row keys={["Enter"]}      desc={t("shortcutsRef.barcodeSearch")} />
          <Row keys={["A–Z"]}        desc={t("shortcutsRef.jumpToSearch")} />
        </Section>

        <Section label={t("shortcutsRef.cartSection")}>
          <Row keys={["F5"]}         desc={t("shortcutsRef.openCheckout")} />
          <Row keys={["F6"]}         desc={t("shortcutsRef.quickPay")} />
          <Row keys={["F8"]}  alt="Ctrl+N" desc={t("shortcutsRef.newTab")} />
          <Row keys={["F9"]}         desc={t("shortcutsRef.holdTab")} />
          <Row keys={["Delete"]}     desc={t("shortcutsRef.clearCart")} />
          <Row keys={["←", "→"]}    desc={t("shortcutsRef.navigateTabs")} />
        </Section>

        <Section label={t("shortcutsRef.checkoutSection")}>
          <Row keys={["Enter"]}      desc={t("shortcutsRef.confirmPay")} />
          <Row keys={["F6"]}         desc={t("shortcutsRef.confirmPrint")} />
          <Row keys={["Escape"]}     desc={t("shortcutsRef.closeModal")} />
        </Section>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
const TABS: { id: Tab; labelKey: string; icon: typeof UserIcon }[] = [
  { id: "store",      labelKey: "settings.tabs.store",      icon: Store        },
  { id: "users",      labelKey: "settings.tabs.users",      icon: Users        },
  { id: "categories", labelKey: "settings.tabs.categories", icon: Tag          },
  { id: "suppliers",  labelKey: "settings.tabs.suppliers",  icon: Truck        },
  { id: "currency",   labelKey: "settings.tabs.currency",   icon: DollarSign   },
  { id: "language",   labelKey: "settings.tabs.language",   icon: Globe        },
  { id: "shortcuts",  labelKey: "settings.tabs.shortcuts",  icon: Keyboard     },
];

export default function SettingsScreen({ user }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("store");

  return (
    <div className="flex-1 flex overflow-hidden bg-[var(--bg-deep)]">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-e border-[var(--bd-faint)] bg-[var(--bg-deep)]/80 backdrop-blur-xl py-6 px-4">
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest px-3 mb-4">{t("nav.settings")}</p>
        {TABS.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all cursor-pointer mb-1 ${
              tab === id
                ? "bg-[#14B8A6] text-slate-900 shadow-[0_4px_14px_0_rgba(20,184,166,0.39)]"
                : "text-slate-500 hover:text-[var(--tx-base)] hover:bg-[var(--bg-panel)]"
            }`}
          >
            <Icon size={16} className={tab === id ? "text-slate-900" : "text-slate-400"} />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12">
        {tab === "store"      && <StoreConfigTab />}
        {tab === "users"      && <UsersTab currentUser={user} />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "suppliers"  && <SuppliersTab />}
        {tab === "currency"   && <CurrencyTab />}
        {tab === "language"   && <LanguageTab />}
        {tab === "shortcuts"  && <ShortcutsTab />}
      </div>
    </div>
  );
}
