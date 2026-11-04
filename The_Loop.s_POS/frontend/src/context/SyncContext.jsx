import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [triadStatus, setTriadStatus] = useState({
    pos: { online: true, port: 3002 },
    stock: { online: false, port: 3000, message: 'Checking...' },
    finance: { online: false, port: 3001, message: 'Checking...' },
    syncStatus: { pendingOutboxCount: 0, publishedCount: 0 }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setTriadStatus(data);
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.warn('[SyncContext] Offline or backend unreachable');
    }
  }, []);

  const triggerManualSync = async () => {
    setIsSyncing(true);
    try {
      await fetch('/api/sync/relay', { method: 'POST' });
      await fetch('/api/catalog/sync', { method: 'POST' });
      await fetchStatus();
    } catch (err) {
      console.error('[SyncContext] Sync failed:', err);
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);

    // Setup Server-Sent Events (SSE)
    let eventSource;
    try {
      eventSource = new EventSource('/api/events/stream');
      eventSource.addEventListener('OUTBOX_PROCESSED', () => fetchStatus());
      eventSource.addEventListener('ORDER_COMPLETED', () => fetchStatus());
      eventSource.addEventListener('CATALOG_UPDATED', () => fetchStatus());
      eventSource.addEventListener('SHIFT_CLOSED', () => fetchStatus());
    } catch (e) {
      console.warn('[SSE] EventSource unavailable');
    }

    return () => {
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, [fetchStatus]);

  return (
    <SyncContext.Provider
      value={{
        triadStatus,
        isSyncing,
        lastSyncTime,
        triggerManualSync,
        refreshStatus: fetchStatus
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within SyncProvider');
  return context;
}

