import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { useSync } from '../context/SyncContext';
import { 
  Lock, 
  RotateCcw, 
  DollarSign, 
  Clock, 
  UserPlus, 
  Activity, 
  ShieldCheck, 
  Sparkles,
  Store,
  Layers,
  Globe,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  Check,
  Key,
  Crown,
  Shield,
  UserCheck
} from 'lucide-react';

export default function TerminalHeader() {
  const { 
    currentUser,
    cashierUser, 
    setIsPinLockOpen,
    unlockWithPin,
    register, 
    shiftInfo, 
    setIsShiftModalOpen,
    setIsCashMovementOpen,
    setIsRefundOpen,
    setIsUserModalOpen,
    setIsSyncModalOpen,
    setIsCurrencyModalOpen,
    exchangeRate,
    displayCurrency,
    setDisplayCurrency,
    isAppSwitcherOpen,
    setIsAppSwitcherOpen,
    setActiveTab,
    setAppView,
    logout,
    hasPermission,
    stores,
    currentStore,
    setIsStoreModalOpen
  } = usePos();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const activeUser = cashierUser || currentUser;
  const canAccessAdmin = activeUser?.role === 'OWNER' || activeUser?.role === 'SUPER_ADMIN' || activeUser?.role === 'POS_ADMIN' || activeUser?.role === 'STORE_MANAGER' || hasPermission('manageEmployees') || hasPermission('viewFinancialReports');

  const { triadStatus, isSyncing } = useSync();

  const isStockOnline = triadStatus?.stock?.online;
  const isFinanceOnline = triadStatus?.finance?.online;
  const pendingOutbox = triadStatus?.syncStatus?.pendingOutboxCount || 0;

  return (
    <header className="h-16 bg-obsidian-900/95 backdrop-blur-md border-b border-obsidian-800 px-4 sm:px-6 flex items-center justify-between select-none shadow-xs">
      {/* Left: Branding & Location */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        <div className="flex items-center space-x-2 bg-obsidian-850 px-2.5 py-1.5 rounded-lg border border-obsidian-700">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brass-400 to-brass-600 flex items-center justify-center shadow-xs">
            <span className="font-extrabold text-obsidian-950 text-xs">∞</span>
          </div>
          <span className="font-bold text-slate-100 tracking-wider text-xs sm:text-sm font-display">THE LOOP.S</span>
          <span className="text-[10px] bg-brass-500/20 text-brass-400 font-mono px-1.5 py-0.5 rounded border border-brass-500/30 font-bold">
            POS
          </span>
        </div>

        {/* Universal Ecosystem Switcher (Clean Backoffice Style) */}
        <div className="flex items-center space-x-2 bg-[#111522] hover:bg-[#171D2D] px-2.5 py-1.5 rounded-xl border border-[#232838] text-xs">
          <button
            onClick={() => setAppView('STOCK')}
            className="flex items-center space-x-1 hover:text-sky-400 transition"
            title="Switch to Stock Management (Port 3000)"
          >
            <span className={`w-2 h-2 rounded-full ${isStockOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-slate-300 hover:text-sky-400 font-mono text-xs">Stock (3000)</span>
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => setAppView('FINANCE')}
            className="flex items-center space-x-1 hover:text-amber-400 transition"
            title="Switch to Loops Finance (Port 3001)"
          >
            <span className={`w-2 h-2 rounded-full ${isFinanceOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-slate-300 hover:text-amber-400 font-mono text-xs">Finance (3001)</span>
          </button>
          {canAccessAdmin && (
            <>
              <span className="text-slate-600">|</span>
              <button
                onClick={() => setAppView('ADMIN')}
                className="flex items-center space-x-1 hover:text-brass-400 transition"
                title="Switch to Admin Backoffice"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300 hover:text-brass-400 font-mono text-xs">Admin</span>
              </button>
            </>
          )}
        </div>

        {/* Section 15.7: Current Store Display & In-App Store Switcher */}
        <button
          onClick={() => setIsStoreModalOpen(true)}
          className="flex items-center space-x-2 text-xs text-slate-300 bg-obsidian-850 hover:bg-obsidian-800 px-3 py-1.5 rounded-lg border border-obsidian-750 hover:border-brass-500/40 transition-all group shadow-xs"
          title="Current Store Location • Click to Switch Branch"
        >
          <Store className="w-3.5 h-3.5 text-brass-400 group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-slate-200">
            {currentStore?.name || (currentStore ? 'Main Branch' : 'Loading Store...')}
          </span>
          <span className="text-slate-600">•</span>
          <span className="font-mono text-brass-400 font-medium">
            {register?.code || 'REG-01'}
          </span>
          {stores && stores.length > 1 && (
            <span className="text-[10px] bg-brass-500/15 text-brass-400 border border-brass-500/30 px-1.5 py-0.5 rounded font-sans uppercase font-bold">
              Switch
            </span>
          )}
        </button>
      </div>

      {/* Middle: Register Controls (Shift, Petty Cash, Returns) */}
      <div className="flex items-center space-x-2">
        {/* Shift Control */}
        <button
          onClick={() => setIsShiftModalOpen(true)}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors shadow-xs ${
            shiftInfo?.hasActiveShift
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/40'
              : 'bg-amber-950/40 text-amber-400 border-amber-800/60 hover:bg-amber-900/40'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{shiftInfo?.hasActiveShift ? 'Shift Active' : 'Open Shift'}</span>
          {shiftInfo?.hasActiveShift && (
            <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono text-[10px]">
              ${shiftInfo?.summary?.expectedCashInDrawer || '0.00'}
            </span>
          )}
        </button>

      </div>

      {/* Right: Cashier Session */}
      <div className="flex items-center space-x-2">

        {/* Cashier Badge & User Session Menu */}
        <div className="relative flex items-center space-x-2 pl-2 border-l border-obsidian-800">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center space-x-2 bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 hover:border-brass-500/50 px-2.5 py-1.5 rounded-lg transition-all group"
            title="Active Staff & Cashier Account Settings (Click to switch or inspect)"
          >
            <div className="w-6 h-6 rounded-full bg-brass-500/20 text-brass-400 border border-brass-500/30 flex items-center justify-center font-bold text-xs">
              {activeUser?.fullName?.charAt(0) || 'C'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-medium text-slate-200 group-hover:text-brass-400 transition-colors leading-tight">
                {activeUser?.fullName || 'Cashier'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono uppercase leading-none">
                {activeUser?.role || 'Staff'}
              </div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 group-hover:text-brass-400 transition-transform ${isUserMenuOpen ? 'rotate-180 text-brass-400' : ''}`} />
          </button>

          {/* Secure Logout Button */}
          <button
            onClick={logout}
            className="p-2 rounded-lg bg-obsidian-850 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 border border-obsidian-700 transition-colors"
            title="Log out of The Loops"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>

          {/* Interactive User & Cashier Dropdown Menu */}
          {isUserMenuOpen && (
            <div className="absolute right-0 top-12 w-80 bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 space-y-3 font-sans">
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

              {/* 2. Shift Info */}
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

              {/* 3. Quick Cashier Switch (Section 13.8) */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-semibold">
                  Quick Switch Staff Account
                </div>
                {/* 3. Switch User via PIN Lock */}
                <div className="space-y-1.5 pt-1">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsPinLockOpen(true);
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-brass-400 hover:text-brass-300 text-xs font-medium transition-colors shadow-xs"
                  >
                    <Key className="w-3.5 h-3.5 text-brass-400" />
                    <span>Switch Staff / Enter PIN</span>
                  </button>
                </div>
              </div>

              {/* 4. Actions: Backoffice & Sign Out */}
              <div className="pt-2 border-t border-obsidian-800 space-y-1.5">
                {canAccessAdmin && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setAppView('ADMIN');
                    }}
                    className="w-full py-2 rounded-xl bg-brass-500/10 hover:bg-brass-500/20 border border-brass-500/30 text-brass-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Launch Admin Backoffice</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
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
  );
}

