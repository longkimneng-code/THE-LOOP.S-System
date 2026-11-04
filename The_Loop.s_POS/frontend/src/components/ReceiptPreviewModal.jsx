import React from 'react';
import { usePos } from '../context/PosContext';
import { X, Printer, CheckCircle, ArrowRight } from 'lucide-react';

export default function ReceiptPreviewModal() {
  const { isReceiptOpen, setIsReceiptOpen, activeReceipt } = usePos();

  if (!isReceiptOpen || !activeReceipt) return null;

  const { header, meta, items, summary, payments, footer } = activeReceipt;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="px-5 py-3 border-b border-obsidian-800 flex items-center justify-between bg-obsidian-950">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            <span>Sale Completed</span>
          </div>
          <button
            onClick={() => setIsReceiptOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable 80mm Thermal Receipt Canvas */}
        <div className="p-4 overflow-y-auto flex-1 flex justify-center bg-obsidian-950/50">
          <div
            id="thermal-receipt-printable"
            className="w-full bg-white text-black p-4 font-mono text-[11px] leading-tight shadow-lg rounded-sm select-text"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {/* Header */}
            <div className="text-center border-b border-dashed border-gray-400 pb-2 mb-2">
              <div className="text-base font-bold tracking-wider">{header.storeName}</div>
              <div className="text-[10px] text-gray-700">{header.branchName}</div>
              <div className="text-[9px] text-gray-600">{header.address}</div>
              <div className="text-[9px] text-gray-600">Tel: {header.phone}</div>
              <div className="text-[9px] text-gray-600">Tax ID: {header.taxId}</div>
            </div>

            {/* Meta */}
            <div className="border-b border-dashed border-gray-400 pb-2 mb-2 space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>Receipt:</span>
                <span className="font-bold">{meta.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{meta.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span>Register:</span>
                <span>{meta.registerCode}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{meta.cashierName}</span>
              </div>
            </div>

            {/* Items */}
            <div className="border-b border-dashed border-gray-400 pb-2 mb-2 space-y-1">
              {items.map((it, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="font-bold truncate">{it.title}</div>
                  <div className="flex justify-between text-gray-700">
                    <span>{it.quantity} × ${it.unitPrice}</span>
                    <span className="font-bold text-black">${it.total}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="border-b border-dashed border-gray-400 pb-2 mb-2 space-y-0.5">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${summary.subtotal}</span>
              </div>
              {Number(summary.discountTotal) > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Discounts:</span>
                  <span>-${summary.discountTotal}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>VAT (10%):</span>
                <span>${summary.taxTotal}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-300">
                <span>TOTAL:</span>
                <span>${summary.totalAmount}</span>
              </div>
              <div className="text-right text-[10px] text-gray-600">
                ({summary.khrEquivalent})
              </div>
            </div>

            {/* Payments */}
            <div className="border-b border-dashed border-gray-400 pb-2 mb-2 space-y-0.5 text-[10px]">
              {payments.map((p, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>Paid ({p.method}):</span>
                    <span>${p.amount}</span>
                  </div>
                  {Number(p.change) > 0 && (
                    <div className="flex justify-between font-bold">
                      <span>Change:</span>
                      <span>${p.change}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="text-center text-[9px] text-gray-600 space-y-1 pt-1">
              <div className="font-semibold text-black">{footer.message}</div>
              <div>{footer.returnPolicy}</div>
              <div className="text-[8px] text-gray-500 font-mono tracking-widest mt-2">
                * * {meta.orderNumber} * *
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-obsidian-950 border-t border-obsidian-800 flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 text-xs font-semibold text-slate-100 flex items-center justify-center space-x-2 transition-colors"
          >
            <Printer className="w-4 h-4 text-brass-400" />
            <span>Print Thermal</span>
          </button>

          <button
            onClick={() => setIsReceiptOpen(false)}
            className="flex-1 py-2.5 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs flex items-center justify-center space-x-1 shadow-md transition-all"
          >
            <span>Next Customer</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

