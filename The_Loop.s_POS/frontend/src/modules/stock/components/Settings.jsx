import React, { useState } from 'react';
import Icon from './Icon';

export default function Settings({
  attributes = [],
  locations = [],
  categories = [],
  products = [],
  onAddCategory,
  onDeleteCategory,
  settings = {},
  onAddLocation,
  onRequestDeleteLocation,
  theme = 'dark',
  onToggleTheme,
  onResetToScratch,
  onAddAttribute,
  onSaveToast
, onRefresh}) {
  const [newAttrName, setNewAttrName] = useState('');
  const [newCatName, setNewCatName] = useState('');

  // New Location Form State
  const [locName, setLocName] = useState('');
  const [locCode, setLocCode] = useState('');
  const [locType, setLocType] = useState('STORE');
  const [locAddress, setLocAddress] = useState('');
  const [isSubmittingLoc, setIsSubmittingLoc] = useState(false);

  // Store Headquarters (HQ) Management State
  const [isChangeHqOpen, setIsChangeHqOpen] = useState(false);
  const currentHq = locations.find(l => l.is_hq || l.isHq || l.is_default || l.isDefault) || locations[0];
  const [selectedNewHqId, setSelectedNewHqId] = useState(locations.find(l => (l.is_hq || l.isHq || l.is_default || l.isDefault))?.id || locations[0]?.id || '');
  const [isSubmittingHq, setIsSubmittingHq] = useState(false);
  const [hqError, setHqError] = useState('');
  const [showHqHistory, setShowHqHistory] = useState(false);
  const [hqAuditLogs, setHqAuditLogs] = useState([]);

  const fetchHqLogs = async () => {
    try {
      const res = await fetch('/api/stores/hq');
      if (res.ok) {
        const data = await res.json();
        if (data.history) setHqAuditLogs(data.history);
      }
    } catch (e) {}
  };

  const handleSwitchHqSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedNewHqId || selectedNewHqId === currentHq?.id) return;

    setIsSubmittingHq(true);
    setHqError('');

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null;
      const res = await fetch('/api/stores/switch-hq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ targetStoreId: selectedNewHqId })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to switch Headquarters');
      }

      if (onSaveToast) onSaveToast(data.message || 'Headquarters successfully updated!', 'emerald');
      setIsChangeHqOpen(false);
      fetchHqLogs();
      if (onRefresh) onRefresh();
    } catch (err) {
      setHqError(err.message);
    } finally {
      setIsSubmittingHq(false);
    }
  };


  const handleAdd = () => {
    if (!newAttrName.trim()) return;
    onAddAttribute(newAttrName.trim());
    setNewAttrName('');
  };

  const handleAddCategorySubmit = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    try {
      if (onAddCategory) await onAddCategory(trimmed);
      setNewCatName('');
    } catch (e) {
      if (onSaveToast) onSaveToast(e.message, 'rose');
    }
  };

  const handleDeleteCategoryClick = async (catIdentifier) => {
    if (!confirm(`Are you sure you want to remove category "${catIdentifier}"?`)) return;
    try {
      if (onDeleteCategory) await onDeleteCategory(catIdentifier);
    } catch (e) {
      if (onSaveToast) onSaveToast(e.message, 'rose');
    }
  };

  // Derive categories dynamically from backend state and product assignments (No hardcoded defaults)
  const allCategoriesList = Array.from(new Set([
    ...(categories || []).map(c => typeof c === 'string' ? c : c.name),
    ...(products || []).map(p => p.category).filter(Boolean)
  ])).filter(Boolean).sort((a, b) => a.localeCompare(b));

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!locName.trim() || !locCode.trim()) {
      alert('Please provide both branch name and branch code.');
      return;
    }
    try {
      setIsSubmittingLoc(true);
      await onAddLocation({
        name: locName.trim(),
        code: locCode.trim().toUpperCase(),
        type: locType,
        address: locAddress.trim()
      });
      setLocName('');
      setLocCode('');
      setLocType('STORE');
      setLocAddress('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingLoc(false);
    }
  };

  return (
    <section className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-white flex items-center space-x-2">
            <Icon name="settings" size={22} className="text-gold-400" />
            <span>Platform Settings & Attribute Studio</span>
          </h2>
          <p className="text-xs text-studio-400 mt-0.5">
            Configure business identity, currency, interface theme mode, and dynamic variant attributes.
          </p>
        </div>
      </div>

      {/* Appearance & Theme Selector */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/10 shadow-sm">
        <div>
          <h3 className="font-display font-bold text-sm text-white flex items-center space-x-2">
            <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={15} className="text-gold-400" />
            <span>Interface Appearance</span>
          </h3>
          <p className="text-xs text-studio-400 mt-0.5">
            Toggle between Dark Obsidian Studio mode and Luxury Porcelain Light mode.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-studio-900/90 p-1.5 rounded-xl border border-white/10 shadow-sm">
          <button
            onClick={() => theme !== 'dark' && onToggleTheme()}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all ${
              theme === 'dark'
                ? 'bg-gold-500 text-studio-950 font-bold shadow-md shadow-gold-500/20'
                : 'text-studio-400 hover:text-white'
            }`}
          >
            <Icon name="moon" size={14} />
            <span>Dark Mode</span>
          </button>
          <button
            onClick={() => theme !== 'light' && onToggleTheme()}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all ${
              theme === 'light'
                ? 'bg-gold-500 text-studio-950 font-bold shadow-md shadow-gold-500/20'
                : 'text-studio-400 hover:text-white'
            }`}
          >
            <Icon name="sun" size={14} />
            <span>Light Mode</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Settings */}
        <div className="glass-panel p-6 rounded-2xl space-y-4 border border-white/10 shadow-sm">
          <h3 className="font-display font-bold text-base text-white pb-2 border-b border-white/10 flex items-center space-x-2">
            <Icon name="building" size={16} className="text-gold-400" />
            <span>Business Identity & Currency</span>
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-mono text-studio-400 mb-1">Business Name</label>
              <input
                type="text"
                defaultValue={settings?.businessName || 'The Loops Retail Group'}
                key={`bname-${settings?.businessName}`}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white font-semibold focus:outline-none focus:border-gold-500 shadow-sm"
              />
            </div>
            {settings?.ownerName && (
              <div>
                <label className="block font-mono text-studio-400 mb-1">Store User / Manager</label>
                <input
                  type="text"
                  defaultValue={settings.ownerName}
                  key={`owner-${settings.ownerName}`}
                  className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-gold-500 shadow-sm"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-studio-400 mb-1">Base Currency</label>
                <select
                  defaultValue={settings?.currency || 'USD'}
                  key={`curr-${settings?.currency}`}
                  className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-gold-500 shadow-sm cursor-pointer"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                  <option value="THB">THB (฿)</option>
                  <option value="SGD">SGD (S$)</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-studio-400 mb-1">Default Tax Rate (%)</label>
                <input
                  type="number"
                  defaultValue={settings?.taxRate !== undefined ? settings.taxRate : 7.5}
                  key={`tax-${settings?.taxRate}`}
                  step="0.1"
                  className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-gold-500 shadow-sm"
                />
              </div>
            </div>
            <div>
              <label className="block font-mono text-studio-400 mb-1">SKU Prefix</label>
              <input
                type="text"
                defaultValue={settings?.skuPrefix || 'LP'}
                key={`prefix-${settings?.skuPrefix}`}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white font-mono uppercase focus:outline-none focus:border-gold-500 shadow-sm"
              />
            </div>
          </div>
          <button
            onClick={() => onSaveToast && onSaveToast('Business configuration saved!')}
            className="w-full py-2.5 bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold text-xs rounded-xl transition-all mt-2 shadow-sm active:scale-95"
          >
            Save Business Configuration
          </button>
        </div>

        {/* Dynamic Attributes */}
        <div className="glass-panel p-6 rounded-2xl space-y-4 border border-white/10 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h3 className="font-display font-bold text-base text-white flex items-center space-x-2">
              <Icon name="layers" size={16} className="text-gold-400" />
              <span>Configurable Product Attributes</span>
            </h3>
            <span className="text-[10px] font-mono text-gold-400 font-semibold">Dynamic & Agnostic</span>
          </div>
          <p className="text-xs text-studio-400">
            Define unlimited retail attributes (e.g. Size, Color, Material, Model, Finish) without modifying the database schema.
          </p>

          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {attributes.map((attr) => (
              <div key={attr.id} className="p-3 bg-studio-900/60 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-xs text-white">{attr.name}</span>
                  <span className="text-[10px] font-mono text-studio-400">{attr.values.length} values</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {attr.values.map((v, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-studio-300 font-mono border border-white/10">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex space-x-2 pt-2 border-t border-white/10">
            <input
              type="text"
              placeholder="e.g. Compatibility, Capacity, Shade"
              value={newAttrName}
              onChange={(e) => setNewAttrName(e.target.value)}
              className="bg-studio-900 border border-white/10 rounded-lg p-2 text-xs text-white flex-1 focus:outline-none focus:border-gold-500 shadow-sm"
            />
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold text-xs rounded-xl transition-all shadow-sm active:scale-95"
            >
              Add Attribute
            </button>
          </div>
        </div>
      </div>

      {/* Product Categories Management */}
      <div className="glass-panel p-6 rounded-2xl space-y-4 border border-white/10 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 className="font-display font-bold text-base text-white flex items-center space-x-2">
              <Icon name="tag" size={17} className="text-gold-400" />
              <span>Product Categories Management</span>
            </h3>
            <p className="text-xs text-studio-400 mt-0.5">
              Create product categories and remove unused categories. Categories with active products are protected from deletion.
            </p>
          </div>
          <span className="text-xs font-mono text-gold-400 bg-gold-500/10 px-3 py-1 rounded-full border border-gold-500/20">
            {allCategoriesList.length} Categories
          </span>
        </div>

        {/* Add Category Form */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Footwear, Watches, Coffee Beans, Accessories..."
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategorySubmit()}
            className="bg-studio-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white flex-1 focus:outline-none focus:border-gold-500 shadow-sm"
          />
          <button
            onClick={handleAddCategorySubmit}
            className="px-4 py-2 bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-gold-500/20 active:scale-95 flex items-center space-x-1.5"
          >
            <Icon name="plus" size={13} />
            <span>Add Category</span>
          </button>
        </div>

        {/* Categories List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-2">
          {allCategoriesList.map((catName) => {
            const count = (products || []).filter(p => (p.category || '').toLowerCase() === catName.toLowerCase()).length;
            const isProtected = count > 0;
            return (
              <div
                key={catName}
                className="p-3 bg-studio-900/60 rounded-xl border border-white/5 flex items-center justify-between hover:border-white/15 transition group"
              >
                <div>
                  <div className="font-display font-bold text-xs text-white group-hover:text-gold-400 transition">
                    {catName}
                  </div>
                  <div className="text-[10px] font-mono text-studio-400 mt-0.5">
                    {count} {count === 1 ? 'product' : 'products'}
                  </div>
                </div>

                {isProtected ? (
                  <span 
                    className="text-[10px] font-mono text-studio-500 bg-white/5 px-2 py-0.5 rounded cursor-not-allowed"
                    title={`Protected: ${count} product(s) in this category`}
                  >
                    In Use
                  </span>
                ) : (
                  <button
                    onClick={() => handleDeleteCategoryClick(catName)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-studio-400 hover:text-rose-400 transition"
                    title={`Delete category "${catName}"`}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Branch & Store Locations Management */}
      <div className="glass-panel p-6 rounded-2xl space-y-6 border border-white/10 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 className="font-display font-bold text-base text-white flex items-center space-x-2">
              <Icon name="locations" size={17} className="text-gold-400" />
              <span>Branch & Store Locations</span>
            </h3>
            <p className="text-xs text-studio-400 mt-0.5">
              Add new branch locations for multi-store retail tracking. To decommission a store, all remaining physical stock will be safely transferred to another branch.
            </p>
          </div>
        </div>

        {/* Add Branch Inline Form */}
        <form onSubmit={handleCreateBranch} className="p-4 bg-studio-900/60 rounded-xl border border-white/5 space-y-3">
          <span className="font-display font-bold text-xs text-gold-400 uppercase tracking-wider block">
            Add New Retail Storefront or Warehouse
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-mono text-studio-400 mb-1">Store Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Westside Outpost"
                value={locName}
                onChange={(e) => setLocName(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-gold-500 shadow-sm"
              />
            </div>
            <div>
              <label className="block font-mono text-studio-400 mb-1">Store Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. STORE-03"
                value={locCode}
                onChange={(e) => setLocCode(e.target.value.toUpperCase())}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2 text-white font-mono uppercase focus:outline-none focus:border-gold-500 shadow-sm"
              />
            </div>
            <div>
              <label className="block font-mono text-studio-400 mb-1">Store Node Type</label>
              <select
                value={locType}
                onChange={(e) => setLocType(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-gold-500 shadow-sm cursor-pointer"
              >
                <option value="STORE">Retail Storefront</option>
                <option value="WAREHOUSE">Warehouse</option>
                <option value="OUTLET">Boutique</option>
                <option value="STORAGE_ROOM">Storage Room</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-studio-400 mb-1">Location Address</label>
              <input
                type="text"
                placeholder="e.g. 100 Main St"
                value={locAddress}
                onChange={(e) => setLocAddress(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-gold-500 shadow-sm"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmittingLoc}
              className="px-4 py-2 bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-gold-500/20 active:scale-95 disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Icon name="plus" size={13} />
              <span>{isSubmittingLoc ? 'Creating...' : 'Create Branch Node'}</span>
            </button>
          </div>
        </form>

        {/* Existing Locations Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {locations.map((loc) => {
            const typeColors = {
              STORE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
              WAREHOUSE: 'bg-gold-500/10 text-gold-400 border-gold-500/30',
              OUTLET: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
              STORAGE_ROOM: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
            };

            return (
              <div
                key={loc.id}
                className="p-4 bg-studio-900/60 rounded-xl border border-white/5 space-y-2.5 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-white/5 text-gold-400 border border-white/10">
                    {loc.code}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
                      typeColors[loc.type] || 'bg-white/5 text-studio-300 border-white/10'
                    }`}
                  >
                    {loc.type}
                  </span>
                </div>

                <div>
                  <h5 className="font-display font-bold text-sm text-white">{loc.name}</h5>
                  <p className="text-[11px] text-studio-400 font-mono mt-0.5">
                    {loc.address || 'Standard retail storage node'}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Operational</span>
                  </span>
                  <div className="flex items-center space-x-1.5">
                    {(loc.is_hq || loc.isHq || loc.is_default || loc.isDefault) ? (
                      <span className="text-gold-400 font-bold bg-gold-500/10 px-2 py-0.5 rounded border border-gold-500/20 flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
                        <span>Active HQ</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => onRequestDeleteLocation && onRequestDeleteLocation(loc)}
                        className="px-2 py-0.5 rounded text-[10px] text-studio-400 hover:text-crimson-400 hover:bg-crimson-500/10 transition-all flex items-center space-x-1 border border-white/5 hover:border-crimson-500/20"
                        title="Decommission & Delete Store"
                      >
                        <Icon name="trash" size={11} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    
      {/* Change HQ Confirmation Modal */}
      {isChangeHqOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="bg-studio-900 border border-gold-500/30 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20 flex items-center justify-center">
                  <Icon name="building" size={16} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-white">Change Store Headquarters (HQ)</h3>
                  <p className="text-[11px] text-studio-400">Designate a new central reference branch</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangeHqOpen(false)}
                className="p-1.5 rounded-lg text-studio-400 hover:text-white hover:bg-studio-800 transition"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-studio-950 border border-white/5 space-y-1">
                <span className="text-[10px] text-studio-500 uppercase font-mono">Current Headquarters:</span>
                <div className="font-bold text-white text-sm">{currentHq?.name || 'Main Branch'}</div>
                <div className="text-[11px] text-studio-400 font-mono">
                  ID: {currentHq?.id} • {currentHq?.address || 'Address not configured'}
                </div>
              </div>

              <div>
                <label className="block font-mono text-[11px] text-studio-300 uppercase tracking-wider mb-1.5">
                  Select New Headquarters Branch:
                </label>
                <select
                  value={selectedNewHqId}
                  onChange={(e) => setSelectedNewHqId(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-700 focus:border-gold-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none cursor-pointer font-sans"
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id} disabled={loc.id === currentHq?.id}>
                      {loc.name} ({loc.code || loc.id}) {loc.id === currentHq?.id ? '• [CURRENT ACTIVE HQ]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preservation Assurance */}
              <div className="p-3.5 rounded-xl bg-gold-500/5 border border-gold-500/20 space-y-1 text-[11px] text-studio-300">
                <div className="font-bold text-gold-400 flex items-center space-x-1.5">
                  <Icon name="checkCircle" size={13} />
                  <span>Branch Data Preservation Safeguard</span>
                </div>
                <p>
                  Changing Headquarters will update the central company reference. All branch inventory quantities, physical stock movements, sales transactions, Store IDs, and staff credentials remain 100% operational and unchanged.
                </p>
              </div>

              {hqError && (
                <div className="p-3 rounded-xl bg-crimson-500/10 border border-crimson-500/30 text-crimson-300 text-xs">
                  {hqError}
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangeHqOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-studio-800 hover:bg-studio-700 text-studio-300 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSwitchHqSubmit}
                  disabled={isSubmittingHq || !selectedNewHqId || selectedNewHqId === currentHq?.id}
                  className="flex-1 py-2.5 rounded-xl btn-gold text-studio-950 font-bold text-xs uppercase flex items-center justify-center space-x-1.5 shadow-lg shadow-gold-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingHq ? <span>Switching HQ...</span> : <span>Confirm & Switch HQ</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
