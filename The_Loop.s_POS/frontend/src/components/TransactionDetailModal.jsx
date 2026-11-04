import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { 
  X, 
  Receipt, 
  Printer, 
  RotateCcw, 
  CheckCircle, 
  Calendar, 
  User, 
  Store, 
  DollarSign, 
  CreditCard,
  QrCode,
  AlertCircle
} from 'lucide-react';

export default function TransactionDetailModal() {
  const { 
    selectedTransaction, 
    setSelectedTransaction, 
    isTransactionDetailOpen, 
    setIsTransactionDetailOpen,
    reprintReceipt,
    setIsRefundOpen,
    hasPermission,
    playBeep
  } = usePos();

  const [isReprinting, setIsReprinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState('');

  if (!isTransactionDetailOpen || !selectedTransaction) return null;

  const order = selectedTransaction;
  const lines = order.lines || [];
  const payments = order.payments || [];
  const refunds = order.refunds || [];
  const canRefund = hasPermission('refundTransactions');

  const handleReprint = async () => {
    setIsReprinting(true);
    setPrintSuccess('');
    const res = await reprintReceipt(order.orderNumber);
    if (res.ok) {
      setPrintSuccess('Receipt sent to thermal printer!');
      setTimeout(() => setPrintSuccess(''), 2500);
    }
    setIsReprinting(false);
  };

  const handleOpenRefund = () => {
    setIsTransactionDetailOpen(false);
    setIsRefundOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-obsidian-800 flex items-center justify-between bg-obsidian-850">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-brass-500/10 text-brass-400 border border-brass-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-slate-100 font-mono">
                  {order.orderNumber}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  order.status === 'COMPLETED'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {order.status}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Transaction ID: {order.id}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              playBeep(700, 'sine', 0.05);
              setIsTransactionDetailOpen(false);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800 font-mono">
            <div>
              <span className="text-slate-500 block text-[10px]">DATE & TIME</span>
              <span className="text-slate-200">
                {new Date(order.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">CASHIER</span>
              <span className="text-slate-200">{order.cashierName || 'Staff Member'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">REGISTER</span>
              <span className="text-slate-200">{order.registerCode || 'REG-01'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">EXCHANGE RATE</span>
              <span className="text-brass-400 font-bold">1$ = {Number(order.exchangeRate || 4000).toLocaleString()} ៛</span>
            </div>
          </div>

          {/* Purchased Line Items */}
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              Purchased Line Items ({lines.length})
            </h4>
            <div className="rounded-xl border border-obsidian-800 overflow-hidden">
              <table className="w-full text-left font-mono">
                <thead className="bg-obsidian-950 border-b border-obsidian-800 text-slate-400 text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Item Description</th>
                    <th className="py-2 px-3">SKU</th>
                    <th className="py-2 px-3 text-right">Price</th>
                    <th className="py-2 px-3 text-center">Qty</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-800/60 bg-obsidian-900/60">
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-obsidian-850/50">
                      <td className="py-2 px-3 font-sans text-slate-200 font-medium">
                        {line.itemTitle}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-[11px]">{line.variantSku}</td>
                      <td className="py-2 px-3 text-right text-slate-300">${Number(line.unitPrice).toFixed(2)}</td>
                      <td className="py-2 px-3 text-center font-bold text-slate-200">{line.quantity}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-100">
                        ${Number(line.lineTotal).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dual-Currency Financial Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payment Tenders Breakdown */}
            <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-2 font-mono">
              <div className="text-[11px] font-semibold text-slate-300 font-sans uppercase">
                Payment Breakdown
              </div>
              {payments.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-obsidian-900 last:border-none">
                  <div className="flex items-center space-x-1.5 text-slate-400">
                    {p.method === 'QR_KHQR' ? <QrCode className="w-3.5 h-3.5 text-rose-400" /> : <DollarSign className="w-3.5 h-3.5 text-brass-400" />}
                    <span>{p.method} ({p.currencyCode})</span>
                  </div>
                  <div className="text-slate-100 font-bold">
                    {p.currencyCode === 'KHR'
                      ? `${Number(p.amountKhr || p.tenderedKhr || 0).toLocaleString()} ៛`
                      : `$${Number(p.amount || p.tenderedAmount || 0).toFixed(2)}`}
                  </div>
                </div>
              ))}
              {payments.some(p => p.changeGiven > 0 || p.changeGivenKhr > 0) && (
                <div className="pt-1.5 flex items-center justify-between text-emerald-400 font-bold border-t border-obsidian-800">
                  <span>Change Returned:</span>
                  <span>
                    ${Number(payments.reduce((s, p) => s + (p.changeGiven || 0), 0)).toFixed(2)}
                    {' '}/ {Number(payments.reduce((s, p) => s + (p.changeGivenKhr || 0), 0)).toLocaleString()} ៛
                  </span>
                </div>
              )}
            </div>

            {/* Financial Totals */}
            <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span>${Number(order.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Discount:</span>
                <span className="text-rose-400">-${Number(order.discountTotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tax (10% VAT):</span>
                <span>${Number(order.taxTotal || 0).toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-obsidian-800 flex justify-between items-baseline font-bold">
                <span className="text-slate-200">Total Due (USD):</span>
                <span className="text-base text-brass-400">${Number(order.totalAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-baseline font-bold text-brass-400/90">
                <span className="text-slate-400 text-[11px]">Total Due (KHR):</span>
                <span className="text-sm">{Number(order.khrTotal).toLocaleString()} ៛</span>
              </div>
            </div>
          </div>

          {/* Refund Notice if refunded */}
          {refunds.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Refund Processed:</span> This order was refunded on{' '}
                {new Date(refunds[0].createdAt).toLocaleString()}. Amount: ${Number(refunds[0].refundTotal).toFixed(2)} ({refunds[0].reason}). Stock has been returned to inventory.
              </div>
            </div>
          )}

          {printSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-center font-medium">
              {printSuccess}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-obsidian-800 flex items-center justify-between bg-obsidian-850">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleReprint}
              disabled={isReprinting}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-obsidian-800 hover:bg-obsidian-750 text-slate-200 border border-obsidian-700 transition active:scale-95 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 text-brass-400" />
              <span>{isReprinting ? 'Generating...' : 'Reprint Thermal Receipt'}</span>
            </button>

            {canRefund && order.status === 'COMPLETED' && (
              <button
                onClick={handleOpenRefund}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>Process Refund</span>
              </button>
            )}
          </div>

          <button
            onClick={() => setIsTransactionDetailOpen(false)}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-obsidian-800"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

