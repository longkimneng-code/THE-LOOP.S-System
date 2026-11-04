import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { X, DollarSign, RefreshCw, CheckCircle, TrendingUp, History } from 'lucide-react';

export default function CurrencyModal() {
  const {
    isCurrencyModalOpen,
    setIsCurrencyModalOpen,
    exchangeRate,
    updateExchangeRate,
    displayCurrency,
    setDisplayCurrency,
    rateHistory,
    playBeep
  } = usePos();

  const [inputRate, setInputRate] = useState(String(exchangeRate));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  if (!isCurrencyModalOpen) return null;

  const handleSaveRate = async (rateToSave) => {
    const val = Number(rateToSave || inputRate);
    if (!val || val <= 0) return;

    setIsSubmitting(true);
    setToastMsg('');

    const res = await updateExchangeRate(val);
    if (res.ok) {
      setToastMsg(`Exchange rate successfully updated to 1 USD = ${val.toLocaleString()} KHR!`);
      playBeep(1000, 'sine', 0.1);
      setTimeout(() => {
        setToastMsg('');
        setIsCurrencyModalOpen(false);
      }, 1500);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-obsidian-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-brass-400" />
            <div>
              <div className="text-xs font-mono text-brass-400 uppercase tracking-wider">Multi-Currency Engine</div>
              <h3 className="text-base font-semibold text-slate-100">USD & KHR Currency Control</h3>
            </div>
          </div>
          <button
            onClick={() => setIsCurrencyModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {toastMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{toastMsg}</span>
            </div>
          )}

          {/* Formula Card */}
          <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-1">
            <div className="text-[11px] font-mono text-brass-400 uppercase tracking-wider">Conversion Formula</div>
            <div className="text-xs font-mono text-slate-200">
              KHR Amount = USD Amount × Exchange Rate
            </div>
            <div className="text-[11px] text-slate-500">
              Example: $10.00 × {Number(inputRate || exchangeRate).toLocaleString()} = {(10 * Number(inputRate || exchangeRate)).toLocaleString()} ៛
            </div>
          </div>

          {/* Rate Input */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Exchange Rate (KHR per 1 USD)
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                value={inputRate}
                onChange={(e) => setInputRate(e.target.value)}
                className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-4 py-2.5 text-lg font-mono text-slate-100 font-bold focus:outline-none focus:border-brass-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                KHR / $
              </span>
            </div>
          </div>

          {/* Fast Preset Multipliers */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 block">Quick Preset Multipliers:</label>
            <div className="grid grid-cols-5 gap-1.5">
              {[4000, 4050, 4100, 4150, 4200].map(r => (
                <button
                  key={r}
                  onClick={() => {
                    setInputRate(String(r));
                    handleSaveRate(r);
                  }}
                  className={`py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors ${
                    Number(inputRate) === r
                      ? 'bg-brass-500 text-obsidian-950 font-bold border-brass-400'
                      : 'bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 border-obsidian-750'
                  }`}
                >
                  {r.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Display Mode Preference */}
          <div className="pt-2 border-t border-obsidian-800 space-y-1.5">
            <label className="text-xs text-slate-400 block">POS Screen Price Display:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'USD', label: 'USD Only ($)' },
                { id: 'KHR', label: 'KHR Only (៛)' },
                { id: 'BOTH', label: 'Dual ($ & ៛)' }
              ].map(d => (
                <button
                  key={d.id}
                  onClick={() => setDisplayCurrency(d.id)}
                  className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                    displayCurrency === d.id
                      ? 'bg-obsidian-800 border-brass-500 text-brass-400 font-semibold'
                      : 'bg-obsidian-850 border-obsidian-750 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => handleSaveRate(inputRate)}
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-brass-500 to-brass-400 hover:from-brass-400 text-obsidian-950 font-bold text-xs tracking-wider shadow-md transition-all mt-2"
          >
            {isSubmitting ? 'Updating Rate...' : 'Save & Apply New Multiplier'}
          </button>
        </div>
      </div>
    </div>
  );
}

