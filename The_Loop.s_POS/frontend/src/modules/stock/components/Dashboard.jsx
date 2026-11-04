import React, { useState, useMemo, useEffect } from 'react';
import { api, formatMoney } from '../api';
import Icon from './Icon';

/**
 * Universal Retail OS — Executive Operations Dashboard
 * Conforms to UI/UX Pro Max and Design System Skill specifications:
 * - Three-layer token architecture (Primitive → Semantic → Component)
 * - WCAG 2.1 AA accessible contrast & keyboard focus states
 * - Fluid mobile-first responsive layout (CLS < 0.1)
 * - Integrated operational telemetry, replenishment command, and live movement stream
 */
export default function Dashboard({
  dashboardData,
  locations = [],
  scopeLocationId = 'ALL',
  onScopeChange,
  onSelectLocation,
  onResetData,
  onQuickReceive,
  onNavigate,
  onOpenSaleModal,
  onOpenReceiveModal,
  onOpenTransferModal,
  onOpenExportModal,
  onOpenNewProductModal
}) {
  const [alertFilter, setAlertFilter] = useState('ALL'); // 'ALL' | 'OOS' | 'LOW'
  const [alertSearch, setAlertSearch] = useState('');
  const [copiedSku, setCopiedSku] = useState(null);
  const [accountingStatus, setAccountingStatus] = useState(null);
  const [isSyncingAccounting, setIsSyncingAccounting] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  useEffect(() => {
    checkAccountingStatus();
  }, []);

  const checkAccountingStatus = async () => {
    try {
      const res = await api.getAccountingBridgeStatus();
      setAccountingStatus(res);
    } catch (e) {
      setAccountingStatus({ connected: false });
    }
  };

  const handleTriggerAccountingSync = async () => {
    setIsSyncingAccounting(true);
    setSyncFeedback(null);
    try {
      const res = await api.triggerAccountingSync();
      setSyncFeedback({ success: true, message: 'Synchronized with Loops Finance V3 General Ledger!' });
      await checkAccountingStatus();
      setTimeout(() => setSyncFeedback(null), 4500);
    } catch (err) {
      setSyncFeedback({ success: false, message: err.message || 'Sync failed' });
      setTimeout(() => setSyncFeedback(null), 4500);
    } finally {
      setIsSyncingAccounting(false);
    }
  };

  // Copy SKU helper with accessible feedback
  const handleCopySku = (sku, e) => {
    e?.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(sku);
      setCopiedSku(sku);
      setTimeout(() => setCopiedSku(null), 2000);
    }
  };

  if (!dashboardData) {
    return (
      <div className="py-24 px-4 text-center text-studio-400 font-mono text-xs flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 animate-spin">
          <Icon name="inventory" size={24} />
        </div>
        <div className="space-y-1">
          <p className="font-display font-bold text-white text-base tracking-wide">Syncing Telemetry Engine...</p>
          <p className="text-studio-400 text-xs font-mono">Aggregating real-time balances, valuation models, and logistics nodes.</p>
        </div>
      </div>
    );
  }

  const {
    totalCogs = 0,
    totalRetail = 0,
    totalUnits = 0,
    totalSkus = 0,
    totalProducts = 0,
    totalSalesCents = 0,
    totalUnitsSold = 0,
    totalDamaged = 0,
    alertVariants = [],
    locationStats = [],
    recentMovements = []
  } = dashboardData;

  // Valuation & Margin calculations
  const grossMargin = Math.max(0, totalRetail - totalCogs);
  const markupPct = totalCogs > 0 ? Math.round((grossMargin / totalCogs) * 100) : 0;
  const marginPct = totalRetail > 0 ? Math.round((grossMargin / totalRetail) * 100) : 0;
  const costRatio = totalRetail > 0 ? Math.round((totalCogs / totalRetail) * 100) : 0;

  // Inventory density
  const avgUnitsPerSku = totalSkus > 0 ? (totalUnits / totalSkus).toFixed(1) : '0';

  // Replenishment breakdown
  const oosVariants = alertVariants.filter((a) => a.variant.onHand === 0);
  const lowStockVariants = alertVariants.filter((a) => a.variant.onHand > 0);
  const oosCount = oosVariants.length;
  const lowCount = lowStockVariants.length;

  // Filtered Alert Variants
  const filteredAlerts = useMemo(() => {
    return alertVariants.filter((item) => {
      const isOos = item.variant.onHand === 0;
      if (alertFilter === 'OOS' && !isOos) return false;
      if (alertFilter === 'LOW' && isOos) return false;

      if (alertSearch.trim()) {
        const q = alertSearch.trim().toLowerCase();
        const skuMatch = item.variant.sku?.toLowerCase().includes(q);
        const nameMatch = item.product.name?.toLowerCase().includes(q);
        const titleMatch = item.variant.title?.toLowerCase().includes(q);
        return skuMatch || nameMatch || titleMatch;
      }
      return true;
    });
  }, [alertVariants, alertFilter, alertSearch]);

  // Global Health Aggregates across all branch nodes
  const networkTotals = useMemo(() => {
    let inStock = 0;
    let low = 0;
    let oos = 0;
    locationStats.forEach((loc) => {
      inStock += loc.inStockCount || 0;
      low += loc.lowStockCount || 0;
      oos += loc.oosCount || 0;
    });
    const total = inStock + low + oos;
    const inStockPct = total > 0 ? Math.round((inStock / total) * 100) : 100;
    const lowPct = total > 0 ? Math.round((low / total) * 100) : 0;
    const oosPct = total > 0 ? Math.round((oos / total) * 100) : 0;
    return { inStock, low, oos, total, inStockPct, lowPct, oosPct };
  }, [locationStats]);

  const currentScopeLoc = locations.find((l) => l.id === scopeLocationId);

  return (
    <section className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* =========================================================================
          1. Operations Control Center Header
          ========================================================================= */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/10 space-y-5 shadow-xl relative overflow-hidden">
        {/* Subtle Ambient Background Flare */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 badge-pulse" />
                <span>Live Telemetry Engine</span>
              </span>

              <button
                onClick={handleTriggerAccountingSync}
                disabled={isSyncingAccounting}
                className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase transition-all ${
                  accountingStatus?.connected
                    ? 'bg-indigo-500/15 text-indigo-300 hover:text-white border border-indigo-500/30 hover:bg-indigo-500/25 cursor-pointer'
                    : 'bg-studio-800 text-studio-400 border border-white/10'
                }`}
                title="Click to trigger bi-directional synchronization with Loops Finance V3 General Ledger (Port 3001)"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${accountingStatus?.connected ? 'bg-indigo-400 badge-pulse' : 'bg-studio-500'}`} />
                <span>Finance OS: {accountingStatus?.connected ? (isSyncingAccounting ? 'Syncing...' : 'Synced (Port 3001)') : 'Standby'}</span>
                {accountingStatus?.connected && <Icon name="refresh" size={10} className={isSyncingAccounting ? 'animate-spin' : ''} />}
              </button>

              <span className="text-[11px] font-mono text-studio-400">
                {scopeLocationId === 'ALL'
                  ? `Consolidated Scope (${locations.length} Facilities)`
                  : `Store Scope: ${currentScopeLoc?.name || scopeLocationId}`}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold tracking-tight text-white flex items-center space-x-2">
              <span>Universal Operations Hub</span>
            </h1>

            <p className="text-xs sm:text-sm text-studio-300 mt-1.5 max-w-2xl leading-relaxed">
              Consolidated command center for live multi-location stock balances, inventory valuation, reorder thresholds, and commercial POS velocity.
            </p>
          </div>

          {/* Scope Selector & Quick Command Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Scope Selector Dropdown */}
            <div className="flex items-center space-x-2 bg-studio-900/90 px-3 py-1.5 rounded-xl border border-white/10 shadow-sm">
              <span className="text-xs font-mono text-studio-400 flex items-center space-x-1.5">
                <Icon name="locations" size={13} className="text-gold-400" />
                <span className="hidden sm:inline">Scope:</span>
              </span>
              <select
                value={scopeLocationId}
                onChange={(e) => onScopeChange && onScopeChange(e.target.value)}
                className="bg-studio-950 border border-gold-500/30 text-gold-400 font-mono text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-gold-500/50 cursor-pointer"
                aria-label="Filter operational telemetry by facility scope"
              >
                <option value="ALL">Consolidated (All Stores & Facilities)</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Action: New POS Sale */}
            {onOpenSaleModal && (
              <button
                onClick={onOpenSaleModal}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gold-500 hover:bg-gold-400 text-studio-950 transition-all flex items-center space-x-1.5 shadow-md shadow-gold-500/20 active:scale-95"
                title="Launch Point of Sale checkout"
                aria-label="Launch Point of Sale checkout"
              >
                <Icon name="sales" size={13} />
                <span>New Sale</span>
              </button>
            )}

            {/* Quick Action: Inbound Receiving */}
            {onOpenReceiveModal && (
              <button
                onClick={onOpenReceiveModal}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-studio-900 hover:bg-studio-800 text-studio-100 hover:text-white border border-white/10 transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
                title="Receive inbound stock into warehouse or store"
                aria-label="Receive inbound stock"
              >
                <Icon name="receive" size={13} className="text-emerald-400" />
                <span>Receive</span>
              </button>
            )}

            {/* Quick Action: Inter-Store Transfer */}
            {onOpenTransferModal && (
              <button
                onClick={onOpenTransferModal}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-studio-900 hover:bg-studio-800 text-studio-100 hover:text-white border border-white/10 transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
                title="Transfer inventory between branch stores"
                aria-label="Transfer stock between locations"
              >
                <Icon name="transfer" size={13} className="text-indigo-400" />
                <span className="hidden sm:inline">Transfer</span>
              </button>
            )}

            {/* Quick Action: Export Dossier */}
            {onOpenExportModal && (
              <button
                onClick={onOpenExportModal}
                className="p-2 text-xs rounded-xl bg-studio-900 hover:bg-studio-800 text-studio-300 hover:text-white border border-white/10 transition-all shadow-sm active:scale-95"
                title="Export stock ledger to Excel, PDF or CSV"
                aria-label="Export reports"
              >
                <Icon name="export" size={14} />
              </button>
            )}

            {/* Reset System State */}
            {onResetData && (
              <button
                onClick={onResetData}
                className="p-2 text-xs rounded-xl bg-studio-900/60 hover:bg-crimson-500/10 text-studio-400 hover:text-crimson-400 border border-white/5 hover:border-crimson-500/30 transition-all shadow-sm active:scale-95"
                title="Reset to fresh registration state"
                aria-label="Reset platform setup"
              >
                <Icon name="refresh" size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filtered Scope Alert Banner */}
        {scopeLocationId !== 'ALL' && currentScopeLoc && (
          <div className="p-3.5 rounded-xl bg-gold-500/10 border border-gold-500/25 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-gold-400 shadow-sm">
            <div className="flex items-center space-x-2">
              <Icon name="locations" size={14} className="text-gold-400" />
              <span>
                Displaying telemetry specifically for: <strong className="text-white">{currentScopeLoc.name}</strong> ({currentScopeLoc.code}) • {currentScopeLoc.type || 'Retail Node'}
              </span>
            </div>
            <button
              onClick={() => onScopeChange && onScopeChange('ALL')}
              className="text-studio-300 hover:text-white px-2.5 py-1 rounded-lg bg-studio-900/80 hover:bg-studio-800 border border-white/10 transition-all text-[11px] flex items-center space-x-1"
            >
              <span>Switch to Consolidated View</span>
              <Icon name="close" size={11} />
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
          2. Executive KPI Scorecard Grid (Bento Metrics)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Inventory Valuation (COGS & Retail Potential) */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:border-gold-500/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono tracking-wider uppercase text-studio-400 block font-semibold">
              Inventory Capital Valuation
            </span>
            <div className="w-8 h-8 rounded-xl bg-gold-500/10 text-gold-400 flex items-center justify-center border border-gold-500/20 group-hover:scale-105 transition-transform">
              <Icon name="dollar" size={15} />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl lg:text-3xl font-display font-extrabold text-white tracking-tight">
                {formatMoney(totalCogs)}
              </span>
              <span className="text-xs font-mono text-gold-400 font-bold px-1.5 py-0.5 rounded bg-gold-500/10 border border-gold-500/20">
                COGS
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-studio-400 mt-2 font-mono">
              <span>Potential Retail:</span>
              <strong className="text-white">{formatMoney(totalRetail)}</strong>
            </div>

            {/* Profit Spread Mini-Meter */}
            <div className="mt-3 pt-2.5 border-t border-white/5 space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono text-studio-400">
                <span>Cost / Margin Spread</span>
                <span className="text-gold-400 font-semibold">{markupPct}% markup ({marginPct}% margin)</span>
              </div>
              <div className="h-1.5 w-full bg-studio-950 rounded-full overflow-hidden flex">
                <div style={{ width: `${costRatio}%` }} className="bg-gold-500 h-full" title={`COGS Ratio: ${costRatio}%`} />
                <div style={{ width: `${100 - costRatio}%` }} className="bg-emerald-500 h-full" title={`Unrealized Gross Margin: ${100 - costRatio}%`} />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Physical Units On Hand & SKU Scale */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono tracking-wider uppercase text-studio-400 block font-semibold">
              Physical Stock On Hand
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <Icon name="box" size={15} />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl lg:text-3xl font-display font-extrabold text-white tracking-tight">
                {totalUnits.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-emerald-400 font-semibold">units</span>
            </div>

            <div className="flex items-center space-x-3 text-[11px] text-studio-400 mt-2 font-mono">
              <span>Active SKUs: <strong className="text-white">{totalSkus}</strong></span>
              <span>•</span>
              <span>Products: <strong className="text-white">{totalProducts}</strong></span>
            </div>

            {/* Average Stock Density per SKU */}
            <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
              <span className="text-studio-400">Stock Density:</span>
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {avgUnitsPerSku} units / SKU
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: POS Commercial Velocity */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:border-indigo-500/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono tracking-wider uppercase text-studio-400 block font-semibold">
              POS Gross Commercial Revenue
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 group-hover:scale-105 transition-transform">
              <Icon name="trendingUp" size={15} />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl lg:text-3xl font-display font-extrabold text-white tracking-tight">
                {formatMoney(totalSalesCents)}
              </span>
              <span className="text-xs font-mono text-indigo-400 font-semibold">revenue</span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-studio-400 mt-2 font-mono">
              <span>Volume Sold:</span>
              <strong className="text-white">{totalUnitsSold} units</strong>
            </div>

            {/* Sales Momentum Tag */}
            <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
              <span className="text-studio-400">Sales Channel:</span>
              <span className="text-indigo-400 font-semibold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span>Live POS Terminal</span>
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Replenishment Alerts & Stockout Risk */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:border-crimson-500/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono tracking-wider uppercase text-studio-400 block font-semibold">
              Replenishment Alert Level
            </span>
            <div className="w-8 h-8 rounded-xl bg-crimson-500/10 text-crimson-400 flex items-center justify-center border border-crimson-500/20 group-hover:scale-105 transition-transform">
              <Icon name="alertTriangle" size={15} />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl lg:text-3xl font-display font-extrabold text-crimson-400 tracking-tight">
                {alertVariants.length}
              </span>
              <span className="text-xs font-mono text-crimson-400 font-semibold">SKUs alert</span>
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-studio-400 mt-2 font-mono">
              <span>OOS: <strong className="text-crimson-400 font-bold">{oosCount}</strong></span>
              <span>•</span>
              <span>Low: <strong className="text-gold-400 font-bold">{lowCount}</strong></span>
              <span>•</span>
              <span>Damaged: <strong className="text-white">{totalDamaged}</strong></span>
            </div>

            {/* Fast Jump Link */}
            <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
              <span className="text-studio-400">Risk Assessment:</span>
              <span className={`font-bold px-2 py-0.5 rounded ${
                alertVariants.length === 0
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-crimson-500/10 text-crimson-400 border border-crimson-500/20'
              }`}>
                {alertVariants.length === 0 ? 'Optimal (100% Stocked)' : `${alertVariants.length} Under Threshold`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2b. Accounting System Bridge (Loops Finance V3 OS)
          ========================================================================= */}
      <div className="glass-panel p-5 rounded-2xl border border-indigo-500/25 bg-gradient-to-r from-studio-900/90 via-studio-900/80 to-indigo-950/20 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${accountingStatus?.connected ? 'bg-emerald-400 badge-pulse' : 'bg-studio-500'}`} />
              <span className="font-mono text-xs uppercase font-bold tracking-wider text-indigo-400">
                Accounting & Financial OS Synchronization
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-studio-300">
                Port 3001
              </span>
              {accountingStatus?.bridgeInfo?.storeName && (
                <span className="text-[10px] font-mono text-studio-400 hidden sm:inline">
                  • Store: <strong className="text-white">{accountingStatus.bridgeInfo.storeName}</strong>
                </span>
              )}
            </div>
            <h3 className="font-display font-bold text-white text-base flex items-center space-x-2">
              <span>Loops Finance V3 General Ledger Bridge:</span>
              <span className={accountingStatus?.connected ? 'text-emerald-400' : 'text-studio-400'}>
                {accountingStatus?.connected ? 'CONNECTED & SYNCHRONIZED' : 'STANDBY (PORT 3001)'}
              </span>
            </h3>
            <p className="text-xs text-studio-300 font-mono leading-relaxed max-w-3xl">
              2-Way Architectural Contract: Stock Loops owns physical balances, SKUs & POS registers • Loops Finance owns the General Ledger, automated double-entry revenue/COGS journals (`Dr 1010 Bank / Cr 4010 Sales`), and True Landed Cost distribution.
            </p>
          </div>

          <div className="flex items-center space-x-2.5 flex-shrink-0">
            <button
              onClick={handleTriggerAccountingSync}
              disabled={isSyncingAccounting}
              className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/30 font-mono text-xs font-bold transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 disabled:opacity-50"
              title="Trigger real-time bi-directional sync of SKUs and POS sales to Loops Finance"
            >
              <Icon name="refresh" size={13} className={isSyncingAccounting ? 'animate-spin' : ''} />
              <span>{isSyncingAccounting ? 'Synchronizing Ledger...' : 'Run 2-Way Sync Now'}</span>
            </button>
          </div>
        </div>

        {syncFeedback && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs font-mono border flex items-center space-x-2 animate-in fade-in ${
            syncFeedback.success ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-crimson-500/10 text-crimson-300 border-crimson-500/30'
          }`}>
            <Icon name={syncFeedback.success ? 'checkCircle' : 'alertTriangle'} size={14} />
            <span>{syncFeedback.message}</span>
          </div>
        )}
      </div>
      <div className="glass-panel p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/10 space-y-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
          <div>
            <div className="flex items-center space-x-2">
              <Icon name="locations" size={17} className="text-gold-400" />
              <h2 className="font-display font-bold text-base sm:text-lg text-white">
                Multi-Location Logistics & Facility Distribution
              </h2>
            </div>
            <p className="text-xs text-studio-400 mt-0.5">
              Physical stock distribution, health ratios, and facility allocation across all retail branches and distribution hubs.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate && onNavigate('locations')}
              className="px-3 py-1.5 rounded-xl bg-studio-900 hover:bg-studio-800 text-gold-400 hover:text-gold-300 font-mono text-xs font-semibold border border-white/10 transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
            >
              <span>Manage Network Nodes</span>
              <Icon name="arrowRight" size={12} />
            </button>
          </div>
        </div>

        {/* Global Stock Health Bar */}
        {networkTotals.total > 0 && (
          <div className="p-4 rounded-xl bg-studio-950/70 border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-studio-300 font-semibold flex items-center space-x-1.5">
                <Icon name="activity" size={13} className="text-gold-400" />
                <span>Global Catalog Health Distribution</span>
              </span>
              <span className="text-studio-400 text-[11px]">
                {networkTotals.total.toLocaleString()} total SKU-facility instances
              </span>
            </div>

            {/* Triple Segment Bar */}
            <div className="h-2.5 w-full bg-studio-900 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${networkTotals.inStockPct}%` }}
                className="bg-emerald-500 h-full transition-all duration-500"
                title={`Healthy Stock: ${networkTotals.inStock} (${networkTotals.inStockPct}%)`}
              />
              <div
                style={{ width: `${networkTotals.lowPct}%` }}
                className="bg-gold-500 h-full transition-all duration-500"
                title={`Low Stock Threshold: ${networkTotals.low} (${networkTotals.lowPct}%)`}
              />
              <div
                style={{ width: `${networkTotals.oosPct}%` }}
                className="bg-crimson-500 h-full transition-all duration-500"
                title={`Critical Out of Stock: ${networkTotals.oos} (${networkTotals.oosPct}%)`}
              />
            </div>

            {/* Legend Chips */}
            <div className="flex flex-wrap items-center gap-4 pt-1 font-mono text-[11px]">
              <span className="flex items-center space-x-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{networkTotals.inStock} Healthy ({networkTotals.inStockPct}%)</span>
              </span>
              <span className="flex items-center space-x-1.5 text-gold-400">
                <span className="w-2 h-2 rounded-full bg-gold-500" />
                <span>{networkTotals.low} Low Stock ({networkTotals.lowPct}%)</span>
              </span>
              <span className="flex items-center space-x-1.5 text-crimson-400">
                <span className="w-2 h-2 rounded-full bg-crimson-500" />
                <span>{networkTotals.oos} Out of Stock ({networkTotals.oosPct}%)</span>
              </span>
            </div>
          </div>
        )}

        {/* Location Grid Cards */}
        {locationStats.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-studio-400 bg-studio-900/40 rounded-xl space-y-2 border border-white/5">
            <Icon name="locations" size={24} className="text-gold-400 mx-auto" />
            <p>No branch locations registered yet. Set up your first physical store or warehouse.</p>
            <button
              onClick={() => onNavigate && onNavigate('locations')}
              className="mt-2 px-3 py-1.5 bg-gold-500 text-studio-950 font-bold text-xs rounded-lg shadow-sm"
            >
              Add First Store Node →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locationStats.map((loc) => {
              const total = (loc.inStockCount || 0) + (loc.lowStockCount || 0) + (loc.oosCount || 0);
              const inStockPct = total > 0 ? (loc.inStockCount / total) * 100 : 0;
              const lowStockPct = total > 0 ? (loc.lowStockCount / total) * 100 : 0;
              const oosPct = total > 0 ? (loc.oosCount / total) * 100 : 0;
              const isCurrentScoped = scopeLocationId === loc.id;

              return (
                <div
                  key={loc.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between shadow-sm space-y-3 ${
                    isCurrentScoped
                      ? 'bg-gold-500/10 border-gold-500/40 shadow-gold-500/5 ring-1 ring-gold-500/30'
                      : 'bg-studio-900/60 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-white/5 text-gold-400 border border-white/10">
                          {loc.code}
                        </span>
                        {loc.isDefault && (
                          <span className="text-gold-400 text-[10px] font-mono px-1.5 py-0.5 rounded bg-gold-500/15 border border-gold-500/30 font-semibold">
                            Primary HQ
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-studio-400 uppercase font-semibold">
                        {loc.type || 'Retail Store'}
                      </span>
                    </div>

                    <h3 className="font-display font-bold text-sm text-white mt-2">{loc.name}</h3>
                    <p className="text-[11px] text-studio-400 font-mono mt-0.5 truncate">
                      {loc.address || 'Standard retail node'}
                    </p>
                  </div>

                  {/* Stock health distribution bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-studio-300">
                      <span>Physical Stock</span>
                      <span className="text-white font-bold">{loc.totalUnits?.toLocaleString() || 0} units</span>
                    </div>

                    <div className="h-2 w-full bg-studio-950 rounded-full overflow-hidden flex">
                      <div style={{ width: `${inStockPct}%` }} className="bg-emerald-500 h-full" title={`In Stock: ${loc.inStockCount}`} />
                      <div style={{ width: `${lowStockPct}%` }} className="bg-gold-500 h-full" title={`Low Stock: ${loc.lowStockCount}`} />
                      <div style={{ width: `${oosPct}%` }} className="bg-crimson-500 h-full" title={`OOS: ${loc.oosCount}`} />
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-0.5 text-center font-mono text-[10px]">
                      <span className="text-emerald-400">{loc.inStockCount || 0} healthy</span>
                      <span className="text-gold-400">{loc.lowStockCount || 0} low</span>
                      <span className="text-crimson-400">{loc.oosCount || 0} oos</span>
                    </div>
                  </div>

                  {/* Node Actions */}
                  <div className="pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                    <button
                      onClick={() => onSelectLocation && onSelectLocation(loc.id, 'ALL')}
                      className="text-gold-400 hover:text-gold-300 font-medium flex items-center space-x-1"
                      title={`Inspect ${loc.name} stock inventory`}
                    >
                      <span>Inspect Store Stock</span>
                      <Icon name="arrowRight" size={11} />
                    </button>

                    <button
                      onClick={() => onScopeChange && onScopeChange(loc.id)}
                      className={`text-[10px] px-2 py-0.5 rounded transition-all ${
                        isCurrentScoped
                          ? 'bg-gold-500 text-studio-950 font-bold'
                          : 'bg-white/5 hover:bg-white/10 text-studio-300 hover:text-white'
                      }`}
                      title={`Focus telemetry on ${loc.name}`}
                    >
                      {isCurrentScoped ? 'Active Scope' : 'Filter Scope'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          4. Operational Split: Replenishment Command & Live Movement Stream
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-7">
        {/* Left Column: Replenishment & Reorder Command Center (2 Cols) */}
        <div className="lg:col-span-2 glass-panel p-5 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4 border border-white/10 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header with Alert Count & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
              <div className="flex items-center space-x-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${alertVariants.length > 0 ? 'bg-crimson-500 badge-pulse' : 'bg-emerald-400'}`} />
                <div>
                  <h2 className="font-display font-bold text-base text-white">
                    Replenishment & Critical Stock Thresholds
                  </h2>
                  <p className="text-xs text-studio-400 mt-0.5">
                    Proactive reorder triggers based on Reorder Point (ROP) thresholds.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-crimson-500/15 text-crimson-400 border border-crimson-500/30 font-bold">
                  {alertVariants.length} SKUs Alerting
                </span>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            {alertVariants.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                {/* Filter Tabs */}
                <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-studio-950/80 border border-white/5 text-xs font-mono">
                  <button
                    onClick={() => setAlertFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      alertFilter === 'ALL'
                        ? 'bg-gold-500 text-studio-950 font-bold shadow-sm'
                        : 'text-studio-400 hover:text-white'
                    }`}
                  >
                    All ({alertVariants.length})
                  </button>
                  <button
                    onClick={() => setAlertFilter('OOS')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      alertFilter === 'OOS'
                        ? 'bg-crimson-500 text-white font-bold shadow-sm'
                        : 'text-studio-400 hover:text-white'
                    }`}
                  >
                    OOS (0) ({oosCount})
                  </button>
                  <button
                    onClick={() => setAlertFilter('LOW')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      alertFilter === 'LOW'
                        ? 'bg-gold-500 text-studio-950 font-bold shadow-sm'
                        : 'text-studio-400 hover:text-white'
                    }`}
                  >
                    Low Stock ({lowCount})
                  </button>
                </div>

                {/* SKU Search Input */}
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="text"
                    value={alertSearch}
                    onChange={(e) => setAlertSearch(e.target.value)}
                    placeholder="Search SKU or product..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-studio-950 rounded-xl border border-white/10 text-white placeholder-studio-400 focus:outline-none focus:border-gold-500/50"
                  />
                  <div className="absolute left-2.5 top-2 text-studio-400 pointer-events-none">
                    <Icon name="search" size={12} />
                  </div>
                  {alertSearch && (
                    <button
                      onClick={() => setAlertSearch('')}
                      className="absolute right-2.5 top-2 text-studio-400 hover:text-white"
                      title="Clear search"
                    >
                      <Icon name="close" size={11} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* List of Alert Items */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {alertVariants.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-studio-400 bg-studio-900/40 rounded-xl space-y-3 border border-white/5">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                    <Icon name="checkCircle" size={20} />
                  </div>
                  <div>
                    <p className="font-display font-bold text-white text-sm">Stock Integrity Optimal</p>
                    <p className="text-studio-400 text-xs mt-1">
                      {totalProducts === 0
                        ? 'Fresh platform state: No products registered yet. Head to the Product Catalog to register items.'
                        : 'All active SKUs in this scope are well-stocked above reorder thresholds.'}
                    </p>
                  </div>
                  {totalProducts === 0 && onNavigate && (
                    <button
                      onClick={() => onNavigate('catalog')}
                      className="mt-2 px-4 py-2 bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
                    >
                      Open Product Catalog →
                    </button>
                  )}
                </div>
              ) : filteredAlerts.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-studio-400 bg-studio-900/30 rounded-xl border border-white/5">
                  No alerts match your search or category filter.
                </div>
              ) : (
                filteredAlerts.map((item) => {
                  const isOos = item.variant.onHand === 0;
                  const deficit = Math.max(0, (item.variant.rop || 0) - item.variant.onHand);

                  return (
                    <div
                      key={`${item.product.id}-${item.variant.sku}`}
                      className="p-3.5 bg-studio-900/70 border border-white/5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-gold-500/40 transition-all shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={(e) => handleCopySku(item.variant.sku, e)}
                            className="font-mono text-xs font-bold text-gold-400 hover:text-gold-300 flex items-center space-x-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10"
                            title="Click to copy SKU"
                          >
                            <span>{item.variant.sku}</span>
                            <Icon name={copiedSku === item.variant.sku ? "check" : "copy"} size={10} />
                          </button>
                          <span className="text-xs font-bold text-white">{item.product.name}</span>
                          {item.product.category && (
                            <span className="text-[10px] font-mono text-studio-400 px-1.5 py-0.2 rounded bg-studio-950">
                              {item.product.category}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-studio-400 font-mono">
                          Variant: <span className="text-studio-200">{item.variant.title}</span>
                          {item.variant.barcode && (
                            <span className="ml-2 text-[10px] text-studio-400">
                              Barcode: {item.variant.barcode}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end space-x-3.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                        <div className="text-left sm:text-right font-mono">
                          <span className={`text-xs font-bold ${isOos ? 'text-crimson-400' : 'text-gold-400'} block`}>
                            {item.variant.onHand} on hand {isOos && '(OUT OF STOCK)'}
                          </span>
                          <span className="text-[10px] text-studio-400 block">
                            Threshold ROP: {item.variant.rop} • Need +{deficit}
                          </span>
                        </div>

                        <button
                          onClick={() => onQuickReceive && onQuickReceive(item.variant.sku)}
                          className="px-3 py-1.5 bg-gold-500/15 hover:bg-gold-500 text-gold-400 hover:text-studio-950 font-mono text-xs font-bold rounded-xl border border-gold-500/30 transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
                          title={`Quick restock inbound units for ${item.variant.sku}`}
                        >
                          <Icon name="receive" size={12} />
                          <span>Restock</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Catalog Link Footer */}
          <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between text-xs font-mono text-studio-400">
            <span>Showing live replenishment signals based on ROP criteria</span>
            <button
              onClick={() => onNavigate && onNavigate('catalog')}
              className="text-gold-400 hover:text-gold-300 font-medium flex items-center space-x-1"
            >
              <span>Explore All Catalog SKUs</span>
              <Icon name="arrowRight" size={11} />
            </button>
          </div>
        </div>

        {/* Right Column: Real-Time Stock Movement Stream (Audit Trail) */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4 border border-white/10 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center space-x-2">
                <Icon name="activity" size={16} className="text-gold-400" />
                <h2 className="font-display font-bold text-base text-white">Live Movement Stream</h2>
              </div>
              <span className="text-[10px] font-mono text-studio-400 uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5">
                Audit Trail
              </span>
            </div>

            <div className="space-y-2.5 mt-4 text-xs font-mono">
              {recentMovements.length === 0 ? (
                <div className="p-8 text-center text-studio-400 bg-studio-900/30 rounded-xl space-y-2 border border-white/5">
                  <Icon name="inventory" size={20} className="text-studio-400 mx-auto" />
                  <p>No stock movement transactions recorded yet.</p>
                </div>
              ) : (
                recentMovements.slice(0, 6).map((m) => {
                  const isPositive = m.delta > 0;
                  const isNegative = m.delta < 0;

                  // Semantic badge styling per movement type
                  let typeColorClass = 'text-gold-400 bg-gold-500/10 border-gold-500/20';
                  if (m.type === 'RECEIVE' || m.type === 'PURCHASE') {
                    typeColorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                  } else if (m.type === 'SALE') {
                    typeColorClass = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
                  } else if (m.type === 'DAMAGE' || m.type === 'SCRAP') {
                    typeColorClass = 'text-crimson-400 bg-crimson-500/10 border-crimson-500/20';
                  }

                  return (
                    <div
                      key={m.id}
                      className="p-3 bg-studio-900/50 rounded-xl border border-white/5 flex items-center justify-between hover:border-white/15 transition-all shadow-sm"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${typeColorClass}`}>
                            {m.type}
                          </span>
                          <span className="text-white text-xs font-bold">{m.sku}</span>
                        </div>
                        {m.reference && (
                          <span className="text-[10px] text-studio-400 block truncate max-w-[140px]">
                            Ref: {m.reference}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className={`text-xs font-bold ${isPositive ? 'text-emerald-400' : isNegative ? 'text-crimson-400' : 'text-studio-300'}`}>
                          {isPositive ? '+' : ''}{m.delta}
                        </span>
                        <span className="text-[10px] text-studio-400 block font-mono">
                          Bal: <strong className="text-studio-200">{m.balanceAfter}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate && onNavigate('inventory')}
            className="w-full mt-4 py-2.5 bg-studio-900 hover:bg-studio-800 text-xs font-semibold text-studio-200 hover:text-white rounded-xl border border-white/10 transition-all text-center flex items-center justify-center space-x-1.5 shadow-sm active:scale-95"
            aria-label="View complete movement ledger in inventory management"
          >
            <span>View Complete Movement Ledger</span>
            <Icon name="arrowRight" size={13} />
          </button>
        </div>
      </div>
    </section>
  );
}
