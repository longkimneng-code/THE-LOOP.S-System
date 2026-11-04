import React, { useState } from 'react';
import Icon from './Icon';

export default function AddLocationModal({
  isOpen,
  onClose,
  onAddLocation
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('STORE');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      alert('Please provide both store name and code.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddLocation({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type,
        address: address.trim()
      });
      setName('');
      setCode('');
      setType('STORE');
      setAddress('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-studio-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="glass-panel-elevated w-full max-w-lg rounded-2xl overflow-hidden flex flex-col border border-white/15 shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-studio-900/60">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gold-500/10 text-gold-400 flex items-center justify-center">
              <Icon name="locations" size={16} />
            </div>
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg text-white">
                Register New Branch Location
              </h3>
              <p className="text-[11px] text-studio-400 font-mono">Create store node with zero-balance ledger matrix</p>
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

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          <div>
            <label className="block font-mono text-studio-400 mb-1">Branch / Store Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Downtown Boutique, North Logistics Hub"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-gold-500 shadow-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-studio-400 mb-1">Store Code (Unique) *</label>
              <input
                type="text"
                required
                placeholder="e.g. STORE-02, WH-NORTH"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white font-mono uppercase focus:outline-none focus:border-gold-500 shadow-sm"
              />
            </div>
            <div>
              <label className="block font-mono text-studio-400 mb-1">Store Node Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-gold-500 shadow-sm cursor-pointer"
              >
                <option value="STORE">Retail Storefront</option>
                <option value="WAREHOUSE">Distribution Warehouse</option>
                <option value="OUTLET">Boutique / Outpost</option>
                <option value="STORAGE_ROOM">Storage Room / Facility</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-mono text-studio-400 mb-1">Location Address</label>
            <input
              type="text"
              placeholder="e.g. 100 Main St, Suite 400, Chicago, IL"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-gold-500 shadow-sm"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-studio-300 hover:text-white transition-all text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold rounded-xl text-xs shadow-md shadow-gold-500/20 transition-all flex items-center space-x-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Icon name="plus" size={14} />
              <span>{isSubmitting ? 'Registering...' : 'Register Location'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
