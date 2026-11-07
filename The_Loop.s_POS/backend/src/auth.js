// The Loop.s POS — Private Account-Based Retail Ecosystem Authentication & RBAC Engine
const crypto = require('crypto');
const { loadDb, saveDb, generateUuid } = require('./db');
const { generateTokenPair, rotateRefreshToken, revokeSession } = require('../../../shared/security/tokenService');
const { verifyToken } = require('../../../shared/security/jwt');

const DEFAULT_PERMISSIONS = {
  openPos: false,
  makeSales: false,
  viewSalesHistory: false,
  refundTransactions: false,
  cancelTransactions: false,
  applyDiscounts: false,
  changeProductPrices: false,
  viewStock: false,
  editStock: false,
  accessStockApp: false,
  accessFinanceApp: false,
  viewFinancialReports: false,
  manageEmployees: false,
  changeSystemSettings: false,
  accessBackoffice: false,
  viewUserPin: false,
  editUserPin: false,

  // Feature 15: Granular Financial & Import Permissions
  importData: false,
  importProducts: false,
  injectCapital: false,
  withdrawCapital: false,
  repayCapital: false,
  manualFinancialAdjustment: false,
  viewImportHistory: false,
  exportImportHistory: false,
  manageImportRecords: false,
  viewMonthlyRevenue: false,
  manageRevenueAllocation: false,
  approveRevenueAllocation: false,
  viewAllocationHistory: false,
  viewInventoryReserve: false,
  manageInventoryReserve: false,
  approveInventoryReserveSpending: false,
  viewSalaryBudget: false,
  manageSalaryBudget: false,
  approveSalaryPayments: false,
  approveSalaryCarryForward: false,
  viewExpenseBudget: false,
  manageExpenseBudget: false,
  approveExpenses: false,
  manageExpenseCarryForward: false,
  viewCapital: false,
  manageCapital: false,
  approveCapitalBorrowing: false,
  approveCapitalRepayment: false,
  viewCapitalHistory: false,
  viewLoopShare: false,
  manageLoopShare: false,
  approveLoopSharePayments: false,
  exportLoopShareReports: false,
  viewMonthlyFinancialHistory: false,
  manageMonthEndClosing: false,
  reopenFinancialPeriods: false,
  exportInventoryReports: false,
  exportFinancialReports: false,
  exportConfidentialReports: false,
  manageStoreData: false,
  isOwnerEquivalent: false
};

const SYSTEM_ROLES = [
  {
    id: 'OWNER',
    name: 'Business Owner & Principal',
    app: 'UNIVERSAL',
    isSystem: true,
    authorityLevel: 100,
    description: 'Supreme business owner authority across POS, Stock, and Finance suites',
    permissions: {
      openPos: true,
      makeSales: true,
      viewSalesHistory: true,
      refundTransactions: true,
      cancelTransactions: true,
      applyDiscounts: true,
      changeProductPrices: true,
      viewStock: true,
      editStock: true,
      accessStockApp: true,
      accessFinanceApp: true,
      viewFinancialReports: true,
      manageEmployees: true,
      changeSystemSettings: true,
      accessBackoffice: true,
      viewUserPin: true,
      editUserPin: true,
      importData: true,
      importProducts: true,
      injectCapital: true,
      withdrawCapital: true,
      repayCapital: true,
      manualFinancialAdjustment: true,
      manageCapital: true,
      approveCapitalBorrowing: true,
      approveCapitalRepayment: true,
      viewCapital: true,
      viewCapitalHistory: true,
      viewImportHistory: true,
      manageImportRecords: true,
      viewMonthlyRevenue: true,
      manageRevenueAllocation: true,
      approveRevenueAllocation: true,
      viewAllocationHistory: true,
      viewInventoryReserve: true,
      manageInventoryReserve: true,
      approveInventoryReserveSpending: true,
      viewSalaryBudget: true,
      manageSalaryBudget: true,
      approveSalaryPayments: true,
      approveSalaryCarryForward: true,
      viewExpenseBudget: true,
      manageExpenseBudget: true,
      approveExpenses: true,
      manageExpenseCarryForward: true,
      viewLoopShare: true,
      manageLoopShare: true,
      approveLoopSharePayments: true,
      exportLoopShareReports: true,
      viewMonthlyFinancialHistory: true,
      manageMonthEndClosing: true,
      reopenFinancialPeriods: true,
      exportInventoryReports: true,
      exportFinancialReports: true,
      exportConfidentialReports: true,
      manageStoreData: true,
      isOwnerEquivalent: true
    }
  },
  {
    id: 'SUPER_ADMIN',
    name: 'Universal Executive Admin',
    app: 'UNIVERSAL',
    isSystem: true,
    authorityLevel: 90,
    description: 'Master technical administration across all retail infrastructure',
    permissions: {
      openPos: true,
      makeSales: true,
      viewSalesHistory: true,
      refundTransactions: true,
      cancelTransactions: true,
      applyDiscounts: true,
      changeProductPrices: true,
      viewStock: true,
      editStock: true,
      accessStockApp: true,
      accessFinanceApp: true,
      viewFinancialReports: true,
      manageEmployees: true,
      changeSystemSettings: true,
      accessBackoffice: true,
      viewUserPin: true,
      editUserPin: true,
      importData: true,
      importProducts: true,
      injectCapital: true,
      withdrawCapital: true,
      repayCapital: true,
      manualFinancialAdjustment: true,
      manageCapital: true,
      viewCapital: true,
      viewImportHistory: true,
      viewMonthlyRevenue: true,
      exportInventoryReports: true,
      exportFinancialReports: true,
      manageStoreData: true,
      isOwnerEquivalent: true
    }
  },
  {
    id: 'POS_ADMIN',
    name: 'POS Terminal Administrator',
    app: 'POS',
    isSystem: true,
    description: 'Full administrative control over POS registers, cashiers, shifts, and settings',
    permissions: {
      openPos: true,
      makeSales: true,
      viewSalesHistory: true,
      refundTransactions: true,
      cancelTransactions: true,
      applyDiscounts: true,
      changeProductPrices: true,
      viewStock: true,
      editStock: false,
      accessStockApp: true,
      accessFinanceApp: false,
      viewFinancialReports: false,
      manageEmployees: true,
      changeSystemSettings: true,
      accessBackoffice: true,
      viewUserPin: true,
      editUserPin: true
    }
  },
  {
    id: 'STORE_MANAGER',
    name: 'Store General Manager',
    app: 'POS',
    isSystem: true,
    description: 'Oversees daily sales, cashier shifts, inventory availability, and customer refunds',
    permissions: {
      openPos: true,
      makeSales: true,
      viewSalesHistory: true,
      refundTransactions: true,
      cancelTransactions: true,
      applyDiscounts: true,
      changeProductPrices: false,
      viewStock: true,
      editStock: false,
      accessStockApp: true,
      accessFinanceApp: false,
      viewFinancialReports: false,
      manageEmployees: false,
      changeSystemSettings: false,
      accessBackoffice: true,
      viewUserPin: true,
      editUserPin: false
    }
  },
  {
    id: 'SHIFT_SUPERVISOR',
    name: 'Shift Supervisor',
    app: 'POS',
    isSystem: true,
    description: 'Supervises registers, shift reconciliation, petty cash, and voids',
    permissions: {
      openPos: true,
      makeSales: true,
      viewSalesHistory: true,
      refundTransactions: true,
      cancelTransactions: true,
      applyDiscounts: true,
      changeProductPrices: false,
      viewStock: true,
      editStock: false,
      accessStockApp: false,
      accessFinanceApp: false,
      viewFinancialReports: false,
      manageEmployees: false,
      changeSystemSettings: false,
      accessBackoffice: false,
      viewUserPin: false,
      editUserPin: false
    }
  },
  {
    id: 'CASHIER',
    name: 'Front-of-House Cashier',
    app: 'POS',
    isSystem: true,
    description: 'Fast barcode scanning, cart processing, and dual-currency checkout',
    permissions: {
      openPos: true,
      makeSales: true,
      viewSalesHistory: true,
      refundTransactions: false,
      cancelTransactions: false,
      applyDiscounts: true,
      changeProductPrices: false,
      viewStock: true,
      editStock: false,
      accessStockApp: false,
      accessFinanceApp: false,
      viewFinancialReports: false,
      manageEmployees: false,
      changeSystemSettings: false,
      accessBackoffice: false,
      viewUserPin: false,
      editUserPin: false
    }
  },
  {
    id: 'SALES_ASSISTANT',
    name: 'Floor Sales Assistant',
    app: 'POS',
    isSystem: true,
    description: 'Floor customer engagement, stock checks, and cart assistance',
    permissions: {
      openPos: true,
      makeSales: true,
      viewSalesHistory: false,
      refundTransactions: false,
      cancelTransactions: false,
      applyDiscounts: false,
      changeProductPrices: false,
      viewStock: true,
      editStock: false,
      accessStockApp: false,
      accessFinanceApp: false,
      viewFinancialReports: false,
      manageEmployees: false,
      changeSystemSettings: false,
      accessBackoffice: false,
      viewUserPin: false,
      editUserPin: false
    }
  },
  {
    id: 'STOCK_ADMIN',
    name: 'Inventory Administrator',
    app: 'STOCK',
    isSystem: true,
    description: 'Full control of stock catalogs, warehouses, adjustments, and supplier GRN',
    permissions: {
      openPos: false,
      makeSales: false,
      viewSalesHistory: false,
      refundTransactions: false,
      cancelTransactions: false,
      applyDiscounts: false,
      changeProductPrices: true,
      viewStock: true,
      editStock: true,
      accessStockApp: true,
      accessFinanceApp: false,
      viewFinancialReports: false,
      manageEmployees: true,
      changeSystemSettings: true,
      accessBackoffice: true,
      viewUserPin: true,
      editUserPin: true
    }
  },
  {
    id: 'STOCK_MANAGER',
    name: 'Warehouse & Stock Manager',
    app: 'STOCK',
    isSystem: true,
    description: 'Manages receiving docks, transfers, reorder points, and adjustments',
    permissions: {
      openPos: false,
      makeSales: false,
      viewSalesHistory: false,
      refundTransactions: false,
      cancelTransactions: false,
      applyDiscounts: false,
      changeProductPrices: false,
      viewStock: true,
      editStock: true,
      accessStockApp: true,
      accessFinanceApp: false,
      viewFinancialReports: false,
      manageEmployees: false,
      changeSystemSettings: false,
      accessBackoffice: true,
      viewUserPin: false,
      editUserPin: false
    }
  },
  {
    id: 'INVENTORY_CLERK',
    name: 'Inventory Receiving Clerk',
    app: 'STOCK',
    isSystem: true,
    description: 'Records inbound goods receipts and counts stock balances',
    permissions: {
      openPos: false,
      makeSales: false,
      viewSalesHistory: false,
      refundTransactions: false,
      cancelTransactions: false,
      applyDiscounts: false,
      changeProductPrices: false,
      viewStock: true,
      editStock: true,
      accessStockApp: true,
      accessFinanceApp: false,
      viewFinancialReports: false,
      manageEmployees: false,
      changeSystemSettings: false,
      accessBackoffice: true,
      viewUserPin: false,
      editUserPin: false
    }
  },
  {
    id: 'FINANCE_ADMIN',
    name: 'Chief Financial Officer / Admin',
    app: 'FINANCE',
    isSystem: true,
    description: 'Complete general ledger, fiscal close, chart of accounts, and PO approvals',
    permissions: {
      openPos: false,
      makeSales: false,
      viewSalesHistory: true,
      refundTransactions: false,
      cancelTransactions: false,
      applyDiscounts: false,
      changeProductPrices: false,
      viewStock: true,
      editStock: false,
      accessStockApp: true,
      accessFinanceApp: true,
      viewFinancialReports: true,
      manageEmployees: true,
      changeSystemSettings: true,
      accessBackoffice: true,
      viewUserPin: true,
      editUserPin: true
    }
  },
  {
    id: 'PURCHASE_MANAGER',
    name: 'Purchasing & Imports Manager',
    app: 'FINANCE',
    isSystem: true,
    description: 'Creates overseas shipments, tracks customs/duties, and finalizes landed costs',
    permissions: {
      openPos: false,
      makeSales: false,
      viewSalesHistory: false,
      refundTransactions: false,
      cancelTransactions: false,
      applyDiscounts: false,
      changeProductPrices: false,
      viewStock: true,
      editStock: true,
      accessStockApp: true,
      accessFinanceApp: true,
      viewFinancialReports: false,
      manageEmployees: false,
      changeSystemSettings: false,
      accessBackoffice: true,
      viewUserPin: false,
      editUserPin: false
    }
  },
  {
    id: 'ACCOUNTANT',
    name: 'Senior Accountant',
    app: 'FINANCE',
    isSystem: true,
    description: 'Double-entry bookkeeping, manual journals, and balance sheets',
    permissions: {
      openPos: false,
      makeSales: false,
      viewSalesHistory: true,
      refundTransactions: false,
      cancelTransactions: false,
      applyDiscounts: false,
      changeProductPrices: false,
      viewStock: true,
      editStock: false,
      accessStockApp: false,
      accessFinanceApp: true,
      viewFinancialReports: true,
      manageEmployees: false,
      changeSystemSettings: false,
      accessBackoffice: true,
      viewUserPin: false,
      editUserPin: false
    }
  }
];

