import React from 'react';
import { usePos } from '../context/PosContext';
import { 
  Globe, 
  Store, 
  Package, 
  TrendingUp, 
  ExternalLink, 
  Lock, 
  CheckCircle,
  X
} from 'lucide-react';

export default function AppSwitcherMenu({ isOpen, onClose }) {
  const { currentUser, cashierUser, hasPermission, authToken, setAppView, appView } = usePos();

  if (!isOpen) return null;

  const activeUser = cashierUser || currentUser;

  const appAccess = activeUser?.appAccess || {
    pos: true,
    stock: hasPermission('accessStockApp'),
    finance: hasPermission('accessFinanceApp')
  };

  const applications = [
    {
      id: 'pos',
      name: 'The Loop.s POS Terminal',
      description: 'Point of sale, fast checkout, dual-currency tenders & cashier shifts',
      url: 'http://localhost:5175',
      port: 'POS Register',
      icon: Store,
      color: 'from-amber-500 to-amber-700',
      allowed: true,
      current: appView === 'POS'
    },
    {
      id: 'stock',
      name: 'Stock Management Loops',
      description: 'Authoritative product catalog, warehouse transfers & Goods Received Notes',
      url: 'http://localhost:5173',
      port: 'Inventory Module',
      icon: Package,
      color: 'from-sky-500 to-sky-700',
      allowed: appAccess.stock !== false || activeUser?.role === 'SUPER_ADMIN' || activeUser?.role === 'STOCK_ADMIN' || activeUser?.role === 'OWNER',
      current: appView === 'STOCK'
    },
    {
      id: 'finance',
      name: 'Loops Finance V3 (Account System)',
      description: 'Overseas imports, landed cost calculations, balanced GL & supplier bills',
      url: 'http://localhost:5174',
      port: 'Finance Module',
      icon: TrendingUp,
      color: 'from-emerald-500 to-emerald-700',
      allowed: appAccess.finance !== false || activeUser?.role === 'SUPER_ADMIN' || activeUser?.role === 'FINANCE_ADMIN' || activeUser?.role === 'OWNER',
      current: appView === 'FINANCE'
    }
  ];

  const handleLaunch = (app) => {
    if (!app.allowed) return;
    if (app.id === 'pos') {
      setAppView('POS');
      onClose();
      return;
    }
    if (app.id === 'stock') {
      setAppView('STOCK');
      onClose();
      return;
    }
    if (app.id === 'finance') {
      setAppView('FINANCE');
      onClose();
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-obsidian-800 flex items-center justify-between bg-obsidian-850">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-brass-500/10 text-brass-400 border border-brass-500/20 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-sans">
                The Loops Universal Retail Suite
              </h3>
              <div className="text-[11px] text-slate-400 font-mono">
                Cross-Platform Unified Application Switcher
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Apps List */}
        <div className="p-5 space-y-3">
          {applications.map((app) => {
            const IconComp = app.icon;
            return (
              <div
                key={app.id}
                onClick={() => handleLaunch(app)}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all select-none ${
                  app.allowed
                    ? 'bg-obsidian-950 border-obsidian-800 hover:border-brass-500/40 hover:bg-obsidian-850/80 cursor-pointer group'
                    : 'bg-obsidian-950/50 border-obsidian-850 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center text-white shrink-0 shadow-md`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-200 text-xs truncate font-sans">
                        {app.name}
                      </span>
                      {app.current && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-brass-500/20 text-brass-400 border border-brass-500/30">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {app.description}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      Port {app.port}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 pl-2">
                  {app.allowed ? (
                    <div className="p-2 rounded-lg bg-obsidian-800 text-slate-400 group-hover:text-brass-400 group-hover:bg-brass-500/10 transition">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-slate-500 text-[10px] font-mono">
                      <Lock className="w-3.5 h-3.5" />
                      <span>NO ACCESS</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-obsidian-800 bg-obsidian-850/60 text-[11px] text-slate-500 flex items-center justify-between font-mono">
          <span>Logged in as: <strong className="text-slate-300 font-sans">{activeUser?.fullName}</strong> ({activeUser?.role})</span>
          <span className="text-emerald-400 font-bold">Single Sign-On Active</span>
        </div>

      </div>
    </div>
  );
}

