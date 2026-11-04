// The Loop.s POS — Resilient Transactional Local Database & Event Store
// Persists to backend/data/pos_state.json with ACID in-memory caching
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'pos_state.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function generateUuid() {
  return crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substr(2, 9));
}

const DEFAULT_STATE = {
  organization: {
    id: "org-loops-001",
    name: "The Loops Retail Inc.",
    currency: "USD",
    taxRate: 0.10, // 10% VAT
    taxInclusive: false
  },
  locations: [
    { id: "loc-1", code: "SH-01", name: "Sisowat HighSchool Flagship", isDefault: true }
  ],
  registers: [
    {
      id: "reg-01",
      locationId: "loc-1",
      registerCode: "REG-01",
      name: "Front Counter Register 01",
      status: "OPEN",
      currentShiftId: "shift-101",
      currentCashierId: "usr-03"
    },
    {
      id: "reg-02",
      locationId: "loc-1",
      registerCode: "REG-02",
      name: "Quick Checkout Register 02",
      status: "CLOSED",
      currentShiftId: null,
      currentCashierId: null
    }
  ],
  users: [
    {
      id: "usr-01",
      email: "owner@theloops.com",
      fullName: "Executive Owner",
      role: "SUPER_ADMIN",
      pinHash: "9999", // demo plaintext/hash for rapid cashier unlock
      active: true,
      locations: ["loc-1"]
    },
    {
      id: "usr-02",
      email: "manager@theloops.com",
      fullName: "Sokha Meas",
      role: "STORE_MANAGER",
      pinHash: "4821",
      active: true,
      locations: ["loc-1"]
    },
    {
      id: "usr-03",
      email: "cashier1@theloops.com",
      fullName: "Dara Chea",
      role: "CASHIER",
      pinHash: "1111",
      active: true,
      locations: ["loc-1"]
    }
  ],
  shifts: [
    {
      id: "shift-101",
      registerId: "reg-01",
      cashierUserId: "usr-03",
      currencyCode: "USD",
      openedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      closedAt: null,
      openingFloat: 150.00,
      expectedCash: 150.00,
      countedCash: null,
      cashOverShort: 0.00,
      status: "ACTIVE" // ACTIVE, CLOSING, CLOSED, RECONCILED
    }
  ],
  products: [
    {
      id: "prod-1",
      code: "ELC-001",
      name: "Titanium ANC Headphones",
      category: "Electronics",
      categorySlug: "electronics",
      basePrice: 199.00,
      barcode: "89345001",
      image: "🎧",
      variants: [
        { sku: "ELC-001-BLK", title: "Matte Black", price: 199.00, barcode: "8934500101", onHand: 14, reserved: 2, available: 12 },
        { sku: "ELC-001-SLV", title: "Titanium Silver", price: 199.00, barcode: "8934500102", onHand: 8, reserved: 0, available: 8 }
      ]
    },
    {
      id: "prod-2",
      code: "BAG-001",
      name: "The Loops Canvas Tote Bag",
      category: "Bags",
      categorySlug: "bags",
      basePrice: 28.00,
      barcode: "89345002",
      image: "👜",
      variants: [
        { sku: "BAG-001-NAT", title: "Natural Ecru", price: 28.00, barcode: "8934500201", onHand: 45, reserved: 3, available: 42 },
        { sku: "BAG-001-BLK", title: "Obsidian Black", price: 28.00, barcode: "8934500202", onHand: 22, reserved: 0, available: 22 }
      ]
    },
    {
      id: "prod-3",
      code: "APP-001",
      name: "Heavyweight Cotton Oversized Tee",
      category: "Clothing",
      categorySlug: "clothing",
      basePrice: 32.00,
      barcode: "89345003",
      image: "👕",
      variants: [
        { sku: "APP-001-WHT-S", title: "White / Small", price: 32.00, barcode: "8934500301", onHand: 18, reserved: 1, available: 17 },
        { sku: "APP-001-WHT-M", title: "White / Medium", price: 32.00, barcode: "8934500302", onHand: 25, reserved: 2, available: 23 },
        { sku: "APP-001-WHT-L", title: "White / Large", price: 32.00, barcode: "8934500303", onHand: 15, reserved: 0, available: 15 },
        { sku: "APP-001-BLK-M", title: "Obsidian / Medium", price: 32.00, barcode: "8934500304", onHand: 30, reserved: 4, available: 26 },
        { sku: "APP-001-BLK-L", title: "Obsidian / Large", price: 32.00, barcode: "8934500305", onHand: 12, reserved: 0, available: 12 }
      ]
    },
    {
      id: "prod-4",
      code: "JWL-001",
      name: "Minimalist Chrono Watch",
      category: "Jewelry",
      categorySlug: "jewelry",
      basePrice: 145.00,
      barcode: "89345004",
      image: "⌚",
      variants: [
        { sku: "JWL-001-GOLD", title: "Rose Gold / Mesh", price: 155.00, barcode: "8934500401", onHand: 9, reserved: 0, available: 9 },
        { sku: "JWL-001-STEEL", title: "Brushed Steel / Leather", price: 145.00, barcode: "8934500402", onHand: 11, reserved: 1, available: 10 }
      ]
    },
    {
      id: "prod-5",
      code: "COS-001",
      name: "Hydrating Facial Mist 100ml",
      category: "Cosmetics",
      categorySlug: "cosmetics",
      basePrice: 19.50,
      barcode: "89345005",
      image: "✨",
      variants: [
        { sku: "COS-001-ROSE", title: "Rose Water Damask", price: 19.50, barcode: "8934500501", onHand: 34, reserved: 0, available: 34 },
        { sku: "COS-001-ALOE", title: "Aloe & Green Tea", price: 19.50, barcode: "8934500502", onHand: 28, reserved: 0, available: 28 }
      ]
    },
    {
      id: "prod-6",
      code: "FTW-001",
      name: "Everyday Court Sneaker",
      category: "Footwear",
      categorySlug: "footwear",
      basePrice: 85.00,
      barcode: "89345006",
      image: "👟",
      variants: [
        { sku: "FTW-001-41", title: "Porcelain White / EU 41", price: 85.00, barcode: "8934500601", onHand: 6, reserved: 0, available: 6 },
        { sku: "FTW-001-42", title: "Porcelain White / EU 42", price: 85.00, barcode: "8934500602", onHand: 10, reserved: 0, available: 10 },
        { sku: "FTW-001-43", title: "Porcelain White / EU 43", price: 85.00, barcode: "8934500603", onHand: 4, reserved: 1, available: 3 }
      ]
    }
  ],
  orders: [],
  orderLines: [],
  payments: [],
  cashMovements: [],
  refunds: [],
  refundLines: [],
  parkedCarts: [],
  outbox: [],
  inbox: [],
  auditLog: []
};

