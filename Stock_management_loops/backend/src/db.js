// The Loops System — Universal Retail Management Platform
// Backend Database Store & Append-Only Movement Ledger Engine
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

// Clean Initial State (Completely Empty for Scratch Testing)
const INITIAL_DATA = {
  locations: [],
  categories: [],
  attributes: [
    { id: 'attr-1', name: 'Color', values: ['Matte Black', 'Titanium Gray', 'Raw Ecru', 'Silver', 'Navy'] },
    { id: 'attr-2', name: 'Size', values: ['Small', 'Medium', 'Large', '41 EU', '42 EU', '43 EU'] },
    { id: 'attr-3', name: 'Material', values: ['Leather', 'Nylon', 'Sterling Silver', 'Cotton', 'Ceramic'] }
  ],
  suppliers: [],
  customers: [],
  products: [],
  purchaseOrders: [],
  sales: [],
  stockBalances: [],
  ledger: [],
  settings: {
    businessName: '',
    ownerName: '',
    currency: 'USD',
    taxRate: 0,
    skuPrefix: 'LP',
    lowStockThresholdDefault: 5,
    isOnboarded: false
  }
};

function ensureStockBalances(db) {
  if (!db.stockBalances) {
    db.stockBalances = [];
  }
  const locations = db.locations || [];
  if (locations.length === 0) return db;

  (db.products || []).forEach(p => {
    const prodOrgId = p.organizationId;
    // Multi-tenant isolation: only manage balances for locations belonging to this product's organization
    const tenantLocs = prodOrgId 
      ? locations.filter(l => (l.organizationId || 'org-loops-001') === prodOrgId)
      : locations.filter(l => !l.organizationId || l.organizationId === 'org-loops-001');

    if (tenantLocs.length === 0) return;
    const defaultLocId = tenantLocs.find(l => l.isDefault)?.id || tenantLocs[0]?.id || 'loc-1';
    const tenantLocIds = new Set(tenantLocs.map(l => l.id));

    (p.variants || []).forEach(v => {
      const existingBalancesForSku = db.stockBalances.filter(b => b.sku === v.sku && tenantLocIds.has(b.locationId));
      const hasExistingBalance = existingBalancesForSku.length > 0;

      tenantLocs.forEach(loc => {
        let existing = db.stockBalances.find(b => b.sku === v.sku && b.locationId === loc.id);
        if (!existing) {
          existing = {
            id: `bal-${loc.id}-${v.sku}`,
            sku: v.sku,
            locationId: loc.id,
            onHand: (!hasExistingBalance && loc.id === defaultLocId) ? (v.onHand || 0) : 0,
            reserved: (!hasExistingBalance && loc.id === defaultLocId) ? (v.reserved || 0) : 0,
            damaged: (!hasExistingBalance && loc.id === defaultLocId) ? (v.damaged || 0) : 0,
            rop: v.rop || 5
          };
          db.stockBalances.push(existing);
        }
      });

      // Recalculate variant onHand strictly within tenant location scope
      const skuBalances = db.stockBalances.filter(b => b.sku === v.sku && tenantLocIds.has(b.locationId));
      v.onHand = skuBalances.reduce((sum, b) => sum + (b.onHand || 0), 0);
    });
  });

  return db;
}

let dbState = null;
let lastMtime = 0;

function loadDb() {
  let fileMtime = 0;
  if (fs.existsSync(DB_FILE)) {
    try {
      fileMtime = fs.statSync(DB_FILE).mtimeMs;
    } catch (e) {}
  }

  if (dbState && fileMtime > 0 && fileMtime <= lastMtime) {
    ensureStockBalances(dbState);
    return dbState;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      dbState = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      lastMtime = fileMtime;
      ensureStockBalances(dbState);
      return dbState;
    } catch (e) {
      console.error('Failed reading DB file, resetting to initial clean state:', e);
    }
  }
  dbState = JSON.parse(JSON.stringify(INITIAL_DATA));
  saveDb();
  return dbState;
}

function saveDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf8');
  try {
    lastMtime = fs.statSync(DB_FILE).mtimeMs;
  } catch (e) {}
}

module.exports = {
  loadDb,
  saveDb,
  ensureStockBalances,
  resetDb: () => {
    dbState = JSON.parse(JSON.stringify(INITIAL_DATA));
    saveDb();
    return dbState;
  }
};
