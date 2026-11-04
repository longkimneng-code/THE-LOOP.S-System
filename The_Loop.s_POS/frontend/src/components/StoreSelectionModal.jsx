import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { Store, Check, AlertTriangle, X, MapPin, Phone, User, Cpu, Clock, Shield } from 'lucide-react';

export default function StoreSelectionModal() {
  const {
    isStoreModalOpen,
    setIsStoreModalOpen,
    stores,
    currentStore,
    switchStore,
    shiftInfo,
    register,
    setIsShiftModalOpen,
    cashierUser,
    currentUser,
    playBeep
  } = usePos();

  const [switchingId, setSwitchingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isStoreModalOpen) return null;

  const activeUser = cashierUser || currentUser;
  const isOwner = activeUser?.role === 'OWNER' || activeUser?.role === 'SUPER_ADMIN';
  const hasActiveShift = !!shiftInfo?.hasActiveShift;

  const handleSelectStore = async (store) => {
    if (store.id === currentStore?.id) {
      setIsStoreModalOpen(false);
      return;
    }

    if (hasActiveShift) {
      setErrorMessage(`Cannot switch store while an active shift is open on ${register?.code || 'register'}. Please close your active shift first.`);
      playBeep(400, 'sawtooth', 0.2);
      return;
    }

    setSwitchingId(store.id);
    setErrorMessage('');
    const result = await switchStore(store.id);
    setSwitchingId(null);

    if (!result.ok) {
      setErrorMessage(result.error || 'Failed to switch store location.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4 animate-in fade-in select-none">
      <div className="w-full max-w-xl bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="h-14 px-5 border-b border-obsidian-800 flex items-center justify-between bg-obsidian-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-brass-500/10 border border-brass-500/30 text-brass-400 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                Select Store Location
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Multi-Branch Architecture • Section 15 Access Control
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsStoreModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Shift Guard Warning Banner */}
        {hasActiveShift && (
          <div className="p-3 bg-amber-500/10 border-b border-amber-500/30 px-5 flex items-start space-x-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200 flex-1">
              <span className="font-bold">Active Shift Detected:</span> Cashier has an open shift (#
              {shiftInfo?.activeShift?.id || shiftInfo?.id || 'ACTIVE'}) on register{' '}
              <strong className="text-white">{register?.code || 'REG-01'}</strong> at{' '}
              <strong>{currentStore?.name || 'Current Store'}</strong>.
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                For financial accuracy, you must close or resolve this shift before switching locations.
              </p>
            </div>
            <button
              onClick={() => {
                setIsStoreModalOpen(false);
                setIsShiftModalOpen(true);
              }}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-obsidian-950 font-bold text-[11px] rounded-lg shrink-0 transition"
            >
              Close Shift
            </button>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/30 px-5 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Store List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Available Branches ({stores.length})
          </div>

          {stores.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 font-mono">
              No store branches configured. Contact business owner.
            </div>
          ) : (
            stores.map((store) => {
              const isCurrent = store.id === currentStore?.id;
              const isAssigned = isOwner || (activeUser?.assignedStoreIds || activeUser?.locations || []).includes('*') || (activeUser?.assignedStoreIds || activeUser?.locations || []).includes(store.id);

              return (
                <div
                  key={store.id}
                  onClick={() => isAssigned && !isCurrent && handleSelectStore(store)}
                  className={`p-4 rounded-xl border transition-all relative ${
                    isCurrent
                      ? 'bg-brass-500/10 border-brass-500/50 shadow-md shadow-brass-500/5'
                      : isAssigned
                      ? 'bg-obsidian-850 hover:bg-obsidian-800 border-obsidian-750 hover:border-slate-600 cursor-pointer'
                      : 'bg-obsidian-950 border-obsidian-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-100 font-display">
                          {store.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-obsidian-800 text-[10px] font-mono font-bold text-brass-400 border border-obsidian-700">
                          {store.code || 'ST'}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active Store
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono">
                        {store.address && (
                          <span className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            <span>{store.address}</span>
                          </span>
                        )}
                        {store.phone && (
                          <span className="flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{store.phone}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {isCurrent ? (
                      <div className="w-6 h-6 rounded-full bg-brass-500 text-obsidian-950 flex items-center justify-center font-bold">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <button
                        disabled={!isAssigned || hasActiveShift || switchingId === store.id}
                        className="px-3 py-1.5 rounded-lg bg-obsidian-800 hover:bg-brass-500 hover:text-obsidian-950 border border-obsidian-700 text-slate-300 text-xs font-bold transition disabled:opacity-40"
                      >
                        {switchingId === store.id ? 'Switching...' : 'Switch'}
                      </button>
                    )}
                  </div>

                  {/* Telemetry Footer */}
                  <div className="mt-3 pt-2.5 border-t border-obsidian-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center space-x-1">
                        <Cpu className="w-3 h-3 text-slate-500" />
                        <span>Registers: {store.registerCount || 1}</span>
                      </span>
                      {store.managerName && (
                        <span className="flex items-center space-x-1">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>Manager: {store.managerName}</span>
                        </span>
                      )}
                    </div>

                    {!isAssigned && (
                      <span className="text-rose-400 flex items-center space-x-1 font-sans">
                        <Shield className="w-3 h-3" />
                        <span>No location access</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-obsidian-900 border-t border-obsidian-800 px-5 flex items-center justify-between text-xs">
          <div className="text-[11px] text-slate-400">
            Logged in as <strong className="text-slate-200">{activeUser?.fullName}</strong> ({activeUser?.role})
          </div>
          <button
            onClick={() => setIsStoreModalOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-slate-300 font-medium transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

