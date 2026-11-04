import React, { useState, useEffect } from 'react';
import { api, formatMoney } from './api';
import Navbar from './components/Navbar';
import NavigationTabs from './components/NavigationTabs';
import Dashboard from './components/Dashboard';
import ProductCatalog from './components/ProductCatalog';
import ProductDetailModal from './components/ProductDetailModal';
import NewProductModal from './components/NewProductModal';
import InventoryManagement from './components/InventoryManagement';
import ReceiveStockModal from './components/ReceiveStockModal';
import StockTransferModal from './components/StockTransferModal';
import SalesOrders from './components/SalesOrders';
import PosSaleModal from './components/PosSaleModal';
import Purchasing from './components/Purchasing';
import Customers from './components/Customers';
import Reports from './components/Reports';
import Locations from './components/Locations';
import Settings from './components/Settings';
import ExportModal from './components/ExportModal';
import AddLocationModal from './components/AddLocationModal';
import DeleteLocationModal from './components/DeleteLocationModal';
import OnboardingScreen from './components/OnboardingScreen';
import ImportHistoryView from '../../components/admin/ImportHistoryView';
import Toast from './components/Toast';

export default function App() {
  const getInitialStockTab = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab) return urlTab.toLowerCase();
      const savedTab = localStorage.getItem('loops_stock_tab');
      if (savedTab) return savedTab;
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTabState] = useState(getInitialStockTab);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('loops_stock_tab', tab);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab.toLowerCase());
      window.history.replaceState({}, '', url.toString());
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab) setActiveTabState(urlTab.toLowerCase());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [activeLocationId, setActiveLocationId] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL');
  const [dashboardScope, setDashboardScope] = useState('ALL');
  const [dashboardData, setDashboardData] = useState(null);
  const [products, setProducts] = useState([]);
  const [balances, setBalances] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Private Triad Identity & RBAC Session State
  const [authSession, setAuthSession] = useState({
    checked: false,
    authenticated: false,
    user: null,
    error: null
  });

  useEffect(() => {
    const checkStockAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        localStorage.setItem('loops_auth_token', urlToken);
        params.delete('token');
        const newSearch = params.toString();
        window.history.replaceState({}, document.title, window.location.pathname + (newSearch ? `?${newSearch}` : ''));
      }

      const token = localStorage.getItem('loops_auth_token');
      const cachedUser = typeof window !== 'undefined' ? localStorage.getItem('loops_active_user') : null;

      if (!token && !cachedUser) {
        setAuthSession({ checked: true, authenticated: false, user: null, error: 'Authentication required' });
        return;
      }

      try {
        let res = token ? await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        }) : { ok: false };

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
            const user = data.user;
            const canAccess = user.role === 'OWNER' || user.role === 'SUPER_ADMIN' || user.role === 'STOCK_ADMIN' || user.role === 'STOCK_MANAGER' || user.appAccess?.stock || user.permissions?.accessStockApp;
            if (canAccess) {
              setAuthSession({ checked: true, authenticated: true, user, error: null });
            } else {
              setAuthSession({ checked: true, authenticated: false, user, error: 'Access Denied: Your staff account is not permitted to access Stock Management.' });
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
          user: cachedUser ? JSON.parse(cachedUser) : { fullName: 'Stock Staff', role: 'STOCK_ADMIN' }, 
          error: null 
        });
      }
    };

    checkStockAuth();
  }, []);

  // Modals
  const [inspectingProduct, setInspectingProduct] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [initialReceiveSku, setInitialReceiveSku] = useState('');
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isPosSaleOpen, setIsPosSaleOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState(null);

  // Theme Mode (Dark / Light)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('the_loops_theme') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    localStorage.setItem('the_loops_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    showToast(`Switched to ${nextTheme === 'light' ? 'Light Mode ☀️' : 'Dark Mode 🌙'}`, 'gold');
  };

  // Toasts
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'gold') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Load Initial Data
  const refreshAll = async () => {
    try {
      const [dash, prods, bals, ledg, sls, pos, sups, custs, locs, settingsData, cats] = await Promise.all([
        api.getDashboard(dashboardScope),
        api.getProducts(),
        api.getBalances(),
        api.getLedger('ALL'),
        api.getSales(),
        api.getPurchases(),
        api.getSuppliers(),
        api.getCustomers(),
        api.getLocations(),
        api.getSettings(),
        api.getCategories()
      ]);

      setDashboardData(dash);
      setProducts(prods);
      setBalances(bals);
      setLedger(ledg);
      setSales(sls);
      setPurchases(pos);
      setSuppliers(sups);
      setCustomers(custs);
      setLocations(locs);
      setAttributes(settingsData.attributes || []);
      setCategories(cats || settingsData.categories || []);

      const isConfigured = (dash && dash.isOnboarded) || (settingsData && settingsData.isOnboarded) || (locs && locs.length > 0);
      setIsOnboarded(!!isConfigured);

      if (locs && locs.length > 0) {
        if (!locs.some((l) => l.id === activeLocationId)) {
          setActiveLocationId(locs.find((l) => l.isDefault)?.id || locs[0]?.id || '');
        }
      }
    } catch (err) {
      console.error('Error refreshing state from API:', err);
      showToast('Backend API connecting...', 'gold');
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleOnboard = async (formData) => {
    try {
      const res = await api.onboard(formData);
      showToast(`Welcome! Store "${res.location?.name}" registered successfully.`, 'emerald');
      await refreshAll();
      setIsOnboarded(true);
      return res;
    } catch (err) {
      showToast(err.message, 'crimson');
      throw err;
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  // Quick Global Scan
  const handleScanQuery = (query) => {
    let foundProd = null;
    let foundVar = null;

    products.forEach((p) => {
      p.variants.forEach((v) => {
        if (v.sku.toUpperCase() === query || (v.barcode && v.barcode === query)) {
          foundProd = p;
          foundVar = v;
        }
      });
    });

    if (foundProd) {
      showToast(`Scanned: ${foundVar.sku} (${foundProd.name})`, 'emerald');
      setInspectingProduct(foundProd);
    } else {
      showToast(`No item found for barcode/SKU: ${query}`, 'crimson');
    }
  };

  // Quick Restock Shortcut
  const handleQuickReceive = (sku) => {
    setInitialReceiveSku(sku);
    setIsReceiveOpen(true);
  };

  // Actions
  const handleSaveProduct = async (productData, editingId) => {
    try {
      if (editingId) {
        const updated = await api.updateProduct(editingId, productData);
        showToast(`Product ${updated.name} (${updated.code}) updated successfully!`, 'emerald');
        if (inspectingProduct && inspectingProduct.id === editingId) {
          setInspectingProduct(updated);
        }
      } else {
        const created = await api.createProduct(productData);
        showToast(`Product ${created.name} (${created.code}) created successfully!`, 'emerald');
      }
      refreshAll();
    } catch (err) {
      showToast(err.message, 'crimson');
    }
  };

  const handleAddCategory = async (name) => {
    try {
      const newCat = await api.createCategory(name);
      setCategories((prev) => {
        if (prev.some((c) => (typeof c === 'string' ? c : c.name).toLowerCase() === newCat.name.toLowerCase())) {
          return prev;
        }
        return [...prev, newCat];
      });
      showToast(`Category "${newCat.name}" added successfully!`, 'emerald');
      return newCat;
    } catch (err) {
      showToast(err.message, 'crimson');
      throw err;
    }
  };

  const handleDeleteCategory = async (catIdOrName) => {
    try {
      await api.deleteCategory(catIdOrName);
      setCategories((prev) => prev.filter((c) => {
        const name = typeof c === 'string' ? c : c.name;
        const id = typeof c === 'object' ? c.id : null;
        return name.toLowerCase() !== catIdOrName.toLowerCase() && id !== catIdOrName;
      }));
      showToast(`Category removed successfully!`, 'emerald');
    } catch (err) {
      showToast(err.message, 'crimson');
      throw err;
    }
  };

  const handleReceiveStock = async (data) => {
    try {
      await api.receiveStock(data);
      showToast(`Received ${data.qty} units of ${data.sku}!`, 'emerald');
      refreshAll();
    } catch (err) {
      showToast(err.message, 'crimson');
    }
  };

  const handleTransferStock = async (data) => {
    try {
      await api.transferStock(data);
      showToast(`Transferred ${data.qty} units of ${data.sku}!`, 'gold');
      refreshAll();
    } catch (err) {
      showToast(err.message, 'crimson');
    }
  };

  const handleAddLocation = async (locData) => {
    try {
      const created = await api.createLocation(locData);
      showToast(`Branch "${created.name}" (${created.code}) created successfully!`, 'emerald');
      refreshAll();
      return created;
    } catch (err) {
      showToast(err.message, 'crimson');
      throw err;
    }
  };

  const handleDeleteLocation = async (locationId, transferToLocationId) => {
    try {
      const res = await api.deleteLocation(locationId, transferToLocationId);
      showToast(res.message || 'Store deleted successfully!', 'emerald');
      if (activeLocationId === locationId) {
        setActiveLocationId('loc-1');
      }
      refreshAll();
      return res;
    } catch (err) {
      showToast(err.message, 'crimson');
      throw err;
    }
  };

  const handleViewStoreStock = (locationId, filter = 'ALL') => {
    setActiveLocationId(locationId);
    setStockStatusFilter(filter);
    setActiveTab('catalog');
  };

  const handleDashboardScopeChange = async (scopeLocId) => {
    setDashboardScope(scopeLocId);
    try {
      const dash = await api.getDashboard(scopeLocId);
      setDashboardData(dash);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecuteSale = async (data) => {
    try {
      const sale = await api.createSale(data);
      showToast(`Sale ${sale.saleNumber} completed! Total: ${formatMoney(sale.totalMinor)}`, 'emerald');
      refreshAll();
    } catch (err) {
      showToast(err.message, 'crimson');
    }
  };

  const handleRefundSale = async (saleId) => {
    try {
      await api.refundSale(saleId);
      showToast(`Sale refunded and inventory restocked!`, 'gold');
      refreshAll();
    } catch (err) {
      showToast(err.message, 'crimson');
    }
  };

  const handleResetData = async () => {
    if (!window.confirm('Are you sure you want to wipe all data and return to scratch store registration? This cannot be undone.')) {
      return;
    }
    try {
      await api.resetDb();
      showToast('System wiped clean. Please register your store to start testing.', 'gold');
      setIsOnboarded(false);
      await refreshAll();
    } catch (err) {
      showToast(err.message, 'crimson');
    }
  };

  // Exports
  const handleExportExcel = () => {
    if (typeof window.XLSX === 'undefined') {
      handleExportCSV();
      return;
    }
    const dateStr = new Date().toISOString().substring(0, 10);
    let rows = [];
    products.forEach((p) => {
      p.variants.forEach((v) => {
        const cost = v.costMinor / 100;
        const retail = v.retailMinor / 100;
        rows.push({
          'Product Code': p.code,
          'Product Name': p.name,
          'Category': p.category,
          'Brand': p.brand || '',
          'SKU': v.sku,
          'Variant': v.title,
          'Barcode': v.barcode || '',
          'On Hand': v.onHand,
          'Reserved': v.reserved || 0,
          'Available': v.onHand - (v.reserved || 0),
          'Unit Cost ($)': cost,
          'Retail Price ($)': retail,
          'Total Value ($)': parseFloat((v.onHand * cost).toFixed(2))
        });
      });
    });

    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.json_to_sheet(rows);
    window.XLSX.utils.book_append_sheet(wb, ws, 'Retail_Inventory');
    window.XLSX.writeFile(wb, `THE_LOOPS_STOCK_${dateStr}.xlsx`);
    showToast('Excel workbook (.xlsx) downloaded!', 'emerald');
  };

  const handleExportPDF = () => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      handleExportCSV();
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const dateStr = new Date().toISOString().substring(0, 10);

    doc.setFillColor(12, 15, 23);
    doc.rect(0, 0, 842, 60, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(241, 245, 249);
    doc.text('THE LOOPS — UNIVERSAL RETAIL PLATFORM (REACT)', 40, 36);

    let tableData = [];
    products.forEach((p) => {
      p.variants.forEach((v) => {
        tableData.push([
          v.sku,
          p.name.substring(0, 24),
          v.title.substring(0, 20),
          p.category,
          v.onHand,
          v.onHand - (v.reserved || 0),
          '$' + (v.costMinor / 100).toFixed(2),
          '$' + (v.retailMinor / 100).toFixed(2),
          '$' + ((v.onHand * v.costMinor) / 100).toFixed(2)
        ]);
      });
    });

    doc.autoTable({
      head: [['SKU', 'Product Name', 'Variant', 'Category', 'On Hand', 'Avail', 'Cost', 'Retail', 'Total Val']],
      body: tableData,
      startY: 80,
      theme: 'striped',
      headStyles: { fillColor: [12, 15, 23], textColor: [241, 245, 249], fontSize: 8 },
      bodyStyles: { fontSize: 8 }
    });

    doc.save(`THE_LOOPS_REPORT_${dateStr}.pdf`);
    showToast('Executive PDF Report downloaded!', 'gold');
  };

  const handleExportWord = () => {
    const dateStr = new Date().toISOString().substring(0, 10);
    let rowsHTML = '';
    products.forEach((p) => {
      p.variants.forEach((v) => {
        rowsHTML += `
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;font-family:Consolas;">${v.sku}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${p.name} (${v.title})</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${p.category}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">${v.onHand}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">$${(v.costMinor / 100).toFixed(2)}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">$${(v.retailMinor / 100).toFixed(2)}</td>
          </tr>
        `;
      });
    });

    const docHTML = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
      <head><meta charset='utf-8'><title>The Loops Retail Dossier</title>
      <style>body{font-family:'Segoe UI',sans-serif;margin:40px;}table{width:100%;border-collapse:collapse;font-size:9.5pt;}th{background:#0f172a;color:#fff;padding:8px;text-align:left;}</style>
      </head>
      <body>
        <h1>THE LOOPS — UNIVERSAL RETAIL PLATFORM (REACT)</h1>
        <p>Date: ${dateStr} | Multi-Category Retail Platform</p>
        <table>
          <thead><tr><th>SKU</th><th>Product / Variant</th><th>Category</th><th style="text-align:right;">On Hand</th><th style="text-align:right;">Cost</th><th style="text-align:right;">Price</th></tr></thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </body></html>
    `;

    const blob = new Blob([docHTML], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `THE_LOOPS_STOCK_${dateStr}.doc`;
    a.click();
    showToast('Word Document (.doc) downloaded!', 'emerald');
  };

  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().substring(0, 10);
    let csv = '\uFEFFProduct Code,Product Name,Category,Brand,SKU,Variant,On Hand,Reserved,Available,Unit Cost,Retail Price\n';
    products.forEach((p) => {
      p.variants.forEach((v) => {
        csv += `"${p.code}","${p.name}","${p.category}","${p.brand || ''}","${v.sku}","${v.title}",${v.onHand},${v.reserved || 0},${v.onHand - (v.reserved || 0)},${(v.costMinor / 100).toFixed(2)},${(v.retailMinor / 100).toFixed(2)}\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `THE_LOOPS_STOCK_${dateStr}.csv`;
    a.click();
    showToast('CSV downloaded!', 'gold');
  };

  if (!authSession.checked) {
    return (
      <div className="min-h-screen bg-studio-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-600 via-sky-500 to-sky-400 flex items-center justify-center font-display font-black text-studio-950 text-2xl shadow-lg shadow-sky-500/20 animate-pulse">
          ∞
        </div>
        <p className="font-mono text-xs text-studio-400 tracking-wider">VERIFYING STOCK ACCESS SESSION...</p>
      </div>
    );
  }

  if (!authSession.authenticated) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-6 text-slate-100 font-sans select-none">
        <div className="w-full max-w-md bg-[#161b22] border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center text-2xl font-bold mx-auto">
            🔒
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold uppercase tracking-wider text-slate-100 font-mono">
              Stock Management Loops
            </h1>
            <p className="text-xs text-slate-400">
              Private Enterprise Inventory Platform
            </p>
          </div>
          {authSession.error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {authSession.error}
            </div>
          )}
          <p className="text-xs text-slate-500 leading-relaxed">
            All users must authenticate through The Loops Central Identity Portal before accessing inventory or warehouse data.
          </p>
          <a
            href="http://localhost:5175"
            className="block w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-sky-600/20"
          >
            Authenticate via The Loops Portal
          </a>
        </div>
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-studio-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-gold-600 via-gold-500 to-gold-400 flex items-center justify-center font-display font-black text-studio-950 text-2xl shadow-lg shadow-gold-500/20 animate-pulse">
          ∞
        </div>
        <p className="font-mono text-xs text-studio-400 tracking-wider">CONNECTING TO THE LOOPS RETAIL OS...</p>
      </div>
    );
  }

  if (!isOnboarded) {
    return (
      <>
        <OnboardingScreen
          onOnboard={handleOnboard}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <Toast toasts={toasts} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-obsidian-950 text-slate-100 font-sans">
      {/* Unified Sticky Header & Navigation Suite */}
      <header className="sticky top-0 z-40 bg-obsidian-900/95 backdrop-blur-md border-b border-obsidian-800 shadow-md flex flex-col flex-shrink-0">
        <Navbar
          locations={locations}
          activeLocationId={activeLocationId}
          activeTab={activeTab}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLocationChange={setActiveLocationId}
          onOpenSaleModal={() => setIsPosSaleOpen(true)}
          onOpenReceiveModal={() => { setInitialReceiveSku(''); setIsReceiveOpen(true); }}
          onOpenExportModal={() => setIsExportOpen(true)}
          onScanQuery={handleScanQuery}
          onNavigate={setActiveTab}
        />
        <NavigationTabs activeTab={activeTab} onSelectTab={setActiveTab} />
      </header>

      {/* Dynamic View Tab Rendering */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 md:p-6 lg:p-8 space-y-6 sm:space-y-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            dashboardData={dashboardData}
            locations={locations}
            scopeLocationId={dashboardScope}
            onScopeChange={handleDashboardScopeChange}
            onSelectLocation={(locId, filter = 'ALL') => {
              setActiveLocationId(locId);
              setStockStatusFilter(filter);
              setActiveTab('catalog');
            }}
            onResetData={handleResetData}
            onQuickReceive={handleQuickReceive}
            onNavigate={setActiveTab}
            onOpenSaleModal={() => setIsPosSaleOpen(true)}
            onOpenReceiveModal={() => { setInitialReceiveSku(''); setIsReceiveOpen(true); }}
            onOpenTransferModal={() => setIsTransferOpen(true)}
            onOpenExportModal={() => setIsExportOpen(true)}
            onOpenNewProductModal={() => {
              setEditingProduct(null);
              setIsNewProductOpen(true);
            }}
          />
        )}

        {activeTab === 'catalog' && (
          <ProductCatalog
            products={products}
            categories={categories}
            balances={balances}
            locations={locations}
            activeLocationId={activeLocationId}
            onLocationChange={setActiveLocationId}
            stockStatusFilter={stockStatusFilter}
            onStockStatusFilterChange={setStockStatusFilter}
            onOpenNewProductModal={() => {
              setEditingProduct(null);
              setIsNewProductOpen(true);
            }}
            onInspectProduct={(prod) => setInspectingProduct(prod)}
            onEditProduct={(prod) => {
              setEditingProduct(prod);
              setIsNewProductOpen(true);
            }}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryManagement
            balances={balances}
            ledger={ledger}
            onOpenReceiveModal={() => { setInitialReceiveSku(''); setIsReceiveOpen(true); }}
            onOpenTransferModal={() => setIsTransferOpen(true)}
            onOpenExportModal={() => setIsExportOpen(true)}
            onQuickReceive={handleQuickReceive}
          />
        )}

        {activeTab === 'sales' && (
          <SalesOrders
            sales={sales}
            onOpenPosModal={() => setIsPosSaleOpen(true)}
            onRefundSale={handleRefundSale}
          />
        )}

        {activeTab === 'purchasing' && (
          <Purchasing
            purchases={purchases}
            suppliers={suppliers}
            onReceivePo={async () => {
              showToast('PO delivered and received into stock!', 'emerald');
              refreshAll();
            }}
          />
        )}

        {activeTab === 'customers' && (
          <Customers customers={customers} />
        )}

        {activeTab === 'reports' && (
          <Reports
            products={products}
            onOpenExportModal={() => setIsExportOpen(true)}
          />
        )}

        {activeTab === 'locations' && (
          <Locations
            locations={locations}
            activeLocationId={activeLocationId}
            balances={balances}
            onSelectLocation={setActiveLocationId}
            onViewStoreStock={handleViewStoreStock}
            onOpenTransferModal={() => setIsTransferOpen(true)}
            onOpenAddLocation={() => setIsAddLocationOpen(true)}
            onRequestDeleteLocation={(loc) => setDeletingLocation(loc)}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            attributes={attributes}
            locations={locations}
            categories={categories}
            products={products}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            settings={dashboardData?.settings}
            onAddLocation={handleAddLocation}
            onRequestDeleteLocation={(loc) => setDeletingLocation(loc)}
            theme={theme}
            onToggleTheme={toggleTheme}
            onResetToScratch={handleResetData}
            onAddAttribute={(name) => {
              setAttributes((prev) => [...prev, { id: 'attr-' + Date.now(), name, values: ['Default'] }]);
              showToast(`Attribute "${name}" added!`, 'emerald');
            }}
            onSaveToast={showToast}
          />
        )}
      </main>

      {/* Modals */}
      <ProductDetailModal
        product={inspectingProduct}
        ledger={ledger}
        onClose={() => setInspectingProduct(null)}
        onEditProduct={(prod) => {
          setEditingProduct(prod);
          setIsNewProductOpen(true);
        }}
      />

      <NewProductModal
        isOpen={isNewProductOpen}
        onClose={() => {
          setIsNewProductOpen(false);
          setEditingProduct(null);
        }}
        onSave={handleSaveProduct}
        editingProduct={editingProduct}
        categories={categories}
        onAddCategory={handleAddCategory}
        existingProducts={products}
      />

      <ReceiveStockModal
        isOpen={isReceiveOpen}
        initialSku={initialReceiveSku}
        products={products}
        locations={locations}
        onClose={() => setIsReceiveOpen(false)}
        onReceive={handleReceiveStock}
      />

      <StockTransferModal
        isOpen={isTransferOpen}
        products={products}
        locations={locations}
        balances={balances}
        onClose={() => setIsTransferOpen(false)}
        onTransfer={handleTransferStock}
      />

      <PosSaleModal
        isOpen={isPosSaleOpen}
        products={products}
        customers={customers}
        locations={locations}
        onClose={() => setIsPosSaleOpen(false)}
        onSale={handleExecuteSale}
      />

      <AddLocationModal
        isOpen={isAddLocationOpen}
        onClose={() => setIsAddLocationOpen(false)}
        onAddLocation={handleAddLocation}
      />

      <DeleteLocationModal
        isOpen={!!deletingLocation}
        location={deletingLocation}
        locations={locations}
        balances={balances}
        onClose={() => setDeletingLocation(null)}
        onConfirmDelete={handleDeleteLocation}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onExportExcel={handleExportExcel}
        onExportPDF={handleExportPDF}
        onExportWord={handleExportWord}
        onExportCSV={handleExportCSV}
      />

      {/* Toast System */}
      <Toast toasts={toasts} />
    </div>
  );
}

