import React from 'react';
import { usePos } from '../context/PosContext';
import { 
  ShoppingCart, 
  LayoutDashboard, 
  Receipt, 
  RotateCcw, 
  Cpu, 
  Users, 
  Bookmark,
  Clock
} from 'lucide-react';

export default function PosNavigationTabs() {
  const { 
    activeTab, 
    setActiveTab, 
    hasPermission, 
    cashierUser, 
    setIsRefundOpen
  } = usePos();

  const canManageUsers = hasPermission('manageEmployees') || cashierUser?.role === 'SUPER_ADMIN' || cashierUser?.role === 'POS_ADMIN';
  const canViewReports = hasPermission('viewFinancialReports') || cashierUser?.role === 'SUPER_ADMIN' || cashierUser?.role === 'STORE_MANAGER';
  const canRefund = hasPermission('refundTransactions') || cashierUser?.role === 'SUPER_ADMIN' || cashierUser?.role === 'STORE_MANAGER';

  const navItems = [
    {
      id: 'REGISTER',
      label: 'New Sale',
      icon: ShoppingCart,
      desc: 'Point of sale checkout & new transaction'
    },
    {
      id: 'HOLD',
      label: 'Saved Orders',
      icon: Bookmark,
      desc: 'Unpaid held orders & recall'
    },
    {
      id: 'SHIFTS',
      label: 'Shift History',
      icon: Clock,
      desc: 'Cashier work sessions & reconciliations'
    },
    {
      id: 'DASHBOARD',
      label: 'Dashboard',
      icon: LayoutDashboard,
      desc: 'Sales telemetry & shift stats'
    },
    {
      id: 'HISTORY',
      label: 'Sales History',
      icon: Receipt,
      desc: 'Search, reprint & inspect orders'
    },
    {
      id: 'HARDWARE',
      label: 'Hardware & Devices',
      icon: Cpu,
      desc: 'Printers, scanners & cash drawer'
    },
    ...(canManageUsers ? [{
      id: 'USERS',
      label: 'Users & Permissions',
      icon: Users,
      desc: 'Centralized RBAC dashboard'
    }] : [])
  ];

  return (
    <div className="bg-obsidian-900/95 border-b border-obsidian-800 px-4 sm:px-6 flex items-center justify-between overflow-x-auto scrollbar-none select-none h-13 py-1.5">
      {/* Navigation Buttons */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-max">
        {navItems.map((item) => {
          const IconComp = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-brass-500 text-obsidian-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-850'
              }`}
              title={item.desc}
            >
              <IconComp className={`w-3.5 h-3.5 ${isActive ? 'text-obsidian-950' : 'text-slate-400'}`} />
              <span className="leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Quick Return Pill */}
      <div className="flex items-center space-x-2 pl-3">
        {canRefund && (
          <button
            onClick={() => setIsRefundOpen(true)}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
            title="Process Return or Exchange"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden md:inline">Quick Return</span>
          </button>
        )}
      </div>
    </div>
  );
}

