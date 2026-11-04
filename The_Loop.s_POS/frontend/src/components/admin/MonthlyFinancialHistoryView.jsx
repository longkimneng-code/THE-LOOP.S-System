import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { 
  History, 
  Calendar, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  ShieldCheck, 
  Eye, 
  CheckCircle2, 
  X,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function MonthlyFinancialHistoryView({ isEmbedded = false }) {
  const { authToken, currentUser, playBeep } = usePos();

  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [selectedYear, setSelectedYear] = useState('ALL');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/finance/closing/history', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots || []);
      }
    } catch (e) {
      console.warn('Failed to load closing history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredSnapshots = snapshots.filter(s => {
    if (selectedYear === 'ALL') return true;
    return String(s.period_year) === selectedYear;
  });

  const handleExport = (periodMonth, format) => {
    const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
    const exportUrl = `/api/reports/export?reportType=FINANCIAL_ALLOCATION&format=${format}&month=${periodMonth}${token ? `&token=${token}` : ''}`;
    window.open(exportUrl, '_blank');
  };

  return (
    <div className={`flex-1 overflow-y-auto ${isEmbedded ? 'p-1' : 'p-4 sm:p-6'} bg-obsidian-950 text-slate-100 font-sans select-none space-y-6`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-obsidian-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-slate-100 font-display uppercase tracking-wider flex items-center space-x-2">
              <History className="w-5 h-5 text-brass-400" />
              <span>Monthly Financial History & Audited Snapshots</span>
            </h1>
            <span className="text-[10px] bg-brass-500/20 text-brass-400 font-mono px-2 py-0.5 rounded border border-brass-500/30 font-bold uppercase">
              Immutable Archives
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Permanent monthly closing snapshots, revenue realizations, carry-forward audits & multi-format exports.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-obsidian-900 text-slate-200 px-3 py-1.5 rounded-xl border border-obsidian-750 text-xs font-mono focus:outline-none"
          >
            <option value="ALL">All Years</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
        </div>
      </div>

      {/* Snapshots Grid */}
      <div className="space-y-3">
        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Finalized Month-End Closing Records ({filteredSnapshots.length})
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500 font-mono text-xs">
            Loading historical closing records...
          </div>
        ) : filteredSnapshots.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-obsidian-900 border border-obsidian-800 text-slate-500 space-y-2">
            <ShieldCheck className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
            <p className="font-semibold text-slate-300">No finalized monthly snapshots found yet</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              When a month ends, click "Close Month" in Monthly Revenue Allocation. The period will be permanently locked and archived here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSnapshots.map(snap => {
              const data = snap.data || {};
              const rev = data.revenue || {};
              const plan = data.plan || {};

              return (
                <div
                  key={snap.id}
                  className="p-5 rounded-2xl bg-obsidian-900 border border-obsidian-800 hover:border-obsidian-750 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-obsidian-800">
                      <div>
                        <div className="text-sm font-black font-display text-slate-100 flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-brass-400" />
                          <span>{snap.period_month}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          Closed by {snap.closed_by} on {new Date(snap.closed_at).toLocaleDateString()}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Finalized
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-obsidian-950 border border-obsidian-800">
                        <div className="text-[10px] text-slate-500 uppercase">Gross Sales</div>
                        <div className="font-bold text-slate-200 mt-0.5">${(rev.totalSales || 0).toFixed(2)}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-obsidian-950 border border-obsidian-800">
                        <div className="text-[10px] text-slate-500 uppercase">Eligible Revenue</div>
                        <div className="font-bold text-brass-400 mt-0.5">${(rev.eligibleRevenue || 0).toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-slate-400 font-mono">
                      <div className="flex justify-between">
                        <span>Total Allocated:</span>
                        <span className="text-emerald-400 font-bold">${(plan.total_allocated || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unallocated Reserve:</span>
                        <span className="text-amber-400">${(plan.unallocated_reserve || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-obsidian-800/80 flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleExport(snap.period_month, 'xlsx')}
                        className="p-1.5 rounded-lg bg-obsidian-850 hover:bg-emerald-500/20 text-emerald-400 border border-obsidian-750 transition"
                        title="Export Excel"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleExport(snap.period_month, 'docx')}
                        className="p-1.5 rounded-lg bg-obsidian-850 hover:bg-sky-500/20 text-sky-400 border border-obsidian-750 transition"
                        title="Export Word"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleExport(snap.period_month, 'pdf')}
                        className="p-1.5 rounded-lg bg-obsidian-850 hover:bg-rose-500/20 text-rose-400 border border-obsidian-750 transition"
                        title="Print PDF"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => setSelectedSnapshot(snap)}
                      className="px-3 py-1.5 rounded-lg bg-obsidian-800 hover:bg-brass-500 hover:text-obsidian-950 text-slate-200 text-xs font-bold border border-obsidian-750 transition flex items-center space-x-1"
                    >
                      <span>Review Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SNAPSHOT DETAIL MODAL */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-obsidian-800 flex items-center justify-between bg-obsidian-950/60">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-brass-400" />
                <div>
                  <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                    Finalized Monthly Financial Snapshot: {selectedSnapshot.period_month}
                  </h2>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Audited by {selectedSnapshot.closed_by} • Read-Only Historical Ledger
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedSnapshot(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto text-xs">
              {/* Budgets breakdown */}
              <div className="space-y-3">
                <h3 className="font-mono uppercase font-bold text-slate-300">
                  Allocated Categories & Actual Spending
                </h3>

                <div className="rounded-xl border border-obsidian-800 overflow-hidden">
                  <table className="w-full text-left font-mono">
                    <thead className="bg-obsidian-950 text-[10px] text-slate-400 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Rule</th>
                        <th className="py-2.5 px-3 text-right">Allocated</th>
                        <th className="py-2.5 px-3 text-right">Carry-Fwd</th>
                        <th className="py-2.5 px-3 text-right">Spent</th>
                        <th className="py-2.5 px-3 text-right">Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-obsidian-800/60 bg-obsidian-900">
                      {(selectedSnapshot.data?.budgets || []).map(b => (
                        <tr key={b.id} className="hover:bg-obsidian-850">
                          <td className="py-2.5 px-3 font-sans font-bold text-slate-200">{b.category_name}</td>
                          <td className="py-2.5 px-3 text-brass-400">{b.allocation_type === 'PERCENT' ? `${b.allocation_value}%` : `$${b.allocation_value}`}</td>
                          <td className="py-2.5 px-3 text-right">${Number(b.allocated_amount || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right text-sky-400">${Number(b.opening_carry_forward || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right text-rose-400">${Number(b.spent_amount || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">${Number(b.remaining_balance || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Capital & Loop Share Snapshot */}
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase">Capital Account Balance</div>
                  <div className="text-base font-bold text-emerald-400">${Number(selectedSnapshot.data?.capital?.balance || 0).toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500">Outstanding Advances: ${Number(selectedSnapshot.data?.capital?.outstandingRepayment || 0).toFixed(2)}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase">Loop Share Closing Pool</div>
                  <div className="text-base font-bold text-amber-400">${Number(selectedSnapshot.data?.loopShare?.balance || 0).toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500">Confidential profit-sharing balance</div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-obsidian-800 bg-obsidian-950/60 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500">
                Audit Status: Certified & Signed
              </span>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="px-4 py-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 text-slate-200 text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

