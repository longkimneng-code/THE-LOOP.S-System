import React from 'react';
import { formatMoney } from '../api';
import Icon from './Icon';

export default function Purchasing({ purchases = [], suppliers = [], onReceivePo }) {
  return (
    <section className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-white flex items-center space-x-2">
            <Icon name="purchasing" size={22} className="text-gold-400" />
            <span>Purchasing & Vendor Logistics</span>
          </h2>
          <p className="text-xs text-studio-400 mt-0.5">
            Manage suppliers, purchase orders, expected quantities, partial shipments, and goods receipt.
          </p>
        </div>
      </div>

      {/* Active Purchase Orders Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-lg">
        <div className="p-3.5 border-b border-white/10 bg-studio-900/60 font-display font-bold text-sm text-white flex items-center space-x-2">
          <Icon name="catalog" size={15} className="text-gold-400" />
          <span>Active Purchase Orders</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-studio-900/90 text-[10px] uppercase text-studio-400 border-b border-white/10">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Order Date</th>
                <th className="py-3 px-4">Expected Date</th>
                <th className="py-3 px-4 text-right">Total Cost</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-[11px]">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-studio-400">
                    No purchase orders recorded yet.
                  </td>
                </tr>
              ) : (
                purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-studio-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gold-400">{po.poNumber}</td>
                    <td className="py-3.5 px-4 text-white font-medium">{po.supplierName}</td>
                    <td className="py-3.5 px-4 text-studio-400">{po.orderDate.substring(0, 10)}</td>
                    <td className="py-3.5 px-4 text-studio-400">{po.expectedDate || '-'}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-white">{formatMoney(po.totalCostMinor)}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${po.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-gold-500/20 text-gold-400 border-gold-500/30'}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {po.status !== 'COMPLETED' ? (
                        <button
                          onClick={() => onReceivePo(po.id)}
                          className="px-3 py-1 bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold rounded-lg text-[10px] transition-all shadow-sm active:scale-95 inline-flex items-center space-x-1"
                        >
                          <Icon name="receive" size={11} />
                          <span>Receive Goods</span>
                        </button>
                      ) : (
                        <span className="text-studio-500 font-mono text-[10px]">Fulfilled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Directory */}
      <div className="space-y-3">
        <h3 className="font-display font-bold text-base text-white flex items-center space-x-2">
          <Icon name="purchasing" size={16} className="text-gold-400" />
          <span>Approved Supplier Directory</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.length === 0 ? (
            <div className="col-span-full py-8 text-center text-xs font-mono text-studio-400 glass-panel rounded-2xl">
              No suppliers added yet.
            </div>
          ) : (
            suppliers.map((sup) => (
              <div key={sup.id} className="glass-panel p-5 rounded-2xl space-y-2 border border-white/10 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-sm text-white">{sup.name}</h4>
                  <span className="text-[10px] font-mono text-gold-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg">
                    {sup.leadTime}d lead
                  </span>
                </div>
                <p className="text-xs text-studio-400">{sup.contact} • {sup.email}</p>
                <div className="text-[11px] font-mono text-studio-300">{sup.phone}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
