import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import {
  Bookmark,
  Search,
  User,
  Phone,
  Clock,
  DollarSign,
  Coins,
  Play,
  X,
  Edit2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function SavedOrdersView() {
  const {
    resumeOrderFromSaved,
    setActiveTab,
    playBeep,
    exchangeRate
  } = usePos();

  const [savedOrders, setSavedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ON_HOLD');
  const [dateRange, setDateRange] = useState('ALL');

  // Cancel Modal State
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Edit Customer Modal State
  const [editingOrder, setEditingOrder] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNote, setEditNote] = useState('');

  const [notification, setNotification] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        status: statusFilter,
        dateRange
      });
      const res = await fetch(`/api/orders/saved?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSavedOrders(data.savedOrders || []);
      }
    } catch (e) {
      console.warn('Failed to load saved orders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, dateRange]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  // Resume Saved Order into Active Cart
  const handleResume = async (savedOrderId) => {
    try {
      const result = await resumeOrderFromSaved(savedOrderId);
      if (result.ok) {
        playBeep(1100, 'sine', 0.1);
        setActiveTab('REGISTER');
      } else {
        setNotification({ type: 'error', text: result.error || 'Could not resume order' });
      }
    } catch (e) {
      setNotification({ type: 'error', text: e.message });
    }
  };

  // Confirm Cancellation
  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/saved/${cancellingOrder.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to cancel');

      playBeep(440, 'triangle', 0.1);
      setNotification({ type: 'success', text: `Held order #${cancellingOrder.orderNumber} cancelled.` });
      setCancellingOrder(null);
      setCancelReason('');
      await fetchOrders();
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Customer Edit
  const handleConfirmCustomerEdit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/saved/${editingOrder.id}/customer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: editName.trim(),
          customerPhone: editPhone.trim(),
          orderNote: editNote.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to update customer');

      playBeep(1000, 'sine', 0.08);
      setNotification({ type: 'success', text: 'Customer information updated.' });
      setEditingOrder(null);
      await fetchOrders();
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-950 overflow-hidden select-none font-sans">
      {/* 1. Header Toolbar */}
      <div className="p-5 border-b border-obsidian-800 bg-obsidian-900/60 space-y-4 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-100 uppercase tracking-wide font-display flex items-center space-x-2">
              <Bookmark className="w-5 h-5 text-amber-400" />
              <span>Saved Orders & Hold Management</span>
            </h1>
            <p className="text-xs text-slate-400">
              Recall unpaid customer carts, resume checkout across shifts, and manage held orders.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-xs text-slate-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Customer, Phone, Hold #..."
              className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-slate-200 outline-none"
            />
          </form>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono outline-none appearance-none"
            >
              <option value="ON_HOLD">Status: On Hold / Unpaid (Active)</option>
              <option value="PAID">Status: Completed & Paid</option>
              <option value="CANCELLED">Status: Cancelled</option>
              <option value="ALL">Status: All Saved Orders</option>
            </select>
          </div>

          <div>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono outline-none appearance-none"
            >
              <option value="ALL">Period: All Time</option>
              <option value="TODAY">Period: Today</option>
              <option value="7DAYS">Period: Past 7 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div className={`mx-5 mt-4 p-3.5 rounded-xl border text-xs flex items-center justify-between animate-in fade-in ${
          notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{notification.text}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Saved Orders Grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading && savedOrders.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-2 text-xs font-mono text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
            <span>Loading held orders...</span>
          </div>
        ) : savedOrders.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-2 text-xs text-slate-500 bg-obsidian-900/40 rounded-2xl border border-obsidian-800">
            <Bookmark className="w-8 h-8 text-slate-600 mb-1" />
            <span>No saved orders found matching your criteria.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedOrders.map((order) => {
              const isOnHold = order.status === 'ON_HOLD';
              const isPaid = order.status === 'PAID';
              const createdDate = new Date(order.createdAt);
              const elapsedMinutes = Math.floor((Date.now() - createdDate.getTime()) / 60000);
              const elapsedText = elapsedMinutes < 60 ? `${elapsedMinutes}m ago` : `${Math.floor(elapsedMinutes / 60)}h ago`;

              return (
                <div
                  key={order.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                    isOnHold
                      ? 'bg-obsidian-900 border-amber-500/30 hover:border-amber-500/60 shadow-lg shadow-amber-500/5'
                      : isPaid
                      ? 'bg-obsidian-900/50 border-emerald-500/20'
                      : 'bg-obsidian-900/30 border-obsidian-800'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Tag & Status */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-100 flex items-center space-x-1.5">
                        <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                        <span>{order.orderNumber}</span>
                      </span>

                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                        isOnHold
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                          : isPaid
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-500'
                      }`}>
                        {order.status}
                      </span>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-obsidian-950 p-3 rounded-xl border border-obsidian-800 space-y-1">
                      <div className="font-semibold text-slate-200 text-sm flex items-center space-x-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{order.customerName}</span>
                      </div>
                      {order.customerPhone && (
                        <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-1.5">
                          <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{order.customerPhone}</span>
                        </div>
                      )}
                      {order.orderNote && (
                        <div className="text-[10px] text-slate-400 italic pt-1 border-t border-obsidian-850">
                          "{order.orderNote}"
                        </div>
                      )}
                    </div>

                    {/* Items Summary */}
                    <div className="space-y-1 text-xs font-mono">
                      <div className="text-[10px] text-slate-500 uppercase flex justify-between">
                        <span>Items ({order.itemCount} units)</span>
                        <span>{elapsedText}</span>
                      </div>
                      <div className="max-h-24 overflow-y-auto divide-y divide-obsidian-800/40 text-[11px] text-slate-300">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="py-1 flex justify-between">
                            <span className="truncate pr-2">{item.quantity}x {item.itemTitle}</span>
                            <span className="shrink-0 text-slate-400">${item.lineTotal}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Financial Footer & Actions */}
                  <div className="pt-3 border-t border-obsidian-800 space-y-3 font-mono">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-400">Total Unpaid:</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-brass-400">${Number(order.totalAmount).toFixed(2)} USD</span>
                        <div className="text-[10px] text-slate-500">{Number(order.totalAmountKhr || 0).toLocaleString()} ៛</div>
                      </div>
                    </div>

                    {/* Actions if ON_HOLD */}
                    {isOnHold && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleResume(order.id)}
                          className="flex-1 py-2 rounded-xl bg-gradient-to-r from-brass-500 to-amber-500 hover:from-brass-400 hover:to-amber-400 text-obsidian-950 font-bold text-xs uppercase flex items-center justify-center space-x-1.5 shadow-md shadow-brass-500/10 active:scale-95 transition-all"
                          title="Restore cart items and proceed to checkout"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Resume Sale</span>
                        </button>

                        <button
                          onClick={() => {
                            setEditingOrder(order);
                            setEditName(order.customerName);
                            setEditPhone(order.customerPhone || '');
                            setEditNote(order.orderNote || '');
                          }}
                          className="p-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 text-slate-300 border border-obsidian-750 transition-colors"
                          title="Edit Customer Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setCancellingOrder(order)}
                          className="p-2 rounded-xl bg-obsidian-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 border border-obsidian-750 transition-colors"
                          title="Cancel Held Order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Cancel Order Modal */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-900 border border-obsidian-750 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-100 font-sans">
              Cancel Held Order #{cancellingOrder.orderNumber}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Are you sure you want to cancel the held order for <strong>{cancellingOrder.customerName}</strong> (${cancellingOrder.totalAmount})?
            </p>

            <form onSubmit={handleConfirmCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Reason for Cancellation (Required)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer cancelled order / left premises"
                  className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setCancellingOrder(null)}
                  className="flex-1 py-2 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-slate-300 text-xs font-bold uppercase"
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !cancelReason.trim()}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase transition-all shadow-md"
                >
                  {actionLoading ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Edit Customer Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-900 border border-obsidian-750 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-100 font-sans">
              Edit Customer for Order #{editingOrder.orderNumber}
            </h3>

            <form onSubmit={handleConfirmCustomerEdit} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Customer Phone</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Order Note</label>
                <textarea
                  rows={2}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-amber-500 rounded-xl p-3 text-slate-100 outline-none"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 py-2 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-slate-300 text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !editName.trim()}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-obsidian-950 text-xs font-bold uppercase"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

