import React, { useState } from 'react';
import Icon from './Icon';

export default function DeleteLocationModal({
  isOpen,
  location,
  locations = [],
  balances = [],
  onClose,
  onConfirmDelete
}) {
  const [targetDestId, setTargetDestId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !location) return null;

  // Other locations eligible for evacuation
  const otherLocations = locations.filter((l) => l.id !== location.id);

  // Compute live on-hand physical units and affected SKUs for this store
  const locBalances = (balances || []).filter(
    (b) => b.locationId === location.id && (b.onHand || 0) > 0
  );
  const totalUnitsOnHand = locBalances.reduce((sum, b) => sum + (b.onHand || 0), 0);
  const remainingSkusCount = locBalances.length;

  const selectedDestId = targetDestId || (otherLocations[0]?.id || '');
  const selectedDest = otherLocations.find((l) => l.id === selectedDestId);

  const handleDelete = async () => {
    if (location.isDefault) {
      alert('Cannot delete the primary default HQ store!');
      return;
    }

    if (totalUnitsOnHand > 0 && !selectedDestId) {
      alert('Please select a destination store to evacuate remaining stock to.');
      return;
    }

    try {
      setIsDeleting(true);
      await onConfirmDelete(location.id, totalUnitsOnHand > 0 ? selectedDestId : null);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-studio-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="glass-panel-elevated w-full max-w-lg rounded-2xl overflow-hidden flex flex-col border border-white/15 shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-studio-900/60">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-crimson-500/10 text-crimson-400 flex items-center justify-center">
              <Icon name="trash" size={16} />
            </div>
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg text-white">
                Decommission & Delete Store
              </h3>
              <p className="text-[11px] text-studio-400 font-mono">
                Store Node: {location.name} ({location.code})
              </p>
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

        <div className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Default Store Warning */}
          {location.isDefault ? (
            <div className="p-4 rounded-xl bg-crimson-500/10 border border-crimson-500/30 text-crimson-400 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-sm">
                <Icon name="alertTriangle" size={16} />
                <span>Primary Default Store Cannot Be Deleted</span>
              </div>
              <p className="text-xs text-studio-300">
                "{location.name}" is designated as your business HQ. You must designate another store as default in Settings before deleting this node.
              </p>
            </div>
          ) : totalUnitsOnHand > 0 ? (
            /* Stock Evacuation Warning & Selection */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gold-500/10 border border-gold-500/30 space-y-2 text-gold-400">
                <div className="flex items-center space-x-2 font-bold text-sm text-gold-400">
                  <Icon name="alertTriangle" size={16} />
                  <span>Physical Inventory Evacuation Required</span>
                </div>
                <p className="text-xs text-studio-300 leading-relaxed">
                  Store <strong className="text-white">"{location.name}"</strong> currently holds{' '}
                  <strong className="text-gold-400 font-mono font-bold">{totalUnitsOnHand} physical units</strong>{' '}
                  across <strong className="text-white font-mono">{remainingSkusCount} SKUs</strong>.
                </p>
                <p className="text-[11px] text-studio-400 font-mono">
                  Before deletion, all remaining physical units will be transferred to your selected destination store with signed dual-entry movement records in the audit ledger.
                </p>
              </div>

              {/* Destination Selector */}
              <div>
                <label className="block font-mono text-studio-400 mb-1.5">
                  Evacuate All Remaining Stock To *
                </label>
                <select
                  value={selectedDestId}
                  onChange={(e) => setTargetDestId(e.target.value)}
                  className="w-full bg-studio-900 border border-gold-500/40 text-gold-400 rounded-xl p-2.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-gold-500 shadow-sm cursor-pointer"
                >
                  {otherLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code}) — {l.type}
                    </option>
                  ))}
                </select>
                {selectedDest && (
                  <span className="text-[11px] font-mono text-studio-400 mt-1 block">
                    All {totalUnitsOnHand} units will be transferred to{' '}
                    <strong className="text-white">{selectedDest.name}</strong>.
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* Zero Stock - Safe Deletion */
            <div className="p-4 rounded-xl bg-studio-900/60 border border-white/5 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-sm text-emerald-400">
                <Icon name="checkCircle" size={16} />
                <span>Zero Physical Units Remaining</span>
              </div>
              <p className="text-xs text-studio-300">
                Store "{location.name}" has 0 units in physical inventory. It can be safely decommissioned immediately.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-studio-300 hover:text-white transition-all text-xs font-semibold"
            >
              Cancel
            </button>

            {!location.isDefault && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || (totalUnitsOnHand > 0 && !selectedDestId)}
                className="px-5 py-2.5 bg-crimson-600 hover:bg-crimson-500 text-white font-bold rounded-xl text-xs shadow-md shadow-crimson-500/20 transition-all flex items-center space-x-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Icon name="trash" size={13} />
                <span>
                  {isDeleting
                    ? 'Evacuating & Decommissioning...'
                    : totalUnitsOnHand > 0
                    ? `Evacuate ${totalUnitsOnHand} Units & Delete Store`
                    : 'Decommission Store Node'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
