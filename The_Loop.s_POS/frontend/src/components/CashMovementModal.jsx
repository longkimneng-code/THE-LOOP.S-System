import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { X, DollarSign, ArrowDownRight, ArrowUpRight, ShieldCheck } from 'lucide-react';

export default function CashMovementModal() {
  const {
    isCashMovementOpen,
    setIsCashMovementOpen,
    shiftInfo,
    refreshShift,
    cashierUser,
    playBeep
  } = usePos();

  const [type, setType] = useState('PAID_OUT'); // PAID_IN, PAID_OUT, SAFE_DROP
  const [amount, setAmount] = useState('');
  const [reasonCode, setReasonCode] = useState('PETTY_EXPENSE');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isCashMovementOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setErrorMsg('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/shifts/cash-movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: shiftInfo?.shift?.id,
          type,
          amount: Number(amount),
          reasonCode,
          note,
          createdBy: cashierUser.id
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to record cash movement');

      playBeep(900, 'sine', 0.1);
      await refreshShift();
      setIsCashMovementOpen(false);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-5 py-4 border-b border-obsidian-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-brass-400" />
            <div>
              <div className="text-xs font-mono text-brass-400 uppercase tracking-wider">Till Control</div>
              <h3 className="text-base font-semibold text-slate-100">Cash Flow Movement</h3>
            </div>
          </div>
          <button
            onClick={() => setIsCashMovementOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Movement Type Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'PAID_IN', label: 'Paid In', icon: ArrowDownRight, color: 'text-emerald-400' },
              { id: 'PAID_OUT', label: 'Paid Out', icon: ArrowUpRight, color: 'text-amber-400' },
              { id: 'SAFE_DROP', label: 'Safe Drop', icon: ShieldCheck, color: 'text-blue-400' }
            ].map(m => {
              const Icon = m.icon;
              const isSelected = type === m.id;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setType(m.id)}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 transition-all ${
                    isSelected
                      ? 'bg-obsidian-800 border-brass-500 text-slate-100 shadow-sm'
                      : 'bg-obsidian-850 border-obsidian-750 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${m.color}`} />
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-4 py-2.5 text-base font-mono text-slate-100 focus:outline-none focus:border-brass-500 font-semibold"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Reason Code</label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brass-500"
            >
              <option value="PETTY_EXPENSE">Petty Cash / Store Supplies</option>
              <option value="COURIER_FEE">Courier / Delivery Fee</option>
              <option value="FLOAT_TOPUP">Float Top-up</option>
              <option value="SAFE_SKIM">Mid-day Safe Skim</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Note (Optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Receipt #491 for printer receipt rolls"
              className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brass-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs tracking-wide shadow-md transition-all mt-2"
          >
            {isSubmitting ? 'Recording...' : 'Record Cash Movement'}
          </button>
        </form>
      </div>
    </div>
  );
}

