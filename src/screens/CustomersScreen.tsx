import { useEffect, useState } from "react";
import {
  Users, Plus, X, ChevronRight, Banknote, AlertCircle,
  TrendingDown, TrendingUp, Clock, CheckCircle, RefreshCw,
} from "lucide-react";
import { api } from "../lib/api";
import type { CustomerLedgerEntry, CustomerWithBalance, Sale, User } from "../types";
import { useCurrency } from "../context/CurrencyContext";
import Modal from "../components/Modal";

interface Props { user: User }

// ── New customer form ─────────────────────────────────────────────────────────
function CreateCustomerModal({ onClose, onCreate }: {
  onClose:  () => void;
  onCreate: (c: CustomerWithBalance) => void;
}) {
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy,  setBusy]  = useState(false);

  const submit = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setBusy(true); setError("");
    try {
      const c = await api.createCustomer(name.trim(), phone.trim() || null, notes.trim() || null);
      onCreate({ ...c, balance_due: 0 });
      onClose();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? String(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal title="New Customer" onClose={onClose}>
      <div className="p-6 space-y-4 w-[380px]">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-xs">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Full name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              className="w-full bg-[#0D1526] border border-[#1A2D45] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 transition-colors"
              placeholder="e.g. Ahmad Khalil" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full bg-[#0D1526] border border-[#1A2D45] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 transition-colors"
              placeholder="+961 XX XXX XXX" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-[#0D1526] border border-[#1A2D45] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 transition-colors resize-none"
              placeholder="Optional notes…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={submit} disabled={busy}
            className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50">
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Customer detail — loans + history ─────────────────────────────────────────
function CustomerDetail({ customer, user, onClose, onUpdated }: {
  customer:  CustomerWithBalance;
  user:      User;
  onClose:   () => void;
  onUpdated: (c: CustomerWithBalance) => void;
}) {
  const { fmt, toDb } = useCurrency();
  const [ledger,  setLedger]  = useState<CustomerLedgerEntry[]>([]);
  const [sales,   setSales]   = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [paying,  setPaying]  = useState(false);
  const [amount,  setAmount]  = useState("");
  const [payNote, setPayNote] = useState("");
  const [error,   setError]   = useState("");
  const [busy,    setBusy]    = useState<number | "general" | null>(null);

  const reload = async () => {
    setLoading(true);
    setLoadErr("");
    try {
      const [l, s] = await Promise.all([
        api.getCustomerLedger(customer.id),
        api.getCustomerSales(customer.id),
      ]);
      setLedger(l);
      setSales(s);
    } catch (e: unknown) {
      setLoadErr((e as { message?: string })?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [customer.id]);

  // Per-sale remaining balance from ledger entries
  const saleRemaining = (saleId: number) =>
    ledger.filter(e => e.sale_id === saleId).reduce((s, e) => s + e.amount, 0);

  const pendingSales = sales.filter(s => s.status === "pending");

  const markAsReceived = async (sale: Sale) => {
    const remaining = saleRemaining(sale.id);
    if (remaining <= 0) return;
    setBusy(sale.id);
    setError("");
    try {
      const updated = await api.recordCustomerPayment({
        customerId: customer.id,
        amount:     remaining,
        saleId:     sale.id,
        notes:      "Marked as received",
        createdBy:  user.id,
      });
      onUpdated(updated);
      await reload();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to record payment");
    } finally {
      setBusy(null);
    }
  };

  const handleGeneralPayment = async () => {
    const amt = toDb(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    setBusy("general");
    setError("");
    try {
      const updated = await api.recordCustomerPayment({
        customerId: customer.id,
        amount:     amt,
        notes:      payNote.trim() || null,
        createdBy:  user.id,
      });
      onUpdated(updated);
      const entries = await api.getCustomerLedger(customer.id);
      setLedger(entries);
      setAmount("");
      setPayNote("");
      setPaying(false);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to record payment");
    } finally {
      setBusy(null);
    }
  };

  const balanceDue = customer.balance_due;

  return (
    <Modal title={customer.name} onClose={onClose}>
      <div className="p-6 space-y-5 w-[520px] max-h-[80vh] overflow-y-auto">

        {/* Balance header */}
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
          balanceDue > 0
            ? "bg-amber-500/10 border-amber-500/20"
            : "bg-emerald-500/10 border-emerald-500/20"
        }`}>
          <div>
            <p className="text-slate-400 text-xs">Outstanding balance</p>
            <p className={`font-bold text-2xl tabular-nums ${balanceDue > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {fmt(balanceDue)}
            </p>
            {customer.phone && <p className="text-slate-500 text-xs mt-0.5">{customer.phone}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            {balanceDue > 0 ? (
              <button
                onClick={() => { setPaying(!paying); setError(""); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                <Banknote size={13} /> Record payment
              </button>
            ) : (
              <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                <CheckCircle size={12} /> All settled
              </span>
            )}
          </div>
        </div>

        {/* General payment form */}
        {paying && (
          <div className="space-y-3 p-4 bg-[#0D1526] border border-[#1A2D45] rounded-xl">
            <p className="text-white text-sm font-semibold">Record payment received</p>
            <div className="flex gap-2">
              <input
                type="number" min="0" step="0.01"
                placeholder="Amount"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="flex-1 bg-[#060E1A] border border-[#1A2D45] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl px-3 py-2 text-white text-sm placeholder-slate-600 transition-colors"
              />
              <input
                type="text" placeholder="Note (optional)"
                value={payNote} onChange={e => setPayNote(e.target.value)}
                className="flex-1 bg-[#060E1A] border border-[#1A2D45] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl px-3 py-2 text-white text-sm placeholder-slate-600 transition-colors"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setPaying(false); setError(""); }}
                className="px-3 py-1.5 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleGeneralPayment} disabled={busy === "general"}
                className="px-4 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50">
                {busy === "general" ? "Saving…" : "Confirm payment"}
              </button>
            </div>
          </div>
        )}

        {loadErr && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            <AlertCircle size={13} />
            {loadErr}
            <button onClick={reload} className="ml-auto flex items-center gap-1 hover:text-red-300 cursor-pointer">
              <RefreshCw size={11} /> Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-[#14B8A6]/30 border-t-[#14B8A6] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Pending loans ─────────────────────────────────────────── */}
            {pendingSales.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-amber-400" />
                  <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide">
                    Pending loans ({pendingSales.length})
                  </p>
                </div>
                <div className="space-y-2">
                  {pendingSales.map(sale => {
                    const remaining = saleRemaining(sale.id);
                    const isThisBusy = busy === sale.id;
                    return (
                      <div key={sale.id}
                        className="flex items-center justify-between px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl gap-3">
                        <div className="min-w-0">
                          <p className="text-white text-xs font-semibold">
                            Sale #{sale.id}
                          </p>
                          <p className="text-slate-500 text-[10px] mt-0.5">
                            {new Date(sale.created_at).toLocaleString()} · Total {fmt(sale.total_amount)}
                          </p>
                          {remaining < sale.total_amount - sale.amount_paid && (
                            <p className="text-[#14B8A6] text-[10px]">
                              Partially paid — {fmt(remaining)} left
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <p className="text-amber-400 font-bold text-sm tabular-nums">
                            {fmt(remaining)}
                          </p>
                          <button
                            onClick={() => markAsReceived(sale)}
                            disabled={isThisBusy || remaining <= 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle size={11} />
                            {isThisBusy ? "Saving…" : "Received"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {error && !paying && (
                  <p className="text-red-400 text-xs px-1">{error}</p>
                )}
              </div>
            )}

            {/* ── Transaction history ───────────────────────────────────── */}
            <div className="space-y-2">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                Transaction history
              </p>
              {ledger.length === 0 ? (
                <p className="text-slate-600 text-xs py-4 text-center">No transactions yet</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {ledger.map(entry => {
                    const isPayment = entry.entry_type === "payment" || entry.entry_type === "reversal";
                    return (
                      <div key={entry.id}
                        className="flex items-center justify-between px-3 py-2.5 bg-[#0D1526] border border-[#1A2D45] rounded-xl text-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isPayment
                            ? <TrendingDown size={13} className="text-emerald-400 flex-shrink-0" />
                            : <TrendingUp   size={13} className="text-amber-400   flex-shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-white text-xs font-medium truncate">
                              {entry.entry_type === "credit"
                                ? `Loan — Sale #${entry.sale_id ?? "—"}`
                                : entry.entry_type === "payment"
                                  ? `Payment received${entry.sale_id ? ` (Sale #${entry.sale_id})` : ""}`
                                  : `Void reversal — Sale #${entry.sale_id ?? "—"}`}
                            </p>
                            <p className="text-slate-500 text-[10px]">
                              {new Date(entry.created_at).toLocaleString()}
                              {entry.notes ? ` · ${entry.notes}` : ""}
                            </p>
                          </div>
                        </div>
                        <span className={`font-bold tabular-nums text-xs flex-shrink-0 ml-3 ${isPayment ? "text-emerald-400" : "text-amber-400"}`}>
                          {isPayment ? "−" : "+"}{fmt(Math.abs(entry.amount))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Past completed sales ──────────────────────────────────── */}
            {sales.filter(s => s.status === "completed").length > 0 && (
              <div className="space-y-2">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                  Completed sales
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {sales.filter(s => s.status === "completed").map(sale => (
                    <div key={sale.id}
                      className="flex items-center justify-between px-3 py-2.5 bg-[#0D1526] border border-[#1A2D45] rounded-xl">
                      <div>
                        <p className="text-white text-xs font-medium">Sale #{sale.id}</p>
                        <p className="text-slate-500 text-[10px]">{new Date(sale.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 text-xs tabular-nums font-semibold">{fmt(sale.total_amount)}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                          Paid
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CustomersScreen({ user }: Props) {
  const { fmt } = useCurrency();
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadErr,   setLoadErr]   = useState("");
  const [search,    setSearch]    = useState("");
  const [creating,  setCreating]  = useState(false);
  const [selected,  setSelected]  = useState<CustomerWithBalance | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadErr("");
    try {
      const data = await api.getCustomers();
      setCustomers(data);
    } catch (e: unknown) {
      setLoadErr((e as { message?: string })?.message ?? "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c =>
    !search.trim() ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? "").includes(search)
  );

  const totalOwed = customers.reduce((s, c) => s + Math.max(0, c.balance_due), 0);
  const pendingCount = customers.filter(c => c.balance_due > 0).length;

  const handleUpdated = (updated: CustomerWithBalance) => {
    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelected(updated);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#020817]">

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-[#0F1E38] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center">
              <Users size={17} className="text-[#14B8A6]" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">Customers</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                {customers.length} customer{customers.length !== 1 ? "s" : ""}
                {pendingCount > 0 && ` · ${pendingCount} with outstanding loans`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load}
              className="p-2 text-slate-500 hover:text-white hover:bg-[#0D1526] rounded-xl transition-colors cursor-pointer">
              <RefreshCw size={14} />
            </button>
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#14B8A6]/10 hover:bg-[#14B8A6]/20 border border-[#14B8A6]/30 text-[#14B8A6] text-sm font-medium rounded-xl transition-colors cursor-pointer">
              <Plus size={14} /> New customer
            </button>
          </div>
        </div>

        {/* Summary banner */}
        {totalOwed > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-amber-400 text-xs font-semibold">
                {fmt(totalOwed)} outstanding across {pendingCount} customer{pendingCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <input type="text" placeholder="Search by name or phone…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0D1526] border border-[#1A2D45] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {loadErr && (
        <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
          <AlertCircle size={13} />
          {loadErr}
          <button onClick={load} className="ml-auto flex items-center gap-1 hover:text-red-300 cursor-pointer">
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      )}

      {/* Customer list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#14B8A6]/30 border-t-[#14B8A6] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Users size={44} strokeWidth={1} className="text-slate-800" />
            <p className="text-slate-500 text-sm">
              {search ? "No customers match your search" : "No customers yet — add one to get started"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#0F1E38]">
            {filtered.map(c => (
              <button key={c.id} onClick={() => setSelected(c)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[#0D1526] transition-colors cursor-pointer text-left">
                <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#14B8A6] text-sm font-bold">{c.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{c.name}</p>
                  <p className="text-slate-500 text-xs">{c.phone ?? "No phone"}</p>
                </div>
                {c.balance_due > 0 ? (
                  <div className="text-right flex-shrink-0">
                    <p className="text-amber-400 font-bold text-sm tabular-nums">{fmt(c.balance_due)}</p>
                    <p className="text-amber-400/60 text-[10px]">outstanding</p>
                  </div>
                ) : (
                  <span className="text-emerald-400 text-xs font-medium flex-shrink-0 flex items-center gap-1">
                    <CheckCircle size={11} /> Settled
                  </span>
                )}
                <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <CreateCustomerModal
          onClose={() => setCreating(false)}
          onCreate={nc => { setCustomers(prev => [nc, ...prev]); }}
        />
      )}

      {selected && (
        <CustomerDetail
          customer={selected}
          user={user}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