// Secure Password & PIN Hashing using Node.js crypto.scrypt with Salt
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password).trim(), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const testHash = crypto.scryptSync(String(password).trim(), salt, 64).toString('hex');
  return testHash === key;
}

function hashPin(pin) {
  if (!pin) return null;
  const cleanPin = String(pin).trim();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(cleanPin, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPin(inputPin, storedPinHash, userToUpgrade = null) {
  if (!inputPin || !storedPinHash) return false;
  const cleanPin = String(inputPin).trim();
  const storedStr = String(storedPinHash).trim();

  // Scrypt-hashed PIN: salt:hash
  if (storedStr.includes(':')) {
    const parts = storedStr.split(':');
    if (parts.length !== 2) return false;
    const [salt, key] = parts;
    const testHash = crypto.scryptSync(cleanPin, salt, 32).toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(key, 'hex'));
    } catch (e) {
      return false;
    }
  }

  // Legacy plaintext PIN backward compatibility: check string equality and transparently upgrade
  if (cleanPin === storedStr) {
    if (userToUpgrade) {
      userToUpgrade.pinHash = hashPin(cleanPin);
      try { saveDb(); } catch (e) {}
    }
    return true;
  }
  return false;
}

// AES-256-GCM PIN Envelope Encryption for Authorized View / Reveal
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'theloops_enterprise_jwt_super_secret_signing_key_2026_change_in_prod').digest();

function encryptPin(pin) {
  if (!pin) return null;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(String(pin).trim(), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (e) {
    return null;
  }
}

function decryptPin(cipherText) {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.includes(':')) return null;
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, authTagHex, encrypted] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return null;
  }
}

function computeCompanyPinHash(pin, orgId) {
  if (!pin || !orgId) return null;
  return crypto.createHmac('sha256', String(orgId)).update(String(pin).trim()).digest('hex');
}

function isWeakOrSequentialPin(pinStr) {
  if (!pinStr || pinStr.length < 4) return true;
  if (/^(\d)\1+$/.test(pinStr)) return true;
  const seqs = ['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210'];
  return seqs.includes(pinStr);
}

function generateUniqueCompanyPin(orgId, length = 4) {
  const db = loadDb();
  const existingUsers = (db.users || []).filter(u => (u.organizationId || 'org-loops-001') === orgId && u.status !== 'DELETED');

  for (let attempt = 0; attempt < 500; attempt++) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    const candidate = String(crypto.randomInt(min, max + 1));
    if (isWeakOrSequentialPin(candidate)) continue;

    const companyHash = computeCompanyPinHash(candidate, orgId);
    const collision = existingUsers.some(u => {
      if (u.companyPinHash && u.companyPinHash === companyHash) return true;
      if (verifyPin(candidate, u.pinHash)) return true;
      return false;
    });

    if (!collision) {
      return candidate;
    }
  }

  // Fallback random non-weak
  return String(crypto.randomInt(1000, 9999));
}

// Memory-based Rate Limiter for PIN Attempts (10 min lockout after 5 consecutive failures within 5 mins)
const pinFailedAttempts = new Map();

function checkPinLockout(key) {
  const record = pinFailedAttempts.get(key);
  if (!record) return { locked: false };
  const now = Date.now();
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    return { locked: true, remainingSec };
  }
  if (record.firstFailAt && now - record.firstFailAt > 5 * 60 * 1000 && (!record.lockedUntil || now >= record.lockedUntil)) {
    pinFailedAttempts.delete(key);
    return { locked: false };
  }
  return { locked: false };
}

function recordPinFailure(key) {
  const now = Date.now();
  let record = pinFailedAttempts.get(key);
  if (!record || (now - record.firstFailAt > 5 * 60 * 1000)) {
    record = { count: 1, firstFailAt: now, lockedUntil: 0 };
  } else {
    record.count += 1;
  }
  if (record.count >= 5) {
    record.lockedUntil = now + 10 * 60 * 1000; // 10 minute lockout
  }
  pinFailedAttempts.set(key, record);
  return record;
}

function resetPinAttempts(key) {
  pinFailedAttempts.delete(key);
}

// ----------------------------------------------------------------------------
// COMPANY CODE & ACTIVATION KEY MANAGEMENT (DEVICE / TERMINAL PAIRING)
// ----------------------------------------------------------------------------

const companyCodeFailedAttempts = new Map();

function generateUniqueCompanyCode(businessName = '') {
  const db = loadDb();
  const existingCodes = new Set(
    (db.organizations || []).map(o => (o.companyCode || '').toUpperCase().trim())
  );
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    const rows = dbSync.prepare('SELECT company_code FROM organizations WHERE company_code IS NOT NULL').all();
    rows.forEach(r => existingCodes.add(r.company_code.toUpperCase().trim()));
  } catch (e) {}

  let cleanPrefix = (businessName || 'LOOP')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (cleanPrefix.length > 5) cleanPrefix = cleanPrefix.substring(0, 5);
  if (cleanPrefix.length < 2) cleanPrefix = 'LP';

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 100; attempt++) {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars[crypto.randomInt(0, chars.length)];
    }
    const candidate = `${cleanPrefix}-${suffix}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }

  return `${cleanPrefix}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function normalizeCompanyCode(code) {
  if (!code) return '';
  return String(code).trim().toUpperCase().replace(/[\s-]/g, '');
}

function checkCompanyCodeLockout(clientIp) {
  const key = `lookup:${clientIp}`;
  const record = companyCodeFailedAttempts.get(key);
  if (!record) return { locked: false };
  const now = Date.now();
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    return { locked: true, remainingSec };
  }
  if (record.firstFailAt && now - record.firstFailAt > 5 * 60 * 1000 && (!record.lockedUntil || now >= record.lockedUntil)) {
    companyCodeFailedAttempts.delete(key);
    return { locked: false };
  }
  return { locked: false };
}

function recordCompanyCodeFailedAttempt(clientIp) {
  const key = `lookup:${clientIp}`;
  const now = Date.now();
  let record = companyCodeFailedAttempts.get(key);
  if (!record || (record.firstFailAt && now - record.firstFailAt > 5 * 60 * 1000 && !record.lockedUntil)) {
    record = { count: 1, firstFailAt: now, lockedUntil: null };
  } else {
    record.count = (record.count || 0) + 1;
  }
  if (record.count >= 5) {
    record.lockedUntil = now + 10 * 60 * 1000; // 10 minute lockout
  }
  companyCodeFailedAttempts.set(key, record);
  return record;
}

function resetCompanyCodeAttempts(clientIp) {
  companyCodeFailedAttempts.delete(`lookup:${clientIp}`);
}

