import React, { useState, useEffect } from 'react';
import { 
  Tag, 
  Plus, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  RefreshCw,
  X,
  Layers,
  ArrowRightCircle,
  ShieldCheck
} from 'lucide-react';
import { api } from '../api';

export default function ProductCategoriesView({ onShowToast }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmCat, setDeleteConfirmCat] = useState(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await api.getCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load product categories:', err);
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleOpenCreate = () => {
    setForm({
      name: '',
      description: ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      if (onShowToast) onShowToast('Category name is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createCategory({
        name: form.name.trim(),
        description: form.description.trim()
      });
      if (onShowToast) onShowToast(`Category "${form.name.trim()}" created successfully!`, 'success');
      setIsModalOpen(false);
      loadCategories();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (category) => {
    try {
      await api.deleteCategory(category.id);
      if (onShowToast) onShowToast(`Category "${category.name}" removed successfully.`, 'success');
      setDeleteConfirmCat(null);
      loadCategories();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'error');
    }
  };

  const filteredCategories = categories.filter(cat => {
    const matchesSearch = 
      cat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111520] p-4 rounded-xl border border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-[#E5A93C]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Product Categories Master</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#E5A93C]/10 text-[#E5A93C] border border-[#E5A93C]/20 font-bold">
              Account System Master
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage product categories for purchasing & landed cost imports. Pushing shipments to Stock Management automatically provisions missing categories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCategories}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition"
            title="Refresh Categories"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#E5A93C] to-[#D4952B] hover:from-[#F3C368] hover:to-[#E5A93C] text-black text-xs font-bold transition shadow-lg shadow-[#E5A93C]/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Category</span>
          </button>
        </div>
      </div>

      {/* Synchronisation Policy Alert Box */}
      <div className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-300">
        <ShieldCheck className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <span className="font-semibold text-white">One-Way Push Guarantee:</span>
          <p className="text-[11px] text-slate-400">
            When you import or buy products in Account System and attach a category, pushing to Stock Management will automatically create that category in Stock Management and place the product in it. Categories created inside Stock Management will <strong className="text-white">never</strong> push back or pollute the Account System.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#111520]/60 p-3 rounded-xl border border-white/5 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#E5A93C]/50"
          />
        </div>

        <div className="text-slate-400 text-[11px]">
          Showing <span className="text-white font-bold">{filteredCategories.length}</span> of {categories.length} categories
        </div>
      </div>

      {/* Categories Grid / Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-[#111520]/40 rounded-xl border border-white/5">
          <div className="w-6 h-6 border-2 border-[#E5A93C] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading product categories...
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-[#111520]/40 rounded-xl border border-white/5 space-y-2">
          <Package className="w-8 h-8 mx-auto text-slate-600 mb-1" />
          <p className="text-sm font-semibold text-slate-300">No product categories found</p>
          <p className="text-xs text-slate-500">Create your first product category using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCategories.map((cat) => (
            <div 
              key={cat.id} 
              className="bg-[#111520] hover:bg-[#161B28] p-4 rounded-xl border border-white/10 hover:border-[#E5A93C]/40 transition space-y-3 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#E5A93C]/10 border border-[#E5A93C]/20 flex items-center justify-center text-[#E5A93C] font-bold">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{cat.name}</h4>
                    <span className="text-[10px] font-mono text-slate-500">ID: {cat.id}</span>
                  </div>
                </div>

                <button
                  onClick={() => setDeleteConfirmCat(cat)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition"
                  title="Delete category"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                {cat.description || <span className="italic text-slate-600">No description provided</span>}
              </p>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                <span>Created: {cat.createdAt ? new Date(cat.createdAt).toLocaleDateString() : 'N/A'}</span>
                <span className="text-[#10B981] font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Active Master
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-md p-6 border border-white/20 animate-in fade-in space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#E5A93C]" />
                Create Product Category
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Add a new product category in the Account System. You can select this category when importing or purchasing goods.
            </p>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Artisan Ceramic, Winter Outerwear"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#E5A93C]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Notes, product specifications, or sub-brand classifications..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#E5A93C] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#E5A93C] to-[#D4952B] hover:from-[#F3C368] hover:to-[#E5A93C] text-black font-bold transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmCat && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-sm p-6 border border-rose-500/30 animate-in fade-in space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Delete Product Category?</h3>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to delete category <strong className="text-white font-semibold">"{deleteConfirmCat.name}"</strong>?
            </p>
            <p className="text-[11px] text-slate-400 bg-black/30 p-2.5 rounded-lg border border-white/5">
              Categories in active use by imported shipment items cannot be removed until reassigned.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmCat(null)}
                className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmCat)}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition text-xs shadow-lg shadow-rose-500/20"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

