import React, { useState } from 'react';
import Icon from './Icon';

export default function OnboardingScreen({ onOnboard, theme = 'dark', onToggleTheme }) {
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [storeName, setStoreName] = useState('Flagship Storefront');
  const [storeCode, setStoreCode] = useState('STORE-01');
  const [storeType, setStoreType] = useState('STORE');
  const [storeAddress, setStoreAddress] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState('7.5');
  const [skuPrefix, setSkuPrefix] = useState('LP');
  const [includeStarterCategories, setIncludeStarterCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-suggest store code if user edits store name
  const handleStoreNameChange = (e) => {
    const val = e.target.value;
    setStoreName(val);
    if (!storeCode || storeCode.startsWith('STORE-') || storeCode.startsWith('LOC-')) {
      const initials = val
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 4);
      if (initials) {
        setStoreCode(`${initials}-01`);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!businessName.trim()) {
      setError('Please provide your business or brand name.');
      return;
    }
    if (!storeName.trim()) {
      setError('Please provide your primary store location name.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onOnboard({
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        storeName: storeName.trim(),
        storeCode: (storeCode || 'STORE-01').trim().toUpperCase(),
        storeType,
        storeAddress: storeAddress.trim(),
        currency,
        taxRate: parseFloat(taxRate) || 0,
        skuPrefix: (skuPrefix || 'LP').trim().toUpperCase(),
        includeStarterCategories
      });
    } catch (err) {
      setError(err.message || 'Failed to complete store registration');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-studio-950 text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden transition-colors">
      {/* Ambient background glow accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header / Bar */}
      <header className="relative z-10 flex items-center justify-between max-w-5xl mx-auto w-full pb-4 border-b border-white/5">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-gold-600 via-gold-500 to-gold-400 flex items-center justify-center font-display font-black text-studio-950 text-lg shadow-md shadow-gold-500/20">
            ∞
          </div>
          <div>
            <span className="font-display font-black text-base tracking-widest text-white uppercase block leading-none">
              The Loops
            </span>
            <span className="text-[9px] tracking-widest text-gold-400 uppercase font-mono block mt-0.5 font-semibold">
              Universal Retail OS
            </span>
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'Light Mode' : 'Dark Mode'}`}
          className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium border border-white/10 bg-studio-900/80 hover:bg-studio-800 text-studio-300 hover:text-white flex items-center space-x-1.5 transition-all shadow-sm"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </header>

      {/* Main Registration Card */}
      <main className="relative z-10 max-w-2xl mx-auto w-full my-6">
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl space-y-6">
          {/* Welcome Title */}
          <div className="text-center space-y-2 pb-2">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold bg-gold-500/10 text-gold-400 border border-gold-500/20">
              <Icon name="zap" size={13} className="text-gold-400" />
              <span>System Setup Wizard</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-white">
              Register Your Retail Store
            </h1>
            <p className="text-xs sm:text-sm text-studio-400 max-w-md mx-auto">
              Set up your business identity and primary store location to start testing from scratch. No password or login required.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-crimson-500/10 border border-crimson-500/30 text-crimson-400 rounded-xl text-xs font-mono flex items-center space-x-2">
              <Icon name="alertTriangle" size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Business Profile */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 pb-1.5 border-b border-white/5">
                <Icon name="building" size={15} className="text-gold-400" />
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-gold-400">
                  Business Identity
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-mono text-studio-400 mb-1">
                    Business / Company Name <span className="text-crimson-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Retail Group, Atelier Goods"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full bg-studio-900 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-studio-400 focus:outline-none focus:border-gold-500 font-sans shadow-sm"
                  />
                </div>
                <div>
                  <label className="block font-mono text-studio-400 mb-1">
                    Store Manager / User Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alex Morgan, Retail Lead"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full bg-studio-900 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-studio-400 focus:outline-none focus:border-gold-500 font-sans shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Primary Store Location */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 pb-1.5 border-b border-white/5">
                <Icon name="locations" size={15} className="text-gold-400" />
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-gold-400">
                  Primary Store Location
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-mono text-studio-400 mb-1">
                    Primary Store / Branch Name <span className="text-crimson-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Flagship Storefront, Downtown Boutique"
                    value={storeName}
                    onChange={handleStoreNameChange}
                    className="w-full bg-studio-900 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-studio-400 focus:outline-none focus:border-gold-500 font-sans shadow-sm"
                  />
                </div>
                <div>
                  <label className="block font-mono text-studio-400 mb-1">
                    Store Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. STORE-01"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                    className="w-full bg-studio-900 border border-white/10 rounded-lg px-3 py-2 text-white uppercase font-mono focus:outline-none focus:border-gold-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-mono text-studio-400 mb-1">Store Node Type</label>
                  <select
                    value={storeType}
                    onChange={(e) => setStoreType(e.target.value)}
                    className="w-full bg-studio-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold-500 font-mono shadow-sm cursor-pointer"
                  >
                    <option value="STORE">Retail Storefront</option>
                    <option value="WAREHOUSE">Central Warehouse</option>
                    <option value="OUTLET">Boutique / Outpost</option>
                    <option value="STORAGE_ROOM">Storage Facility</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-mono text-studio-400 mb-1">
                    Physical Address / City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 450 Broadway, Suite 10, New York, NY"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    className="w-full bg-studio-900 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-studio-400 focus:outline-none focus:border-gold-500 font-sans shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Financial & Inventory Configuration */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 pb-1.5 border-b border-white/5">
                <Icon name="settings" size={15} className="text-gold-400" />
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-gold-400">
                  Financial & SKU Settings
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-mono text-studio-400 mb-1">Base Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-studio-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold-500 font-mono shadow-sm cursor-pointer"
                  >
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                    <option value="JPY">JPY (¥) - Japanese Yen</option>
                    <option value="CAD">CAD ($) - Canadian Dollar</option>
                    <option value="AUD">AUD ($) - Australian Dollar</option>
                    <option value="THB">THB (฿) - Thai Baht</option>
                    <option value="SGD">SGD ($) - Singapore Dollar</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-studio-400 mb-1">Sales Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="7.5"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full bg-studio-900 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-gold-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block font-mono text-studio-400 mb-1">SKU Prefix</label>
                  <input
                    type="text"
                    maxLength={5}
                    placeholder="LP"
                    value={skuPrefix}
                    onChange={(e) => setSkuPrefix(e.target.value.toUpperCase())}
                    className="w-full bg-studio-900 border border-white/10 rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-gold-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Starter Categories Option */}
            <div className="p-3.5 bg-studio-900/60 rounded-xl border border-white/5 space-y-2">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeStarterCategories}
                  onChange={(e) => setIncludeStarterCategories(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 text-gold-500 focus:ring-gold-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-white block">
                    Include Starter Retail Categories
                  </span>
                  <span className="text-studio-400 block text-[11px] mt-0.5">
                    Pre-loads 8 clean universal categories: Clothing, Bags, Electronics, Cosmetics, Jewelry, Footwear, Stationery, Homeware. (You can also add custom categories anytime in the catalog).
                  </span>
                </div>
              </label>
            </div>

            {/* Launch Action */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-xl font-display font-extrabold text-sm bg-gradient-to-r from-gold-500 via-gold-400 to-gold-500 hover:from-gold-400 hover:to-gold-300 text-studio-950 shadow-lg shadow-gold-500/20 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin text-base">⏳</span>
                  <span>Initializing Your Platform...</span>
                </>
              ) : (
                <>
                  <Icon name="rocket" size={16} />
                  <span>Register Store & Launch Platform</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer Feature Badges */}
      <footer className="relative z-10 max-w-4xl mx-auto w-full pt-4 border-t border-white/5 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[11px] font-mono text-studio-400">
          <span className="flex items-center space-x-1.5">
            <Icon name="checkCircle" size={13} className="text-gold-400" />
            <span>Zero Seed Products</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <Icon name="checkCircle" size={13} className="text-gold-400" />
            <span>Append-Only Ledger</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <Icon name="checkCircle" size={13} className="text-gold-400" />
            <span>Multi-Location Engine</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <Icon name="checkCircle" size={13} className="text-gold-400" />
            <span>Ready for Scratch Testing</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
