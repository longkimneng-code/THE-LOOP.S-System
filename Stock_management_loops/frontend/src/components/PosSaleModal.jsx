import React, { useState, useEffect } from 'react';
import { formatMoney } from '../api';
import Icon from './Icon';

export default function PosSaleModal({
  isOpen,
  products = [],
  customers = [],
  locations = [],
  onClose,
  onSale
}) {
  const [sku, setSku] = useState('');
  const [qty, setQty] = useState(1);
  const [customerId, setCustomerId] = useState('WALK_IN');
  const [method, setMethod] = useState('CREDIT_CARD');
  const [locationId, setLocationId] = useState(() => locations[0]?.id || 'loc-01');

  useEffect(() => {
    if (locations && locations.length > 0 && !locations.some((l) => l.id === locationId)) {
      setLocationId(locations[0].id);
    }
  }, [locations, locationId]);

  const allSkus = [];
  (products || []).forEach((p) => {
    (p.variants || []).forEach((v) => {
      allSkus.push({
        sku: v.sku,
        productName: p.name,
        title: v.title,
        imageUrl: p.imageUrl,
        label: `${v.sku} — ${p.name} (${v.title}) [${v.onHand} in stock]`,
        price: v.retailMinor,
        onHand: v.onHand
      });
    });
  });

  useEffect(() => {
    if (allSkus.length > 0 && !sku) {
      setSku(allSkus[0].sku);
    }
  }, [products]);

  if (!isOpen) return null;

  const currentItem = allSkus.find((s) => s.sku === sku) || allSkus[0];
  const unitPrice = currentItem ? currentItem.price : 0;
  const subtotal = unitPrice * qty;
  const tax = Math.round(subtotal * 0.075);
  const total = subtotal + tax;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!currentItem) return;
    if (currentItem.onHand < qty) {
      alert(`Cannot sell ${qty} units: Only ${currentItem.onHand} units in stock!`);
      return;
    }

    onSale({
      sku,
      qty: parseInt(qty, 10),
      customerId,
      method,
      locationId
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-studio-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="glass-panel-elevated w-full max-w-xl max-h-[92vh] rounded-2xl overflow-hidden flex flex-col border border-white/15 shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-studio-900/60">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Icon name="shoppingBag" size={16} />
            </div>
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg text-white">Process Retail Sale (POS)</h3>
              <p className="text-[11px] text-studio-400 font-mono">Deduct physical units & print order receipt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-studio-400 hover:text-white flex items-center justify-center border border-white/10"
            aria-label="Close modal"
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto">
          <div>
            <label className="block font-mono text-studio-400 mb-1">Select Sellable SKU *</label>
            <select
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 font-mono text-white focus:outline-none focus:border-gold-500 shadow-sm cursor-pointer"
              required
            >
              {allSkus.length === 0 ? (
                <option value="">No products or SKUs available</option>
              ) : (
                allSkus.map((s) => (
                  <option key={s.sku} value={s.sku}>{s.label}</option>
                ))
              )}
            </select>
          </div>

          {/* Product Picture & Info Preview */}
          {currentItem && (
            <div className="flex items-center space-x-3 p-3 bg-studio-900/70 rounded-xl border border-white/5 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-studio-950 overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center">
                {currentItem.imageUrl ? (
                  <img src={currentItem.imageUrl} alt={currentItem.productName} className="w-full h-full object-cover" />
                ) : (
                  <Icon name="catalog" size={20} className="text-gold-400 opacity-60" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-white text-xs block truncate">{currentItem.productName}</span>
                <span className="text-[10px] text-studio-400 font-mono block truncate">
                  {currentItem.title} • Price: <strong className="text-emerald-400">{formatMoney(currentItem.price)}</strong>
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-studio-400 mb-1">Quantity *</label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 font-mono text-white focus:outline-none focus:border-gold-500 shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block font-mono text-studio-400 mb-1">Customer (Optional)</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-gold-500 shadow-sm cursor-pointer"
              >
                <option value="WALK_IN">Walk-in Retail Guest</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-studio-400 mb-1">Payment Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-gold-500 shadow-sm cursor-pointer"
              >
                <option value="CREDIT_CARD">Credit Card / Contactless</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank / QR Payment</option>
                <option value="STORE_CREDIT">Store Credit</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-studio-400 mb-1">Sale Location Node</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-gold-500 shadow-sm cursor-pointer"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Order Total Preview Box */}
          <div className="p-4 rounded-xl bg-studio-900/80 border border-white/10 space-y-1.5 font-mono shadow-sm">
            <div className="flex justify-between text-studio-400">
              <span>Unit Price:</span>
              <span>{formatMoney(unitPrice)}</span>
            </div>
            <div className="flex justify-between text-studio-400">
              <span>Tax (Estimated 7.5%):</span>
              <span>{formatMoney(tax)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/10">
              <span>Total Collected:</span>
              <span className="text-emerald-400 font-extrabold">{formatMoney(total)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={allSkus.length === 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-sm tracking-wide rounded-xl shadow-md shadow-emerald-500/20 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
          >
            <Icon name="shoppingBag" size={16} />
            <span>Complete Sale & Deduct Stock</span>
          </button>
        </form>
      </div>
    </div>
  );
}
