import React from 'react';
import { formatMoney } from '../api';
import Icon from './Icon';

export default function Customers({ customers = [] }) {
  return (
    <section className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-white flex items-center space-x-2">
            <Icon name="customers" size={22} className="text-gold-400" />
            <span>Customer Directory & Lifetime Value</span>
          </h2>
          <p className="text-xs text-studio-400 mt-0.5">
            Customer contact information, lifetime retail spend, order frequency, and purchase history.
          </p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-studio-900/90 text-[10px] uppercase text-studio-400 border-b border-white/10">
              <tr>
                <th className="py-3.5 px-4">Customer Code</th>
                <th className="py-3.5 px-4">Full Name</th>
                <th className="py-3.5 px-4">Email / Phone</th>
                <th className="py-3.5 px-4 text-right">Total Orders</th>
                <th className="py-3.5 px-4 text-right">Lifetime Value</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-[11px]">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-studio-400">
                    No customers registered yet.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-studio-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gold-400">{c.code}</td>
                    <td className="py-3.5 px-4 font-bold text-white">{c.name}</td>
                    <td className="py-3.5 px-4 text-studio-300">
                      {c.email}
                      <br />
                      <span className="text-studio-400 text-[10px]">{c.phone}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-white">{c.orders}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-400">{formatMoney(c.spendMinor)}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                        Active Account
                      </span>
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
