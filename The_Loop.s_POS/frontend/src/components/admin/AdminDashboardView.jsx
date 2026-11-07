import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { useSync } from '../../context/SyncContext';
import PosDashboardView from '../PosDashboardView';
import UserAndAccessManagementView from '../UserAndAccessManagementView';
import SalesHistoryView from '../SalesHistoryView';
import HardwareSettingsView from '../HardwareSettingsView';
import ManagerShiftDashboardView from '../shifts/ManagerShiftDashboardView';
import CashierSalesPerformanceView from '../shifts/CashierSalesPerformanceView';
import SavedOrdersView from '../saved-orders/SavedOrdersView';
import StoreManagementView from './StoreManagementView';
import ImportHistoryView from './ImportHistoryView';
import MonthlyRevenueAllocationView from './MonthlyRevenueAllocationView';
import LoopShareManagementView from './LoopShareManagementView';
import MonthlyFinancialHistoryView from './MonthlyFinancialHistoryView';
import ResetStoreDataModal from './ResetStoreDataModal';
import {
  LayoutDashboard,
  Users,
  Receipt,
  Cpu,
  Coins,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Globe,
  ShoppingCart,
  LogOut,
  Store,
  ExternalLink,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Building2,
  RefreshCw,
  Clock,
  Bookmark,
  Award,
  Ship,
  PieChart,
  History,
  Boxes,
  Package
} from 'lucide-react';