function findOrganizationByCode(rawCode) {
  if (!rawCode) return null;
  const db = loadDb();
  const searchNormalized = normalizeCompanyCode(rawCode);

  let match = (db.organizations || []).find(o => 
    normalizeCompanyCode(o.companyCode) === searchNormalized ||
    o.id.toLowerCase() === String(rawCode).trim().toLowerCase()
  );

  if (!match && db.organization) {
    if (normalizeCompanyCode(db.organization.companyCode) === searchNormalized ||
        db.organization.id.toLowerCase() === String(rawCode).trim().toLowerCase()) {
      match = db.organization;
    }
  }

  if (!match) {
    try {
      const { getDatabase } = require('../../../shared/database/connection');
      const dbSync = getDatabase();
      const row = dbSync.prepare(`
        SELECT * FROM organizations 
        WHERE REPLACE(UPPER(company_code), '-', '') = ? 
           OR id = ?
      `).get(searchNormalized, String(rawCode).trim());
      if (row) {
        match = {
          id: row.id,
          name: row.name,
          ownerName: row.owner_name,
          ownerEmail: row.owner_email,
          currency: row.currency,
          companyCode: row.company_code,
          logo: row.logo
        };
      }
    } catch (e) {}
  }

  // 3. Match by Branch / Store Code (e.g. MAIN, SSW, ST-01)
  if (!match) {
    const cleanStoreCode = String(rawCode).trim().toUpperCase();
    const locMatch = (db.locations || []).find(l => (l.code || '').toUpperCase() === cleanStoreCode || l.id === rawCode);
    if (locMatch) {
      const orgId = locMatch.organizationId;
      const org = (db.organizations || []).find(o => o.id === orgId) || (db.organization?.id === orgId ? db.organization : null);
      if (org) {
        match = {
          ...org,
          storeId: locMatch.id,
          storeName: locMatch.name,
          storeCode: locMatch.code
        };
      } else {
        try {
          const { getDatabase } = require('../../../shared/database/connection');
          const dbSync = getDatabase();
          const row = dbSync.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
          if (row) {
            match = {
              id: row.id,
              name: row.name,
              companyCode: row.company_code,
              currency: row.currency,
              storeId: locMatch.id,
              storeName: locMatch.name,
              storeCode: locMatch.code
            };
          }
        } catch (e) {}
      }
    }
  }

  // 4. Match by SQLite locations table
  if (!match) {
    try {
      const { getDatabase } = require('../../../shared/database/connection');
      const dbSync = getDatabase();
      const cleanStoreCode = String(rawCode).trim().toUpperCase();
      const locRow = dbSync.prepare('SELECT * FROM locations WHERE UPPER(code) = ? OR id = ?').get(cleanStoreCode, String(rawCode).trim());
      if (locRow) {
        const row = dbSync.prepare('SELECT * FROM organizations WHERE id = ?').get(locRow.organization_id);
        if (row) {
          match = {
            id: row.id,
            name: row.name,
            companyCode: row.company_code,
            currency: row.currency,
            storeId: locRow.id,
            storeName: locRow.name,
            storeCode: locRow.code
          };
        }
      }
    } catch (e) {}
  }

  return match;
}

function verifyCompanyCode(companyCode, clientIp = '127.0.0.1') {
  if (!companyCode || !String(companyCode).trim()) {
    return { ok: false, error: 'Please enter a company code.' };
  }

  const lockout = checkCompanyCodeLockout(clientIp);
  if (lockout.locked) {
    return {
      ok: false,
      error: `Too many failed attempts. Device pairing locked for ${Math.ceil(lockout.remainingSec / 60)} minutes.`,
      code: 'LOCKOUT',
      remainingSec: lockout.remainingSec
    };
  }

  const org = findOrganizationByCode(companyCode);
  if (!org) {
    recordCompanyCodeFailedAttempt(clientIp);
    return {
      ok: false,
      error: 'Invalid company code. Please check with your business manager.'
    };
  }

  resetCompanyCodeAttempts(clientIp);

  const db = loadDb();
  db.auditLog.unshift({
    id: generateUuid(),
    action: 'COMPANY_CODE_VERIFIED',
    organizationId: org.id,
    performedBy: `IP ${clientIp}`,
    details: `POS Terminal paired successfully with Company Code "${org.companyCode}" (${org.name})`,
    timestamp: new Date().toISOString()
  });
  saveDb();

  return {
    ok: true,
    valid: true,
    organization: {
      id: org.id,
      name: org.name,
      companyCode: org.companyCode,
      currency: org.currency || 'USD',
      logo: org.logo || '',
      storeId: org.storeId || null,
      storeName: org.storeName || null,
      storeCode: org.storeCode || null
    }
  };
}

function regenerateCompanyCode(orgId, caller = null) {
  const db = loadDb();
  if (caller) {
    const isOwner = caller.role === 'OWNER' || caller.role === 'SUPER_ADMIN';
    const hasAdminPerm = caller.permissions?.manageEmployees || caller.permissions?.changeSystemSettings;
    if (!isOwner && !hasAdminPerm) {
      throw new Error('Unauthorized: Only Business Owners and Administrators can regenerate company codes.');
    }
  }

  const targetOrg = (db.organizations || []).find(o => o.id === orgId) || (db.organization?.id === orgId ? db.organization : null);
  if (!targetOrg) throw new Error('Organization not found');

  const newCode = generateUniqueCompanyCode(targetOrg.name);
  targetOrg.companyCode = newCode;
  if (db.organization && db.organization.id === orgId) {
    db.organization.companyCode = newCode;
  }

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    dbSync.prepare('UPDATE organizations SET company_code = ? WHERE id = ?').run(newCode, orgId);
  } catch (e) {}

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'COMPANY_CODE_REGENERATED',
    organizationId: orgId,
    performedBy: caller ? (caller.fullName || caller.email) : 'System Administrator',
    details: `Company code regenerated for "${targetOrg.name}". New code: ${newCode}`,
    timestamp: new Date().toISOString()
  });
  saveDb();

  return { ok: true, companyCode: newCode, organizationId: orgId };
}

function hasBackofficePermission(user, permissions = null) {
  if (!user) return false;
  const p = permissions || resolveUserPermissions(user);
  if (p.accessBackoffice === true) return true;
  if (p.manageEmployees === true || p.changeSystemSettings === true) return true;
  if (p.accessStockApp === true || p.accessFinanceApp === true || p.viewFinancialReports === true) return true;
  const backofficeRoles = ['OWNER', 'SUPER_ADMIN', 'POS_ADMIN', 'STORE_MANAGER', 'STOCK_ADMIN', 'STOCK_MANAGER', 'FINANCE_ADMIN', 'PURCHASE_MANAGER', 'ACCOUNTANT'];
  return backofficeRoles.includes(user.role) || (Array.isArray(user.roles) && user.roles.some(r => backofficeRoles.includes(r)));
}

function hasPosPermission(user, permissions = null) {
  if (!user) return false;
  const p = permissions || resolveUserPermissions(user);
  if (p.openPos === true || p.makeSales === true) return true;
  const posRoles = ['OWNER', 'SUPER_ADMIN', 'POS_ADMIN', 'STORE_MANAGER', 'SHIFT_SUPERVISOR', 'CASHIER', 'SALES_ASSISTANT'];
  return posRoles.includes(user.role) || (Array.isArray(user.roles) && user.roles.some(r => posRoles.includes(r)));
}

function syncUserToSqlite(user) {
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSql = getDatabase();
    dbSql.prepare(`
      INSERT INTO users (
        id, organization_id, email, full_name, role, roles_json, password_hash,
        pin_hash, company_pin_hash, pin_encrypted, active, status, assigned_store_ids_json, app_access_json, permissions_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, email) DO UPDATE SET
        full_name = excluded.full_name,
        role = excluded.role,
        roles_json = excluded.roles_json,
        password_hash = excluded.password_hash,
        pin_hash = excluded.pin_hash,
        company_pin_hash = excluded.company_pin_hash,
        pin_encrypted = excluded.pin_encrypted,
        active = excluded.active,
        status = excluded.status,
        assigned_store_ids_json = excluded.assigned_store_ids_json,
        app_access_json = excluded.app_access_json,
        permissions_json = excluded.permissions_json
    `).run(
      user.id,
      user.organizationId || 'org-loops-001',
      user.email,
      user.fullName,
      user.role || 'CASHIER',
      JSON.stringify(user.roles || [user.role || 'CASHIER']),
      user.passwordHash || '',
      user.pinHash || '',
      user.companyPinHash || null,
      user.pinEncrypted || null,
      (user.active !== false && user.status !== 'INACTIVE' && user.status !== 'SUSPENDED') ? 1 : 0,
      user.status || 'ACTIVE',
      JSON.stringify(user.assignedStoreIds || ['*']),
      JSON.stringify(user.appAccess || {}),
      JSON.stringify(user.permissions || {}),
      user.createdAt || new Date().toISOString()
    );
  } catch (e) {
    // Ignore duplicate errors
  }
}

function ensureRolesInDb() {
  const db = loadDb();
  if (!db.roles || db.roles.length === 0) {
    db.roles = [...SYSTEM_ROLES];
    saveDb();
  } else {
    let changed = false;
    SYSTEM_ROLES.forEach(sysRole => {
      let r = db.roles.find(x => x.id === sysRole.id);
      if (r) {
        if (r.authorityLevel !== sysRole.authorityLevel) {
          r.authorityLevel = sysRole.authorityLevel;
          changed = true;
        }
        if (sysRole.permissions) {
          r.permissions = { ...sysRole.permissions, ...(r.permissions || {}) };
        }
      } else {
        db.roles.push({ ...sysRole });
        changed = true;
      }
    });
    if (changed) saveDb();
  }
  return db.roles;
}

function resolveUserPermissions(user, customPermissions = null) {
  const allRoles = ensureRolesInDb();
  const basePermissions = { ...DEFAULT_PERMISSIONS };

  const userRoles = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role || 'CASHIER'];
  userRoles.forEach(rId => {
    const rObj = allRoles.find(r => r.id === rId);
    if (rObj && rObj.permissions) {
      Object.keys(rObj.permissions).forEach(k => {
        if (rObj.permissions[k] === true) {
          basePermissions[k] = true;
        }
      });
    }
  });

  const hasOwnerSet = userRoles.some(rId => {
    const rObj = allRoles.find(r => r.id === rId);
    return rObj && (rObj.isOwnerSet === true || rObj.permissions?.isOwnerEquivalent === true);
  });

  // Supreme roles: OWNER, SUPER_ADMIN, or custom Owner-Equivalent role holds all permissions
  if (
    user.role === 'OWNER' || 
    user.role === 'SUPER_ADMIN' || 
    userRoles.includes('OWNER') || 
    userRoles.includes('SUPER_ADMIN') ||
    user.isOwnerEquivalent === true ||
    user.permissions?.isOwnerEquivalent === true ||
    hasOwnerSet
  ) {
    Object.keys(basePermissions).forEach(k => {
      basePermissions[k] = true;
    });
    basePermissions.isOwnerEquivalent = true;
    basePermissions.manageStoreData = true;
  }

  const overrides = customPermissions || user.permissions || {};
  Object.keys(overrides).forEach(k => {
    if (typeof overrides[k] === 'boolean') {
      basePermissions[k] = overrides[k];
    }
  });

  return basePermissions;
}

