import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Users, Plus, X, ChevronRight, Banknote, AlertCircle,
  TrendingDown, TrendingUp, Clock, CheckCircle, RefreshCw,
  Search, Filter, Phone, FileText, Receipt
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import type { CustomerLedgerEntry, CustomerWithBalance, Sale, SaleItem, User } from "../types";
import { useCurrency } from "../context/CurrencyContext";
import Modal from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { PillGroup } from "../components/PillGroup";

interface Props { user: User }

const iCls = "w-full bg-[var(--bg-base)] border border-[var(--bd-base)] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl px-4 py-2.5 text-[var(--tx-base)] text-sm placeholder-slate-600 transition-colors";

// ── New customer form ─────────────────────────────────────────────────────────
function CreateCustomerModal({ onClose, onCreate }: {
  onClose:  () => void;
  onCreate: (c: CustomerWithBalance) => void;
}) {
  const { t } = useTranslation();
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy,  setBusy]  = useState(false);

  const submit = async () => {
    if (!name.trim()) { setError(t("customers.nameRequired")); return; }
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
    <Modal title={t("customers.newCustomer")} onClose={onClose}>
      <div className="p-6 space-y-4 w-[380px]">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-xs">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">
              {t("customers.fullName")} <span className="text-red-400">*</span>
            </label>
            <input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              className={iCls} placeholder="e.g. Ahmad Khalil" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">{t("customers.phone")}</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className={iCls} placeholder="+961 XX XXX XXX" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">{t("customers.notes")}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className={iCls + " resize-none"}
              placeholder={t("common.optional")} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-[var(--tx-base)] text-sm transition-colors cursor-pointer">
            {t("common.cancel")}
          </button>
          <button onClick={submit} disabled={busy}
            className="px-5 py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-semibold text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50">
            {busy ? t("customers.creating") : t("customers.create")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Customer Detail Card (Right Pane) ─────────────────────────────────────────
function CustomerDetailCard({ customer, user, onUpdated }: {
  customer:  CustomerWithBalance;
  user:      User;
  onUpdated: (c: CustomerWithBalance) => void;
}) {
  const { t } = useTranslation();
  const { fmt, toDb } = useCurrency();

  const [ledger,  setLedger]  = useState<CustomerLedgerEntry[]>([]);
  const [sales,   setSales]   = useState<Sale[]>([]);
  const [pendingItems, setPendingItems] = useState<Record<number, SaleItem[]>>({});
  const [loading, setLoading] = useState(false);
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

      const pending = s.filter(x => x.status === "pending");
      if (pending.length > 0) {
        const details = await Promise.all(pending.map(p => api.getSaleById(p.id)));
        const itemsMap: Record<number, SaleItem[]> = {};
        details.forEach(d => {
          if (d) itemsMap[d.id] = d.items;
        });
        setPendingItems(itemsMap);
      } else {
        setPendingItems({});
      }
    } catch (e: unknown) {
      setLoadErr((e as { message?: string })?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    setPaying(false);
    setError("");
  }, [customer.id]);

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
      await reload();
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
  const isSettled = balanceDue <= 0;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] border border-[var(--bd-base)] rounded-2xl overflow-hidden shadow-sm">
      {/* Detail Header */}
      <div className="p-6 border-b border-[var(--bd-faint)] bg-[var(--bg-deep)] relative overflow-hidden flex-shrink-0">
        {!isSettled && (
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
        )}
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-sm ${
              isSettled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-amber-500/10 border-amber-500/20 text-amber-500"
            }`}>
              <span className="text-2xl font-black uppercase">{customer.name.charAt(0)}</span>
            </div>
            
            <div>
              <h2 className="text-[var(--tx-base)] text-2xl font-bold">{customer.name}</h2>
              <div className="flex items-center gap-3 mt-2 text-slate-500 text-sm font-medium">
                {customer.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={14} className="text-slate-400" /> {customer.phone}
                  </span>
                )}
                {customer.notes && (
                  <span className="flex items-center gap-1.5 max-w-[200px] truncate">
                    <FileText size={14} className="text-slate-400" /> {customer.notes}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-end">
            <p className="text-slate-400 text-xs font-medium mb-1 uppercase tracking-wider">{t("customers.detail.outstandingBalance")}</p>
            <div className="flex items-center justify-end gap-2">
              <p className={`font-black text-3xl tabular-nums ${isSettled ? "text-emerald-400" : "text-amber-400"}`}>
                {fmt(balanceDue)}
              </p>
              {isSettled && <CheckCircle size={20} className="text-emerald-400" />}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="flex flex-col xl:flex-row gap-8">
          
          {/* Left Column: Actions & Pending */}
          <div className="xl:w-1/3 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
               {!isSettled ? (
                <button
                  onClick={() => { setPaying(!paying); setError(""); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 font-bold uppercase tracking-wider text-sm rounded-xl transition-all shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] hover:shadow-[0_6px_20px_rgba(20,184,166,0.23)] active:scale-95 cursor-pointer"
                >
                  <Banknote size={18} /> {t("customers.detail.recordPayment")}
                </button>
              ) : (
                <div className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider text-sm rounded-xl">
                  <CheckCircle size={18} /> {t("customers.detail.allSettled")}
                </div>
              )}
            </div>

            <AnimatePresence>
              {paying && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 p-5 bg-[var(--bg-deep)] border border-[var(--bd-base)] rounded-xl">
                    <div className="flex flex-col gap-3">
                      <input
                        type="number" min="0" step="0.01"
                        placeholder={t("customers.detail.amount")}
                        value={amount} onChange={e => setAmount(e.target.value)}
                        className="w-full bg-[var(--bg-base)] border border-[var(--bd-base)] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl px-4 py-3 text-[var(--tx-base)] text-sm transition-colors"
                      />
                      <input
                        type="text" placeholder={t("customers.detail.noteOptional")}
                        value={payNote} onChange={e => setPayNote(e.target.value)}
                        className="w-full bg-[var(--bg-base)] border border-[var(--bd-base)] focus:border-[#14B8A6]/60 focus:outline-none rounded-xl px-4 py-3 text-[var(--tx-base)] text-sm transition-colors"
                      />
                    </div>
                    {error && <p className="text-red-400 text-xs font-medium px-1">{error}</p>}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setPaying(false); setError(""); }}
                        className="flex-1 px-3 py-2.5 bg-[var(--bg-base)] border border-[var(--bd-base)] text-slate-400 hover:text-[var(--tx-base)] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer">
                        {t("common.cancel")}
                      </button>
                      <button onClick={handleGeneralPayment} disabled={busy === "general"}
                        className="flex-1 px-3 py-2.5 bg-[#14B8A6] hover:bg-[#0D9488] text-slate-900 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
                        {busy === "general" ? t("customers.detail.saving") : t("customers.detail.confirmPayment")}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {pendingSales.length > 0 && !loading && (
              <div className="flex flex-col gap-4">
                <h4 className="text-amber-500/90 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Clock size={14} /> {t("customers.detail.pendingLoans", { count: pendingSales.length })}
                </h4>
                <div className="space-y-3">
                  {pendingSales.map(sale => {
                    const remaining = saleRemaining(sale.id);
                    const isThisBusy = busy === sale.id;
                    return (
                      <div key={sale.id} className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[var(--tx-base)] text-sm font-bold">Sale #{sale.id}</p>
                            <p className="text-slate-500 text-xs mt-1">{new Date(sale.created_at).toLocaleDateString()}</p>
                          </div>
                          <p className="text-amber-400 font-bold text-lg tabular-nums">{fmt(remaining)}</p>
                        </div>
                        
                        {pendingItems[sale.id] && pendingItems[sale.id].length > 0 && (
                          <div className="bg-[var(--bg-deep)] rounded-lg p-3 mt-1 border border-amber-500/10 max-h-32 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-xs text-left">
                              <tbody>
                                {pendingItems[sale.id].map(item => (
                                  <tr key={item.id} className="border-b border-white/5 last:border-0 text-slate-400">
                                    <td className="py-1.5 font-medium text-[var(--tx-base)] pr-2">{item.product_name}</td>
                                    <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{item.quantity} × {fmt(item.unit_price)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <button
                          onClick={() => markAsReceived(sale)}
                          disabled={isThisBusy || remaining <= 0}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-base)] border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/50 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle size={14} />
                          {isThisBusy ? t("customers.detail.saving") : t("customers.detail.received")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Transaction History */}
          <div className="xl:w-2/3 flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Receipt size={14} /> {t("customers.detail.transactionHistory")}
              </h4>
              {loading && <RefreshCw size={14} className="text-[#14B8A6] animate-spin" />}
            </div>

            {loadErr ? (
              <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                <AlertCircle size={16} /> {loadErr}
                <button onClick={reload} className="ms-auto flex items-center gap-1.5 hover:text-red-300 font-bold uppercase text-xs cursor-pointer">
                  <RefreshCw size={12} /> {t("customers.detail.retry")}
                </button>
              </div>
            ) : loading ? (
              <div className="flex-1 flex items-center justify-center min-h-[200px]">
                <div className="w-8 h-8 border-2 border-[#14B8A6]/30 border-t-[#14B8A6] rounded-full animate-spin" />
              </div>
            ) : ledger.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-[var(--bd-faint)] rounded-2xl">
                <Receipt size={40} className="text-slate-600 mb-3" strokeWidth={1} />
                <p className="text-slate-500 text-sm font-medium">{t("customers.detail.noTransactions")}</p>
              </div>
            ) : (
              <div className="flex-1 space-y-3">
                {ledger.map(entry => {
                  const isPayment = entry.entry_type === "payment" || entry.entry_type === "reversal";
                  const label = entry.entry_type === "credit"
                    ? t("customers.detail.loan", { id: entry.sale_id ?? "—" })
                    : entry.entry_type === "payment"
                      ? entry.sale_id
                        ? t("customers.detail.paymentForSale", { id: entry.sale_id })
                        : t("customers.detail.paymentReceived")
                      : t("customers.detail.voidReversal", { id: entry.sale_id ?? "—" });
                  
                  return (
                    <div key={entry.id} className="flex items-center justify-between p-4 bg-[var(--bg-deep)] border border-[var(--bd-base)] rounded-xl group/item hover:border-[var(--bd-strong)] transition-colors">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                          isPayment ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                        }`}>
                          {isPayment ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[var(--tx-base)] text-sm font-bold truncate flex items-center gap-2">
                            {label}
                            {entry.sale_id && (
                              <span className="text-[10px] font-black uppercase tracking-wider bg-[var(--bg-panel)] border border-[var(--bd-base)] px-2 py-0.5 rounded-md text-slate-400">
                                #{entry.sale_id}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 text-slate-500 text-xs mt-1.5 font-medium">
                            <span>{new Date(entry.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            {entry.notes && (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                <span className="truncate max-w-[200px]">{entry.notes}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`font-black tabular-nums text-lg flex-shrink-0 ms-4 ${isPayment ? "text-emerald-400" : "text-amber-400"}`}>
                        {isPayment ? "−" : "+"}{fmt(Math.abs(entry.amount))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CustomersScreen({ user }: Props) {
  const { t } = useTranslation();
  const { fmt } = useCurrency();
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadErr,   setLoadErr]   = useState("");
  const [search,    setSearch]    = useState("");
  const [creating,  setCreating]  = useState(false);
  const [selected,  setSelected]  = useState<CustomerWithBalance | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all"|"debt"|"settled">("all");

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

  const filtered = customers.filter(c => {
    const matchS = filterStatus === "all" || (filterStatus === "debt" ? c.balance_due > 0 : c.balance_due <= 0);
    const matchQ = !search.trim() ||
                   c.name.toLowerCase().includes(search.toLowerCase()) ||
                   (c.phone ?? "").includes(search);
    return matchS && matchQ;
  });

  const statusOpts = [
    { id: "all", label: t("purchases.status.all", "All") },
    { id: "debt", label: t("customers.outstanding", "Outstanding") },
    { id: "settled", label: t("customers.settled", "Settled") },
  ] as any;

  const totalOwed = customers.reduce((s, c) => s + Math.max(0, c.balance_due), 0);
  const pendingCount = customers.filter(c => c.balance_due > 0).length;

  const handleUpdated = (updated: CustomerWithBalance) => {
    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
    if (selected?.id === updated.id) {
      setSelected(updated);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-deep)]">

      {/* Header */}
      <PageHeader
        icon={<Users size={22} className="text-[#14B8A6]" />}
        title={t("customers.title")}
        subtitle={`${customers.length} ${t("customers.title").toLowerCase()}${pendingCount > 0 ? ` · ${pendingCount} ${t("customers.outstanding")}` : ""}`}
        actions={
          <>
            <button onClick={load}
              className="w-12 h-12 rounded-2xl bg-[var(--bg-panel)] border border-[var(--bd-base)] hover:border-[var(--tx-base)] text-slate-500 hover:text-[var(--tx-base)] flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95">
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-5 py-3 bg-[#14B8A6] text-slate-900 font-bold uppercase tracking-wider text-xs rounded-2xl transition-all cursor-pointer shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] hover:shadow-[0_6px_20px_rgba(20,184,166,0.23)] hover:scale-[1.02] active:scale-95">
              <Plus size={16} /> {t("customers.newCustomer")}
            </button>
          </>
        }
        searchBlock={
          <div className="relative max-w-sm group">
            <Search size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#14B8A6] transition-colors pointer-events-none" />
            <input type="text" placeholder={t("customers.searchPlaceholder")}
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--bg-panel)] border border-[var(--bd-base)] focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20 focus:outline-none rounded-2xl ps-12 pe-4 py-3 text-[var(--tx-base)] text-sm font-medium placeholder-slate-400 shadow-sm transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute end-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--tx-base)] cursor-pointer">
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
            <PillGroup
              options={statusOpts}
              value={filterStatus}
              onChange={setFilterStatus}
            />
          </>
        }
      />

      {/* Summary banner */}
      {totalOwed > 0 && (
        <div className="mx-8 mt-6 mb-2 flex items-center gap-3 px-5 py-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
          <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
          <p className="text-amber-400 text-sm font-semibold">
            {t("customers.outstandingBanner", { amount: fmt(totalOwed), count: pendingCount })}
          </p>
        </div>
      )}

      {/* Error */}
      {loadErr && (
        <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
          <AlertCircle size={13} />
          {loadErr}
          <button onClick={load} className="ms-auto flex items-center gap-1 hover:text-red-300 cursor-pointer">
            <RefreshCw size={11} /> {t("customers.detail.retry")}
          </button>
        </div>
      )}

      {/* Main Content Split View */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left List Pane */}
        <div className="w-1/3 min-w-[320px] max-w-[400px] border-r border-[var(--bd-faint)] flex flex-col bg-[var(--bg-base)]">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-[#14B8A6]/30 border-t-[#14B8A6] rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Users size={44} strokeWidth={1} className="text-slate-800" />
                <p className="text-slate-500 text-sm">
                  {search ? t("customers.noCustomersSearch") : t("customers.noCustomers")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(c => {
                  const isSettled = c.balance_due <= 0;
                  const isSelected = selected?.id === c.id;
                  
                  return (
                    <button 
                      key={c.id} 
                      onClick={() => setSelected(c)}
                      className={`w-full flex items-center gap-4 px-4 py-3 bg-[var(--bg-panel)] rounded-xl transition-all cursor-pointer text-start ${
                        isSelected 
                          ? "border-2 border-[#14B8A6] shadow-[0_0_15px_rgba(20,184,166,0.15)] ring-1 ring-[#14B8A6]/20" 
                          : "border border-[var(--bd-base)] hover:border-[#14B8A6]/50 shadow-sm hover:shadow-md"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isSettled 
                          ? "bg-emerald-500/10 text-emerald-500" 
                          : "bg-amber-500/10 text-amber-500"
                      }`}>
                        <span className="text-base font-bold uppercase">{c.name.charAt(0)}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isSelected ? "text-[#14B8A6]" : "text-[var(--tx-base)]"}`}>
                          {c.name}
                        </p>
                        <p className="text-slate-500 text-xs truncate mt-0.5">
                          {c.phone ?? t("customers.noPhone")}
                        </p>
                      </div>
                      
                      <div className="text-end flex-shrink-0">
                        <p className={`font-black text-sm tabular-nums ${isSettled ? "text-emerald-400" : "text-amber-400"}`}>
                          {fmt(c.balance_due)}
                        </p>
                        <p className={`text-[9px] font-bold uppercase tracking-wider ${isSettled ? "text-emerald-400/60" : "text-amber-400/60"}`}>
                          {isSettled ? t("customers.settled") : t("customers.outstanding")}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Detail Pane */}
        <div className="flex-1 bg-[var(--bg-deep)] p-6 overflow-hidden flex flex-col">
          {selected ? (
            <CustomerDetailCard 
              customer={selected} 
              user={user} 
              onUpdated={handleUpdated} 
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center h-full border-2 border-dashed border-[var(--bd-faint)] rounded-3xl m-2">
              <div className="w-20 h-20 bg-[var(--bg-base)] border border-[var(--bd-base)] rounded-3xl flex items-center justify-center mb-6 shadow-sm">
                <Users size={32} className="text-slate-600" />
              </div>
              <h3 className="text-[var(--tx-base)] text-lg font-bold mb-2">
                {t("customers.selectCustomer", "Select a customer")}
              </h3>
              <p className="text-slate-500 text-sm max-w-sm text-center">
                {t("customers.selectCustomerDesc", "Click on any customer from the list on the left to view their full transaction history, manage balances, and record payments.")}
              </p>
            </div>
          )}
        </div>
      </div>

      {creating && (
        <CreateCustomerModal
          onClose={() => setCreating(false)}
          onCreate={nc => { setCustomers(prev => [nc, ...prev]); }}
        />
      )}
    </div>
  );
}
