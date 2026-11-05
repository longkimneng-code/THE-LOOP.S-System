import React, { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { 
  Receipt, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Eye, 
  Calendar, 
  DollarSign, 
  RefreshCw,
  RotateCcw,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';

export default function SalesHistoryView() {
  const { 
    setSelectedTransaction, 
    setIsTransactionDetailOpen,
    reprintReceipt,
    hasPermission,
    playBeep,
    stores = [],
    currentStore,
    currentUser,
    cashierUser,
    authToken
  } = usePos();

  const activeUser = cashierUser || currentUser;
  const isOwner = activeUser?.role === 'OWNER' || activeUser?.role === 'SUPER_ADMIN';

  const [orders, setOrders] = useState([]);
  const [metrics, setMetrics] = useState({
    totalCount: 0,
    completedCount: 0,
    refundedCount: 0,
    totalSalesUsd: 0,
    totalSalesKhr: 0,
    refundTotalUsd: 0,
    avgTicketUsd: 0
  });

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState('ALL'); // ALL, TODAY, YESTERDAY, 7DAYS
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, COMPLETED, REFUNDED
  const [paymentFilter, setPaymentFilter] = useState('ALL'); // ALL, CASH, QR_KHQR, SPLIT
  const [currencyFilter, setCurrencyFilter] = useState('ALL'); // ALL, USD, KHR

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const params = new URLSearchParams({
        search,
        storeId: storeFilter,
        dateRange,
        status: statusFilter,
        paymentMethod: paymentFilter,
        currency: currencyFilter
      });
      const res = await fetch(`/api/orders/history?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('[History] Failed to load transaction history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [storeFilter, dateRange, statusFilter, paymentFilter, currencyFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleExportCsv = () => {
    playBeep(1000, 'sine', 0.08);
    const headers = ['Order Number', 'Date', 'Cashier', 'Register', 'Status', 'USD Total', 'KHR Total', 'Exchange Rate', 'Payments'];
    const rows = orders.map(o => [
      `"${o.orderNumber}"`,
      `"${new Date(o.createdAt).toLocaleString()}"`,
      `"${o.cashierName || 'Staff'}"`,
      `"${o.registerCode || 'REG-01'}"`,
      `"${o.status}"`,
      o.totalAmount,
      o.khrTotal,
      o.exchangeRate,
      `"${(o.payments || []).map(p => `${p.method} (${p.currencyCode}): ${p.amount}`).join('; ')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `the_loops_sales_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-obsidian-950 p-6 space-y-6">
      {/* Top Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-obsidian-800">
        <div>
          <div className="text-xs font-mono text-brass-400 uppercase tracking-widest">
            Ledger & Auditing Repository
          </div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <span>Sales & Transaction History</span>
            <span className="text-xs font-normal text-slate-400 bg-obsidian-850 px-2 py-0.5 rounded border border-obsidian-800">
              {metrics.totalCount} Records
            </span>
          </h2>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 border border-obsidian-700 transition"
            title="Refresh History Feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brass-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={orders.length === 0}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-obsidian-850 hover:bg-obsidian-800 text-slate-200 border border-obsidian-700 transition shadow-sm active:scale-95 disabled:opacity-50"
            title="Export Table to CSV Spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-3.5 rounded-xl bg-obsidian-900 border border-obsidian-800">
          <span className="text-slate-400 text-[10px] uppercase block">Settled Gross (USD)</span>
          <span className="text-xl font-bold text-slate-100">${metrics.totalSalesUsd.toFixed(2)}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-obsidian-900 border border-obsidian-800">
          <span className="text-slate-400 text-[10px] uppercase block">Settled Gross (KHR)</span>
          <span className="text-xl font-bold text-brass-400">{metrics.totalSalesKhr.toLocaleString()} ៛</span>
        </div>
        <div className="p-3.5 rounded-xl bg-obsidian-900 border border-obsidian-800">
          <span className="text-slate-400 text-[10px] uppercase block">Total Orders</span>
          <span className="text-xl font-bold text-emerald-400">{metrics.completedCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-obsidian-900 border border-obsidian-800">
          <span className="text-slate-400 text-[10px] uppercase block">Refunds / Returns</span>
          <span className="text-xl font-bold text-rose-400">${metrics.refundTotalUsd.toFixed(2)}</span>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by receipt #, transaction ID, customer, barcode, or product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brass-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-brass-500 hover:bg-brass-400 text-obsidian-950 transition"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-obsidian-800/60 text-xs">
          <span className="text-slate-400 text-[11px] font-mono mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-brass-400" />
            Filters:
          </span>

          {/* Section 15.10: Store Location Filter */}
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="bg-obsidian-950 border border-brass-500/40 text-brass-400 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brass-500 font-mono cursor-pointer font-bold"
          >
            <option value="ALL">🏢 All Stores (Combined)</option>
            {stores.map((st) => (
              <option key={st.id} value={st.id}>
                📍 {st.name} ({st.code})
              </option>
            ))}
          </select>

          {/* Date Filter */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-obsidian-950 border border-obsidian-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brass-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today Only</option>
            <option value="YESTERDAY">Yesterday</option>
            <option value="7DAYS">Last 7 Days</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-obsidian-950 border border-obsidian-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brass-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed Only</option>
            <option value="REFUNDED">Refunded / Returns</option>
          </select>

          {/* Payment Method Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-obsidian-950 border border-obsidian-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brass-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="CASH">Cash Only</option>
            <option value="QR_KHQR">Bakong KHQR</option>
            <option value="SPLIT">Split Multi-Currency</option>
          </select>

          {/* Currency Filter */}
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="bg-obsidian-950 border border-obsidian-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brass-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Currencies</option>
            <option value="USD">USD ($)</option>
            <option value="KHR">Cambodian Riel (៛)</option>
          </select>

          {(search || dateRange !== 'ALL' || statusFilter !== 'ALL' || paymentFilter !== 'ALL' || currencyFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearch('');
                setDateRange('ALL');
                setStatusFilter('ALL');
                setPaymentFilter('ALL');
                setCurrencyFilter('ALL');
              }}
              className="text-xs text-brass-400 hover:underline font-mono ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 text-brass-400 animate-spin mx-auto mb-2" />
            Loading transaction records...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs space-y-2">
            <Receipt className="w-8 h-8 text-obsidian-700 mx-auto" />
            <div>No sales transactions match the selected criteria.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-obsidian-950 border-b border-obsidian-800 text-slate-400 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Store Branch</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Lines</th>
                  <th className="py-3 px-4 text-right">USD Amount</th>
                  <th className="py-3 px-4 text-right">KHR Amount</th>
                  <th className="py-3 px-4">Tender</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-800/60">
                {orders.map((ord) => (
                  <tr
                    key={ord.id}
                    className="hover:bg-obsidian-850/60 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-brass-400 cursor-pointer"
                        onClick={() => {
                          setSelectedTransaction(ord);
                          setIsTransactionDetailOpen(true);
                        }}
                    >
                      {ord.orderNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <span className="px-1.5 py-0.5 rounded bg-obsidian-850 border border-obsidian-750 text-[10px] text-brass-400 font-sans">
                        {ord.storeName || (stores.find(s => s.id === ord.storeId)?.name) || 'Main Branch'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(ord.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-200">
                      {ord.customerName || 'Walk-in Patron'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {(ord.lines && ord.lines.length > 0) ? (
                        <div className="space-y-0.5">
                          {ord.lines.map((l, idx) => (
                            <div key={idx} className="flex items-center space-x-1.5 text-[11px]">
                              <span className="text-slate-100 font-medium truncate max-w-[150px]">{l.itemTitle || l.productName || l.variantSku}</span>
                              <span className="text-brass-400 font-mono text-[10px]">×{l.quantity || 1}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-sans">{ord.linesCount || 1} item(s)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-100">
                      ${Number(ord.totalAmount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-brass-400">
                      {Number(ord.khrTotal).toLocaleString()} ៛
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {(ord.payments || []).map(p => p.method).join(', ') || 'CASH'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ord.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedTransaction(ord);
                          setIsTransactionDetailOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-750 text-slate-300 hover:text-slate-100 transition"
                        title="View Full Breakdown"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          await reprintReceipt(ord.orderNumber);
                        }}
                        className="p-1.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-750 text-brass-400 transition"
                        title="Reprint Thermal Receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
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
  );
}

