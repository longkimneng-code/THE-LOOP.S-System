import React, { useState } from 'react';
import { formatMoney } from '../api';
import Icon from './Icon';

const BASE_CATEGORIES = [
  'ALL',
  'Electronics',
  'Cosmetics',
  'Bags',
  'Jewelry',
  'Stationery',
  'Footwear',
  'Clothing',
  'Homeware'
];

export default function ProductCatalog({
  products = [],
  categories = [],
  balances = [],
  locations = [],
  activeLocationId = 'loc-1',
  onLocationChange,
  stockStatusFilter = 'ALL',
  onStockStatusFilterChange,
  onOpenNewProductModal,
  onInspectProduct,
  onEditProduct
}) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const activeLocation = (locations || []).find((l) => l.id === activeLocationId) ||
    locations[0] || { id: 'loc-1', name: 'Flagship Storefront', code: 'STORE-01' };

  // Calculate store-specific inventory for a product
  const getProductStoreStock = (p) => {
    let storeOnHand = 0;
    let totalAllStores = 0;
    let hasLowAtStore = false;
    let hasOosAtStore = false;

    (p.variants || []).forEach((v) => {
      totalAllStores += (v.onHand || 0);
      const b = (balances || []).find((item) => item.sku === v.sku && item.locationId === activeLocationId);
      const onHand = b ? (b.onHand || 0) : 0;
      const rop = b ? (b.rop || 5) : (v.rop || 5);

      storeOnHand += onHand;
      if (onHand <= rop && onHand > 0) hasLowAtStore = true;
      if (onHand === 0) hasOosAtStore = true;
    });

    return {
      storeOnHand,
      totalAllStores,
      hasLowAtStore,
      hasOosAtStore,
      isAllOosAtStore: storeOnHand === 0
    };
  };

  // Pre-calculate filter counts for the active store
  let countInStock = 0;
  let countLowStock = 0;
  let countOos = 0;

  products.forEach((p) => {
    const s = getProductStoreStock(p);
    if (s.storeOnHand > 0) countInStock++;
    if (s.hasLowAtStore) countLowStock++;
    if (s.isAllOosAtStore || s.hasOosAtStore) countOos++;
  });

  // Dynamically assemble all available categories
  const dynamicCategories = Array.from(
    new Set([
      ...BASE_CATEGORIES,
      ...(categories || []).map((c) => (typeof c === 'string' ? c : c.name)),
      ...(products || []).map((p) => p.category)
    ])
  );

  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      p.variants.some((v) => v.sku.toLowerCase().includes(q));

    const stockInfo = getProductStoreStock(p);
    let matchesStock = true;
    if (stockStatusFilter === 'IN_STOCK') {
      matchesStock = stockInfo.storeOnHand > 0;
    } else if (stockStatusFilter === 'LOW_STOCK') {
      matchesStock = stockInfo.hasLowAtStore;
    } else if (stockStatusFilter === 'OOS') {
      matchesStock = stockInfo.isAllOosAtStore || stockInfo.hasOosAtStore;
    }

    return matchesCat && matchesQuery && matchesStock;
  });

  return (
    <section className="space-y-6 animate-in fade-in duration-200">
      {/* Store Node Context & Quick Stock Status Filters */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl space-y-4 border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Active Store Indicator & Selector */}
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gold-500/10 text-gold-400 flex items-center justify-center">
              <Icon name="locations" size={16} />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-studio-400">Stocking Node:</span>
              <select
                value={activeLocationId}
                onChange={(e) => onLocationChange && onLocationChange(e.target.value)}
                className="bg-studio-900 border border-gold-500/30 text-gold-400 font-mono text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gold-500 cursor-pointer shadow-sm"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Store Stock Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <button
              onClick={() => onStockStatusFilterChange && onStockStatusFilterChange('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                stockStatusFilter === 'ALL'
                  ? 'bg-gold-500 text-studio-950 font-bold shadow-sm'
                  : 'bg-studio-900 text-studio-300 hover:text-white border border-white/5'
              }`}
            >
              All Products ({products.length})
            </button>

            <button
              onClick={() => onStockStatusFilterChange && onStockStatusFilterChange('IN_STOCK')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${
                stockStatusFilter === 'IN_STOCK'
                  ? 'bg-emerald-500 text-studio-950 font-bold shadow-sm'
                  : 'bg-studio-900 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>In Stock ({countInStock})</span>
            </button>

            <button
              onClick={() => onStockStatusFilterChange && onStockStatusFilterChange('LOW_STOCK')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${
                stockStatusFilter === 'LOW_STOCK'
                  ? 'bg-gold-500 text-studio-950 font-bold shadow-sm'
                  : 'bg-studio-900 text-gold-400 hover:text-gold-300 border border-gold-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-gold-400" />
              <span>Low Stock ({countLowStock})</span>
            </button>

            <button
              onClick={() => onStockStatusFilterChange && onStockStatusFilterChange('OOS')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${
                stockStatusFilter === 'OOS'
                  ? 'bg-crimson-500 text-white font-bold shadow-sm'
                  : 'bg-studio-900 text-crimson-400 hover:text-crimson-300 border border-crimson-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-crimson-400" />
              <span>Out of Stock ({countOos})</span>
            </button>
          </div>
        </div>

        {/* Active Filter Status Banner if filtered */}
        {stockStatusFilter !== 'ALL' && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-gold-500/10 border border-gold-500/20 text-xs font-mono">
            <span className="text-gold-400 flex items-center space-x-1.5">
              <Icon name="info" size={13} />
              <span>Filtered by:</span>
              <strong className="underline">
                {stockStatusFilter === 'LOW_STOCK' && 'Low Stock Products (< ROP)'}
                {stockStatusFilter === 'OOS' && 'Out of Stock Products (0 on hand)'}
                {stockStatusFilter === 'IN_STOCK' && 'In Stock Products'}
              </strong>
              <span>at {activeLocation.name}</span>
            </span>
            <button
              onClick={() => onStockStatusFilterChange && onStockStatusFilterChange('ALL')}
              className="text-studio-400 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-all flex items-center space-x-1"
            >
              <span>Clear Filter</span>
              <Icon name="close" size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Category Pills & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-white/10">
        <div className="flex flex-wrap items-center gap-1.5">
          {dynamicCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-gold-500 text-studio-950 font-bold shadow-sm'
                  : 'bg-studio-900 text-studio-300 hover:text-white border border-white/5'
              }`}
            >
              {cat === 'ALL' ? 'All Categories' : cat}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 sm:w-56 lg:w-64">
            <input
              type="text"
              placeholder="Search product, SKU, brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-studio-900 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-500 w-full shadow-sm"
              aria-label="Search products in catalog"
            />
            <span className="absolute left-2.5 top-2 text-studio-400 pointer-events-none">
              <Icon name="search" size={13} />
            </span>
          </div>

          <button
            onClick={onOpenNewProductModal}
            className="bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold px-3.5 py-1.5 rounded-lg text-xs tracking-wide flex items-center justify-center space-x-1.5 shadow-md shadow-gold-500/20 transition-all whitespace-nowrap active:scale-95"
          >
            <Icon name="plus" size={14} />
            <span>New Product</span>
          </button>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-studio-400 font-mono text-xs glass-panel rounded-2xl space-y-3">
            {products.length === 0 ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-gold-500/10 text-gold-400 flex items-center justify-center mx-auto">
                  <Icon name="catalog" size={24} />
                </div>
                <div className="text-sm font-display font-bold text-white">Your product catalog is empty</div>
                <p className="max-w-md mx-auto text-studio-400">
                  You are running in clean scratch mode. Click <span className="text-gold-400 font-bold">+ New Product</span> above to create your first item with auto-generated product codes and custom variants.
                </p>
                <div>
                  <button
                    onClick={onOpenNewProductModal}
                    className="px-4 py-2 bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold text-xs rounded-xl shadow-md shadow-gold-500/20 transition-all inline-flex items-center space-x-1.5"
                  >
                    <Icon name="plus" size={13} />
                    <span>Create First Product</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>No products match the selected filters for {activeLocation.name}.</div>
                {stockStatusFilter !== 'ALL' && (
                  <div className="mt-2">
                    <button
                      onClick={() => onStockStatusFilterChange && onStockStatusFilterChange('ALL')}
                      className="px-3 py-1 bg-gold-500 text-studio-950 rounded-lg font-bold text-xs"
                    >
                      Show All Products
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          filtered.map((p) => {
            const stockInfo = getProductStoreStock(p);

            return (
              <div
                key={p.id}
                className="glass-panel rounded-2xl overflow-hidden hover:border-gold-500/40 transition-all flex flex-col justify-between group shadow-sm hover:shadow-lg"
              >
                {/* Product Picture Container */}
                <div className="relative h-44 sm:h-48 w-full bg-studio-900 overflow-hidden flex items-center justify-center border-b border-white/5">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fallback = e.target.parentNode.querySelector('.img-fallback');
                        if (fallback) fallback.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`img-fallback w-full h-full flex flex-col items-center justify-center text-studio-400 space-y-1 bg-gradient-to-b from-white/5 to-transparent ${p.imageUrl ? 'hidden' : 'flex'}`}>
                    <Icon name="image" size={32} className="opacity-60 text-gold-400" />
                    <span className="text-[10px] font-mono text-studio-400">Physical Product</span>
                  </div>

                  {/* Code Badge Overlay */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-studio-950/85 backdrop-blur-md text-gold-400 border border-white/10 shadow">
                      {p.code}
                    </span>
                  </div>

                  {/* Status Pills Overlay for Active Store */}
                  <div className="absolute top-2.5 right-2.5 flex items-center space-x-1.5">
                    {stockInfo.isAllOosAtStore ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-crimson-500 text-white font-bold backdrop-blur-md shadow">
                        OOS at Store
                      </span>
                    ) : stockInfo.hasOosAtStore ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-crimson-500/90 text-white font-bold backdrop-blur-md shadow">
                        Partial OOS
                      </span>
                    ) : null}

                    {stockInfo.hasLowAtStore && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-gold-500 text-studio-950 font-bold backdrop-blur-md shadow">
                        Low Stock
                      </span>
                    )}

                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-studio-950/85 backdrop-blur-md text-studio-300 border border-white/10 uppercase">
                      {p.category}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-display font-bold text-base sm:text-lg text-white group-hover:text-gold-400 transition-colors">
                      {p.name}
                    </h3>
                    <p className="text-xs text-studio-400 line-clamp-2 mt-1">{p.description || ''}</p>

                    <div className="flex items-center space-x-3 mt-3 pt-3 border-t border-white/5 text-[11px] font-mono text-studio-400">
                      <span>Brand: <strong className="text-studio-200">{p.brand || 'Universal'}</strong></span>
                      <span>• Variants: <strong className="text-studio-200">{p.variants.length} SKU{p.variants.length > 1 ? 's' : ''}</strong></span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-white block">
                        <span className={stockInfo.storeOnHand === 0 ? 'text-crimson-400' : stockInfo.hasLowAtStore ? 'text-gold-400' : 'text-emerald-400'}>
                          {stockInfo.storeOnHand} {p.stockUnit}s
                        </span>
                        <span className="text-studio-400 font-normal"> at {activeLocation.code}</span>
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-mono text-emerald-400 font-semibold">{formatMoney(p.retailMinor)}</span>
                        <span className="text-[9px] font-mono text-studio-400">({stockInfo.totalAllStores} total)</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => onEditProduct(p)}
                        className="px-2.5 py-1.5 bg-studio-800 hover:bg-studio-700 text-studio-200 hover:text-white text-xs font-semibold rounded-lg border border-white/10 transition-all flex items-center space-x-1"
                        title="Edit this product"
                      >
                        <Icon name="edit" size={12} />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        onClick={() => onInspectProduct(p)}
                        className="px-3 py-1.5 bg-studio-800 hover:bg-gold-500 hover:text-studio-950 text-white text-xs font-semibold rounded-lg border border-white/10 transition-all flex items-center space-x-1"
                      >
                        <span>Details</span>
                        <Icon name="arrowRight" size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
