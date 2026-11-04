// The Loops System — Unified Stock Management Module API Client
const API_BASE = '/api/stock';

export const formatMoney = (cents) => {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

async function fetchJson(endpoint, options = {}) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null;
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      },
      ...options
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error(`[Stock API] Error on ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  getDashboard: (locationId) => fetchJson(`/dashboard${locationId && locationId !== 'ALL' ? `?locationId=${locationId}` : ''}`),
  getProducts: () => fetchJson('/products'),
  createProduct: (data) => fetchJson('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => fetchJson(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getCategories: () => fetchJson('/categories'),
  createCategory: (name) => fetchJson('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteCategory: (idOrName) => fetchJson(`/categories/${encodeURIComponent(idOrName)}`, { method: 'DELETE' }),
  getBalances: (locationId) => fetchJson(`/inventory/balances${locationId && locationId !== 'ALL' ? `?locationId=${locationId}` : ''}`),
  getLedger: (type = 'ALL') => fetchJson(`/inventory/ledger${type !== 'ALL' ? `?type=${type}` : ''}`),
  receiveStock: (data) => fetchJson('/inventory/receive', { method: 'POST', body: JSON.stringify(data) }),
  transferStock: (data) => fetchJson('/inventory/transfer', { method: 'POST', body: JSON.stringify(data) }),
  getSales: () => fetchJson('/sales'),
  createSale: (data) => fetchJson('/sales', { method: 'POST', body: JSON.stringify(data) }),
  refundSale: (id) => fetchJson(`/sales/${id}/refund`, { method: 'POST' }),
  getPurchases: () => fetchJson('/purchases'),
  getSuppliers: () => fetchJson('/suppliers'),
  getCustomers: () => fetchJson('/customers'),
  getLocations: () => fetchJson('/locations'),
  createLocation: (data) => fetchJson('/locations', { method: 'POST', body: JSON.stringify(data) }),
  deleteLocation: (id, transferToLocationId) =>
    fetchJson(`/locations/${id}${transferToLocationId ? `?transferToLocationId=${transferToLocationId}` : ''}`, {
      method: 'DELETE'
    }),
  getSettings: () => fetchJson('/settings'),
  onboard: (data) => fetchJson('/onboard', { method: 'POST', body: JSON.stringify(data) }),
  resetDb: () => fetchJson('/reset', { method: 'POST' }),
  getAccountingBridgeStatus: () => fetchJson('/accounting-bridge/status'),
  triggerAccountingSync: () => fetchJson('/accounting-bridge/sync', { method: 'POST' })
};

