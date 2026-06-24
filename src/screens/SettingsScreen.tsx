import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Tag, Trash2, Truck, User as UserIcon, Users } from "lucide-react";
import { api } from "../lib/api";
import { Category, Supplier, User } from "../types";
import Modal from "../components/Modal";

interface Props { user: User }

type Tab = "users" | "categories" | "suppliers";

const iCls   = "w-full px-3 py-2 bg-[#131F35] border border-[#1E3050] focus:border-[#14B8A6]/50 focus:outline-none rounded-xl text-white text-sm placeholder-slate-600 transition-colors";
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
          <div key={u.id} className="flex items-center gap-3 bg-[#131F35] border border-[#1E3050] rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-[#1A2A44] text-slate-300 font-bold text-sm flex items-center justify-center flex-shrink-0">
              {u.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium text-sm">{u.full_name}</div>
              <div className="text-slate-500 text-xs">@{u.username}</div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${roleStyle[u.role]}`}>
              {u.role}
            </span>
            {(currentUser.role === "admin" || currentUser.id === u.id) && (
              <button onClick={() => setPinTarget(u)}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-[#1A2A44] hover:bg-[#243558] rounded-lg transition-colors cursor-pointer">
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
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-[#1E3050]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-[#1A2A44] transition-colors cursor-pointer">Cancel</button>
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
            <div className="flex justify-end gap-2 pt-2 border-t border-[#1E3050]">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-[#1A2A44] transition-colors cursor-pointer">Cancel</button>
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
  const [cats, setCats]         = useState<Category[]>([]);
  const [editing, setEditing]   = useState<Category | null>(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const load = () => api.getCategories().then(setCats).catch(console.error);
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-400 text-sm">{cats.length} categories</p>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-xs rounded-xl transition-colors cursor-pointer">
          <Plus size={13} /> Add Category
        </button>
      </div>

      <div className="space-y-1.5">
        {cats.map(c => (
          <div key={c.id} className="flex items-center gap-3 bg-[#131F35] border border-[#1E3050] rounded-xl px-4 py-3 group">
            <div className="w-7 h-7 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center flex-shrink-0">
              <Tag size={13} className="text-[#14B8A6]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium text-sm">{c.name}</div>
              {c.description && <div className="text-slate-500 text-xs truncate">{c.description}</div>}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditing(c)} className="w-7 h-7 rounded-lg bg-[#1A2A44] hover:bg-[#243558] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"><Pencil size={12} /></button>
              <button onClick={() => setDeleting(c)} className="w-7 h-7 rounded-lg bg-[#1A2A44] hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {cats.length === 0 && <p className="text-center py-8 text-slate-600 text-sm">No categories yet</p>}
      </div>

      {(showAdd || editing) && (
        <CategoryModal
          cat={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={() => { setShowAdd(false); setEditing(null); load(); }}
        />
      )}
      {deleting && (
        <Modal title="Delete Category" onClose={() => setDeleting(null)}>
          <div className="p-6 space-y-4">
            <p className="text-slate-300 text-sm">Delete <strong className="text-white">{deleting.name}</strong>? Products in this category will become uncategorized.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-[#1A2A44] transition-colors cursor-pointer">Cancel</button>
              <button onClick={async () => { await api.deleteCategory(deleting.id); setDeleting(null); load(); }}
                className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 font-medium text-sm rounded-xl border border-red-500/20 transition-colors cursor-pointer">Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CategoryModal({ cat, onClose, onSaved }: { cat: Category | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName]         = useState(cat?.name ?? "");
  const [desc, setDesc]         = useState(cat?.description ?? "");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      if (cat) {
        await api.updateCategory(cat.id, name.trim(), desc.trim() || null);
      } else {
        await api.createCategory({ name: name.trim(), description: desc.trim() || null });
      }
      onSaved();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? String(err));
    } finally { setSaving(false); }
  };

  return (
    <Modal title={cat ? "Edit Category" : "Add Category"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-3">
        <Field label="Name" required>
          <input className={iCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Beverages" autoFocus />
        </Field>
        <Field label="Description (optional)">
          <input className={iCls} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Short description" />
        </Field>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-[#1E3050]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-[#1A2A44] transition-colors cursor-pointer">Cancel</button>
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
          <div key={s.id} className="flex items-center gap-3 bg-[#131F35] border border-[#1E3050] rounded-xl px-4 py-3 group">
            <div className="w-7 h-7 rounded-lg bg-[#1A2A44] flex items-center justify-center flex-shrink-0">
              <Truck size={13} className="text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium text-sm">{s.name}</div>
              <div className="text-slate-500 text-xs flex gap-3">
                {s.phone && <span>{s.phone}</span>}
                {s.email && <span>{s.email}</span>}
                {s.address && <span className="truncate max-w-[200px]">{s.address}</span>}
              </div>
            </div>
            <button onClick={() => setEditing(s)} className="w-7 h-7 rounded-lg bg-[#1A2A44] hover:bg-[#243558] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer opacity-0 group-hover:opacity-100"><Pencil size={12} /></button>
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
        <div className="flex justify-end gap-2 pt-2 border-t border-[#1E3050]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-[#1A2A44] transition-colors cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Saving…" : supplier ? "Save" : "Add Supplier"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: typeof UserIcon }[] = [
  { id: "users",      label: "Users",      icon: Users    },
  { id: "categories", label: "Categories", icon: Tag      },
  { id: "suppliers",  label: "Suppliers",  icon: Truck    },
];

export default function SettingsScreen({ user }: Props) {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar */}
      <div className="w-48 flex-shrink-0 border-r border-[#1E3050] bg-[#0D1526] py-4 px-2">
        <p className="text-xs text-slate-600 font-medium uppercase tracking-wider px-3 mb-3">Settings</p>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer mb-0.5 ${
              tab === id
                ? "bg-[#14B8A6]/10 text-[#14B8A6] border border-[#14B8A6]/20"
                : "text-slate-500 hover:text-slate-300 hover:bg-[#131F35]"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "users"      && <UsersTab currentUser={user} />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "suppliers"  && <SuppliersTab />}
      </div>
    </div>
  );
}
