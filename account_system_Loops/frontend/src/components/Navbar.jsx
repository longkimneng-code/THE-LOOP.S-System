import React from 'react';
import { 
  Building2, 
  Layers, 
  PlusCircle, 
  Sun, 
  Moon, 
  ShieldCheck, 
  Sparkles,
  ArrowRightLeft
} from 'lucide-react';

export default function Navbar({ 
  mode, 
  setMode, 
  theme, 
  setTheme, 
  business, 
  onOpenNewModal 
}) {
  return (
    <header className="sticky top-0 z-40 h-14 bg-obsidian-900/95 backdrop-blur-md border-b border-obsidian-800 px-4 sm:px-6 flex items-center justify-between transition-colors select-none shadow-xs">
      <div className="w-full flex items-center justify-between gap-3">
        
        {/* Left: Brand Identity with exact unified Infinity logo */}
        <div className="flex items-center space-x-2.5 sm:space-x-3.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brass-500 via-brass-400 to-brass-600 flex items-center justify-center font-display font-black text-obsidian-950 text-xs shadow-xs flex-shrink-0">
            ∞
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-display font-extrabold text-xs sm:text-sm tracking-wider text-slate-100 uppercase block leading-none">
                The Loops
              </span>
              <span className="text-[10px] bg-brass-500/20 text-brass-400 font-mono px-1.5 py-0.5 rounded border border-brass-500/30 uppercase tracking-widest font-bold leading-none">
                Finance
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded leading-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Ledger
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1.5 mt-0.5 leading-none">
              <span>{business?.name || 'Sisowath Flagship'}</span>
              <span className="text-slate-600">•</span>
              <span className="text-brass-400 font-bold">{business?.baseCurrency || 'USD'}</span>
            </div>
          </div>
        </div>

        {/* Center: Mode Switch (Owner View vs Accountant View) */}
        <div className="hidden md:flex items-center bg-obsidian-850 p-1 rounded-lg border border-obsidian-750 shadow-xs">
          <button
            onClick={() => setMode('SIMPLE')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'SIMPLE'
                ? 'bg-brass-500 text-obsidian-950 font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Shop Owner View: Plain words, guided forms"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Owner View</span>
          </button>
          
          <button
            onClick={() => setMode('ACCOUNTANT')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'ACCOUNTANT'
                ? 'bg-obsidian-950 text-sky-400 border border-sky-400/40 font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Accountant View: Full general ledger, Dr/Cr journal lines"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Accountant View</span>
          </button>
        </div>

        {/* Right: Actions & Theme */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* Universal Suite Apps Dropdown */}
          <div className="hidden sm:flex items-center bg-obsidian-850 px-3 py-1.5 rounded-lg border border-obsidian-750 hover:border-brass-500/40 transition-colors shadow-xs">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  window.open(e.target.value, '_blank');
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="bg-transparent text-brass-400 text-xs font-mono focus:outline-none cursor-pointer"
              aria-label="Universal Apps Switcher"
            >
              <option value="" disabled className="bg-obsidian-900 text-slate-400">Apps 🌐</option>
              <option value="http://localhost:5175">🏬 POS Terminal (5175)</option>
              <option value="http://localhost:5173">📦 Stock Management (5173)</option>
              <option value="http://localhost:5174" disabled className="bg-obsidian-900 text-slate-500">📊 Loops Finance (Current)</option>
            </select>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 rounded-lg text-slate-400 hover:text-brass-400 hover:bg-obsidian-800 bg-obsidian-850 border border-obsidian-750 flex items-center justify-center transition-all shadow-xs"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-brass-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Quick "+ New" Action Button */}
          <button
            onClick={onOpenNewModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-brass-500 to-brass-400 hover:from-brass-400 hover:to-brass-300 text-obsidian-950 text-xs font-bold shadow-sm transition transform active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">+ New</span>
          </button>
        </div>

      </div>
    </header>
  );
}

