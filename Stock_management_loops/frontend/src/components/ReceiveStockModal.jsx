import React, { useState, useEffect } from 'react';
import Icon from './Icon';

export default function ReceiveStockModal({
  isOpen,
  initialSku,
  products = [],
  locations = [],
  onClose,
  onReceive
}) {
  const [sku, setSku] = useState('');
  const [qty, setQty] = useState(10);
  const [locationId, setLocationId] = useState(() => locations[0]?.id || 'loc-01');
  const [poNumber, setPoNumber] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (locations && locations.length > 0 && !locations.some((l) => l.id === locationId)) {
      setLocationId(locations[0].id);
    }
  }, [locations, locationId]);

  // Collect all available SKUs
  const allSkus = [];
  (products || []).forEach((p) => {
    (p.variants || []).forEach((v) => {
      allSkus.push({
        sku: v.sku,
        label: `${v.sku} — ${p.name} (${v.title}) [${v.onHand} on hand]`,
        cost: (v.costMinor || 0) / 100
      });
    });
  });

  useEffect(() => {
    if (initialSku) {
      setSku(initialSku);
      const matched = allSkus.find((s) => s.sku === initialSku);
      if (matched) setUnitCost(matched.cost.toFixed(2));
    } else if (allSkus.length > 0 && !sku) {
      setSku(allSkus[0].sku);
      setUnitCost(allSkus[0].cost.toFixed(2));
    }
  }, [initialSku, products]);

  if (!isOpen) return null;

  const handleSkuChange = (e) => {
    const val = e.target.value;
    setSku(val);
    const matched = allSkus.find((s) => s.sku === val);
    if (matched) setUnitCost(matched.cost.toFixed(2));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onReceive({
      sku,
      qty: parseInt(qty, 10),
      locationId,
      poNumber: poNumber.trim() || 'PO-MANUAL',
      unitCostMinor: Math.round(parseFloat(unitCost || '0') * 100),
      notes: notes.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-studio-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="glass-panel-elevated w-full max-w-lg max-h-[92vh] rounded-2xl overflow-hidden flex flex-col border border-white/15 shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-studio-900/60">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gold-500/10 text-gold-400 flex items-center justify-center">
              <Icon name="receive" size={16} />
            </div>
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg text-white">Receive Stock Delivery</h3>
              <p className="text-[11px] text-studio-400 font-mono">Log incoming shipment & increment ledger</p>
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
            <label className="block font-mono text-studio-400 mb-1">Target SKU to Receive *</label>
            <select
              value={sku}
              onChange={handleSkuChange}
              className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 font-mono text-white focus:outline-none focus:border-gold-500 shadow-sm cursor-pointer"
              required
            >
              {allSkus.length === 0 ? (
                <option value="">No products or SKUs created yet</option>
              ) : (
                allSkus.map((s) => (
                  <option key={s.sku} value={s.sku}>{s.label}</option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-studio-400 mb-1">Quantity Received *</label>
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
              <label className="block font-mono text-studio-400 mb-1">Receiving Location Node</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-gold-500 shadow-sm cursor-pointer"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-studio-400 mb-1">PO / Inbound Document Ref</label>
              <input
                type="text"
                placeholder="e.g. PO-2026-0099"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 font-mono text-white focus:outline-none focus:border-gold-500 shadow-sm"
              />
            </div>
            <div>
              <label className="block font-mono text-studio-400 mb-1">Unit Cost ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 font-mono text-white focus:outline-none focus:border-gold-500 shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-studio-400 mb-1">Receiving Audit Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Standard shipment delivery, verified intact carton packaging"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-gold-500 shadow-sm"
            />
          </div>

          <button
            type="submit"
            disabled={allSkus.length === 0}
            className="w-full py-3 bg-gold-500 hover:bg-gold-400 text-studio-950 font-display font-bold text-sm tracking-wide rounded-xl shadow-md shadow-gold-500/20 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
          >
            <Icon name="receive" size={16} />
            <span>Commit Goods Receipt & Update Ledger</span>
          </button>
        </form>
      </div>
    </div>
  );
}
