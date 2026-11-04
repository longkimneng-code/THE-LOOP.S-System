import React, { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { useSync } from '../context/SyncContext';
import {
  X,
  Clock,
  DollarSign,
  Coins,
  CheckCircle2,
  AlertTriangle,
  Printer,
  FileText,
  ArrowRight,
  TrendingUp,
  RotateCcw
} from 'lucide-react';

export default function ShiftModal() {
  const {
    isShiftModalOpen,
    setIsShiftModalOpen,
    shiftInfo,
    refreshShift,
    register,
    cashierUser,
    exchangeRate,
    toKhr,
    toUsd,
    playBeep
  } = usePos();

  const { refreshStatus } = useSync();

  const [countedCashUsd, setCountedCashUsd] = useState('');
  const [countedCashKhr, setCountedCashKhr] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [zReportData, setZReportData] = useState(null);

  if (!isShiftModalOpen) return null;

  const hasActive = shiftInfo?.hasActiveShift;
  const shift = shiftInfo?.shift || {};
  const summary = shiftInfo?.summary || {};

  const expectedUsd = summary.expectedCashUsd || 0;
  const expectedKhr = summary.expectedCashKhr || 0;
  const expectedTotalUsd = summary.expectedCashInDrawer || 0;

  // Real-time calculation of counted cash and difference
  const inputUsd = Number(countedCashUsd) || 0;
  const inputKhr = Number(countedCashKhr) || 0;
  const totalCountedUsd = inputUsd + (inputKhr / (exchangeRate || 4000));
  const diffTotalUsd = totalCountedUsd - expectedTotalUsd;
  const hasDiscrepancy = Math.abs(diffTotalUsd) >= 0.05;

  const handleCloseShift = async () => {
    if (!countedCashUsd && !countedCashKhr) {
      setErrorMsg('Please enter the actual counted cash in drawer (USD and/or KHR)');
      return;
    }

    if (hasDiscrepancy && (!closingNotes || closingNotes.trim().length === 0)) {
      setErrorMsg('A cash discrepancy exists. Closing notes explaining the discrepancy are required by business policy.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null;
      const res = await fetch('/api/shifts/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          shiftId: shift?.id,
          registerId: register?.id,
          countedCashUsd: inputUsd,
          countedCashKhr: inputKhr,
          closingNotes: closingNotes.trim(),
          closedByUserId: cashierUser?.id
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to close shift');

      playBeep(1100, 'sine', 0.15);
      setZReportData(data.zReport);
      await refreshShift();
      refreshStatus();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-obsidian-900 border border-obsidian-750 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-obsidian-800 flex items-center justify-between bg-obsidian-850">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-brass-500/10 text-brass-400 border border-brass-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-brass-400 uppercase tracking-widest font-bold">
                Register & Shift Telemetry
              </div>
              <h2 className="text-base font-bold text-slate-100 font-sans">
                {hasActive ? `Active Shift: ${shift.id}` : 'Shift Completed'}
              </h2>
            </div>
          </div>

          <button
            onClick={() => setIsShiftModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Z-Report Success Screen */}
          {zReportData ? (
            <div className="space-y-5 text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-100 uppercase tracking-wide">
                  Shift Closed & Z-Report Dispatched
                </h3>
                <p className="text-xs text-slate-400">
                  Shift #{zReportData.shiftId} successfully closed. Financial ledger reconciled.
                </p>
              </div>

              {/* Z-Report Summary Box */}
              <div className="bg-obsidian-950 p-5 rounded-2xl border border-obsidian-800 text-left font-mono text-xs space-y-2.5">
                <div className="flex justify-between text-slate-400 border-b border-obsidian-800 pb-2">
                  <span>Register / Cashier:</span>
                  <span className="text-slate-200 font-bold">{zReportData.registerCode} • {zReportData.cashierName}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Sales Revenue:</span>
                  <span className="text-emerald-400 font-bold">${zReportData.tenderTotals.totalUsd} USD</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Completed Orders:</span>
                  <span className="text-slate-200 font-bold">{zReportData.orderCount} orders</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Expected Cash:</span>
                  <span className="text-slate-200">${zReportData.expectedCashUsd} USD • {zReportData.expectedCashKhr.toLocaleString()} ៛</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Actual Counted Cash:</span>
                  <span className="text-brass-400 font-bold">${zReportData.countedCashUsd} USD • {zReportData.countedCashKhr.toLocaleString()} ៛</span>
                </div>
                <div className="flex justify-between text-slate-400 border-t border-obsidian-800 pt-2">
                  <span>Difference / Variance:</span>
                  <span className={`font-bold ${Math.abs(Number(zReportData.cashDifferenceUsd)) < 0.05 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${zReportData.cashDifferenceUsd} USD ({zReportData.cashDifferenceKhr.toLocaleString()} ៛)
                  </span>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 text-slate-200 font-bold text-xs uppercase flex items-center justify-center space-x-2"
                >
                  <Printer className="w-4 h-4 text-brass-400" />
                  <span>Print Z-Report Slip</span>
                </button>
                <button
                  onClick={() => setIsShiftModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs uppercase"
                >
                  Return to Register
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Error Message */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1. Shift Key Telemetry Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Working Duration</div>
                  <div className="text-base font-bold font-mono text-brass-400 mt-1">
                    {summary.durationHours || '0h 0m'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Since {new Date(shift.openedAt || Date.now()).toLocaleTimeString()}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Gross Sales</div>
                  <div className="text-base font-bold font-mono text-emerald-400 mt-1">
                    ${summary.totalSalesRevenueUsd || '0.00'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{summary.totalOrderCount || 0} completed orders</div>
                </div>

                <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Opening Float</div>
                  <div className="text-base font-bold font-mono text-slate-200 mt-1">
                    ${summary.openingFloatUsd || '0.00'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">+ {(summary.openingFloatKhr || 0).toLocaleString()} ៛</div>
                </div>

                <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Expected Cash</div>
                  <div className="text-base font-bold font-mono text-brass-400 mt-1">
                    ${expectedTotalUsd}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">USD + KHR drawer balance</div>
                </div>
              </div>

              {/* 2. Tender Revenue Breakdown */}
              <div className="bg-obsidian-950 p-4 rounded-2xl border border-obsidian-800 space-y-3 font-mono text-xs">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Sales & Payments by Method</span>
                  <span className="text-[10px] text-brass-400">1$ = {(exchangeRate || 4000).toLocaleString()} ៛</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-400">
                  <div className="p-2.5 rounded-xl bg-obsidian-900 border border-obsidian-850 flex justify-between">
                    <span>Cash USD:</span>
                    <span className="text-slate-100 font-bold">${summary.cashSalesUsd || '0.00'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-obsidian-900 border border-obsidian-850 flex justify-between">
                    <span>Cash KHR:</span>
                    <span className="text-slate-100 font-bold">{(summary.cashSalesKhr || 0).toLocaleString()} ៛</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-obsidian-900 border border-obsidian-850 flex justify-between">
                    <span>Cards (Visa/MC):</span>
                    <span className="text-slate-100 font-bold">${summary.cardSalesUsd || '0.00'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-obsidian-900 border border-obsidian-850 flex justify-between">
                    <span>KHQR / Bank QR:</span>
                    <span className="text-slate-100 font-bold">${summary.qrSalesUsd || '0.00'}</span>
                  </div>
                </div>

                <div className="flex justify-between text-slate-400 pt-2 border-t border-obsidian-850">
                  <span>Mixed-Currency Transactions:</span>
                  <span className="text-slate-200 font-bold">{summary.mixedCurrencyTransactions || 0} orders</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Refunds Total:</span>
                  <span className="text-rose-400 font-bold">-${summary.refundTotalUsd || '0.00'} ({summary.refundCount || 0} refunds)</span>
                </div>
              </div>

              {/* 3. Shift Closing Cash Count Form (Section 13.4) */}
              <div className="p-5 rounded-2xl bg-obsidian-850 border border-obsidian-750 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                      Physical Cash Drawer Count
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Count and enter the actual physical cash currently in the drawer to close shift.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5 flex justify-between">
                      <span>Actual Counted (USD $)</span>
                      <span className="text-[10px] text-slate-500">Exp: ${expectedUsd}</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={countedCashUsd}
                        onChange={(e) => setCountedCashUsd(e.target.value)}
                        placeholder={expectedUsd.toString()}
                        className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-brass-500 rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono text-slate-100 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5 flex justify-between">
                      <span>Actual Counted (KHR ៛)</span>
                      <span className="text-[10px] text-slate-500">Exp: {expectedKhr.toLocaleString()}៛</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">៛</span>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={countedCashKhr}
                        onChange={(e) => setCountedCashKhr(e.target.value)}
                        placeholder={expectedKhr.toString()}
                        className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-brass-500 rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono text-slate-100 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Discrepancy Live Telemetry */}
                {(countedCashUsd || countedCashKhr) && (
                  <div className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
                    Math.abs(diffTotalUsd) < 0.05
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : diffTotalUsd > 0
                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    <div>
                      <span className="font-bold">
                        {Math.abs(diffTotalUsd) < 0.05 ? 'Drawer Perfectly Balanced:' : diffTotalUsd > 0 ? 'Cash Overage:' : 'Cash Shortage:'}
                      </span>
                      <span className="ml-2 font-bold text-sm">
                        {diffTotalUsd >= 0 ? '+' : ''}${diffTotalUsd.toFixed(2)} USD
                      </span>
                    </div>
                    <span>
                      {Math.abs(diffTotalUsd) < 0.05 ? 'No Discrepancy' : `${(diffTotalUsd * (exchangeRate || 4000)).toLocaleString()} ៛`}
                    </span>
                  </div>
                )}

                {/* Closing Notes (Mandatory if discrepancy exists) */}
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1 flex justify-between">
                    <span>Closing Notes & Explanations</span>
                    {hasDiscrepancy && (
                      <span className="text-[10px] text-rose-400 font-bold">* Required for Discrepancy</span>
                    )}
                  </label>
                  <textarea
                    rows={2}
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder={hasDiscrepancy ? 'Explain variance between counted cash and expected drawer balance...' : 'Optional shift closing remarks...'}
                    className={`w-full bg-obsidian-950 border rounded-xl p-3 text-xs text-slate-200 outline-none ${
                      hasDiscrepancy && !closingNotes.trim() ? 'border-rose-500/50 focus:border-rose-500' : 'border-obsidian-750 focus:border-brass-500'
                    }`}
                  />
                </div>

                {/* Action Button */}
                <button
                  type="button"
                  onClick={handleCloseShift}
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-600/20 active:scale-98 flex items-center justify-center space-x-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>{isSubmitting ? 'Closing & Generating Z-Report...' : 'Close Shift & Generate Z-Report'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
