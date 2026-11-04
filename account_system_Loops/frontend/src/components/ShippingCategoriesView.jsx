import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Ship, 
  Plane, 
  Package, 
  Compass, 
  RefreshCw,
  X
} from 'lucide-react';
import { api } from '../api';
import ConfirmModal from './ConfirmModal';

export default function ShippingCategoriesView({ onShowToast }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState({
    name: '',
    shippingMethod: 'Air Shipping',
    description: '',
    status: 'ACTIVE'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await api.getShippingCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load shipping categories:', err);
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setForm({
      name: '',
      shippingMethod: 'Air Cargo',
      description: '',
      status: 'ACTIVE'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name || '',
      shippingMethod: cat.shippingMethod || 'Air Shipping',
      description: cat.description || '',
      status: cat.status || 'ACTIVE'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      if (onShowToast) onShowToast('Category name is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await api.updateShippingCategory(editingCategory.id, form);
        if (onShowToast) onShowToast(`Shipping category "${form.name}" updated!`, 'success');
      } else {
        await api.createShippingCategory(form);
        if (onShowToast) onShowToast(`Shipping category "${form.name}" created!`, 'success');
      }
      setIsModalOpen(false);
      loadCategories();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (cat) => {
    const newStatus = cat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.updateShippingCategory(cat.id, { ...cat, status: newStatus });
      if (onShowToast) onShowToast(`Category "${cat.name}" marked ${newStatus}`, 'success');
      loadCategories();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'error');
    }
  };

  const handleDelete = async (cat) => {
    try {
      await api.deleteShippingCategory(cat.id);
      if (onShowToast) onShowToast(`Category "${cat.name}" removed successfully`, 'success');
      setCategoryToDelete(null);
      loadCategories();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'error');
    }
  };

  const getMethodIcon = (method = '') => {
    const m = method.toLowerCase();
    if (m.includes('air') || m.includes('plane') || m.includes('flight')) {
      return <Plane className="w-4 h-4 text-sky-400" />;
    }
    if (m.includes('sea') || m.includes('ocean') || m.includes('vessel') || m.includes('ship')) {
      return <Ship className="w-4 h-4 text-cyan-400" />;
    }
    if (m.includes('truck') || m.includes('land') || m.includes('road') || m.includes('van')) {
      return <Truck className="w-4 h-4 text-amber-400" />;
    }
    return <Package className="w-4 h-4 text-[#E5A93C]" />;
  };

  const filteredCategories = categories.filter((c) => {
    const matchesSearch = 
      (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.shippingMethod || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="glass-card p-6 border border-white/10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="text-xs font-mono text-[#E5A93C] uppercase tracking-wider font-semibold">
              Logistics & Freight Configuration
            </div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#E5A93C]" />
              Shipping Category Management
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Define freight classifications, transport modes, and landing cost allocation buckets for overseas imports and local deliveries.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadCategories}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition"
              title="Refresh Categories"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#E5A93C] to-[#D4952B] hover:from-[#F3C368] hover:to-[#E5A93C] text-black text-xs font-bold transition shadow-lg shadow-[#E5A93C]/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Shipping Category</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search category name, method, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111520] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#E5A93C]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#111520] p-1 rounded-xl border border-white/10">
            {['ALL', 'ACTIVE', 'INACTIVE'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === status
                    ? 'bg-[#E5A93C] text-black font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {status === 'ALL' ? 'All Categories' : status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 font-mono text-xs">
          <div className="w-8 h-8 border-2 border-[#E5A93C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading business shipping categories...
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-8 text-center text-slate-400 glass-card border border-white/10 rounded-2xl space-y-3">
          <AlertCircle className="w-8 h-8 text-[#E5A93C] mx-auto opacity-70" />
          <h4 className="text-sm font-bold text-white">No Shipping Categories Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm ? 'No categories matched your search criteria.' : 'Create your first shipping category to categorize import freight, sea containers, and local transport.'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleOpenCreate}
              className="mt-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-[#E5A93C] border border-[#E5A93C]/30 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Initial Category</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const isActive = cat.status === 'ACTIVE';
            return (
              <div 
                key={cat.id} 
                className={`glass-card p-5 border transition flex flex-col justify-between space-y-4 ${
                  isActive ? 'border-white/10 hover:border-[#E5A93C]/40' : 'border-white/5 opacity-60 bg-black/30'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                        {getMethodIcon(cat.shippingMethod)}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">{cat.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400 block">{cat.shippingMethod || 'Standard'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleStatus(cat)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition border ${
                        isActive
                          ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/25'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                      title={isActive ? 'Click to Deactivate' : 'Click to Activate'}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 mt-2">
                    {cat.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                  <span className="text-[10px] text-slate-500 truncate max-w-[130px]">
                    ID: {cat.id}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(cat)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
                      title="Edit Category"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setCategoryToDelete(cat)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create / Edit Category */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#16202E] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#E5A93C]" />
                <span>{editingCategory ? 'Edit Shipping Category' : 'New Shipping Category'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Category Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Express Air Cargo, Sea Container, Local Truck"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-[#E5A93C]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Shipping Method / Mode
                </label>
                <select
                  value={form.shippingMethod}
                  onChange={(e) => setForm({ ...form, shippingMethod: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E5A93C] cursor-pointer"
                >
                  <option value="Air Cargo">Air Cargo (Freight)</option>
                  <option value="Ocean Freight">Ocean Freight (Sea Shipment)</option>
                  <option value="Cross-Border Truck">Cross-Border Overland Truck</option>
                  <option value="Express Courier">Express Courier (DHL / FedEx / Air Parcel)</option>
                  <option value="Local Van / Truck">Local Van / Inland Trucking</option>
                  <option value="Vendor Direct">Vendor Direct Delivery</option>
                  <option value="Other">Other Logistic Mode</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Notes on handling, transit speed, tariff rules, or vendor instructions..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-[#E5A93C]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Status
                </label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="status"
                      value="ACTIVE"
                      checked={form.status === 'ACTIVE'}
                      onChange={() => setForm({ ...form, status: 'ACTIVE' })}
                      className="text-[#E5A93C] focus:ring-[#E5A93C]"
                    />
                    <span>Active (Available for purchases & imports)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400">
                    <input
                      type="radio"
                      name="status"
                      value="INACTIVE"
                      checked={form.status === 'INACTIVE'}
                      onChange={() => setForm({ ...form, status: 'INACTIVE' })}
                      className="text-[#E5A93C] focus:ring-[#E5A93C]"
                    />
                    <span>Inactive</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#E5A93C] to-[#D4952B] hover:from-[#F3C368] hover:to-[#E5A93C] text-black font-bold transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={!!categoryToDelete}
        title="Delete Shipping Category"
        subtitle={`Are you sure you want to delete shipping category "${categoryToDelete?.name}"?`}
        details={[
          { label: 'Category Name', value: categoryToDelete?.name || '' },
          { label: 'Shipping Method', value: categoryToDelete?.shippingMethod || '' },
          { label: 'Status', value: categoryToDelete?.status || 'ACTIVE' }
        ]}
        variant="danger"
        confirmText="Delete Category"
        onConfirm={() => handleDelete(categoryToDelete)}
        onCancel={() => setCategoryToDelete(null)}
      />
    </div>
  );
}

