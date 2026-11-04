import React from 'react';
import { usePos } from '../context/PosContext';
import { useSync } from '../context/SyncContext';
import { Search, RefreshCw, Layers, Check, X, Tag, Sparkles } from 'lucide-react';

export default function ProductCatalogGrid() {
  const { 
    products, 
    categories, 
    selectedCategory, 
    setSelectedCategory, 
    searchQuery, 
    setSearchQuery,
    addToCart,
    selectedProductForVariant,
    setSelectedProductForVariant,
    formatPrice
  } = usePos();

  const { triggerManualSync, isSyncing } = useSync();

  // Filter products by category and search
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCategory;

    const matchesName = p.name?.toLowerCase().includes(q);
    const matchesCode = p.code?.toLowerCase().includes(q);
    const matchesBarcode = p.barcode?.toLowerCase().includes(q);
    const matchesSku = (p.variants || []).some(v => v.sku?.toLowerCase().includes(q) || v.barcode?.toLowerCase().includes(q));

    return matchesCategory && (matchesName || matchesCode || matchesBarcode || matchesSku);
  });

  const handleCardClick = (product) => {
    if (product.variants && product.variants.length > 1) {
      setSelectedProductForVariant(product);
    } else {
      addToCart(product, product.variants?.[0] || null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-obsidian-950">
      {/* Top Search & Filter Bar */}
      <div className="p-4 border-b border-obsidian-800 space-y-3">
        <div className="flex items-center space-x-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product, SKU, or scan barcode... [F3]"
              className="w-full bg-obsidian-900 border border-obsidian-700/80 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brass-500/70 focus:ring-1 focus:ring-brass-500/40 transition-all font-sans"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sync Stock Button */}
          <button
            onClick={triggerManualSync}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 text-xs font-medium text-slate-300 hover:text-brass-400 transition-colors disabled:opacity-50"
            title="Sync products and stock with Stock Management Loops (Port 3000)"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-brass-400' : ''}`} />
            <span className="hidden sm:inline">Sync Stock</span>
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-brass-500 text-obsidian-950 font-semibold shadow-sm'
                : 'bg-obsidian-900 text-slate-400 hover:text-slate-200 border border-obsidian-800'
            }`}
          >
            All Products
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-brass-500 text-obsidian-950 font-semibold shadow-sm'
                  : 'bg-obsidian-900 text-slate-400 hover:text-slate-200 border border-obsidian-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Cards Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
            <Tag className="w-8 h-8 text-slate-600" />
            <p className="text-sm">No items found matching your filter</p>
            <button 
              onClick={() => { setSelectedCategory('ALL'); setSearchQuery(''); }}
              className="text-xs text-brass-400 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map(product => {
              const variantCount = (product.variants || []).length;
              const totalAvailable = (product.variants || []).reduce((acc, v) => acc + (v.available || 0), 0);
              const isOOS = totalAvailable <= 0 && variantCount > 0;
              const displayPrice = product.variants?.[0]?.price || product.basePrice || 25.00;

              return (
                <button
                  key={product.id}
                  onClick={() => handleCardClick(product)}
                  className="group relative flex flex-col justify-between p-3.5 rounded-xl bg-obsidian-900/90 hover:bg-obsidian-850 border border-obsidian-800 hover:border-obsidian-600 text-left transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  {/* Top: Category & Availability Badge */}
                  <div className="flex items-start justify-between w-full mb-2">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider bg-obsidian-950 px-1.5 py-0.5 rounded border border-obsidian-800">
                      {product.category || 'General'}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        isOOS
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : totalAvailable < 5
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {isOOS ? 'OOS' : `${totalAvailable} avail`}
                    </span>
                  </div>

                  {/* Middle: Image Thumbnail, Title & SKU */}
                  <div className="my-1.5 flex items-start space-x-2.5">
                    {product.imageUrl && (product.imageUrl.startsWith('http') || product.imageUrl.startsWith('data:') || product.imageUrl.startsWith('/')) ? (
                      <img 
                        src={product.imageUrl} 
                        alt={product.name} 
                        className="w-11 h-11 object-cover rounded-lg border border-obsidian-750 shrink-0 bg-obsidian-950" 
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-obsidian-800 flex items-center justify-center text-lg shrink-0">
                        {product.image || '🏷️'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200 group-hover:text-brass-300 line-clamp-2 transition-colors">
                        {product.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {product.code}
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Price in selected currency & Variant Indicator */}
                  <div className="flex items-center justify-between w-full mt-3 pt-2 border-t border-obsidian-800/60">
                    <div className="text-xs font-semibold font-mono text-slate-100 group-hover:text-brass-400">
                      {formatPrice(displayPrice)}
                    </div>
                    {variantCount > 1 ? (
                      <span className="flex items-center space-x-1 text-[11px] text-slate-400 bg-obsidian-800 px-2 py-0.5 rounded-md">
                        <Layers className="w-3 h-3 text-brass-500" />
                        <span>{variantCount} vars</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 group-hover:text-slate-200">
                        + Add
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Variant Matrix Touch Modal */}
      {selectedProductForVariant && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-900 border border-obsidian-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-obsidian-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-brass-400 uppercase tracking-wider">Select Variant</div>
                <h3 className="text-base font-semibold text-slate-100">{selectedProductForVariant.name}</h3>
              </div>
              <button
                onClick={() => setSelectedProductForVariant(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Variants Grid */}
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2.5">
              {(selectedProductForVariant.variants || []).map(v => {
                const isOutOfStock = (v.available || 0) <= 0;
                return (
                  <button
                    key={v.sku}
                    disabled={isOutOfStock}
                    onClick={() => {
                      addToCart(selectedProductForVariant, v);
                      setSelectedProductForVariant(null);
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 hover:border-brass-500/50 disabled:opacity-40 disabled:hover:border-obsidian-700 transition-all text-left group"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-100 group-hover:text-brass-300">
                        {v.title}
                      </div>
                      <div className="text-xs font-mono text-slate-500 mt-0.5">
                        SKU: {v.sku} • Barcode: {v.barcode || '—'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold font-mono text-slate-100 group-hover:text-brass-400">
                        ${Number(v.price).toFixed(2)}
                      </div>
                      <div
                        className={`text-[11px] font-mono mt-0.5 ${
                          isOutOfStock ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isOutOfStock ? 'Out of Stock' : `${v.available || 0} in stock`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

