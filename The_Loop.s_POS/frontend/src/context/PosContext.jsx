import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PosContext = createContext(null);

export function PosProvider({ children }) {
  // Store & Catalog
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-Currency Engine (USD & KHR)
  const [exchangeRate, setExchangeRate] = useState(4000); // 1 USD = 4,000 KHR default
  const [displayCurrency, setDisplayCurrency] = useState('BOTH'); // 'USD', 'KHR', 'BOTH'
  const [rateHistory, setRateHistory] = useState([]);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);

  // Private Identity & RBAC Session State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authToken, setAuthToken] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null));
  const [currentUser, setCurrentUser] = useState(null);
  const [authView, setAuthView] = useState('LOGIN'); // 'LOGIN', 'REGISTER_OWNER', 'FORGOT_PASSWORD', 'RESET_PASSWORD'

  // URL Deep-Linking & Persistent Navigation Helpers
  const resolveViewFromUrl = () => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/stock')) return 'STOCK';
    if (path.startsWith('/finance') || path.startsWith('/account')) return 'FINANCE';
    if (path.startsWith('/admin')) return 'ADMIN';
    if (path.startsWith('/pos')) return 'POS';
    return null;
  };

  const resolveTabFromUrl = () => {
    if (typeof window === 'undefined') return 'REGISTER';
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/hold') || path.includes('/saved-orders')) return 'HOLD';
    if (path.includes('/shifts')) return 'SHIFTS';
    if (path.includes('/dashboard')) return 'DASHBOARD';
    if (path.includes('/history')) return 'HISTORY';
    if (path.includes('/hardware')) return 'HARDWARE';
    if (path.includes('/users')) return 'USERS';
    const saved = localStorage.getItem('loops_pos_tab');
    if (saved) return saved;
    return 'REGISTER';
  };

  const [appView, setAppViewState] = useState(() => {
    return resolveViewFromUrl() || (typeof window !== 'undefined' ? localStorage.getItem('loops_active_app_view') : null) || 'POS';
  });

  // Active View Tab: 'REGISTER', 'DASHBOARD', 'HISTORY', 'HARDWARE', 'USERS', 'HOLD', 'SHIFTS'
  const [activeTab, setActiveTabState] = useState(() => {
    return resolveTabFromUrl();
  });

  const setAppView = (view, subPath = '') => {
    setAppViewState(view);
    if (typeof window !== 'undefined') {
      localStorage.setItem('loops_active_app_view', view);
      let targetPath = '/pos';
      if (view === 'STOCK') targetPath = subPath ? `/stock/${subPath.replace(/^\//, '')}` : '/stock';
      else if (view === 'FINANCE') targetPath = subPath ? `/finance/${subPath.replace(/^\//, '')}` : '/finance';
      else if (view === 'ADMIN') targetPath = subPath ? `/admin/${subPath.replace(/^\//, '')}` : '/admin';
      else if (view === 'POS') {
        const tabLower = (subPath || activeTab).toLowerCase();
        if (tabLower === 'register' || tabLower === 'new_sale') targetPath = '/pos';
        else targetPath = `/pos/${tabLower}`;
      }

      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view, subPath }, '', targetPath);
      }
    }
  };

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('loops_pos_tab', tab);
      if (appView === 'POS') {
        const tabLower = tab.toLowerCase();
        const targetPath = (tabLower === 'register' || tabLower === 'new_sale') ? '/pos' : `/pos/${tabLower}`;
        if (window.location.pathname !== targetPath) {
          window.history.pushState({ view: 'POS', tab }, '', targetPath);
        }
      }
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const v = resolveViewFromUrl();
      if (v) setAppViewState(v);
      const t = resolveTabFromUrl();
      setActiveTabState(t);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (typeof window !== 'undefined') {
    window.__loops_setAppView = setAppView;
    window.setAppView = setAppView;
    globalThis.setAppView = setAppView;
  }
  const [orgStatus, setOrgStatus] = useState({ initialized: true, ownerRegistered: true, businessName: 'The Loops Retail' });

  // Cashier Session & Security
  const [cashierUser, setCashierUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('loops_active_user');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return {
      id: 'usr-owner-83bbcc',
      fullName: 'long kimneng',
      email: 'neng@gmail.com',
      role: 'OWNER',
      permissions: { canSell: true, canVoid: true, canOverrideDiscount: true, canManageShifts: true }
    };
  });
  const [isPinLockOpen, setIsPinLockOpen] = useState(false);

  // Active Register & Shift
  const [register, setRegister] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('loops_active_register');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return { id: 'reg-loc01-01', code: 'REG-01', name: 'Front Counter 01' };
  });
  const [shiftInfo, setShiftInfo] = useState(null);

  // Section 15: Multi-Store & Branch Architecture State
  const [stores, setStores] = useState([]);
  const [currentStore, setCurrentStore] = useState(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);

  // Cart & Line Items
  const [cartItems, setCartItems] = useState([]);
  const [orderDiscountPct, setOrderDiscountPct] = useState(0);
  const [customer, setCustomer] = useState(null);
  const [activeSavedOrderId, setActiveSavedOrderId] = useState(null);

  // Parked & Saved Orders
  const [parkedCarts, setParkedCarts] = useState([]);
  const [isSaveOrderModalOpen, setIsSaveOrderModalOpen] = useState(false);

  // Modals
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isCashMovementOpen, setIsCashMovementOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Variant Picker Modal
  const [selectedProductForVariant, setSelectedProductForVariant] = useState(null);

  // Transaction Detail Modal
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isTransactionDetailOpen, setIsTransactionDetailOpen] = useState(false);

  // Hardware Config
  const [hardwareConfig, setHardwareConfig] = useState(null);

  // App Switcher Dropdown
  const [isAppSwitcherOpen, setIsAppSwitcherOpen] = useState(false);

  // Permission Checker across Cashier and Logged In User
  const hasPermission = useCallback((permKey) => {
    const active = cashierUser || currentUser;
    if (!active) return false;
    if (active.role === 'OWNER' || active.role === 'SUPER_ADMIN' || active.role === 'POS_ADMIN') return true;
    return !!active.permissions?.[permKey];
  }, [currentUser, cashierUser]);

  // Check Organization Status
  const refreshOrgStatus = useCallback(async () => {
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/auth/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setOrgStatus(data);
      }
    } catch (e) {
      console.warn('[Auth] Could not check organization status');
    }
  }, [authToken]);

  // Validate active session token
  const checkAuthSession = useCallback(async () => {
    let token = typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null;
    if (!token) {
      setIsAuthenticated(false);
      setAuthLoading(false);
      refreshOrgStatus();
      return;
    }

    try {
      let res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Auto-refresh using Refresh Token if Access Token expired per RFC 8725
      if (!res.ok) {
        const storedRefresh = typeof window !== 'undefined' ? localStorage.getItem('loops_refresh_token') : null;
        if (storedRefresh) {
          try {
            const refreshRes = await fetch('/api/auth/refresh', {
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
              token = refreshData.accessToken;
              res = await fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${refreshData.accessToken}` }
              });
            }
          } catch (re) {}
        }
      }

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.user) {
          localStorage.setItem('loops_active_user', JSON.stringify(data.user));
          setCurrentUser(data.user);
          setCashierUser(data.user);
          setIsAuthenticated(true);
          setAuthToken(token);
          loadStores(token, data.user);
          fetch('/api/auth/status', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(orgData => setOrgStatus(orgData))
            .catch(() => {});
          const currentUrlView = resolveViewFromUrl();
          const hasBackoffice = data.user.role === 'OWNER' || data.user.role === 'SUPER_ADMIN' || data.user.role === 'POS_ADMIN' || data.user.role === 'STORE_MANAGER' || data.user.permissions?.accessBackoffice || data.user.permissions?.manageEmployees || data.user.permissions?.accessStockApp || data.user.permissions?.accessFinanceApp || data.user.permissions?.viewFinancialReports;
          if (currentUrlView === 'ADMIN' && !hasBackoffice) {
            setAppView('POS');
          } else if (currentUrlView) {
            setAppView(currentUrlView);
          } else {
            const savedView = localStorage.getItem('loops_active_app_view');
            if (savedView === 'ADMIN' && !hasBackoffice) {
              setAppView('POS');
            } else if (savedView) {
              setAppView(savedView);
            } else if (!hasBackoffice) {
              setAppView('POS');
            } else {
              setAppView('ADMIN');
            }
          }
        } else {
          // If server returned non-OK user, check if we have cached active user before signing out
          const cachedUser = typeof window !== 'undefined' ? localStorage.getItem('loops_active_user') : null;
          if (cachedUser) {
            try {
              const u = JSON.parse(cachedUser);
              setCurrentUser(u);
              setCashierUser(u);
              setIsAuthenticated(true);
            } catch (e) {
              setIsAuthenticated(false);
            }
          } else {
            localStorage.removeItem('loops_auth_token');
            localStorage.removeItem('loops_refresh_token');
            setIsAuthenticated(false);
            setCurrentUser(null);
          }
        }
      } else {
        // If /api/auth/me failed and refresh couldn't succeed
        const errJson = await res.json().catch(() => ({}));
        const isRevoked = errJson?.error?.includes('suspended') || errJson?.error?.includes('revoked');
        const cachedUser = typeof window !== 'undefined' ? localStorage.getItem('loops_active_user') : null;

        if (isRevoked || !cachedUser) {
          localStorage.removeItem('loops_auth_token');
          localStorage.removeItem('loops_refresh_token');
          localStorage.removeItem('loops_active_user');
          setIsAuthenticated(false);
          setCurrentUser(null);
        } else {
          // Retain authenticated session using offline cached credentials
          try {
            const u = JSON.parse(cachedUser);
            setCurrentUser(u);
            setCashierUser(u);
            setIsAuthenticated(true);
            setAuthToken(token);
          } catch (e) {
            setIsAuthenticated(false);
          }
        }
      }
    } catch (e) {
      console.warn('[Auth] Session validation failed:', e);
      // Offline resilience: keep user authenticated if cached user exists
      const cachedUser = typeof window !== 'undefined' ? localStorage.getItem('loops_active_user') : null;
      if (cachedUser) {
        try {
          const u = JSON.parse(cachedUser);
          setCurrentUser(u);
          setCashierUser(u);
          setIsAuthenticated(true);
        } catch (pe) {
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } finally {
      setAuthLoading(false);
      refreshOrgStatus();
    }
  }, [refreshOrgStatus]);

  // Login handler
  const login = async ({ identifier, password, pin, companyCode, organizationId, storeId }) => {
    try {
      const endpoint = pin ? '/api/auth/pin' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, pin, companyCode, organizationId, storeId, app: 'POS' })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        localStorage.setItem('loops_auth_token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('loops_refresh_token', data.refreshToken);
        }
        localStorage.setItem('loops_active_user', JSON.stringify(data.user));
        if (data.organization && data.organization.companyCode) {
          localStorage.setItem('loops_paired_company', JSON.stringify({
            id: data.organization.id,
            name: data.organization.name,
            companyCode: data.organization.companyCode
          }));
        }
        localStorage.removeItem('loops_selected_store_id');
        setAuthToken(data.token);
        setCurrentUser(data.user);
        setCashierUser(data.user);
        setIsAuthenticated(true);

        const hasBackoffice = data.redirectUrl === '/admin' || data.user.role === 'OWNER' || data.user.role === 'SUPER_ADMIN' || data.user.role === 'POS_ADMIN' || data.user.role === 'STORE_MANAGER' || data.user.permissions?.accessBackoffice || data.user.permissions?.manageEmployees || data.user.permissions?.accessStockApp || data.user.permissions?.accessFinanceApp || data.user.permissions?.viewFinancialReports;

        if (hasBackoffice) {
          // Direct to Admin Dashboard at the first page (Operations Overview)
          setAppView('ADMIN');
          if (typeof window !== 'undefined') {
            localStorage.setItem('loops_admin_tab', 'OVERVIEW');
            window.history.replaceState({}, '', '/admin');
          }
        } else {
          // Direct to POS at New Sale
          clearCart();
          setActiveSavedOrderId(null);
          setAppView('POS');
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/pos');
          }
        }

        loadStores(data.token, data.user);
        fetchCatalog(data.token);
        fetchShift();
        playBeep(1200, 'sine', 0.1);
        return { ok: true, user: data.user, redirectUrl: data.redirectUrl };
      }
      return { ok: false, error: data.error || 'Authentication failed' };
    } catch (err) {
      return { ok: false, error: err.message || 'Network connection failed' };
    }
  };

  // Logout handler
  const logout = async () => {
    const token = (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null) || authToken;
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('loops_auth_token');
      localStorage.removeItem('loops_refresh_token');
      localStorage.removeItem('loops_active_user');
      localStorage.removeItem('loops_selected_store_id');
    }
    setAuthToken(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setStores([]);
    setCurrentStore(null);
    setCartItems([]);
    setShiftInfo(null);
    setAppView('POS');
    setAuthView('LOGIN');
    playBeep(440, 'triangle', 0.1);
  };

  // Register Business Organization
  const registerBusiness = async (form) => {
    try {
      const res = await fetch('/api/auth/register-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (data.organization) {
          localStorage.setItem('loops_paired_company', JSON.stringify({
            id: data.organization.id,
            name: data.organization.name,
            companyCode: data.organization.companyCode,
            currency: data.organization.currency
          }));
        }
        if (data.token) {
          localStorage.setItem('loops_auth_token', data.token);
          localStorage.removeItem('loops_selected_store_id');
          setAuthToken(data.token);
        }
        if (data.refreshToken) {
          localStorage.setItem('loops_refresh_token', data.refreshToken);
        }
        if (data.user) {
          localStorage.setItem('loops_active_user', JSON.stringify(data.user));
          setCurrentUser(data.user);
          setCashierUser(data.user);
          setIsAuthenticated(true);
          setAppView('ADMIN');
        }
        refreshOrgStatus();
        loadStores(data.token);
        fetchCatalog(data.token);
        fetchShift();
        playBeep(1200, 'sine', 0.15);
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Registration failed' };
    } catch (err) {
      return { ok: false, error: err.message || 'Network error during registration' };
    }
  };

  // Fetch Hardware Configuration
  const fetchHardwareConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/devices');
      if (res.ok) {
        const data = await res.json();
        setHardwareConfig(data);
      }
    } catch (e) {
      console.warn('[Hardware] Failed to load hardware settings');
    }
  }, []);

  // Update Hardware Configuration
  const updateHardwareConfig = async (newConfig) => {
    try {
      const res = await fetch('/api/devices/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        const data = await res.json();
        setHardwareConfig(data.hardware);
        playBeep(900, 'sine', 0.1);
        return { ok: true };
      }
      return { ok: false };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Reprint Receipt by Order Number
  const reprintReceipt = async (orderNumber) => {
    try {
      const res = await fetch(`/api/orders/${orderNumber}/receipt`);
      if (res.ok) {
        const data = await res.json();
        setActiveReceipt(data.receipt);
        setIsReceiptOpen(true);
        playBeep(1100, 'sine', 0.1);
        return { ok: true, receipt: data.receipt };
      }
      return { ok: false, error: 'Could not load receipt for printing' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Audio Beep Feedback using Web Audio API
  const playBeep = (freq = 880, type = 'sine', duration = 0.08) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio not permitted or supported
    }
  };

  // Fetch Currency
  const fetchCurrency = useCallback(async () => {
    try {
      const res = await fetch('/api/currency');
      if (res.ok) {
        const data = await res.json();
        setExchangeRate(Number(data.exchangeRate) || 4000);
        setRateHistory(data.rateHistory || []);
      }
    } catch (err) {
      console.warn('[Currency] Failed to fetch currency rates');
    }
  }, []);

  // Update Exchange Rate
  const updateExchangeRate = async (newRate) => {
    try {
      const res = await fetch('/api/currency/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchangeRate: Number(newRate),
          updatedBy: cashierUser.fullName || 'Cashier'
        })
      });
      if (res.ok) {
        setExchangeRate(Number(newRate));
        fetchCurrency();
        playBeep(1000, 'sine', 0.1);
        return { ok: true };
      }
      return { ok: false, error: 'Failed to update rate' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  // Fetch Catalog
  const fetchCatalog = useCallback(async (tokenOverride, storeIdOverride) => {
    try {
      const token = tokenOverride || authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const storeId = storeIdOverride || currentStore?.id || (typeof window !== 'undefined' ? localStorage.getItem('loops_selected_store_id') : null) || 'loc-01';
      const res = await fetch(`/api/catalog?storeId=${encodeURIComponent(storeId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        const cats = Array.from(new Set((data.products || []).map(p => p.category).filter(Boolean)));
        setCategories(cats);
      }
    } catch (err) {
      console.error('[Catalog] Failed to load catalog:', err);
    }
  }, [authToken, currentStore?.id]);

  // Fetch Current Shift
  const fetchShift = useCallback(async () => {
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const params = new URLSearchParams();
      if (register?.id && register.id !== 'reg-01') params.set('registerId', register.id);
      if (cashierUser?.id) params.set('cashierId', cashierUser.id);
      else if (currentUser?.id) params.set('cashierId', currentUser.id);
      if (currentStore?.id) params.set('storeId', currentStore.id);

      const qs = params.toString();
      const res = await fetch(`/api/shifts/current${qs ? '?' + qs : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setShiftInfo(data);
        if (data.register) setRegister(data.register);
      }
    } catch (err) {
      console.error('[Shift] Failed to load shift:', err);
    }
  }, [authToken, register?.id, cashierUser?.id, currentUser?.id, currentStore?.id]);

  // Multi-Store Management (Section 15.7)
  const canUserAccessStore = useCallback((storeId) => {
    const active = cashierUser || currentUser;
    if (!active || !storeId) return false;
    if (active.role === 'OWNER' || active.role === 'SUPER_ADMIN') return true;
    const assigned = active.assignedStoreIds || active.locations || [];
    if (assigned.includes('*')) return true;
    return assigned.includes(storeId);
  }, [currentUser, cashierUser]);

  const loadStores = useCallback(async (tokenOverride, userOverride) => {
    try {
      const token = tokenOverride || authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const activeUser = userOverride || cashierUser || currentUser;
      const res = await fetch('/api/stores', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const storeList = await res.json();
        setStores(storeList);
        if (storeList.length > 0) {
          let targetStore = null;

          // 1. If active user has an active shift at a store, prioritize that store!
          if (activeUser?.id) {
            try {
              const shiftRes = await fetch(`/api/shifts/current?cashierId=${encodeURIComponent(activeUser.id)}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
              });
              if (shiftRes.ok) {
                const shiftData = await shiftRes.json();
                if (shiftData.hasActiveShift && shiftData.shift?.storeId) {
                  const match = storeList.find(s => s.id === shiftData.shift.storeId);
                  if (match) targetStore = match;
                }
              }
            } catch (e) {}
          }

          // 2. If no active shift, check user-scoped storage
          if (!targetStore && typeof window !== 'undefined' && activeUser?.id) {
            const userStoredId = localStorage.getItem(`loops_selected_store_${activeUser.id}`);
            if (userStoredId) {
              const match = storeList.find(s => s.id === userStoredId);
              if (match) targetStore = match;
            }
          }

          // 3. Fallback to first authorized store in list
          if (!targetStore) {
            targetStore = storeList[0];
          }

          setCurrentStore(targetStore);
          if (targetStore && typeof window !== 'undefined' && activeUser?.id) {
            localStorage.setItem(`loops_selected_store_${activeUser.id}`, targetStore.id);
            localStorage.setItem('loops_selected_store_id', targetStore.id);
          }

          if (targetStore) {
            fetch(`/api/stores/${targetStore.id}/registers`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
              .then(r => r.ok ? r.json() : [])
              .then(regs => {
                if (regs && regs.length > 0) {
                  setRegister(regs[0]);
                }
              })
              .catch(() => {});
          }
        } else {
          setCurrentStore(null);
        }
      }
    } catch (err) {
      console.warn('[Stores] Failed to load stores list:', err);
    }
  }, [authToken, cashierUser?.id, currentUser?.id]);

  const switchStore = async (newStoreId) => {
    // 1. Validate user's access
    const active = cashierUser || currentUser;
    if (active && active.role !== 'OWNER' && active.role !== 'SUPER_ADMIN') {
      const assigned = active.assignedStoreIds || active.locations || [];
      if (!assigned.includes('*') && !assigned.includes(newStoreId)) {
        const msg = `Access Denied: You are not authorized to access store #${newStoreId}`;
        alert(msg);
        return { ok: false, error: msg };
      }
    }

    const targetStore = stores.find(s => s.id === newStoreId);
    if (!targetStore) return { ok: false, error: 'Store not found' };

    setCurrentStore(targetStore);
    if (typeof window !== 'undefined' && active?.id) {
      localStorage.setItem(`loops_selected_store_${active.id}`, newStoreId);
      localStorage.setItem('loops_selected_store_id', newStoreId);
    }

    // 2. Load registers for the selected store
    let targetRegister = null;
    try {
      const regRes = await fetch(`/api/stores/${newStoreId}/registers`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (regRes.ok) {
        const regs = await regRes.json();
        if (regs && regs.length > 0) {
          targetRegister = regs[0];
          setRegister(regs[0]);
        }
      }
    } catch (e) {
      console.warn('[Store Switch] Error loading registers:', e);
    }

    // 3. Fetch shift strictly for this user and the target store
    try {
      const params = new URLSearchParams();
      if (targetRegister?.id) params.set('registerId', targetRegister.id);
      if (active?.id) params.set('cashierId', active.id);
      params.set('storeId', newStoreId);

      const shiftRes = await fetch(`/api/shifts/current?${params.toString()}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (shiftRes.ok) {
        const shiftData = await shiftRes.json();
        setShiftInfo(shiftData);
      }
    } catch (e) {
      console.warn('[Store Switch] Error loading shift:', e);
    }

    // 4. Reset active cart, reload catalog for new store, and close modal
    setCartItems([]);
    setCustomer(null);
    setIsStoreModalOpen(false);
    fetchCatalog(null, newStoreId);
    playBeep(1000, 'sine', 0.1);
    return { ok: true, store: targetStore };
  };

  // Fetch Parked Carts
  const fetchParked = useCallback(async () => {
    try {
      const res = await fetch('/api/orders/parked');
      if (res.ok) {
        const list = await res.json();
        setParkedCarts(list);
      }
    } catch (e) {
      // Silent catch
    }
  }, []);

  // Failsafe: Guarantee authLoading clears within 1.5 seconds regardless of network
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__loops_setAppView = setAppView;
    }
    const timer = setTimeout(() => {
      setAuthLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    checkAuthSession();
    loadStores();
    fetchCurrency();
    fetchCatalog();
    fetchShift();
    fetchParked();
    fetchHardwareConfig();

    // Auto-sync polling every 4 seconds to guarantee zero lag when products added in Stock Management
    const interval = setInterval(() => {
      fetchCatalog();
    }, 4000);

    return () => clearInterval(interval);
  }, [checkAuthSession, loadStores, fetchCurrency, fetchCatalog, fetchShift, fetchParked, fetchHardwareConfig]);

  // Proactive background sliding session renewal every 10 minutes & on tab visibility
  useEffect(() => {
    const silentRenew = async () => {
      const storedRefresh = typeof window !== 'undefined' ? localStorage.getItem('loops_refresh_token') : null;
      if (storedRefresh) {
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
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
            setAuthToken(refreshData.accessToken);
          }
        } catch (e) {
          // Silent catch
        }
      }
    };

    // Sliding session renewal: every 3.5 minutes (aligns with 5-minute access token TTL) & on tab visibility
    const tokenRefreshInterval = setInterval(silentRenew, 3.5 * 60 * 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentRenew();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(tokenRefreshInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Cart Management (Stock-enforced: cannot add or sell over available inventory)
  const addToCart = (product, variant) => {
    const targetSku = variant ? variant.sku : (product.variants?.[0]?.sku || product.code);
    const available = variant
      ? (typeof variant.available === 'number' ? variant.available : (variant.onHand || 0))
      : (typeof product.available === 'number' ? product.available : (product.variants?.[0]?.available || 0));

    if (available <= 0) {
      playBeep(250, 'sawtooth', 0.15);
      alert(`Out of Stock: "${product.name}" has 0 units available in stock at ${currentStore?.name || 'this store location'}. Cannot add to cart.`);
      return false;
    }

    let limitReached = false;
    let currentInCart = 0;

    setCartItems(prev => {
      const existingIdx = prev.findIndex(item => item.variantSku === targetSku);

      if (existingIdx >= 0) {
        currentInCart = prev[existingIdx].quantity;
        if (currentInCart >= available) {
          limitReached = true;
          return prev;
        }
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }

      const itemPrice = variant ? variant.price : (product.basePrice || 25.00);
      const itemTitle = variant ? `${product.name} — ${variant.title}` : product.name;

      return [
        ...prev,
        {
          productId: product.id,
          variantSku: targetSku,
          itemTitle,
          name: product.name,
          category: product.category,
          unitPrice: itemPrice,
          quantity: 1,
          lineDiscount: 0,
          image: product.image || product.imageUrl || '🏷️',
          imageUrl: product.imageUrl || '',
          maxAvailable: available
        }
      ];
    });

    if (limitReached) {
      playBeep(250, 'sawtooth', 0.15);
      alert(`Stock Limit Reached: Only ${available} unit(s) of "${product.name}" available in stock at ${currentStore?.name || 'this location'}. You already have ${currentInCart} in your cart. Cannot add more.`);
      return false;
    }

    playBeep(920, 'sine', 0.06);
    return true;
  };

  const updateQuantity = (sku, delta) => {
    let limitReached = false;
    let availableCount = 0;
    let itemName = '';

    setCartItems(prev => {
      return prev
        .map(item => {
          if (item.variantSku === sku) {
            const maxAvail = typeof item.maxAvailable === 'number' ? item.maxAvailable : 999;
            const newQty = item.quantity + delta;

            if (delta > 0 && newQty > maxAvail) {
              limitReached = true;
              availableCount = maxAvail;
              itemName = item.itemTitle || item.name;
              return item;
            }

            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });

    if (limitReached) {
      playBeep(250, 'sawtooth', 0.15);
      alert(`Stock Limit Reached: Cannot add more. Only ${availableCount} unit(s) available in stock for "${itemName}".`);
      return;
    }

    playBeep(700, 'sine', 0.04);
  };

  const removeFromCart = (sku) => {
    playBeep(440, 'triangle', 0.08);
    setCartItems(prev => prev.filter(item => item.variantSku !== sku));
  };

  const applyLineDiscount = (sku, discountAmt) => {
    setCartItems(prev =>
      prev.map(item => (item.variantSku === sku ? { ...item, lineDiscount: Number(discountAmt) || 0 } : item))
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setOrderDiscountPct(0);
    setCustomer(null);
    setActiveSavedOrderId(null);
  };

  const resumeSavedOrder = async (orderId) => {
    try {
      const res = await fetch(`/api/orders/saved/${orderId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashierUserId: cashierUser?.id })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to resume order');
      }

      setCartItems(data.order.items || []);
      setCustomer(data.order.customer || null);
      setActiveSavedOrderId(data.order.id);
      setActiveTab('REGISTER');
      playBeep(1100, 'sine', 0.1);
      return { ok: true, order: data.order };
    } catch (err) {
      playBeep(320, 'sawtooth', 0.2);
      return { ok: false, error: err.message };
    }
  };

  // Calculations in USD
  const subtotal = cartItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const totalLineDiscounts = cartItems.reduce((acc, item) => acc + (item.lineDiscount || 0), 0);
  const orderDiscountAmount = (subtotal - totalLineDiscounts) * (Number(orderDiscountPct) / 100);
  const totalDiscount = totalLineDiscounts + orderDiscountAmount;
  const taxableSubtotal = Math.max(0, subtotal - totalDiscount);
  const taxTotal = taxableSubtotal * 0.10; // 10% VAT
  const grandTotal = taxableSubtotal + taxTotal;

  // Currency Helpers
  const toKhr = (usdVal) => Math.round((Number(usdVal) || 0) * exchangeRate);
  const toUsd = (khrVal) => Number(((Number(khrVal) || 0) / exchangeRate).toFixed(2));

  const formatPrice = (usdVal) => {
    const usd = Number(usdVal) || 0;
    const khr = toKhr(usd);
    if (displayCurrency === 'USD') return `$${usd.toFixed(2)}`;
    if (displayCurrency === 'KHR') return `${khr.toLocaleString()} ៛`;
    return `$${usd.toFixed(2)} • ${khr.toLocaleString()} ៛`;
  };

  // Park / Hold Cart
  const parkCurrentCart = async (note = '') => {
    if (cartItems.length === 0) return;
    try {
      const res = await fetch('/api/orders/park', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems,
          note,
          customerName: customer?.name,
          cashierUserId: cashierUser?.id
        })
      });
      if (res.ok) {
        clearCart();
        fetchParked();
      }
    } catch (e) {
      console.error('Failed to park cart:', e);
    }
  };

  const recallParkedCart = async (parkedId) => {
    try {
      const res = await fetch('/api/orders/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parkedId })
      });
      if (res.ok) {
        const data = await res.json();
        setCartItems(data.cart.items || []);
        fetchParked();
      }
    } catch (e) {
      console.error('Failed to recall cart:', e);
    }
  };

  // Cashier Switch via PIN
  const unlockWithPin = async (pin) => {
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (data.organization) {
          localStorage.setItem('loops_paired_company', JSON.stringify({
            id: data.organization.id,
            name: data.organization.name,
            companyCode: data.organization.companyCode,
            currency: data.organization.currency
          }));
        }
        if (data.token) {
          localStorage.setItem('loops_auth_token', data.token);
          setAuthToken(data.token);
        }
        if (data.refreshToken) {
          localStorage.setItem('loops_refresh_token', data.refreshToken);
        }
        if (data.user) {
          localStorage.setItem('loops_active_user', JSON.stringify(data.user));
        }
        setCurrentUser(data.user);
        setCashierUser(data.user);
        setIsAuthenticated(true);
        setIsPinLockOpen(false);
        playBeep(1046, 'sine', 0.1);
        return { ok: true, user: data.user };
      }
      return { ok: false, error: data.error || 'Invalid PIN' };
    } catch (e) {
      return { ok: false, error: 'Network authentication error' };
    }
  };

  return (
    <PosContext.Provider
      value={{
        // Authentication & Private Identity Session
        isAuthenticated,
        setIsAuthenticated,
        authLoading,
        authToken,
        currentUser,
        setCurrentUser,
        authView,
        setAuthView,
        appView,
        setAppView,
        orgStatus,
        refreshOrgStatus,
        checkAuthSession,
        login,
        logout,
        registerBusiness,

        // Store & Catalog
        products,
        categories,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        refreshCatalog: fetchCatalog,

        // Currency Management (USD & KHR)
        exchangeRate,
        setExchangeRate,
        displayCurrency,
        setDisplayCurrency,
        rateHistory,
        isCurrencyModalOpen,
        setIsCurrencyModalOpen,
        updateExchangeRate,
        toKhr,
        toUsd,
        formatPrice,

        // Cashier & Register
        cashierUser,
        setCashierUser,
        register,
        shiftInfo,
        refreshShift: fetchShift,
        isPinLockOpen,
        setIsPinLockOpen,
        unlockWithPin,

        // Section 15: Multi-Store & Branch Architecture
        stores,
        setStores,
        currentStore,
        setCurrentStore,
        isStoreModalOpen,
        setIsStoreModalOpen,
        switchStore,
        loadStores,
        canUserAccessStore,

        // Cart
        cartItems,
        addToCart,
        updateQuantity,
        removeFromCart,
        applyLineDiscount,
        orderDiscountPct,
        setOrderDiscountPct,
        customer,
        setCustomer,
        clearCart,
        activeSavedOrderId,
        setActiveSavedOrderId,
        resumeSavedOrder,

        // Financials (USD base + KHR equivalent)
        subtotal,
        totalDiscount,
        taxTotal,
        grandTotal,
        khrGrandTotal: toKhr(grandTotal),

        // Park & Recall & Saved Orders
        parkedCarts,
        parkCurrentCart,
        recallParkedCart,
        isSaveOrderModalOpen,
        setIsSaveOrderModalOpen,

        // Modals
        isCheckoutOpen,
        setIsCheckoutOpen,
        isShiftModalOpen,
        setIsShiftModalOpen,
        isCashMovementOpen,
        setIsCashMovementOpen,
        isRefundOpen,
        setIsRefundOpen,
        isUserModalOpen,
        setIsUserModalOpen,
        isReceiptOpen,
        setIsReceiptOpen,
        activeReceipt,
        setActiveReceipt,
        isSyncModalOpen,
        setIsSyncModalOpen,
        selectedProductForVariant,
        setSelectedProductForVariant,

        // Navigation Tabs & Views
        activeTab,
        setActiveTab,

        // Transaction Details Modal & History
        selectedTransaction,
        setSelectedTransaction,
        isTransactionDetailOpen,
        setIsTransactionDetailOpen,
        reprintReceipt,

        // Hardware & Devices
        hardwareConfig,
        setHardwareConfig,
        fetchHardwareConfig,
        updateHardwareConfig,

        // App Switcher & RBAC Permission Checking
        isAppSwitcherOpen,
        setIsAppSwitcherOpen,
        hasPermission,

        // Sound
        playBeep
      }}
    >
      {children}
    </PosContext.Provider>
  );
}

export function usePos() {
  const context = useContext(PosContext);
  if (!context) throw new Error('usePos must be used within PosProvider');
  return context;
}
