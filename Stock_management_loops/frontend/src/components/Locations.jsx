import React from 'react';
import Icon from './Icon';

export default function Locations({
  locations = [],
  activeLocationId,
  balances = [],
  onSelectLocation,
  onViewStoreStock,
  onOpenTransferModal,
  onOpenAddLocation,
  onRequestDeleteLocation
}) {
  return (
    <section className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-white flex items-center space-x-2">
            <Icon name="locations" size={22} className="text-gold-400" />
            <span>Stores, Warehouses & Locations</span>
          </h2>
          <p className="text-xs text-studio-400 mt-0.5">
            Add new branch nodes, transfer inventory between stores, or decommission a location with verified stock evacuation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenAddLocation}
            className="bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold px-3.5 py-2 rounded-xl text-xs shadow-md shadow-gold-500/20 transition-all flex items-center space-x-1.5 active:scale-95"
          >
            <Icon name="plus" size={14} />
            <span>Add New Store</span>
          </button>

          <button
            onClick={onOpenTransferModal}
            className="bg-studio-900 hover:bg-studio-800 text-white border border-white/10 font-bold px-3.5 py-2 rounded-xl text-xs transition-all flex items-center space-x-1.5 active:scale-95 shadow-sm"
          >
            <Icon name="transfer" size={14} className="text-gold-400" />
            <span>Transfer Stock</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {locations.map((loc) => {
          const isActive = loc.id === activeLocationId;
          const locBalances = (balances || []).filter((b) => b.locationId === loc.id);
          const totalUnits = locBalances.reduce((sum, b) => sum + (b.onHand || 0), 0);
          const lowStockCount = locBalances.filter((b) => (b.onHand || 0) <= (b.rop || 5) && (b.onHand || 0) > 0).length;
          const oosCount = locBalances.filter((b) => (b.onHand || 0) === 0).length;
          const inStockCount = locBalances.filter((b) => (b.onHand || 0) > (b.rop || 5)).length;

          const total = inStockCount + lowStockCount + oosCount;
          const inStockPct = total > 0 ? (inStockCount / total) * 100 : 0;
          const lowStockPct = total > 0 ? (lowStockCount / total) * 100 : 0;
          const oosPct = total > 0 ? (oosCount / total) * 100 : 0;

          const typeColors = {
            STORE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
            WAREHOUSE: 'bg-gold-500/10 text-gold-400 border-gold-500/30',
            OUTLET: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
            STORAGE_ROOM: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
          };

          return (
            <div
              key={loc.id}
              className={`glass-panel p-5 rounded-2xl space-y-4 border transition-all duration-300 relative flex flex-col justify-between shadow-sm hover:shadow-lg ${
                isActive
                  ? 'border-gold-500/60 ring-2 ring-gold-500/20 bg-gradient-to-b from-gold-500/5 to-transparent'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div>
                {/* Header: Code & Type Badges */}
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded font-mono text-[10px] font-bold bg-white/5 text-gold-400 border border-white/10">
                    {loc.code}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    {loc.isDefault && (
                      <span className="text-[9px] font-mono text-gold-400 font-bold bg-gold-500/15 px-2 py-0.5 rounded border border-gold-500/30">
                        Default HQ
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
                        typeColors[loc.type] || 'bg-white/5 text-studio-300 border-white/10'
                      }`}
                    >
                      {loc.type}
                    </span>
                  </div>
                </div>

                {/* Name & Address */}
                <div className="mt-3">
                  <h3 className="font-display font-black text-lg text-white">{loc.name}</h3>
                  <p className="text-xs text-studio-400 font-mono mt-0.5">
                    {loc.address || 'Operational storage & retail dispatch node'}
                  </p>
                </div>

                {/* Real-Time Location Metrics */}
                <div className="mt-4 p-3 bg-studio-900/80 rounded-xl border border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-studio-400">Total Units Stocked:</span>
                    <span className="text-base font-display font-extrabold text-white">
                      {totalUnits.toLocaleString()}
                    </span>
                  </div>

                  {/* Stock health distribution bar */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-studio-950 rounded-full overflow-hidden flex">
                      <div style={{ width: `${inStockPct}%` }} className="bg-emerald-500 h-full" title={`In Stock: ${inStockCount}`} />
                      <div style={{ width: `${lowStockPct}%` }} className="bg-gold-500 h-full" title={`Low Stock: ${lowStockCount}`} />
                      <div style={{ width: `${oosPct}%` }} className="bg-crimson-500 h-full" title={`OOS: ${oosCount}`} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center font-mono">
                    <div>
                      <span className="text-[10px] text-studio-400 block">Healthy</span>
                      <span className="text-xs font-bold text-emerald-400">{inStockCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-studio-400 block">Low</span>
                      <span className="text-xs font-bold text-gold-400">{lowStockCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-studio-400 block">OOS</span>
                      <span className="text-xs font-bold text-crimson-400">{oosCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-white/5 space-y-2">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onSelectLocation(loc.id)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-semibold transition-all ${
                      isActive
                        ? 'bg-gold-500 text-studio-950 font-bold shadow-sm'
                        : 'bg-studio-900 hover:bg-studio-800 text-studio-300 hover:text-white border border-white/10'
                    }`}
                  >
                    {isActive ? '● Active Scope Node' : 'Select as Active'}
                  </button>
                  <button
                    onClick={() => onViewStoreStock(loc.id, 'ALL')}
                    className="py-1.5 px-2.5 rounded-lg text-xs font-mono text-gold-400 hover:text-white hover:bg-gold-500/20 border border-gold-500/30 transition-all flex items-center space-x-1"
                    title="View all inventory at this store"
                  >
                    <span>Stock</span>
                    <Icon name="arrowRight" size={11} />
                  </button>
                </div>

                {/* Stock Breakdown Navigation Buttons */}
                <div className="flex items-center justify-between text-[11px] font-mono text-studio-400 pt-1">
                  <button
                    onClick={() => onViewStoreStock(loc.id, 'LOW_STOCK')}
                    className="hover:text-gold-400 transition-colors flex items-center space-x-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
                    <span>View Low ({lowStockCount})</span>
                  </button>
                  <button
                    onClick={() => onViewStoreStock(loc.id, 'OOS')}
                    className="hover:text-crimson-400 transition-colors flex items-center space-x-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-crimson-400" />
                    <span>View OOS ({oosCount})</span>
                  </button>
                </div>

                {/* Decommission / Delete Store Button */}
                {!loc.isDefault && (
                  <div className="pt-2 border-t border-white/5 flex justify-end">
                    <button
                      onClick={() => onRequestDeleteLocation && onRequestDeleteLocation(loc)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-mono text-studio-400 hover:text-crimson-400 hover:bg-crimson-500/10 transition-all flex items-center space-x-1.5 border border-transparent hover:border-crimson-500/20"
                      title="Decommission & delete this store node"
                    >
                      <Icon name="trash" size={12} />
                      <span>Decommission Store</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
