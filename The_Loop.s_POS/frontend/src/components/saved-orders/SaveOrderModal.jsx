import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import {
  X,
  Bookmark,
  User,
  Phone,
  FileText,
  Clock,
  DollarSign,
  Coins,
  AlertCircle,
  ArrowRight
} from 'lucide-react';

export default function SaveOrderModal({ isOpen, onClose }) {
  const {
    isSaveOrderModalOpen,
    setIsSaveOrderModalOpen,
    cartItems,
    subtotal,
    totalDiscount,
    grandTotal,
    khrGrandTotal,
    customer,
    cashierUser,
    shiftInfo,
    register,
    exchangeRate,
    orderDiscountPct,
    clearCart,
    playBeep
  } = usePos();

  const showModal = isOpen !== undefined ? isOpen : isSaveOrderModalOpen;
  const closeModal = onClose || (() => setIsSaveOrderModalOpen(false));

  const [customerName, setCustomerName] = useState(customer?.name || '');
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || '');
  const [orderNote, setOrderNote] = useState('');
  const [expectedPickup, setExpectedPickup] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!showModal) return null;

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMsg('Customer name is required to hold an order.');
      return;
    }

    if (cartItems.length === 0) {
      setErrorMsg('Cannot hold an empty cart.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/orders/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          orderNote: orderNote.trim(),
          expectedPickup: expectedPickup || null,
          cartItems,
          cashierUserId: cashierUser?.id,
          cashierName: cashierUser?.fullName,
          shiftId: shiftInfo?.shift?.id,
          registerId: register?.id || 'reg-01',
          orderDiscountPct
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to save order');

      playBeep(1000, 'sine', 0.12);
      clearCart();
      closeModal();
    } catch (err) {
      setErrorMsg(err.message);
      playBeep(400, 'sawtooth', 0.15);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-obsidian-900 border border-obsidian-750 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-obsidian-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-sans">
                Hold & Save Unpaid Order
              </h3>
              <div className="text-[10px] text-slate-400 font-mono">
                Store current cart on hold to serve next customer
              </div>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Financial Snapshot */}
        <div className="bg-obsidian-950 p-3.5 rounded-2xl border border-obsidian-800 flex justify-between items-center text-xs font-mono">
          <div>
            <span className="text-slate-400">Cart Items:</span>
            <span className="ml-1.5 font-bold text-slate-200">{cartItems.length} line(s)</span>
          </div>
          <div className="text-right">
            <span className="text-brass-400 font-bold text-sm">${grandTotal.toFixed(2)} USD</span>
            <span className="text-slate-500 mx-1.5">•</span>
            <span className="text-slate-300 font-semibold">{khrGrandTotal.toLocaleString()} ៛</span>
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSaveSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1 flex justify-between">
              <span>Customer Name (Required)</span>
              <span className="text-[10px] text-amber-400 font-bold">* Mandatory</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                autoFocus
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Sophea Roth"
                className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-amber-500 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Customer Phone (Optional)
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="012 889 900"
                  className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-amber-500 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Expected Return Time (Optional)
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={expectedPickup}
                  onChange={(e) => setExpectedPickup(e.target.value)}
                  placeholder="e.g. In 20 minutes"
                  className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-amber-500 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Order Note (Optional)
            </label>
            <input
              type="text"
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder="e.g. Customer stepped away to retrieve wallet / companion"
              className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
            />
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
            * Holding an order stores the cart securely under the customer's name without deducting stock or creating a completed financial sale.
          </p>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 py-2.5 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-slate-300 text-xs font-bold uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !customerName.trim()}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-obsidian-950 text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center space-x-1.5"
            >
              <span>{loading ? 'Saving...' : 'Hold Order'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