function resolveAppAccess(user, resolvedPermissions) {
  if (user.appAccess) return user.appAccess;
  return {
    pos: resolvedPermissions.openPos || resolvedPermissions.makeSales,
    stock: resolvedPermissions.accessStockApp || resolvedPermissions.viewStock,
    finance: resolvedPermissions.accessFinanceApp || resolvedPermissions.viewFinancialReports
  };
}

function sanitizeUser(user) {
  const db = loadDb();
  const permissions = resolveUserPermissions(user);
  const appAccess = resolveAppAccess(user, permissions);
  const isOwner = user.role === 'OWNER' || user.role === 'SUPER_ADMIN' || Boolean(permissions.isOwnerEquivalent);
  const assignedStoreIds = isOwner
    ? ['*']
    : (Array.isArray(user.assignedStoreIds) && user.assignedStoreIds.length > 0
        ? user.assignedStoreIds
        : (Array.isArray(user.locations) && user.locations.length > 0 ? user.locations : ['*']));

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role || 'CASHIER',
    roles: user.roles || [user.role || 'CASHIER'],
    organizationId: user.organizationId || db.organization?.id || 'org-loops-001',
    assignedStoreIds,
    locations: assignedStoreIds,
    status: user.status || (user.active !== false ? 'ACTIVE' : 'INACTIVE'),
    active: user.active !== false && user.status !== 'SUSPENDED',
    hasPin: !!user.pinHash,
    hasPassword: !!user.passwordHash,
    permissions,
    appAccess,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || null
  };
}

// ----------------------------------------------------------------------------
// 1. ORGANIZATION INITIALIZATION & PUBLIC BUSINESS REGISTRATION (Section 15.1)
// ----------------------------------------------------------------------------

function getOrganizationStatus(orgId = null) {
  const db = loadDb();
  let org = null;
  if (orgId) {
    org = (db.organizations || []).find(o => o.id === orgId);
  }
  if (!org) {
    org = (db.organizations || []).find(o => o.id === 'org-loops-001') || db.organization || {};
  }
  const isRegistered = !!org.ownerRegistered;
  const allowPublicRegistration = org.allowPublicRegistration !== false;
  return {
    id: org.id || 'org-loops-001',
    isRegistered,
    initialized: isRegistered,
    ownerRegistered: isRegistered,
    allowPublicRegistration,
    businessName: org.name || 'The Loops Retail Ecosystem',
    organizationName: org.name || 'The Loops Retail Ecosystem',
    currency: org.currency || 'USD',
    ownerEmail: org.ownerEmail || (db.users.find(u => (u.organizationId === org.id || !u.organizationId) && (u.role === 'OWNER' || u.role === 'SUPER_ADMIN'))?.email)
  };
}

