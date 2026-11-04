import React, { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { 
  Users, 
  Shield, 
  UserPlus, 
  Key, 
  Check, 
  X, 
  Edit3, 
  Trash2, 
  Lock, 
  Unlock, 
  ShieldAlert, 
  Sparkles, 
  RefreshCw, 
  Search, 
  Activity, 
  PlusCircle, 
  Layers,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
  Building2
} from 'lucide-react';

const PERMISSION_DEFINITIONS = [
  { key: 'openPos', label: 'Open POS Terminal', category: 'POS Operations' },
  { key: 'makeSales', label: 'Execute Sales & Checkout', category: 'POS Operations' },
  { key: 'viewSalesHistory', label: 'View Sales & Order History', category: 'POS Operations' },
  { key: 'refundTransactions', label: 'Process Customer Refunds & Returns', category: 'POS Operations' },
  { key: 'cancelTransactions', label: 'Cancel & Void In-Progress Orders', category: 'POS Operations' },
  { key: 'applyDiscounts', label: 'Apply Line & Cart Discounts', category: 'POS Operations' },
  { key: 'changeProductPrices', label: 'Override Product Prices', category: 'POS Operations' },
  { key: 'viewStock', label: 'View Inventory On-Hand Balances', category: 'Inventory' },
  { key: 'editStock', label: 'Perform Stock Adjustments & GRN', category: 'Inventory' },
  { key: 'accessStockApp', label: 'Access Stock Management Suite (Port 5173)', category: 'Cross-App Access' },
  { key: 'accessFinanceApp', label: 'Access Loops Finance Suite (Port 5174)', category: 'Cross-App Access' },
  { key: 'viewFinancialReports', label: 'View P&L and Balance Sheet Reports', category: 'Finance' },
  { key: 'manageEmployees', label: 'Manage Staff Accounts & RBAC Permissions', category: 'Administration' },
  { key: 'changeSystemSettings', label: 'Change Currency Rates & Hardware Config', category: 'Administration' },
  { key: 'accessBackoffice', label: 'Access Backoffice & Administration Suite', category: 'Administration' },
  { key: 'viewUserPin', label: 'View & Reveal Staff Quick PINs', category: 'Security & PIN' },
  { key: 'editUserPin', label: 'Edit & Regenerate Staff Quick PINs', category: 'Security & PIN' }
];

export default function UserAndAccessManagementView() {
  const { playBeep, cashierUser, currentUser, authToken, stores: contextStores = [], loadStores } = usePos();

  const [activeTab, setActiveTab] = useState('USERS'); // 'USERS', 'ROLES', 'AUDIT'
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [availableStores, setAvailableStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedPins, setRevealedPins] = useState({});
  const [companyCodeData, setCompanyCodeData] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const activeCaller = currentUser || cashierUser;
  const isCallerOwner = activeCaller?.role === 'OWNER' || activeCaller?.role === 'SUPER_ADMIN';
  const canViewPin = isCallerOwner || activeCaller?.permissions?.viewUserPin === true;
  const canEditPin = isCallerOwner || activeCaller?.permissions?.editUserPin === true;

  const activeStores = availableStores.length > 0 ? availableStores : contextStores;

  const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
  const getAuthHeaders = (extra = {}) => ({
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  });

  // Edit / Create User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    fullName: '',
    email: '',
    role: 'CASHIER',
    pin: '',
    status: 'ACTIVE',
    assignedStoreIds: ['*'],
    appAccess: { pos: true, stock: false, finance: false },
    permissions: {}
  });

  // Create Custom Role Modal State
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({
    id: '',
    name: '',
    app: 'POS',
    description: '',
    permissions: {}
  });

  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    playBeep(1000, 'sine', 0.1);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const loadCompanyCode = async () => {
    try {
      const res = await fetch('/api/auth/company-code', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCompanyCodeData(data);
      }
    } catch (e) {
      console.warn('[Terminal] Failed to load company code:', e);
    }
  };

  const handleCopyCompanyCode = () => {
    if (companyCodeData?.companyCode) {
      navigator.clipboard.writeText(companyCodeData.companyCode);
      setIsCopied(true);
      showToast(`Company Code ${companyCodeData.companyCode} copied to clipboard!`);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleRegenerateCompanyCode = async () => {
    if (!window.confirm('Are you sure you want to regenerate your Company Code? All POS registers currently paired with the old code will need to be reconnected with the new code.')) {
      return;
    }
    try {
      const res = await fetch('/api/auth/company-code/regenerate', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate company code');
      showToast(`New Company Code generated: ${data.companyCode}`);
      loadCompanyCode();
    } catch (err) {
      alert(err.message);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, rRes, aRes, sRes] = await Promise.all([
        fetch('/api/users', { headers: getAuthHeaders() }),
        fetch('/api/roles', { headers: getAuthHeaders() }),
        fetch('/api/audit/logs?limit=50', { headers: getAuthHeaders() }),
        fetch('/api/stores', { headers: getAuthHeaders() })
      ]);

      if (uRes.ok) setUsers(await uRes.json());
      if (rRes.ok) setRoles(await rRes.json());
      if (aRes.ok) setAuditLogs(await aRes.json());
      if (sRes.ok) {
        const sList = await sRes.json();
        setAvailableStores(sList);
      }
      loadCompanyCode();
    } catch (err) {
      console.error('[RBAC] Failed to load user directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (loadStores) loadStores();
  }, []);

  // Open Create User Modal with automatic PIN generation
  const handleOpenCreateUser = async () => {
    setEditingUser(null);
    let autoPin = '1234';
    try {
      const res = await fetch('/api/users/generate-pin', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.pin) autoPin = data.pin;
      }
    } catch (e) {}

    setUserForm({
      fullName: '',
      email: '',
      role: 'CASHIER',
      pin: autoPin,
      status: 'ACTIVE',
      assignedStoreIds: ['*'],
      appAccess: { pos: true, stock: false, finance: false },
      permissions: {
        openPos: true,
        makeSales: true,
        viewSalesHistory: true,
        refundTransactions: false,
        cancelTransactions: false,
        applyDiscounts: true,
        changeProductPrices: false,
        viewStock: true,
        editStock: false,
        accessStockApp: false,
        accessFinanceApp: false,
        viewFinancialReports: false,
        manageEmployees: false,
        changeSystemSettings: false,
        accessBackoffice: false,
        viewUserPin: false,
        editUserPin: false
      }
    });
    setIsUserModalOpen(true);
  };

  // Open Edit User Modal
  const handleOpenEditUser = (u) => {
    setEditingUser(u);
    const existingStores = u.role === 'OWNER'
      ? ['*']
      : (Array.isArray(u.assignedStoreIds) && u.assignedStoreIds.length > 0
          ? u.assignedStoreIds
          : (Array.isArray(u.locations) && u.locations.length > 0 ? u.locations : ['*']));

    setUserForm({
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      pin: '',
      status: u.status || (u.active !== false ? 'ACTIVE' : 'INACTIVE'),
      assignedStoreIds: existingStores,
      appAccess: u.appAccess || { pos: true, stock: false, finance: false },
      permissions: { ...(u.permissions || {}) }
    });
    setIsUserModalOpen(true);
  };

  // Reveal PIN handler (enforcing viewUserPin permission on backend)
  const handleRevealPin = async (userId) => {
    if (revealedPins[userId]) {
      setRevealedPins(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      return;
    }

    try {
      const res = await fetch(`/api/users/${userId}/reveal-pin`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setRevealedPins(prev => ({ ...prev, [userId]: data.pin }));
        showToast('Staff PIN revealed securely');
      } else {
        alert(data.error || 'Failed to reveal PIN');
      }
    } catch (e) {
      alert(e.message);
    }
  };

  // Regenerate PIN handler (enforcing editUserPin permission on backend)
  const handleRegeneratePin = async (u) => {
    if (!window.confirm(`Regenerate a new Quick PIN for "${u.fullName}"?`)) return;
    try {
      const res = await fetch(`/api/users/${u.id}/regenerate-pin`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setRevealedPins(prev => ({ ...prev, [u.id]: data.pin }));
        showToast(`New unique PIN for ${u.fullName} is: ${data.pin}`);
        loadData();
      } else {
        alert(data.error || 'Failed to regenerate PIN');
      }
    } catch (e) {
      alert(e.message);
    }
  };

  // Modal PIN generator
  const handleRegenerateModalPin = async () => {
    try {
      const res = await fetch('/api/users/generate-pin', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.pin) {
          setUserForm(prev => ({ ...prev, pin: data.pin }));
          showToast(`Generated unique PIN: ${data.pin}`);
        }
      }
    } catch (e) {}
  };

  // Handle Save User
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userForm.fullName || !userForm.email) return;

    try {
      if (editingUser) {
        // Update user
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            fullName: userForm.fullName,
            email: userForm.email,
            role: userForm.role,
            status: userForm.status,
            active: userForm.status === 'ACTIVE',
            assignedStoreIds: userForm.role === 'OWNER' ? ['*'] : userForm.assignedStoreIds,
            locations: userForm.role === 'OWNER' ? ['*'] : userForm.assignedStoreIds,
            appAccess: userForm.appAccess,
            permissions: userForm.permissions,
            ...(userForm.pin ? { pin: userForm.pin } : {}),
            performedBy: activeCaller?.fullName || 'Administrator'
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to update employee account');
        showToast(`Staff member "${userForm.fullName}" updated successfully!`);
      } else {
        // Create user
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            fullName: userForm.fullName,
            email: userForm.email,
            role: userForm.role,
            pin: userForm.pin || '1234',
            status: userForm.status,
            assignedStoreIds: userForm.assignedStoreIds,
            locations: userForm.assignedStoreIds,
            appAccess: userForm.appAccess,
            permissions: userForm.permissions,
            performedBy: activeCaller?.fullName || 'Administrator'
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to create employee account');
        showToast(`New employee "${userForm.fullName}" created across all platforms!`);
      }

      setIsUserModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle Delete User with Obsidian Confirm Modal UI
  const handleDeleteUser = (u) => {
    setDeleteError('');
    setDeleteConfirmUser(u);
  };

  const executeConfirmDelete = async () => {
    if (!deleteConfirmUser) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/users/${deleteConfirmUser.id}`, { method: 'DELETE', headers: getAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        showToast(`Account for "${deleteConfirmUser.fullName}" deleted successfully`);
        setDeleteConfirmUser(null);
        loadData();
      } else {
        setDeleteError(data.error || 'Failed to delete user account');
      }
    } catch (e) {
      setDeleteError('Error deleting user: ' + e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Quick Toggle Status
  const handleToggleStatus = async (u) => {
    const newStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          status: newStatus,
          active: newStatus === 'ACTIVE',
          performedBy: cashierUser?.fullName || 'Administrator'
        })
      });
      if (res.ok) {
        showToast(`Account ${u.fullName} is now ${newStatus}`);
        loadData();
      }
    } catch (e) {
      alert(e.message);
    }
  };

  // Open Create Role Modal
  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleForm({
      id: '',
      name: '',
      app: 'POS',
      description: '',
      permissions: {
        openPos: true,
        makeSales: true,
        viewSalesHistory: true,
        refundTransactions: false,
        cancelTransactions: false,
        applyDiscounts: false,
        changeProductPrices: false,
        viewStock: true,
        editStock: false,
        accessStockApp: false,
        accessFinanceApp: false,
        viewFinancialReports: false,
        manageEmployees: false,
        changeSystemSettings: false
      }
    });
    setIsRoleModalOpen(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleForm.name) return;
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...roleForm,
          createdBy: cashierUser?.fullName || 'Administrator'
        })
      });
      if (!res.ok) throw new Error('Failed to create role');
      showToast(`Custom role "${roleForm.name}" created!`);
      setIsRoleModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-obsidian-950 p-6 space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 p-3 rounded-xl bg-emerald-500 text-obsidian-950 font-bold text-xs shadow-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-4">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-obsidian-800">
        <div>
          <div className="text-xs font-mono text-brass-400 uppercase tracking-widest">
            Cross-Platform Identity & Access Fabric
          </div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <span>Centralized User & Access Management</span>
          </h2>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 border border-obsidian-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brass-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenCreateUser}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-brass-500 hover:bg-brass-400 text-obsidian-950 shadow-md shadow-brass-500/20 transition active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Create Staff Account</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Users, Roles, Audit Log */}
      <div className="flex items-center space-x-2 border-b border-obsidian-800 pb-2 text-xs font-medium select-none">
        <button
          onClick={() => setActiveTab('USERS')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'USERS'
              ? 'bg-brass-500/15 text-brass-400 border border-brass-500/30 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Staff Accounts ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ROLES')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'ROLES'
              ? 'bg-brass-500/15 text-brass-400 border border-brass-500/30 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Roles & Permissions ({roles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'AUDIT'
              ? 'bg-brass-500/15 text-brass-400 border border-brass-500/30 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Security & Login Audit ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('COMPANY_KEY')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'COMPANY_KEY'
              ? 'bg-brass-500/15 text-brass-400 border border-brass-500/30 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Terminal Key & Company Code</span>
        </button>
      </div>

      {/* TAB 1: USERS LIST */}
      {activeTab === 'USERS' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search staff by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-obsidian-900 border border-obsidian-750 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brass-500 font-mono"
            />
          </div>

          <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-obsidian-950 border-b border-obsidian-800 text-slate-400 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Primary Role</th>
                    <th className="py-3 px-4">Store Location</th>
                    <th className="py-3 px-4">App Access</th>
                    <th className="py-3 px-4">PIN Code</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-800/60">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-obsidian-850/60 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-obsidian-800 text-brass-400 border border-obsidian-700 flex items-center justify-center font-bold font-sans">
                            {u.fullName?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-100 font-sans">{u.fullName}</div>
                            <div className="text-[11px] text-slate-500">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-obsidian-800 text-brass-400 border border-obsidian-700 font-bold">
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-400">
                        {u.role === 'OWNER' || (u.assignedStoreIds || u.locations || []).includes('*') ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-brass-500/15 text-brass-400 border border-brass-500/30 font-bold">
                            All Stores (*)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {(u.assignedStoreIds || u.locations || []).map(storeId => {
                              const storeObj = activeStores.find(s => s.id === storeId);
                              return (
                                <span key={storeId} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-obsidian-800 text-brass-300 border border-obsidian-700">
                                  {storeObj ? `${storeObj.name} (${storeObj.code})` : storeId}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            u.appAccess?.pos !== false ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
                          }`}>
                            POS
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            u.appAccess?.stock ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' : 'bg-slate-800 text-slate-500'
                          }`}>
                            STOCK
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            u.appAccess?.finance ? 'bg-brass-500/15 text-brass-400 border border-brass-500/30' : 'bg-slate-800 text-slate-500'
                          }`}>
                            FINANCE
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          {revealedPins[u.id] ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-brass-500/15 text-brass-300 border border-brass-500/40">
                              {revealedPins[u.id]}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono tracking-widest">
                              {u.hasPin ? '••••' : 'None'}
                            </span>
                          )}

                          {canViewPin && u.hasPin && (
                            <button
                              type="button"
                              onClick={() => handleRevealPin(u.id)}
                              className="p-1 rounded hover:bg-obsidian-800 text-slate-400 hover:text-brass-400 transition"
                              title={revealedPins[u.id] ? "Hide PIN" : "Reveal PIN (Authorized View)"}
                            >
                              {revealedPins[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {canEditPin && (
                            <button
                              type="button"
                              onClick={() => handleRegeneratePin(u)}
                              className="p-1 rounded hover:bg-obsidian-800 text-slate-400 hover:text-brass-400 transition"
                              title="Regenerate Unique PIN (Authorized Edit)"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {u.role === 'OWNER' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                            ACTIVE
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-400'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-emerald-500/10 hover:text-emerald-400'
                            }`}
                            title="Click to toggle account status"
                          >
                            {u.status}
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {u.role === 'OWNER' && activeCaller?.id !== u.id ? (
                          <span className="px-2.5 py-1 rounded-lg bg-brass-500/10 border border-brass-500/30 text-brass-400 font-mono text-[10px] font-bold inline-flex items-center space-x-1">
                            <Shield className="w-3 h-3 text-brass-400" />
                            <span>Protected Owner</span>
                          </span>
                        ) : !isCallerOwner && activeCaller?.id === u.id ? (
                          <span className="px-2.5 py-1 rounded-lg bg-obsidian-800 border border-obsidian-750 text-slate-400 font-mono text-[10px] font-bold inline-flex items-center space-x-1" title="Staff cannot modify their own permissions or role">
                            <span>Self (Locked)</span>
                          </span>
                        ) : !isCallerOwner && (roles.find(r => r.id === u.role)?.authorityLevel || 20) >= (roles.find(r => r.id === activeCaller?.role)?.authorityLevel || 20) ? (
                          <span className="px-2.5 py-1 rounded-lg bg-obsidian-800 border border-obsidian-750 text-slate-400 font-mono text-[10px] font-bold inline-flex items-center space-x-1" title="Cannot modify staff of higher or equal authority">
                            <span>Protected (Rank)</span>
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-750 text-brass-400 transition"
                              title={u.role === 'OWNER' ? "Edit Your Own Owner Profile" : "Configure Permissions & Store Access"}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {u.role !== 'OWNER' && u.role !== 'SUPER_ADMIN' && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 rounded-lg bg-obsidian-800 hover:bg-rose-900/30 text-rose-400 transition"
                                title="Revoke & Delete Employee Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSION TEMPLATES */}
      {activeTab === 'ROLES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Predefined role templates automatically populate base permissions when assigning staff. Custom roles can be created at any time.
            </div>
            <button
              onClick={handleOpenCreateRole}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-brass-500/20 text-brass-400 border border-brass-500/40 hover:bg-brass-500/30 transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Create Custom Role</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...roles]
              .sort((a, b) => (b.authorityLevel || 0) - (a.authorityLevel || 0))
              .map((r) => {
              const activeCount = Object.values(r.permissions || {}).filter(Boolean).length;
              return (
                <div key={r.id} className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-100 text-xs font-sans">{r.name}</div>
                      <div className="font-mono text-[10px] text-brass-400">{r.id}</div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-obsidian-800 text-slate-400 border border-obsidian-750">
                      {r.app}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {r.description}
                  </p>

                  <div className="pt-2 border-t border-obsidian-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>{activeCount} of 14 Allowed</span>
                    <span className="text-emerald-400 font-bold">{Math.round((activeCount / 14) * 100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT & LOGIN HISTORY */}
      {activeTab === 'AUDIT' && (
        <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-obsidian-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">Recent Security & Login Audit Events</span>
            <span className="text-xs text-slate-400 font-mono">Immutable Log</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-obsidian-950 border-b border-obsidian-800 text-slate-400 text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-800/60">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-obsidian-850/60 transition">
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action.includes('SUCCESS') || log.action.includes('CREATED')
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : log.action.includes('FAILED')
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-brass-500/10 text-brass-400 border border-brass-500/20'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-200">
                      {log.performedBy || log.userName || 'System'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 truncate max-w-xs">
                      {log.details || log.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TERMINAL KEY & COMPANY CODE */}
      {activeTab === 'COMPANY_KEY' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-obsidian-900 border border-obsidian-800 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-obsidian-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-brass-400" />
                  <h3 className="text-base font-bold text-slate-100">Company Access Code & Register Pairing</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                  This private code links POS cashier terminals to <strong className="text-slate-200">{companyCodeData?.name || 'your business'}</strong> without publicly exposing other companies or allowing unauthorized cross-company PIN guessing.
                </p>
              </div>

              {canEditPin && (
                <button
                  type="button"
                  onClick={handleRegenerateCompanyCode}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-obsidian-850 hover:bg-rose-500/15 text-slate-300 hover:text-rose-300 border border-obsidian-750 hover:border-rose-500/30 transition shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate Code</span>
                </button>
              )}
            </div>

            {/* Display Code Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-obsidian-950 border border-brass-500/30 space-y-3">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  Active Company Code (Terminal Pairing Key)
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-3xl font-display font-black tracking-widest text-brass-400 font-mono select-all">
                    {companyCodeData?.companyCode || '------'}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCompanyCode}
                    disabled={!companyCodeData?.companyCode}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs transition active:scale-95"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-obsidian-950" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Assigned Organization: <strong className="text-slate-200 font-mono">{companyCodeData?.name || 'Loading...'}</strong></span>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-obsidian-950/60 border border-obsidian-800 space-y-2.5 text-xs text-slate-300">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>How Secure Quick PIN Authentication Works</span>
                </div>
                <ul className="space-y-1.5 text-slate-400 text-[11px] list-disc list-inside">
                  <li><strong className="text-slate-300">1. Private pairing:</strong> Only devices paired with your Company Code can access your register's Quick PIN pad.</li>
                  <li><strong className="text-slate-300">2. Anti-enumeration:</strong> Public visitors cannot browse or list tenant businesses.</li>
                  <li><strong className="text-slate-300">3. Same PIN collision safety:</strong> Cashiers in separate companies can share common PINs (e.g. 1234) without any cross-company risk.</li>
                  <li><strong className="text-slate-300">4. Lockout protection:</strong> 5 consecutive failed attempts trigger an automatic 10-minute security lockout.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / CREATE STAFF ACCOUNT WITH GRANULAR PERMISSIONS */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-900 border border-obsidian-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-obsidian-800 flex items-center justify-between bg-obsidian-850">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-brass-400" />
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {editingUser ? `Configure Staff: ${editingUser.fullName}` : 'Create Staff Member'}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono">
                    Granular RBAC & Cross-App Access Control
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={userForm.fullName}
                    onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                    className="w-full bg-obsidian-950 border border-obsidian-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-brass-500 font-sans"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full bg-obsidian-950 border border-obsidian-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-brass-500 font-mono"
                  />
                </div>
              </div>

              {/* Role & PIN & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Primary Role</label>
                  {editingUser?.role === 'OWNER' ? (
                    <div className="p-2.5 rounded-lg bg-obsidian-950 border border-brass-500/40 text-brass-400 font-mono font-bold text-xs flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-brass-400" />
                      <span>Primary Business Owner (Singular)</span>
                    </div>
                  ) : (
                    <select
                      value={userForm.role}
                      onChange={(e) => {
                        const selectedRole = roles.find(r => r.id === e.target.value);
                        setUserForm({
                          ...userForm,
                          role: e.target.value,
                          ...(selectedRole?.permissions ? { permissions: { ...selectedRole.permissions } } : {})
                        });
                      }}
                      className="w-full bg-obsidian-950 border border-obsidian-700 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-brass-500 font-mono cursor-pointer"
                    >
                      {roles
                        .filter(r => r.id !== 'OWNER')
                        .sort((a, b) => (b.authorityLevel || 0) - (a.authorityLevel || 0))
                        .map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.id})
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-medium">
                      {editingUser ? 'Reset PIN (4-6 Digits)' : 'Quick Login PIN'}
                    </label>
                    <button
                      type="button"
                      onClick={handleRegenerateModalPin}
                      className="text-[10px] text-brass-400 hover:text-brass-300 flex items-center space-x-1"
                      title="Roll a new unique PIN"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Generate</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder={editingUser ? 'Leave blank to keep current PIN' : 'Auto-generated'}
                      value={userForm.pin}
                      onChange={(e) => setUserForm({ ...userForm, pin: e.target.value.replace(/\D/g, '') })}
                      className="w-full bg-obsidian-950 border border-obsidian-700 rounded-lg px-3 py-2 pr-9 text-slate-100 focus:outline-none focus:border-brass-500 font-mono text-center tracking-widest text-sm font-bold text-brass-400"
                    />
                    <button
                      type="button"
                      onClick={handleRegenerateModalPin}
                      className="absolute right-2 top-2.5 text-slate-400 hover:text-brass-400 p-0.5 transition"
                      title="Generate new unique PIN"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 block text-center">
                    Unique to this company
                  </span>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">Account Status</label>
                  <select
                    value={userForm.status}
                    onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                    className="w-full bg-obsidian-950 border border-obsidian-700 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-brass-500 font-mono cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE (Authorized)</option>
                    <option value="SUSPENDED">SUSPENDED (Locked)</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* Cross-App Access Toggles */}
              <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-2">
                <span className="font-bold text-slate-200 block text-[11px] uppercase tracking-wider">
                  Cross-Platform Application Authorization
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer p-2 rounded-lg bg-obsidian-900 border border-obsidian-750">
                    <input
                      type="checkbox"
                      checked={userForm.appAccess.pos}
                      onChange={(e) => setUserForm({
                        ...userForm,
                        appAccess: { ...userForm.appAccess, pos: e.target.checked }
                      })}
                      className="rounded bg-obsidian-950 border-obsidian-700 text-brass-500"
                    />
                    <span>POS Terminal (Port 5175)</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer p-2 rounded-lg bg-obsidian-900 border border-obsidian-750">
                    <input
                      type="checkbox"
                      checked={userForm.appAccess.stock}
                      onChange={(e) => setUserForm({
                        ...userForm,
                        appAccess: { ...userForm.appAccess, stock: e.target.checked }
                      })}
                      className="rounded bg-obsidian-950 border-obsidian-700 text-brass-500"
                    />
                    <span>Stock Management (Port 5173)</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer p-2 rounded-lg bg-obsidian-900 border border-obsidian-750">
                    <input
                      type="checkbox"
                      checked={userForm.appAccess.finance}
                      onChange={(e) => setUserForm({
                        ...userForm,
                        appAccess: { ...userForm.appAccess, finance: e.target.checked }
                      })}
                      className="rounded bg-obsidian-950 border-obsidian-700 text-brass-500"
                    />
                    <span>Loops Finance (Port 5174)</span>
                  </label>
                </div>
              </div>

              {/* Section 15.3: Store / Location Access Assignment */}
              <div className="p-4 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-100 block text-xs uppercase tracking-wider font-display">
                      Store & Branch Location Access
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Determine which physical storefronts this staff member is authorized to access.
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-brass-500/10 text-brass-400 border border-brass-500/30">
                    {userForm.role === 'OWNER' || userForm.assignedStoreIds?.includes('*')
                      ? 'All Stores (*)' 
                      : `${userForm.assignedStoreIds?.length || 0} Store(s) Selected`}
                  </span>
                </div>

                {userForm.role === 'OWNER' ? (
                  <div className="p-3 rounded-lg bg-obsidian-900 border border-brass-500/30 flex items-center space-x-2.5 text-xs text-brass-300 font-mono">
                    <Shield className="w-4 h-4 text-brass-400 shrink-0" />
                    <span>The Business Owner automatically has supreme access to all existing and future store branches.</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Option 1: All Stores (*) */}
                    <div 
                      onClick={() => setUserForm({ ...userForm, assignedStoreIds: ['*'] })}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        userForm.assignedStoreIds?.includes('*')
                          ? 'bg-brass-500/10 border-brass-500/50 shadow-xs ring-1 ring-brass-500/30'
                          : 'bg-obsidian-900/60 border-obsidian-750 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          userForm.assignedStoreIds?.includes('*')
                            ? 'border-brass-400 bg-brass-500 text-obsidian-950'
                            : 'border-slate-600 bg-obsidian-950'
                        }`}>
                          {userForm.assignedStoreIds?.includes('*') && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-100">All Store Locations (*)</div>
                          <div className="text-[10px] text-slate-400 font-mono">Staff can log in and execute shifts at any branch node</div>
                        </div>
                      </div>
                    </div>

                    {/* Option 2: Specific Stores */}
                    <div 
                      onClick={() => {
                        if (userForm.assignedStoreIds?.includes('*')) {
                          setUserForm({
                            ...userForm,
                            assignedStoreIds: activeStores.length > 0 ? [activeStores[0].id] : []
                          });
                        }
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        !userForm.assignedStoreIds?.includes('*')
                          ? 'bg-obsidian-900 border-brass-500/50 shadow-xs ring-1 ring-brass-500/30'
                          : 'bg-obsidian-900/60 border-obsidian-750 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            !userForm.assignedStoreIds?.includes('*')
                              ? 'border-brass-400 bg-brass-500 text-obsidian-950'
                              : 'border-slate-600 bg-obsidian-950'
                          }`}>
                            {!userForm.assignedStoreIds?.includes('*') && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-100">Specific Store Branch(es) Only</div>
                            <div className="text-[10px] text-slate-400 font-mono">Restrict cashier to specific locations only</div>
                          </div>
                        </div>
                      </div>

                      {/* Store Checklist when Specific Stores mode is selected */}
                      {!userForm.assignedStoreIds?.includes('*') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-obsidian-800">
                          {activeStores.length === 0 ? (
                            <div className="text-xs text-slate-500 p-2 col-span-2 font-mono">
                              No store branches found. Please create stores in Multi-Store & Branches.
                            </div>
                          ) : (
                            activeStores.map((st) => {
                              const isChecked = userForm.assignedStoreIds?.includes(st.id);
                              return (
                                <div
                                  key={st.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const current = (userForm.assignedStoreIds || []).filter(id => id !== '*');
                                    let updated;
                                    if (isChecked) {
                                      if (current.length <= 1) {
                                        showToast('Staff must have at least one store assigned.');
                                        return;
                                      }
                                      updated = current.filter(id => id !== st.id);
                                    } else {
                                      updated = [...current, st.id];
                                    }
                                    setUserForm({ ...userForm, assignedStoreIds: updated });
                                  }}
                                  className={`p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                                    isChecked
                                      ? 'bg-brass-500/15 border-brass-500/40 text-slate-100'
                                      : 'bg-obsidian-950 border-obsidian-750 text-slate-400 hover:border-slate-600'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2">
                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                                      isChecked ? 'bg-brass-500 border-brass-400 text-obsidian-950' : 'border-slate-600 bg-obsidian-900'
                                    }`}>
                                      {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                    </div>
                                    <span className="font-semibold text-xs text-slate-200">{st.name}</span>
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-obsidian-900 text-brass-400 border border-obsidian-750">
                                    {st.code}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Granular Permission Matrix */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 block text-[11px] uppercase tracking-wider">
                    Granular Action Permissions Matrix (Allow / Deny)
                  </span>
                  <div className="space-x-2 text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() => {
                        const allTrue = {};
                        PERMISSION_DEFINITIONS.forEach(p => allTrue[p.key] = true);
                        setUserForm({ ...userForm, permissions: allTrue });
                      }}
                      className="text-brass-400 hover:underline"
                    >
                      Allow All
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allFalse = {};
                        PERMISSION_DEFINITIONS.forEach(p => allFalse[p.key] = false);
                        setUserForm({ ...userForm, permissions: allFalse });
                      }}
                      className="text-rose-400 hover:underline"
                    >
                      Deny All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-obsidian-800 rounded-xl p-3 bg-obsidian-950">
                  {PERMISSION_DEFINITIONS.map((perm) => {
                    const isAllowed = userForm.permissions[perm.key] === true;
                    return (
                      <div
                        key={perm.key}
                        onClick={() => {
                          setUserForm({
                            ...userForm,
                            permissions: {
                              ...userForm.permissions,
                              [perm.key]: !isAllowed
                            }
                          });
                        }}
                        className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition select-none ${
                          isAllowed
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-obsidian-900 border-obsidian-800 text-slate-400 hover:border-obsidian-700'
                        }`}
                      >
                        <div>
                          <div className="font-medium text-slate-200">{perm.label}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{perm.category}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isAllowed ? 'bg-emerald-500 text-obsidian-950' : 'bg-obsidian-800 text-slate-500'
                        }`}>
                          {isAllowed ? 'ALLOW' : 'DENY'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-4 border-t border-obsidian-800 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-obsidian-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold shadow-md shadow-brass-500/20 transition active:scale-95"
                >
                  {editingUser ? 'Save Changes' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE CUSTOM ROLE */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-900 border border-obsidian-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Shield className="w-5 h-5 text-brass-400" />
                <span>Create Custom Role</span>
              </h3>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Role Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lead Cashier & Keyholder"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded-lg px-3 py-2 text-slate-100 font-sans"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Role Description</label>
                <textarea
                  rows={2}
                  placeholder="Summary of responsibilities and permissions..."
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded-lg px-3 py-2 text-slate-100 font-sans"
                />
              </div>

              <div className="pt-3 border-t border-obsidian-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-obsidian-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE USER MODAL */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-obsidian-900 border border-rose-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-100 font-display">
                  Revoke Staff Account
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to permanently revoke and delete this staff member's account?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Employee:</span>
                <span className="text-slate-200 font-bold">{deleteConfirmUser.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email:</span>
                <span className="text-slate-300">{deleteConfirmUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">System Role:</span>
                <span className="text-brass-400 font-bold">{deleteConfirmUser.role}</span>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-obsidian-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 flex items-center space-x-1.5 transition active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteLoading ? 'Revoking Account...' : 'Confirm Revoke & Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

