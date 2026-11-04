import React from 'react';
import { formatMoney } from '../api';
import Icon from './Icon';

export default function Reports({ products = [], onOpenExportModal }) {
  let totalCost = 0;
  let totalRetail = 0;
  let totalDamaged = 0;

  (products || []).forEach((p) => {
    (p.variants || []).forEach((v) => {
      totalCost += (v.onHand || 0) * (v.costMinor || 0);
      totalRetail += (v.onHand || 0) * (v.retailMinor || 0);
      totalDamaged += (v.damaged || 0) * (v.costMinor || 0);
    });
  });

  const profit = totalRetail - totalCost;
  const margin = totalRetail > 0 ? ((profit / totalRetail) * 100).toFixed(1) : '0';

  return (
    <section className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-white flex items-center space-x-2">
            <Icon name="reports" size={22} className="text-gold-400" />
            <span>Universal Business Analytics & Reports</span>
          </h2>
          <p className="text-xs text-studio-400 mt-0.5">
            Asset valuation, projected gross margins, product velocity, shrinkage analysis, and export suite.
          </p>
        </div>
        <button
          onClick={onOpenExportModal}
          className="bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-gold-500/20 transition-all flex items-center space-x-1.5 active:scale-95"
        >
          <Icon name="export" size={14} />
          <span>Export Reports (Excel / PDF / Word / CSV)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-studio-400 uppercase">Valuation & Capital</span>
            <div className="w-7 h-7 rounded-lg bg-gold-500/10 text-gold-400 flex items-center justify-center">
              <Icon name="dollar" size={14} />
            </div>
          </div>
          <div className="text-2xl font-display font-extrabold text-white">{formatMoney(totalCost)}</div>
          <p className="text-xs text-studio-400">Total acquisition cost of active physical retail stock across all stores and warehouses.</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-studio-400 uppercase">Gross Profit Projection</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Icon name="reports" size={14} />
            </div>
          </div>
          <div className="text-2xl font-display font-extrabold text-emerald-400">{formatMoney(profit)}</div>
          <p className="text-xs text-studio-400">
            Projected gross retail earnings at current pricing (<span className="text-gold-400 font-mono font-bold">{margin}%</span> average margin).
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-studio-400 uppercase">Inventory Shrinkage & Loss</span>
            <div className="w-7 h-7 rounded-lg bg-crimson-500/10 text-crimson-400 flex items-center justify-center">
              <Icon name="alertTriangle" size={14} />
            </div>
          </div>
          <div className="text-2xl font-display font-extrabold text-crimson-400">{formatMoney(totalDamaged)}</div>
          <p className="text-xs text-studio-400">Stock written off or quarantined as damaged goods.</p>
        </div>
      </div>

      {/* Product Performance Table */}
      <div className="glass-panel p-5 rounded-2xl space-y-3 border border-white/10 shadow-sm">
        <h3 className="font-display font-bold text-sm text-white flex items-center space-x-2">
          <Icon name="catalog" size={15} className="text-gold-400" />
          <span>Product Margin & Inventory Performance</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-studio-900 text-[10px] uppercase text-studio-400 border-b border-white/10">
              <tr>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Stock On Hand</th>
                <th className="py-2.5 px-3 text-right">Asset Value (COGS)</th>
                <th className="py-2.5 px-3 text-right">Potential Revenue</th>
                <th className="py-2.5 px-3 text-right">Gross Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(products || []).length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-studio-400">
                    No products to evaluate.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const pUnits = (p.variants || []).reduce((s, v) => s + (v.onHand || 0), 0);
                  const pCost = (p.variants || []).reduce((s, v) => s + (v.onHand || 0) * (v.costMinor || 0), 0);
                  const pRetail = (p.variants || []).reduce((s, v) => s + (v.onHand || 0) * (v.retailMinor || 0), 0);
                  const pMargin = pRetail > 0 ? (((pRetail - pCost) / pRetail) * 100).toFixed(1) : '0';
                  return (
                    <tr key={p.id} className="hover:bg-studio-900/40">
                      <td className="py-2.5 px-3 font-bold text-white">{p.name}</td>
                      <td className="py-2.5 px-3 text-studio-400">{p.category}</td>
                      <td className="py-2.5 px-3 text-right text-white font-bold">{pUnits}</td>
                      <td className="py-2.5 px-3 text-right text-studio-300">{formatMoney(pCost)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">{formatMoney(pRetail)}</td>
                      <td className="py-2.5 px-3 text-right text-gold-400 font-bold">{pMargin}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