export default function AdminDashboardView() {
  const {
    currentUser,
    cashierUser,
    stores,
    currentStore,
    loadStores,
    logout,
    setAppView,
    exchangeRate,
    updateExchangeRate,
    toKhr,
    orgStatus,
    hasPermission,
    playBeep,
    authToken
  } = usePos();

  const { triadStatus } = useSync();

  const getInitialAdminTab = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab) return urlTab.toUpperCase();
      const savedTab = localStorage.getItem('loops_admin_tab');
      if (savedTab) return savedTab;
    }
    return 'OVERVIEW';
  };

  const [adminTab, setAdminTabState] = useState(getInitialAdminTab);

  const setAdminTab = (tab) => {
    setAdminTabState(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('loops_admin_tab', tab);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab.toLowerCase());
      window.history.replaceState({}, '', url.toString());
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab) setAdminTabState(urlTab.toUpperCase());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [newRateInput, setNewRateInput] = useState(exchangeRate || 4000);
  const [rateSaving, setRateSaving] = useState(false);
  const [rateFeedback, setRateFeedback] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [isResetStoreModalOpen, setIsResetStoreModalOpen] = useState(false);

  const activeUser = currentUser || cashierUser;

  // Check access rights
  const isOwner = activeUser?.role === 'OWNER' || activeUser?.role === 'SUPER_ADMIN' || Boolean(activeUser?.permissions?.isOwnerEquivalent);
  const canResetStoreData = isOwner || Boolean(activeUser?.permissions?.manageStoreData);
  const canManageStaff = hasPermission('manageEmployees') || isOwner || activeUser?.role === 'POS_ADMIN';
  const canAccessStock = hasPermission('accessStockApp') || isOwner || activeUser?.appAccess?.stock;
  const canAccessFinance = hasPermission('accessFinanceApp') || isOwner || activeUser?.appAccess?.finance;
  const canViewLoopShare = isOwner || hasPermission('viewLoopShare');
  const canViewAllocations = isOwner || hasPermission('viewMonthlyRevenue') || canAccessFinance;
  const canViewImports = isOwner || hasPermission('viewImportHistory') || canAccessStock;

  // Fetch security audit logs when switching to audit tab
  useEffect(() => {
    if (adminTab === 'AUDIT') {
      fetchAuditLogs();
    }
  }, [adminTab]);

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/audit/logs?limit=50', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(Array.isArray(data) ? data : (data.auditLogs || []));
      }
    } catch (e) {
      console.warn('Failed to load audit logs:', e);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleUpdateRate = async (e) => {
    e.preventDefault();
    setRateSaving(true);
    setRateFeedback(null);
    try {
      const res = await updateExchangeRate(newRateInput);
      if (res.ok) {
        setRateFeedback({ type: 'success', text: `Exchange rate successfully updated to 1 USD = ${Number(newRateInput).toLocaleString()} KHR` });
        playBeep(1200, 'sine', 0.1);
      } else {
        setRateFeedback({ type: 'error', text: res.error || 'Failed to update rate' });
      }
    } catch (err) {
      setRateFeedback({ type: 'error', text: err.message });
    } finally {
      setRateSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-obsidian-950 text-slate-100 font-sans select-none">
      {/* 1. Master Top Administration Header */}
      <header className="h-16 bg-obsidian-900/95 backdrop-blur-md border-b border-obsidian-800 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-sm select-none">
        {/* Brand & Organization Title */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brass-500 via-brass-400 to-brass-600 flex items-center justify-center font-display font-black text-obsidian-950 text-xs shadow-xs">
              ∞
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-slate-100 tracking-wider text-xs sm:text-sm uppercase font-display">
                  {orgStatus?.businessName || 'The Loops'}
                </span>
                <span className="text-[10px] bg-brass-500/20 text-brass-400 font-mono px-1.5 py-0.5 rounded border border-brass-500/30 uppercase tracking-widest font-semibold">
                  Admin
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 leading-none mt-0.5">
                <Store className="w-3 h-3 text-slate-500" />
                <span>Central Portal</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 font-mono text-[9px]">Private Cloud</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Center & Profile Bar */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Triad Live Health Pills (Click to jump to Stock / Finance) */}
          <div className="hidden lg:flex items-center space-x-2 bg-[#111522] hover:bg-[#171D2D] px-3 py-2 rounded-xl border border-[#232838] text-xs">
            <button
              onClick={() => setAppView('STOCK')}
              className="flex items-center space-x-1 hover:text-sky-400 transition"
              title="Switch to Stock Management"
            >
              <span className={`w-2 h-2 rounded-full ${triadStatus?.stock?.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-300 hover:text-sky-400 font-mono text-xs">Stock (3000)</span>
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => setAppView('FINANCE')}
              className="flex items-center space-x-1 hover:text-amber-400 transition"
              title="Switch to Loops Finance"
            >
              <span className={`w-2 h-2 rounded-full ${triadStatus?.finance?.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-300 hover:text-amber-400 font-mono text-xs">Finance (3001)</span>
            </button>
          </div>

          {/* Primary Action: Launch POS Register Checkout */}
          <button
            onClick={() => {
              playBeep(920, 'sine', 0.08);
              setAppView('POS');
            }}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-brass-500 to-brass-400 hover:from-brass-400 hover:to-brass-300 text-obsidian-950 font-bold px-3.5 py-2 rounded-xl text-xs shadow-xs active:scale-95 transition-all"
            title="Open Cashier Selling Terminal (New Sale)"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-obsidian-950" />
            <span>Launch POS</span>
          </button>

          {/* User Profile Badge */}
          <div className="flex items-center space-x-2 pl-2 border-l border-obsidian-800">
            <div className="w-7 h-7 rounded-full bg-brass-500/20 border border-brass-500/40 text-brass-400 flex items-center justify-center font-bold text-xs uppercase">
              {activeUser?.fullName?.charAt(0) || 'A'}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-200 leading-tight">
                {activeUser?.fullName || 'Admin'}
              </div>
              <div className="text-[10px] font-mono text-brass-400 uppercase tracking-wider leading-none">
                {activeUser?.role || 'OWNER'}
              </div>
            </div>

            {/* Logout Action */}
            <button
              onClick={logout}
              className="p-1.5 rounded-lg bg-obsidian-850 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 border border-obsidian-750 transition-colors"
              title="Secure Logout"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Admin Workspace: Navigation Sidebar + Active View Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side Navigation Sidebar */}
        <aside className="w-64 bg-obsidian-900/70 border-r border-obsidian-800/80 flex flex-col p-3 shrink-0 h-full overflow-hidden">
          <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1.5 select-none" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
            <div className="px-3 py-2 text-[10px] font-mono tracking-widest text-slate-500 uppercase font-semibold">
              Management Modules
            </div>

            <button
              onClick={() => setAdminTab('OVERVIEW')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                adminTab === 'OVERVIEW'
                  ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-obsidian-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Operations Overview</span>
            </button>

            {canManageStaff && (
              <button
                onClick={() => setAdminTab('STAFF')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  adminTab === 'STAFF'
                    ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-obsidian-800'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Staff & Access Matrix</span>
              </button>
            )}

            <button
              onClick={() => setAdminTab('STORES')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                adminTab === 'STORES'
                  ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-obsidian-800'
              }`}
            >
              <Store className="w-4 h-4 shrink-0" />
              <span>Multi-Store & Branches</span>
            </button>

            <button
              onClick={() => setAdminTab('SALES')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                adminTab === 'SALES'
                  ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-obsidian-800'
              }`}
            >
              <Receipt className="w-4 h-4 shrink-0" />
              <span>Sales & Receipts History</span>
            </button>

            <button
              onClick={() => setAdminTab('SHIFT_MGMT')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                adminTab === 'SHIFT_MGMT'
                  ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-obsidian-800'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>Shift Telemetry & Audits</span>
            </button>

            <button
              onClick={() => setAdminTab('CASHIER_PERF')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                adminTab === 'CASHIER_PERF'
                  ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-obsidian-800'
              }`}
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>Cashier Performance</span>
            </button>

            <button
              onClick={() => setAdminTab('SAVED_ORDERS')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                adminTab === 'SAVED_ORDERS'
                  ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-obsidian-800'
              }`}
            >
              <Bookmark className="w-4 h-4 shrink-0" />
              <span>Saved & Held Orders</span>
            </button>

            <button
              onClick={() => setAdminTab('HARDWARE')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                adminTab === 'HARDWARE'
                  ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-obsidian-800'
              }`}
            >
              <Cpu className="w-4 h-4 shrink-0" />
              <span>Hardware & Peripherals</span>
            </button>

            <button
              onClick={() => setAdminTab('CURRENCY')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                adminTab === 'CURRENCY'
                  ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-obsidian-800'
              }`}
            >
              <Coins className="w-4 h-4 shrink-0" />
              <span>Dual-Currency Engine</span>
            </button>

            <button
              onClick={() => setAdminTab('ECOSYSTEM')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                adminTab === 'ECOSYSTEM'
                  ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-obsidian-800'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span>Ecosystem Portals</span>
            </button>

            <button
              onClick={() => setAdminTab('AUDIT')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                adminTab === 'AUDIT'
                  ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-obsidian-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Security Audit Trail</span>
            </button>

            {canAccessStock && (
              <div className="pt-2 border-t border-obsidian-800/60 mt-2 space-y-1">
                <div className="px-3 py-1 text-[10px] font-mono tracking-widest text-sky-400 uppercase font-semibold flex items-center justify-between">
                  <span>Stock Management</span>
                  <ExternalLink className="w-3 h-3 text-sky-500" />
                </div>

                <button
                  onClick={() => setAppView('STOCK', 'dashboard')}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-sky-300 hover:bg-sky-500/10 transition-all group text-left"
                  title="Open Stock OS → Central Valuation Dashboard"
                >
                  <Building2 className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-sky-400" />
                  <span className="truncate">Stock Dashboard</span>
                </button>

                <button
                  onClick={() => setAppView('STOCK', 'catalog')}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-sky-300 hover:bg-sky-500/10 transition-all group text-left"
                  title="Open Stock OS → Product Master Catalog"
                >
                  <Package className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-sky-400" />
                  <span className="truncate">Product Catalog</span>
                </button>

                <button
                  onClick={() => setAppView('STOCK', 'inventory')}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-sky-300 hover:bg-sky-500/10 transition-all group text-left"
                  title="Open Stock OS → Warehouse Balances & Ledger"
                >
                  <Boxes className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-sky-400" />
                  <span className="truncate">Inventory Balances</span>
                </button>
              </div>
            )}

            {canAccessFinance && (
              <div className="pt-2 border-t border-obsidian-800/60 mt-2 space-y-1">
                <div className="px-3 py-1 text-[10px] font-mono tracking-widest text-amber-400 uppercase font-semibold flex items-center justify-between">
                  <span>Account Shortcuts</span>
                  <ExternalLink className="w-3 h-3 text-amber-500" />
                </div>

                <button
                  onClick={() => setAppView('FINANCE', 'allocation')}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-brass-300 hover:bg-brass-500/10 transition-all group text-left"
                  title="Open Account System → Revenue Allocation & Loop Share"
                >
                  <PieChart className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-brass-400" />
                  <span className="truncate">Revenue Allocation</span>
                </button>

                <button
                  onClick={() => setAppView('FINANCE', 'imports')}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-brass-300 hover:bg-brass-500/10 transition-all group text-left"
                  title="Open Account System → Landed Cost & Imports"
                >
                  <Ship className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-brass-400" />
                  <span className="truncate">Landed Cost & Imports</span>
                </button>

                <button
                  onClick={() => setAppView('FINANCE', 'reports')}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-brass-300 hover:bg-brass-500/10 transition-all group text-left"
                  title="Open Account System → Reports & Monthly Financial History"
                >
                  <History className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-brass-400" />
                  <span className="truncate">Financial Reports</span>
                </button>
              </div>
            )}
          </nav>

          {/* Quick Footer Info */}
          <div className="bg-obsidian-950/60 p-3 rounded-xl border border-obsidian-800 space-y-2 mt-3 shrink-0">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Exchange Rate:</span>
              <span className="text-brass-400 font-bold">1$ = {exchangeRate.toLocaleString()}៛</span>
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">
              Enterprise POS & Backoffice v2.0 • Real-time Triad Event Bus Active
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-obsidian-950 overflow-y-auto">
          {/* TAB 1: OPERATIONS OVERVIEW */}
          {adminTab === 'OVERVIEW' && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wide font-display">
                    Operations Dashboard
                  </h2>
                  <p className="text-xs text-slate-400">
                    Live operational telemetry, sales figures, and inventory performance across registers.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-mono text-emerald-400 font-semibold">LIVE REFRESHING</span>
                </div>
              </div>

              {/* Embed PosDashboardView */}
              <PosDashboardView />
            </div>
          )}

          {/* TAB 2: STAFF & ACCESS MATRIX */}
          {adminTab === 'STAFF' && (
            <div className="p-6">
              <UserAndAccessManagementView />
            </div>
          )}

          {/* TAB: MULTI-STORE BRANCHES (SECTION 15) */}
          {adminTab === 'STORES' && (
            <StoreManagementView />
          )}

          {/* TAB 3: SALES & RECEIPTS HISTORY */}
          {adminTab === 'SALES' && (
            <div className="p-6">
              <SalesHistoryView />
            </div>
          )}

          {/* TAB: SHIFT TELEMETRY & AUDITS */}
          {adminTab === 'SHIFT_MGMT' && (
            <div className="p-6">
              <ManagerShiftDashboardView />
            </div>
          )}

          {/* TAB: CASHIER PERFORMANCE */}
          {adminTab === 'CASHIER_PERF' && (
            <div className="p-6">
              <CashierSalesPerformanceView />
            </div>
          )}

          {/* TAB: SAVED ORDERS */}
          {adminTab === 'SAVED_ORDERS' && (
            <div className="p-6">
              <SavedOrdersView />
            </div>
          )}

          {/* TAB 4: HARDWARE & PERIPHERALS */}
          {adminTab === 'HARDWARE' && (
            <div className="p-6">
              <HardwareSettingsView />
            </div>
          )}

          {/* TAB 5: DUAL CURRENCY ENGINE */}
          {adminTab === 'CURRENCY' && (
            <div className="p-6 space-y-6 max-w-4xl mx-auto">
              <div>
                <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wide font-display flex items-center space-x-2">
                  <Coins className="w-5 h-5 text-brass-400" />
                  <span>Dual-Currency Engine (USD & KHR)</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Manage the unified conversion multiplier between United States Dollar (USD) and Khmer Riel (KHR).
                </p>
              </div>

              {rateFeedback && (
                <div className={`p-4 rounded-xl border text-xs flex items-center space-x-3 ${
                  rateFeedback.type === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {rateFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{rateFeedback.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Rate Configuration Card */}
                <div className="bg-obsidian-900 border border-obsidian-800 rounded-2xl p-6 space-y-5">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">
                    Live Exchange Multiplier
                  </h3>
                  
                  <div className="bg-obsidian-950 p-4 rounded-xl border border-obsidian-800 text-center">
                    <div className="text-xs text-slate-400 uppercase font-mono">Current Active Formula</div>
                    <div className="text-2xl font-bold font-mono text-brass-400 mt-1">
                      1 USD = {exchangeRate.toLocaleString()} KHR
                    </div>
                  </div>

                  <form onSubmit={handleUpdateRate} className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1.5">
                        New Multiplier (Khmer Riel per 1 USD)
                      </label>
                      <input
                        type="number"
                        min="3000"
                        max="6000"
                        step="10"
                        value={newRateInput}
                        onChange={(e) => setNewRateInput(Number(e.target.value))}
                        className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-brass-500 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-100 outline-none"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      {[4000, 4050, 4100, 4150].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setNewRateInput(preset)}
                          className="flex-1 py-1.5 rounded-lg bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-xs font-mono text-slate-300"
                        >
                          {preset.toLocaleString()}
                        </button>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={rateSaving}
                      className="w-full py-2.5 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-brass-500/20"
                    >
                      {rateSaving ? 'Updating...' : 'Publish Rate to All Registers'}
                    </button>
                  </form>
                </div>

                {/* Instant Calculator Preview */}
                <div className="bg-obsidian-900 border border-obsidian-800 rounded-2xl p-6 space-y-5">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">
                    Instant Tender Simulation
                  </h3>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                      <span className="text-slate-400">$10.00 USD</span>
                      <span className="font-bold text-slate-100">{(10 * newRateInput).toLocaleString()} ៛</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                      <span className="text-slate-400">$25.00 USD</span>
                      <span className="font-bold text-slate-100">{(25 * newRateInput).toLocaleString()} ៛</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                      <span className="text-slate-400">$50.00 USD</span>
                      <span className="font-bold text-slate-100">{(50 * newRateInput).toLocaleString()} ៛</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                      <span className="text-slate-400">$100.00 USD</span>
                      <span className="font-bold text-slate-100">{(100 * newRateInput).toLocaleString()} ៛</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    * Changes take effect instantly across all registers, receipts, and mixed-tender calculations without requiring application restarts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ECOSYSTEM PORTALS */}
          {adminTab === 'ECOSYSTEM' && (
            <div className="p-6 space-y-6 max-w-4xl mx-auto">
              <div>
                <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wide font-display flex items-center space-x-2">
                  <Globe className="w-5 h-5 text-brass-400" />
                  <span>The Loops Triad Retail Ecosystem</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Seamlessly navigate between connected enterprise platforms. Access is governed by your assigned role permissions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. POS Terminal */}
                <div className="bg-obsidian-900 border border-obsidian-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-brass-500/20 text-brass-400 border border-brass-500/30 flex items-center justify-center font-bold mb-3">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100">The Loops POS</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Cashier checkout register, thermal receipt printing, dual-currency tenders.
                    </p>
                    <div className="mt-3 text-[11px] font-mono text-emerald-400 flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Active Port 5175</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      playBeep(920, 'sine', 0.08);
                      setAppView('POS');
                    }}
                    className="w-full py-2.5 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs uppercase flex items-center justify-center space-x-2"
                  >
                    <span>Open New Sale</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 2. Stock Management */}
                <div className="bg-obsidian-900 border border-obsidian-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold mb-3">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100">Stock Management</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Central inventory, barcode catalog, warehouses, and automated stock deductions.
                    </p>
                    <div className="mt-3 text-[11px] font-mono text-sky-400 flex items-center space-x-1">
                      <span className={`w-2 h-2 rounded-full ${triadStatus?.stock?.online ? 'bg-sky-400' : 'bg-rose-500'}`} />
                      <span>Unified In-App Suite • API 3000</span>
                    </div>
                  </div>

                  {canAccessStock ? (
                    <button
                      onClick={() => setAppView('STOCK')}
                      className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs uppercase flex items-center justify-center space-x-2 transition shadow-lg shadow-sky-600/20 active:scale-98"
                    >
                      <span>Open Stock Management</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="p-2 rounded-xl bg-obsidian-950 border border-obsidian-800 text-[11px] text-slate-500 flex items-center space-x-2">
                      <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span>Access Restricted by Role</span>
                    </div>
                  )}
                </div>

                {/* 3. Loops Finance & Imports */}
                <div className="bg-obsidian-900 border border-obsidian-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold mb-3">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100">Loops Finance & Imports</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Purchase orders, overseas imports, supplier invoices, photo attachments, and ledger.
                    </p>
                    <div className="mt-3 text-[11px] font-mono text-amber-400 flex items-center space-x-1">
                      <span className={`w-2 h-2 rounded-full ${triadStatus?.finance?.online ? 'bg-amber-400' : 'bg-rose-500'}`} />
                      <span>Unified In-App Suite • API 3001</span>
                    </div>
                  </div>

                  {canAccessFinance ? (
                    <button
                      onClick={() => setAppView('FINANCE')}
                      className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase flex items-center justify-center space-x-2 transition shadow-lg shadow-amber-600/20 active:scale-98"
                    >
                      <span>Open Loops Finance</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="p-2 rounded-xl bg-obsidian-950 border border-obsidian-800 text-[11px] text-slate-500 flex items-center space-x-2">
                      <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span>Access Restricted by Role</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Reset Store Data Section (Visible strictly to users with Owner or Reset Data permission) */}
              {canResetStoreData && (
                <div className="bg-obsidian-900 border border-crimson-500/25 rounded-2xl p-5 space-y-3 mt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-crimson-400 px-2 py-0.5 rounded bg-crimson-500/10 border border-crimson-500/20">
                          Operational State Control
                        </span>
                        <span className="text-xs text-slate-500 font-mono">Store Owner Access</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                        <ShieldAlert className="w-4 h-4 text-crimson-400" />
                        <span>Reset Store Data</span>
                      </h3>
                      <p className="text-xs text-slate-400 max-w-xl">
                        Reset the selected store's operational transactions, shifts, stock balances, and expenses to begin fresh as a newly registered store. Your login account, credentials, company registration, and master products remain 100% safe.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        playBeep(440, 'triangle', 0.08);
                        setIsResetStoreModalOpen(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-xs uppercase flex items-center space-x-2 shrink-0 shadow-lg shadow-crimson-600/20 transition-all active:scale-98 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset Store Data</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: SECURITY AUDIT TRAIL */}
          {adminTab === 'AUDIT' && (
            <div className="p-6 space-y-4 max-w-5xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wide font-display flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-brass-400" />
                    <span>Security & Compliance Audit Trail</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Chronological audit log tracking staff registrations, logins, refunds, price changes, and drawer access.
                  </p>
                </div>
                <button
                  onClick={fetchAuditLogs}
                  disabled={loadingAudit}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-xs text-slate-300"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                  <span>Refresh Log</span>
                </button>
              </div>

              <div className="bg-obsidian-900 border border-obsidian-800 rounded-2xl overflow-hidden shadow-xl">
                {auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No security events recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-obsidian-800/80 max-h-[600px] overflow-y-auto">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-obsidian-850/40 transition-colors flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                              log.action.includes('FAILED')
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                : log.action.includes('REGISTER') || log.action.includes('CREATED')
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-brass-500/10 border-brass-500/30 text-brass-400'
                            }`}>
                              {log.action}
                            </span>
                            <span className="text-xs font-semibold text-slate-200">
                              {log.userName || log.performedBy || 'System Event'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">{log.details}</p>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 shrink-0 ml-4">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reset Store Data Modal (Guarded by Authorization) */}
          {canResetStoreData && (
            <ResetStoreDataModal
              isOpen={isResetStoreModalOpen}
              onClose={() => setIsResetStoreModalOpen(false)}
              stores={stores}
              currentStoreId={currentStore?.id}
              currentUser={currentUser || cashierUser}
              authToken={authToken}
              onResetSuccess={() => {
                if (loadStores) loadStores();
                playBeep(1200, 'sine', 0.15);
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
