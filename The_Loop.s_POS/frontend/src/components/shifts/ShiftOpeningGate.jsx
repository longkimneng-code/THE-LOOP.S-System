import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import {
  Lock,
  Clock,
  Store,
  DollarSign,
  Coins,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Layers
} from 'lucide-react';

export default function ShiftOpeningGate() {
  const {
    cashierUser,
    register,
    currentStore,
    exchangeRate,
    toKhr,
    toUsd,
    refreshShift,
    setIsShiftModalOpen,
    playBeep
  } = usePos();

  const [openingFloatUsd, setOpeningFloatUsd] = useState('100.00');
  const [openingFloatKhr, setOpeningFloatKhr] = useState('200000');
  const [openingNotes, setOpeningNotes] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate total combined float in USD
  const floatUsd = Number(openingFloatUsd) || 0;
  const floatKhr = Number(openingFloatKhr) || 0;
  const totalFloatUsd = floatUsd + (floatKhr / (exchangeRate || 4000));
  const totalFloatKhr = Math.round(totalFloatUsd * (exchangeRate || 4000));

  const handleOpenShiftSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null;
      const res = await fetch('/api/shifts/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          registerId: register?.id,
          storeId: currentStore?.id,
          cashierUserId: cashierUser?.id,
          openingFloatUsd: floatUsd,
          openingFloatKhr: floatKhr,
          openingNotes: openingNotes.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to open register shift');
      }

      playBeep(1200, 'sine', 0.15);
      await refreshShift();
    } catch (err) {
      setErrorMessage(err.message);
      playBeep(400, 'sawtooth', 0.15);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-obsidian-950 overflow-y-auto select-none">
      <div className="w-full max-w-xl bg-obsidian-900 border border-obsidian-750 rounded-3xl p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 relative overflow-hidden">
        
        {/* Ambient Glow */}
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-brass-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header Badge */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brass-600 via-brass-500 to-amber-400 text-obsidian-950 font-black flex items-center justify-center text-2xl shadow-xl shadow-brass-500/20 mx-auto">
            <Lock className="w-7 h-7 text-obsidian-950" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brass-400 px-2.5 py-0.5 rounded-full bg-brass-500/10 border border-brass-500/20">
              POS Rule 13.1 Enforced
            </span>
            <h1 className="text-xl font-bold text-slate-100 uppercase tracking-wide font-display mt-2">
              Shift Required Before Selling
            </h1>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Cashiers must open an active shift and record opening drawer cash before accessing product catalogs, carts, or checkout transactions.
            </p>
          </div>
        </div>

        {/* Live Station Telemetry Grid */}
        <div className="grid grid-cols-2 gap-3 bg-obsidian-950/80 p-4 rounded-2xl border border-obsidian-800 text-xs font-mono">
          <div className="space-y-1 min-w-0">
            <div className="text-[10px] text-slate-500 uppercase">Logged-In Cashier</div>
            <div className="font-semibold text-slate-200 flex items-center space-x-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">{cashierUser?.fullName || 'Cashier'}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">ID: {cashierUser?.id || 'usr-01'}</div>
          </div>

          <div className="space-y-1 min-w-0">
            <div className="text-[10px] text-slate-500 uppercase">Store & Register</div>
            <div className="font-semibold text-slate-200 flex items-center space-x-1.5 truncate">
              <Store className="w-3.5 h-3.5 text-brass-400 shrink-0" />
              <span className="truncate">{currentStore?.name || 'Main Branch'}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Terminal: <span className="text-slate-300 font-semibold">{register?.registerCode || register?.code || 'REG-01'}</span>
            </div>
          </div>

          <div className="space-y-1 col-span-2 pt-2 border-t border-obsidian-850 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-brass-400" />
              <span>Current Time:</span>
              <span className="text-slate-200 font-bold">
                {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString()}
              </span>
            </div>
            <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-bold">
              NO ACTIVE SHIFT
            </span>
          </div>
        </div>

        {/* Error Alert with Quick Resolution Actions */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2.5">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
            {errorMessage.toLowerCase().includes('already has an active shift') && (
              <div className="flex items-center gap-2 pt-1 border-t border-rose-500/20">
                <button
                  type="button"
                  onClick={async () => {
                    await refreshShift();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-black font-bold text-xs transition"
                >
                  Resume Active Shift
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await refreshShift();
                    setIsShiftModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs transition"
                >
                  Close Active Shift
                </button>
              </div>
            )}
          </div>
        )}

        {/* Opening Cash Float Form */}
        <form onSubmit={handleOpenShiftSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Opening Cash USD */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Opening Cash (USD $)</span>
                <span className="text-[10px] text-brass-400">Starting Float</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={openingFloatUsd}
                  onChange={(e) => setOpeningFloatUsd(e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-brass-500 rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono text-slate-100 outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Opening Cash KHR */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Opening Cash (KHR ៛)</span>
                <span className="text-[10px] text-brass-400">Khmer Riel</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">៛</span>
                <input
                  type="number"
                  step="100"
                  min="0"
                  required
                  value={openingFloatKhr}
                  onChange={(e) => setOpeningFloatKhr(e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-brass-500 rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono text-slate-100 outline-none"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Live Float Conversion Snapshot */}
          <div className="bg-obsidian-950 p-3.5 rounded-xl border border-obsidian-800 text-xs font-mono flex items-center justify-between">
            <div className="text-slate-400">
              Combined Float Value:
            </div>
            <div className="text-right">
              <span className="text-brass-400 font-bold text-sm">${totalFloatUsd.toFixed(2)} USD</span>
              <span className="text-slate-500 mx-1.5">•</span>
              <span className="text-slate-300 font-semibold">{totalFloatKhr.toLocaleString()} ៛</span>
            </div>
          </div>

          {/* Opening Notes */}
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Opening Notes (Optional)
            </label>
            <input
              type="text"
              value={openingNotes}
              onChange={(e) => setOpeningNotes(e.target.value)}
              placeholder="e.g. Standard morning shift float verified with supervisor"
              className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-brass-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none"
            />
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brass-500 to-amber-500 hover:from-brass-400 hover:to-amber-400 text-obsidian-950 font-bold text-xs uppercase tracking-wider transition-all shadow-xl shadow-brass-500/20 active:scale-98 flex items-center justify-center space-x-2"
          >
            <span>{loading ? 'Initializing Shift...' : 'Open Shift & Begin Selling'}</span>
            <ArrowRight className="w-4 h-4 text-obsidian-950" />
          </button>
        </form>
      </div>
    </div>
  );
}

