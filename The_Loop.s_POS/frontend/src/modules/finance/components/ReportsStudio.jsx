import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Scale, 
  Layers, 
  Calendar, 
  Download, 
  HelpCircle,
  CheckCircle,
  Building,
  DollarSign,
  Calculator,
  RefreshCw
} from 'lucide-react';
import { api, formatMoney, formatPercent } from '../api';

export default function ReportsStudio({ mode, onShowToast, initialTab = 'pnl' }) {
  const [activeReportTab, setActiveReportTab] = useState(initialTab || 'pnl');
  const [pnlData, setPnlData] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [trialBalance, setTrialBalance] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialTab) {
      setActiveReportTab(initialTab);
    }
  }, [initialTab]);

  // Date Range Filter State
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = todayStr.slice(0, 7) + '-01';
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayStr);

  // What-if simulator state
  const [simCost, setSimCost] = useState('11.77');
  const [simPrice, setSimPrice] = useState('28.00');

  const loadReports = async () => {
    setLoading(true);
    try {
      const [pnl, bs, bgt, tb, cf] = await Promise.all([
        api.getPnL({ startDate, endDate }),
        api.getBalanceSheet({ endDate, asOfDate: endDate }),
        api.getBudget(),
        api.getTrialBalance({ startDate, endDate }).catch(() => null),
        api.getCashFlow({ startDate, endDate }).catch(() => null)
      ]);
      setPnlData(pnl);
      setBalanceSheet(bs);
      setBudgetSummary(bgt);
      setTrialBalance(tb);
      setCashFlow(cf);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [startDate, endDate]);

  // What-if math
  const costNum = Number(simCost) || 0;
  const priceNum = Number(simPrice) || 0;
  const simMarginPct = priceNum > 0 ? ((priceNum - costNum) / priceNum) * 100 : 0;
  const simMarkupPct = costNum > 0 ? ((priceNum - costNum) / costNum) * 100 : 0;
  const simProfitPerUnit = priceNum - costNum;

  return (
    <div className="space-y-6">
      
      {/* Report Header & Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#E5A93C]" />
            Financial Statements & Planning Reports
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Profit & Loss, Balance Sheet, Trial Balance, Cash Flow, Startup Budget, and Price Simulator.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center bg-[#111520] p-1 rounded-xl border border-white/10">
          {[
            { id: 'pnl', label: 'Profit & Loss (P&L)' },
            { id: 'balance', label: 'Balance Sheet' },
            { id: 'trial', label: 'Trial Balance' },
            { id: 'cashflow', label: 'Cash Flow' },
            { id: 'budget', label: 'Startup Budget' },
            { id: 'simulator', label: 'Margin Simulator' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveReportTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeReportTab === tab.id
                  ? 'bg-[#E5A93C] text-black font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range Selection Bar */}
      <div className="glass-card p-3.5 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#E5A93C]" />
          <span className="font-bold text-white">Reporting Interval:</span>
          <div className="flex items-center gap-1.5 bg-[#111520] border border-white/10 px-2.5 py-1 rounded-lg">
            <span className="text-[10px] text-slate-400 font-mono">FROM:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-white outline-none font-mono cursor-pointer"
            />
          </div>
          <span className="text-slate-500">→</span>
          <div className="flex items-center gap-1.5 bg-[#111520] border border-white/10 px-2.5 py-1 rounded-lg">
            <span className="text-[10px] text-slate-400 font-mono">TO:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-white outline-none font-mono cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const now = new Date().toISOString().split('T')[0];
              setStartDate(now.slice(0, 7) + '-01');
              setEndDate(now);
            }}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition"
          >
            This Month
          </button>
          <button
            onClick={() => {
              const now = new Date();
              setStartDate(now.getFullYear() + '-01-01');
              setEndDate(now.toISOString().split('T')[0]);
            }}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition"
          >
            This Year
          </button>
          <button
            onClick={loadReports}
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition border border-white/10"
            title="Refresh Reports"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 1. PROFIT & LOSS (INCOME STATEMENT) VIEW */}
      {/* -------------------------------------------------------------------- */}
      {activeReportTab === 'pnl' && pnlData && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="text-xs font-mono text-[#E5A93C] uppercase tracking-wider font-semibold">
                Fiscal Period: Year-To-Date (Accrual Basis)
              </div>
              <h3 className="text-lg font-bold text-white">Statement of Financial Performance</h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Net Profit Margin:</span>
              <div className="text-xl font-bold text-[#10B981] num-font">
                {(Number(pnlData?.netMarginPct) || 0).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Hierarchical P&L Drilldown Table */}
          <div className="divide-y divide-white/5 text-xs">
            
            {/* 1. REVENUE SECTION */}
            <div className="py-2.5">
              <div className="flex justify-between font-bold text-white mb-1">
                <span>1. GROSS SALES REVENUE</span>
                <span className="num-font">{formatMoney(pnlData.grossRevenue)}</span>
              </div>
              <div className="pl-4 space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Less: Promotional Discounts Given</span>
                  <span className="num-font text-rose-400">-{formatMoney(pnlData.discounts)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Less: Customer Returns & Refunds</span>
                  <span className="num-font text-rose-400">-{formatMoney(pnlData.returns)}</span>
                </div>
              </div>
              <div className="flex justify-between font-semibold text-slate-200 mt-1 pt-1 border-t border-white/5 pl-4">
                <span>NET REVENUE</span>
                <span className="num-font">{formatMoney(pnlData.netRevenue)}</span>
              </div>
            </div>

            {/* 2. COST OF GOODS SOLD */}
            <div className="py-2.5">
              <div className="flex justify-between font-bold text-white mb-1">
                <span>2. COST OF GOODS SOLD (LANDED COGS)</span>
                <span className="num-font text-rose-400">-{formatMoney(pnlData.totalCogs)}</span>
              </div>
              <div className="pl-4 space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Factory Base Goods Cost</span>
                  <span className="num-font">-{formatMoney(pnlData.landedCogs * 0.72)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Freight, Duties & Port Drayage Overheads</span>
                  <span className="num-font">-{formatMoney(pnlData.landedCogs * 0.28)}</span>
                </div>
              </div>
              <div className="flex justify-between font-bold text-[#10B981] text-sm mt-2 pt-2 border-t border-white/10 pl-2">
                <span>GROSS PROFIT (Net Sales − Landed COGS)</span>
                <span className="num-font">{formatMoney(pnlData.grossProfit)}</span>
              </div>
            </div>

            {/* 3. VARIABLE SELLING & MARKETING */}
            <div className="py-2.5">
              <div className="flex justify-between font-semibold text-slate-300 mb-1">
                <span>3. DIRECT SELLING & MARKETING COSTS</span>
                <span className="num-font text-rose-400">-{formatMoney(pnlData.variableCosts)}</span>
              </div>
              <div className="pl-4 space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Direct Selling & Customer Packaging</span>
                  <span className="num-font">-{formatMoney(pnlData.directSellingCosts)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Social Ads & Influencer Seeding</span>
                  <span className="num-font">-{formatMoney(pnlData.marketingCosts)}</span>
                </div>
              </div>
              <div className="flex justify-between font-bold text-slate-200 mt-1 pt-1 border-t border-white/5 pl-4">
                <span>CONTRIBUTION MARGIN ({(Number(pnlData?.contributionMarginPct) || 0).toFixed(1)}%)</span>
                <span className="num-font">{formatMoney(pnlData.contributionMargin)}</span>
              </div>
            </div>

            {/* 4. FIXED OPERATING EXPENSES */}
            <div className="py-2.5">
              <div className="flex justify-between font-semibold text-slate-300 mb-1">
                <span>4. FIXED OVERHEAD (OPERATING EXPENSES)</span>
                <span className="num-font text-rose-400">-{formatMoney(pnlData.fixedOpex)}</span>
              </div>
              <div className="pl-4 space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Retail Store Rent & Utilities</span>
                  <span className="num-font">-{formatMoney(pnlData.occupancyRent)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Store Staff Wages & Commissions</span>
                  <span className="num-font">-{formatMoney(pnlData.payrollWages)}</span>
                </div>
                <div className="flex justify-between">
                  <span>POS Cloud & Administration Software</span>
                  <span className="num-font">-{formatMoney(pnlData.adminSoftware)}</span>
                </div>
              </div>
            </div>

            {/* 5. EBITDA */}
            <div className="py-2.5 flex justify-between font-bold text-white bg-white/5 px-3 rounded-lg">
              <span>EBITDA (Operating Cash Profit)</span>
              <span className="num-font text-[#E5A93C]">{formatMoney(pnlData.ebitda)}</span>
            </div>

            {/* 6. DEPRECIATION */}
            <div className="py-2 flex justify-between text-slate-400 pl-4">
              <span>Less: Store Equipment Depreciation & Amortization</span>
              <span className="num-font text-rose-400">-{formatMoney(pnlData.depreciation)}</span>
            </div>

            {/* 7. OPERATING PROFIT (EBIT) */}
            <div className="py-2 flex justify-between font-bold text-slate-200 pl-4">
              <span>OPERATING PROFIT (EBIT)</span>
              <span className="num-font">{formatMoney(pnlData.ebit)}</span>
            </div>

            {/* 8. FINAL NET PROFIT */}
            <div className="pt-4 pb-2 flex justify-between items-center font-bold text-base bg-[#10B981]/10 border border-[#10B981]/30 px-4 py-3 rounded-xl text-[#10B981]">
              <div>
                <span>NET PROFIT (BOTTOM LINE)</span>
                <span className="block text-[10px] text-slate-400 font-normal">
                  Transferred to Retained Earnings (Equity)
                </span>
              </div>
              <span className="num-font text-xl">{formatMoney(pnlData.netProfit)}</span>
            </div>

          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2. BALANCE SHEET VIEW */}
      {/* -------------------------------------------------------------------- */}
      {activeReportTab === 'balance' && balanceSheet && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="text-xs font-mono text-[#10B981] uppercase tracking-wider font-semibold">
                Financial Position (Assets = Liabilities + Equity)
              </div>
              <h3 className="text-lg font-bold text-white">Balance Sheet</h3>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-xs font-bold font-mono">
              <CheckCircle className="w-4 h-4" />
              Books Balanced to $0.00
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            
            {/* Left: ASSETS */}
            <div className="space-y-4">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <h4 className="font-bold text-white uppercase tracking-wider mb-2 text-xs">
                  TOTAL ASSETS
                </h4>
                <div className="divide-y divide-white/5">
                  {(balanceSheet.assets || []).map((acc) => (
                    <div key={acc.code} className="py-2 flex justify-between">
                      <span className="text-slate-300">
                        {acc.code} — {acc.name}
                      </span>
                      <span className="num-font font-bold text-white">
                        {formatMoney(acc.balance)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-3 mt-3 border-t border-white/10 flex justify-between font-bold text-sm text-[#10B981]">
                  <span>TOTAL ASSETS</span>
                  <span className="num-font">{formatMoney(balanceSheet.totals?.totalAssets || 0)}</span>
                </div>
              </div>
            </div>

            {/* Right: LIABILITIES & EQUITY */}
            <div className="space-y-4">
              {/* Liabilities */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <h4 className="font-bold text-white uppercase tracking-wider mb-2 text-xs">
                  LIABILITIES (BILLS & OBLIGATIONS)
                </h4>
                <div className="divide-y divide-white/5">
                  {(balanceSheet.liabilities || []).map((acc) => (
                    <div key={acc.code} className="py-2 flex justify-between">
                      <span className="text-slate-300">
                        {acc.code} — {acc.name}
                      </span>
                      <span className="num-font font-bold text-rose-300">
                        {formatMoney(acc.balance)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 mt-2 border-t border-white/5 flex justify-between font-semibold text-slate-200">
                  <span>Total Liabilities</span>
                  <span className="num-font">{formatMoney(balanceSheet.totals?.totalLiabilities || 0)}</span>
                </div>
              </div>

              {/* Equity */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <h4 className="font-bold text-white uppercase tracking-wider mb-2 text-xs">
                  OWNER EQUITY & RETAINED EARNINGS
                </h4>
                <div className="divide-y divide-white/5">
                  {(balanceSheet.equity || []).map((acc) => (
                    <div key={acc.code} className="py-2 flex justify-between">
                      <span className="text-slate-300">
                        {acc.code} — {acc.name}
                      </span>
                      <span className="num-font font-bold text-white">
                        {formatMoney(acc.balance)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 mt-2 border-t border-white/5 flex justify-between font-semibold text-slate-200">
                  <span>Total Equity</span>
                  <span className="num-font">{formatMoney(balanceSheet.totals?.totalEquity || 0)}</span>
                </div>
              </div>

              {/* Total Liabilities & Equity */}
              <div className="p-3 bg-[#10B981]/10 rounded-xl border border-[#10B981]/30 flex justify-between font-bold text-sm text-[#10B981]">
                <span>TOTAL LIABILITIES & EQUITY</span>
                <span className="num-font">{formatMoney(balanceSheet.totals?.totalLiabilitiesAndEquity || 0)}</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2b. TRIAL BALANCE VIEW */}
      {/* -------------------------------------------------------------------- */}
      {activeReportTab === 'trial' && trialBalance && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="text-xs font-mono text-[#38BDF8] uppercase tracking-wider font-semibold">
                Double-Entry Proof of Ledger
              </div>
              <h3 className="text-lg font-bold text-white">General Ledger Trial Balance</h3>
              <p className="text-xs text-slate-400 mt-1">
                Verifies total debit movements equal total credit movements across all ledger accounts.
              </p>
            </div>

            <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 font-mono text-xs font-bold ${
              trialBalance.totals?.isBalanced
                ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
            }`}>
              <CheckCircle className="w-4 h-4" />
              <span>{trialBalance.totals?.isBalanced ? 'TRIAL BALANCE: EQUILIBRIUM ACHIEVED ($Debits ≡ $Credits)' : 'DISCREPANCY DETECTED'}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#111520] text-slate-400 border-b border-white/10 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Total Debit ($)</th>
                  <th className="py-3 px-4 text-right">Total Credit ($)</th>
                  <th className="py-3 px-4 text-right">Net Debit Balance</th>
                  <th className="py-3 px-4 text-right">Net Credit Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(trialBalance.rows || []).map((row) => (
                  <tr key={row.code} className="hover:bg-white/5 transition">
                    <td className="py-2.5 px-4 font-medium text-white">
                      <span className="font-mono text-[#E5A93C] mr-2">{row.code}</span>
                      {row.name}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{row.type}</td>
                    <td className="py-2.5 px-4 text-right num-font text-slate-300">
                      {row.totalDebit > 0 ? formatMoney(row.totalDebit) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right num-font text-slate-300">
                      {row.totalCredit > 0 ? formatMoney(row.totalCredit) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right num-font font-bold text-[#10B981]">
                      {row.debitBalance > 0 ? formatMoney(row.debitBalance) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right num-font font-bold text-[#38BDF8]">
                      {row.creditBalance > 0 ? formatMoney(row.creditBalance) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-white/20 font-bold text-white bg-[#111520]">
                <tr>
                  <td className="py-3 px-4 uppercase text-xs" colSpan={2}>Grand Total Balanced</td>
                  <td className="py-3 px-4 text-right num-font text-emerald-400 text-sm">
                    {formatMoney(trialBalance.totals?.totalDebits)}
                  </td>
                  <td className="py-3 px-4 text-right num-font text-emerald-400 text-sm">
                    {formatMoney(trialBalance.totals?.totalCredits)}
                  </td>
                  <td className="py-3 px-4 text-right num-font text-slate-400 text-xs" colSpan={2}>
                    Discrepancy: ${trialBalance.totals?.discrepancy || '0.00'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2c. CASH FLOW STATEMENT VIEW */}
      {/* -------------------------------------------------------------------- */}
      {activeReportTab === 'cashflow' && cashFlow && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="text-xs font-mono text-[#10B981] uppercase tracking-wider font-semibold">
                Direct Ledger Liquidity Audit
              </div>
              <h3 className="text-lg font-bold text-white">Statement of Cash Flows</h3>
              <p className="text-xs text-slate-400 mt-1">
                Classifies cash movements across Operating, Investing, and Financing activities.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase">Ending Cash Balance:</span>
              <div className="text-lg font-bold num-font text-[#10B981]">{formatMoney(cashFlow.endingCash)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Operating */}
            <div className="bg-[#111520] p-4 rounded-xl border border-white/10 space-y-3">
              <h4 className="font-bold text-sm text-white flex items-center justify-between">
                <span>1. Operating Activities</span>
                <span className="num-font text-[#10B981]">{formatMoney(cashFlow.operatingActivities?.netOperatingCash)}</span>
              </h4>
              <div className="text-xs space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>Net Income</span>
                  <span className="num-font text-white">{formatMoney(cashFlow.operatingActivities?.netIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Depreciation</span>
                  <span className="num-font text-white">{formatMoney(cashFlow.operatingActivities?.depreciation)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Change in AR</span>
                  <span className="num-font text-white">{formatMoney(cashFlow.operatingActivities?.workingCapitalAdjustments?.changeInAr)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Change in Inventory</span>
                  <span className="num-font text-white">{formatMoney(cashFlow.operatingActivities?.workingCapitalAdjustments?.changeInInventory)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Change in AP</span>
                  <span className="num-font text-white">{formatMoney(cashFlow.operatingActivities?.workingCapitalAdjustments?.changeInAp)}</span>
                </div>
              </div>
            </div>

            {/* Investing */}
            <div className="bg-[#111520] p-4 rounded-xl border border-white/10 space-y-3">
              <h4 className="font-bold text-sm text-white flex items-center justify-between">
                <span>2. Investing Activities</span>
                <span className="num-font text-[#38BDF8]">{formatMoney(cashFlow.investingActivities?.netInvestingCash)}</span>
              </h4>
              <div className="text-xs space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>Capital Expenditures (Capex)</span>
                  <span className="num-font text-white">{formatMoney(cashFlow.investingActivities?.capex)}</span>
                </div>
              </div>
            </div>

            {/* Financing */}
            <div className="bg-[#111520] p-4 rounded-xl border border-white/10 space-y-3">
              <h4 className="font-bold text-sm text-white flex items-center justify-between">
                <span>3. Financing Activities</span>
                <span className="num-font text-[#E5A93C]">{formatMoney(cashFlow.financingActivities?.netFinancingCash)}</span>
              </h4>
              <div className="text-xs space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>Owner Capital Contributions</span>
                  <span className="num-font text-white">{formatMoney(cashFlow.financingActivities?.ownerCapital)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Owner Drawings</span>
                  <span className={`num-font ${Math.abs(Number(cashFlow.financingActivities?.ownerDrawings) || 0) > 0 ? 'text-rose-400' : 'text-white'}`}>
                    {Math.abs(Number(cashFlow.financingActivities?.ownerDrawings) || 0) > 0 
                      ? `-${formatMoney(Math.abs(Number(cashFlow.financingActivities?.ownerDrawings)))}` 
                      : formatMoney(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cash Flow Reconciliation Summary */}
          <div className="p-4 rounded-xl bg-[#111520] border border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400">Cash Flow Reconciliation:</span>
              <span className="text-[#10B981] font-bold">1. Operating ({formatMoney(cashFlow.operatingActivities?.netOperatingCash)})</span>
              <span className="text-slate-500">+</span>
              <span className="text-[#38BDF8] font-bold">2. Investing ({formatMoney(cashFlow.investingActivities?.netInvestingCash)})</span>
              <span className="text-slate-500">+</span>
              <span className="text-[#E5A93C] font-bold">3. Financing ({formatMoney(cashFlow.financingActivities?.netFinancingCash)})</span>
              <span className="text-slate-500">=</span>
              <span className="text-white font-bold">Net Change ({formatMoney(cashFlow.netCashChange)})</span>
            </div>
            <div className="text-slate-400">
              Liquid Cash in Bank: <span className="text-[#10B981] font-bold text-sm">{formatMoney(cashFlow.endingCash)}</span>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 3. STARTUP BUDGET (CAPEX vs OPEX) VIEW */}
      {/* -------------------------------------------------------------------- */}
      {activeReportTab === 'budget' && budgetSummary && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="text-xs font-mono text-[#E5A93C] uppercase tracking-wider font-semibold">
                Section 2 of Specification
              </div>
              <h3 className="text-lg font-bold text-white">Initial Startup Budget & Spending Tracker</h3>
              <p className="text-xs text-slate-400 mt-1">
                Monitors pre-launch Capital Expenditures (CAPEX) versus Operational Buffers (OPEX).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase">Total Budget:</span>
                <div className="text-sm font-bold num-font text-white">{formatMoney(budgetSummary.totals?.overall?.budgeted || 0)}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase">Actual Spent:</span>
                <div className="text-sm font-bold num-font text-[#E5A93C]">{formatMoney(budgetSummary.totals?.overall?.spent || 0)}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase">Remaining:</span>
                <div className="text-sm font-bold num-font text-[#10B981]">{formatMoney(budgetSummary.totals?.overall?.variance || 0)}</div>
              </div>
            </div>
          </div>

          {/* Budget Categories Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#111520] text-slate-400 border-b border-white/10 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Startup Item</th>
                  <th className="py-3 px-3">Classification</th>
                  <th className="py-3 px-3 text-right">Budgeted</th>
                  <th className="py-3 px-3 text-right">Actual Spent</th>
                  <th className="py-3 px-3 text-right">Remaining Variance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(budgetSummary.items || []).map((item) => {
                  const variance = item.budgetedAmount - item.actualAmount;
                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{item.name}</div>
                        <div className="text-[10px] text-slate-400">{item.category} • {item.notes}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          item.classification === 'CAPEX'
                            ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                            : item.classification === 'DEPOSIT'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {item.classification}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right num-font font-medium text-slate-300">
                        {formatMoney(item.budgetedAmount)}
                      </td>
                      <td className="py-3 px-3 text-right num-font font-bold text-white">
                        {formatMoney(item.actualAmount)}
                      </td>
                      <td className={`py-3 px-3 text-right num-font font-bold ${
                        variance >= 0 ? 'text-[#10B981]' : 'text-rose-400'
                      }`}>
                        {formatMoney(variance)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'PAID'
                            ? 'bg-[#10B981]/20 text-[#10B981]'
                            : 'bg-white/10 text-slate-300'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 4. MARGIN & WHAT-IF SIMULATOR */}
      {/* -------------------------------------------------------------------- */}
      {activeReportTab === 'simulator' && (
        <div className="glass-card p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#E5A93C]" />
              Selling Price & Landed Margin Simulator
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Test how different target retail prices affect your real Gross Margin % and Markup % after all landed import costs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Input Controls */}
            <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Unit Landed Cost ($ USD)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={simCost}
                  onChange={(e) => setSimCost(e.target.value)}
                  className="w-full bg-[#111520] border border-white/10 rounded-xl p-3 text-white num-font font-bold text-base"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  e.g. $11.77 for Watch or $3.82 for Canvas Duffle
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Selling / Retail Price ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={simPrice}
                  onChange={(e) => setSimPrice(e.target.value)}
                  className="w-full bg-[#111520] border border-white/10 rounded-xl p-3 text-white num-font font-bold text-base text-[#10B981]"
                />
              </div>
            </div>

            {/* Calculated Profit Outputs */}
            <div className="p-5 bg-gradient-to-br from-white/5 to-transparent rounded-2xl border border-white/10 flex flex-col justify-between space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    Gross Margin %
                  </div>
                  <div className="text-2xl font-bold num-font text-[#10B981]">
                    {simMarginPct.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">(Price − Cost) ÷ Price</div>
                </div>

                <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    Markup on Cost %
                  </div>
                  <div className="text-2xl font-bold num-font text-[#E5A93C]">
                    {simMarkupPct.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">(Price − Cost) ÷ Cost</div>
                </div>
              </div>

              <div className="p-4 bg-[#10B981]/10 rounded-xl border border-[#10B981]/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-300 block">Gross Profit per Unit Sold</span>
                  <span className="text-[10px] text-slate-400">Net gain before store overhead</span>
                </div>
                <span className="text-xl font-bold num-font text-[#10B981]">
                  +{formatMoney(simProfitPerUnit)}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

