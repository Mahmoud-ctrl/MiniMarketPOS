import { useEffect, useState } from "react";
import { Check, ChevronRight, DollarSign, Pencil, Plus, Store, Tag, Trash2, Truck, Upload, User as UserIcon, Users } from "lucide-react";
import { api } from "../lib/api";
import { Category, Supplier, User } from "../types";
import { groupCategories } from "../lib/categories";
import { useCurrency } from "../context/CurrencyContext";
import Modal from "../components/Modal";

interface Props { user: User }

type Tab = "store" | "users" | "categories" | "suppliers" | "currency";

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
  const [users, setUsers]         = useState<User[]>([]);
  const [showAdd, setShowAdd]     = useState(false);
  const [pinTarget, setPinTarget] = useState<User | null>(null);

  const load = () => api.getUsers().then(setUsers).catch(console.error);
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-400 text-sm">{users.length} users</p>
        {currentUser.role === "admin" && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-xs rounded-xl transition-colors cursor-pointer">
            <Plus size={13} /> Add User
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
                Change PIN
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
    <Modal title="Add User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-3">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}
        <Field label="Full Name" required>
          <input className={iCls} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Smith" />
        </Field>
        <Field label="Username" required>
          <input className={iCls} value={username} onChange={e => setUsername(e.target.value)} placeholder="jsmith" />
        </Field>
        <Field label="Role">
          <select className={selCls} value={role} onChange={e => setRole(e.target.value)}>
            <option value="cashier">Cashier</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="PIN (4–6 digits)" required>
          <input className={iCls} type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" />
        </Field>
        <Field label="Confirm PIN" required>
          <input className={iCls} type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={e => setConfirm(e.target.value)} placeholder="••••" />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bd-base)]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Creating…" : "Create User"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ChangePinModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
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
    <Modal title={`Change PIN — ${user.full_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-3">
        {done ? (
          <div className="flex flex-col items-center gap-2 py-4 text-emerald-400">
            <Check size={32} />
            <p className="font-medium">PIN updated</p>
          </div>
        ) : (
          <>
            <Field label="New PIN (4–6 digits)" required>
              <input className={iCls} type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" />
            </Field>
            <Field label="Confirm PIN" required>
              <input className={iCls} type="password" inputMode="numeric" maxLength={6} value={confirm} onChange={e => setConf(e.target.value)} placeholder="••••" />
            </Field>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bd-base)]">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
                {saving ? "Saving…" : "Update PIN"}
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
  const [cats, setCats]       = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  // addingUnder: null = adding a root category, number = adding sub under that parent id
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
        <p className="text-slate-400 text-sm">{cats.length} categories</p>
        <button
          onClick={() => setAddingUnder(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
        >
          <Plus size={13} /> Add Category
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
                  + Sub
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
        {cats.length === 0 && <p className="text-center py-8 text-slate-600 text-sm">No categories yet</p>}
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
        <Modal title="Delete Category" onClose={() => setDeleting(null)}>
          <div className="p-6 space-y-4">
            {deleting.parent_id === null && cats.some(c => c.parent_id === deleting.id) ? (
              <p className="text-slate-300 text-sm">
                Delete <strong className="text-[var(--tx-base)]">{deleting.name}</strong>? Its sub-categories will become top-level categories. Products will become uncategorized.
              </p>
            ) : (
              <p className="text-slate-300 text-sm">
                Delete <strong className="text-[var(--tx-base)]">{deleting.name}</strong>? Products in this category will become uncategorized.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">Cancel</button>
              <button
                onClick={async () => { await api.deleteCategory(deleting.id); setDeleting(null); load(); }}
                className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 font-medium text-sm rounded-xl border border-red-500/20 transition-colors cursor-pointer"
              >
                Delete
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

  return (
    <Modal title={cat ? "Edit Category" : parentId ? "Add Sub-Category" : "Add Category"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-3">
        <Field label="Name" required>
          <input className={iCls} value={name} onChange={e => setName(e.target.value)} placeholder={parentId ? "e.g. Soft Drinks" : "e.g. Beverages"} autoFocus />
        </Field>
        <Field label="Parent Category">
          <select className={selCls} value={parentId} onChange={e => setParentId(e.target.value)}>
            <option value="">— None (top-level) —</option>
            {parentOptions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Description (optional)">
          <input className={iCls} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Short description" />
        </Field>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bd-base)]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Saving…" : cat ? "Save" : "Add Category"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Suppliers tab ──────────────────────────────────────────────────────────────
function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editing, setEditing]     = useState<Supplier | null>(null);
  const [showAdd, setShowAdd]     = useState(false);

  const load = () => api.getSuppliers().then(setSuppliers).catch(console.error);
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-400 text-sm">{suppliers.length} suppliers</p>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-xs rounded-xl transition-colors cursor-pointer">
          <Plus size={13} /> Add Supplier
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
        {suppliers.length === 0 && <p className="text-center py-8 text-slate-600 text-sm">No suppliers yet</p>}
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
    <Modal title={supplier ? "Edit Supplier" : "Add Supplier"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-3">
        <Field label="Name" required>
          <input className={iCls} value={name} onChange={e => setName(e.target.value)} placeholder="Supplier name" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input className={iCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
          </Field>
          <Field label="Email">
            <input className={iCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="orders@supplier.com" />
          </Field>
        </div>
        <Field label="Address">
          <input className={iCls} value={addr} onChange={e => setAddr(e.target.value)} placeholder="Street, City" />
        </Field>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bd-base)]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-[var(--tx-base)] rounded-xl hover:bg-[var(--bg-raised)] transition-colors cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Saving…" : supplier ? "Save" : "Add Supplier"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Store config tab ───────────────────────────────────────────────────────────
function StoreConfigTab() {
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
        <label className="block text-xs text-slate-400 mb-2">Store Logo</label>
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
              <Upload size={12} /> Upload image
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoChange} />
            </label>
            {logo && (
              <button
                onClick={() => { setLogo(""); setLogoWarn(false); }}
                className="block text-xs text-slate-600 hover:text-red-400 transition-colors cursor-pointer"
              >
                Remove logo
              </button>
            )}
            <p className="text-slate-600 text-[11px]">PNG / JPG — used on receipts</p>
            {logoWarn && (
              <p className="text-amber-400 text-[11px]">Image is large — consider resizing for faster receipts.</p>
            )}
          </div>
        </div>
      </div>

      {/* Store name */}
      <Field label="Store Name" required>
        <input className={iCls} value={name} onChange={e => setName(e.target.value)} placeholder="My Mini Market" />
      </Field>

      {/* Address */}
      <Field label="Address">
        <textarea
          rows={3}
          className={taCls}
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder={"123 Main St\nBeirut, Lebanon"}
        />
      </Field>

      {/* Phone + Email */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone">
          <input className={iCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+961 1 234 567" />
        </Field>
        <Field label="Email">
          <input className={iCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="store@example.com" />
        </Field>
      </div>

      {/* Tagline */}
      <Field label="Tagline / Slogan">
        <input className={iCls} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Thank you for shopping with us!" />
      </Field>

      {/* Save */}
      <div className="pt-2 border-t border-[var(--bd-base)]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saved ? <><Check size={14} /> Saved</> : saving ? "Saving…" : "Save Store Info"}
        </button>
      </div>
    </div>
  );
}

// ── Currency tab ───────────────────────────────────────────────────────────────
function CurrencyTab() {
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
        <p className="text-[var(--tx-base)] font-semibold text-sm mb-1">Base Currency</p>
        <p className="text-slate-500 text-xs mb-3">
          Prices in the database are stored in this currency. Change only before entering prices — existing prices will NOT be converted.
        </p>
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
            Warning: switching base currency will reinterpret all stored prices in the new currency unit without converting their values.
          </p>
        )}
      </div>

      <div>
        <p className="text-[var(--tx-base)] font-semibold text-sm mb-1">Exchange Rate</p>
        <p className="text-slate-500 text-xs mb-3">How many Lebanese Pounds equal 1 US Dollar.</p>
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
        <p className="text-[var(--tx-base)] font-semibold text-sm mb-1">Show Secondary Currency</p>
        <p className="text-slate-500 text-xs mb-3">Display the equivalent amount in the other currency alongside prices.</p>
        <button
          onClick={() => setLocalAlt(v => !v)}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${localAlt ? "bg-[#14B8A6]" : "bg-[var(--bg-raised)] border border-[var(--bd-base)]"}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${localAlt ? "left-4" : "left-0.5"}`} />
          </div>
          <span className="text-sm text-slate-400 group-hover:text-slate-300">
            {localAlt ? "Enabled" : "Disabled"}
          </span>
        </button>
      </div>

      <div className="pt-2 border-t border-[var(--bd-base)]">
        <button
          onClick={handleSave}
          disabled={saving || parseInt(rate || "0") <= 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saved ? <><Check size={14} /> Saved</> : saving ? "Saving…" : "Save Currency Settings"}
        </button>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: typeof UserIcon }[] = [
  { id: "store",      label: "Store",      icon: Store        },
  { id: "users",      label: "Users",      icon: Users        },
  { id: "categories", label: "Categories", icon: Tag          },
  { id: "suppliers",  label: "Suppliers",  icon: Truck        },
  { id: "currency",   label: "Currency",   icon: DollarSign   },
];

export default function SettingsScreen({ user }: Props) {
  const [tab, setTab] = useState<Tab>("store");

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar */}
      <div className="w-48 flex-shrink-0 border-r border-[var(--bd-base)] bg-[var(--bg-base)] py-4 px-2">
        <p className="text-xs text-slate-600 font-medium uppercase tracking-wider px-3 mb-3">Settings</p>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer mb-0.5 ${
              tab === id
                ? "bg-[#14B8A6]/10 text-[#14B8A6] border border-[#14B8A6]/20"
                : "text-slate-500 hover:text-slate-300 hover:bg-[var(--bg-card)]"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "store"      && <StoreConfigTab />}
        {tab === "users"      && <UsersTab currentUser={user} />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "suppliers"  && <SuppliersTab />}
        {tab === "currency"   && <CurrencyTab />}
      </div>
    </div>
  );
}
