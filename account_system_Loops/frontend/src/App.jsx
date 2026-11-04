import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Navigation from './components/Navigation';
import HomeDashboard from './components/HomeDashboard';
import DatePeriodReporting from './components/DatePeriodReporting';
import SalesCustomers from './components/SalesCustomers';
import BillsSuppliers from './components/BillsSuppliers';
import ImportsLandedCost from './components/ImportsLandedCost';
import ReportsStudio from './components/ReportsStudio';
import AccountingSettings from './components/AccountingSettings';
import GlobalNewModal from './components/GlobalNewModal';
import Toast from './components/Toast';
import { api } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [reportSubTab, setReportSubTab] = useState('pnl');
  const [dashboardData, setDashboardData] = useState(null);
  const [business, setBusiness] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Mode: 'SIMPLE' (Owner) vs 'ACCOUNTANT' (Auditor)
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('loops_finance_mode') || 'SIMPLE';
  });

  // Theme: 'dark' vs 'light'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('loops_finance_theme') || 'dark';
  });

  // Global "+ New" modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  // Private Triad Identity & RBAC Session State
  const [authSession, setAuthSession] = useState({
    checked: false,
    authenticated: false,
    user: null,
    error: null
  });

  useEffect(() => {
    const checkFinanceAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        localStorage.setItem('loops_auth_token', urlToken);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const token = localStorage.getItem('loops_auth_token');
      const cachedUser = typeof window !== 'undefined' ? (localStorage.getItem('loops_active_user') || localStorage.getItem('loops_auth_user')) : null;

      if (!token && !cachedUser) {
        setAuthSession({ checked: true, authenticated: false, user: null, error: 'Authentication required' });
        return;
      }

      try {
        let res = token ? await fetch('http://localhost:3002/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        }) : { ok: false };

        if (!res.ok) {
          const storedRefresh = typeof window !== 'undefined' ? localStorage.getItem('loops_refresh_token') : null;
          if (storedRefresh) {
            try {
              const refreshRes = await fetch('http://localhost:3002/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: storedRefresh })
              });
              const refreshData = await refreshRes.json();
              if (refreshRes.ok && refreshData.ok && refreshData.accessToken) {
                localStorage.setItem('loops_auth_token', refreshData.accessToken);
                if (refreshData.refreshToken) {
                  localStorage.setItem('loops_refresh_token', refreshData.refreshToken);
                }
                res = await fetch('http://localhost:3002/api/auth/me', {
                  headers: { Authorization: `Bearer ${refreshData.accessToken}` }
                });
              }
            } catch (re) {}
          }
        }

        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.user) {
            const user = data.user;
            const canAccess = user.role === 'OWNER' || user.role === 'SUPER_ADMIN' || user.role === 'FINANCE_ADMIN' || user.role === 'ACCOUNTANT' || user.role === 'PURCHASE_MANAGER' || user.appAccess?.finance || user.permissions?.accessFinanceApp;
            if (canAccess) {
              setAuthSession({ checked: true, authenticated: true, user, error: null });
            } else {
              setAuthSession({ checked: true, authenticated: false, user, error: 'Access Denied: Your staff account is not permitted to access Loops Finance.' });
            }
          } else if (cachedUser) {
            setAuthSession({ checked: true, authenticated: true, user: JSON.parse(cachedUser), error: null });
          } else {
            setAuthSession({ checked: true, authenticated: false, user: null, error: 'Invalid or expired session token.' });
          }
        } else if (cachedUser) {
          setAuthSession({ checked: true, authenticated: true, user: JSON.parse(cachedUser), error: null });
        } else {
          setAuthSession({ checked: true, authenticated: false, user: null, error: 'Session expired. Please log in again.' });
        }
      } catch (err) {
        // Fallback in case of local offline POS server
        setAuthSession({ 
          checked: true, 
          authenticated: true, 
          user: cachedUser ? JSON.parse(cachedUser) : { fullName: 'Finance Staff', role: 'FINANCE_ADMIN' }, 
          error: null 
        });
      }
    };

    checkFinanceAuth();
  }, []);

  useEffect(() => {
    localStorage.setItem('loops_finance_mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('loops_finance_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [dash, bus] = await Promise.all([
        api.getDashboard(),
        api.getBusiness()
      ]);
      setDashboardData(dash);
      setBusiness(bus.business);
    } catch (err) {
      console.error('Error loading initial finance data:', err);
      showToast(err.message, 'error');
    } finally {
      setIsInitialLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  if (!authSession.checked) {
    return (
      <div className="min-h-screen bg-[#0E1520] flex flex-col items-center justify-center space-y-4 text-slate-100 font-sans">
        <div className="w-12 h-12 rounded-xl bg-[#E5A93C]/20 text-[#E5A93C] border border-[#E5A93C]/30 flex items-center justify-center font-bold text-2xl animate-pulse">
          ∞
        </div>
        <p className="font-mono text-xs text-slate-400 tracking-wider">VERIFYING FINANCE ACCESS SESSION...</p>
      </div>
    );
  }

  if (!authSession.authenticated) {
    return (
      <div className="min-h-screen bg-[#0E1520] flex items-center justify-center p-6 text-slate-100 font-sans select-none">
        <div className="w-full max-w-md bg-[#16202E] border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-[#E5A93C]/10 text-[#E5A93C] border border-[#E5A93C]/20 flex items-center justify-center text-2xl font-bold mx-auto">
            🔒
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold uppercase tracking-wider text-slate-100 font-mono">
              Loops Finance & Imports
            </h1>
            <p className="text-xs text-slate-400">
              Private Enterprise Financial & Purchasing Platform
            </p>
          </div>
          {authSession.error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {authSession.error}
            </div>
          )}
          <p className="text-xs text-slate-500 leading-relaxed">
            All users must authenticate through The Loops Central Identity Portal before accessing finance or import ledgers.
          </p>
          <a
            href="http://localhost:5175"
            className="block w-full py-3 rounded-xl bg-[#E5A93C] hover:bg-[#d89c31] text-obsidian-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#E5A93C]/20"
          >
            Authenticate via The Loops Portal
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col transition-colors selection:bg-[#E5A93C] selection:text-black">
      
      {/* Top Navbar */}
      <Navbar
        mode={mode}
        setMode={setMode}
        theme={theme}
        setTheme={setTheme}
        business={business}
        onOpenNewModal={() => setIsNewModalOpen(true)}
      />

      {/* 6-Area Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        attentionCount={dashboardData?.needsAttention?.length || 0}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8">
        {isInitialLoading ? (
          <div className="py-24 text-center text-slate-400">
            <div className="w-10 h-10 border-2 border-[#E5A93C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-base font-bold text-white mb-1">Connecting to Loops Finance V3</h3>
            <p className="text-xs text-slate-500">Checking General Ledger & MySQL connection status...</p>
          </div>
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeDashboard
                dashboardData={dashboardData}
                mode={mode}
                onNavigateTab={(tab, subTab) => {
                  setActiveTab(tab);
                  if (subTab) setReportSubTab(subTab);
                }}
                onOpenNewModal={() => setIsNewModalOpen(true)}
              />
            )}

            {(activeTab === 'period' || activeTab === 'sales') && (
              <DatePeriodReporting
                mode={mode}
                onShowToast={showToast}
              />
            )}

            {activeTab === 'bills' && (
              <BillsSuppliers
                mode={mode}
                onShowToast={showToast}
              />
            )}

            {activeTab === 'imports' && (
              <ImportsLandedCost
                mode={mode}
                onShowToast={showToast}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsStudio
                mode={mode}
                onShowToast={showToast}
                initialTab={reportSubTab}
              />
            )}

            {activeTab === 'accounting' && (
              <AccountingSettings
                mode={mode}
                onShowToast={showToast}
                currentUser={authSession.user}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>The Loops System — Loops Finance V3 OS</span>
          <span className="font-mono text-[11px] text-slate-400">
            Precision Decimal(19,4) • MySQL Database • Single Source of Ledger Truth
          </span>
        </div>
      </footer>

      {/* Global "+ New" Action Modal */}
      <GlobalNewModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        mode={mode}
        onShowToast={showToast}
        onRefresh={loadInitialData}
        currentUser={authSession.user}
      />

      {/* Toast Feedback */}
      <Toast toast={toast} onClose={() => setToast(null)} />

    </div>
  );
}

