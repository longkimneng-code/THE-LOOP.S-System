import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Archive,
  RefreshCw,
  X,
  History,
  FileCheck,
  Building2,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';

export default function ResetStoreDataModal({
  isOpen,
  onClose,
  stores = [],
  currentStoreId,
  currentUser,
  authToken,
  onResetSuccess
}) {
  const [selectedStoreId, setSelectedStoreId] = useState(currentStoreId || stores[0]?.id || '');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successResult, setSuccessResult] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (currentStoreId) {
      setSelectedStoreId(currentStoreId);
    } else if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [currentStoreId, stores]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/ecosystem/reset-store-data/history?storeId=${encodeURIComponent(selectedStoreId || '')}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data.history || []);
      }
    } catch (e) {
      console.warn('Failed to load reset history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showHistory && isOpen) {
      fetchHistory();
    }
  }, [showHistory, isOpen, selectedStoreId]);

  if (!isOpen) return null;

  const targetStore = stores.find(s => s.id === selectedStoreId) || stores[0];
  const isConfirmed = confirmationInput.trim() === 'RESET STORE DATA';
  const canSubmit = isConfirmed && passwordInput.length > 0 && !isSubmitting;

  const handleExecuteReset = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/ecosystem/reset-store-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          storeId: selectedStoreId,
          confirmationText: confirmationInput.trim(),
          password: passwordInput,
          pin: passwordInput
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Reset failed.');
      }

      setSuccessResult(data);
      if (onResetSuccess) {
        onResetSuccess(data);
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setConfirmationInput('');
    setPasswordInput('');
    setErrorMessage('');
    setSuccessResult(null);
    setShowHistory(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-obsidian-900 border border-crimson-500/30 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-obsidian-800 bg-obsidian-950 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-crimson-500/10 text-crimson-400 border border-crimson-500/30 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-crimson-400 uppercase tracking-widest font-bold">
                Admin Backoffice • Ecosystem Security
              </div>
              <h2 className="text-base font-bold text-slate-100 font-sans">
                Reset Store Data
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-xl text-xs font-mono flex items-center space-x-1.5 transition-colors border ${
                showHistory 
                  ? 'bg-brass-500/10 border-brass-500/30 text-brass-400' 
                  : 'bg-obsidian-850 hover:bg-obsidian-800 border-obsidian-750 text-slate-400'
              }`}
              title="View Reset Audit History"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Audit History</span>
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-obsidian-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          
          {/* History View */}
          {showHistory ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-200 flex items-center space-x-2">
                  <Archive className="w-4 h-4 text-brass-400" />
                  <span>Permanent Reset Audit History</span>
                </h3>
                <button
                  onClick={fetchHistory}
                  disabled={loadingHistory}
                  className="px-2.5 py-1 rounded-lg bg-obsidian-800 hover:bg-obsidian-750 text-slate-300 font-mono text-[11px] flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingHistory ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {loadingHistory ? (
                <div className="p-8 text-center text-slate-500 font-mono">Loading audit history...</div>
              ) : historyLogs.length === 0 ? (
                <div className="p-8 text-center bg-obsidian-950 rounded-2xl border border-obsidian-800 text-slate-500 font-mono">
                  No previous reset records found for this company.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto font-mono">
                  {historyLogs.map(log => (
                    <div key={log.id} className="p-4 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">{log.store_name} ({log.store_id})</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {log.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>By: {log.performed_by_name}</span>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        Backup: {log.backup_file_path?.split(/[\\/]/).pop()} • Cleared: {log.records_cleared_count} records
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="w-full py-2.5 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 text-slate-300 font-bold"
              >
                Back to Reset Form
              </button>
            </div>
          ) : successResult ? (
            /* Success Screen */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-100 uppercase tracking-wide">
                  Store Data Successfully Reset
                </h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  {successResult.message}
                </p>
              </div>

              <div className="bg-obsidian-950 p-4 rounded-2xl border border-obsidian-800 text-left font-mono space-y-2 max-w-lg mx-auto">
                <div className="flex justify-between text-slate-400 pb-2 border-b border-obsidian-800">
                  <span>Store Name & ID:</span>
                  <span className="text-slate-200 font-bold">{successResult.store?.name} ({successResult.store?.id})</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Operational Records Cleared:</span>
                  <span className="text-crimson-400 font-bold">{successResult.recordsCleared} records</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Verified Backup Snapshot:</span>
                  <span className="text-brass-400 font-bold truncate max-w-[220px]">{successResult.backupFile}</span>
                </div>
                <div className="flex justify-between text-slate-400 pt-2 border-t border-obsidian-800">
                  <span>Owner Account & Credentials:</span>
                  <span className="text-emerald-400 font-bold">100% Intact & Active</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-8 py-3 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs uppercase shadow-lg shadow-brass-500/20"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            /* Active Reset Form */
            <form onSubmit={handleExecuteReset} className="space-y-5">
              
              {/* Store Selection */}
              <div>
                <label className="block font-mono text-[11px] text-slate-400 uppercase tracking-wider mb-1.5">
                  Select Target Store Location to Reset:
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-brass-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-crimson-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 font-sans outline-none cursor-pointer"
                  >
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code || s.id}) {s.is_hq || s.isDefault ? '• [HQ]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Only the business data for this specific branch will be cleared. Other stores remain untouched.
                </p>
              </div>

              {/* Explanatory Dual Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* What is cleared */}
                <div className="p-3.5 rounded-2xl bg-crimson-500/5 border border-crimson-500/20 space-y-2">
                  <div className="font-bold text-crimson-400 uppercase tracking-wider font-mono text-[10px] flex items-center space-x-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>What Will Be Removed:</span>
                  </div>
                  <ul className="text-slate-300 space-y-1 text-[11px] list-disc list-inside">
                    <li>POS shifts & register sessions</li>
                    <li>Completed & held sales orders</li>
                    <li>Cash movements & drawer float</li>
                    <li>Inventory balances (zeroed)</li>
                    <li>Stock movements & transfer history</li>
                    <li>Store expenses & supplier bills</li>
                    <li>Monthly revenue allocation records</li>
                  </ul>
                </div>

                {/* What remains unchanged */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                  <div className="font-bold text-emerald-400 uppercase tracking-wider font-mono text-[10px] flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>What Remains Safe & Intact:</span>
                  </div>
                  <ul className="text-slate-300 space-y-1 text-[11px] list-disc list-inside">
                    <li>Store Owner login & email ({currentUser?.email})</li>
                    <li>Owner password & PIN credentials</li>
                    <li>Company profile & registration</li>
                    <li>Store branch ID & registration</li>
                    <li>Employee accounts & permissions</li>
                    <li>Product master catalog & SKUs</li>
                    <li>All other stores' data</li>
                  </ul>
                </div>
              </div>

              {/* Backup Assurance Badge */}
              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800 flex items-center space-x-2 text-slate-400 text-[11px]">
                <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Automated Safety Backup:</strong> A complete verified snapshot of this store will be archived before any changes are committed.
                </span>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-crimson-500/10 border border-crimson-500/30 text-crimson-300 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Typed Confirmation Step */}
              <div className="space-y-1.5 pt-1 border-t border-obsidian-800">
                <label className="block font-mono text-[11px] text-slate-300">
                  Type <span className="text-crimson-400 font-bold">RESET STORE DATA</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="RESET STORE DATA"
                  className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-crimson-500 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-100 outline-none"
                />
              </div>

              {/* Owner Password Re-Authentication */}
              <div className="space-y-1.5">
                <label className="block font-mono text-[11px] text-slate-300 flex items-center justify-between">
                  <span>Store Owner Password or PIN:</span>
                  <span className="text-[10px] text-brass-400/80 font-mono">Password (e.g. password123) or PIN (7777)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter Store Owner password or 4-digit PIN"
                    className="w-full bg-obsidian-950 border border-obsidian-750 focus:border-crimson-500 rounded-xl pl-10 pr-10 py-2 text-sm text-slate-100 outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    title={showPassword ? "Hide password/PIN" : "Show password/PIN"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-3 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 text-slate-300 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
                    canSubmit 
                      ? 'bg-crimson-600 hover:bg-crimson-500 text-white shadow-lg shadow-crimson-600/30 active:scale-98 cursor-pointer' 
                      : 'bg-obsidian-800 text-slate-500 border border-obsidian-750 cursor-not-allowed opacity-60'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Backing Up & Resetting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Confirm Reset Store Data</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

