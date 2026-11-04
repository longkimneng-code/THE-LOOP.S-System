import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import {
  Clock,
  Search,
  Filter,
  Calendar,
  User,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  X,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function ShiftHistoryView() {
  const { exchangeRate, toKhr, playBeep } = usePos();

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [discrepancyFilter, setDiscrepancyFilter] = useState('ALL');
  const [selectedShiftDetails, setSelectedShiftDetails] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        dateRange,
        status: statusFilter,
        hasDiscrepancy: discrepancyFilter
      });
      const res = await fetch(`/api/shifts/history?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setShifts(data.shifts || []);
      }
    } catch (e) {
      console.warn('Failed to load shift history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, [dateRange, statusFilter, discrepancyFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchShifts();
  };

  const handleOpenDetail = async (shiftId) => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedShiftDetails(data);
        setIsDetailModalOpen(true);
        playBeep(950, 'sine', 0.08);
      }
    } catch (e) {
      console.warn('Could not load shift details:', e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-950 overflow-hidden select-none font-sans">
      {/* 1. Header & Filters Toolbar */}
      <div className="p-5 border-b border-obsidian-800 bg-obsidian-900/60 space-y-4 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-100 uppercase tracking-wide font-display flex items-center space-x-2">
              <Clock className="w-5 h-5 text-brass-400" />
              <span>Shift History & Reconciliation</span>
            </h1>
            <p className="text-xs text-slate-400">
              Complete historical record of register shifts, cashier working hours, dual-currency tenders, and cash drawer reconciliations.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              onClick={fetchShifts}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-xs text-slate-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brass-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="sm:col-span-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Shift ID, Cashier..."
              className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-brass-500 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-slate-200 outline-none"
            />
          </form>

          {/* Date Range Selector */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-brass-500 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono outline-none appearance-none"
            >
              <option value="ALL">Date Range: All Time</option>
              <option value="TODAY">Date Range: Today</option>
              <option value="7DAYS">Date Range: Past 7 Days</option>
              <option value="30DAYS">Date Range: Past 30 Days</option>
            </select>
          </div>

          {/* Shift Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-brass-500 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono outline-none appearance-none"
            >
              <option value="ALL">Status: All Shifts</option>
              <option value="ACTIVE">Status: Currently Open</option>
              <option value="CLOSED">Status: Closed</option>
            </select>
          </div>

          {/* Discrepancy Filter */}
          <div className="relative">
            <select
              value={discrepancyFilter}
              onChange={(e) => setDiscrepancyFilter(e.target.value)}
              className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-brass-500 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono outline-none appearance-none"
            >
              <option value="ALL">Cash Variance: All</option>
              <option value="YES">Variance: Discrepancy Only</option>
              <option value="NO">Variance: Perfectly Balanced</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Shifts Table List */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading && shifts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-2 text-xs font-mono text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin text-brass-400" />
            <span>Loading shift records...</span>
          </div>
        ) : shifts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-2 text-xs text-slate-500 bg-obsidian-900/40 rounded-2xl border border-obsidian-800">
            <Clock className="w-8 h-8 text-slate-600 mb-1" />
            <span>No shift records found matching your filter criteria.</span>
          </div>
        ) : (
          <div className="bg-obsidian-900 border border-obsidian-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-obsidian-850 border-b border-obsidian-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Shift ID / Reg</th>
                    <th className="py-3 px-4">Cashier</th>
                    <th className="py-3 px-4">Open & Close Time</th>
                    <th className="py-3 px-4 text-right">Gross Sales</th>
                    <th className="py-3 px-4 text-right">Expected Drawer</th>
                    <th className="py-3 px-4 text-right">Counted Cash</th>
                    <th className="py-3 px-4 text-right">Difference</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-800/60">
                  {shifts.map((s) => {
                    const diff = Number(s.cashOverShort || 0);
                    const hasDiff = Math.abs(diff) >= 0.05;
                    const isOpen = s.status === 'ACTIVE';

                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-obsidian-850/50 transition-colors group cursor-pointer"
                        onClick={() => handleOpenDetail(s.id)}
                      >
                        <td className="py-3 px-4 font-bold text-slate-200">
                          <div>{s.id}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{s.registerCode || 'REG-01'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-200 font-semibold">{s.cashierName || 'Cashier'}</div>
                          <div className="text-[10px] text-slate-500">{s.cashierUserId}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <div>{new Date(s.openedAt).toLocaleString()}</div>
                          <div className="text-[10px] text-slate-500">
                            {s.closedAt ? `Closed: ${new Date(s.closedAt).toLocaleTimeString()} (${s.summary?.durationHours || ''})` : '🟢 Shift in progress'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          ${s.summary?.totalSalesRevenueUsd || '0.00'}
                          <div className="text-[10px] text-slate-500 font-normal">{s.summary?.totalOrderCount || 0} orders</div>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          ${s.summary?.expectedCashInDrawer || '0.00'}
                          <div className="text-[10px] text-slate-500">USD + KHR</div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-100">
                          {s.countedCash ? `$${s.countedCash}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold">
                          {isOpen ? (
                            <span className="text-slate-500 text-[11px]">Active</span>
                          ) : hasDiff ? (
                            <span className={`px-2 py-0.5 rounded text-[11px] ${diff > 0 ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                              {diff >= 0 ? '+' : ''}${diff.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-[11px] flex items-center justify-end space-x-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>$0.00</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            isOpen ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {isOpen ? 'OPEN' : 'CLOSED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(s.id);
                            }}
                            className="p-1.5 rounded-lg bg-obsidian-800 hover:bg-brass-500 hover:text-obsidian-950 text-slate-400 transition-colors"
                            title="Inspect complete shift report"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 3. Detailed Shift Inspection Modal */}
      {isDetailModalOpen && selectedShiftDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-900 border border-obsidian-750 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-obsidian-800 flex items-center justify-between bg-obsidian-850">
              <div>
                <div className="text-[10px] font-mono text-brass-400 uppercase tracking-widest font-bold">
                  Shift Reconciliation Audit Record
                </div>
                <h3 className="text-base font-bold text-slate-100 font-sans">
                  Shift #{selectedShiftDetails.shift.id} ({selectedShiftDetails.shift.registerCode})
                </h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs font-mono">
              {/* Telemetry Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-obsidian-950 rounded-xl border border-obsidian-800">
                  <span className="text-[10px] text-slate-500 uppercase">Cashier</span>
                  <div className="font-bold text-slate-200 mt-1">{selectedShiftDetails.shift.cashierName}</div>
                </div>
                <div className="p-3 bg-obsidian-950 rounded-xl border border-obsidian-800">
                  <span className="text-[10px] text-slate-500 uppercase">Working Hours</span>
                  <div className="font-bold text-brass-400 mt-1">{selectedShiftDetails.summary.durationHours}</div>
                </div>
                <div className="p-3 bg-obsidian-950 rounded-xl border border-obsidian-800">
                  <span className="text-[10px] text-slate-500 uppercase">Orders Sold</span>
                  <div className="font-bold text-emerald-400 mt-1">{selectedShiftDetails.summary.totalOrderCount} orders</div>
                </div>
                <div className="p-3 bg-obsidian-950 rounded-xl border border-obsidian-800">
                  <span className="text-[10px] text-slate-500 uppercase">Net Revenue</span>
                  <div className="font-bold text-emerald-400 mt-1">${selectedShiftDetails.summary.totalSalesRevenueUsd}</div>
                </div>
              </div>

              {/* Cash Reconciliation Box */}
              <div className="bg-obsidian-950 p-4 rounded-2xl border border-obsidian-800 space-y-2.5">
                <div className="text-[11px] font-bold text-slate-200 uppercase tracking-wider border-b border-obsidian-800 pb-2">
                  Dual-Currency Cash Drawer Reconciliation
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Starting Float:</span>
                  <span className="text-slate-200">${selectedShiftDetails.shift.openingFloatUsd} USD + {(selectedShiftDetails.shift.openingFloatKhr || 0).toLocaleString()} ៛</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Cash Tendered (USD):</span>
                  <span className="text-slate-200">${selectedShiftDetails.summary.cashSalesUsd} USD</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Cash Tendered (KHR):</span>
                  <span className="text-slate-200">{(selectedShiftDetails.summary.cashSalesKhr || 0).toLocaleString()} ៛</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Expected Cash (USD + KHR):</span>
                  <span className="text-slate-200">${selectedShiftDetails.summary.expectedCashInDrawer}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Actual Counted Cash:</span>
                  <span className="text-brass-400 font-bold">${selectedShiftDetails.shift.countedCash || '0.00'}</span>
                </div>
                <div className="flex justify-between border-t border-obsidian-800 pt-2 font-bold">
                  <span>Cash Discrepancy:</span>
                  <span className={Math.abs(Number(selectedShiftDetails.shift.cashOverShort || 0)) < 0.05 ? 'text-emerald-400' : 'text-rose-400'}>
                    ${selectedShiftDetails.shift.cashOverShort || '0.00'}
                  </span>
                </div>
                {selectedShiftDetails.shift.closingNotes && (
                  <div className="mt-2 p-2.5 rounded-xl bg-obsidian-900 border border-obsidian-800 text-[11px] text-slate-300">
                    <span className="text-slate-500 font-bold">Closing Notes: </span>
                    {selectedShiftDetails.shift.closingNotes}
                  </div>
                )}
              </div>

              {/* Audit Trail */}
              {selectedShiftDetails.shift.auditTrail && selectedShiftDetails.shift.auditTrail.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-300 uppercase">Audit History</div>
                  <div className="bg-obsidian-950 p-3 rounded-xl border border-obsidian-800 space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedShiftDetails.shift.auditTrail.map((a, i) => (
                      <div key={i} className="text-[10px] text-slate-400 flex justify-between">
                        <span>{a.action} by {a.by}: {a.details || a.reason}</span>
                        <span className="text-slate-600">{new Date(a.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-obsidian-800 bg-obsidian-850 flex justify-end space-x-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 text-slate-300 text-xs font-bold uppercase flex items-center space-x-2"
              >
                <Printer className="w-3.5 h-3.5 text-brass-400" />
                <span>Print Z-Report</span>
              </button>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 text-xs font-bold uppercase"
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

