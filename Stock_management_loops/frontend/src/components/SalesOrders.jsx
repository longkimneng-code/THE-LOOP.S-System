import React from 'react';
import { formatMoney } from '../api';
import Icon from './Icon';

export default function SalesOrders({ sales = [], onOpenPosModal, onRefundSale }) {
  return (
    <section className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-white flex items-center space-x-2">
            <Icon name="sales" size={22} className="text-gold-400" />
            <span>Sales & Customer Orders</span>
          </h2>
          <p className="text-xs text-studio-400 mt-0.5">
            Retail register transactions, customer orders, payment methods, and return processing.
          </p>
        </div>
        <button
          onClick={onOpenPosModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center space-x-1.5 active:scale-95"
        >
          <Icon name="shoppingBag" size={15} />
          <span>New Retail Sale (POS)</span>
        </button>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-studio-900/90 text-[10px] uppercase text-studio-400 border-b border-white/10">
              <tr>
                <th className="py-3.5 px-4">Invoice #</th>
                <th className="py-3.5 px-4">Date / Time</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Items / SKUs</th>
                <th className="py-3.5 px-4 text-right">Subtotal</th>
                <th className="py-3.5 px-4 text-right">Total Paid</th>
                <th className="py-3.5 px-4">Method</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-[11px]">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-studio-400">
                    No sales transactions processed yet.
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-studio-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gold-400">{s.saleNumber}</td>
                    <td className="py-3.5 px-4 text-studio-400">{s.date.substring(0, 16)}</td>
                    <td className="py-3.5 px-4 text-white font-medium">{s.customerName}</td>
                    <td className="py-3.5 px-4 text-studio-300">
                      {s.items.map((i) => `${i.qty}× ${i.sku}`).join(', ')}
                    </td>
                    <td className="py-3.5 px-4 text-right text-studio-400">{formatMoney(s.subtotalMinor)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-400">{formatMoney(s.totalMinor)}</td>
                    <td className="py-3.5 px-4 text-studio-400 font-mono text-[10px] uppercase">{s.method}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {s.status === 'COMPLETED' ? (
                        <button
                          onClick={() => onRefundSale(s.id)}
                          className="px-2.5 py-1 bg-studio-800 hover:bg-crimson-600 text-studio-300 hover:text-white rounded-lg text-[10px] transition-all"
                        >
                          Process Return
                        </button>
                      ) : (
                        <span className="text-[10px] text-studio-400 font-mono">Refunded</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
