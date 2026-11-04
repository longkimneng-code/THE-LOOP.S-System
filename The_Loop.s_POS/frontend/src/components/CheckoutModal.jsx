import React, { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { useSync } from '../context/SyncContext';
import { 
  X, 
  Banknote, 
  CreditCard, 
  QrCode, 
  UserCheck, 
  CheckCircle, 
  Printer, 
  ArrowRight,
  Plus,
  RefreshCw,
  Coins
} from 'lucide-react';

export default function CheckoutModal() {
  const {
    isCheckoutOpen,
    setIsCheckoutOpen,
    cartItems,
    grandTotal,
    orderDiscountPct,
    customer,
    register,
    shiftInfo,
    cashierUser,
    activeSavedOrderId,
    clearCart,
    setActiveReceipt,
    setIsReceiptOpen,
    exchangeRate,
    toKhr,
    toUsd,
    playBeep,
    authToken
  } = usePos();

  const { refreshStatus } = useSync();

  const [activeMethod, setActiveMethod] = useState('CASH'); // CASH, CREDIT_CARD, QR_KHQR, STORE_CREDIT
  const [tenderedUsd, setTenderedUsd] = useState(grandTotal.toFixed(2));
  const [tenderedKhr, setTenderedKhr] = useState('0');
  const [changeCurrency, setChangeCurrency] = useState('USD'); // 'USD' or 'KHR'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isCheckoutOpen) {
      setTenderedUsd(grandTotal.toFixed(2));
      setTenderedKhr('0');
      setErrorMsg('');
    }
  }, [isCheckoutOpen, grandTotal]);

  if (!isCheckoutOpen) return null;

  // Calculate total tendered in USD normalized
  const usdCash = Number(tenderedUsd) || 0;
  const khrCash = Number(tenderedKhr) || 0;
  const totalTenderedUsd = activeMethod === 'CASH'
    ? usdCash + (khrCash / exchangeRate)
    : grandTotal;

  const remainingDueUsd = Math.max(0, grandTotal - totalTenderedUsd);
  const changeDueUsd = Math.max(0, totalTenderedUsd - grandTotal);
  const changeDueKhr = Math.round(changeDueUsd * exchangeRate);

  const grandTotalKhr = toKhr(grandTotal);
  const remainingDueKhr = toKhr(remainingDueUsd);

  const handleQuickCashUsd = (amt) => {
    playBeep(800, 'sine', 0.04);
    setTenderedUsd(amt.toFixed(2));
  };

  const handleQuickCashKhr = (amt) => {
    playBeep(800, 'sine', 0.04);
    setTenderedKhr(String(amt));
  };

  const handleCompleteSale = async () => {
    if (activeMethod === 'CASH' && totalTenderedUsd < grandTotal - 0.01) {
      setErrorMsg(`Payment incomplete. Remaining: $${remainingDueUsd.toFixed(2)} (${remainingDueKhr.toLocaleString()} ៛)`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const finalPayments = [];

      if (activeMethod === 'CASH') {
        if (usdCash > 0) {
          finalPayments.push({
            method: 'CASH',
            currencyCode: 'USD',
            amount: Math.min(usdCash, grandTotal),
            tenderedAmount: usdCash,
            changeGiven: changeCurrency === 'USD' ? changeDueUsd : 0
          });
        }
        if (khrCash > 0) {
          finalPayments.push({
            method: 'CASH',
            currencyCode: 'KHR',
            exchangeRate,
            amountKhr: khrCash,
            amount: Number((khrCash / exchangeRate).toFixed(2)),
            tenderedKhr: khrCash,
            changeGivenKhr: changeCurrency === 'KHR' ? changeDueKhr : 0
          });
        }
        if (finalPayments.length === 0) {
          finalPayments.push({
            method: 'CASH',
            currencyCode: 'USD',
            amount: grandTotal,
            tenderedAmount: grandTotal,
            changeGiven: 0
          });
        }
      } else {
        finalPayments.push({
          method: activeMethod,
          currencyCode: 'USD',
          amount: grandTotal,
          tenderedAmount: grandTotal,
          changeGiven: 0,
          referenceCode: activeMethod === 'QR_KHQR' ? `KHQR-${Date.now().toString().slice(-6)}` : null
        });
      }

      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          registerId: register.id,
          shiftId: shiftInfo?.shift?.id || 'shift-101',
          cashierUserId: cashierUser.id,
          customer,
          items: cartItems,
          payments: finalPayments,
          orderDiscountPct,
          savedOrderId: activeSavedOrderId
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      playBeep(1200, 'sine', 0.12);
      clearCart();
      setIsCheckoutOpen(false);
      setActiveReceipt(data.receipt);
      setIsReceiptOpen(true);
      refreshStatus();
    } catch (err) {
      playBeep(320, 'sawtooth', 0.2);
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-obsidian-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-brass-400 uppercase tracking-wider">Multi-Currency Checkout</div>
            <h2 className="text-lg font-semibold text-slate-100">Payment Terminal</h2>
          </div>
          <button
            onClick={() => setIsCheckoutOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Amount Due Card with Dual Currency */}
          <div className="p-4 rounded-xl bg-obsidian-950 border border-obsidian-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium">Total Amount Due</span>
              <div className="flex items-baseline space-x-2 mt-0.5">
                <span className="text-2xl font-bold font-mono text-brass-400">
                  ${grandTotal.toFixed(2)}
                </span>
                <span className="text-sm font-semibold font-mono text-slate-400">
                  / {grandTotalKhr.toLocaleString()} ៛
                </span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Rate Multiplier: 1 USD = {exchangeRate.toLocaleString()} KHR
              </div>
            </div>

            {remainingDueUsd > 0.01 && (
              <div className="text-right">
                <span className="text-xs text-amber-400">Balance Due</span>
                <div className="text-lg font-bold font-mono text-amber-400">
                  ${remainingDueUsd.toFixed(2)}
                </div>
                <div className="text-xs font-mono text-slate-400">
                  {remainingDueKhr.toLocaleString()} ៛
                </div>
              </div>
            )}
          </div>

          {/* Tender Selector Pills */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-2">Select Tender</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'CASH', label: 'Cash (USD/KHR)', icon: Banknote },
                { id: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
                { id: 'QR_KHQR', label: 'KHQR Pay', icon: QrCode },
                { id: 'STORE_CREDIT', label: 'Store Credit', icon: UserCheck }
              ].map(m => {
                const Icon = m.icon;
                const isSelected = activeMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setActiveMethod(m.id)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition-all ${
                      isSelected
                        ? 'bg-brass-500/10 border-brass-500 text-brass-400 shadow-sm'
                        : 'bg-obsidian-850 border-obsidian-750 text-slate-400 hover:text-slate-200 hover:bg-obsidian-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mixed Cash Tender (USD & KHR) */}
          {activeMethod === 'CASH' && (
            <div className="space-y-3 bg-obsidian-850/60 p-4 rounded-xl border border-obsidian-800">
              <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>Mixed Currency Cash Tender</span>
                <span className="text-[11px] text-slate-400 font-mono">Accept both USD & KHR</span>
              </div>

              {/* Dual Cash Inputs */}
              <div className="grid grid-cols-2 gap-3">
                {/* USD Input */}
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    USD Cash ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tenderedUsd}
                    onChange={(e) => setTenderedUsd(e.target.value)}
                    className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-base font-mono text-slate-100 font-semibold focus:outline-none focus:border-brass-500"
                    placeholder="0.00"
                  />
                  {/* Quick USD buttons */}
                  <div className="flex items-center space-x-1 mt-1.5">
                    {[5, 10, 20, 50, 100].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickCashUsd(amt)}
                        className="flex-1 py-1 rounded bg-obsidian-800 hover:bg-obsidian-750 text-[10px] font-mono text-slate-300 border border-obsidian-700"
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* KHR Input */}
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    KHR Cash (៛)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={tenderedKhr}
                    onChange={(e) => setTenderedKhr(e.target.value)}
                    className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-base font-mono text-slate-100 font-semibold focus:outline-none focus:border-brass-500"
                    placeholder="0"
                  />
                  {/* Quick KHR buttons */}
                  <div className="flex items-center space-x-1 mt-1.5">
                    {[10000, 20000, 50000, 100000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickCashKhr(amt)}
                        className="flex-1 py-1 rounded bg-obsidian-800 hover:bg-obsidian-750 text-[9px] font-mono text-slate-300 border border-obsidian-700"
                      >
                        {(amt / 1000)}k៛
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Change Calculation Box */}
              {changeDueUsd > 0.01 && (
                <div className="pt-2 border-t border-obsidian-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-emerald-400 font-medium block">Change Due</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setChangeCurrency('USD')}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          changeCurrency === 'USD'
                            ? 'bg-emerald-500 text-obsidian-950'
                            : 'bg-obsidian-800 text-slate-400 border border-obsidian-700'
                        }`}
                      >
                        Change in USD
                      </button>
                      <button
                        type="button"
                        onClick={() => setChangeCurrency('KHR')}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          changeCurrency === 'KHR'
                            ? 'bg-emerald-500 text-obsidian-950'
                            : 'bg-obsidian-800 text-slate-400 border border-obsidian-700'
                        }`}
                      >
                        Change in KHR
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    {changeCurrency === 'USD' ? (
                      <div>
                        <div className="text-xl font-bold font-mono text-emerald-400">
                          ${changeDueUsd.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          (or {changeDueKhr.toLocaleString()} ៛)
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xl font-bold font-mono text-emerald-400">
                          {changeDueKhr.toLocaleString()} ៛
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          (or ${changeDueUsd.toFixed(2)})
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QR KHQR Simulator */}
          {activeMethod === 'QR_KHQR' && (
            <div className="p-4 rounded-xl bg-obsidian-850/60 border border-obsidian-800 flex items-center space-x-4">
              <div className="p-2 bg-white rounded-lg">
                <QrCode className="w-14 h-14 text-obsidian-950" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-200">Bakong / KHQR Dual-Currency</div>
                <div className="text-xs text-slate-400 mt-0.5">Pay in USD (${grandTotal.toFixed(2)}) or KHR ({grandTotalKhr.toLocaleString()} ៛)</div>
                <div className="text-xs font-mono text-emerald-400 mt-1">Status: QR Generated & Active</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-obsidian-800 bg-obsidian-950 flex items-center justify-between">
          <button
            onClick={() => setIsCheckoutOpen(false)}
            className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-obsidian-850 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleCompleteSale}
            disabled={isSubmitting || (activeMethod === 'CASH' && totalTenderedUsd < grandTotal - 0.01)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-brass-500 to-brass-400 hover:from-brass-400 text-obsidian-950 font-bold text-sm tracking-wide shadow-lg shadow-brass-500/20 disabled:opacity-40 transition-all flex items-center space-x-2"
          >
            <Printer className="w-4 h-4" />
            <span>{isSubmitting ? 'Finalizing...' : 'Complete & Print Receipt'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
