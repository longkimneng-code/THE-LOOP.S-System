import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { useSync } from '../context/SyncContext';
import { X, UserPlus, Shield, CheckCircle, Sparkles } from 'lucide-react';

export default function UserManagementModal() {
  const { isUserModalOpen, setIsUserModalOpen, playBeep, stores } = usePos();
  const { refreshStatus } = useSync();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('CASHIER');
  const [pin, setPin] = useState('');
  const [assignedStoreIds, setAssignedStoreIds] = useState(['*']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isUserModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName || !email) {
      setErrorMsg('Full name and email are required');
      return;
    }
    if (pin && pin.length !== 4) {
      setErrorMsg('Cashier PIN must be exactly 4 digits');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          role,
          pin: pin || '1234',
          assignedStoreIds,
          locations: assignedStoreIds
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to create user');

      playBeep(1000, 'sine', 0.15);
      setSuccessMsg(
        `Staff account for "${fullName}" created! Automatically authorized for POS, Stock Management & Finance.`
      );
      refreshStatus();

      setTimeout(() => {
        setIsUserModalOpen(false);
        setFullName('');
        setEmail('');
        setPin('');
        setSuccessMsg('');
      }, 2200);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-obsidian-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-brass-400" />
            <div>
              <div className="text-xs font-mono text-brass-400 uppercase tracking-wider">Universal SSO Identity</div>
              <h3 className="text-base font-semibold text-slate-100">Create Staff Account</h3>
            </div>
          </div>
          <button
            onClick={() => setIsUserModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800 flex items-start space-x-2.5 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-brass-400 shrink-0 mt-0.5" />
            <span>
              Accounts created here automatically sync across <strong>The Loop.s POS</strong>, <strong>Stock Management Loops</strong>, and <strong>Loops Finance</strong>.
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Sokha Meas"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-brass-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Work Email</label>
            <input
              type="email"
              required
              placeholder="e.g. sokha@theloops.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-brass-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">System Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brass-500"
              >
                <option value="CASHIER">Cashier (POS)</option>
                <option value="STORE_MANAGER">Store Manager</option>
                <option value="SUPER_ADMIN">Executive Owner</option>
                <option value="INVENTORY_CLERK">Inventory Clerk</option>
                <option value="ACCOUNTANT">Accountant</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Cashier PIN (4 digits)</label>
              <input
                type="password"
                maxLength={4}
                placeholder="4821"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 text-center tracking-widest focus:outline-none focus:border-brass-500"
              />
            </div>
          </div>

          {/* Section 15.3: Dedicated Store / Location Access Selector */}
          <div className="space-y-2 pt-1 border-t border-obsidian-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                Store / Location Access (Section 15.3)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {assignedStoreIds.includes('*') ? 'All Stores' : `${assignedStoreIds.length} Selected`}
              </span>
            </div>

            <div className="bg-obsidian-950 p-2.5 rounded-xl border border-obsidian-800 space-y-2">
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignedStoreIds.includes('*')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setAssignedStoreIds(['*']);
                    } else {
                      setAssignedStoreIds(stores.length > 0 ? [stores[0].id] : []);
                    }
                  }}
                  className="rounded border-obsidian-700 text-brass-500 focus:ring-brass-500"
                />
                <span className="font-semibold text-brass-400">All Stores & Future Branches (*)</span>
              </label>

              {!assignedStoreIds.includes('*') && (
                <div className="pl-5 pt-1 space-y-1.5 border-t border-obsidian-850">
                  {stores.map((st) => (
                    <label key={st.id} className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignedStoreIds.includes(st.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignedStoreIds([...assignedStoreIds.filter(id => id !== '*'), st.id]);
                          } else {
                            setAssignedStoreIds(assignedStoreIds.filter(id => id !== st.id));
                          }
                        }}
                        className="rounded border-obsidian-700 text-brass-500 focus:ring-brass-500"
                      />
                      <span>{st.name} ({st.code})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs tracking-wide shadow-md transition-all mt-2"
          >
            {isSubmitting ? 'Provisioning Across Triad...' : 'Create & Authorize Across Triad'}
          </button>
        </form>
      </div>
    </div>
  );
}

