import React, { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  RotateCcw, 
  Percent, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Receipt,
  User,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';

export default function PosDashboardView() {
  const { 
    formatPrice, 
    toKhr, 
    exchangeRate, 
    setSelectedTransaction, 
    setIsTransactionDetailOpen,
    setActiveTab,
    playBeep,
    authToken
  } = usePos();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/dashboard/stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('[Dashboard] Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 6000);
    return () => clearInterval(interval);
  }, []);

  const kpi = stats?.kpi || {
    todaySalesUsd: 0,
    todaySalesKhr: 0,
    transactionCount: 0,
    discountsTotal: 0,
    cashSalesUsd: 0,
    cashSalesKhr: 0,
    khqrSalesUsd: 0,
    exchangeRate: exchangeRate
  };

  const shift = stats?.shift || {};
  const recentOrders = stats?.recentOrders || [];
  const lowStock = stats?.lowStockAlerts || [];

  return (
    <div className="flex-1 overflow-y-auto bg-obsidian-950 p-6 space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-obsidian-800">
        <div>
          <div className="text-xs font-mono text-brass-400 uppercase tracking-widest">Store Operations & Telemetry</div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <span>POS Performance Dashboard</span>
            <span className="text-xs font-normal text-slate-400 bg-obsidian-850 px-2 py-0.5 rounded border border-obsidian-800">
              Live Feed
            </span>
          </h2>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              playBeep(880, 'sine', 0.05);
              fetchStats();
            }}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 border border-obsidian-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brass-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setActiveTab('REGISTER')}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-brass-500 hover:bg-brass-400 text-obsidian-950 shadow-md shadow-brass-500/20 transition active:scale-95"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>New Sale</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Today's Total Sales */}
        <div className="bg-obsidian-900 border border-obsidian-700/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Today's Gross Sales</span>
            <span className="p-1.5 rounded-lg bg-brass-500/10 text-brass-400 border border-brass-500/20">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">
            ${kpi.todaySalesUsd.toFixed(2)}
          </div>
          <div className="text-xs font-mono text-brass-400/90 mt-1 flex items-center justify-between">
            <span>{kpi.todaySalesKhr.toLocaleString()} ៛</span>
            {kpi.totalGrossSalesUsd > 0 && (
              <span className="text-[10px] text-slate-400 font-sans">
                All-time: <strong className="text-slate-200 font-mono">${kpi.totalGrossSalesUsd.toFixed(2)}</strong>
              </span>
            )}
          </div>
        </div>

        {/* 2. Total Transactions */}
        <div className="bg-obsidian-900 border border-obsidian-700/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Transactions Settled</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">
            {kpi.transactionCount}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span>Avg Ticket: <span className="text-slate-200 font-mono">${kpi.transactionCount > 0 ? (kpi.todaySalesUsd / kpi.transactionCount).toFixed(2) : '0.00'}</span></span>
            {kpi.totalTransactionCount > 0 && (
              <span className="text-[10px] text-slate-400 font-sans">
                Total: <strong className="text-slate-200 font-mono">{kpi.totalTransactionCount}</strong>
              </span>
            )}
          </div>
        </div>

        {/* 3. Cash Flow in Drawer */}
        <div className="bg-obsidian-900 border border-obsidian-700/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Cash Collected (Today)</span>
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono">
            ${kpi.cashSalesUsd.toFixed(2)}
          </div>
          <div className="text-xs font-mono text-sky-400 mt-1">
            + {kpi.cashSalesKhr.toLocaleString()} ៛ Cash
          </div>
        </div>

        {/* 4. Active Shift Status */}
        <div className="bg-obsidian-900 border border-obsidian-700/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Current Shift</span>
            <span className={`p-1.5 rounded-lg ${shift.hasActiveShift ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-base font-bold text-slate-100 truncate">
            {shift.cashierName}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span className="font-mono text-emerald-400">{shift.hasActiveShift ? 'SHIFT OPEN' : 'NO ACTIVE SHIFT'}</span>
            <span className="font-mono text-slate-300">Exp: ${shift.expectedCash || '0.00'}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Orders (Left 7 cols) & Low Stock Alerts (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Transactions Table */}
        <div className="lg:col-span-8 bg-obsidian-900 border border-obsidian-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-brass-400" />
              <h3 className="text-sm font-semibold text-slate-200">Recent Completed Transactions</h3>
            </div>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className="text-xs text-brass-400 hover:text-brass-300 flex items-center space-x-1 font-medium hover:underline"
            >
              <span>View Full History</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-obsidian-800 rounded-xl">
              No transactions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-obsidian-800 text-slate-400 font-mono">
                    <th className="pb-2">Receipt #</th>
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Customer</th>
                    <th className="pb-2">Items</th>
                    <th className="pb-2 text-right">USD Total</th>
                    <th className="pb-2 text-right">KHR Total</th>
                    <th className="pb-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-800/60 font-mono">
                  {recentOrders.map((ord) => (
                    <tr
                      key={ord.id}
                      onClick={() => {
                        setSelectedTransaction(ord);
                        setIsTransactionDetailOpen(true);
                      }}
                      className="hover:bg-obsidian-850/80 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 font-bold text-brass-400">{ord.orderNumber}</td>
                      <td className="py-2.5 text-slate-400">
                        {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 text-slate-200 font-sans">{ord.customerName || 'Walk-in Patron'}</td>
                      <td className="py-2.5 text-slate-400">{ord.linesCount || 1} item(s)</td>
                      <td className="py-2.5 text-right font-bold text-slate-100">
                        ${Number(ord.totalAmount).toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right text-brass-400/90">
                        {Number(ord.khrTotal).toLocaleString()} ៛
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          ord.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {ord.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Low Stock Alerts & Warnings */}
        <div className="lg:col-span-4 bg-obsidian-900 border border-obsidian-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-200">Inventory Depletion Alerts</h3>
          </div>

          {lowStock.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-obsidian-800 rounded-xl">
              All retail products have healthy stock balances.
            </div>
          ) : (
            <div className="space-y-2">
              {lowStock.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-obsidian-950 border border-obsidian-800 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-slate-200 font-medium truncate">{item.name}</div>
                    <div className="text-[10px] font-mono text-slate-500 truncate">
                      SKU: {item.sku} • {item.title}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      item.isOut
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {item.isOut ? 'OUT OF STOCK' : `${item.onHand} left`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-3 rounded-lg bg-obsidian-950/80 border border-obsidian-800 text-[11px] text-slate-400 flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-brass-400 shrink-0 mt-0.5" />
            <span>
              Real-time stock depletion syncs automatically from <strong>Stock Management Loops (Port 3000)</strong>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

