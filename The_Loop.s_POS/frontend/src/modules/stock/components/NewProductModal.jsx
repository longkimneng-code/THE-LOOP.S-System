import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import ProductImageUploader from '../../../components/common/ProductImageUploader';

const DEFAULT_CATEGORIES = [
  'Electronics',
  'Cosmetics',
  'Bags',
  'Jewelry',
  'Stationery',
  'Footwear',
  'Clothing',
  'Homeware'
];

const PRESET_PICS = [
  { label: 'Tech', url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=600&auto=format&fit=crop&q=80' },
  { label: 'Bag', url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80' },
  { label: 'Beauty', url: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600&auto=format&fit=crop&q=80' },
  { label: 'Jewelry', url: 'https://images.unsplash.com/photo-1611591475155-426c043e4079?w=600&auto=format&fit=crop&q=80' },
  { label: 'Notebook', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80' },
  { label: 'Sneakers', url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=80' },
  { label: 'Apparel', url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80' },
  { label: 'Mug', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80' }
];

// Helper: 3-letter uppercase prefix from category
export const getCategoryShortCode = (categoryName) => {
  if (!categoryName) return 'GEN';
  const clean = categoryName.trim().replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (clean.length >= 3) return clean.substring(0, 3);
  return clean.padEnd(3, 'X');
};

// Helper: Auto-generate [CAT]-0001 to [CAT]-1000
export const generateNextProductCode = (categoryName, products = []) => {
  const prefix = getCategoryShortCode(categoryName);
  const regex = new RegExp(`^${prefix}-(\\d{4})$`, 'i');
  const usedNumbers = new Set();

  (products || []).forEach((p) => {
    if (p.code) {
      const match = p.code.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) usedNumbers.add(num);
      }
    }
  });

  for (let i = 1; i <= 1000; i++) {
    if (!usedNumbers.has(i)) {
      return `${prefix}-${String(i).padStart(4, '0')}`;
    }
  }
  return `${prefix}-1001`;
};

export default function NewProductModal({
  isOpen,
  onClose,
  onSave,
  editingProduct = null,
  categories = [],
  onAddCategory,
  existingProducts = []
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [brand, setBrand] = useState('');
  const [stockUnit, setStockUnit] = useState('piece');
  const [imageUrl, setImageUrl] = useState('');
  const [cost, setCost] = useState('15.00');
  const [retail, setRetail] = useState('39.00');
  const [description, setDescription] = useState('');
  const [hasVariants, setHasVariants] = useState(false);
  
  // Structured variants array: each variant has its own title, SKU, cost, and retail price
  const [variantsList, setVariantsList] = useState([]);

  // Add Category inline input state
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Merged unique categories list
  const categoryNames = Array.from(
    new Set([
      ...DEFAULT_CATEGORIES,
      ...(categories || []).map((c) => (typeof c === 'string' ? c : c.name))
    ])
  );

  // Initialize or Reset form based on create vs edit mode
  useEffect(() => {
    if (!isOpen) return;

    if (editingProduct) {
      // EDIT MODE: Populate with existing product data
      setCode(editingProduct.code || '');
      setName(editingProduct.name || '');
      setCategory(editingProduct.category || categoryNames[0] || 'Electronics');
      setBrand(editingProduct.brand || '');
      setStockUnit(editingProduct.stockUnit || 'piece');
      setImageUrl(editingProduct.imageUrl || '');
      setCost(((editingProduct.costMinor || 0) / 100).toFixed(2));
      setRetail(((editingProduct.retailMinor || 0) / 100).toFixed(2));
      setDescription(editingProduct.description || '');
      setHasVariants(!!editingProduct.hasVariants);

      if (editingProduct.variants && editingProduct.variants.length > 0) {
        setVariantsList(
          editingProduct.variants.map((v, i) => ({
            id: 'var-' + i + '-' + Date.now(),
            title: v.title || `Variant ${i + 1}`,
            sku: v.sku || `${editingProduct.code}-V${i + 1}`,
            cost: ((v.costMinor !== undefined ? v.costMinor : editingProduct.costMinor || 0) / 100).toFixed(2),
            retail: ((v.retailMinor !== undefined ? v.retailMinor : editingProduct.retailMinor || 0) / 100).toFixed(2),
            rop: v.rop || 5,
            onHand: v.onHand || 0,
            barcode: v.barcode || ''
          }))
        );
      } else {
        setVariantsList([]);
      }
    } else {
      // CREATE MODE: Auto-generate code from category (0001 to 1000)
      const initialCat = categoryNames[0] || 'Electronics';
      setCategory(initialCat);
      const generated = generateNextProductCode(initialCat, existingProducts);
      setCode(generated);
      setName('');
      setBrand('');
      setStockUnit('piece');
      setImageUrl('');
      setCost('15.00');
      setRetail('39.00');
      setDescription('');
      setHasVariants(false);
      setVariantsList([
        {
          id: 'var-1',
          title: 'Option A (Standard)',
          sku: `${generated}-V1`,
          cost: '15.00',
          retail: '39.00',
          rop: 5
        },
        {
          id: 'var-2',
          title: 'Option B (Deluxe)',
          sku: `${generated}-V2`,
          cost: '18.00',
          retail: '49.00',
          rop: 5
        }
      ]);
    }
  }, [isOpen, editingProduct]);

  if (!isOpen) return null;

  // Handle Category Change: Auto-generate new code if creating
  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    if (!editingProduct) {
      const nextCode = generateNextProductCode(newCat, existingProducts);
      setCode(nextCode);
      // Also update SKU suggestions for variants
      setVariantsList((prev) =>
        prev.map((v, i) => ({
          ...v,
          sku: `${nextCode}-V${i + 1}`
        }))
      );
    }
  };

  // Re-generate product code manually
  const handleRegenerateCode = () => {
    const nextCode = generateNextProductCode(category, existingProducts);
    setCode(nextCode);
  };

  // Submit New Category Inline
  const handleSaveNewCategory = async (e) => {
    e?.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    try {
      if (onAddCategory) {
        await onAddCategory(trimmed);
      }
      handleCategoryChange(trimmed);
      setNewCatName('');
      setIsAddingCategory(false);
    } catch (err) {
      console.error(err);
    }
  };

  // File Upload to Data URL
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setImageUrl(uploadEvent.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Variant Management Helpers
  const handleAddVariantRow = () => {
    const nextIndex = variantsList.length + 1;
    const currentCode = code.trim().toUpperCase() || 'PRD';
    setVariantsList((prev) => [
      ...prev,
      {
        id: 'var-' + Date.now() + '-' + nextIndex,
        title: `Variant ${nextIndex}`,
        sku: `${currentCode}-V${nextIndex}`,
        cost: cost || '15.00',
        retail: retail || '39.00',
        rop: 5
      }
    ]);
  };

  const handleUpdateVariantField = (index, field, value) => {
    setVariantsList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveVariantRow = (index) => {
    setVariantsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSyncBasePricesToAllVariants = () => {
    setVariantsList((prev) =>
      prev.map((v) => ({
        ...v,
        cost: cost || '0.00',
        retail: retail || '0.00'
      }))
    );
  };

  // Form Submission
  const handleSubmit = (e) => {
    e.preventDefault();
    const costMinor = Math.round(parseFloat(cost || '0') * 100);
    const retailMinor = Math.round(parseFloat(retail || '0') * 100);
    const cleanCode = code.trim().toUpperCase();

    let formattedVariants = [];
    if (hasVariants && variantsList.length > 0) {
      formattedVariants = variantsList.map((v, i) => ({
        sku: (v.sku || `${cleanCode}-V${i + 1}`).trim().toUpperCase(),
        title: v.title.trim() || `Variant ${i + 1}`,
        costMinor: Math.round(parseFloat(v.cost || cost || '0') * 100),
        retailMinor: Math.round(parseFloat(v.retail || retail || '0') * 100),
        onHand: v.onHand || 0,
        rop: parseInt(v.rop || 5, 10),
        barcode: v.barcode || ''
      }));
    }

    const payload = {
      code: cleanCode,
      name: name.trim(),
      category,
      brand: brand.trim() || 'General',
      stockUnit,
      imageUrl: imageUrl.trim(),
      costMinor,
      retailMinor,
      description: description.trim(),
      hasVariants,
      variants: formattedVariants
    };

    onSave(payload, editingProduct?.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-studio-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="glass-panel-elevated w-full max-w-3xl max-h-[92vh] rounded-2xl overflow-hidden flex flex-col border border-white/15 animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-studio-900/60">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-gold-500/20 text-gold-400 border border-gold-500/30 uppercase">
                {editingProduct ? 'Edit Existing Product' : 'Universal Product Catalog'}
              </span>
            </div>
            <h3 className="font-display font-extrabold text-lg sm:text-xl text-white mt-1 flex items-center space-x-2">
              <Icon name={editingProduct ? 'edit' : 'plus'} size={18} className="text-gold-400" />
              <span>{editingProduct ? `Edit Product: ${editingProduct.name}` : 'Create New Retail Product'}</span>
            </h3>
            <p className="text-xs text-studio-400 mt-0.5">
              {editingProduct
                ? 'Update product specs, prices, images, and individual variant pricing.'
                : 'Supports single-unit items, custom categories, and separate multi-variant pricing.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-studio-400 hover:text-white flex items-center justify-center border border-white/10 transition-colors"
            aria-label="Close modal"
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 text-xs overflow-y-auto flex-1">
          {/* Top Row: Category Selection & Add Category Feature */}
          <div className="p-3.5 bg-studio-900/80 rounded-xl border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-mono text-studio-400 text-[11px] font-semibold uppercase flex items-center space-x-1.5">
                <Icon name="catalog" size={13} className="text-gold-400" />
                <span>Category (Short 3-Letter Code: <strong className="text-gold-400 font-bold">{getCategoryShortCode(category)}</strong>)</span>
              </label>
              {!isAddingCategory && (
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(true)}
                  className="px-2.5 py-0.5 bg-gold-500/20 hover:bg-gold-500 text-gold-400 hover:text-studio-950 rounded-lg text-[10px] font-mono font-bold border border-gold-500/30 transition-all flex items-center space-x-1"
                >
                  <Icon name="plus" size={10} />
                  <span>New Category</span>
                </button>
              )}
            </div>

            {/* Inline Add Category Input */}
            {isAddingCategory ? (
              <div className="p-2.5 bg-studio-950 rounded-lg border border-gold-500/40 space-y-2 animate-in fade-in">
                <span className="text-[11px] font-mono text-gold-400 block font-bold">
                  Create New Retail Category:
                </span>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="e.g. Watches, Gifts, Homeware..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 bg-studio-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveNewCategory}
                    className="px-3 py-1.5 bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold text-xs rounded transition-all"
                  >
                    Save Category
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCategory(false);
                      setNewCatName('');
                    }}
                    className="px-2 py-1.5 bg-studio-800 text-studio-300 hover:text-white text-xs rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white font-medium focus:outline-none focus:border-gold-500"
              >
                {categoryNames.map((c) => (
                  <option key={c} value={c}>
                    {c} (Prefix: {getCategoryShortCode(c)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Product Code & Product Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono text-studio-400 text-[11px] uppercase">
                  Product Code (Auto: 0001 - 1000)
                </label>
                {!editingProduct && (
                  <button
                    type="button"
                    onClick={handleRegenerateCode}
                    className="text-[10px] font-mono text-gold-400 hover:text-gold-300"
                    title="Re-generate next available code in category"
                  >
                    ↻ Re-roll
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. ELE-0001"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 font-mono text-white focus:outline-none focus:border-gold-500 font-bold tracking-wider"
                  required
                />
                <span className="absolute right-2.5 top-2.5 px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/5 text-studio-400 border border-white/10">
                  {code.substring(0, 3)}
                </span>
              </div>
            </div>

            <div>
              <label className="block font-mono text-studio-400 text-[11px] uppercase mb-1">Product Name</label>
              <input
                type="text"
                placeholder="e.g. MagSafe Armor Phone Case"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-gold-500 font-semibold"
                required
              />
            </div>
          </div>

          {/* Brand & Stock Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-studio-400 text-[11px] uppercase mb-1">Brand / Maker</label>
              <input
                type="text"
                placeholder="e.g. Aura Tech / Studio Craft"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-gold-500"
              />
            </div>
            <div>
              <label className="block font-mono text-studio-400 text-[11px] uppercase mb-1">Stock Unit</label>
              <select
                value={stockUnit}
                onChange={(e) => setStockUnit(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white font-mono"
              >
                <option value="piece">Piece / Unit</option>
                <option value="box">Box / Pack</option>
                <option value="set">Set</option>
                <option value="pair">Pair</option>
                <option value="bottle">Bottle</option>
              </select>
            </div>
          </div>

          {/* Base Pricing: Cost & Retail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-studio-900/50 rounded-xl border border-white/5">
            <div>
              <label className="block font-mono text-studio-400 text-[11px] uppercase mb-1">
                Base Unit Cost (COGS $ USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="15.00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 font-mono text-white focus:outline-none focus:border-gold-500"
                required
              />
            </div>
            <div>
              <label className="block font-mono text-studio-400 text-[11px] uppercase mb-1">
                Base Selling Retail Price ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="39.00"
                value={retail}
                onChange={(e) => setRetail(e.target.value)}
                className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 font-mono text-white focus:outline-none focus:border-gold-500 font-bold text-gold-400"
                required
              />
            </div>
          </div>

          {/* Product Picture Upload & Preview */}
          <div className="p-3.5 bg-studio-900/80 rounded-xl border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-mono text-studio-400 text-[11px] font-semibold uppercase flex items-center space-x-1.5">
                <Icon name="image" size={13} className="text-gold-400" />
                <span>Product Picture / Photo</span>
              </label>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-[10px] text-crimson-400 hover:text-crimson-300 font-mono flex items-center space-x-1"
                >
                  <Icon name="close" size={11} />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>

            <ProductImageUploader
              value={imageUrl}
              onChange={setImageUrl}
              className="mt-2"
            />
            
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              <span className="text-[10px] text-studio-400 font-mono">Sample Presets:</span>
              {PRESET_PICS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setImageUrl(p.url)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 hover:bg-gold-500/20 hover:text-gold-400 text-studio-300 border border-white/10 transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-mono text-studio-400 text-[11px] uppercase mb-1">Description / Notes</label>
            <textarea
              rows="2"
              placeholder="e.g. Ergonomic design, premium materials, high durability retail packaging."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-studio-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-gold-500"
            />
          </div>

          {/* Convenient Multi-Variant Management (Individual Rows & Prices) */}
          <div className="p-4 bg-studio-900/90 rounded-xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-white font-mono text-xs block">
                  Product Variant Management
                </span>
                <span className="text-[10px] text-studio-400">
                  {hasVariants
                    ? 'Each variant is added separately with its own title, unique SKU, and custom price.'
                    : 'Single item product: 1 default standard SKU will be generated.'}
                </span>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer bg-studio-950 px-3 py-1.5 rounded-lg border border-white/10">
                <input
                  type="checkbox"
                  checked={hasVariants}
                  onChange={(e) => setHasVariants(e.target.checked)}
                  className="rounded bg-studio-900 border-white/20 text-gold-500 focus:ring-0"
                />
                <span className="text-white text-xs font-semibold">Enable Variants</span>
              </label>
            </div>

            {hasVariants && (
              <div className="space-y-3 pt-3 border-t border-white/10">
                {/* Variant Table Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-gold-400 font-bold uppercase">
                    Configured Variants ({variantsList.length}):
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleSyncBasePricesToAllVariants}
                      className="px-2.5 py-1 bg-studio-800 hover:bg-studio-700 text-studio-200 rounded-lg text-[11px] font-mono border border-white/10 transition-all flex items-center space-x-1"
                      title="Set all variant prices equal to base product price"
                    >
                      <Icon name="zap" size={11} className="text-gold-400" />
                      <span>Sync Base Prices</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddVariantRow}
                      className="px-3 py-1 bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold rounded-lg text-[11px] font-mono transition-all flex items-center space-x-1"
                    >
                      <Icon name="plus" size={11} />
                      <span>Add Another Variant</span>
                    </button>
                  </div>
                </div>

                {/* Separate Variant Rows List */}
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {variantsList.map((variant, index) => (
                    <div
                      key={variant.id || index}
                      className="p-3 bg-studio-950/90 rounded-xl border border-white/10 space-y-2 hover:border-gold-500/30 transition-all shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/5 text-gold-400 border border-white/10">
                          Variant #{index + 1}
                        </span>
                        {variantsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVariantRow(index)}
                            className="text-studio-400 hover:text-crimson-400 text-xs px-2 py-0.5 rounded-lg hover:bg-white/5 transition-colors flex items-center space-x-1"
                            title="Remove this variant"
                          >
                            <Icon name="trash" size={11} />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        {/* Variant Title */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-mono text-studio-400 mb-0.5">
                            Option Title (Color / Size / Model / Finish)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Matte Black / 128GB"
                            value={variant.title}
                            onChange={(e) => handleUpdateVariantField(index, 'title', e.target.value)}
                            className="w-full bg-studio-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold-500"
                            required
                          />
                        </div>

                        {/* Variant SKU */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-mono text-studio-400 mb-0.5">
                            Unique Sellable SKU
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. ELE-0001-V1"
                            value={variant.sku}
                            onChange={(e) => handleUpdateVariantField(index, 'sku', e.target.value.toUpperCase())}
                            className="w-full bg-studio-900 border border-white/10 rounded px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-gold-500"
                            required
                          />
                        </div>

                        {/* Variant Cost Price */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-mono text-studio-400 mb-0.5">
                            Cost Price ($ USD)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={variant.cost}
                            onChange={(e) => handleUpdateVariantField(index, 'cost', e.target.value)}
                            className="w-full bg-studio-900 border border-white/10 rounded px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-gold-500"
                            required
                          />
                        </div>

                        {/* Variant Retail Price (Can Differ!) */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-mono text-gold-400 mb-0.5 font-bold">
                            Selling Price ($ USD - Can Differ)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={variant.retail}
                            onChange={(e) => handleUpdateVariantField(index, 'retail', e.target.value)}
                            className="w-full bg-studio-900 border border-gold-500/30 rounded px-2.5 py-1.5 font-mono text-xs text-gold-400 font-bold focus:outline-none focus:border-gold-500"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 bg-studio-800 hover:bg-studio-700 text-studio-300 font-semibold text-xs rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-2/3 py-2.5 bg-gold-500 hover:bg-gold-400 text-studio-950 font-display font-bold text-xs rounded-xl transition-all shadow-md shadow-gold-500/20 active:scale-[0.99]"
            >
              {editingProduct ? 'Save Changes' : 'Create Product & Save SKUs'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
