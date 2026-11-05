import React, { useState, useEffect } from 'react';
import Icon from './Icon';

export default function StockTransferModal({
  isOpen,
  products = [],
  locations = [],
  balances = [],
  onClose,
  onTransfer
}) {
  const [fromLoc, setFromLoc] = useState(() => locations[0]?.id || 'loc-01');
  const [toLoc, setToLoc] = useState(() => locations[1]?.id || locations[0]?.id || 'loc-zprdw9b');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (locations && locations.length > 0) {
      if (!locations.some((l) => l.id === fromLoc)) {
        setFromLoc(locations[0].id);
      }
      if (!locations.some((l) => l.id === toLoc)) {
        setToLoc(locations[1]?.id || locations[0].id);
      }
    }
  }, [locations, fromLoc, toLoc]);

  // Compute all SKUs with current source location inventory balance
  const allSkus = [];
  (products || []).forEach((p) => {
    (p.variants || []).forEach((v) => {
      const srcBal = (balances || []).find((b) => b.sku === v.sku && b.locationId === fromLoc);
      const srcOnHand = srcBal ? srcBal.onHand : 0;
      allSkus.push({
        sku: v.sku,
        productName: p.name,
        variantTitle: v.title,
        srcOnHand,
        totalOnHand: v.onHand,
        label: `${v.sku} — ${p.name} (${v.title}) [${srcOnHand} at source]`
      });
    });
  });

  const [sku, setSku] = useState('');
  const activeSku = sku || (allSkus[0]?.sku || '');

  // Calculate live source and destination inventory for selected SKU
  const sourceBalance = (balances || []).find((b) => b.sku === activeSku && b.locationId === fromLoc);
  const sourceOnHand = sourceBalance ? sourceBalance.onHand : 0;

  const destBalance = (balances || []).find((b) => b.sku === activeSku && b.locationId === toLoc);
  const destOnHand = destBalance ? destBalance.onHand : 0;

  const fromLocObj = (locations || []).find((l) => l.id === fromLoc) || { name: 'Source Location' };
  const toLocObj = (locations || []).find((l) => l.id === toLoc) || { name: 'Destination Location' };

  if (!isOpen) return null;

  const numQty = parseInt(qty, 10) || 0;
  const isInvalidQty = numQty <= 0 || numQty > sourceOnHand;
  const isSameLocation = fromLoc === toLoc;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSameLocation) {
      alert('Source and destination locations must be different!');
      return;
    }
    if (numQty <= 0) {
      alert('Transfer quantity must be greater than zero!');
      return;
    }
    if (numQty > sourceOnHand) {
      alert(`Cannot transfer ${numQty} units: Source store only has ${sourceOnHand} units on hand!`);
      return;
    }

    onTransfer({
      sku: activeSku,
      qty: numQty,
      fromLocationId: fromLoc,
      toLocationId: toLoc,
      notes: `Inter-store transfer from ${fromLocObj.name} to ${toLocObj.name}`
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-studio-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="glass-panel-elevated w-full max-w-xl max-h-[92vh] rounded-2xl overflow-hidden flex flex-col border border-white/15 shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-studio-900/60">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Icon name="transfer" size={16} />
            </div>
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg text-white">Inter-Store Stock Transfer</h3>
              <p className="text-[11px] text-studio-400 font-mono">Atomic movement ledger with dual-entry audit</p>
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
          {/* SKU Selector */}
          <div>
            <label className="block font-mono text-studio-400 mb-1">Select SKU to Transfer *</label>
            <select
              value={activeSku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 font-mono text-white focus:outline-none focus:border-gold-500 shadow-sm cursor-pointer"
              required
            >
              {allSkus.length === 0 ? (
                <option value="">No items available for transfer</option>
              ) : (
                allSkus.map((s) => (
                  <option key={s.sku} value={s.sku}>
                    {s.label}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Source and Destination Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-studio-400 mb-1">From Source Location *</label>
              <select
                value={fromLoc}
                onChange={(e) => setFromLoc(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-gold-500 shadow-sm cursor-pointer"
              >
                {locations.map((l) => {
                  const locBal = (balances || []).find((b) => b.sku === activeSku && b.locationId === l.id);
                  const locOnHand = locBal ? locBal.onHand : 0;
                  return (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code}) — [{locOnHand} on hand]
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block font-mono text-studio-400 mb-1">To Destination Location *</label>
              <select
                value={toLoc}
                onChange={(e) => setToLoc(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-gold-500 shadow-sm cursor-pointer"
              >
                {locations.map((l) => {
                  const locBal = (balances || []).find((b) => b.sku === activeSku && b.locationId === l.id);
                  const locOnHand = locBal ? locBal.onHand : 0;
                  return (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code}) — [{locOnHand} on hand]
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Warning for Zero Stock at Source */}
          {sourceOnHand <= 0 && !isSameLocation && (
            <div className="p-3 bg-crimson-500/10 border border-crimson-500/30 text-crimson-400 rounded-xl text-xs font-mono flex items-center space-x-2">
              <Icon name="alertTriangle" size={14} />
              <span>Source store "{fromLocObj.name}" has 0 units of this item. Select a store with available inventory as source.</span>
            </div>
          )}

          {/* Validation Warning for Same Location */}
          {isSameLocation && (
            <div className="p-3 bg-crimson-500/10 border border-crimson-500/30 text-crimson-400 rounded-xl text-xs font-mono flex items-center space-x-2">
              <Icon name="alertTriangle" size={14} />
              <span>Source and destination cannot be the same store.</span>
            </div>
          )}

          {/* Live Inventory Preview Panel */}
          <div className="p-4 rounded-xl bg-studio-900/80 border border-white/10 space-y-3 font-mono shadow-sm">
            <span className="text-[10px] text-studio-400 uppercase tracking-wider block font-semibold">
              Live Stock Telemetry & Predicted Balance After Transfer
            </span>
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Source Balance */}
              <div className="p-3 bg-studio-950/60 rounded-lg border border-white/5 space-y-1">
                <span className="text-[10px] text-studio-400 block truncate">Source ({fromLocObj.name})</span>
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-base font-bold text-white">{sourceOnHand}</span>
                  <span className="text-[10px] text-studio-400">now</span>
                </div>
                {!isInvalidQty && numQty > 0 && (
                  <span className="text-[10px] text-gold-400 block pt-1 border-t border-white/5">
                    → Will become: <strong className="text-white">{sourceOnHand - numQty}</strong>
                  </span>
                )}
              </div>

              {/* Destination Balance */}
              <div className="p-3 bg-studio-950/60 rounded-lg border border-white/5 space-y-1">
                <span className="text-[10px] text-studio-400 block truncate">Destination ({toLocObj.name})</span>
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-base font-bold text-white">{destOnHand}</span>
                  <span className="text-[10px] text-studio-400">now</span>
                </div>
                {!isInvalidQty && numQty > 0 && !isSameLocation && (
                  <span className="text-[10px] text-emerald-400 block pt-1 border-t border-white/5">
                    → Will become: <strong className="text-white">{destOnHand + numQty}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quantity Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-mono text-studio-400">Transfer Quantity *</label>
              <span className="text-[11px] font-mono text-studio-400">
                Max transferable from source: <strong className="text-white">{sourceOnHand}</strong>
              </span>
            </div>
            <input
              type="number"
              min="1"
              max={sourceOnHand || 1}
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value || '1', 10))}
              className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 font-mono text-white focus:outline-none focus:border-gold-500 shadow-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isInvalidQty || isSameLocation || allSkus.length === 0}
            className="w-full py-3 bg-gold-500 hover:bg-gold-400 text-studio-950 font-display font-bold text-sm tracking-wide rounded-xl shadow-md shadow-gold-500/20 transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Icon name="transfer" size={16} />
            <span>Confirm & Dispatch Inter-Store Transfer</span>
          </button>
        </form>
      </div>
    </div>
  );
}
