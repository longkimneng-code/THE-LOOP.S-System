import React from 'react';
import { formatMoney } from '../api';
import Icon from './Icon';

export default function ProductDetailModal({ product, ledger = [], onClose, onEditProduct }) {
  if (!product) return null;

  const margin = product.retailMinor > 0
    ? (((product.retailMinor - product.costMinor) / product.retailMinor) * 100).toFixed(1)
    : '0';

  const filteredHistory = (ledger || []).filter(
    (m) => m.productCode === product.code || (product.variants || []).some((v) => v.sku === m.sku)
  );

  return (
    <div className="fixed inset-0 z-50 bg-studio-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="glass-panel-elevated w-full max-w-4xl max-h-[92vh] rounded-2xl overflow-hidden flex flex-col border border-white/15 shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex items-start justify-between bg-studio-900/60">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="px-2.5 py-0.5 rounded font-mono text-xs bg-gold-500/20 text-gold-400 border border-gold-500/30 font-bold">
                {product.code}
              </span>
              <span className="text-xs font-mono text-studio-400 uppercase">{product.category}</span>
              <span className="text-xs font-mono text-studio-300">• {product.brand || 'Universal Brand'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white mt-1.5">{product.name}</h2>
            <p className="text-xs text-studio-300 mt-1 max-w-2xl">{product.description || ''}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onClose();
                if (onEditProduct) onEditProduct(product);
              }}
              className="px-3.5 py-2 bg-studio-800 hover:bg-gold-500 hover:text-studio-950 text-white rounded-xl text-xs font-semibold border border-white/10 transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
            >
              <Icon name="edit" size={13} />
              <span>Edit Product</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-studio-400 hover:text-white flex items-center justify-center border border-white/10 transition-colors"
              aria-label="Close modal"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Product Image Banner (if available) */}
          {product.imageUrl && (
            <div className="w-full h-44 sm:h-56 rounded-2xl overflow-hidden border border-white/10 relative bg-studio-900 group shadow-md">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.parentNode.style.display = 'none'; }}
              />
              <div className="absolute bottom-2.5 left-2.5 bg-studio-950/85 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-mono text-gold-400 border border-white/10 shadow flex items-center space-x-1.5">
                <Icon name="image" size={12} />
                <span>{product.name} • {product.brand || 'Universal'}</span>
              </div>
            </div>
          )}

          {/* Pricing & Margin Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-studio-900/60 rounded-xl border border-white/5 font-mono">
            <div>
              <span className="text-studio-400 text-[10px] block">UNIT COST (COGS)</span>
              <span className="text-white text-base font-bold">{formatMoney(product.costMinor)}</span>
            </div>
            <div>
              <span className="text-studio-400 text-[10px] block">RETAIL PRICE</span>
              <span className="text-gold-400 text-base font-bold">{formatMoney(product.retailMinor)}</span>
            </div>
            <div>
              <span className="text-studio-400 text-[10px] block">GROSS MARGIN %</span>
              <span className="text-emerald-400 text-base font-bold">{margin}%</span>
            </div>
            <div>
              <span className="text-studio-400 text-[10px] block">STOCK UNIT</span>
              <span className="text-studio-200 text-base font-bold">{product.stockUnit || 'piece'}</span>
            </div>
          </div>

          {/* Variants & SKUs Matrix Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-white flex items-center space-x-2">
                <Icon name="layers" size={15} className="text-gold-400" />
                <span>Sellable Variants & SKU Matrix</span>
              </h3>
              <span className="text-[11px] font-mono text-studio-400">Available = On-Hand − Reserved</span>
            </div>

            <div className="rounded-xl border border-white/10 overflow-hidden bg-studio-900/40">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-studio-900 text-[10px] uppercase text-studio-400 border-b border-white/10">
                  <tr>
                    <th className="py-2.5 px-3">Variant Title / Options</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Barcode</th>
                    <th className="py-2.5 px-3 text-right">Cost</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 px-3 text-right">On Hand</th>
                    <th className="py-2.5 px-3 text-right">Available</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(product.variants || []).map((v) => {
                    const avail = (v.onHand || 0) - (v.reserved || 0);
                    const statusBadge =
                      (v.onHand || 0) === 0 ? (
                        <span className="text-crimson-400 font-bold">OOS</span>
                      ) : (v.onHand || 0) <= (v.rop || 5) ? (
                        <span className="text-gold-400 font-bold">LOW</span>
                      ) : (
                        <span className="text-emerald-400 font-bold">HEALTHY</span>
                      );

                    return (
                      <tr key={v.sku} className="hover:bg-studio-900/60">
                        <td className="py-2.5 px-3 font-bold text-white">{v.title}</td>
                        <td className="py-2.5 px-3 text-gold-400 font-semibold">{v.sku}</td>
                        <td className="py-2.5 px-3 text-studio-400">{v.barcode || '-'}</td>
                        <td className="py-2.5 px-3 text-right text-studio-300">{formatMoney(v.costMinor)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">{formatMoney(v.retailMinor)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-white">{v.onHand || 0}</td>
                        <td className="py-2.5 px-3 text-right text-studio-200 font-bold">{avail}</td>
                        <td className="py-2.5 px-3 text-center">{statusBadge}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Movement History */}
          <div className="space-y-2.5">
            <h3 className="font-display font-bold text-sm text-white flex items-center space-x-2">
              <Icon name="inventory" size={15} className="text-gold-400" />
              <span>Product Movement Ledger History</span>
            </h3>
            <div className="rounded-xl border border-white/10 overflow-hidden bg-studio-900/40">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-studio-900 text-[10px] uppercase text-studio-400 border-b border-white/10">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Movement Type</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3 text-right">Delta</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Reason / Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-studio-400">
                        No recorded movements for this product yet.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((m) => (
                      <tr key={m.id} className="hover:bg-studio-900/40">
                        <td className="py-2 px-3 text-studio-400">{m.timestamp.substring(5, 16)}</td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 font-bold text-gold-400">
                            {m.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-white font-medium">{m.sku}</td>
                        <td className={`py-2 px-3 text-right font-bold ${m.delta > 0 ? 'text-emerald-400' : 'text-crimson-400'}`}>
                          {m.delta > 0 ? '+' : ''}{m.delta}
                        </td>
                        <td className="py-2 px-3 text-studio-300">{m.referenceNo || '-'}</td>
                        <td className="py-2 px-3 text-studio-400 max-w-xs truncate">{m.reason || ''}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-studio-900/60 flex items-center justify-between">
          <span className="text-xs font-mono text-studio-400">Universal Retail Product Inspector</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-studio-800 hover:bg-studio-700 text-xs font-semibold text-white rounded-xl transition-all"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
