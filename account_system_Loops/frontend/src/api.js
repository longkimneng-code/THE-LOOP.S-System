// ============================================================================
// Loops Finance V3 — Frontend API Client & Financial Formatters
// ============================================================================

const API_BASE = '/api/finance';

function getAuthHeaders(customHeaders = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null;
  let orgId = null;
  let role = null;
  try {
    const rawUser = typeof window !== 'undefined' ? (localStorage.getItem('loops_active_user') || localStorage.getItem('loops_auth_user')) : null;
    if (rawUser) {
      const u = JSON.parse(rawUser);
      orgId = u.organizationId || u.organization_id;
      role = u.role;
    }
    if (!role && typeof window !== 'undefined') {
      role = localStorage.getItem('loops_finance_role') || localStorage.getItem('loops_stock_role');
    }
  } catch (e) {}
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgId ? { 'x-organization-id': orgId } : {}),
    ...(role ? { 'x-user-role': role } : {}),
    ...customHeaders
  };
}

export const formatMoney = (amount, currency = 'USD') => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

export const formatUnitCost = (amount, currency = 'USD') => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }).format(num);
};

export const formatPercent = (val) => {
  const num = Number(val) || 0;
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
};

export const api = {
  // Dashboard & Health
  getDashboard: async () => {
    const res = await fetch(`${API_BASE}/dashboard`);
    if (!res.ok) throw new Error('Failed to fetch dashboard data');
    return res.json();
  },

  // Business & Settings
  getBusiness: async () => {
    const res = await fetch(`${API_BASE}/business`);
    if (!res.ok) throw new Error('Failed to fetch business info');
    return res.json();
  },

  updateSettings: async (settings) => {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  // Chart of Accounts
  getAccounts: async () => {
    const res = await fetch(`${API_BASE}/accounts`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch accounts');
    return res.json();
  },

  createAccount: async (data) => {
    const res = await fetch(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create account');
    }
    return res.json();
  },

  updateAccount: async (code, data) => {
    const res = await fetch(`${API_BASE}/accounts/${code}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update account');
    }
    return res.json();
  },

  deleteAccount: async (code) => {
    const res = await fetch(`${API_BASE}/accounts/${code}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete account');
    }
    return res.json();
  },

  // Cash & Bank Transfers
  createTransfer: async (data) => {
    const res = await fetch(`${API_BASE}/transfers`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to execute cash transfer');
    }
    return res.json();
  },

  // Capital & Equity
  getCapital: async () => {
    const res = await fetch(`${API_BASE}/capital`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch capital overview');
    }
    return res.json();
  },

  addCapitalPartner: async (data) => {
    const res = await fetch(`${API_BASE}/capital/partners`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add investor / partner');
    }
    return res.json();
  },

  deleteCapitalPartner: async (partnerId) => {
    const res = await fetch(`${API_BASE}/capital/partners/${partnerId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete partner');
    }
    return res.json();
  },

  addCapitalTransaction: async (data) => {
    const res = await fetch(`${API_BASE}/capital/transaction`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record capital transaction');
    }
    return res.json();
  },

  // Startup Budget
  getBudget: async () => {
    const res = await fetch(`${API_BASE}/budget`);
    if (!res.ok) throw new Error('Failed to fetch startup budget');
    return res.json();
  },

  addBudgetItem: async (data) => {
    const res = await fetch(`${API_BASE}/budget/item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to add budget item');
    return res.json();
  },

  // Imports & Landed Cost
  getShipments: async () => {
    const res = await fetch(`${API_BASE}/shipments`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch shipments');
    return res.json();
  },

  getShipmentDetails: async (id) => {
    const res = await fetch(`${API_BASE}/shipments/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch shipment details');
    return res.json();
  },

  createShipment: async (payload) => {
    const res = await fetch(`${API_BASE}/shipments`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create shipment');
    return res.json();
  },

  updateShipment: async (shipmentId, payload) => {
    const res = await fetch(`${API_BASE}/shipments/${shipmentId}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update shipment' }));
      throw new Error(err.error || 'Failed to update shipment');
    }
    return res.json();
  },

  deleteShipment: async (shipmentId) => {
    const res = await fetch(`${API_BASE}/shipments/${shipmentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete shipment' }));
      throw new Error(err.error || 'Failed to delete shipment');
    }
    return res.json();
  },

  addShipmentOverhead: async (shipmentId, overhead) => {
    const res = await fetch(`${API_BASE}/shipments/${shipmentId}/overheads`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(overhead)
    });
    if (!res.ok) throw new Error('Failed to add shipment overhead');
    return res.json();
  },

  updateShipmentOverhead: async (shipmentId, overheadId, overhead) => {
    const res = await fetch(`${API_BASE}/shipments/${shipmentId}/overheads/${overheadId}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(overhead)
    });
    if (!res.ok) throw new Error('Failed to update shipment overhead');
    return res.json();
  },

  deleteShipmentOverhead: async (shipmentId, overheadId) => {
    const res = await fetch(`${API_BASE}/shipments/${shipmentId}/overheads/${overheadId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete shipment overhead');
    return res.json();
  },

  finalizeShipment: async (shipmentId) => {
    const res = await fetch(`${API_BASE}/shipments/${shipmentId}/finalize`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' })
    });
    if (!res.ok) throw new Error('Failed to finalize shipment landed cost');
    return res.json();
  },

  // Bills & Suppliers
  getBills: async () => {
    const res = await fetch(`${API_BASE}/bills`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch supplier bills');
    return res.json();
  },

  createBill: async (billData) => {
    const res = await fetch(`${API_BASE}/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(billData)
    });
    if (!res.ok) throw new Error('Failed to create supplier bill');
    return res.json();
  },

  payBill: async (billId, amount) => {
    const res = await fetch(`${API_BASE}/bills/${billId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });
    if (!res.ok) throw new Error('Failed to record bill payment');
    return res.json();
  },

  // Operating Expenses
  getExpenses: async () => {
    const res = await fetch(`${API_BASE}/expenses`);
    if (!res.ok) throw new Error('Failed to fetch expenses');
    return res.json();
  },

  createExpense: async (expenseData) => {
    const res = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expenseData)
    });
    if (!res.ok) throw new Error('Failed to record expense');
    return res.json();
  },

  // Sales & Invoices
  getInvoices: async () => {
    const res = await fetch(`${API_BASE}/invoices`);
    if (!res.ok) throw new Error('Failed to fetch customer invoices');
    return res.json();
  },

  createInvoice: async (invoiceData) => {
    const res = await fetch(`${API_BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData)
    });
    if (!res.ok) throw new Error('Failed to create invoice');
    return res.json();
  },

  // General Ledger
  getLedger: async (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`${API_BASE}/ledger${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch journal entries');
    return res.json();
  },

  postJournal: async (journalData) => {
    const res = await fetch(`${API_BASE}/ledger/journal`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(journalData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to post journal entry');
    }
    return res.json();
  },

  reverseJournal: async (id, reason) => {
    const res = await fetch(`${API_BASE}/ledger/${id}/reverse`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw new Error('Failed to reverse journal entry');
    return res.json();
  },

  // Financial Reports & Date-Period Engine
  getPeriodFinancials: async (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`${API_BASE}/reports/period-financials${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch period financials');
    return res.json();
  },

  getStores: async () => {
    const res = await fetch(`${API_BASE}/stores`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch stores');
    return res.json();
  },

  getPnL: async (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`${API_BASE}/reports/pnl${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch P&L');
    return res.json();
  },

  getBalanceSheet: async (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`${API_BASE}/reports/balance-sheet${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch Balance Sheet');
    return res.json();
  },

  getTrialBalance: async (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`${API_BASE}/reports/trial-balance${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch Trial Balance');
    return res.json();
  },

  getCashFlow: async (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`${API_BASE}/reports/cash-flow${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch Cash Flow Statement');
    return res.json();
  },

  getInventoryValuation: async (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`${API_BASE}/reports/inventory-valuation${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch Inventory Valuation');
    return res.json();
  },

  getApReport: async (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`${API_BASE}/reports/ap${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch Accounts Payable Report');
    return res.json();
  },

  getArReport: async (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`${API_BASE}/reports/ar${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch Accounts Receivable Report');
    return res.json();
  },

  // Product Categories (Finance Master)
  getCategories: async () => {
    const res = await fetch(`${API_BASE}/categories`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch product categories');
    return res.json();
  },

  createCategory: async (data) => {
    const res = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create category' }));
      throw new Error(err.error || 'Failed to create category');
    }
    return res.json();
  },

  deleteCategory: async (id) => {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete category' }));
      throw new Error(err.error || 'Failed to delete category');
    }
    return res.json();
  },

  // Shipping Categories
  getShippingCategories: async () => {
    const res = await fetch(`${API_BASE}/shipping-categories`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch shipping categories');
    return res.json();
  },

  createShippingCategory: async (data) => {
    const res = await fetch(`${API_BASE}/shipping-categories`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create shipping category');
    }
    return res.json();
  },

  updateShippingCategory: async (id, data) => {
    const res = await fetch(`${API_BASE}/shipping-categories/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update shipping category');
    }
    return res.json();
  },

  deleteShippingCategory: async (id) => {
    const res = await fetch(`${API_BASE}/shipping-categories/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete shipping category');
    }
    return res.json();
  },

  // Stock Management Loops Integration (Port 3000)
  getStockLoopsStatus: async () => {
    const res = await fetch(`${API_BASE}/integration/stock/status`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to check Stock Loops status');
    return res.json();
  },

  syncStockProducts: async () => {
    const res = await fetch(`${API_BASE}/integration/stock/sync-products`, { method: 'POST', headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to sync products from Stock Loops');
    return res.json();
  },

  syncStockSales: async () => {
    const res = await fetch(`${API_BASE}/integration/stock/sync-sales`, { method: 'POST', headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to sync sales from Stock Loops');
    return res.json();
  },

  pushLandedCostsToStock: async (shipmentId = null) => {
    const res = await fetch(`${API_BASE}/integration/stock/push-landed-costs`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(shipmentId ? { shipmentId } : {})
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to push landed costs to Stock Loops');
    }
    return res.json();
  },

  runFullStockSync: async () => {
    const res = await fetch(`${API_BASE}/integration/stock/sync-all`, { method: 'POST', headers: getAuthHeaders() });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to run full sync with Stock Loops');
    }
    return res.json();
  }
};

