import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { 
  Lock, 
  Coins, 
  TrendingUp, 
  ArrowDownRight, 
  Plus, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  ShieldAlert, 
  CheckCircle2, 
  X,
  UserCheck
} from 'lucide-react';

export default function LoopShareManagementView({ isEmbedded = false }) {
  const { authToken, currentUser, playBeep, hasPermission } = usePos();

  const [ledger, setLedger] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDistributeOpen, setIsDistributeOpen] = useState(false);
  const [toast, setToast] = useState('');

  const [form, setForm] = useState({
    transactionType: 'DISTRIBUTION',
    amount: '',
    recipientName: '',
    description: ''
  });

  const isOwner = currentUser?.role === 'OWNER' || currentUser?.role === 'SUPER_ADMIN';
  const canView = isOwner || hasPermission('viewLoopShare') || hasPermission('manageStoreShare') || currentUser?.permissions?.manageStoreShare === true;
  const canManage = isOwner || hasPermission('manageLoopShare') || hasPermission('manageStoreShare') || currentUser?.permissions?.manageStoreShare === true;

  const showToast = (msg) => {
    setToast(msg);
    playBeep(1200, 'sine', 0.1);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchLoopShareData = async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/finance/loop-share/ledger', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance || 0);
        setLedger(data.transactions || []);
      }
    } catch (e) {
      console.warn('Failed to load Loop Share ledger:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoopShareData();
  }, [canView]);

  if (!canView) {
    if (isEmbedded) return null;
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-obsidian-950 text-slate-400 font-sans">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-slate-100 uppercase font-display">
          Access Restricted: Confidential Section
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-md text-center">
          Loop Share profit-sharing records and distributions are strictly confidential and restricted to business owners and authorized partners.
        </p>
      </div>
    );
  }

  const handleDistributeSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return;

    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/finance/loop-share/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount)
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to record transaction');

      showToast(`Loop Share ${form.transactionType} of $${parseFloat(form.amount).toFixed(2)} recorded!`);
      setIsDistributeOpen(false);
      setForm({
        transactionType: 'DISTRIBUTION',
        amount: '',
        recipientName: '',
        description: ''
      });
      fetchLoopShareData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExport = (format) => {
    const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
    const exportUrl = `/api/reports/export?reportType=LOOP_SHARE&format=${format}${token ? `&token=${token}` : ''}`;
    window.open(exportUrl, '_blank');
  };

  const totalDistributed = ledger
    .filter(t => t.transaction_type === 'DISTRIBUTION' || t.transaction_type === 'WITHDRAWAL')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-obsidian-950 text-slate-100 font-sans select-none space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 p-3 bg-emerald-500 text-obsidian-950 rounded-xl shadow-xl font-bold text-xs flex items-center space-x-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-obsidian-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-slate-100 font-display uppercase tracking-wider flex items-center space-x-2">
              <Coins className="w-5 h-5 text-amber-400" />
              <span>Confidential Loop Share Management</span>
            </h1>
            <span className="text-[10px] bg-rose-500/20 text-rose-400 font-mono px-2 py-0.5 rounded border border-rose-500/30 font-bold uppercase flex items-center space-x-1">
              <Lock className="w-2.5 h-2.5" />
              <span>Owner Only</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Stakeholder profit-sharing balance, monthly allocations, partner distributions & audit trail.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Export Dropdown Group */}
          <div className="flex items-center bg-obsidian-900 border border-obsidian-850 rounded-xl overflow-hidden p-0.5">
            <button
              onClick={() => handleExport('xlsx')}
              className="px-2.5 py-1.5 hover:bg-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center space-x-1 transition"
              title="Export to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <span className="text-obsidian-750">|</span>
            <button
              onClick={() => handleExport('docx')}
              className="px-2.5 py-1.5 hover:bg-sky-500/20 text-sky-400 text-xs font-mono flex items-center space-x-1 transition"
              title="Export to Word (.docx)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Word</span>
            </button>
            <span className="text-obsidian-750">|</span>
            <button
              onClick={() => handleExport('pdf')}
              className="px-2.5 py-1.5 hover:bg-rose-500/20 text-rose-400 text-xs font-mono flex items-center space-x-1 transition"
              title="Print / Save PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>

          {canManage && (
            <button
              onClick={() => setIsDistributeOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs shadow-md shadow-brass-500/20 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Record Distribution</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-obsidian-900 border border-obsidian-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Coins className="w-3.5 h-3.5 text-brass-400" />
            <span>Available Loop Share Pool</span>
          </div>
          <div className="text-3xl font-black font-display text-brass-400 mt-1">
            ${balance.toFixed(2)}
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            Net undistributed balance ready for withdrawal or reinvestment
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-obsidian-900 border border-obsidian-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <ArrowDownRight className="w-3.5 h-3.5 text-sky-400" />
            <span>Total Distributed</span>
          </div>
          <div className="text-3xl font-black font-display text-sky-400 mt-1">
            ${totalDistributed.toFixed(2)}
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            Historical payouts made to registered stakeholders
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-obsidian-900 border border-obsidian-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Total Transactions</span>
          </div>
          <div className="text-3xl font-black font-display text-slate-100 mt-1">
            {ledger.length}
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            Audited contributions, distributions & manual allocations
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl border border-obsidian-800 bg-obsidian-900/60 overflow-hidden space-y-2">
        <div className="p-4 border-b border-obsidian-800 flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase text-slate-300">
            Loop Share Transaction History & Audit Ledger
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            Immutable Historical Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-obsidian-900 text-slate-400 font-mono uppercase text-[11px] border-b border-obsidian-800">
              <tr>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Balance After</th>
                <th className="py-3 px-4">Authorized By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-800/60">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-slate-500 font-mono">
                    Loading Loop Share records...
                  </td>
                </tr>
              ) : ledger.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-500">
                    <Coins className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-50" />
                    <p className="font-semibold text-slate-400">No Loop Share transactions recorded yet</p>
                    <p className="text-[11px] text-slate-500 mt-1">Monthly allocations from collected revenue will accumulate here.</p>
                  </td>
                </tr>
              ) : (
                ledger.map(t => {
                  const isCredit = t.transaction_type === 'ALLOCATION' || t.transaction_type === 'ADJUSTMENT_ADD';
                  return (
                    <tr key={t.id} className="hover:bg-obsidian-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-brass-400">
                        {t.reference}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {new Date(t.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          isCredit ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {t.transaction_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-200">
                        {t.description}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-300">
                        {t.recipient_name || 'Founder Reserve'}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isCredit ? '+' : '-'}${Number(t.amount || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-100">
                        ${Number(t.balance_after || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {t.authorized_by}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD DISTRIBUTION MODAL */}
      {isDistributeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                Record Loop Share Payout
              </h2>
              <button onClick={() => setIsDistributeOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDistributeSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800 text-xs">
                <span className="text-slate-400">Current Available Pool: </span>
                <strong className="text-brass-400 font-mono">${balance.toFixed(2)}</strong>
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                  Payout Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={balance}
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 font-mono font-bold focus:outline-none focus:border-brass-400 text-sm"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                  Recipient / Stakeholder Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Partner Long Kimneng"
                  value={form.recipientName}
                  onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-brass-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                  Description / Purpose *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Founder Profit Sharing Distribution"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-brass-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs shadow-md shadow-brass-500/20 active:scale-98 transition"
              >
                Confirm Payout Distribution
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

