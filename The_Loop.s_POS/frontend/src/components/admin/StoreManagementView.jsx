import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { 
  Store, 
  Plus, 
  MapPin, 
  Phone, 
  User, 
  Cpu, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Edit3, 
  ShieldCheck,
  Building,
  ArrowRight
} from 'lucide-react';

export default function StoreManagementView() {
  const { 
    stores, 
    loadStores, 
    authToken, 
    currentUser, 
    cashierUser, 
    switchStore, 
    currentStore,
    playBeep 
  } = usePos();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    managerId: ''
  });

  const [regModalStore, setRegModalStore] = useState(null);
  const [regForm, setRegForm] = useState({
    registerCode: '',
    name: ''
  });

  const [toast, setToast] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const activeUser = cashierUser || currentUser;
  const isOwner = activeUser?.role === 'OWNER' || activeUser?.role === 'SUPER_ADMIN';

  const showToast = (msg) => {
    setToast(msg);
    playBeep(1200, 'sine', 0.1);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchUsers = async () => {
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/users', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const uList = await res.json();
        setUsers(uList);
      }
    } catch (e) {
      console.warn('Could not load users for store assignment');
    }
  };

  useEffect(() => {
    loadStores();
    fetchUsers();
  }, [loadStores]);

  const handleOpenCreate = () => {
    setForm({
      name: '',
      code: '',
      address: '',
      phone: '',
      managerId: ''
    });
    setErrorMsg('');
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (store) => {
    setSelectedStore(store);
    setForm({
      name: store.name,
      code: store.code,
      address: store.address || '',
      phone: store.phone || '',
      managerId: store.managerId || ''
    });
    setErrorMsg('');
    setIsEditOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to create store');

      showToast(`Store branch "${data.store.name}" successfully created with register REG-01!`);
      setIsCreateOpen(false);
      loadStores();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStore) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/stores/${selectedStore.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to update store');

      showToast(`Store "${data.store.name}" updated successfully.`);
      setIsEditOpen(false);
      loadStores();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regModalStore) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/stores/${regModalStore.id}/registers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(regForm)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to add register');

      showToast(`Register "${data.register.registerCode}" created for ${regModalStore.name}!`);
      setRegModalStore(null);
      setRegForm({ registerCode: '', name: '' });
      loadStores();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalRegisters = stores.reduce((sum, s) => sum + (s.registerCount || 1), 0);
  const totalActiveShifts = stores.reduce((sum, s) => sum + (s.activeShiftCount || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-obsidian-950 text-slate-100 font-sans select-none space-y-6">
      
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 p-3 bg-emerald-500 text-obsidian-950 rounded-xl shadow-xl font-bold text-xs flex items-center space-x-2 animate-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-obsidian-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-slate-100 font-display uppercase tracking-wider">
              Multi-Store Branches & Infrastructure
            </h1>
            <span className="text-[10px] bg-brass-500/20 text-brass-400 font-mono px-2 py-0.5 rounded border border-brass-500/30 font-bold uppercase">
              Section 15 Architecture
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Independent operational records, store-specific registers, cashier shift boundaries & inventory isolation.
          </p>
        </div>

        {isOwner && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs shadow-md shadow-brass-500/20 active:scale-95 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Store</span>
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Store className="w-3.5 h-3.5 text-brass-400" />
            <span>Total Branches</span>
          </div>
          <div className="text-2xl font-black font-display text-slate-100">
            {stores.length}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Stores</span>
          </div>
          <div className="text-2xl font-black font-display text-emerald-400">
            {stores.filter(s => s.isActive !== false).length}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span>Configured Registers</span>
          </div>
          <div className="text-2xl font-black font-display text-sky-400">
            {totalRegisters}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Open Cashier Shifts</span>
          </div>
          <div className="text-2xl font-black font-display text-amber-400">
            {totalActiveShifts}
          </div>
        </div>
      </div>

      {/* Stores Grid */}
      <div className="space-y-3">
        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Business Store Directory
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store) => {
            const isCurrent = store.id === currentStore?.id;

            return (
              <div
                key={store.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  isCurrent
                    ? 'bg-obsidian-900 border-brass-500/50 shadow-lg shadow-brass-500/5 ring-1 ring-brass-500/30'
                    : 'bg-obsidian-900/90 border-obsidian-800 hover:border-obsidian-700'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-100 font-display">
                          {store.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-obsidian-800 text-[10px] font-mono font-bold text-brass-400 border border-obsidian-750">
                          {store.code}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        ID: {store.id}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                          Current
                        </span>
                      )}
                      {isOwner && (
                        <button
                          onClick={() => handleOpenEdit(store)}
                          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-obsidian-800 transition"
                          title="Edit Store"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-xs text-slate-400">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{store.address || 'Address unconfigured'}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono text-[11px]">{store.phone || 'Phone unconfigured'}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Manager: <strong className="text-slate-300">{store.managerName || 'Unassigned'}</strong></span>
                    </div>
                  </div>

                  {/* Telemetry Pills */}
                  <div className="pt-2 border-t border-obsidian-800/80 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400 flex items-center space-x-1">
                      <Cpu className="w-3 h-3 text-sky-400" />
                      <span>{store.registerCount || 1} Register(s)</span>
                    </span>

                    <button
                      onClick={() => {
                        setRegModalStore(store);
                        setRegForm({ registerCode: `REG-0${(store.registerCount || 1) + 1}`, name: `${store.name} Register 0${(store.registerCount || 1) + 1}` });
                      }}
                      className="text-[10px] text-brass-400 hover:underline flex items-center space-x-0.5"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Add Register</span>
                    </button>
                  </div>
                </div>

                {/* Switch Store Button */}
                <div className="pt-2">
                  <button
                    onClick={() => switchStore(store.id)}
                    disabled={isCurrent}
                    className={`w-full py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      isCurrent
                        ? 'bg-brass-500/20 text-brass-400 border border-brass-500/30 cursor-default'
                        : 'bg-obsidian-800 hover:bg-brass-500 hover:text-obsidian-950 text-slate-300 border border-obsidian-700'
                    }`}
                  >
                    <span>{isCurrent ? 'Currently Active Store' : 'Switch to this Store'}</span>
                    {!isCurrent && <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* CREATE STORE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                Create Store Location
              </h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Store Name (e.g. Store A — Phnom Penh)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Store A — Phnom Penh"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Store Code (e.g. PP-01, SR-01, BTB-01)</label>
                <input
                  type="text"
                  placeholder="e.g. PP-01"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-lg p-2 text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Physical Address</label>
                <input
                  type="text"
                  placeholder="e.g. Street 178, Phnom Penh"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +855 23 888 111"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-lg p-2 text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Assign Store Manager</label>
                <select
                  value={form.managerId}
                  onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-lg p-2 text-slate-100 cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STORE MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                Edit Store: {selectedStore?.name}
              </h2>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Store Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Store Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-lg p-2 text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-lg p-2 text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Store Manager</label>
                <select
                  value={form.managerId}
                  onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-lg p-2 text-slate-100 cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD REGISTER MODAL */}
      {regModalStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                Add Register to {regModalStore.name}
              </h2>
              <button onClick={() => setRegModalStore(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddRegisterSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Register Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. REG-02"
                  value={regForm.registerCode}
                  onChange={(e) => setRegForm({ ...regForm, registerCode: e.target.value.toUpperCase() })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-lg p-2 text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Register Name</label>
                <input
                  type="text"
                  placeholder="e.g. Counter 2 Checkout"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setRegModalStore(null)}
                  className="flex-1 py-2 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

