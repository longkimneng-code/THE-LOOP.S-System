import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { useSync } from '../context/SyncContext';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  ShieldCheck,
  Globe,
  Lock,
  ChevronDown,
  Check,
  Key,
  Crown,
  Shield,
  UserCheck,
  LogOut,
  RefreshCw,
  Coins,
  Store,
  ExternalLink,
  Layers
} from 'lucide-react';

export default function PlatformMasterBar({ currentModule, onSelectModule }) {
  const {
    currentUser,
    cashierUser,
    activeTab,
    setActiveTab,
    setIsPinLockOpen,
    unlockWithPin,
    register,
    shiftInfo,
    setIsCurrencyModalOpen,
    setIsSyncModalOpen,
    exchangeRate,
    logout,
    hasPermission
  } = usePos();

  const { triadStatus } = useSync();

  const [isStaffMenuOpen, setIsStaffMenuOpen] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState(null);

  const activeUser = cashierUser || currentUser;

  // Permission checkers for each business module
  const canAccessPos = true; // All authenticated staff
  const canAccessStock = activeUser?.role === 'OWNER' || activeUser?.role === 'SUPER_ADMIN' || activeUser?.role === 'STOCK_ADMIN' || activeUser?.role === 'STORE_MANAGER' || activeUser?.appAccess?.stock || hasPermission('accessStockApp');
  const canAccessFinance = activeUser?.role === 'OWNER' || activeUser?.role === 'SUPER_ADMIN' || activeUser?.role === 'FINANCE_ADMIN' || activeUser?.role === 'ACCOUNTANT' || activeUser?.role === 'STORE_MANAGER' || activeUser?.appAccess?.finance || hasPermission('accessFinanceApp');
  const canAccessAdmin = activeUser?.role === 'OWNER' || activeUser?.role === 'SUPER_ADMIN' || activeUser?.role === 'POS_ADMIN' || activeUser?.role === 'STORE_MANAGER' || hasPermission('manageEmployees') || hasPermission('viewFinancialReports');

  const modules = [
    {
      id: 'POS',
      label: 'POS Register',
      shortLabel: 'POS',
      icon: ShoppingCart,
      allowed: canAccessPos,
      badge: 'Cashier & Sales',
      desc: 'Point of sale checkout, thermal printing, shifts & held orders'
    },
    {
      id: 'STOCK',
      label: 'Stock Management',
      shortLabel: 'Stock',
      icon: Package,
      allowed: canAccessStock,
      badge: 'Port 3000',
      desc: 'Central inventory, product variants, warehouses & transfers'
    },
    {
      id: 'FINANCE',
      label: 'Loops Finance',
      shortLabel: 'Finance',
      icon: TrendingUp,
      allowed: canAccessFinance,
      badge: 'Port 3001',
      desc: 'Purchasing, overseas imports, landed costs & general ledger'
    },
    ...(canAccessAdmin ? [{
      id: 'ADMIN',
      label: 'Admin Backoffice',
      shortLabel: 'Admin',
      icon: ShieldCheck,
      allowed: true,
      badge: 'RBAC & Config',
      desc: 'Staff management, shift telemetry, currency engine & audit'
    }] : [])
  ];

  const handleModuleClick = (mod) => {
    if (!mod.allowed) {
      setAccessDeniedMessage({
        title: `Access Restricted: ${mod.label}`,
        role: activeUser?.role || 'CASHIER',
        message: mod.id === 'FINANCE'
          ? 'Accounting and overseas import management requires an Accountant, Finance Admin, or Business Owner account.'
          : 'Stock and warehouse management requires a Store Manager, Stock Admin, or Business Owner account.'
      });
      return;
    }
    setAccessDeniedMessage(null);
    onSelectModule(mod.id);
  };

  const isStockOnline = triadStatus?.stock?.online;
  const isFinanceOnline = triadStatus?.finance?.online;
  const pendingOutbox = triadStatus?.syncStatus?.pendingOutboxCount || 0;

  return (
    <>
      <header className="h-13 bg-obsidian-900 border-b border-obsidian-750 px-4 flex items-center justify-between select-none z-40 relative">
        {/* Left: Universal Platform Logo & Brand */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-2 bg-obsidian-950 px-2.5 py-1.5 rounded-xl border border-obsidian-800">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-brass-500 via-brass-400 to-brass-600 flex items-center justify-center font-display font-black text-obsidian-950 text-xs shadow-md shadow-brass-500/20">
              ∞
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs tracking-wider text-slate-100 font-display uppercase leading-tight">
                The Loops
              </span>
              <span className="text-[9px] font-mono text-brass-400 tracking-widest uppercase leading-tight">
                Retail OS
              </span>
            </div>
          </div>

          {/* Module Switcher Pills */}
          <nav className="flex items-center space-x-1 sm:space-x-1.5 ml-2">
            {modules.map((mod) => {
              const IconComp = mod.icon;
              const isActive = currentModule === mod.id;
              const isBlocked = !mod.allowed;

              return (
                <button
                  key={mod.id}
                  onClick={() => handleModuleClick(mod)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20 scale-[1.02]'
                      : isBlocked
                      ? 'text-slate-500 hover:text-slate-400 hover:bg-obsidian-850 opacity-60'
                      : 'text-slate-300 hover:text-white hover:bg-obsidian-850'
                  }`}
                  title={mod.desc}
                >
                  <IconComp className={`w-3.5 h-3.5 ${isActive ? 'text-obsidian-950' : isBlocked ? 'text-slate-600' : 'text-slate-400'}`} />
                  <span className="hidden md:inline">{mod.label}</span>
                  <span className="md:hidden">{mod.shortLabel}</span>
                  {isBlocked && <Lock className="w-2.5 h-2.5 text-slate-500 ml-0.5" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Triad Telemetry, Currency Multiplier & Staff Dropdown */}
        <div className="flex items-center space-x-2.5">
          {/* Currency Multiplier Pill */}
          <button
            onClick={() => setIsCurrencyModalOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium bg-obsidian-850 hover:bg-obsidian-800 text-brass-400 border border-obsidian-750 hover:border-brass-500/40 transition-colors shadow-sm"
            title="Configure USD / KHR Exchange Rate Multiplier"
          >
            <span className="text-[10px] bg-brass-500/20 px-1 py-0.5 rounded font-bold">1$</span>
            <span>=</span>
            <span className="font-bold text-slate-100">{(exchangeRate || 4000).toLocaleString()} ៛</span>
          </button>

          {/* Triad Real-Time Sync Indicator */}
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-xs transition-colors"
            title="Triad Integration Monitor (Stock Port 3000 • Finance Port 3001 • POS Port 3002)"
          >
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="POS Engine Online" />
              <span className={`w-2 h-2 rounded-full ${isStockOnline ? 'bg-sky-400' : 'bg-amber-500'}`} title="Stock Engine Online" />
              <span className={`w-2 h-2 rounded-full ${isFinanceOnline ? 'bg-amber-400' : 'bg-rose-500'}`} title="Finance Engine Online" />
            </div>
            <span className="hidden lg:inline text-slate-300 font-mono text-[11px]">Triad Bus</span>
            {pendingOutbox > 0 && (
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono text-[10px]">
                {pendingOutbox}
              </span>
            )}
          </button>

          {/* Active Staff / Cashier Badge with Menu */}
          <div className="relative pl-2 border-l border-obsidian-800 flex items-center space-x-1.5">
            <button
              onClick={() => setIsStaffMenuOpen(!isStaffMenuOpen)}
              className="flex items-center space-x-2 bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 hover:border-brass-500/50 px-2.5 py-1 rounded-lg transition-all group"
              title="Active User Profile & Quick Switch Staff"
            >
              <div className="w-6 h-6 rounded-full bg-brass-500/20 text-brass-400 border border-brass-500/30 flex items-center justify-center font-bold text-xs">
                {activeUser?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-medium text-slate-200 group-hover:text-brass-400 transition-colors">
                  {activeUser?.fullName || 'Cashier'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono uppercase">
                  {activeUser?.role || 'Staff'}
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 group-hover:text-brass-400 ml-0.5 transition-transform ${isStaffMenuOpen ? 'rotate-180 text-brass-400' : ''}`} />
            </button>

            {/* Quick Logout Button */}
            <button
              onClick={logout}
              className="p-1.5 rounded-lg bg-obsidian-850 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 border border-obsidian-700 transition-colors"
              title="Log out of The Loops"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>

            {/* Interactive Staff Profile & Quick Switch Dropdown */}
            {isStaffMenuOpen && (
              <div className="absolute right-0 top-11 w-80 bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 space-y-3 font-sans">
                {/* 1. Active User Profile Summary */}
                <div className="flex items-start justify-between pb-3 border-b border-obsidian-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brass-500/30 to-brass-400/10 text-brass-400 border border-brass-500/40 flex items-center justify-center font-bold text-base shadow-sm">
                      {activeUser?.fullName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center space-x-1.5">
                        <span>{activeUser?.fullName || 'Active Staff'}</span>
                      </h4>
                      <span className={`inline-block text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase mt-0.5 ${
                        activeUser?.role === 'OWNER' || activeUser?.role === 'SUPER_ADMIN'
                          ? 'bg-brass-500/20 text-brass-400 border-brass-500/30'
                          : activeUser?.role === 'STORE_MANAGER'
                          ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}>
                        {activeUser?.role || 'CASHIER'}
                      </span>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-[180px]">
                        {activeUser?.email || 'cashier@theloops.com'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Quick Shift Telemetry */}
                <div className="p-2.5 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Shift Status:</span>
                    <span className={shiftInfo?.hasActiveShift ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {shiftInfo?.hasActiveShift ? 'ACTIVE SHIFT' : 'NO SHIFT OPEN'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>Register:</span>
                    <span className="text-slate-300 font-semibold">{register?.code || 'REG-01'}</span>
                  </div>
                </div>

                {/* 3. Switch User via PIN Lock */}
                <div className="space-y-1.5 pt-1">
                  <button
                    onClick={() => {
                      setIsStaffMenuOpen(false);
                      setIsPinLockOpen(true);
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-brass-400 hover:text-brass-300 text-xs font-medium transition-colors shadow-xs"
                  >
                    <Key className="w-3.5 h-3.5 text-brass-400" />
                    <span>Switch Staff / Enter PIN</span>
                  </button>
                </div>

                {/* 4. Actions: Sign Out */}
                <div className="pt-2 border-t border-obsidian-800">
                  <button
                    onClick={() => {
                      setIsStaffMenuOpen(false);
                      logout();
                    }}
                    className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center justify-center space-x-2 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out of Terminal</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Permission Denied Modal / Alert */}
      {accessDeniedMessage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-900 border border-obsidian-750 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-100 font-display">
                {accessDeniedMessage.title}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Current Role: <span className="text-amber-400 font-bold uppercase">{accessDeniedMessage.role}</span>
              </p>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed text-center bg-obsidian-950 p-3 rounded-xl border border-obsidian-800">
              {accessDeniedMessage.message}
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setAccessDeniedMessage(null)}
                className="flex-1 py-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 text-slate-300 text-xs font-medium"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setAccessDeniedMessage(null);
                  setIsPinLockOpen(true);
                }}
                className="flex-1 py-2 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 text-xs font-bold"
              >
                Enter Authorized PIN
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

