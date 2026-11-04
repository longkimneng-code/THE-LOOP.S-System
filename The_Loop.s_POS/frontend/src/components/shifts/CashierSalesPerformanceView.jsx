import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import {
  User,
  Calendar,
  DollarSign,
  TrendingUp,
  Receipt,
  RotateCcw,
  Clock,
  Coins,
  Percent,
  CheckCircle2,
  RefreshCw,
  Search,
  Layers,
  FileSpreadsheet
} from 'lucide-react';

export default function CashierSalesPerformanceView() {
  const { exchangeRate, authToken } = usePos();

  const [cashiersList, setCashiersList] = useState([]);
  const [selectedCashierId, setSelectedCashierId] = useState('');
  const [dateRange, setDateRange] = useState('ALL');
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load all staff users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
        const res = await fetch('/api/users', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const users = await res.json();
          const list = Array.isArray(users) ? users : (users.users || []);
          setCashiersList(list);
          if (list.length > 0) {
            setSelectedCashierId(list[0].id);
          }
        }
      } catch (e) {
        console.warn('Could not load staff list:', e);
      }
    };
    fetchUsers();
  }, [authToken]);

  // Fetch performance for selected cashier
  const fetchPerformance = async () => {
    if (!selectedCashierId) return;
    setLoading(true);
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch(`/api/cashiers/${selectedCashierId}/performance?dateRange=${dateRange}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setPerformanceData(data);
      }
    } catch (e) {
      console.warn('Failed to fetch cashier metrics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCashierId) {
      fetchPerformance();
    }
  }, [selectedCashierId, dateRange]);

  const metrics = performanceData?.metrics || {};
  const tenders = metrics.tenders || {};
  const cashierInfo = performanceData?.cashier || {};

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-950 overflow-hidden select-none font-sans">
      {/* 1. Header Toolbar */}
      <div className="p-5 border-b border-obsidian-800 bg-obsidian-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-100 uppercase tracking-wide font-display flex items-center space-x-2">
            <User className="w-5 h-5 text-brass-400" />
            <span>Individual Cashier Sales Performance</span>
          </h1>
          <p className="text-xs text-slate-400">
            Audit individual staff productivity, average ticket sizes, working hours, and tender breakdowns.
          </p>
        </div>

        {/* Cashier & Date Filter Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Select Cashier */}
          <div className="relative">
            <select
              value={selectedCashierId}
              onChange={(e) => setSelectedCashierId(e.target.value)}
              className="bg-obsidian-950 border border-obsidian-750 focus:border-brass-500 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 outline-none"
            >
              {cashiersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-obsidian-950 border border-obsidian-750 focus:border-brass-500 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 outline-none"
            >
              <option value="ALL">Period: All Time</option>
              <option value="TODAY">Period: Today</option>
              <option value="7DAYS">Period: Past 7 Days</option>
              <option value="30DAYS">Period: Past 30 Days</option>
            </select>
          </div>

          <button
            onClick={fetchPerformance}
            className="p-2 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-slate-300"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brass-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Main Analytics Dashboard */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading && !performanceData ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-2 text-xs font-mono text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin text-brass-400" />
            <span>Calculating individual cashier telemetry...</span>
          </div>
        ) : (
          <>
            {/* Staff Profile Overview Card */}
            <div className="bg-obsidian-900 border border-obsidian-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-brass-500/20 text-brass-400 border border-brass-500/30 font-bold text-lg flex items-center justify-center uppercase">
                  {cashierInfo.fullName?.charAt(0) || 'C'}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100 font-sans">{cashierInfo.fullName}</h2>
                  <div className="text-xs font-mono text-slate-400 flex items-center space-x-2 mt-0.5">
                    <span className="text-brass-400 font-semibold">{cashierInfo.role}</span>
                    <span className="text-slate-600">•</span>
                    <span>{cashierInfo.email}</span>
                    <span className="text-slate-600">•</span>
                    <span>ID: {cashierInfo.id}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-obsidian-950 border border-obsidian-800 text-right">
                  <div className="text-[10px] text-slate-500 uppercase">Shifts Worked</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">{metrics.shiftsWorkedCount || 0} shifts</div>
                </div>
                <div className="p-2.5 rounded-xl bg-obsidian-950 border border-obsidian-800 text-right">
                  <div className="text-[10px] text-slate-500 uppercase">Total Logged Time</div>
                  <div className="text-sm font-bold text-brass-400 mt-0.5">{metrics.totalWorkingHours || '0h 0m'}</div>
                </div>
              </div>
            </div>

            {/* 3. Core Sales Telemetry Grid (9 KPIs) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-obsidian-900 border border-obsidian-800 space-y-1">
                <div className="text-[11px] font-mono text-slate-400 uppercase flex justify-between items-center">
                  <span>Gross Sales (USD)</span>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400">${metrics.totalSalesUsd || '0.00'}</div>
                <div className="text-[10px] font-mono text-slate-500">{metrics.totalTransactions || 0} transactions</div>
              </div>

              <div className="p-4 rounded-2xl bg-obsidian-900 border border-obsidian-800 space-y-1">
                <div className="text-[11px] font-mono text-slate-400 uppercase flex justify-between items-center">
                  <span>Gross Sales (KHR)</span>
                  <Coins className="w-3.5 h-3.5 text-brass-400" />
                </div>
                <div className="text-xl font-bold font-mono text-brass-400">{(metrics.totalSalesKhr || 0).toLocaleString()} ៛</div>
                <div className="text-[10px] font-mono text-slate-500">Live rate snapshot</div>
              </div>

              <div className="p-4 rounded-2xl bg-obsidian-900 border border-obsidian-800 space-y-1">
                <div className="text-[11px] font-mono text-slate-400 uppercase flex justify-between items-center">
                  <span>Avg Basket Size</span>
                  <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-xl font-bold font-mono text-sky-400">${metrics.averageTransactionValue || '0.00'}</div>
                <div className="text-[10px] font-mono text-slate-500">Average ticket per sale</div>
              </div>

              <div className="p-4 rounded-2xl bg-obsidian-900 border border-obsidian-800 space-y-1">
                <div className="text-[11px] font-mono text-slate-400 uppercase flex justify-between items-center">
                  <span>Avg Sales / Shift</span>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-xl font-bold font-mono text-amber-400">${metrics.averageSalesPerShift || '0.00'}</div>
                <div className="text-[10px] font-mono text-slate-500">Shift productivity</div>
              </div>

              <div className="p-4 rounded-2xl bg-obsidian-900 border border-obsidian-800 space-y-1">
                <div className="text-[11px] font-mono text-slate-400 uppercase flex justify-between items-center">
                  <span>Discounts Given</span>
                  <Percent className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-lg font-bold font-mono text-slate-200">${metrics.totalDiscountsUsd || '0.00'}</div>
                <div className="text-[10px] font-mono text-slate-500">Promotions & overrides</div>
              </div>

              <div className="p-4 rounded-2xl bg-obsidian-900 border border-obsidian-800 space-y-1">
                <div className="text-[11px] font-mono text-slate-400 uppercase flex justify-between items-center">
                  <span>Refunds Processed</span>
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div className="text-lg font-bold font-mono text-rose-400">${metrics.totalRefundsUsd || '0.00'}</div>
                <div className="text-[10px] font-mono text-slate-500">{metrics.totalRefundsCount || 0} returned orders</div>
              </div>

              <div className="p-4 rounded-2xl bg-obsidian-900 border border-obsidian-800 space-y-1">
                <div className="text-[11px] font-mono text-slate-400 uppercase flex justify-between items-center">
                  <span>Cancelled Orders</span>
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-lg font-bold font-mono text-slate-300">{metrics.cancelledTransactionsCount || 0}</div>
                <div className="text-[10px] font-mono text-slate-500">Voided / aborted</div>
              </div>

              <div className="p-4 rounded-2xl bg-obsidian-900 border border-obsidian-800 space-y-1">
                <div className="text-[11px] font-mono text-slate-400 uppercase flex justify-between items-center">
                  <span>Total Shifts</span>
                  <Layers className="w-3.5 h-3.5 text-brass-400" />
                </div>
                <div className="text-lg font-bold font-mono text-brass-400">{metrics.shiftsWorkedCount || 0}</div>
                <div className="text-[10px] font-mono text-slate-500">Registers assigned</div>
              </div>
            </div>

            {/* 4. Sales by Tender Breakdown */}
            <div className="bg-obsidian-900 border border-obsidian-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                Tender Payment Collection Breakdown
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
                <div className="p-3 bg-obsidian-950 rounded-xl border border-obsidian-800">
                  <div className="text-[10px] text-slate-500 uppercase">Cash USD ($)</div>
                  <div className="text-base font-bold text-slate-100 mt-1">${tenders.cashUsd || '0.00'}</div>
                </div>
                <div className="p-3 bg-obsidian-950 rounded-xl border border-obsidian-800">
                  <div className="text-[10px] text-slate-500 uppercase">Cash KHR (៛)</div>
                  <div className="text-base font-bold text-slate-100 mt-1">{(tenders.cashKhr || 0).toLocaleString()} ៛</div>
                </div>
                <div className="p-3 bg-obsidian-950 rounded-xl border border-obsidian-800">
                  <div className="text-[10px] text-slate-500 uppercase">Credit / Debit</div>
                  <div className="text-base font-bold text-slate-100 mt-1">${tenders.cardUsd || '0.00'}</div>
                </div>
                <div className="p-3 bg-obsidian-950 rounded-xl border border-obsidian-800">
                  <div className="text-[10px] text-slate-500 uppercase">QR / Bakong KHQR</div>
                  <div className="text-base font-bold text-slate-100 mt-1">${tenders.qrUsd || '0.00'}</div>
                </div>
                <div className="p-3 bg-obsidian-950 rounded-xl border border-obsidian-800">
                  <div className="text-[10px] text-slate-500 uppercase">Store Credit</div>
                  <div className="text-base font-bold text-slate-100 mt-1">${tenders.storeCreditUsd || '0.00'}</div>
                </div>
              </div>
            </div>

            {/* 5. Shifts History by Cashier */}
            <div className="bg-obsidian-900 border border-obsidian-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                Shifts Worked by {cashierInfo.fullName}
              </h3>
              {(performanceData?.shifts || []).length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 font-mono">
                  No shifts recorded for this cashier in the selected period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-obsidian-800 text-slate-500 uppercase text-[10px]">
                        <th className="py-2.5">Shift ID</th>
                        <th className="py-2.5">Register</th>
                        <th className="py-2.5">Opening Time</th>
                        <th className="py-2.5">Duration</th>
                        <th className="py-2.5 text-right">Revenue</th>
                        <th className="py-2.5 text-right">Discrepancy</th>
                        <th className="py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-obsidian-800/60">
                      {performanceData.shifts.map((s) => (
                        <tr key={s.id} className="hover:bg-obsidian-850/40">
                          <td className="py-2.5 font-bold text-slate-200">{s.id}</td>
                          <td className="py-2.5 text-slate-400">{s.registerCode}</td>
                          <td className="py-2.5 text-slate-300">{new Date(s.openedAt).toLocaleString()}</td>
                          <td className="py-2.5 text-brass-400 font-semibold">{s.duration}</td>
                          <td className="py-2.5 text-right font-bold text-emerald-400">${s.totalSalesUsd}</td>
                          <td className="py-2.5 text-right font-bold">
                            {Math.abs(Number(s.cashOverShort)) < 0.05 ? (
                              <span className="text-emerald-400">$0.00</span>
                            ) : (
                              <span className={Number(s.cashOverShort) > 0 ? 'text-sky-400' : 'text-rose-400'}>
                                {Number(s.cashOverShort) >= 0 ? '+' : ''}${Number(s.cashOverShort).toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              s.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

