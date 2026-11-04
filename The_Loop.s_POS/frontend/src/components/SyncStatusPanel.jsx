import React from 'react';
import { useSync } from '../context/SyncContext';
import { usePos } from '../context/PosContext';
import { 
  X, 
  Activity, 
  RefreshCw, 
  Server, 
  CheckCircle, 
  AlertTriangle, 
  Database,
  ArrowRightLeft
} from 'lucide-react';

export default function SyncStatusPanel() {
  const { isSyncModalOpen, setIsSyncModalOpen } = usePos();
  const { triadStatus, isSyncing, triggerManualSync, lastSyncTime } = useSync();

  if (!isSyncModalOpen) return null;

  const { pos, stock, finance, syncStatus } = triadStatus;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-obsidian-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-brass-400" />
            <div>
              <div className="text-xs font-mono text-brass-400 uppercase tracking-wider">The Loops Backbone</div>
              <h3 className="text-base font-semibold text-slate-100">Triad Sync & Outbox Monitor</h3>
            </div>
          </div>
          <button
            onClick={() => setIsSyncModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Triad Nodes List */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Service Mesh Topology
            </div>

            {/* 1. POS Terminal */}
            <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-brass-500/10 text-brass-400 flex items-center justify-center font-bold text-xs">
                  POS
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">The Loop.s POS Terminal</div>
                  <div className="text-[11px] font-mono text-slate-500">Port 3002 (API) • Port 5175 (UI)</div>
                </div>
              </div>
              <span className="flex items-center space-x-1 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Running</span>
              </span>
            </div>

            {/* 2. Stock Management Loops */}
            <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                  STK
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">Stock Management Loops</div>
                  <div className="text-[11px] font-mono text-slate-500">Port 3000 (API) • Port 5173 (UI)</div>
                </div>
              </div>
              <span className={`flex items-center space-x-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                stock?.online
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stock?.online ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{stock?.online ? 'Connected' : 'Offline / Queued'}</span>
              </span>
            </div>

            {/* 3. Account System Loops */}
            <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs">
                  FIN
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">Loops Finance V3 (Accounting)</div>
                  <div className="text-[11px] font-mono text-slate-500">Port 3001 (API) • Port 5174 (UI)</div>
                </div>
              </div>
              <span className={`flex items-center space-x-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                finance?.online
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${finance?.online ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{finance?.online ? 'Connected' : 'Offline / Queued'}</span>
              </span>
            </div>
          </div>

          {/* Outbox Metrics Box */}
          <div className="p-4 rounded-xl bg-obsidian-850 border border-obsidian-750 flex items-center justify-between text-xs">
            <div>
              <div className="text-slate-400">Transactional Outbox Queue</div>
              <div className="text-slate-200 font-mono mt-0.5">
                <span className="text-brass-400 font-bold">{syncStatus?.pendingOutboxCount || 0}</span> events pending delivery
              </div>
            </div>

            <button
              onClick={triggerManualSync}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-lg bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Relaying...' : 'Relay Outbox'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-obsidian-800 bg-obsidian-950 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Resilient Transactional Outbox Engine</span>
          <span>Last ping: {lastSyncTime.toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}

