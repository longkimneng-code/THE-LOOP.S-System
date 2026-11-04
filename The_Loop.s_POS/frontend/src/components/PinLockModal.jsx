import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { X, Lock, Delete, Shield, Check } from 'lucide-react';

export default function PinLockModal() {
  const { isPinLockOpen, setIsPinLockOpen, unlockWithPin, playBeep } = usePos();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isPinLockOpen) return null;

  const handleDigit = (digit) => {
    playBeep(650, 'sine', 0.03);
    if (pin.length < 6) {
      setPin(prev => prev + digit);
      setErrorMsg('');
    }
  };

  const handleClear = () => {
    playBeep(400, 'sine', 0.05);
    setPin('');
    setErrorMsg('');
  };

  const handleSubmit = async (overridePin = null) => {
    const targetPin = overridePin || pin;
    if (!targetPin) return;

    setIsVerifying(true);
    setErrorMsg('');

    const res = await unlockWithPin(targetPin);
    if (!res.ok) {
      playBeep(250, 'sawtooth', 0.2);
      setErrorMsg(res.error || 'Invalid PIN');
      setPin('');
    }
    setIsVerifying(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-3xl w-full max-w-sm shadow-2xl p-6 flex flex-col items-center animate-in fade-in zoom-in-95 select-none">
        {/* Header Icon */}
        <div className="w-12 h-12 rounded-2xl bg-brass-500/10 border border-brass-500/30 text-brass-400 flex items-center justify-center mb-3">
          <Lock className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-slate-100">Switch Cashier</h3>
        <p className="text-xs text-slate-400 mt-0.5">Enter your 4-digit staff PIN</p>

        {/* PIN Dots Display */}
        <div className="flex items-center space-x-3 my-5">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                pin.length > i
                  ? 'bg-brass-400 scale-110 shadow-sm shadow-brass-500/50'
                  : 'bg-obsidian-800 border border-obsidian-700'
              }`}
            />
          ))}
        </div>

        {errorMsg && (
          <div className="text-xs text-rose-400 font-medium mb-3 animate-shake">
            {errorMsg}
          </div>
        )}

        {/* Numeric Touch Keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              onClick={() => handleDigit(num)}
              className="h-14 rounded-2xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 hover:border-obsidian-600 text-slate-100 font-mono text-xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-14 rounded-2xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-slate-400 text-xs font-bold flex items-center justify-center active:scale-95 transition-all"
          >
            CLR
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-slate-100 font-mono text-xl font-bold flex items-center justify-center active:scale-95 transition-all"
          >
            0
          </button>
          <button
            onClick={() => handleSubmit()}
            disabled={pin.length < 4 || isVerifying}
            className="h-14 rounded-2xl bg-brass-500 hover:bg-brass-400 disabled:opacity-30 text-obsidian-950 font-bold flex items-center justify-center active:scale-95 transition-all shadow-md"
          >
            <Check className="w-5 h-5" />
          </button>
        </div>

        {/* Cancel Button */}
        <button
          onClick={() => setIsPinLockOpen(false)}
          className="mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

