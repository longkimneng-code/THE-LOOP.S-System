import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import {
  Clock,
  ShieldCheck,
  Store,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  X,
  ArrowRight,
  TrendingUp,
  User,
  Layers
} from 'lucide-react';

export default function ManagerShiftDashboardView() {
  const { cashierUser, playBeep, exchangeRate, currentStore, authToken } = usePos();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedShiftForReopen, setSelectedShiftForReopen] = useState(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/shifts/manager/dashboard', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (e) {
      console.warn('Failed to load manager shift telemetry:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleReopenShift = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) return;

    setReopening(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/shifts/${selectedShiftForReopen.id}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerUserId: cashierUser?.id,
          reason: reopenReason.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to reopen shift');

      playBeep(1200, 'sine', 0.15);
      setFeedback({ type: 'success', text: `Shift #${selectedShiftForReopen.id} successfully reopened.` });
      setSelectedShiftForReopen(null);
      setReopenReason('');
      await fetchDashboard();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
      playBeep(400, 'sawtooth', 0.15);
    } finally {
      setReopening(false);
    }
  };

  const registers = dashboardData?.registers || [];
  const activeShifts = dashboardData?.activeShifts || [];
  const shiftsWithDiscrepancy = dashboardData?.shiftsWithDiscrepancy || [];
  const cashiers = dashboardData?.cashiers || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-950 overflow-hidden select-none font-sans">
      {/* 1. Header Toolbar */}
      <div className="p-5 border-b border-obsidian-800 bg-obsidian-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-100 uppercase tracking-wide font-display flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-brass-400" />
            <span>Manager Shift Control Center</span>
          </h1>
          <p className="text-xs text-slate-400">
            Real-time supervisor command over active cashier shifts, cash drawer balances, and discrepancy audits.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{activeShifts.length} Shift{activeShifts.length === 1 ? '' : 's'} Active</span>
          </div>

          <button
            onClick={fetchDashboard}
            className="p-2 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-slate-300 transition-colors"
            title="Refresh Station Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brass-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {feedback && (
          <div className={`p-4 rounded-xl border text-xs flex items-center space-x-3 animate-in fade-in ${
            feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Register Station Grid */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            Live Register Workstations
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {registers.map((reg) => {
              const active = reg.activeShift;
              const hasActive = !!active;
              const summary = active?.summary || {};

              return (
                <div
                  key={reg.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    hasActive
                      ? 'bg-obsidian-900 border-brass-500/40 shadow-lg shadow-brass-500/5'
                      : 'bg-obsidian-900/40 border-obsidian-800'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        hasActive ? 'bg-brass-500 text-obsidian-950 shadow-md shadow-brass-500/20' : 'bg-obsidian-800 text-slate-500'
                      }`}>
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-100">{reg.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{reg.code} • {reg.storeName || currentStore?.name || 'Main Branch'}</div>
                      </div>
                    </div>

                    <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      hasActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}>
                      {hasActive ? 'ACTIVE SHIFT' : 'REGISTER CLOSED'}
                    </span>
                  </div>

                  {hasActive ? (
                    <div className="space-y-3 font-mono text-xs">
                      <div className="grid grid-cols-2 gap-2 bg-obsidian-950 p-3 rounded-xl border border-obsidian-800">
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Cashier on Duty</div>
                          <div className="text-slate-200 font-bold mt-0.5">{active.cashierName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500 uppercase">Shift Duration</div>
                          <div className="text-brass-400 font-bold mt-0.5">{summary.durationHours || 'Active'}</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-slate-300 px-1">
                        <span>Current Sales Revenue:</span>
                        <span className="font-bold text-emerald-400 text-sm">${summary.totalSalesRevenueUsd || '0.00'}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-400 px-1">
                        <span>Expected Cash in Drawer:</span>
                        <span className="font-bold text-slate-200">${summary.expectedCashInDrawer || '0.00'}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-400 px-1">
                        <span>Completed Orders:</span>
                        <span className="text-slate-300">{summary.totalOrderCount || 0} transactions</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-500 font-mono">
                      No shift is currently open on this register.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Closed Shifts with Discrepancies (Manager Audit & Reopen Action) */}
        <div className="bg-obsidian-900 border border-obsidian-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Reconciliation Discrepancy Audits</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Closed shifts with cash variances requiring supervisor inspection or authorized reopening.
              </p>
            </div>
          </div>

          {shiftsWithDiscrepancy.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 font-mono">
              No cash discrepancies detected on closed shifts. All registers balanced.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-obsidian-800 text-slate-500 uppercase text-[10px]">
                    <th className="py-2.5">Shift ID</th>
                    <th className="py-2.5">Cashier</th>
                    <th className="py-2.5">Closed At</th>
                    <th className="py-2.5 text-right">Expected</th>
                    <th className="py-2.5 text-right">Counted</th>
                    <th className="py-2.5 text-right">Discrepancy</th>
                    <th className="py-2.5">Closing Note</th>
                    <th className="py-2.5 text-right">Manager Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-800/60">
                  {shiftsWithDiscrepancy.map((s) => (
                    <tr key={s.id} className="hover:bg-obsidian-850/40">
                      <td className="py-2.5 font-bold text-slate-200">{s.id}</td>
                      <td className="py-2.5 text-slate-300">{s.cashierName}</td>
                      <td className="py-2.5 text-slate-400">{new Date(s.closedAt).toLocaleString()}</td>
                      <td className="py-2.5 text-right text-slate-300">${s.expectedCash}</td>
                      <td className="py-2.5 text-right font-bold text-slate-100">${s.countedCash}</td>
                      <td className="py-2.5 text-right font-bold text-rose-400">
                        {Number(s.cashOverShort) >= 0 ? '+' : ''}${s.cashOverShort}
                      </td>
                      <td className="py-2.5 text-slate-400 max-w-xs truncate" title={s.closingNotes}>
                        {s.closingNotes || '—'}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => setSelectedShiftForReopen(s)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold uppercase transition-colors"
                        >
                          Reopen Shift
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 3. Reopen Shift Modal (Section 13.4 & 13.7) */}
      {selectedShiftForReopen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-900 border border-obsidian-750 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-obsidian-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center space-x-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>Reopen Shift #{selectedShiftForReopen.id}</span>
              </h3>
              <button
                onClick={() => setSelectedShiftForReopen(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Reopening a closed shift returns it to <strong className="text-emerald-400">ACTIVE</strong> status so transactions can be resumed or corrected. An audit record will be permanently logged under your name.
            </p>

            <form onSubmit={handleReopenShift} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5">
                  Manager Authorization Reason (Required)
                </label>
                <textarea
                  rows={3}
                  required
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. Approved cash drawer recount after resolving tender misclassification..."
                  className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-brass-500 rounded-xl p-3 text-xs text-slate-200 outline-none"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setSelectedShiftForReopen(null)}
                  className="flex-1 py-2.5 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-slate-300 text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reopening || !reopenReason.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-obsidian-950 text-xs font-bold uppercase tracking-wider transition-all shadow-md"
                >
                  {reopening ? 'Reopening...' : 'Confirm Reopen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

