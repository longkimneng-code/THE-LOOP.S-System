import React, { useState, useEffect } from 'react';
import Icon from './Icon';

const NAV_TABS = [
  { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard', desc: 'Valuation & telemetry' },
  { id: 'catalog', label: 'Product Catalog', iconName: 'catalog', desc: 'Single & multi-variant' },
  { id: 'inventory', label: 'Inventory Management', iconName: 'inventory', desc: 'Balances & audit ledger' },
  { id: 'sales', label: 'Sales & Orders', iconName: 'sales', desc: 'POS checkout & returns' },
  { id: 'purchasing', label: 'Purchasing & Suppliers', iconName: 'purchasing', desc: 'PO & goods receipt' },
  { id: 'customers', label: 'Customers', iconName: 'customers', desc: 'Profiles & lifetime value' },
  { id: 'reports', label: 'Reports & Analytics', iconName: 'reports', desc: 'Gross margin & shrinkage' },
  { id: 'locations', label: 'Stores & Locations', iconName: 'locations', desc: 'Warehouses & transfers' },
  { id: 'settings', label: 'Settings & Attributes', iconName: 'settings', desc: 'Attributes & business identity' }
];

export default function Navbar({
  locations = [],
  activeLocationId,
  activeTab = 'dashboard',
  theme = 'dark',
  onToggleTheme,
  onLocationChange,
  onOpenSaleModal,
  onOpenReceiveModal,
  onOpenExportModal,
  onScanQuery,
  onNavigate
}) {
  const [scanInput, setScanInput] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Close menu on ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  const handleScanSubmit = (e) => {
    e?.preventDefault();
    const q = scanInput.trim().toUpperCase();
    if (q) {
      onScanQuery(q);
      setScanInput('');
      setIsMenuOpen(false);
    }
  };

  const handleSelectNav = (tabId) => {
    onNavigate(tabId);
    setIsMenuOpen(false);
  };

  return (
    <>
      <div className="w-full min-h-[64px] bg-obsidian-900/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between transition-all select-none">
        {/* Left Side: Brand Logo & Refined Node Selectors */}
        <div className="flex items-center space-x-2.5 sm:space-x-3.5">
          {/* Brand Logo */}
          <div
            className="flex items-center space-x-2.5 cursor-pointer group select-none"
            onClick={() => handleSelectNav('dashboard')}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brass-500 via-brass-400 to-brass-600 flex items-center justify-center font-display font-black text-obsidian-950 text-xs shadow-xs group-hover:scale-105 transition-transform flex-shrink-0">
              ∞
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-display font-extrabold text-xs sm:text-sm tracking-wider text-slate-100 uppercase block leading-none">
                  The Loops
                </span>
                <span className="text-[10px] bg-brass-500/20 text-brass-400 font-mono px-1.5 py-0.5 rounded border border-brass-500/30 uppercase tracking-widest font-bold leading-none">
                  Stock OS
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1.5 mt-0.5 leading-none">
                <span>Central Inventory</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 font-bold">Live Hub</span>
              </div>
            </div>
          </div>

          {/* Store Selector Pill */}
          <div className="flex items-center space-x-1 pl-2.5 sm:pl-3.5 border-l border-obsidian-800">
            <div className="flex items-center space-x-2 bg-[#111522] hover:bg-[#171D2D] border border-[#232838] hover:border-brass-500/40 rounded-xl px-3 py-2 transition-colors shadow-xs">
              <Icon name="locations" size={14} className="text-brass-400 flex-shrink-0" />
              <span className="text-[10px] font-mono text-brass-400 uppercase font-bold">Store:</span>
              <select
                value={activeLocationId}
                onChange={(e) => onLocationChange(e.target.value)}
                style={{ backgroundColor: '#111522', color: '#F1F5F9' }}
                className="bg-[#111522] text-slate-200 text-xs font-mono focus:outline-none cursor-pointer max-w-[130px] sm:max-w-none border-none outline-none"
                aria-label="Active Store Location"
              >
                {locations.length === 0 ? (
                  <option value="" style={{ backgroundColor: '#0C0F17', color: '#FFFFFF' }} className="bg-[#0C0F17] text-white">No Store Configured</option>
                ) : (
                  locations.map((loc) => (
                    <option key={loc.id} value={loc.id} style={{ backgroundColor: '#0C0F17', color: '#FFFFFF' }} className="bg-[#0C0F17] text-white">
                      {loc.name} ({loc.code})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>



          {/* Universal Suite Clean Pills Switcher */}
          <div className="hidden sm:flex items-center space-x-2 bg-[#111522] hover:bg-[#171D2D] px-3 py-2 rounded-xl border border-[#232838] text-xs">
            <button
              onClick={() => {
                if (window.__loops_setAppView) window.__loops_setAppView('FINANCE');
                else window.open('http://localhost:5175/finance', '_self');
              }}
              className="flex items-center space-x-1 hover:text-amber-400 transition"
              title="Switch to Loops Finance (Port 3001)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 hover:text-amber-400 font-mono text-xs">Finance (3001)</span>
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => {
                if (window.__loops_setAppView) window.__loops_setAppView('ADMIN');
                else window.open('http://localhost:5175/admin', '_self');
              }}
              className="flex items-center space-x-1 hover:text-brass-400 transition"
              title="Switch to Backoffice Admin"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 hover:text-brass-400 font-mono text-xs">Admin</span>
            </button>
          </div>

          {/* Launch POS Button (Clean Backoffice Style) */}
          <button
            onClick={() => {
              if (window.__loops_setAppView) window.__loops_setAppView('POS');
              else window.open('http://localhost:5175/pos', '_self');
            }}
            className="hidden sm:flex items-center space-x-1.5 bg-gradient-to-r from-brass-500 to-brass-400 hover:from-brass-400 hover:to-brass-300 text-obsidian-950 font-bold px-3.5 py-2 rounded-xl text-xs shadow-xs active:scale-95 transition-all"
            title="Open Cashier Selling Terminal (Launch POS)"
          >
            <Icon name="shoppingBag" size={14} className="text-obsidian-950" />
            <span>Launch POS</span>
          </button>
        </div>

        {/* Right Side: Quick Barcode/SKU, Actions */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* Quick SKU Scanner */}
          <form onSubmit={handleScanSubmit} className="relative flex items-center">
            <input
              type="text"
              placeholder="Scan SKU or Barcode..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              style={{ backgroundColor: '#111522', color: '#FFFFFF' }}
              className="bg-[#111522] border border-[#232838] focus:border-brass-500/60 focus:ring-1 focus:ring-brass-500/30 rounded-xl pl-8 pr-3 py-2 text-xs font-mono text-white placeholder-slate-400 w-36 sm:w-48 lg:w-56 transition-all shadow-xs"
              aria-label="Quick Barcode or SKU Scanner"
            />
            <span className="absolute left-2.5 pointer-events-none text-brass-400">
              <Icon name="scan" size={14} />
            </span>
          </form>

          {/* New POS Sale Action */}
          <button
            onClick={onOpenSaleModal}
            className="hidden lg:flex bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs items-center space-x-1.5 shadow-sm transition-all active:scale-95"
            title="Create New POS Sale Order"
          >
            <Icon name="shoppingBag" size={14} />
            <span>New Sale</span>
          </button>

          {/* Receive Stock Action */}
          <button
            onClick={onOpenReceiveModal}
            className="hidden lg:flex bg-gradient-to-r from-brass-500 to-brass-400 hover:from-brass-400 hover:to-brass-300 text-obsidian-950 font-bold px-3.5 py-2 rounded-xl text-xs items-center space-x-1.5 shadow-sm transition-all active:scale-95"
            title="Receive Delivery Stock Inflow"
          >
            <Icon name="receive" size={14} />
            <span>Receive Stock</span>
          </button>

          {/* Export Action */}
          <button
            onClick={onOpenExportModal}
            className="hidden lg:flex bg-[#111522] hover:bg-[#171D2D] border border-[#232838] hover:border-brass-500/30 text-slate-200 hover:text-white font-medium px-3.5 py-2 rounded-xl text-xs items-center space-x-1.5 transition-all shadow-xs"
            title="Export Excel, PDF, Word & CSV"
          >
            <Icon name="export" size={13} />
            <span>Export</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'Light Mode' : 'Dark Mode'}`}
            title={`Switch to ${theme === 'dark' ? 'Light Mode' : 'Dark Mode'}`}
            className="hidden lg:flex w-9 h-9 rounded-xl bg-[#111522] border border-[#232838] hover:border-brass-500/40 text-slate-400 hover:text-brass-400 items-center justify-center transition-all active:scale-95 shadow-xs"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
          </button>

          {/* Narrow-Only Animated Toggle Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            className={`lg:hidden relative w-7.5 h-7.5 rounded-md flex flex-col items-center justify-center transition-all border focus:outline-none flex-shrink-0 ${
              isMenuOpen
                ? 'bg-gold-500/15 border-gold-500/50 text-gold-400 rotate-90'
                : 'bg-studio-900/90 border-white/[0.08] text-slate-400 hover:text-white'
            }`}
          >
            <span
              className={`block w-3.5 h-0.5 rounded-full bg-current transition-all duration-300 transform ${
                isMenuOpen ? 'rotate-45 translate-y-[4px] bg-gold-400' : '-translate-y-0.5'
              }`}
            />
            <span
              className={`block w-3.5 h-0.5 rounded-full bg-current transition-all duration-300 ${
                isMenuOpen ? 'opacity-0 scale-x-0' : 'opacity-100'
              }`}
            />
            <span
              className={`block w-3.5 h-0.5 rounded-full bg-current transition-all duration-300 transform ${
                isMenuOpen ? '-rotate-45 -translate-y-[4px] bg-gold-400' : 'translate-y-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Responsive Slide-Down / Slide-In Drawer Navigation Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal="true">
          {/* Backdrop Blur Overlay */}
          <div
            className="fixed inset-0 bg-studio-950/80 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Drawer Menu Container */}
          <div className="relative z-10 w-full max-w-lg mx-auto bg-studio-950/95 border-b md:border-r border-white/15 shadow-2xl backdrop-blur-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-top-4 duration-200">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-studio-900/60">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-gold-600 to-gold-400 flex items-center justify-center font-display font-black text-studio-950 text-sm">
                  ∞
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm sm:text-base text-white tracking-wide">
                    The Loops System
                  </h3>
                  <span className="text-[10px] font-mono text-gold-400">Universal Retail Management Hub</span>
                </div>
              </div>

              {/* Close Button & Theme Switch */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={onToggleTheme}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium border border-white/10 bg-studio-900 text-studio-300 hover:text-white flex items-center space-x-1.5"
                >
                  <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={13} />
                  <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                </button>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-studio-300 hover:text-white flex items-center justify-center border border-white/10"
                  aria-label="Close menu"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            </div>

            {/* Quick Action Buttons on Narrow Screen */}
            <div className="p-3 bg-studio-900/40 border-b border-white/5 grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  onOpenSaleModal();
                  setIsMenuOpen(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-2 rounded-lg text-xs flex flex-col items-center justify-center space-y-1 shadow-sm"
              >
                <Icon name="shoppingBag" size={16} />
                <span>New Sale</span>
              </button>
              <button
                onClick={() => {
                  onOpenReceiveModal();
                  setIsMenuOpen(false);
                }}
                className="bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold py-2 px-2 rounded-lg text-xs flex flex-col items-center justify-center space-y-1 shadow-sm"
              >
                <Icon name="receive" size={16} />
                <span>Receive</span>
              </button>
              <button
                onClick={() => {
                  onOpenExportModal();
                  setIsMenuOpen(false);
                }}
                className="bg-studio-900 hover:bg-studio-800 text-gold-400 border border-gold-500/30 font-semibold py-2 px-2 rounded-lg text-xs flex flex-col items-center justify-center space-y-1"
              >
                <Icon name="export" size={16} />
                <span>Export</span>
              </button>
            </div>

            {/* Navigation Tabs List */}
            <div className="p-3 sm:p-4 overflow-y-auto space-y-1.5 flex-1">
              {NAV_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleSelectNav(tab.id)}
                    className={`w-full text-left p-3 rounded-xl flex items-center space-x-3 transition-all duration-200 border ${
                      isActive
                        ? 'bg-gold-500/15 border-gold-500/40 text-gold-400 shadow-md shadow-gold-500/10'
                        : 'bg-studio-900/50 border-white/5 text-studio-300 hover:text-white hover:bg-studio-900 hover:border-white/10'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isActive
                          ? 'bg-gold-500 text-studio-950 font-bold'
                          : 'bg-white/5 text-studio-400'
                      }`}
                    >
                      <Icon name={tab.iconName} size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-display text-sm tracking-wide block truncate ${
                            isActive ? 'font-bold text-white' : 'font-medium'
                          }`}
                        >
                          {tab.label}
                        </span>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-gold-400 shadow-sm shadow-gold-400" />
                        )}
                      </div>
                      <span className="text-[11px] text-studio-400 font-mono block truncate">
                        {tab.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