let memoryState = null;
let lastLoadedMtime = 0;

function loadDb(forceReload = false) {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const stats = fs.statSync(STATE_FILE);
      if (memoryState && !forceReload && stats.mtimeMs <= lastLoadedMtime) {
        return memoryState;
      }
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      memoryState = JSON.parse(raw);
      lastLoadedMtime = stats.mtimeMs;
      // Guarantee all collections exist
      memoryState.orders = memoryState.orders || [];
      memoryState.orderLines = memoryState.orderLines || [];
      memoryState.payments = memoryState.payments || [];
      memoryState.shifts = memoryState.shifts || DEFAULT_STATE.shifts;
      memoryState.registers = memoryState.registers || DEFAULT_STATE.registers;
      memoryState.users = memoryState.users || DEFAULT_STATE.users;
      memoryState.products = memoryState.products || DEFAULT_STATE.products;
      memoryState.cashMovements = memoryState.cashMovements || [];
      memoryState.refunds = memoryState.refunds || [];
      memoryState.refundLines = memoryState.refundLines || [];
      memoryState.parkedCarts = memoryState.parkedCarts || [];
      memoryState.savedOrders = memoryState.savedOrders || [];
      memoryState.outbox = memoryState.outbox || [];
      memoryState.inbox = memoryState.inbox || [];
      memoryState.auditLog = memoryState.auditLog || [];
      memoryState.sessions = memoryState.sessions || [];
      memoryState.passwordResets = memoryState.passwordResets || [];
      memoryState.roles = memoryState.roles || [];
      return memoryState;
    } catch (err) {
      console.error('[POS DB] Error loading state, fallback to default:', err.message);
    }
  }

  memoryState = JSON.parse(JSON.stringify(DEFAULT_STATE));
  saveDb();
  return memoryState;
}

function saveDb() {
  if (!memoryState) return;
  try {
    const tempFile = STATE_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(memoryState, null, 2), 'utf8');
    fs.renameSync(tempFile, STATE_FILE);
    try {
      lastLoadedMtime = fs.statSync(STATE_FILE).mtimeMs;
    } catch (e) {}
  } catch (err) {
    console.error('[POS DB] Error saving state:', err.message);
  }
}

module.exports = {
  loadDb,
  saveDb,
  generateUuid
};

