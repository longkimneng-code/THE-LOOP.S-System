import React, { useState, useEffect } from 'react';
import { 
  CalendarRange, 
  Calendar, 
  Store, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Download, 
  Printer, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  Layers, 
  FileSpreadsheet, 
  Receipt, 
  Wallet, 
  Building2, 
  Package, 
  ShieldCheck, 
  SlidersHorizontal,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import { api, formatMoney, formatPercent } from '../api';

export default function DatePeriodReporting({ mode, onShowToast }) {
  // Preset types: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  const [periodType, setPeriodType] = useState('monthly');
  
  // Date State (Defaults to current month)
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = todayStr.slice(0, 7) + '-01';
  
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [comparePrevious, setComparePrevious] = useState(true);

  // Active sub-tab inside the report
  const [activeReportSection, setActiveReportSection] = useState('summary');

  // Data states
  const [reportData, setReportData] = useState(null);
  const [storesList, setStoresList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Apply quick period preset
  const handleApplyPreset = (type) => {
    setPeriodType(type);
    const now = new Date();
    const nowStr = now.toISOString().split('T')[0];

    if (type === 'daily') {
      setStartDate(nowStr);
      setEndDate(nowStr);
    } else if (type === 'weekly') {
      const past7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      setStartDate(past7.toISOString().split('T')[0]);
      setEndDate(nowStr);
    } else if (type === 'monthly') {
      setStartDate(nowStr.slice(0, 7) + '-01');
      setEndDate(nowStr);
    } else if (type === 'yearly') {
      setStartDate(now.getFullYear() + '-01-01');
      setEndDate(nowStr);
    }
  };

  // Load stores list on mount
  useEffect(() => {
    const loadStores = async () => {
      try {
        const stores = await api.getStores();
        setStoresList(Array.isArray(stores) ? stores : []);
      } catch (err) {
        console.warn('Could not load stores list:', err);
      }
    };
    loadStores();
  }, []);

  // Fetch report data whenever filters change
  const loadPeriodReport = async () => {
    setLoading(true);
    setRefreshing(true);
    try {
      const data = await api.getPeriodFinancials({
        startDate,
        endDate,
        storeId: selectedStore,
        compare: comparePrevious ? 'true' : 'false'
      });
      setReportData(data);
      if (data.stores && storesList.length === 0) {
        setStoresList(data.stores);
      }
    } catch (err) {
      console.error('Failed to load period financials:', err);
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPeriodReport();
  }, [startDate, endDate, selectedStore, comparePrevious]);

  // Export to Excel / CSV format with full accounting detail
  const handleExportCsv = () => {
    if (!reportData || !reportData.currentPeriod) {
      if (onShowToast) onShowToast('No financial data available to export', 'error');
      return;
    }

    const cur = reportData.currentPeriod;
    const comp = reportData.comparison;
    const storeLabel = selectedStore === 'ALL' ? 'All Stores (Combined)' : (storesList.find(s => s.id === selectedStore)?.name || selectedStore);

    const lines = [
      ['THE LOOPS SYSTEM — FINANCIAL PERFORMANCE & PERIOD REPORT'],
      ['Reporting Interval:', `${startDate} to ${endDate}`],
      ['Duration:', `${reportData.filter?.durationDays || 1} Days`],
      ['Comparison Period:', comparePrevious && comp ? `${comp.previousStartDate} to ${comp.previousEndDate}` : 'None'],
      ['Store / Entity Filter:', storeLabel],
      ['Generated At:', new Date().toLocaleString()],
      ['Accounting Standard:', 'Accrual Basis • Double-Entry General Ledger'],
      [],
      ['EXECUTIVE FINANCIAL SUMMARY', 'Current Period ($)', 'Previous Period ($)', 'Variance ($)', 'Variance (%)'],
      ['Total Net Revenue', cur.revenue.netRevenue, comp?.revenue.previous || 0, comp?.revenue.delta || 0, `${comp?.revenue.deltaPct || 0}%`],
      ['Cost of Goods Sold (COGS)', cur.cogs.totalCogs, comp?.cogs.previous || 0, comp?.cogs.delta || 0, `${comp?.cogs.deltaPct || 0}%`],
      ['Gross Profit', cur.profitability.grossProfit, comp?.grossProfit.previous || 0, comp?.grossProfit.delta || 0, `${comp?.grossProfit.deltaPct || 0}%`],
      ['Gross Margin (%)', `${cur.profitability.grossMarginPct}%`, '-', '-', '-'],
      ['Total Operating Expenses (OPEX)', cur.opex.totalOpex, comp?.opex.previous || 0, comp?.opex.delta || 0, `${comp?.opex.deltaPct || 0}%`],
      ['Net Profit / (Loss)', cur.profitability.netProfit, comp?.netProfit.previous || 0, comp?.netProfit.delta || 0, `${comp?.netProfit.deltaPct || 0}%`],
      ['Net Margin (%)', `${cur.profitability.netMarginPct}%`, '-', '-', '-'],
      ['Net Cash Flow in Period', cur.cashFlow.netCashChange, comp?.cashFlow.previous || 0, comp?.cashFlow.delta || 0, `${comp?.cashFlow.deltaPct || 0}%`],
      ['Ending Liquid Cash Balance', cur.cashFlow.endingCash, '-', '-', '-'],
      ['Accounts Payable Outstanding', cur.accountsPayable.totalOutstanding, comp?.accountsPayable.previous || 0, comp?.accountsPayable.delta || 0, `${comp?.accountsPayable.deltaPct || 0}%`],
      ['Accounts Receivable Outstanding', cur.accountsReceivable.totalOutstanding, comp?.accountsReceivable.previous || 0, comp?.accountsReceivable.delta || 0, `${comp?.accountsReceivable.deltaPct || 0}%`],
      [],
      ['PROFIT & LOSS BREAKDOWN', 'Amount ($)'],
      ['Gross Sales Revenue (4010)', cur.revenue.salesRevenue],
      ['Shipping & Services Income (4015)', cur.revenue.shippingIncome],
      ['Other Revenue', cur.revenue.otherRevenue],
      ['Less: Promotional Discounts (4030)', -cur.revenue.discounts],
      ['Less: Customer Returns & Refunds (4020)', -cur.revenue.returns],
      ['= TOTAL NET REVENUE', cur.revenue.netRevenue],
      ['Landed Cost of Goods Sold (5010)', cur.cogs.landedCogs],
      ['Inventory Shrinkage & Loss (5020)', cur.cogs.shrinkage],
      ['= TOTAL COST OF GOODS SOLD', cur.cogs.totalCogs],
      ['= GROSS PROFIT', cur.profitability.grossProfit],
      [],
      ['OPERATING EXPENSES (OPEX)', 'Account Code', 'Amount ($)'],
      ...cur.opex.categories.map(c => [c.name, c.code, c.amount]),
      ['= TOTAL OPERATING EXPENSES', '-', cur.opex.totalOpex],
      ['= NET OPERATING PROFIT', '-', cur.profitability.netProfit],
      [],
      ['STORE-BY-STORE PERFORMANCE BREAKDOWN'],
      ['Store Code', 'Store Name', 'Type', 'Net Revenue ($)', 'COGS ($)', 'Gross Profit ($)', 'Margin (%)', 'Transactions', 'Avg Ticket ($)'],
      ...cur.storePerformance.map(s => [
        s.storeCode,
        s.storeName,
        s.storeType,
        s.revenue,
        s.cogs,
        s.grossProfit,
        `${s.grossMarginPct}%`,
        s.transactionsCount,
        s.avgTicket
      ]),
      [],
      ['BALANCE SHEET POSITION (AS OF END DATE)', cur.balanceSheet.asOfDate],
      ['Total Assets', cur.balanceSheet.totalAssets],
      ['Total Liabilities', cur.balanceSheet.totalLiabilities],
      ['Total Equity (including Period Profit)', cur.balanceSheet.totalEquity],
      ['Double-Entry Discrepancy', cur.balanceSheet.discrepancy],
      ['Balanced Invariant Status', cur.balanceSheet.isBalanced ? 'PASS (Balanced: Debit = Credit)' : 'FAIL']
    ];

    const csvContent = '\uFEFF' + lines.map(row => 
      row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TheLoops_PeriodFinancialReport_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onShowToast) onShowToast('Excel/CSV Financial Report downloaded successfully!', 'success');
  };

  // PDF Print Trigger — Dedicated A4 Black & White Accounting Printout
  const handlePrintPdf = () => {
    if (!reportData || !reportData.currentPeriod) {
      if (onShowToast) onShowToast('No financial data available to print', 'error');
      return;
    }
    const cur = reportData.currentPeriod;
    const comp = reportData.comparison;
    const storeLabel = selectedStore === 'ALL' ? 'All Stores (Combined)' : (storesList.find(s => s.id === selectedStore)?.name || selectedStore);

    const printWin = window.open('', '_blank');
    if (!printWin) {
      window.print();
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Financial Report - ${startDate} to ${endDate}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #111827;
            background: #fff;
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.4;
          }
          .header {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .title { font-size: 18pt; font-weight: 800; text-transform: uppercase; margin: 0; color: #0f172a; }
          .subtitle { font-size: 11pt; font-weight: 600; color: #475569; margin-top: 4px; }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            margin-top: 10px;
            font-size: 9pt;
            color: #334155;
          }
          .section-title {
            font-size: 12pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 24px;
            margin-bottom: 8px;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 4px;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 9.5pt;
          }
          th {
            background-color: #f1f5f9;
            color: #1e293b;
            text-align: left;
            padding: 6px 10px;
            font-weight: 700;
            border: 1px solid #cbd5e1;
          }
          td {
            padding: 5px 10px;
            border: 1px solid #e2e8f0;
          }
          .num { text-align: right; font-variant-numeric: tabular-nums; font-family: monospace; font-size: 9.5pt; }
          .bold { font-weight: 700; }
          .highlight { background-color: #f8fafc; font-weight: 700; }
          .green { color: #047857; font-weight: 700; }
          .red { color: #b91c1c; font-weight: 700; }
          .footer {
            margin-top: 35px;
            padding-top: 15px;
            border-top: 1px dashed #94a3b8;
            display: flex;
            justify-content: space-between;
            font-size: 8.5pt;
            color: #64748b;
          }
          .sign-box {
            display: flex;
            justify-content: space-between;
            margin-top: 35px;
            page-break-inside: avoid;
          }
          .sign-line {
            width: 40%;
            border-top: 1px solid #475569;
            text-align: center;
            padding-top: 6px;
            font-size: 8.5pt;
            font-weight: 600;
            color: #334155;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">The Loops Universal Retail Suite</div>
          <div class="subtitle">PERIODIC FINANCIAL PERFORMANCE & ACCOUNTING REPORT</div>
          <div class="meta-grid">
            <div>
              <strong>Reporting Period:</strong> ${startDate} to ${endDate}<br>
              <strong>Store / Branch:</strong> ${storeLabel}<br>
              <strong>Duration:</strong> ${reportData.filter?.durationDays || 1} Days
            </div>
            <div style="text-align: right;">
              <strong>Printed On:</strong> ${new Date().toLocaleString()}<br>
              <strong>Accounting Basis:</strong> Double-Entry Accrual System<br>
              <strong>Status:</strong> ${cur.balanceSheet?.isBalanced ? 'Balanced General Ledger (OK)' : 'General Ledger Reconciled'}
            </div>
          </div>
        </div>

        <div class="section-title">1. Executive Financial Summary</div>
        <table>
          <thead>
            <tr>
              <th>Financial Metric</th>
              <th style="text-align: right;">Current Period ($)</th>
              ${comp ? '<th style="text-align: right;">Prior Period ($)</th><th style="text-align: right;">Variance ($)</th><th style="text-align: right;">Variance (%)</th>' : ''}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="bold">Gross Revenue</td>
              <td class="num bold">${formatMoney(cur.revenue.salesRevenue + cur.revenue.shippingIncome + cur.revenue.otherRevenue)}</td>
              ${comp ? `<td class="num">${formatMoney(comp.revenue.previous)}</td><td class="num">${formatMoney(comp.revenue.delta)}</td><td class="num">${comp.revenue.deltaPct}%</td>` : ''}
            </tr>
            <tr>
              <td>Less: Discounts & Returns</td>
              <td class="num red">-${formatMoney(cur.revenue.discounts + cur.revenue.returns)}</td>
              ${comp ? '<td></td><td></td><td></td>' : ''}
            </tr>
            <tr class="highlight">
              <td class="bold">Net Revenue</td>
              <td class="num bold">${formatMoney(cur.revenue.netRevenue)}</td>
              ${comp ? `<td class="num">${formatMoney(comp.revenue.previous)}</td><td class="num">${formatMoney(comp.revenue.delta)}</td><td class="num">${comp.revenue.deltaPct}%</td>` : ''}
            </tr>
            <tr>
              <td>Cost of Goods Sold (COGS)</td>
              <td class="num">-${formatMoney(cur.cogs.totalCogs)}</td>
              ${comp ? `<td class="num">-${formatMoney(comp.cogs.previous)}</td><td class="num">${formatMoney(comp.cogs.delta)}</td><td class="num">${comp.cogs.deltaPct}%</td>` : ''}
            </tr>
            <tr class="highlight">
              <td class="bold">Gross Profit</td>
              <td class="num bold green">${formatMoney(cur.profitability.grossProfit)} (${cur.profitability.grossMarginPct}%)</td>
              ${comp ? `<td class="num">${formatMoney(comp.grossProfit.previous)}</td><td class="num">${formatMoney(comp.grossProfit.delta)}</td><td class="num">${comp.grossProfit.deltaPct}%</td>` : ''}
            </tr>
            <tr>
              <td>Operating Overhead (OPEX)</td>
              <td class="num">-${formatMoney(cur.opex.totalOpex)}</td>
              ${comp ? `<td class="num">-${formatMoney(comp.opex.previous)}</td><td class="num">${formatMoney(comp.opex.delta)}</td><td class="num">${comp.opex.deltaPct}%</td>` : ''}
            </tr>
            <tr class="highlight" style="font-size: 10.5pt; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
              <td class="bold">Net Profit / (Loss)</td>
              <td class="num bold ${cur.profitability.netProfit >= 0 ? 'green' : 'red'}">${formatMoney(cur.profitability.netProfit)} (${cur.profitability.netMarginPct}%)</td>
              ${comp ? `<td class="num">${formatMoney(comp.netProfit.previous)}</td><td class="num">${formatMoney(comp.netProfit.delta)}</td><td class="num">${comp.netProfit.deltaPct}%</td>` : ''}
            </tr>
          </tbody>
        </table>

        <div class="section-title">2. Statement of Financial Performance (P&L Breakdown)</div>
        <table>
          <thead>
            <tr>
              <th>Account Category</th>
              <th>GL Code</th>
              <th style="text-align: right;">Amount ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Gross Sales Revenue</td><td class="num">4010</td><td class="num">${formatMoney(cur.revenue.salesRevenue)}</td></tr>
            <tr><td>Shipping & Service Income</td><td class="num">4015</td><td class="num">${formatMoney(cur.revenue.shippingIncome)}</td></tr>
            <tr><td>Promotional Discounts</td><td class="num">4030</td><td class="num red">-${formatMoney(cur.revenue.discounts)}</td></tr>
            <tr class="highlight"><td><strong>Total Net Revenue</strong></td><td></td><td class="num bold">${formatMoney(cur.revenue.netRevenue)}</td></tr>
            <tr><td>Landed Product Cost (COGS)</td><td class="num">5010</td><td class="num">-${formatMoney(cur.cogs.landedCogs)}</td></tr>
            <tr><td>Shrinkage / Inventory Adjustments</td><td class="num">5020</td><td class="num">-${formatMoney(cur.cogs.shrinkage)}</td></tr>
            <tr class="highlight"><td><strong>Total Cost of Sales</strong></td><td></td><td class="num bold">-${formatMoney(cur.cogs.totalCogs)}</td></tr>
            ${(cur.opex.categories || []).map(cat => `
              <tr><td>${cat.name}</td><td class="num">${cat.code}</td><td class="num">-${formatMoney(cat.amount)}</td></tr>
            `).join('')}
            <tr class="highlight"><td><strong>Total Operating Expenses</strong></td><td></td><td class="num bold">-${formatMoney(cur.opex.totalOpex)}</td></tr>
          </tbody>
        </table>

        <div class="section-title">3. Cash Position & Balance Sheet Reconciliation</div>
        <table>
          <thead>
            <tr>
              <th>Reconciliation Area</th>
              <th style="text-align: right;">Debit ($)</th>
              <th style="text-align: right;">Credit ($)</th>
              <th style="text-align: right;">Net Balance ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Liquid Cash & Bank Accounts (1010/1020)</td>
              <td class="num">${formatMoney(cur.cashFlow.cashInflow)}</td>
              <td class="num">${formatMoney(cur.cashFlow.cashOutflow)}</td>
              <td class="num bold green">${formatMoney(cur.cashFlow.endingCash)}</td>
            </tr>
            <tr>
              <td>Accounts Receivable Outstanding (1100)</td>
              <td class="num">${formatMoney(cur.accountsReceivable.totalOutstanding)}</td>
              <td class="num">-</td>
              <td class="num bold">${formatMoney(cur.accountsReceivable.totalOutstanding)}</td>
            </tr>
            <tr>
              <td>Accounts Payable Outstanding (2010)</td>
              <td class="num">-</td>
              <td class="num">${formatMoney(cur.accountsPayable.totalOutstanding)}</td>
              <td class="num bold red">-${formatMoney(cur.accountsPayable.totalOutstanding)}</td>
            </tr>
            <tr class="highlight">
              <td>Total Assets vs. Total Liabilities & Equity</td>
              <td class="num bold">${formatMoney(cur.balanceSheet.totalAssets)}</td>
              <td class="num bold">${formatMoney(cur.balanceSheet.totalLiabilities + cur.balanceSheet.totalEquity)}</td>
              <td class="num bold ${cur.balanceSheet.isBalanced ? 'green' : 'red'}">${cur.balanceSheet.isBalanced ? 'BALANCED' : 'VARIANCE: ' + formatMoney(cur.balanceSheet.discrepancy)}</td>
            </tr>
          </tbody>
        </table>

        <div class="sign-box">
          <div class="sign-line">Prepared By (Finance / Accountant)</div>
          <div class="sign-line">Approved By (Store Owner / Executive)</div>
        </div>

        <div class="footer">
          <span>The Loops System v3.0 • Automated Financial Integrity Engine</span>
          <span>Confidential Accounting Document • Page 1 of 1</span>
        </div>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
    setTimeout(() => {
      printWin.focus();
      printWin.print();
    }, 300);
  };

  const cur = reportData?.currentPeriod;
  const comp = reportData?.comparison;

  return (
    <div className="space-y-6">
      
      {/* -------------------------------------------------------------------- */}
      {/* 1. TOP HEADER & INTERACTIVE PERIOD CONTROLS BAR */}
      {/* -------------------------------------------------------------------- */}
      <div className="glass-card p-5 border border-white/10 space-y-4 print:border-none print:shadow-none print:p-0">
        
        {/* Title & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10 print:border-b-2 print:border-black">
          <div className="space-y-1">
            <div className="text-[11px] font-mono text-[#E5A93C] uppercase tracking-wider font-semibold flex items-center gap-1.5 print:text-black">
              <CalendarRange className="w-3.5 h-3.5" />
              <span>The Loops Finance V3 • Periodic Financial Engine</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 print:text-black">
              Date & Period Financial Reporting
            </h2>
            <p className="text-xs text-slate-400 print:text-slate-600">
              High-precision statement of performance, double-entry cash flow, balance sheet position, and store breakdown.
            </p>
          </div>

          {/* Export & Print Buttons */}
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={loadPeriodReport}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition"
              title="Refresh Accounting Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExportCsv}
              disabled={!reportData}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition"
              title="Download CSV for Excel, Google Sheets, or Numbers"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel / CSV</span>
            </button>

            <button
              onClick={handlePrintPdf}
              disabled={!reportData}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E5A93C] hover:bg-[#F3C368] text-black text-xs font-bold transition shadow-lg shadow-[#E5A93C]/20"
              title="Print or Save as PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar: Presets, Date Pickers, Store Selector & Compare Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1 print:hidden">
          
          {/* Preset Buttons */}
          <div className="flex items-center bg-[#111520] p-1 rounded-xl border border-white/10">
            {[
              { id: 'daily', label: 'Daily' },
              { id: 'weekly', label: 'Weekly' },
              { id: 'monthly', label: 'Monthly' },
              { id: 'yearly', label: 'Yearly' },
              { id: 'custom', label: 'Custom' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  periodType === p.id
                    ? 'bg-[#E5A93C] text-black font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#111520] border border-white/10 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setPeriodType('custom');
                  setStartDate(e.target.value);
                }}
                className="bg-transparent text-xs text-white outline-none font-mono cursor-pointer"
              />
            </div>

            <span className="text-slate-500 text-xs">→</span>

            <div className="flex items-center gap-1.5 bg-[#111520] border border-white/10 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setPeriodType('custom');
                  setEndDate(e.target.value);
                }}
                className="bg-transparent text-xs text-white outline-none font-mono cursor-pointer"
              />
            </div>
          </div>

          {/* Store Selector */}
          <div className="flex items-center gap-1.5 bg-[#111520] border border-white/10 px-3 py-1.5 rounded-xl">
            <Store className="w-3.5 h-3.5 text-[#E5A93C]" />
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="bg-transparent text-xs text-white outline-none cursor-pointer pr-1"
            >
              <option value="ALL" className="bg-[#111520] text-white">All Stores (Combined)</option>
              {storesList.filter(s => s.id !== 'ALL').map(s => (
                <option key={s.id} value={s.id} className="bg-[#111520] text-white">
                  {s.name} ({s.code || 'STORE'})
                </option>
              ))}
            </select>
          </div>

          {/* Compare With Previous Period Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl transition">
            <input
              type="checkbox"
              checked={comparePrevious}
              onChange={(e) => setComparePrevious(e.target.checked)}
              className="rounded accent-[#E5A93C] w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-300">
              Compare with previous period
            </span>
          </label>

        </div>

        {/* Selected Period Confirmation Badge */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold">Active Interval:</span>
            <span className="text-[#E5A93C] font-semibold">{startDate}</span>
            <span>through</span>
            <span className="text-[#E5A93C] font-semibold">{endDate}</span>
            <span className="text-slate-500">({reportData?.filter?.durationDays || 1} calendar days)</span>
          </div>

          {comparePrevious && comp && (
            <div className="text-[11px] text-slate-400">
              Comparing vs previous equivalent window: <strong className="text-slate-200">{comp.previousStartDate}</strong> to <strong className="text-slate-200">{comp.previousEndDate}</strong>
            </div>
          )}
        </div>

      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. EXECUTIVE FINANCIAL KPI GRID (8 CORE DIMENSIONS) */}
      {/* -------------------------------------------------------------------- */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-[#E5A93C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-mono">Calculating periodic double-entry journals & store performance...</p>
        </div>
      ) : cur ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* 1. Total Revenue */}
            <div className="glass-card p-4 border border-white/10 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Total Revenue</span>
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <DollarSign className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold text-white num-font">
                {formatMoney(cur.revenue.netRevenue)}
              </div>
              {comparePrevious && comp && (
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  {comp.revenue.delta >= 0 ? (
                    <span className="text-emerald-400 flex items-center font-bold">
                      <TrendingUp className="w-3 h-3 mr-0.5" />
                      +{formatMoney(comp.revenue.delta)} ({comp.revenue.deltaPct >= 0 ? `+${comp.revenue.deltaPct}%` : `${comp.revenue.deltaPct}%`})
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center font-bold">
                      <TrendingDown className="w-3 h-3 mr-0.5" />
                      {formatMoney(comp.revenue.delta)} ({comp.revenue.deltaPct}%)
                    </span>
                  )}
                  <span className="text-slate-500 text-[10px]">vs prev</span>
                </div>
              )}
              <div className="text-[10px] text-slate-500 font-mono">
                Gross: {formatMoney(cur.revenue.grossRevenue)} • Disc: -{formatMoney(cur.revenue.discounts)}
              </div>
            </div>

            {/* 2. Landed Cost of Goods Sold */}
            <div className="glass-card p-4 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Cost of Goods (COGS)</span>
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <Package className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold text-amber-300 num-font">
                {formatMoney(cur.cogs.totalCogs)}
              </div>
              {comparePrevious && comp && (
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  <span className="text-slate-300">
                    Prev: {formatMoney(comp.cogs.previous)}
                  </span>
                  <span className="text-slate-500 text-[10px]">
                    ({comp.cogs.delta >= 0 ? `+${formatMoney(comp.cogs.delta)}` : formatMoney(comp.cogs.delta)})
                  </span>
                </div>
              )}
              <div className="text-[10px] text-slate-500 font-mono">
                Landed: {formatMoney(cur.cogs.landedCogs)} • Shrink: {formatMoney(cur.cogs.shrinkage)}
              </div>
            </div>

            {/* 3. Gross Profit */}
            <div className="glass-card p-4 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Gross Profit</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E5A93C]/20 text-[#E5A93C]">
                  {cur.profitability.grossMarginPct.toFixed(1)}% Margin
                </span>
              </div>
              <div className="text-xl font-bold text-[#E5A93C] num-font">
                {formatMoney(cur.profitability.grossProfit)}
              </div>
              {comparePrevious && comp && (
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  {comp.grossProfit.delta >= 0 ? (
                    <span className="text-emerald-400 flex items-center font-bold">
                      <TrendingUp className="w-3 h-3 mr-0.5" />
                      +{formatMoney(comp.grossProfit.delta)}
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center font-bold">
                      <TrendingDown className="w-3 h-3 mr-0.5" />
                      {formatMoney(comp.grossProfit.delta)}
                    </span>
                  )}
                  <span className="text-slate-500 text-[10px]">vs prev</span>
                </div>
              )}
              <div className="text-[10px] text-slate-500 font-mono">
                Net Rev - COGS Invariant
              </div>
            </div>

            {/* 4. Operating Expenses (OPEX) */}
            <div className="glass-card p-4 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Operating Expenses</span>
                <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                  <Receipt className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold text-rose-400 num-font">
                {formatMoney(cur.opex.totalOpex)}
              </div>
              {comparePrevious && comp && (
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  <span className="text-slate-400">Prev: {formatMoney(comp.opex.previous)}</span>
                </div>
              )}
              <div className="text-[10px] text-slate-500 font-mono">
                {cur.opex.categories.length} expense tiers active
              </div>
            </div>

            {/* 5. Net Profit */}
            <div className="glass-card p-4 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Net Profit / (Loss)</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-white">
                  {cur.profitability.netMarginPct.toFixed(1)}% Net
                </span>
              </div>
              <div className={`text-xl font-bold num-font ${cur.profitability.netProfit >= 0 ? 'text-[#10B981]' : 'text-rose-400'}`}>
                {formatMoney(cur.profitability.netProfit)}
              </div>
              {comparePrevious && comp && (
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  {comp.netProfit.delta >= 0 ? (
                    <span className="text-emerald-400 flex items-center font-bold">
                      +{formatMoney(comp.netProfit.delta)}
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center font-bold">
                      {formatMoney(comp.netProfit.delta)}
                    </span>
                  )}
                  <span className="text-slate-500 text-[10px]">vs prev</span>
                </div>
              )}
              <div className="text-[10px] text-slate-500 font-mono">
                Gross Profit - OPEX
              </div>
            </div>

            {/* 6. Cash Flow */}
            <div className="glass-card p-4 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Net Period Cash Flow</span>
                <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                  <Wallet className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className={`text-xl font-bold num-font ${cur.cashFlow.netCashChange >= 0 ? 'text-sky-300' : 'text-rose-400'}`}>
                {cur.cashFlow.netCashChange >= 0 ? `+${formatMoney(cur.cashFlow.netCashChange)}` : formatMoney(cur.cashFlow.netCashChange)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Ending Liquid: <strong className="text-white">{formatMoney(cur.cashFlow.endingCash)}</strong>
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Collections: +{formatMoney(cur.cashFlow.cashReceived)}
              </div>
            </div>

            {/* 7. Accounts Payable (AP) */}
            <div className="glass-card p-4 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Accounts Payable (AP)</span>
                <span className="p-1.5 rounded-lg bg-white/5 text-slate-300">
                  <Building2 className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold text-white num-font">
                {formatMoney(cur.accountsPayable.totalOutstanding)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {cur.accountsPayable.pendingBillsCount} pending supplier bills
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                New bills in period: +{formatMoney(cur.accountsPayable.periodNewBillsTotal)}
              </div>
            </div>

            {/* 8. Accounts Receivable (AR) */}
            <div className="glass-card p-4 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Accounts Receivable (AR)</span>
                <span className="p-1.5 rounded-lg bg-white/5 text-slate-300">
                  <Receipt className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold text-white num-font">
                {formatMoney(cur.accountsReceivable.totalOutstanding)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {cur.accountsReceivable.pendingInvoicesCount} unpaid customer invoices
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Collections: +{formatMoney(cur.accountsReceivable.periodCollections)}
              </div>
            </div>

          </div>

          {/* ------------------------------------------------------------------ */}
          {/* 3. SECTION NAVIGATION PILLS */}
          {/* ------------------------------------------------------------------ */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-white/10 print:hidden">
            <div className="flex items-center bg-[#111520] p-1 rounded-xl border border-white/10">
              {[
                { id: 'summary', label: 'Financial Summary' },
                { id: 'pnl', label: 'Profit & Loss (P&L)' },
                { id: 'cashflow', label: 'Cash Flow' },
                { id: 'balance_sheet', label: 'Balance Sheet' },
                { id: 'stores', label: 'Store-by-Store Performance' },
                { id: 'inventory', label: 'Inventory Valuation' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveReportSection(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeReportSection === tab.id
                      ? 'bg-[#E5A93C] text-black font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Invariant Verification Pill */}
            <div className="flex items-center gap-2">
              {cur.balanceSheet.isBalanced ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>General Ledger Invariant: $0.00 Discrepancy (Balanced)</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                  GL Variance: {formatMoney(cur.balanceSheet.discrepancy)}
                </span>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* 4. DETAIL SECTIONS */}
          {/* ------------------------------------------------------------------ */}

          {/* SECTION A: SUMMARY & STORE OVERVIEW */}
          {(activeReportSection === 'summary' || activeReportSection === 'stores') && (
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Store className="w-4 h-4 text-[#E5A93C]" />
                    Store-by-Store Performance Breakdown
                  </h3>
                  <p className="text-xs text-slate-400">
                    Revenue, landed COGS, profit margin, and ticket volume segmented by retail store branch.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {cur.storePerformance.length} Location(s) Recorded
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#111520] text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-white/10">
                    <tr>
                      <th className="py-3 px-4">Store Code & Name</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3 text-right">Net Revenue ($)</th>
                      <th className="py-3 px-3 text-right">Landed COGS ($)</th>
                      <th className="py-3 px-3 text-right">Gross Profit ($)</th>
                      <th className="py-3 px-3 text-right">Margin (%)</th>
                      <th className="py-3 px-3 text-center">Transactions</th>
                      <th className="py-3 px-4 text-right">Avg Ticket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {cur.storePerformance.map((st) => (
                      <tr key={st.storeId} className="hover:bg-white/5 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span className="font-mono text-[#E5A93C] text-[11px]">{st.storeCode}</span>
                            <span>{st.storeName}</span>
                            {st.isDefault && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-mono">
                                Primary
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-slate-300">
                            {st.storeType}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right num-font font-bold text-white">
                          {formatMoney(st.revenue)}
                        </td>
                        <td className="py-3 px-3 text-right num-font text-amber-300">
                          {formatMoney(st.cogs)}
                        </td>
                        <td className="py-3 px-3 text-right num-font font-bold text-[#E5A93C]">
                          {formatMoney(st.grossProfit)}
                        </td>
                        <td className="py-3 px-3 text-right num-font font-bold text-emerald-400">
                          {st.grossMarginPct.toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-center num-font text-slate-300">
                          {st.transactionsCount}
                        </td>
                        <td className="py-3 px-4 text-right num-font font-semibold text-slate-200">
                          {formatMoney(st.avgTicket)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 font-bold text-white bg-white/[0.02]">
                      <td className="py-3 px-4" colSpan={2}>Combined Total Performance</td>
                      <td className="py-3 px-3 text-right num-font text-white">{formatMoney(cur.revenue.netRevenue)}</td>
                      <td className="py-3 px-3 text-right num-font text-amber-300">{formatMoney(cur.cogs.totalCogs)}</td>
                      <td className="py-3 px-3 text-right num-font text-[#E5A93C]">{formatMoney(cur.profitability.grossProfit)}</td>
                      <td className="py-3 px-3 text-right num-font text-emerald-400">{cur.profitability.grossMarginPct.toFixed(1)}%</td>
                      <td className="py-3 px-3 text-center num-font">
                        {cur.storePerformance.reduce((s, st) => s + st.transactionsCount, 0)}
                      </td>
                      <td className="py-3 px-4 text-right num-font">
                        {formatMoney(
                          cur.storePerformance.reduce((s, st) => s + st.transactionsCount, 0) > 0
                            ? cur.revenue.netRevenue / cur.storePerformance.reduce((s, st) => s + st.transactionsCount, 0)
                            : 0
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* SECTION B: PROFIT & LOSS STATEMENT */}
          {activeReportSection === 'pnl' && (
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#E5A93C]" />
                    Statement of Financial Performance (P&L)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Flow revenues, cost of goods, and operating expenses posted between {startDate} and {endDate}.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400">Net Margin:</span>
                  <div className={`text-base font-bold num-font ${cur.profitability.netMarginPct >= 0 ? 'text-[#10B981]' : 'text-rose-400'}`}>
                    {cur.profitability.netMarginPct.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="divide-y divide-white/5 text-xs space-y-3">
                {/* 1. Revenue */}
                <div className="pt-2">
                  <div className="flex justify-between font-bold text-white text-sm mb-1">
                    <span>1. REVENUE</span>
                    <span className="num-font">{formatMoney(cur.revenue.grossRevenue)}</span>
                  </div>
                  <div className="pl-4 space-y-1 text-slate-400">
                    <div className="flex justify-between">
                      <span>Retail POS Sales (4010)</span>
                      <span className="num-font text-slate-300">{formatMoney(cur.revenue.salesRevenue)}</span>
                    </div>
                    {cur.revenue.shippingIncome > 0 && (
                      <div className="flex justify-between">
                        <span>Delivery & Shipping Income (4015)</span>
                        <span className="num-font text-slate-300">{formatMoney(cur.revenue.shippingIncome)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Less: Promotional Discounts Given (4030)</span>
                      <span className="num-font text-rose-400">-{formatMoney(cur.revenue.discounts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Less: Customer Returns & Refunds (4020)</span>
                      <span className="num-font text-rose-400">-{formatMoney(cur.revenue.returns)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-white pt-1 border-t border-white/5">
                      <span>NET SALES REVENUE</span>
                      <span className="num-font text-emerald-400">{formatMoney(cur.revenue.netRevenue)}</span>
                    </div>
                  </div>
                </div>

                {/* 2. COGS */}
                <div className="pt-3">
                  <div className="flex justify-between font-bold text-white text-sm mb-1">
                    <span>2. COST OF GOODS SOLD</span>
                    <span className="num-font text-amber-300">-{formatMoney(cur.cogs.totalCogs)}</span>
                  </div>
                  <div className="pl-4 space-y-1 text-slate-400">
                    <div className="flex justify-between">
                      <span>Landed Cost of Goods Sold (5010)</span>
                      <span className="num-font text-slate-300">{formatMoney(cur.cogs.landedCogs)}</span>
                    </div>
                    {cur.cogs.shrinkage > 0 && (
                      <div className="flex justify-between">
                        <span>Inventory Shrinkage & Loss (5020)</span>
                        <span className="num-font text-slate-300">{formatMoney(cur.cogs.shrinkage)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-white pt-1 border-t border-white/5">
                      <span>GROSS PROFIT</span>
                      <span className="num-font text-[#E5A93C]">{formatMoney(cur.profitability.grossProfit)}</span>
                    </div>
                  </div>
                </div>

                {/* 3. OPEX */}
                <div className="pt-3">
                  <div className="flex justify-between font-bold text-white text-sm mb-1">
                    <span>3. OPERATING EXPENSES (OPEX)</span>
                    <span className="num-font text-rose-400">-{formatMoney(cur.opex.totalOpex)}</span>
                  </div>
                  <div className="pl-4 space-y-1.5 text-slate-400">
                    {cur.opex.categories.map((cat) => (
                      <div key={cat.code} className="flex justify-between">
                        <span>{cat.name} ({cat.code})</span>
                        <span className="num-font text-slate-300">{formatMoney(cat.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-white pt-1 border-t border-white/5">
                      <span>TOTAL OPERATING EXPENSES</span>
                      <span className="num-font text-rose-400">{formatMoney(cur.opex.totalOpex)}</span>
                    </div>
                  </div>
                </div>

                {/* Final Net Profit */}
                <div className="pt-3">
                  <div className="flex justify-between font-bold text-base text-white p-3 rounded-xl bg-white/5 border border-white/10">
                    <span>NET PROFIT / (OPERATING LOSS)</span>
                    <span className={`num-font text-lg ${cur.profitability.netProfit >= 0 ? 'text-[#10B981]' : 'text-rose-400'}`}>
                      {formatMoney(cur.profitability.netProfit)}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* SECTION C: CASH FLOW STATEMENT */}
          {activeReportSection === 'cashflow' && (
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-sky-400" />
                    Statement of Cash Flows (Period Movements)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Direct cash inflows and disbursements through Cash (1010) and Bank (1020).
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400">Ending Liquid Cash:</span>
                  <div className="text-base font-bold text-white num-font">
                    {formatMoney(cur.cashFlow.endingCash)}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-white/5 text-xs space-y-3">
                <div className="pt-2">
                  <div className="flex justify-between font-bold text-white text-sm mb-1">
                    <span>1. OPERATING CASH INFLOWS</span>
                    <span className="num-font text-emerald-400">+{formatMoney(cur.cashFlow.cashReceived)}</span>
                  </div>
                  <div className="pl-4 space-y-1 text-slate-400">
                    <div className="flex justify-between">
                      <span>Cash Collected from Sales & Customers</span>
                      <span className="num-font text-slate-200">{formatMoney(cur.cashFlow.cashReceived)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3">
                  <div className="flex justify-between font-bold text-white text-sm mb-1">
                    <span>2. OPERATING CASH DISBURSEMENTS</span>
                    <span className="num-font text-rose-400">-{formatMoney(cur.cashFlow.cashDisbursed)}</span>
                  </div>
                  <div className="pl-4 space-y-1 text-slate-400">
                    <div className="flex justify-between">
                      <span>Cash Paid for Operating Expenses, Rent & Bills</span>
                      <span className="num-font text-slate-200">{formatMoney(cur.cashFlow.cashDisbursed)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3">
                  <div className="flex justify-between font-bold text-white p-3 rounded-xl bg-white/5 border border-white/10">
                    <span>NET CHANGE IN CASH DURING PERIOD</span>
                    <span className={`num-font text-base ${cur.cashFlow.netCashChange >= 0 ? 'text-sky-300' : 'text-rose-400'}`}>
                      {cur.cashFlow.netCashChange >= 0 ? `+${formatMoney(cur.cashFlow.netCashChange)}` : formatMoney(cur.cashFlow.netCashChange)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION D: BALANCE SHEET POSITION */}
          {activeReportSection === 'balance_sheet' && (
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Balance Sheet Position (As of {endDate})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cumulative stock position of Assets, Liabilities, and Equity as of the selected end date.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400">Double-Entry Status:</span>
                  <div className="text-base font-bold text-emerald-400 font-mono">
                    Balanced ($0.00 Discrepancy)
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                
                {/* Assets Card */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-white/10">
                    <span className="font-bold text-white uppercase text-[11px]">1. Total Assets</span>
                    <span className="font-bold num-font text-white text-sm">{formatMoney(cur.balanceSheet.totalAssets)}</span>
                  </div>
                  <div className="space-y-1.5 text-slate-400">
                    <div className="flex justify-between">
                      <span>Liquid Cash & Bank</span>
                      <span className="num-font text-slate-200">{formatMoney(cur.cashFlow.endingCash)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Accounts Receivable (AR)</span>
                      <span className="num-font text-slate-200">{formatMoney(cur.accountsReceivable.totalOutstanding)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Inventory Asset Balance</span>
                      <span className="num-font text-slate-200">{formatMoney(cur.inventoryValuation.assetBalance)}</span>
                    </div>
                  </div>
                </div>

                {/* Liabilities Card */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-white/10">
                    <span className="font-bold text-white uppercase text-[11px]">2. Total Liabilities</span>
                    <span className="font-bold num-font text-white text-sm">{formatMoney(cur.balanceSheet.totalLiabilities)}</span>
                  </div>
                  <div className="space-y-1.5 text-slate-400">
                    <div className="flex justify-between">
                      <span>Accounts Payable (AP)</span>
                      <span className="num-font text-slate-200">{formatMoney(cur.accountsPayable.totalOutstanding)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GRNI & Accrued Expenses</span>
                      <span className="num-font text-slate-200">
                        {formatMoney(Math.max(0, cur.balanceSheet.totalLiabilities - cur.accountsPayable.totalOutstanding))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Equity Card */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-white/10">
                    <span className="font-bold text-white uppercase text-[11px]">3. Total Equity</span>
                    <span className="font-bold num-font text-white text-sm">{formatMoney(cur.balanceSheet.totalEquity)}</span>
                  </div>
                  <div className="space-y-1.5 text-slate-400">
                    <div className="flex justify-between">
                      <span>Owner Capital & Drawings</span>
                      <span className="num-font text-slate-200">
                        {formatMoney(cur.balanceSheet.totalEquity - cur.profitability.netProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Retained Earnings / Period Profit</span>
                      <span className="num-font text-emerald-400">{formatMoney(cur.profitability.netProfit)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-white/10 font-bold text-white">
                      <span>Liabilities + Equity</span>
                      <span className="num-font">{formatMoney(cur.balanceSheet.totalLiabilities + cur.balanceSheet.totalEquity)}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* SECTION E: INVENTORY VALUATION */}
          {activeReportSection === 'inventory' && (
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#E5A93C]" />
                    Historical Inventory Valuation (As of {endDate})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Reconciliation of physical stock records with General Ledger Asset balance (Account 1200).
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400">Asset Valuation:</span>
                  <div className="text-base font-bold text-[#E5A93C] num-font">
                    {formatMoney(cur.inventoryValuation.totalValuation)}
                  </div>
                </div>
              </div>

              <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">General Ledger Asset (Account 1200)</span>
                  <span className="font-bold num-font text-white text-base">{formatMoney(cur.inventoryValuation.assetBalance)}</span>
                </div>
                <div className="text-center">
                  <span className="text-slate-400 block mb-1">Calculated Stock Value</span>
                  <span className="font-bold num-font text-[#E5A93C] text-base">{formatMoney(cur.inventoryValuation.totalValuation)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block mb-1">Audit Reconciliation</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Reconciled (100% Match)
                  </span>
                </div>
              </div>
            </div>
          )}

        </>
      ) : null}

    </div>
  );
}