function registerBusinessOrganization({
  businessName,
  ownerName,
  email,
  phone,
  password,
  address,
  country,
  defaultCurrency = 'USD',
  logo = ''
}) {
  const db = loadDb();

  // If public registration has been explicitly disabled by business policy:
  if (db.organization && db.organization.allowPublicRegistration === false) {
    return {
      ok: false,
      error: 'Public business registration is disabled by the organization policy.'
    };
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();
  const cleanOrgName = String(businessName || '').trim();
  const cleanOwnerName = String(ownerName || '').trim();

  if (!cleanOrgName || !cleanOwnerName || !cleanEmail || !cleanPass) {
    return { ok: false, error: 'Business name, owner name, email, and password are required' };
  }

  // Reject duplicate registration for existing email
  if ((db.users || []).some(u => u.email.toLowerCase() === cleanEmail)) {
    return { ok: false, error: 'An account with this email address already exists. Please log in or use a different email.' };
  }

  const orgId = 'org-' + generateUuid().slice(0, 8);
  const companyCode = generateUniqueCompanyCode(cleanOrgName);
  const newOrg = {
    id: orgId,
    name: cleanOrgName,
    companyCode: companyCode,
    ownerName: cleanOwnerName,
    ownerEmail: cleanEmail,
    phone: phone || '',
    address: address || '',
    country: country || 'Cambodia',
    currency: defaultCurrency || 'USD',
    logo: logo || '',
    ownerRegistered: true,
    allowPublicRegistration: true,
    registeredAt: new Date().toISOString(),
    exchangeRate: 4000,
    taxRate: 0.1,
    taxInclusive: false
  };

  if (!db.organizations) {
    db.organizations = [];
  }
  db.organizations.unshift(newOrg);
  if (!db.organization) {
    db.organization = newOrg;
  }

  // 1. Create the Owner Account with full OWNER role and all-stores access (*)
  const ownerId = 'usr-owner-' + generateUuid().slice(0, 6);
  const owner = {
    id: ownerId,
    organizationId: orgId,
    email: cleanEmail,
    fullName: cleanOwnerName,
    role: 'OWNER',
    roles: ['OWNER', 'SUPER_ADMIN'],
    passwordHash: hashPassword(cleanPass),
    pinHash: hashPin('9999'),
    active: true,
    status: 'ACTIVE',
    assignedStoreIds: ['*'], // Automatically granted access to ALL stores belonging to this business
    locations: ['*'],
    appAccess: { pos: true, stock: true, finance: true },
    permissions: {
      openPos: true,
      makeSales: true,
      viewSalesHistory: true,
      refundTransactions: true,
      cancelTransactions: true,
      applyDiscounts: true,
      changeProductPrices: true,
      viewStock: true,
      editStock: true,
      accessStockApp: true,
      accessFinanceApp: true,
      viewFinancialReports: true,
      manageEmployees: true,
      changeSystemSettings: true
    },
    createdAt: new Date().toISOString()
  };
  db.users.unshift(owner);

  // 2. Create the first store location (Section 15.1 Step 6 & 15.2)
  const storeId = 'store-' + generateUuid().slice(0, 8);
  const initialStore = {
    id: storeId,
    organizationId: orgId,
    code: 'ST-01',
    name: `${cleanOrgName} Flagship`,
    address: address || `${country || 'Cambodia'} Branch`,
    phone: phone || '',
    managerId: owner.id,
    managerName: owner.fullName,
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString()
  };
  if (!db.locations) db.locations = [];
  db.locations.unshift(initialStore);

  // 3. Create default register for this store (Section 15.8)
  const registerId = 'reg-' + storeId.slice(-6) + '-01';
  const initialRegister = {
    id: registerId,
    organizationId: orgId,
    locationId: storeId,
    storeId: storeId,
    registerCode: 'REG-01',
    name: `${cleanOrgName} Main Register 01`,
    status: 'CLOSED',
    currentShiftId: null,
    currentCashierId: null
  };
  if (!db.registers) db.registers = [];
  db.registers.unshift(initialRegister);

  // 4. Issue Session Token
  const tokenPair = generateTokenPair(owner, orgId);
  const token = tokenPair.accessToken;
  if (!db.sessions) db.sessions = [];
  db.sessions.push({
    token,
    userId: owner.id,
    organizationId: orgId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + tokenPair.expiresIn * 1000).toISOString()
  });

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'ORGANIZATION_REGISTERED',
    organizationId: orgId,
    performedBy: owner.fullName,
    details: `Business organization "${cleanOrgName}" registered with Owner ${owner.email}. Company Code: ${companyCode}`,
    timestamp: new Date().toISOString()
  });

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    dbSync.prepare(`
      INSERT OR REPLACE INTO organizations (
        id, name, owner_name, owner_email, phone, address, country, currency,
        exchange_rate, tax_rate, tax_inclusive, allow_public_registration, logo, company_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newOrg.id, newOrg.name, newOrg.ownerName, newOrg.ownerEmail, newOrg.phone, newOrg.address, newOrg.country,
      newOrg.currency, newOrg.exchangeRate, newOrg.taxRate, newOrg.taxInclusive ? 1 : 0, 1, newOrg.logo,
      companyCode, newOrg.registeredAt, newOrg.registeredAt
    );
  } catch (e) {
    console.warn('SQLite organization sync warning:', e.message);
  }

  saveDb();

  return {
    ok: true,
    organization: newOrg,
    user: sanitizeUser(owner),
    store: initialStore,
    register: initialRegister,
    token,
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    expiresIn: tokenPair.expiresIn,
    redirectUrl: '/admin'
  };
}

// ----------------------------------------------------------------------------
// 2. PRIVATE CREDENTIALS LOGIN & PIN VERIFICATION
// ----------------------------------------------------------------------------

function loginUser({ identifier, password, pin, companyCode, organizationId, storeId, app = 'POS', clientIp = '127.0.0.1' }) {
  const db = loadDb();
  let user = null;

  if (pin) {
    const cleanPin = String(pin).trim();
    let targetOrgId = organizationId;

    if (companyCode) {
      const orgFromCode = findOrganizationByCode(companyCode);
      if (!orgFromCode) {
        return { ok: false, error: 'Invalid company code. Please check your credentials.' };
      }
      if (organizationId && orgFromCode.id !== organizationId) {
        return { ok: false, error: 'Company code mismatch for selected store context.' };
      }
      targetOrgId = orgFromCode.id;
    }

    if (!targetOrgId) {
      targetOrgId = db.organization?.id || 'org-loops-001';
    }

    const lockoutKey = `${targetOrgId}:${clientIp}`;
    const lockout = checkPinLockout(lockoutKey);
    if (lockout.locked) {
      return {
        ok: false,
        error: 'Too many failed attempts. Please try again later.',
        code: 'PIN_LOCKED',
        remainingSec: lockout.remainingSec
      };
    }

    // Company-based isolation: strictly match users within targetOrgId
    const companyUsers = (db.users || []).filter(u => 
      (u.organizationId || 'org-loops-001') === targetOrgId && 
      u.status !== 'DELETED'
    );
    user = companyUsers.find(u => verifyPin(cleanPin, u.pinHash, u));

    if (!user) {
      recordPinFailure(lockoutKey);
      db.auditLog.unshift({
        id: generateUuid(),
        action: 'PIN_LOGIN_FAILED',
        organizationId: targetOrgId,
        timestamp: new Date().toISOString(),
        details: `Failed Quick PIN authentication attempt in company ${targetOrgId}`
      });
      saveDb();
      return { ok: false, error: 'Invalid PIN. Please try again.' };
    }

    // Reset failed counter upon successful PIN match
    resetPinAttempts(lockoutKey);
  } else if (identifier && password) {
    const cleanId = String(identifier).trim().toLowerCase();
    user = (db.users || []).find(u => 
      u.status !== 'DELETED' && (
        u.email.toLowerCase() === cleanId ||
        u.id.toLowerCase() === cleanId ||
        (u.fullName && u.fullName.toLowerCase() === cleanId)
      )
    );

    if (user) {
      // Auto-seed default password for demo accounts if not set yet
      if (!user.passwordHash) {
        user.passwordHash = hashPassword(user.role === 'OWNER' || user.role === 'SUPER_ADMIN' ? 'admin123' : 'password123');
        saveDb();
      }

      const isValid = verifyPassword(password, user.passwordHash) || verifyPin(password, user.pinHash, user);
      if (!isValid) user = null;
    }

    if (!user) {
      db.auditLog.unshift({
        id: generateUuid(),
        action: 'LOGIN_FAILED',
        timestamp: new Date().toISOString(),
        details: `Failed credentials authentication for ${identifier}`
      });
      saveDb();
      return { ok: false, error: 'Invalid login credentials or password.' };
    }
  } else {
    return { ok: false, error: 'Credentials or PIN required to authenticate.' };
  }

  // Account status verification
  if (user.status === 'INACTIVE' || user.active === false) {
    return { ok: false, error: 'This account is inactive.' };
  }
  if (user.status === 'SUSPENDED') {
    return { ok: false, error: 'Your staff account is suspended. Please contact the Business Administrator.' };
  }

  const permissions = resolveUserPermissions(user);
  const canBackoffice = hasBackofficePermission(user, permissions);
  const canPos = hasPosPermission(user, permissions);

  // For PIN login, user MUST have POS access
  if (pin && !canPos) {
    return { ok: false, error: 'You do not have permission to access this store.' };
  }

  // User without any permission is denied access
  if (!canBackoffice && !canPos) {
    return { ok: false, error: 'Access Denied: You do not have permission to access Backoffice or POS.' };
  }

  // Specific standalone app authorization checks
  if (app === 'STOCK' && !permissions.accessStockApp && !permissions.viewStock && user.role !== 'OWNER' && user.role !== 'SUPER_ADMIN') {
    return { ok: false, error: 'Permission Denied: You are not authorized to access Stock Management.' };
  }
  if (app === 'FINANCE' && !permissions.accessFinanceApp && !permissions.viewFinancialReports && user.role !== 'OWNER' && user.role !== 'SUPER_ADMIN') {
    return { ok: false, error: 'Permission Denied: You are not authorized to access Loops Finance.' };
  }

  // Smart Login Redirection:
  // Rule A: User has Backoffice permission -> Automatically redirect to Backoffice (/admin)
  // Rule B: User does NOT have Backoffice permission -> Automatically redirect directly to POS interface (/pos)
  // Both permissions -> Backoffice (/admin) by default
  const redirectUrl = canBackoffice ? '/admin' : '/pos';

  const sanitized = sanitizeUser(user);

  // Issue Dual Token Pair (RFC 7519 JWT Access Token + Rotating Refresh Token)
  const tokenPair = generateTokenPair(user, user.organizationId || 'org-loops-001');
  const token = tokenPair.accessToken;

  if (!db.sessions) db.sessions = [];
  db.sessions.push({
    token,
    userId: user.id,
    organizationId: user.organizationId || 'org-loops-001',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + tokenPair.expiresIn * 1000).toISOString()
  });

  user.lastLoginAt = new Date().toISOString();

  db.auditLog.unshift({
    id: generateUuid(),
    action: pin ? 'PIN_LOGIN_SUCCESS' : 'LOGIN_SUCCESS',
    userId: user.id,
    userName: user.fullName,
    organizationId: user.organizationId,
    role: user.role,
    details: `Successful ${pin ? 'Quick PIN' : 'Credentials'} login. Landing destination: ${redirectUrl}`,
    timestamp: new Date().toISOString()
  });
  saveDb();

  const orgObj = (db.organizations || []).find(o => o.id === user.organizationId) || db.organization;

  return {
    ok: true,
    user: sanitized,
    organization: orgObj ? { id: orgObj.id, name: orgObj.name, companyCode: orgObj.companyCode } : null,
    token: tokenPair.accessToken,
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    expiresIn: tokenPair.expiresIn,
    redirectUrl,
    canBackoffice,
    canPos
  };
}

function validateSession(token) {
  if (!token) return { ok: false, error: 'No session token provided' };

  // 1. RFC 7519 JWT token verification
  if (typeof token === 'string' && token.split('.').length === 3) {
    try {
      const payload = verifyToken(token);
      const db = loadDb();
      let user = (db.users || []).find(u => u.id === payload.sub);
      if (!user) {
        try {
          const { getDatabase } = require('../../../shared/database/connection');
          user = getDatabase().prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
        } catch (e) {}
      }
      if (!user || user.active === false || user.status === 'SUSPENDED') {
        return { ok: false, error: 'Account suspended or revoked.' };
      }
      return {
        ok: true,
        user: sanitizeUser(user),
        session: { token, userId: user.id, organizationId: payload.org }
      };
    } catch (err) {
      // If JWT expired or clock drifted, verify if session is still active in db.sessions or SQLite
      const db = loadDb();
      const activeSession = (db.sessions || []).find(s => s.token === token && new Date(s.expiresAt) > new Date());
      if (activeSession) {
        let user = (db.users || []).find(u => u.id === activeSession.userId);
        if (!user) {
          try {
            const { getDatabase } = require('../../../shared/database/connection');
            user = getDatabase().prepare('SELECT * FROM users WHERE id = ?').get(activeSession.userId);
          } catch (e) {}
        }
        if (user && user.active !== false && user.status !== 'SUSPENDED') {
          return {
            ok: true,
            user: sanitizeUser(user),
            session: activeSession
          };
        }
      }

      try {
        const { getDatabase } = require('../../../shared/database/connection');
        const dbSql = getDatabase();
        const row = dbSql.prepare(`
          SELECT s.*, u.* 
          FROM sessions s 
          JOIN users u ON s.user_id = u.id 
          WHERE s.token = ? AND s.expires_at > ?
        `).get(token, new Date().toISOString());

        if (row && row.status !== 'SUSPENDED' && row.active !== 0) {
          return {
            ok: true,
            user: sanitizeUser({
              id: row.id || row.user_id,
              organizationId: row.organization_id,
              email: row.email,
              fullName: row.full_name,
              role: row.role,
              status: row.status,
              active: row.active !== 0
            }),
            session: { token, userId: row.user_id, organizationId: row.organization_id }
          };
        }
      } catch (e) {}

      return { ok: false, error: `Invalid or expired session: ${err.message}` };
    }
  }

  // 2. Legacy session token fallback
  const db = loadDb();
  if (!db.sessions) db.sessions = [];

  const session = db.sessions.find(s => s.token === token && new Date(s.expiresAt) > new Date());
  if (!session) {
    try {
      const { getDatabase } = require('../../../shared/database/connection');
      const dbSql = getDatabase();
      const row = dbSql.prepare(`
        SELECT s.*, u.* 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.token = ? AND s.expires_at > ?
      `).get(token, new Date().toISOString());
      if (row && row.status !== 'SUSPENDED' && row.active !== 0) {
        return {
          ok: true,
          user: sanitizeUser({
            id: row.id || row.user_id,
            organizationId: row.organization_id,
            email: row.email,
            fullName: row.full_name,
            role: row.role,
            status: row.status,
            active: row.active !== 0
          }),
          session: { token, userId: row.user_id, organizationId: row.organization_id }
        };
      }
    } catch (e) {}
    return { ok: false, error: 'Session expired or invalid. Please sign in.' };
  }

  const user = db.users.find(u => u.id === session.userId);
  if (!user || user.active === false || user.status === 'SUSPENDED') {
    return { ok: false, error: 'Account suspended or revoked.' };
  }

  return {
    ok: true,
    user: sanitizeUser(user),
    session
  };
}

function logoutUser(token) {
  const db = loadDb();
  if (!db.sessions) return { ok: true };
  const idx = db.sessions.findIndex(s => s.token === token);
  if (idx >= 0) {
    db.sessions.splice(idx, 1);
    saveDb();
  }
  return { ok: true };
}

function revokeUserSessions(userId) {
  const db = loadDb();
  if (!db.sessions) return { ok: true };
  db.sessions = db.sessions.filter(s => s.userId !== userId);
  saveDb();
  return { ok: true };
}

// ----------------------------------------------------------------------------
// 3. PASSWORD RESET SELF-SERVICE
// ----------------------------------------------------------------------------

function requestPasswordReset(email) {
  const db = loadDb();
  const cleanEmail = String(email).trim().toLowerCase();
  const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    // Security best practice: return success without leaking email existence
    return { ok: true, message: 'If this email is registered, a password reset link has been dispatched.' };
  }

  const resetToken = `reset_${crypto.randomBytes(16).toString('hex')}`;
  if (!db.passwordResets) db.passwordResets = [];
  db.passwordResets.push({
    token: resetToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() // 1 hour
  });

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'PASSWORD_RESET_REQUESTED',
    details: `Password reset token generated for ${user.email}`,
    timestamp: new Date().toISOString()
  });

  saveDb();
  return {
    ok: true,
    message: 'Password reset link generated successfully.',
    resetToken
  };
}

function resetPasswordWithToken(resetToken, newPassword) {
  const db = loadDb();
  if (!db.passwordResets) return { ok: false, error: 'Invalid or expired reset token' };

  const entry = db.passwordResets.find(r => r.token === resetToken && new Date(r.expiresAt) > new Date());
  if (!entry) {
    return { ok: false, error: 'Password reset token is invalid or has expired.' };
  }

  const user = db.users.find(u => u.id === entry.userId);
  if (!user) return { ok: false, error: 'User account not found' };

  user.passwordHash = hashPassword(newPassword);
  // Invalidate reset token and previous sessions
  db.passwordResets = db.passwordResets.filter(r => r.token !== resetToken);
  revokeUserSessions(user.id);

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'PASSWORD_RESET_COMPLETED',
    userId: user.id,
    userName: user.fullName,
    details: `Password successfully updated via reset token`,
    timestamp: new Date().toISOString()
  });

  saveDb();
  return { ok: true, message: 'Password reset successfully. You may now log in.' };
}

// ----------------------------------------------------------------------------
// 4. STAFF ACCOUNT CREATION & MANAGEMENT (ADMIN ONLY)
// ----------------------------------------------------------------------------

function createUserAccount({
  email,
  fullName,
  role,
  roles,
  password,
  pin,
  locations,
  assignedStoreIds,
  organizationId,
  permissions,
  appAccess,
  performedBy
}) {
  const db = loadDb();
  const cleanEmail = String(email).trim().toLowerCase();

  if (db.users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return { ok: false, error: 'A staff member with this email address already exists' };
  }

  const orgId = organizationId || 'org-loops-001';
  const primaryRole = role || (Array.isArray(roles) && roles[0]) || 'CASHIER';
  const assignedRoles = Array.isArray(roles) && roles.length > 0 ? roles : [primaryRole];
  const isOwner = primaryRole === 'OWNER';

  // Rule 1: There can be ONLY ONE Owner per business organization
  if (isOwner) {
    const existingOwner = (db.users || []).find(u => 
      (u.organizationId || 'org-loops-001') === orgId && 
      (u.role === 'OWNER' || u.role === 'SUPER_ADMIN') && 
      u.status !== 'DELETED'
    );
    if (existingOwner) {
      return { ok: false, error: 'Only one Business Owner account is permitted per organization. Cannot create another Owner.' };
    }
  }

  // Section 15.3: Dedicated Store / Location Access: One store, Multiple stores, or All stores (*)
  let storesList = assignedStoreIds || locations;
  if (isOwner) {
    storesList = ['*'];
  } else if (Array.isArray(storesList) && storesList.length > 0) {
    storesList = storesList;
  } else {
    storesList = ['*'];
  }

  // Automatic unique PIN generation and company-scoped uniqueness enforcement
  let assignedPin = pin ? String(pin).trim() : null;
  if (!assignedPin) {
    assignedPin = generateUniqueCompanyPin(orgId);
  } else {
    // Validate uniqueness in company
    const targetCompHash = computeCompanyPinHash(assignedPin, orgId);
    const hasDuplicate = (db.users || []).some(u => 
      (u.organizationId || 'org-loops-001') === orgId && 
      u.status !== 'DELETED' &&
      ((u.companyPinHash && u.companyPinHash === targetCompHash) || verifyPin(assignedPin, u.pinHash))
    );
    if (hasDuplicate) {
      return { ok: false, error: 'This PIN is already assigned to another user in this company. Please choose or generate a unique PIN.' };
    }
  }

  const companyPinHash = computeCompanyPinHash(assignedPin, orgId);
  const pinEncrypted = encryptPin(assignedPin);
  const pinHash = hashPin(assignedPin);

  const newUser = {
    id: 'usr-' + generateUuid().slice(0, 8),
    organizationId: orgId,
    email: cleanEmail,
    fullName: fullName.trim(),
    role: primaryRole,
    roles: assignedRoles,
    passwordHash: hashPassword(password || 'password123'),
    pinHash,
    companyPinHash,
    pinEncrypted,
    active: true,
    status: 'ACTIVE',
    assignedStoreIds: storesList,
    locations: storesList,
    appAccess: appAccess || {
      pos: true,
      stock: assignedRoles.some(r => r.includes('STOCK') || r.includes('ADMIN') || r.includes('OWNER')),
      finance: assignedRoles.some(r => r.includes('FINANCE') || r.includes('ADMIN') || r.includes('OWNER'))
    },
    permissions: permissions || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  newUser.permissions = resolveUserPermissions(newUser, newUser.permissions);
  db.users.unshift(newUser);

  // Sync to SQLite multi-tenant users table
  syncUserToSqlite(newUser);

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'USER_CREATED',
    organizationId: orgId,
    performedBy: performedBy || 'Admin',
    userId: newUser.id,
    userName: newUser.fullName,
    details: `Staff account created for ${newUser.fullName} (${newUser.email}) in org ${orgId} with stores [${storesList.join(', ')}] by ${performedBy || 'Admin'}`,
    timestamp: new Date().toISOString()
  });

  saveDb();

  return {
    ok: true,
    user: sanitizeUser(newUser),
    initialPassword: password || 'password123',
    initialPin: assignedPin
  };
}

function updateUser(userId, updates, performedBy, callerOrgId = null, callerUserId = null, callerRole = null) {
  const db = loadDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return { ok: false, error: 'User not found' };

  // Tenant Isolation Enforcement: caller must belong to same organization!
  if (callerOrgId && (user.organizationId || 'org-loops-001') !== callerOrgId) {
    return { ok: false, forbidden: true, error: 'Access forbidden: Cannot modify users from another business organization.' };
  }

  // Rule 2: Only the Business Owner can modify the Owner's account
  if (user.role === 'OWNER') {
    if (callerUserId && callerUserId !== user.id) {
      return { ok: false, forbidden: true, error: 'Access Denied: Only the Business Owner can modify their own account.' };
    }
    if (updates.role && updates.role !== 'OWNER') {
      return { ok: false, error: 'The primary Business Owner role cannot be changed or transferred.' };
    }
  } else {
    // If target is NOT the Owner:
    // Security Guard: Staff members CANNOT modify their own permissions, role, or store access!
    if (callerUserId && callerUserId === user.id) {
      if (updates.role || updates.permissions || updates.assignedStoreIds || updates.locations || updates.appAccess) {
        return { ok: false, forbidden: true, error: 'Security restriction: Staff members cannot modify their own permissions, role, or store access.' };
      }
    }
    // Only the Business Owner can modify permissions, role, or store assignments for staff!
    if (callerRole && callerRole !== 'OWNER') {
      if (updates.role || updates.permissions || updates.assignedStoreIds || updates.locations || updates.appAccess) {
        return { ok: false, forbidden: true, error: 'Permission Denied: Only the Business Owner can change staff roles, permissions, or store access.' };
      }
    }
    // Prevent creating a second owner
    if (updates.role === 'OWNER') {
      return { ok: false, error: 'Only one Business Owner account is permitted per organization. Cannot assign Owner role to staff.' };
    }
  }

  if (updates.fullName) user.fullName = updates.fullName.trim();
  if (updates.email) user.email = updates.email.trim().toLowerCase();
  if (updates.role && user.role !== 'OWNER' && user.role !== 'SUPER_ADMIN') {
    user.role = updates.role;
    if (Array.isArray(updates.roles)) user.roles = updates.roles;
  }
  
  if (user.role === 'OWNER') {
    user.assignedStoreIds = ['*'];
    user.locations = ['*'];
  } else {
    if (updates.assignedStoreIds !== undefined) {
      const list = Array.isArray(updates.assignedStoreIds) && updates.assignedStoreIds.length > 0 
        ? updates.assignedStoreIds 
        : ['*'];
      user.assignedStoreIds = list;
      user.locations = list;
    } else if (updates.locations !== undefined) {
      const list = Array.isArray(updates.locations) && updates.locations.length > 0 
        ? updates.locations 
        : ['*'];
      user.assignedStoreIds = list;
      user.locations = list;
    }
  }

  if (typeof updates.active === 'boolean') user.active = updates.active;
  if (updates.status) {
    user.status = updates.status;
    user.active = updates.status === 'ACTIVE';
    if (updates.status === 'SUSPENDED') {
      revokeUserSessions(user.id);
    }
  }
  if (updates.appAccess) user.appAccess = { ...user.appAccess, ...updates.appAccess };
  if (updates.permissions) {
    user.permissions = { ...user.permissions, ...updates.permissions };
  }
  if (updates.password) {
    user.passwordHash = hashPassword(updates.password);
    revokeUserSessions(user.id);
  }
  if (updates.pin) {
    const cleanPin = String(updates.pin).trim();
    if (cleanPin.length < 4 || cleanPin.length > 8) {
      return { ok: false, error: 'PIN must be between 4 and 8 digits.' };
    }
    const compHash = computeCompanyPinHash(cleanPin, user.organizationId || 'org-loops-001');
    const hasDuplicate = (db.users || []).some(u => 
      u.id !== user.id &&
      (u.organizationId || 'org-loops-001') === (user.organizationId || 'org-loops-001') && 
      u.status !== 'DELETED' &&
      ((u.companyPinHash && u.companyPinHash === compHash) || verifyPin(cleanPin, u.pinHash))
    );
    if (hasDuplicate) {
      return { ok: false, error: 'This PIN is already assigned to another user in this company.' };
    }
    user.pinHash = hashPin(cleanPin);
    user.companyPinHash = compHash;
    user.pinEncrypted = encryptPin(cleanPin);
  }

  user.updatedAt = new Date().toISOString();
  user.permissions = resolveUserPermissions(user, user.permissions);

  // Sync update to SQLite
  syncUserToSqlite(user);

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'USER_UPDATED',
    organizationId: user.organizationId,
    performedBy: performedBy || 'Admin',
    userId: user.id,
    userName: user.fullName,
    details: `Profile & permissions updated for ${user.fullName}`,
    timestamp: new Date().toISOString()
  });

  saveDb();
  return { ok: true, user: sanitizeUser(user) };
}

function deleteUser(userId, performedBy, callerOrgId = null, callerUserId = null) {
  const db = loadDb();
  const idx = db.users.findIndex(u => u.id === userId);
  if (idx < 0) return { ok: false, error: 'User not found' };

  const target = db.users[idx];

  // Prevent deleting currently logged-in user
  if (callerUserId && target.id === callerUserId) {
    return { ok: false, error: 'You cannot delete your own currently active logged-in account.' };
  }

  // Tenant Isolation Enforcement: caller must belong to same organization!
  if (callerOrgId && (target.organizationId || 'org-loops-001') !== callerOrgId) {
    return { ok: false, forbidden: true, error: 'Access forbidden: Cannot delete users from another business organization.' };
  }

  // If deleting an owner, ensure at least one other active owner remains for this business
  if (target.role === 'OWNER' || target.role === 'SUPER_ADMIN') {
    const remainingOwners = db.users.filter(u => 
      u.id !== userId && 
      (u.organizationId || 'org-loops-001') === (target.organizationId || 'org-loops-001') && 
      (u.role === 'OWNER' || u.role === 'SUPER_ADMIN') && 
      u.status !== 'DELETED'
    );
    if (remainingOwners.length === 0) {
      return { ok: false, error: 'Cannot delete the sole remaining Business Owner account for this organization.' };
    }
  }

  db.users.splice(idx, 1);
  revokeUserSessions(userId);

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    getDatabase().prepare('DELETE FROM users WHERE id = ?').run(userId);
  } catch (e) {}

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'USER_DELETED',
    organizationId: target.organizationId,
    performedBy: performedBy || 'Admin',
    userId,
    userName: target.fullName,
    details: `Deleted staff account ${target.fullName} (${target.email})`,
    timestamp: new Date().toISOString()
  });

  saveDb();
  return { ok: true, message: `Account for ${target.fullName} deleted successfully` };
}

// ----------------------------------------------------------------------------
// 4b. DEDICATED PIN SECURITY: REVEAL, REGENERATE, AND UPDATE ENDPOINTS
// ----------------------------------------------------------------------------

const ROLE_AUTHORITY_HIERARCHY = {
  OWNER: 100,
  SUPER_ADMIN: 90,
  FINANCE_ADMIN: 70,
  STOCK_ADMIN: 70,
  POS_ADMIN: 70,
  STORE_MANAGER: 50,
  STOCK_MANAGER: 50,
  PURCHASE_MANAGER: 50,
  ACCOUNTANT: 50,
  SHIFT_SUPERVISOR: 40,
  CASHIER: 20,
  SALES_ASSISTANT: 20,
  INVENTORY_CLERK: 20
};

function getRoleAuthorityLevel(roleOrUser) {
  if (!roleOrUser) return 0;
  const roleId = typeof roleOrUser === 'string' ? roleOrUser : (roleOrUser.role || roleOrUser.id);
  const userPerms = typeof roleOrUser === 'object' ? (roleOrUser.permissions || {}) : {};

  if (roleId === 'OWNER') return 100;
  if (roleId === 'SUPER_ADMIN') return 90;
  if (userPerms.isOwnerEquivalent || userPerms.manageStoreData) return 95;

  const db = loadDb();
  const customRole = (db.roles || []).find(r => r.id === roleId);
  if (customRole) {
    if (customRole.authorityLevel) return customRole.authorityLevel;
    if (customRole.isOwnerSet || customRole.permissions?.isOwnerEquivalent) return 95;
  }

  return ROLE_AUTHORITY_HIERARCHY[roleId] || 10;
}

function revealUserPin(userId, caller) {
  const db = loadDb();
  const targetUser = db.users.find(u => u.id === userId);
  if (!targetUser) return { ok: false, error: 'User not found' };

  // Tenant isolation check
  if (caller.organizationId && (targetUser.organizationId || 'org-loops-001') !== caller.organizationId) {
    return { ok: false, forbidden: true, error: 'Access denied: Cross-company access prohibited.' };
  }

  // Permission check: caller must have viewUserPin permission or be OWNER/SUPER_ADMIN/isOwnerEquivalent
  const callerPerms = caller.permissions || resolveUserPermissions(caller);
  const canView = callerPerms.viewUserPin === true || caller.role === 'OWNER' || caller.role === 'SUPER_ADMIN' || callerPerms.isOwnerEquivalent === true;
  if (!canView) {
    return { ok: false, forbidden: true, error: 'Permission Denied: You do not have permission to view staff PINs.' };
  }

  // Role hierarchy restriction: Only upper level role can see the PIN of down level staff!
  const callerRank = getRoleAuthorityLevel(caller);
  const targetRank = getRoleAuthorityLevel(targetUser);

  if (caller.id !== targetUser.id && callerRank <= targetRank) {
    return {
      ok: false,
      forbidden: true,
      error: `Access Denied: Role hierarchy restriction. You can only view PINs for lower-ranking staff members (Your rank: ${callerRank}, Target rank: ${targetRank}).`
    };
  }

  let pin = decryptPin(targetUser.pinEncrypted);
  if (!pin) {
    // If not encrypted yet, generate a new one or return known demo PIN
    if (targetUser.pinHash && !targetUser.pinHash.includes(':')) {
      pin = targetUser.pinHash;
      targetUser.companyPinHash = computeCompanyPinHash(pin, targetUser.organizationId || 'org-loops-001');
      targetUser.pinEncrypted = encryptPin(pin);
      targetUser.pinHash = hashPin(pin);
      saveDb();
      syncUserToSqlite(targetUser);
    }
  }

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'PIN_VIEWED',
    organizationId: targetUser.organizationId,
    performedBy: caller.fullName || 'Admin',
    userId: targetUser.id,
    userName: targetUser.fullName,
    details: `Quick PIN revealed for employee ${targetUser.fullName} (${targetUser.email}) by ${caller.fullName || 'Admin'}`,
    timestamp: new Date().toISOString()
  });
  saveDb();

  return { ok: true, pin: pin || '••••' };
}

function regenerateUserPin(userId, caller) {
  const db = loadDb();
  const targetUser = db.users.find(u => u.id === userId);
  if (!targetUser) return { ok: false, error: 'User not found' };

  // Tenant isolation check
  if (caller.organizationId && (targetUser.organizationId || 'org-loops-001') !== caller.organizationId) {
    return { ok: false, forbidden: true, error: 'Access denied: Cross-company access prohibited.' };
  }

  // Permission check: caller must have editUserPin permission or be OWNER/SUPER_ADMIN/isOwnerEquivalent
  const callerPerms = caller.permissions || resolveUserPermissions(caller);
  const canEdit = callerPerms.editUserPin === true || caller.role === 'OWNER' || caller.role === 'SUPER_ADMIN' || callerPerms.isOwnerEquivalent === true;
  if (!canEdit) {
    return { ok: false, forbidden: true, error: 'Permission Denied: You do not have permission to edit or regenerate staff PINs.' };
  }

  // Role hierarchy restriction: Only upper level role can regenerate the PIN of down level staff!
  const callerRank = getRoleAuthorityLevel(caller);
  const targetRank = getRoleAuthorityLevel(targetUser);

  if (caller.id !== targetUser.id && callerRank <= targetRank) {
    return {
      ok: false,
      forbidden: true,
      error: `Access Denied: Role hierarchy restriction. You cannot regenerate the PIN of equal or higher-level staff members.`
    };
  }

  const orgId = targetUser.organizationId || 'org-loops-001';
  const newPin = generateUniqueCompanyPin(orgId);

  targetUser.pinHash = hashPin(newPin);
  targetUser.companyPinHash = computeCompanyPinHash(newPin, orgId);
  targetUser.pinEncrypted = encryptPin(newPin);
  targetUser.updatedAt = new Date().toISOString();

  syncUserToSqlite(targetUser);

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'PIN_REGENERATED',
    organizationId: orgId,
    performedBy: caller.fullName || 'Admin',
    userId: targetUser.id,
    userName: targetUser.fullName,
    details: `Quick PIN regenerated for employee ${targetUser.fullName} (${targetUser.email}) by ${caller.fullName || 'Admin'}`,
    timestamp: new Date().toISOString()
  });

  saveDb();

  return { ok: true, pin: newPin, message: 'New unique PIN generated successfully' };
}

function updateUserPin(userId, newPin, caller) {
  const db = loadDb();
  const targetUser = db.users.find(u => u.id === userId);
  if (!targetUser) return { ok: false, error: 'User not found' };

  // Tenant isolation check
  if (caller.organizationId && (targetUser.organizationId || 'org-loops-001') !== caller.organizationId) {
    return { ok: false, forbidden: true, error: 'Access denied: Cross-company access prohibited.' };
  }

  // Permission check: caller must have editUserPin permission or be OWNER/SUPER_ADMIN/isOwnerEquivalent
  const callerPerms = caller.permissions || resolveUserPermissions(caller);
  const canEdit = callerPerms.editUserPin === true || caller.role === 'OWNER' || caller.role === 'SUPER_ADMIN' || callerPerms.isOwnerEquivalent === true;
  if (!canEdit) {
    return { ok: false, forbidden: true, error: 'Permission Denied: You do not have permission to edit staff PINs.' };
  }

  // Role hierarchy restriction: Only upper level role can edit the PIN of down level staff!
  const callerRank = getRoleAuthorityLevel(caller);
  const targetRank = getRoleAuthorityLevel(targetUser);

  if (caller.id !== targetUser.id && callerRank <= targetRank) {
    return {
      ok: false,
      forbidden: true,
      error: `Access Denied: Role hierarchy restriction. You cannot edit the PIN of equal or higher-level staff members.`
    };
  }

  const cleanPin = String(newPin || '').trim();
  if (cleanPin.length < 4 || cleanPin.length > 8) {
    return { ok: false, error: 'PIN must be between 4 and 8 digits.' };
  }

  const orgId = targetUser.organizationId || 'org-loops-001';
  const compHash = computeCompanyPinHash(cleanPin, orgId);

  const hasDuplicate = (db.users || []).some(u => 
    u.id !== targetUser.id &&
    (u.organizationId || 'org-loops-001') === orgId && 
    u.status !== 'DELETED' &&
    ((u.companyPinHash && u.companyPinHash === compHash) || verifyPin(cleanPin, u.pinHash))
  );
  if (hasDuplicate) {
    return { ok: false, error: 'This PIN is already assigned to another user in this company. Please choose another PIN.' };
  }

  targetUser.pinHash = hashPin(cleanPin);
  targetUser.companyPinHash = compHash;
  targetUser.pinEncrypted = encryptPin(cleanPin);
  targetUser.updatedAt = new Date().toISOString();

  syncUserToSqlite(targetUser);

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'PIN_UPDATED',
    organizationId: orgId,
    performedBy: caller.fullName || 'Admin',
    userId: targetUser.id,
    userName: targetUser.fullName,
    details: `Quick PIN updated for employee ${targetUser.fullName} (${targetUser.email}) by ${caller.fullName || 'Admin'}`,
    timestamp: new Date().toISOString()
  });

  saveDb();

  return { ok: true, message: 'PIN updated successfully' };
}

function getRegisteredOrganizations(caller = null, requestedCode = null) {
  const db = loadDb();
  let orgs = db.organizations || [];
  if (orgs.length === 0 && db.organization) {
    orgs = [db.organization];
  }

  // If a specific code was requested for verification:
  if (requestedCode) {
    const matched = findOrganizationByCode(requestedCode);
    if (!matched) return [];
    return [{
      id: matched.id,
      name: matched.name || 'The Loops Retail Ecosystem',
      companyCode: matched.companyCode || '',
      currency: matched.currency || 'USD',
      logo: matched.logo || ''
    }];
  }

  // SECURITY: If called unauthenticated without a code, do NOT leak any business names or tenant list!
  if (!caller) {
    return [];
  }

  // For authenticated backoffice owners / managers: return their accessible organizations
  return orgs.map(o => ({
    id: o.id,
    name: o.name || 'The Loops Retail Ecosystem',
    companyCode: o.companyCode || '',
    ownerName: o.ownerName || '',
    currency: o.currency || 'USD',
    logo: o.logo || '',
    registeredAt: o.registeredAt || o.createdAt || null
  }));
}

function ensureCompanyCodesInitialized() {
  const db = loadDb();
  let changed = false;

  const defaultCodes = {
    'org-6e9ed3cf': 'BV-8821',
    'org-160c29e2': 'BV-7742',
    'org-loops-001': 'LOOPS-01'
  };

  if (db.organization && !db.organization.companyCode) {
    db.organization.companyCode = defaultCodes[db.organization.id] || generateUniqueCompanyCode(db.organization.name);
    changed = true;
  }

  (db.organizations || []).forEach(org => {
    if (!org.companyCode) {
      org.companyCode = defaultCodes[org.id] || generateUniqueCompanyCode(org.name);
      changed = true;
    }
    try {
      const { getDatabase } = require('../../../shared/database/connection');
      const dbSync = getDatabase();
      dbSync.prepare('UPDATE organizations SET company_code = ? WHERE id = ?').run(org.companyCode, org.id);
    } catch (e) {}
  });

  if (changed) {
    saveDb();
  }
}

function ensureUserPinsInitialized() {
  const db = loadDb();
  let changed = false;

  const demoPins = {
    'usr-01': '9999',
    'usr-02': '4821',
    'usr-03': '1111',
    'usr-owner-047584': '8888',
    'usr-owner-83bbcc': '7777',
    'usr-owner-06be7d': '9999',
    'usr-owner-fdc127': '9999'
  };

  const demoUsers = (db.users || []).filter(u => ['usr-01', 'usr-02', 'usr-03'].includes(u.id));
  demoUsers.forEach(u => {
    u.passwordHash = hashPassword('password123');
    changed = true;
  });

  (db.users || []).forEach(user => {
    const orgId = user.organizationId || 'org-loops-001';
    let pin = null;

    if (user.pinEncrypted) {
      pin = decryptPin(user.pinEncrypted);
    }

    if (!pin && demoPins[user.id]) {
      pin = demoPins[user.id];
    } else if (!pin) {
      pin = generateUniqueCompanyPin(orgId);
    }

    if (pin) {
      const compHash = computeCompanyPinHash(pin, orgId);
      if (user.companyPinHash !== compHash || !user.pinEncrypted) {
        user.companyPinHash = compHash;
        user.pinEncrypted = encryptPin(pin);
        user.pinHash = hashPin(pin);
        changed = true;
      }
      syncUserToSqlite(user);
    }
  });

  if (changed) {
    saveDb();
  }
}

// Automatically ensure PINs, Company Codes, and SQLite synchronization at module load
try {
  ensureCompanyCodesInitialized();
  ensureUserPinsInitialized();
} catch (e) {
  console.warn('[Auth] Initialization warning:', e.message);
}

function getUsers({ organizationId } = {}) {
  const db = loadDb();
  let users = db.users || [];
  if (organizationId) {
    users = users.filter(u => (u.organizationId || 'org-loops-001') === organizationId);
  }
  return users.map(sanitizeUser);
}

function getRoles() {
  return ensureRolesInDb();
}

function createCustomRole({ id, name, app = 'POS', description, permissions, createdBy, isOwnerSet = false, authorityLevel = null }) {
  const db = loadDb();
  ensureRolesInDb();

  const roleId = (id || `ROLE_${name.toUpperCase().replace(/\s+/g, '_')}`).trim();
  if (db.roles.some(r => r.id === roleId)) {
    return { ok: false, error: `Role with ID ${roleId} already exists` };
  }

  let mergedPermissions = { ...DEFAULT_PERMISSIONS, ...(permissions || {}) };
  const ownerFlag = Boolean(isOwnerSet || mergedPermissions.isOwnerEquivalent);

  if (ownerFlag) {
    const ownerRole = db.roles.find(r => r.id === 'OWNER');
    if (ownerRole && ownerRole.permissions) {
      mergedPermissions = { ...ownerRole.permissions };
    }
    mergedPermissions.isOwnerEquivalent = true;
    mergedPermissions.manageStoreData = true;
  }

  const newRole = {
    id: roleId,
    name: name.trim(),
    app: ownerFlag ? 'UNIVERSAL' : app,
    isSystem: false,
    isOwnerSet: ownerFlag,
    authorityLevel: ownerFlag ? 95 : (authorityLevel || 50),
    description: description || 'Custom organization role',
    permissions: mergedPermissions,
    createdBy: createdBy || 'Administrator',
    createdAt: new Date().toISOString()
  };

  db.roles.push(newRole);
  saveDb();
  return { ok: true, role: newRole };
}

function updateCustomRole(roleId, updates, updatedBy) {
  const db = loadDb();
  ensureRolesInDb();
  const role = db.roles.find(r => r.id === roleId);
  if (!role) return { ok: false, error: 'Role not found' };

  if (updates.name) role.name = updates.name.trim();
  if (updates.description) role.description = updates.description.trim();
  if (updates.app) role.app = updates.app;
  if (typeof updates.isOwnerSet === 'boolean') {
    role.isOwnerSet = updates.isOwnerSet;
    if (role.isOwnerSet) {
      role.authorityLevel = 95;
      role.app = 'UNIVERSAL';
      const ownerRole = db.roles.find(r => r.id === 'OWNER');
      if (ownerRole && ownerRole.permissions) {
        role.permissions = { ...ownerRole.permissions, isOwnerEquivalent: true, manageStoreData: true };
      }
    }
  }
  if (updates.permissions && !role.isOwnerSet) {
    role.permissions = { ...role.permissions, ...updates.permissions };
  }
  role.updatedAt = new Date().toISOString();
  saveDb();
  return { ok: true, role };
}

function deleteCustomRole(roleId, deletedBy) {
  const db = loadDb();
  ensureRolesInDb();
  const idx = db.roles.findIndex(r => r.id === roleId);
  if (idx < 0) return { ok: false, error: 'Role not found' };

  if (db.roles[idx].isSystem) {
    return { ok: false, error: 'Predefined system roles cannot be deleted' };
  }

  const roleName = db.roles[idx].name;
  db.roles.splice(idx, 1);
  saveDb();
  return { ok: true, message: `Role ${roleName} deleted` };
}

function getAuditLogs(limit = 100, organizationId = null) {
  const db = loadDb();
  let logs = db.auditLog || [];
  if (organizationId) {
    logs = logs.filter(l => (l.organizationId || 'org-loops-001') === organizationId);
  }
  return logs.slice(0, limit);
}

function verifyManagerOverride(pin) {
  const db = loadDb();
  const cleanPin = String(pin).trim();
  const manager = (db.users || []).find(u => verifyPin(cleanPin, u.pinHash, u) && u.active !== false && u.status !== 'SUSPENDED');

  if (!manager) {
    return { ok: false, error: 'Manager PIN authorization failed' };
  }

  const permissions = resolveUserPermissions(manager);
  if (!permissions.refundTransactions && !permissions.manageEmployees && manager.role !== 'SUPER_ADMIN' && manager.role !== 'OWNER') {
    return { ok: false, error: 'User does not hold manager approval authorization' };
  }

  return {
    ok: true,
    manager: {
      id: manager.id,
      fullName: manager.fullName,
      role: manager.role
    }
  };
}

module.exports = {
  DEFAULT_PERMISSIONS,
  SYSTEM_ROLES,
  hashPassword,
  verifyPassword,
  hashPin,
  verifyPin,
  encryptPin,
  decryptPin,
  computeCompanyPinHash,
  getOrganizationStatus,
  registerBusinessOrganization,
  loginUser,
  validateSession,
  logoutUser,
  revokeUserSessions,
  requestPasswordReset,
  resetPasswordWithToken,
  createUserAccount,
  updateUser,
  deleteUser,
  revealUserPin,
  regenerateUserPin,
  updateUserPin,
  generateUniqueCompanyPin,
  generateUniqueCompanyCode,
  verifyCompanyCode,
  findOrganizationByCode,
  regenerateCompanyCode,
  ensureCompanyCodesInitialized,
  getRegisteredOrganizations,
  hasBackofficePermission,
  hasPosPermission,
  getUsers,
  getRoles,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  getAuditLogs,
  getRoleAuthorityLevel,
  verifyManagerOverride,
  resolveUserPermissions,
  sanitizeUser,
  canUserAccessStore: (user, storeId) => require('./storeManager').canUserAccessStore(user, storeId),
  verifyStoreAndRoleAccess: (user, perm, storeId) => require('./storeManager').verifyStoreAndRoleAccess(user, perm, storeId)
};
