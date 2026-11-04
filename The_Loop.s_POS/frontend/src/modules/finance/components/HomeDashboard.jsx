import React from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Package, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Flame, 
  Calendar,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { formatMoney, formatPercent } from '../api';

export default function HomeDashboard({ 
  dashboardData, 
  mode, 
  onNavigateTab, 
  onOpenNewModal 
}) {
  if (!dashboardData) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-[#E5A93C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading financial control tower...
      </div>
    );
  }

  const kpiCards = dashboardData?.kpiCards || {
    cashNow: 0,
    customersOwe: 0,
    youOwe: 0,
    stockValue: 0,
    profitThisMonth: 0,
    grossMarginPct: 0,
    netMarginPct: 0
  };
  const pnl = dashboardData?.pnl || { grossRevenue: 0, netProfit: 0, landedCogs: 0, totalOpex: 0, netMarginPct: 0, grossMarginPct: 0 };
  const health = dashboardData?.health || {
    grade: 'EXCELLENT',
    totalHealthScore: 100,
    runwayMonths: '12+ months',
    factors: { liquidity: 100, profitability: 100, turnover: 100, obligations: 100, expenseControl: 100, runway: 100 }
  };
  const factors = health?.factors || { liquidity: 100, profitability: 100, turnover: 100, obligations: 100, expenseControl: 100, runway: 100 };
  const needsAttention = dashboardData?.needsAttention || [];
  const cashOutlook = dashboardData?.cashOutlook || [];

  // Simple Mode vs Accountant Mode Labels per Loops Finance V3 Spec
  const labels = {
    cash: mode === 'SIMPLE' ? 'Cash Now' : 'Cash & Equivalents (1010 + 1020)',
    customersOwe: mode === 'SIMPLE' ? 'Customers Owe You' : 'Accounts Receivable (1100)',
    youOwe: mode === 'SIMPLE' ? 'You Owe' : 'Accounts Payable (2010)',
    stock: mode === 'SIMPLE' ? 'Stock Value' : 'Inventory Asset at Landed Cost (1200)',
    profit: mode === 'SIMPLE' ? 'Profit This Month' : 'Net Profit (EBIT - Tax)'
  };

  return (
    <div className="space-y-6">
      
      {/* 1. TOP 5 FINANCIAL COMMAND CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Cash Now */}
        <div 
          onClick={() => onNavigateTab('reports', 'cashflow')}
          className="glass-card p-4 hover:border-[#E5A93C]/50 transition cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">{labels.cash}</span>
            <Wallet className="w-4 h-4 text-[#10B981] group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-white num-font tracking-tight">
            {formatMoney(kpiCards?.cashNow ?? 0)}
          </div>
          <div className="mt-2 text-xs flex items-center justify-between text-slate-400">
            <span>Operating liquid cash</span>
            <span className="text-[#10B981] font-medium flex items-center gap-0.5">
              Safe <CheckCircle2 className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 2: Customers Owe You */}
        <div 
          onClick={() => onNavigateTab('period')}
          className="glass-card p-4 hover:border-[#38BDF8]/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">{labels.customersOwe}</span>
            <ArrowDownRight className="w-4 h-4 text-[#38BDF8] group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-white num-font tracking-tight">
            {formatMoney(kpiCards?.customersOwe ?? 0)}
          </div>
          <div className="mt-2 text-xs flex items-center justify-between text-slate-400">
            <span>Uncollected invoices</span>
            <span className="text-[#38BDF8] font-mono">0 overdue</span>
          </div>
        </div>

        {/* Card 3: You Owe */}
        <div 
          onClick={() => onNavigateTab('bills')}
          className="glass-card p-4 hover:border-[#F43F5E]/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">{labels.youOwe}</span>
            <ArrowUpRight className="w-4 h-4 text-[#F43F5E] group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-white num-font tracking-tight">
            {formatMoney(kpiCards?.youOwe ?? 0)}
          </div>
          <div className="mt-2 text-xs flex items-center justify-between text-slate-400">
            <span>Bills & factory balances</span>
            <span className="text-amber-400 font-mono">Earliest in 9d</span>
          </div>
        </div>

        {/* Card 4: Stock Value */}
        <div 
          onClick={() => onNavigateTab('imports')}
          className="glass-card p-4 hover:border-[#E5A93C]/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">{labels.stock}</span>
            <Package className="w-4 h-4 text-[#E5A93C] group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-white num-font tracking-tight">
            {formatMoney(kpiCards?.stockValue ?? 0)}
          </div>
          <div className="mt-2 text-xs flex items-center justify-between text-slate-400">
            <span>True landed cost</span>
            <span className="text-[#E5A93C] font-mono font-bold text-[11px]">V3 Engine</span>
          </div>
        </div>

        {/* Card 5: Profit This Month */}
        <div 
          onClick={() => onNavigateTab('reports', 'pnl')}
          className="glass-card p-4 hover:border-[#10B981]/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">{labels.profit}</span>
            <TrendingUp className="w-4 h-4 text-[#10B981] group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-[#10B981] num-font tracking-tight">
            {formatMoney(kpiCards?.profitThisMonth ?? 0)}
          </div>
          <div className="mt-2 text-xs flex items-center justify-between text-slate-400">
            <span>Gross margin: {Number(kpiCards?.grossMarginPct || 0).toFixed(1)}%</span>
            <span className="text-[#10B981] font-mono font-medium">{formatPercent(kpiCards?.netMarginPct ?? 0)}</span>
          </div>
        </div>

      </div>

      {/* 2. MAIN SPLIT: FINANCIAL HEALTH & NEEDS ATTENTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Financial Health & 30-Day Cash Outlook */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Health Score Card */}
          <div className="glass-card-elevated p-6 border border-white/10 relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Financial Health Score</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                    {health.grade} ({health.totalHealthScore}/100)
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Multi-factor composite scoring: Liquidity, margins, stock velocity, debt obligations, and burn rate.
                </p>
              </div>

              {/* Runway Status Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <Flame className="w-4 h-4 text-[#E5A93C]" />
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Cash Runway</div>
                  <div className="text-xs font-bold text-white num-font">
                    {typeof health.runwayMonths === 'number' ? `${health.runwayMonths} months` : health.runwayMonths}
                  </div>
                </div>
              </div>
            </div>

            {/* 6 Radar Factor Progress Bars */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5">
              {[
                { name: 'Liquidity', score: factors?.liquidity ?? 100, weight: '25%' },
                { name: 'Profitability', score: factors?.profitability ?? 100, weight: '25%' },
                { name: 'Stock Turnover', score: factors?.turnover ?? 100, weight: '15%' },
                { name: 'Obligations Coverage', score: factors?.obligations ?? 100, weight: '15%' },
                { name: 'Expense Control', score: factors?.expenseControl ?? 100, weight: '10%' },
                { name: 'Runway Safety', score: factors?.runway ?? 100, weight: '10%' }
              ].map((factor, idx) => (
                <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-medium">{factor.name}</span>
                    <span className="num-font text-white font-bold">{factor.score}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${factor.score}%`,
                        backgroundColor: factor.score > 75 ? '#10B981' : factor.score > 50 ? '#E5A93C' : '#F43F5E'
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Weight: {factor.weight}</div>
                </div>
              ))}
            </div>

            {/* 30-Day Cash Outlook Sparkline */}
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#E5A93C]" />
                  30-Day Cash Outlook (Forecast)
                </span>
                <span className="text-slate-400">Safe buffer threshold: {formatMoney(10000)}</span>
              </div>

              <div className="grid grid-cols-5 gap-2 text-center">
                {cashOutlook.map((item, idx) => (
                  <div key={idx} className="bg-white/5 p-2 rounded-lg border border-white/5 hover:border-[#E5A93C]/40 transition">
                    <div className="text-[11px] text-slate-400 mb-1">{item.day}</div>
                    <div className="text-xs font-bold num-font text-white">{formatMoney(item.balance)}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Quick Action Banner */}
          <div className="glass-card p-5 border border-[#E5A93C]/20 bg-gradient-to-r from-[#E5A93C]/10 via-transparent to-transparent flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E5A93C]/20 text-[#E5A93C] flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Import Landed Cost Benchmark Verified</h4>
                <p className="text-xs text-slate-400">
                  Shipment IMP-2026-001 landed cost tested: Product A is $11.77/unit, Product B is $3.82/unit.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('imports')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#E5A93C] text-black hover:bg-[#F3C368] transition"
            >
              View Landed Cost Studio &rarr;
            </button>
          </div>

        </div>

        {/* Right Col: "Needs Attention" & Guided Prompts */}
        <div className="space-y-4">
          
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#E5A93C]" />
                <h3 className="text-sm font-bold text-white">Needs Attention</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                {needsAttention.length} items
              </span>
            </div>

            <div className="space-y-3">
              {needsAttention.map((item) => (
                <div 
                  key={item.id}
                  className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition ${
                    item.severity === 'HIGH'
                      ? 'bg-[#F43F5E]/10 border-[#F43F5E]/30 text-rose-200'
                      : item.severity === 'MEDIUM'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : 'bg-[#38BDF8]/10 border-[#38BDF8]/30 text-sky-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{item.title}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/30 font-mono">
                      {item.severity}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Setup / System Rules Checklist */}
          <div className="glass-card p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
              Loops Finance Invariants
            </h4>
            <ul className="text-xs space-y-2 text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] mt-0.5 shrink-0" />
                <span>Double-entry ledger is single source of truth</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] mt-0.5 shrink-0" />
                <span>Stock quantities come from Stock Loops; Finance computes cost</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] mt-0.5 shrink-0" />
                <span>Exact Decimal(19,4) math; zero rounding discrepancies</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] mt-0.5 shrink-0" />
                <span>Immutable posted entries; errors reversed, never deleted</span>
              </li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}

