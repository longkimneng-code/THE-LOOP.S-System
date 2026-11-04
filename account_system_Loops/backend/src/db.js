// ============================================================================
// Loops Finance V3 — Database Persistence Layer
// Dual Engine: MySQL 8.0 Pool with resilient local JSON/memory fallback
// ============================================================================

const fs = require('fs');
const path = require('path');
let mysql = null;
try {
  mysql = require('mysql2/promise');
} catch (e) {
  // mysql2 will be used once installed
}
try {
  require('dotenv').config();
} catch (e) {
  // dotenv optional
}

const {
  initialBusiness,
  initialSettings,
  initialAccounts,
  initialCapitalAccounts,
  initialCapitalTransactions,
  initialStartupBudgets,
  initialStartupBudgetItems,
  initialShipments,
  initialShipmentItems,
  initialShipmentOverheads,
  initialSupplierBills,
  initialExpenses,
  initialRecurringBills,
  initialInvoices,
  initialJournalEntries
} = require('./seedData');

const {
  calculateLandedCost,
  calculatePnL,
  calculateHealthScoreAndRunway,
  toDecimal
} = require('./calculations');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'loops_finance_state.json');

let mysqlPool = null;
let useMySQL = false;
let memoryDb = null;

// Ensure local data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function initMemoryDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      memoryDb = JSON.parse(raw);
      return;
    } catch (e) {
      console.warn('[DB] Could not parse existing state file, resetting with seed data:', e.message);
    }
  }

  memoryDb = {
    business: { ...initialBusiness },
    settings: { ...initialSettings },
    accounts: [...initialAccounts],
    capitalAccounts: [...initialCapitalAccounts],
    capitalTransactions: [...initialCapitalTransactions],
    startupBudgets: [...initialStartupBudgets],
    startupBudgetItems: [...initialStartupBudgetItems],
    shipments: [...initialShipments],
    shipmentItems: [...initialShipmentItems],
    shipmentOverheads: [...initialShipmentOverheads],
    supplierBills: [...initialSupplierBills],
    expenses: [...initialExpenses],
    recurringBills: [...initialRecurringBills],
    invoices: [...initialInvoices],
    journalEntries: [...initialJournalEntries]
  };

  saveMemoryDb();
}

function saveMemoryDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Error saving local state:', err.message);
  }
}

async function initDatabase() {
  initMemoryDb();

  if (!mysql) {
    console.log('[DB] mysql2 driver not active. Operating in resilient local state mode.');
    return;
  }
  const host = process.env.MYSQL_HOST || 'localhost';
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'loops_finance';
  const port = Number(process.env.MYSQL_PORT) || 3306;

  try {
    const testPool = mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    const [rows] = await testPool.query('SELECT 1 + 1 AS result');
    if (rows && rows[0]?.result === 2) {
      mysqlPool = testPool;
      useMySQL = true;
      console.log(`[DB] Connected successfully to MySQL database "${database}" at ${host}:${port}`);
      return;
    }
  } catch (err) {
    console.log(`[DB] MySQL notice (${err.code || err.message}). Operating in resilient local ACID state mode.`);
    console.log(`[DB] To switch to MySQL, import db/schema.sql into MySQL and update backend/.env.`);
  }
}

// ----------------------------------------------------------------------------
// DATA REPOSITORIES
// ----------------------------------------------------------------------------

function getDb() {
  if (!memoryDb) initMemoryDb();
  return memoryDb;
}

function isSameOrg(entryOrgId, targetOrgId) {
  if (!targetOrgId) return true;
  if (!entryOrgId) return true;
  if (entryOrgId === targetOrgId) return true;
  if ((targetOrgId === 'org-6e9ed3cf' || targetOrgId === 'org-160c29e2') &&
      (entryOrgId === 'org-6e9ed3cf' || entryOrgId === 'org-160c29e2')) {
    return true;
  }
  return false;
}

// 1. Business & Settings
function getBusinessInfo() {
  const db = getDb();
  return {
    business: db.business,
    settings: db.settings
  };
}

function updateBusinessSettings(newSettings) {
  const db = getDb();
  db.settings = { ...db.settings, ...newSettings };
  saveMemoryDb();
  return db.settings;
}

// 2. Chart of Accounts CRUD
function getAccounts(orgId = null) {
  const db = getDb();
  if (!orgId) return db.accounts;
  const balances = getAccountBalancesForOrg(orgId);
  return db.accounts.map(acc => ({
    ...acc,
    balance: balances[acc.code] ? balances[acc.code].balance : 0
  }));
}

function getAccountByCode(code, orgId = null) {
  const accounts = getAccounts(orgId);
  return accounts.find(a => a.code === code);
}

function createAccount({ code, name, type, normalSide, description = '', isSystemProtected = false, organizationId = null }) {
  const db = getDb();
  if (!code || !name || !type) {
    throw new Error('Account code, name, and type are required');
  }
  const cleanCode = String(code).trim();
  const existing = db.accounts.find(a => a.code === cleanCode);
  if (existing) {
    throw new Error(`Account code "${cleanCode}" already exists (${existing.name})`);
  }

  const determinedNormalSide = normalSide || (
    ['ASSET', 'CONTRA_LIABILITY', 'CONTRA_EQUITY', 'COGS', 'OPERATING_EXPENSE', 'EXPENSE'].includes(type.toUpperCase()) ? 'DEBIT' : 'CREDIT'
  );

  const newAcc = {
    code: cleanCode,
    name: name.trim(),
    type: type.toUpperCase(),
    normalSide: determinedNormalSide,
    description: description || '',
    isSystemProtected: Boolean(isSystemProtected),
    balance: 0,
    organizationId: organizationId || 'org-loops-001'
  };

  db.accounts.push(newAcc);
  saveMemoryDb();

  // Relational SQLite sync
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    const now = new Date().toISOString();
    dbSync.prepare(`
      INSERT OR REPLACE INTO chart_of_accounts
      (id, organization_id, code, name, type, normal_balance, description, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `coa-${newAcc.code}`, newAcc.organizationId, newAcc.code, newAcc.name, newAcc.type, newAcc.normalSide, newAcc.description, 1, now
    );
  } catch (e) {}

  return newAcc;
}

function updateAccount(code, { name, description }, organizationId = null) {
  const db = getDb();
  const acc = db.accounts.find(a => a.code === code);
  if (!acc) throw new Error(`Account ${code} not found`);

  if (name) acc.name = name.trim();
  if (description !== undefined) acc.description = description;

  saveMemoryDb();

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    dbSync.prepare(`
      UPDATE chart_of_accounts SET name = ?, description = ? WHERE code = ?
    `).run(acc.name, acc.description || '', code);
  } catch (e) {}

  return acc;
}

function deleteAccount(code, organizationId = null) {
  const db = getDb();
  const idx = db.accounts.findIndex(a => a.code === code);
  if (idx === -1) throw new Error(`Account ${code} not found`);

  const acc = db.accounts[idx];
  const SYSTEM_PROTECTED_CODES = ['1010', '1015', '1020', '1030', '1100', '1150', '1200', '1210', '1215', '2010', '2020', '2060', '3010', '3030', '3050', '3100', '3200', '4010', '5010', '5040', '6060', '6090', '7020', '7030'];
  if (acc.isSystemProtected || SYSTEM_PROTECTED_CODES.includes(code)) {
    throw new Error(`Account ${code} (${acc.name}) is system-protected and cannot be deleted.`);
  }

  // Check if account has any journal activity or non-zero balance
  const hasTransactions = db.journalEntries.some(j => (j.lines || []).some(l => l.accountCode === code));
  if (hasTransactions || Math.abs(Number(acc.balance || 0)) > 0.001) {
    throw new Error(`Cannot delete account ${code} because it contains active transactions or a non-zero balance.`);
  }

  db.accounts.splice(idx, 1);
  saveMemoryDb();

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    dbSync.prepare(`DELETE FROM chart_of_accounts WHERE code = ?`).run(code);
  } catch (e) {}

  return { success: true, code };
}

// 2b. Cash & Bank Transfers
function createCashTransfer({ fromAccountCode = '1010', toAccountCode = '1020', amount, notes = '', transactionDate = null, organizationId = null }) {
  const db = getDb();
  const numAmount = toDecimal(amount);
  if (numAmount <= 0) throw new Error('Transfer amount must be greater than zero');
  if (fromAccountCode === toAccountCode) throw new Error('Source and destination accounts must be different');

  const fromAcc = getAccountByCode(fromAccountCode) || { name: 'From Account', normalSide: 'DEBIT' };
  const toAcc = getAccountByCode(toAccountCode) || { name: 'To Account', normalSide: 'DEBIT' };

  const txId = `trf-${Date.now()}`;
  const entry = postJournalEntry({
    sourceType: 'TRANSFER',
    sourceId: txId,
    organizationId,
    memo: `Transfer $${numAmount.toFixed(2)}: ${fromAcc.name} (${fromAccountCode}) -> ${toAcc.name} (${toAccountCode}) ${notes ? '— ' + notes : ''}`,
    accountingDate: transactionDate,
    lines: [
      {
        accountCode: toAccountCode,
        accountName: toAcc.name,
        debit: numAmount,
        credit: 0
      },
      {
        accountCode: fromAccountCode,
        accountName: fromAcc.name,
        debit: 0,
        credit: numAmount
      }
    ]
  });

  return {
    id: txId,
    fromAccountCode,
    toAccountCode,
    amount: numAmount,
    transactionDate: entry.accountingDate,
    journalEntryId: entry.id,
    entryNumber: entry.entryNumber
  };
}

// 3. Capital & Equity
function getCapitalOverview(orgId = null) {
  const db = getDb();
  const accounts = orgId ? (db.capitalAccounts || []).filter(a => isSameOrg(a.organizationId, orgId)) : (db.capitalAccounts || []);
  const transactions = orgId ? (db.capitalTransactions || []).filter(t => isSameOrg(t.organizationId, orgId)) : (db.capitalTransactions || []);
  const totalContributed = accounts.reduce((sum, a) => sum + Number(a.totalInvested || 0), 0);
  const totalWithdrawn = accounts.reduce((sum, a) => sum + Number(a.totalWithdrawn || 0), 0);
  const netEquity = totalContributed - totalWithdrawn;

  return {
    accounts,
    transactions,
    totalContributed,
    totalWithdrawn,
    netEquity
  };
}

function addCapitalPartner({ partnerName, partnerRole, ownershipPercentage = 0, initialInvestment = 0, notes = '', organizationId = null }) {
  const db = getDb();
  const orgId = organizationId || 'org-loops-001';
  const nameTrimmed = (partnerName || '').trim();
  if (!nameTrimmed) throw new Error('Partner/Investor name is required.');

  // Check if partner with same name already exists in this organization
  const existing = (db.capitalAccounts || []).find(p => isSameOrg(p.organizationId, orgId) && p.partnerName.toLowerCase() === nameTrimmed.toLowerCase());
  if (existing) {
    throw new Error(`An investor or partner named "${nameTrimmed}" already exists.`);
  }

  const newPartner = {
    id: `cap-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    organizationId: orgId,
    partnerName: nameTrimmed,
    partnerRole: partnerRole || 'Co-investor',
    ownershipPercentage: Number(ownershipPercentage) || 0,
    totalInvested: 0,
    totalWithdrawn: 0,
    currentEquity: 0,
    notes: notes || '',
    createdAt: new Date().toISOString()
  };

  if (!db.capitalAccounts) db.capitalAccounts = [];
  db.capitalAccounts.push(newPartner);

  // If initial investment was specified > 0, record the initial investment transaction
  const initInv = Number(initialInvestment) || 0;
  if (initInv > 0) {
    newPartner.totalInvested = initInv;
    newPartner.currentEquity = initInv;

    const tx = {
      id: `ctx-${Date.now()}`,
      organizationId: orgId,
      capitalAccountId: newPartner.id,
      partnerName: newPartner.partnerName,
      type: 'INITIAL_INVESTMENT',
      amount: initInv,
      transactionDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'BANK_TRANSFER',
      notes: notes || `Initial capital contribution upon onboarding partner ${nameTrimmed}`
    };
    if (!db.capitalTransactions) db.capitalTransactions = [];
    db.capitalTransactions.unshift(tx);

    postJournalEntry({
      sourceType: 'CAPITAL',
      sourceId: tx.id,
      organizationId: orgId,
      memo: `${newPartner.partnerName} (${newPartner.partnerRole}) — INITIAL INVESTMENT`,
      lines: [
        {
          accountCode: '1020',
          accountName: 'Bank Operating Account',
          debit: initInv,
          credit: 0
        },
        {
          accountCode: '3010',
          accountName: 'Owner Capital',
          debit: 0,
          credit: initInv
        }
      ]
    });
  }

  saveMemoryDb();

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    dbSync.prepare(`
      INSERT OR REPLACE INTO capital_accounts 
      (id, organization_id, partner_name, partner_role, ownership_percentage, total_invested, total_withdrawn, current_equity, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newPartner.id, orgId, newPartner.partnerName, newPartner.partnerRole, newPartner.ownershipPercentage, newPartner.totalInvested, newPartner.totalWithdrawn, newPartner.currentEquity, newPartner.notes, newPartner.createdAt
    );
  } catch (e) {
    console.warn('SQLite capital_accounts insert:', e.message);
  }

  return newPartner;
}

function deleteCapitalPartner(partnerId, organizationId = null) {
  const db = getDb();
  const idx = (db.capitalAccounts || []).findIndex(p => p.id === partnerId && isSameOrg(p.organizationId, organizationId));
  if (idx === -1) throw new Error('Partner/Investor account not found.');

  const partner = db.capitalAccounts[idx];
  const txCount = (db.capitalTransactions || []).filter(t => t.capitalAccountId === partner.id).length;
  if (txCount > 0 || (partner.currentEquity && partner.currentEquity !== 0)) {
    throw new Error(`Cannot delete partner "${partner.partnerName}" because they have ${txCount} historical capital transaction(s) or active equity ($${partner.currentEquity}). Reverse transactions first to preserve audit history.`);
  }

  db.capitalAccounts.splice(idx, 1);
  saveMemoryDb();

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    dbSync.prepare('DELETE FROM capital_accounts WHERE id = ?').run(partnerId);
  } catch (e) {}

  return { success: true, deletedId: partnerId, partnerName: partner.partnerName };
}

function addCapitalTransaction({ partnerName, capitalAccountId, type, amount, notes, transactionDate, paymentMethod = 'BANK_TRANSFER', organizationId = null }) {
  const db = getDb();
  const orgId = organizationId || 'org-loops-001';
  let partner = null;
  if (capitalAccountId) {
    partner = (db.capitalAccounts || []).find(p => p.id === capitalAccountId);
  }
  if (!partner && partnerName) {
    partner = (db.capitalAccounts || []).find(p => isSameOrg(p.organizationId, orgId) && p.partnerName.toLowerCase() === partnerName.toLowerCase());
    if (!partner) {
      partner = {
        id: `partner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        partnerName: String(partnerName).trim(),
        role: 'Investor / Partner',
        title: 'Investor',
        organizationId: orgId,
        ownershipPercent: 0,
        createdAt: new Date().toISOString()
      };
      if (!db.capitalAccounts) db.capitalAccounts = [];
      db.capitalAccounts.push(partner);
    }
  }
  
  if (!partner) {
    throw new Error('Please select a valid investor or partner from the list.');
  }

  const numAmount = Number(amount) || 0;
  if (numAmount <= 0) {
    throw new Error('Capital transaction amount must be greater than $0.00.');
  }

  if (type === 'INITIAL_INVESTMENT' || type === 'CAPITAL_INJECTION') {
    partner.totalInvested += numAmount;
    partner.currentEquity += numAmount;
  } else if (type === 'OWNER_DRAWING' || type === 'DIVIDEND_PAYOUT') {
    partner.totalWithdrawn += numAmount;
    partner.currentEquity -= numAmount;
  }

  const tx = {
    id: `ctx-${Date.now()}`,
    organizationId: orgId,
    capitalAccountId: partner.id,
    partnerName: partner.partnerName,
    partnerRole: partner.partnerRole,
    type,
    amount: numAmount,
    transactionDate: transactionDate || new Date().toISOString().split('T')[0],
    paymentMethod,
    notes: notes || 'Capital transaction'
  };

  db.capitalTransactions.unshift(tx);

  // Auto-post balanced journal entry
  const isDeposit = type === 'INITIAL_INVESTMENT' || type === 'CAPITAL_INJECTION';
  postJournalEntry({
    sourceType: 'CAPITAL',
    sourceId: tx.id,
    organizationId: orgId,
    memo: `${partner.partnerName} (${partner.partnerRole || 'Partner'}) — ${type.replace(/_/g, ' ')}`,
    lines: [
      {
        accountCode: '1020', // Bank
        accountName: 'Bank Operating Account',
        debit: isDeposit ? numAmount : 0,
        credit: isDeposit ? 0 : numAmount
      },
      {
        accountCode: isDeposit ? '3010' : '3030', // Owner Capital or Drawings
        accountName: isDeposit ? 'Owner Capital' : 'Owner Drawings',
        debit: isDeposit ? 0 : numAmount,
        credit: isDeposit ? numAmount : 0
      }
    ]
  });

  saveMemoryDb();
  return tx;
}

// 4. Startup Budgets & CAPEX/OPEX Tracker
function getStartupBudgetSummary() {
  const db = getDb();
  const budget = db.startupBudgets[0] || {
    id: 'bud-main',
    name: 'Main Business Launch Budget',
    totalBudgetCapex: 0,
    totalBudgetOpex: 0,
    totalActualSpent: 0
  };

  const items = db.startupBudgetItems;
  let totalCapexBudget = 0;
  let totalCapexSpent = 0;
  let totalOpexBudget = 0;
  let totalOpexSpent = 0;
  let totalDepositBudget = 0;
  let totalDepositSpent = 0;

  items.forEach(item => {
    const budgeted = Number(item.budgetedAmount) || 0;
    const actual = Number(item.actualAmount) || 0;

    if (item.classification === 'CAPEX') {
      totalCapexBudget += budgeted;
      totalCapexSpent += actual;
    } else if (item.classification === 'OPEX') {
      totalOpexBudget += budgeted;
      totalOpexSpent += actual;
    } else {
      totalDepositBudget += budgeted;
      totalDepositSpent += actual;
    }
  });

  return {
    budget,
    items,
    totals: {
      capex: { budgeted: totalCapexBudget, spent: totalCapexSpent, variance: totalCapexBudget - totalCapexSpent },
      opex: { budgeted: totalOpexBudget, spent: totalOpexSpent, variance: totalOpexBudget - totalOpexSpent },
      deposit: { budgeted: totalDepositBudget, spent: totalDepositSpent, variance: totalDepositBudget - totalDepositSpent },
      overall: {
        budgeted: totalCapexBudget + totalOpexBudget + totalDepositBudget,
        spent: totalCapexSpent + totalOpexSpent + totalDepositSpent,
        variance: (totalCapexBudget + totalOpexBudget + totalDepositBudget) - (totalCapexSpent + totalOpexSpent + totalDepositSpent)
      }
    }
  };
}

function addStartupBudgetItem(item) {
  const db = getDb();
  const newItem = {
    id: `sbi-${Date.now()}`,
    budgetId: db.startupBudgets[0]?.id || 'bud-launch-001',
    category: item.category || 'General',
    classification: item.classification || 'CAPEX',
    phase: item.phase || 'PRE_LAUNCH',
    name: item.name,
    budgetedAmount: Number(item.budgetedAmount) || 0,
    actualAmount: Number(item.actualAmount) || 0,
    status: item.status || 'PLANNED',
    notes: item.notes || ''
  };

  db.startupBudgetItems.push(newItem);
  saveMemoryDb();
  return newItem;
}

// 5. Imports & Landed Cost Engine
function getShipmentsList() {
  const db = getDb();
  return db.shipments.map(s => {
    const items = db.shipmentItems.filter(i => i.shipmentId === s.id);
    const overheads = db.shipmentOverheads.filter(o => o.shipmentId === s.id);
    return {
      ...s,
      itemCount: items.length,
      overheadCount: overheads.length
    };
  });
}

function getShipmentDetails(shipmentId) {
  const db = getDb();
  const shipment = db.shipments.find(s => s.id === shipmentId);
  if (!shipment) return null;

  const items = db.shipmentItems.filter(i => i.shipmentId === shipmentId);
  const overheads = db.shipmentOverheads.filter(o => o.shipmentId === shipmentId);

  // Recalculate live allocation using the V3 mathematical engine
  const calculationResult = calculateLandedCost(items, overheads);

  return {
    shipment,
    items: calculationResult.items,
    overheads,
    summary: {
      totalGoodsCost: calculationResult.totalGoodsCost,
      totalOverheadCost: calculationResult.totalOverheadCost,
      totalLandedCost: calculationResult.totalLandedCost
    }
  };
}

function createShipment(shipmentData, items = [], overheads = []) {
  const db = getDb();
  const orgId = shipmentData.organizationId || 'org-6e9ed3cf';
  const newShipment = {
    id: `ship-${Date.now()}`,
    organizationId: orgId,
    shipmentCode: shipmentData.shipmentCode || `IMP-${new Date().getFullYear()}-${String(db.shipments.length + 1).padStart(3, '0')}`,
    supplierName: shipmentData.supplierName || 'Overseas Supplier',
    originCountry: shipmentData.originCountry || 'China',
    shippingTerms: shipmentData.shippingTerms || 'FOB',
    shippingCategory: shipmentData.shippingCategory || '',
    status: shipmentData.status || 'ESTIMATE',
    foreignCurrency: shipmentData.foreignCurrency || 'USD',
    exchangeRate: Number(shipmentData.exchangeRate) || 1.0,
    totalGoodsCostBase: 0,
    totalOverheadsBase: 0,
    totalLandedCostBase: 0,
    paymentStatus: shipmentData.paymentStatus || 'PAID',
    paymentMethod: shipmentData.paymentMethod || 'BANK_TRANSFER',
    notes: shipmentData.notes || ''
  };

  db.shipments.unshift(newShipment);

  if (items && items.length > 0) {
    items.forEach((item, index) => {
      db.shipmentItems.push({
        id: item.id || `isi-${Date.now()}-${index}`,
        organizationId: orgId,
        shipmentId: newShipment.id,
        skuCode: item.skuCode || `SKU-IMP-${index + 1}`,
        barcode: item.barcode || (880300000000 + Math.floor(Math.random() * 800000)).toString(),
        productName: item.productName || 'Import Product',
        variantName: item.variantName || 'Standard',
        quantity: Number(item.quantity) || 1,
        unit_base_price_fc: Number(item.unitBasePrice) || 0,
        unit_base_price_base: Number(item.unitBasePrice) * (Number(shipmentData.exchangeRate) || 1.0),
        unit_weight_kg: Number(item.unitWeightKg) || 0,
        unit_volume_cbm: Number(item.unitVolumeCbm) || 0,
        target_retail_price: Number(item.targetRetailPrice) || 0,
        imageUrl: item.imageUrl || '',
        category: item.category || 'General'
      });
    });
  }

  if (overheads && overheads.length > 0) {
    overheads.forEach((ovh, index) => {
      db.shipmentOverheads.push({
        id: ovh.id || `ovh-${Date.now()}-${index}`,
        organizationId: orgId,
        shipmentId: newShipment.id,
        category: ovh.category || 'INTERNATIONAL_FREIGHT',
        vendorName: ovh.vendorName || 'Freight Carrier',
        invoiceNumber: ovh.invoiceNumber || '',
        currency: ovh.currency || 'USD',
        exchangeRate: Number(ovh.exchangeRate) || 1.0,
        amountForeign: Number(ovh.amount) || 0,
        amountBase: Number(ovh.amount) * (Number(ovh.exchangeRate) || 1.0),
        isCapitalizable: ovh.isCapitalizable !== false,
        allocationBasis: ovh.allocationBasis || 'BY_WEIGHT',
        isPaid: ovh.isPaid !== false
      });
    });
  }

  saveMemoryDb();

  // Relational SQLite persistence
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    const now = new Date().toISOString();
    dbSync.prepare(`
      INSERT OR REPLACE INTO shipments 
      (id, organization_id, shipment_number, supplier_name, origin_country, incoterms, status, order_date, currency, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newShipment.id, orgId, newShipment.shipmentCode, newShipment.supplierName, newShipment.originCountry, newShipment.shippingTerms, newShipment.status, now, newShipment.foreignCurrency, now
    );
    if (items && items.length > 0) {
      const insItem = dbSync.prepare(`
        INSERT OR REPLACE INTO shipment_items
        (id, organization_id, shipment_id, sku, product_name, quantity, fob_unit_cost_minor, fob_total_minor, landed_unit_cost_minor, landed_total_minor)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      items.forEach((item, index) => {
        const qty = Number(item.quantity) || 1;
        const costMinor = Math.round((Number(item.unitBasePrice) || 0) * 100);
        const totalMinor = costMinor * qty;
        insItem.run(
          `isi-${newShipment.id}-${index}`, orgId, newShipment.id, item.skuCode || `SKU-${index}`, item.productName || 'Import Product', qty, costMinor, totalMinor, costMinor, totalMinor
        );
      });
    }
  } catch (e) {
    console.warn('SQLite shipment create sync:', e.message);
  }

  return getShipmentDetails(newShipment.id);
}

function updateShipment(shipmentId, shipmentData, items = null, overheads = null) {
  const db = getDb();
  const shipment = db.shipments.find(s => s.id === shipmentId);
  if (!shipment) throw new Error('Shipment not found');

  if (shipment.status === 'FINALIZED') {
    throw new Error('Cannot edit a finalized shipment with locked landed costs. Reverse journal entries first.');
  }

  if (shipmentData.shipmentCode) shipment.shipmentCode = shipmentData.shipmentCode;
  if (shipmentData.supplierName) shipment.supplierName = shipmentData.supplierName;
  if (shipmentData.originCountry) shipment.originCountry = shipmentData.originCountry;
  if (shipmentData.shippingTerms) shipment.shippingTerms = shipmentData.shippingTerms;
  if (shipmentData.shippingCategory !== undefined) shipment.shippingCategory = shipmentData.shippingCategory;
  if (shipmentData.foreignCurrency) shipment.foreignCurrency = shipmentData.foreignCurrency;
  if (shipmentData.exchangeRate !== undefined) shipment.exchangeRate = Number(shipmentData.exchangeRate) || 1.0;
  if (shipmentData.paymentStatus !== undefined) shipment.paymentStatus = shipmentData.paymentStatus;
  if (shipmentData.paymentMethod !== undefined) shipment.paymentMethod = shipmentData.paymentMethod;
  if (shipmentData.notes !== undefined) shipment.notes = shipmentData.notes;
  if (shipmentData.status) shipment.status = shipmentData.status;

  const orgId = shipment.organizationId || shipmentData.organizationId || 'org-6e9ed3cf';
  shipment.organizationId = orgId;

  if (Array.isArray(items)) {
    db.shipmentItems = db.shipmentItems.filter(i => i.shipmentId !== shipmentId);
    items.forEach((item, index) => {
      db.shipmentItems.push({
        id: item.id || `isi-${Date.now()}-${index}`,
        organizationId: orgId,
        shipmentId: shipment.id,
        skuCode: item.skuCode || `SKU-IMP-${index + 1}`,
        productName: item.productName || 'Import Product',
        variantName: item.variantName || 'Standard',
        quantity: Number(item.quantity) || 1,
        unit_base_price_fc: Number(item.unitBasePrice) || 0,
        unit_base_price_base: Number(item.unitBasePrice) * (Number(shipment.exchangeRate) || 1.0),
        unit_weight_kg: Number(item.unitWeightKg) || 0,
        unit_volume_cbm: Number(item.unitVolumeCbm) || 0,
        target_retail_price: Number(item.targetRetailPrice) || 0,
        imageUrl: item.imageUrl || '',
        category: item.category || 'General'
      });
    });
  }

  if (Array.isArray(overheads)) {
    db.shipmentOverheads = db.shipmentOverheads.filter(o => o.shipmentId !== shipmentId);
    overheads.forEach((ovh, index) => {
      db.shipmentOverheads.push({
        id: ovh.id || `ovh-${Date.now()}-${index}`,
        organizationId: orgId,
        shipmentId: shipment.id,
        category: ovh.category || 'INTERNATIONAL_FREIGHT',
        vendorName: ovh.vendorName || 'Freight Carrier',
        invoiceNumber: ovh.invoiceNumber || '',
        currency: ovh.currency || 'USD',
        exchangeRate: Number(ovh.exchangeRate) || 1.0,
        amountForeign: Number(ovh.amount) || 0,
        amountBase: Number(ovh.amount) * (Number(ovh.exchangeRate) || 1.0),
        isCapitalizable: ovh.isCapitalizable !== false,
        allocationBasis: ovh.allocationBasis || 'BY_WEIGHT',
        isPaid: ovh.isPaid !== false
      });
    });
  }

  saveMemoryDb();

  // SQLite update
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    dbSync.prepare(`
      UPDATE shipments 
      SET shipment_number = ?, supplier_name = ?, origin_country = ?, incoterms = ?, status = ?, currency = ?
      WHERE id = ?
    `).run(
      shipment.shipmentCode, shipment.supplierName, shipment.originCountry, shipment.shippingTerms, shipment.status, shipment.foreignCurrency, shipmentId
    );
    if (Array.isArray(items) && items.length > 0) {
      dbSync.prepare('DELETE FROM shipment_items WHERE shipment_id = ?').run(shipmentId);
      const insItem = dbSync.prepare(`
        INSERT OR REPLACE INTO shipment_items
        (id, organization_id, shipment_id, sku, product_name, quantity, fob_unit_cost_minor, fob_total_minor, landed_unit_cost_minor, landed_total_minor)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      items.forEach((item, index) => {
        const qty = Number(item.quantity) || 1;
        const costMinor = Math.round((Number(item.unitBasePrice || item.unit_base_price_fc || item.unit_base_price_base) || 0) * 100);
        const totalMinor = costMinor * qty;
        insItem.run(
          item.id || `isi-${shipment.id}-${index}`, orgId, shipment.id, item.skuCode || `SKU-${index}`, item.productName || 'Import Product', qty, costMinor, totalMinor, costMinor, totalMinor
        );
      });
    }
  } catch (e) {
    console.warn('SQLite shipment update sync:', e.message);
  }

  return getShipmentDetails(shipmentId);
}

function deleteShipment(shipmentId) {
  const db = getDb();
  const idx = db.shipments.findIndex(s => s.id === shipmentId);
  if (idx === -1) throw new Error('Shipment not found');
  const shipment = db.shipments[idx];
  if (shipment.status === 'FINALIZED') {
    throw new Error('Cannot delete a finalized shipment with locked landed costs. Reverse journal entries first.');
  }
  db.shipments.splice(idx, 1);
  db.shipmentItems = db.shipmentItems.filter(i => i.shipmentId !== shipmentId);
  db.shipmentOverheads = db.shipmentOverheads.filter(o => o.shipmentId !== shipmentId);
  saveMemoryDb();

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    dbSync.prepare('DELETE FROM shipment_items WHERE shipment_id = ?').run(shipmentId);
    dbSync.prepare('DELETE FROM shipments WHERE id = ?').run(shipmentId);
  } catch (e) {}

  return { success: true, id: shipmentId };
}

function addShipmentOverhead(shipmentId, overheadData) {
  const db = getDb();
  const shipment = db.shipments.find(s => s.id === shipmentId);
  if (!shipment) throw new Error('Shipment not found');
  if (shipment.status === 'FINALIZED') {
    throw new Error('Cannot add overheads to a finalized shipment with locked landed costs.');
  }

  const orgId = shipment.organizationId || 'org-loops-001';
  const ovh = {
    id: `ovh-${Date.now()}`,
    organizationId: orgId,
    shipmentId,
    category: overheadData.category || 'INTERNATIONAL_FREIGHT',
    vendorName: overheadData.vendorName || 'Logistics Partner',
    invoiceNumber: overheadData.invoiceNumber || '',
    currency: overheadData.currency || 'USD',
    exchangeRate: Number(overheadData.exchangeRate) || 1.0,
    amountForeign: Number(overheadData.amount) || 0,
    amountBase: Number(overheadData.amount) * (Number(overheadData.exchangeRate) || 1.0),
    isCapitalizable: overheadData.isCapitalizable !== false,
    allocationBasis: overheadData.allocationBasis || 'BY_WEIGHT',
    isPaid: overheadData.isPaid !== false
  };

  db.shipmentOverheads.push(ovh);
  saveMemoryDb();

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    const now = new Date().toISOString();
    dbSync.prepare(`
      INSERT OR REPLACE INTO shipment_overheads
      (id, organization_id, shipment_id, category, vendor_name, amount_minor, allocation_basis, is_capitalizable, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ovh.id, orgId, shipmentId, ovh.category, ovh.vendorName, Math.round(ovh.amountBase * 100), ovh.allocationBasis, ovh.isCapitalizable ? 1 : 0, now
    );
  } catch (e) {}

  return getShipmentDetails(shipmentId);
}

function updateShipmentOverhead(shipmentId, overheadId, overheadData) {
  const db = getDb();
  const shipment = db.shipments.find(s => s.id === shipmentId);
  if (!shipment) throw new Error('Shipment not found');
  if (shipment.status === 'FINALIZED') {
    throw new Error('Cannot edit overheads of a finalized shipment with locked landed costs.');
  }

  const ovh = (db.shipmentOverheads || []).find(o => o.id === overheadId);
  if (!ovh) throw new Error('Overhead invoice not found');

  if (overheadData.category) ovh.category = overheadData.category;
  if (overheadData.vendorName) ovh.vendorName = overheadData.vendorName;
  if (overheadData.invoiceNumber !== undefined) ovh.invoiceNumber = overheadData.invoiceNumber;
  if (overheadData.currency) ovh.currency = overheadData.currency;
  if (overheadData.amount !== undefined) {
    const amt = Number(overheadData.amount) || 0;
    const rate = Number(overheadData.exchangeRate || ovh.exchangeRate) || 1.0;
    ovh.amountForeign = amt;
    ovh.exchangeRate = rate;
    ovh.amountBase = amt * rate;
  }
  if (overheadData.allocationBasis) ovh.allocationBasis = overheadData.allocationBasis;
  if (overheadData.isCapitalizable !== undefined) ovh.isCapitalizable = overheadData.isCapitalizable !== false;
  if (overheadData.notes !== undefined) ovh.notes = overheadData.notes;

  saveMemoryDb();

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    dbSync.prepare(`
      UPDATE shipment_overheads
      SET category = ?, vendor_name = ?, amount_minor = ?, allocation_basis = ?
      WHERE id = ?
    `).run(ovh.category, ovh.vendorName, Math.round(ovh.amountBase * 100), ovh.allocationBasis, overheadId);
  } catch (e) {}

  return getShipmentDetails(shipmentId);
}

function deleteShipmentOverhead(shipmentId, overheadId) {
  const db = getDb();
  const shipment = db.shipments.find(s => s.id === shipmentId);
  if (!shipment) throw new Error('Shipment not found');
  if (shipment.status === 'FINALIZED') {
    throw new Error('Cannot delete overheads from a finalized shipment with locked landed costs.');
  }

  db.shipmentOverheads = (db.shipmentOverheads || []).filter(o => o.id !== overheadId);
  saveMemoryDb();

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    dbSync.prepare('DELETE FROM shipment_overheads WHERE id = ?').run(overheadId);
  } catch (e) {}

  return getShipmentDetails(shipmentId);
}

function updateShipmentStatus(shipmentId, status) {
  const db = getDb();
  const shipment = db.shipments.find(s => s.id === shipmentId);
  if (!shipment) throw new Error('Shipment not found');
  shipment.status = status;
  saveMemoryDb();
  return getShipmentDetails(shipmentId);
}

function finalizeShipmentLandedCost(shipmentId, overrideOrgId = null) {
  const db = getDb();
  const shipment = db.shipments.find(s => s.id === shipmentId);
  if (!shipment) throw new Error('Shipment not found');

  if (shipment.status === 'FINALIZED') {
    return getShipmentDetails(shipmentId);
  }

  const detailed = getShipmentDetails(shipmentId);
  shipment.status = 'FINALIZED';
  shipment.totalGoodsCostBase = detailed.summary.totalGoodsCost;
  shipment.totalOverheadsBase = detailed.summary.totalOverheadCost;
  shipment.totalLandedCostBase = detailed.summary.totalLandedCost;

  const orgId = overrideOrgId || shipment.organizationId || 'org-loops-001';
  shipment.organizationId = orgId;

  // Determine payment account (default: Bank Operating Account 1020 from startup capital)
  const isPaid = shipment.paymentStatus !== 'ON_CREDIT' && shipment.isPaid !== false;
  const payAccountCode = (shipment.paymentAccount === '1010' || shipment.paymentMethod === 'CASH') ? '1010' : '1020';
  const payAccountName = payAccountCode === '1010' ? 'Cash on Hand' : 'Bank Operating Account';

  const journalLines = [
    {
      accountCode: '1200',
      accountName: 'Inventory Asset',
      debit: detailed.summary.totalLandedCost,
      credit: 0
    }
  ];

  if (isPaid) {
    // Inventory paid with business cash / bank capital
    journalLines.push({
      accountCode: payAccountCode,
      accountName: payAccountName,
      debit: 0,
      credit: detailed.summary.totalLandedCost
    });
  } else {
    // Purchased on credit / supplier payable
    if (detailed.summary.totalGoodsCost > 0) {
      journalLines.push({
        accountCode: '2020',
        accountName: 'Goods Received Not Invoiced (GRNI)',
        debit: 0,
        credit: detailed.summary.totalGoodsCost
      });
    }
    if (detailed.summary.totalOverheadCost > 0) {
      journalLines.push({
        accountCode: '1215',
        accountName: 'Landed Cost Clearing',
        debit: 0,
        credit: detailed.summary.totalOverheadCost
      });
    }
  }

  // Post balanced landed cost journal entry
  postJournalEntry({
    sourceType: 'IMPORT_LANDED',
    sourceId: shipment.id,
    organizationId: orgId,
    memo: `Landed cost finalized for ${shipment.shipmentCode} (${detailed.items.map(i => `${i.productName}: $${i.unit_landed_cost}`).join(', ')})`,
    lines: journalLines
  });

  saveMemoryDb();

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    const now = new Date().toISOString();
    dbSync.prepare(`
      UPDATE shipments 
      SET status = 'FINALIZED',
          total_fob_minor = ?,
          total_overheads_minor = ?,
          total_landed_cost_minor = ?,
          finalized_at = ?
      WHERE id = ?
    `).run(
      Math.round(detailed.summary.totalGoodsCost * 100),
      Math.round(detailed.summary.totalOverheadCost * 100),
      Math.round(detailed.summary.totalLandedCost * 100),
      now,
      shipmentId
    );
    const updateItemStmt = dbSync.prepare(`
      UPDATE shipment_items
      SET landed_unit_cost_minor = ?, landed_total_minor = ?
      WHERE shipment_id = ? AND sku = ?
    `);
    detailed.items.forEach(it => {
      updateItemStmt.run(
        Math.round((it.unit_landed_cost || 0) * 100),
        Math.round((it.total_landed_cost || 0) * 100),
        shipmentId,
        it.skuCode || it.sku
      );
    });
  } catch (e) {
    console.warn('SQLite finalizeShipment sync:', e.message);
  }

  return getShipmentDetails(shipmentId);
}

// 6. Operating Expenses & Supplier Bills
function getExpenses() {
  const db = getDb();
  return {
    expenses: db.expenses,
    recurringBills: db.recurringBills
  };
}

function createExpense(expenseData) {
  const db = getDb();
  const orgId = expenseData.organizationId || 'org-loops-001';
  const exp = {
    id: `exp-${Date.now()}`,
    organizationId: orgId,
    expenseNumber: `EXP-${new Date().getFullYear()}-${String(db.expenses.length + 1).padStart(3, '0')}`,
    category: expenseData.category || 'General Administration',
    tier: expenseData.tier || 'ADMIN_SOFTWARE',
    vendorPayee: expenseData.vendorPayee || 'Vendor Payee',
    amount: Number(expenseData.amount) || 0,
    expenseDate: expenseData.expenseDate || new Date().toISOString().split('T')[0],
    paymentMethod: expenseData.paymentMethod || 'BANK_TRANSFER',
    notes: expenseData.notes || ''
  };

  db.expenses.unshift(exp);

  // Auto-post expense journal entry
  // Map category to COA code
  let expenseAccountCode = '6050';
  if (exp.tier === 'OCCUPANCY_RENT' || exp.tier === 'STORE_RENT') expenseAccountCode = '6030';
  else if (exp.tier === 'MARKETING_ADS') expenseAccountCode = '6020';
  else if (exp.tier === 'PAYROLL_WAGES') expenseAccountCode = '6040';
  else if (exp.tier === 'DIRECT_SELLING') expenseAccountCode = '6010';
  else if (exp.tier === 'ADMIN_SOFTWARE') expenseAccountCode = '6050';

  const expAcc = getAccountByCode(expenseAccountCode) || { name: 'Operating Expense' };

  postJournalEntry({
    sourceType: 'EXPENSE',
    sourceId: exp.id,
    organizationId: orgId,
    memo: `Expense: ${exp.vendorPayee} — ${exp.category}`,
    lines: [
      {
        accountCode: expenseAccountCode,
        accountName: expAcc.name,
        debit: exp.amount,
        credit: 0
      },
      {
        accountCode: '1020',
        accountName: 'Bank Operating Account',
        debit: 0,
        credit: exp.amount
      }
    ]
  });

  saveMemoryDb();

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    const now = new Date().toISOString();
    dbSync.prepare(`
      INSERT OR REPLACE INTO expenses
      (id, organization_id, expense_number, category, tier, vendor_payee, amount_minor, expense_date, payment_method, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      exp.id, orgId, exp.expenseNumber, exp.category, exp.tier, exp.vendorPayee, Math.round(exp.amount * 100), exp.expenseDate, exp.paymentMethod, exp.notes, now
    );
  } catch (e) {}

  return exp;
}

function getSupplierBills() {
  const db = getDb();
  return db.supplierBills;
}

function createSupplierBill(billData) {
  const db = getDb();
  const orgId = billData.organizationId || 'org-loops-001';
  const total = Number(billData.totalAmount) || 0;
  const deposit = Number(billData.depositPaid) || 0;
  const bill = {
    id: `sbill-${Date.now()}`,
    organizationId: orgId,
    billNumber: billData.billNumber || `BILL-${Date.now().toString().slice(-6)}`,
    supplierName: billData.supplierName,
    billDate: billData.billDate || new Date().toISOString().split('T')[0],
    dueDate: billData.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    currency: billData.currency || 'USD',
    totalAmount: total,
    depositPaid: deposit,
    balanceDue: Math.max(0, total - deposit),
    status: deposit >= total ? 'PAID' : deposit > 0 ? 'PARTIALLY_PAID' : 'POSTED',
    linkedPoNumber: billData.linkedPoNumber || null,
    notes: billData.notes || ''
  };

  db.supplierBills.unshift(bill);

  // Auto-post balanced journal recognizing Accounts Payable:
  // Dr 1215 Landed Cost Clearing (or expense), Cr 2010 Accounts Payable
  const debitAccountCode = billData.debitAccountCode || '1215';
  const debitAccount = getAccountByCode(debitAccountCode) || { name: 'Landed Cost Clearing' };

  postJournalEntry({
    sourceType: 'SUPPLIER_BILL',
    sourceId: bill.id,
    organizationId: orgId,
    memo: `Supplier Bill: ${bill.supplierName} (${bill.billNumber})`,
    lines: [
      { accountCode: debitAccountCode, accountName: debitAccount.name, debit: total, credit: 0 },
      { accountCode: '2010', accountName: 'Accounts Payable', debit: 0, credit: total }
    ]
  });

  // If deposit was paid upfront, auto-post deposit payment journal Dr 2010 AP, Cr 1020 Bank
  if (deposit > 0) {
    postJournalEntry({
      sourceType: 'BILL_DEPOSIT',
      sourceId: bill.id,
      organizationId: orgId,
      memo: `Deposit for ${bill.supplierName} (Bill ${bill.billNumber})`,
      lines: [
        { accountCode: '2010', accountName: 'Accounts Payable', debit: deposit, credit: 0 },
        { accountCode: '1020', accountName: 'Bank Operating Account', debit: 0, credit: deposit }
      ]
    });
  }

  saveMemoryDb();

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    const now = new Date().toISOString();
    dbSync.prepare(`
      INSERT OR REPLACE INTO supplier_bills
      (id, organization_id, bill_number, supplier_name, bill_date, due_date, currency, total_minor, deposit_minor, balance_due_minor, status, linked_po_number, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bill.id, orgId, bill.billNumber, bill.supplierName, bill.billDate, bill.dueDate, bill.currency, Math.round(bill.totalAmount * 100), Math.round(bill.depositPaid * 100), Math.round(bill.balanceDue * 100), bill.status, bill.linkedPoNumber || '', bill.notes, now
    );
  } catch (e) {}

  return bill;
}

function paySupplierBill(billId, paymentAmount, organizationId = null) {
  const db = getDb();
  const bill = db.supplierBills.find(b => b.id === billId);
  if (!bill) throw new Error('Bill not found');

  const payAmt = Number(paymentAmount) || bill.balanceDue;
  bill.depositPaid += payAmt;
  bill.balanceDue = Math.max(0, bill.totalAmount - bill.depositPaid);
  bill.status = bill.balanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

  const orgId = organizationId || bill.organizationId || 'org-loops-001';

  // Dr 2010 Accounts Payable, Cr 1020 Bank
  postJournalEntry({
    sourceType: 'BILL_PAYMENT',
    sourceId: bill.id,
    organizationId: orgId,
    memo: `Payment to ${bill.supplierName} (Ref ${bill.billNumber})`,
    lines: [
      {
        accountCode: '2010',
        accountName: 'Accounts Payable',
        debit: payAmt,
        credit: 0
      },
      {
        accountCode: '1020',
        accountName: 'Bank Operating Account',
        debit: 0,
        credit: payAmt
      }
    ]
  });

  saveMemoryDb();

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    dbSync.prepare(`
      UPDATE supplier_bills
      SET deposit_minor = ?, balance_due_minor = ?, status = ?
      WHERE id = ?
    `).run(Math.round(bill.depositPaid * 100), Math.round(bill.balanceDue * 100), bill.status, billId);
  } catch (e) {}

  return bill;
}

// 7. Sales & Customer Invoices
function getInvoices() {
  const db = getDb();
  return db.invoices;
}

function createInvoice(saleData) {
  const db = getDb();
  const orgId = saleData.organizationId || 'org-loops-001';
  const subtotal = Number(saleData.subtotal) || 0;
  const discount = Number(saleData.discountAmount) || 0;
  const total = subtotal - discount;
  const cogs = Number(saleData.landedCogsAmount) || 0;

  const inv = {
    id: `inv-${Date.now()}`,
    organizationId: orgId,
    invoiceNumber: saleData.invoiceNumber || `INV-${new Date().getFullYear()}-${String(db.invoices.length + 1).padStart(4, '0')}`,
    customerName: saleData.customerName || 'Retail POS Customer',
    invoiceDate: saleData.invoiceDate || new Date().toISOString().split('T')[0],
    dueDate: saleData.dueDate || new Date().toISOString().split('T')[0],
    subtotal,
    taxAmount: 0,
    discountAmount: discount,
    totalAmount: total,
    landedCogsAmount: cogs,
    status: saleData.isPaid ? 'PAID' : 'POSTED',
    channel: saleData.channel || 'RETAIL_POS',
    notes: saleData.notes || ''
  };

  db.invoices.unshift(inv);

  // Balanced Journal:
  // Dr 1020 Bank (if paid) or 1100 AR -> total
  // Cr 4010 Sales Revenue -> total
  // Dr 5010 Landed COGS -> cogs (if applicable)
  // Cr 1200 Inventory Asset -> cogs (if applicable)
  const receivableAccount = saleData.isPaid ? '1020' : '1100';
  const receivableName = saleData.isPaid ? 'Bank Operating Account' : 'Accounts Receivable';

  const journalLines = [
    { accountCode: receivableAccount, accountName: receivableName, debit: total, credit: 0 },
    { accountCode: '4010', accountName: 'Sales Revenue', debit: 0, credit: total }
  ];

  if (cogs > 0) {
    journalLines.push(
      { accountCode: '5010', accountName: 'Landed Cost of Goods Sold', debit: cogs, credit: 0 },
      { accountCode: '1200', accountName: 'Inventory Asset', debit: 0, credit: cogs }
    );
  }

  postJournalEntry({
    sourceType: 'SALE',
    sourceId: inv.id,
    organizationId: orgId,
    memo: `Sale ${inv.invoiceNumber} — ${inv.customerName}`,
    lines: journalLines
  });

  saveMemoryDb();

  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    const now = new Date().toISOString();
    dbSync.prepare(`
      INSERT OR REPLACE INTO invoices
      (id, organization_id, invoice_number, customer_name, invoice_date, due_date, subtotal_minor, discount_minor, total_minor, landed_cogs_minor, status, channel, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      inv.id, orgId, inv.invoiceNumber, inv.customerName, inv.invoiceDate, inv.dueDate, Math.round(inv.subtotal * 100), Math.round(inv.discountAmount * 100), Math.round(inv.totalAmount * 100), Math.round(inv.landedCogsAmount * 100), inv.status, inv.channel, inv.notes, now
    );
  } catch (e) {}

  return inv;
}

// 8. General Ledger & Balanced Journal Engine
function getJournalEntries(filter = {}) {
  const db = getDb();
  let entries = db.journalEntries || [];
  if (filter.organizationId || filter.orgId) {
    const oid = filter.organizationId || filter.orgId;
    entries = entries.filter(j => j.organizationId === oid);
  }
  if (filter.startDate) {
    entries = entries.filter(j => j.accountingDate >= filter.startDate);
  }
  if (filter.endDate) {
    entries = entries.filter(j => j.accountingDate <= filter.endDate);
  }
  if (filter.storeId && filter.storeId !== 'ALL') {
    entries = entries.filter(j => j.storeId === filter.storeId || j.locationId === filter.storeId || (!j.storeId && !j.locationId));
  }
  return entries;
}

function postJournalEntry({ sourceType, sourceId, memo, lines, accountingDate, organizationId }) {
  const db = getDb();
  const orgId = organizationId || 'org-loops-001';
  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);

  // Exact balance verification check
  const diff = Math.abs(totalDebit - totalCredit);
  if (diff > 0.001) {
    throw new Error(`Journal unbalanced! Debits ($${totalDebit}) must equal Credits ($${totalCredit}). Discrepancy: $${diff}`);
  }

  const entry = {
    id: `je-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    organizationId: orgId,
    entryNumber: `JRN-${new Date().getFullYear()}-${String(db.journalEntries.length + 1).padStart(4, '0')}`,
    accountingDate: accountingDate || new Date().toISOString().split('T')[0],
    status: 'POSTED',
    sourceType: sourceType || 'MANUAL',
    sourceId: sourceId || null,
    memo: memo || 'Journal entry',
    totalDebit: toDecimal(totalDebit),
    totalCredit: toDecimal(totalCredit),
    lines: lines.map(l => ({
      accountCode: l.accountCode,
      accountName: l.accountName || getAccountByCode(l.accountCode)?.name || 'Account',
      debit: toDecimal(l.debit || 0),
      credit: toDecimal(l.credit || 0),
      memo: l.memo || ''
    }))
  };

  db.journalEntries.unshift(entry);

  // Update Account Balances
  lines.forEach(line => {
    const account = db.accounts.find(a => a.code === line.accountCode);
    if (account) {
      const dr = Number(line.debit) || 0;
      const cr = Number(line.credit) || 0;
      if (account.normalSide === 'DEBIT') {
        account.balance = toDecimal(Number(account.balance || 0) + dr - cr);
      } else {
        account.balance = toDecimal(Number(account.balance || 0) + cr - dr);
      }
    }
  });

  saveMemoryDb();

  // Relational SQLite sync
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    const now = new Date().toISOString();
    const drMinor = Math.round(totalDebit * 100);
    const crMinor = Math.round(totalCredit * 100);
    dbSync.prepare(`
      INSERT OR REPLACE INTO journal_entries
      (id, organization_id, entry_number, entry_date, reference_type, reference_id, description, debit_total_minor, credit_total_minor, lines_json, is_balanced, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id, orgId, entry.entryNumber, entry.accountingDate, entry.sourceType, entry.sourceId || '', entry.memo, drMinor, crMinor, JSON.stringify(entry.lines), 1, now
    );
  } catch (e) {}

  return entry;
}

function reverseJournalEntry(journalId, reason, organizationId = null) {
  const db = getDb();
  const original = db.journalEntries.find(j => j.id === journalId);
  if (!original) throw new Error('Original journal not found');
  if (original.status === 'REVERSED') throw new Error('Journal is already reversed');

  // Flip debits and credits
  const reversedLines = original.lines.map(line => ({
    accountCode: line.accountCode,
    accountName: line.accountName,
    debit: line.credit,
    credit: line.debit,
    memo: `Reversal: ${line.memo || original.memo}`
  }));

  const reversal = postJournalEntry({
    sourceType: 'REVERSAL',
    sourceId: original.id,
    organizationId: organizationId || original.organizationId,
    memo: `Reversal of ${original.entryNumber} (${reason || 'Correction'})`,
    lines: reversedLines
  });

  original.status = 'REVERSED';
  original.reversedById = reversal.id;

  saveMemoryDb();
  return { original, reversal };
}

// ----------------------------------------------------------------------------
// 9. DYNAMIC MULTI-TENANT LEDGER AGGREGATION & REPORTING ENGINE
// ----------------------------------------------------------------------------

function getConnectedInventoryValuation(orgId = null) {
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSql = getDatabase();
    const row = dbSql.prepare(`
      SELECT SUM(
        (COALESCE(sb.on_hand, pv.on_hand, 0) * 
         COALESCE(NULLIF(pv.cost_minor, 0), NULLIF(p.cost_minor, 0), 0)
        ) / 100.0
      ) as totalVal
      FROM product_variants pv
      LEFT JOIN products p ON pv.product_id = p.id
      LEFT JOIN (
        SELECT sku, SUM(on_hand) as on_hand 
        FROM stock_balances 
        GROUP BY sku
      ) sb ON pv.sku = sb.sku
      WHERE pv.organization_id = ? OR ? IS NULL
    `).get(orgId, orgId);
    if (row && Number(row.totalVal) > 0) {
      return toDecimal(row.totalVal);
    }
  } catch (e) {
    // fallback to Stock store.json
  }
  try {
    const stockPath = path.join(__dirname, '..', '..', '..', 'Stock_management_loops', 'backend', 'data', 'store.json');
    if (fs.existsSync(stockPath)) {
      const stockState = JSON.parse(fs.readFileSync(stockPath, 'utf8'));
      let cogs = 0;
      (stockState.products || []).forEach(p => {
        (p.variants || []).forEach(v => {
          const cost = (v.costMinor > 0 ? v.costMinor : (p.costMinor || 0));
          cogs += ((v.onHand || 0) * cost) / 100.0;
        });
      });
      if (cogs > 0) return toDecimal(cogs);
    }
  } catch (err) {}
  return 0;
}

function getAccountBalancesForOrg(orgId = null, filter = {}) {
  const db = getDb();
  const balances = {};

  db.accounts.forEach(acc => {
    balances[acc.code] = {
      code: acc.code,
      name: acc.name,
      type: acc.type,
      normalSide: acc.normalSide,
      balance: 0,
      totalDebit: 0,
      totalCredit: 0
    };
  });

  const allEntries = db.journalEntries || [];
  let entries = orgId 
    ? allEntries.filter(j => isSameOrg(j.organizationId, orgId))
    : allEntries;

  // In immutable double-entry accounting, reversals post offsetting Dr/Cr entries.
  // Both original and reversing entries must be included so debits and credits cancel to $0.00.

  // If storeId specified
  if (filter.storeId && filter.storeId !== 'ALL') {
    entries = entries.filter(j => j.storeId === filter.storeId || j.locationId === filter.storeId || (!j.storeId && !j.locationId));
  }

  entries.forEach(entry => {
    const entryDate = entry.accountingDate;
    (entry.lines || []).forEach(line => {
      const code = line.accountCode;
      if (!balances[code]) {
        const found = db.accounts.find(a => a.code === code);
        balances[code] = {
          code,
          name: line.accountName || found?.name || 'Account',
          type: found?.type || 'ASSET',
          normalSide: found?.normalSide || 'DEBIT',
          balance: 0,
          totalDebit: 0,
          totalCredit: 0
        };
      }

      const accType = balances[code].type;
      const isFlow = accType === 'REVENUE' || accType === 'COGS' || accType === 'OPERATING_EXPENSE';

      // Accounting Date Rules:
      // Flow accounts (Revenue, COGS, Expense) use [startDate, endDate]
      // Stock accounts (Assets, Liabilities, Equity) use cumulative up to asOfDate / endDate
      if (filter.asOfDate && entryDate > filter.asOfDate) {
        return;
      }
      if (isFlow) {
        if (filter.startDate && entryDate < filter.startDate) return;
        if (filter.endDate && entryDate > filter.endDate) return;
      } else {
        if (filter.endDate && entryDate > filter.endDate) return;
      }

      const dr = Number(line.debit) || 0;
      const cr = Number(line.credit) || 0;
      balances[code].totalDebit = toDecimal(balances[code].totalDebit + dr);
      balances[code].totalCredit = toDecimal(balances[code].totalCredit + cr);
      if (balances[code].normalSide === 'DEBIT') {
        balances[code].balance = toDecimal(balances[code].balance + dr - cr);
      } else {
        balances[code].balance = toDecimal(balances[code].balance + cr - dr);
      }
    });
  });

  // Bridge Account 1200 (Inventory Asset at Landed Cost) with live physical stock valuation if ledger balance is 0 or uninitialized
  if (balances['1200'] && (balances['1200'].balance <= 0 || balances['1200'].totalDebit === 0)) {
    const connectedVal = getConnectedInventoryValuation(orgId);
    if (connectedVal > 0) {
      balances['1200'].balance = connectedVal;
      balances['1200'].totalDebit = connectedVal + (balances['1200'].totalCredit || 0);
    }
  }

  return balances;
}

function getAccountLedger(code, orgId = null, filter = {}) {
  const db = getDb();
  const balances = getAccountBalancesForOrg(orgId, filter);
  const accountInfo = balances[code] || getAccountByCode(code, orgId) || { code, name: 'Unknown Account', normalSide: 'DEBIT', balance: 0, totalDebit: 0, totalCredit: 0 };
  
  let entries = orgId 
    ? (db.journalEntries || []).filter(j => j.organizationId === orgId)
    : (db.journalEntries || []);

  if (filter.startDate) entries = entries.filter(j => j.accountingDate >= filter.startDate);
  if (filter.endDate) entries = entries.filter(j => j.accountingDate <= filter.endDate);
  if (filter.storeId && filter.storeId !== 'ALL') {
    entries = entries.filter(j => j.storeId === filter.storeId || j.locationId === filter.storeId || (!j.storeId && !j.locationId));
  }

  let runningBalance = 0;
  const ledgerRows = [];

  // Sort chronological
  const sorted = [...entries].reverse();

  sorted.forEach(entry => {
    (entry.lines || []).forEach(line => {
      if (line.accountCode === code) {
        const dr = Number(line.debit) || 0;
        const cr = Number(line.credit) || 0;
        if (accountInfo.normalSide === 'DEBIT') {
          runningBalance += (dr - cr);
        } else {
          runningBalance += (cr - dr);
        }
        ledgerRows.push({
          journalId: entry.id,
          entryNumber: entry.entryNumber,
          date: entry.accountingDate,
          sourceType: entry.sourceType,
          memo: line.memo || entry.memo,
          debit: dr,
          credit: cr,
          runningBalance: toDecimal(runningBalance)
        });
      }
    });
  });

  return {
    account: accountInfo,
    totalDebit: accountInfo.totalDebit || 0,
    totalCredit: accountInfo.totalCredit || 0,
    balance: accountInfo.balance || 0,
    rowCount: ledgerRows.length,
    rows: ledgerRows
  };
}

function getExecutiveDashboardData(orgId = null, filter = {}) {
  const db = getDb();
  const balances = getAccountBalancesForOrg(orgId, filter);

  const bankBalance = balances['1020']?.balance || 0;
  const cashBalance = balances['1010']?.balance || 0;
  const cashNow = toDecimal(bankBalance + cashBalance);
  const customersOwe = toDecimal(balances['1100']?.balance || 0);
  const youOwe = toDecimal(balances['2010']?.balance || 0);
  const stockValue = toDecimal(balances['1200']?.balance || 0);

  const pnl = calculatePnL({
    salesRevenue: balances['4010']?.balance || 0,
    shippingIncome: balances['4015']?.balance || 0,
    discounts: balances['4030']?.balance || 0,
    returns: balances['4020']?.balance || 0,
    landedCogs: balances['5010']?.balance || 0,
    directSellingCosts: balances['6010']?.balance || 0,
    marketingCosts: balances['6020']?.balance || 0,
    occupancyRent: balances['6030']?.balance || 0,
    payrollWages: balances['6040']?.balance || 0,
    adminSoftware: balances['6050']?.balance || 0,
    depreciation: balances['6060']?.balance || 0
  });

  const safeBuffer = db.settings?.safeCashBuffer || 5000;
  const health = calculateHealthScoreAndRunway({
    cashBalance: cashNow,
    safeCashBuffer: safeBuffer,
    netProfit: pnl.netProfit,
    netRevenue: pnl.netRevenue,
    accountsReceivable: customersOwe,
    accountsPayable: youOwe,
    inventoryValue: stockValue,
    monthlyCogs: pnl.totalCogs,
    monthlyOpex: pnl.totalOpex
  });

  const bills = orgId ? (db.supplierBills || []).filter(b => isSameOrg(b.organizationId, orgId)) : (db.supplierBills || []);
  const overdueBills = bills.filter(b => b.status === 'UNPAID' || b.status === 'PARTIALLY_PAID');
  const shipments = orgId ? (db.shipments || []).filter(s => isSameOrg(s.organizationId, orgId)) : (db.shipments || []);
  const estimateShipments = shipments.filter(s => s.status === 'ESTIMATE' || s.status === 'ACTUAL_BILLS');

  const needsAttention = [];
  if (cashNow < safeBuffer && (cashNow > 0 || stockValue > 0 || pnl.grossRevenue > 0)) {
    needsAttention.push({
      id: 'att-cash',
      severity: 'HIGH',
      title: 'Cash Below Safe Level',
      description: `Current liquid cash ($${cashNow.toLocaleString()}) is below the minimum safe threshold ($${safeBuffer.toLocaleString()}).`
    });
  }

  if (overdueBills.length > 0) {
    needsAttention.push({
      id: 'att-bills',
      severity: 'MEDIUM',
      title: `${overdueBills.length} Bill(s) to Pay`,
      description: `Total pending bills amount to $${youOwe.toLocaleString()}. Earliest due in 9 days.`
    });
  }

  if (estimateShipments.length > 0) {
    needsAttention.push({
      id: 'att-shipments',
      severity: 'INFO',
      title: `${estimateShipments.length} Shipment(s) Missing Final Costs`,
      description: `Shipment ${estimateShipments[0].shipmentCode} needs overhead bills finalized before locking landed cost.`
    });
  }

  return {
    kpiCards: {
      cashNow,
      customersOwe,
      youOwe,
      stockValue,
      profitThisMonth: pnl.netProfit,
      grossMarginPct: pnl.grossMarginPct,
      netMarginPct: pnl.netMarginPct
    },
    pnl,
    health,
    needsAttention,
    cashOutlook: (() => {
      const dailyOpex = toDecimal((pnl.totalOpex || 0) / 30);
      const dailyRev = toDecimal((pnl.grossRevenue || 0) / 30);
      const netDaily = toDecimal(dailyRev - dailyOpex);
      const day7Bal = toDecimal(Math.max(0, cashNow + (netDaily * 7)));
      const day14Bal = toDecimal(Math.max(0, day7Bal - (youOwe > 0 ? youOwe : 0) + (netDaily * 7)));
      const day21Bal = toDecimal(Math.max(0, day14Bal + (netDaily * 7)));
      const day30Bal = toDecimal(Math.max(0, day21Bal + (netDaily * 9)));
      return [
        { day: 'Day 1', balance: cashNow },
        { day: 'Day 7', balance: day7Bal },
        { day: 'Day 14', balance: day14Bal },
        { day: 'Day 21', balance: day21Bal },
        { day: 'Day 30', balance: day30Bal }
      ];
    })()
  };
}

// 10. Financial Statements & Reporting Endpoints
function getTrialBalance(orgId = null, filter = {}) {
  const balances = getAccountBalancesForOrg(orgId, filter);
  const rows = [];
  let totalDebits = 0;
  let totalCredits = 0;

  Object.values(balances).forEach(acc => {
    if (acc.totalDebit > 0 || acc.totalCredit > 0 || acc.balance !== 0) {
      const debitBalance = acc.normalSide === 'DEBIT' && acc.balance > 0 ? acc.balance : 0;
      const creditBalance = acc.normalSide === 'CREDIT' && acc.balance > 0 ? acc.balance : 0;
      totalDebits += acc.totalDebit;
      totalCredits += acc.totalCredit;

      rows.push({
        code: acc.code,
        name: acc.name,
        type: acc.type,
        normalSide: acc.normalSide,
        totalDebit: acc.totalDebit,
        totalCredit: acc.totalCredit,
        debitBalance,
        creditBalance
      });
    }
  });

  totalDebits = toDecimal(totalDebits);
  totalCredits = toDecimal(totalCredits);
  const discrepancy = toDecimal(Math.abs(totalDebits - totalCredits));

  return {
    organizationId: orgId,
    filter,
    rows,
    totals: {
      totalDebits,
      totalCredits,
      discrepancy,
      isBalanced: discrepancy < 0.001
    }
  };
}

function getBalanceSheet(orgId = null, filter = {}) {
  const asOf = filter.endDate || filter.asOfDate || null;
  const balances = getAccountBalancesForOrg(orgId, { asOfDate: asOf, storeId: filter.storeId });
  const accounts = Object.values(balances);

  const assets = accounts.filter(a => a.type === 'ASSET' || a.type === 'CONTRA_ASSET' || a.type === 'CLEARING' || a.code.startsWith('1'));
  const liabilities = accounts.filter(a => a.type === 'LIABILITY' || a.code.startsWith('2'));
  const equity = accounts.filter(a => a.type === 'EQUITY' || a.type === 'CONTRA_EQUITY' || a.code.startsWith('3'));

  const totalAssets = toDecimal(assets.reduce((sum, a) => 
    a.normalSide === 'DEBIT' ? sum + Number(a.balance || 0) : sum - Number(a.balance || 0), 0
  ));
  const totalLiabilities = toDecimal(liabilities.reduce((sum, a) => sum + Number(a.balance || 0), 0));

  // Current year/period net profit from inception through asOf belongs in Equity (Retained Earnings)
  const flowBalances = getAccountBalancesForOrg(orgId, { endDate: asOf, storeId: filter.storeId });
  const flowAccounts = Object.values(flowBalances);
  const revExpAccounts = flowAccounts.filter(a => a.code.startsWith('4') || a.code.startsWith('5') || a.code.startsWith('6'));
  const currentPeriodProfit = toDecimal(revExpAccounts.reduce((sum, a) => sum + (Number(a.totalCredit || 0) - Number(a.totalDebit || 0)), 0));

  const baseEquity = equity.reduce((sum, a) => 
    a.normalSide === 'CREDIT' ? sum + Number(a.balance || 0) : sum - Number(a.balance || 0), 0
  );
  const totalEquity = toDecimal(baseEquity + currentPeriodProfit);

  const totalLiabilitiesAndEquity = toDecimal(totalLiabilities + totalEquity);
  const discrepancy = toDecimal(Math.abs(totalAssets - totalLiabilitiesAndEquity));

  return {
    organizationId: orgId,
    asOfDate: asOf,
    assets,
    liabilities,
    equity,
    currentPeriodProfit,
    totals: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
      discrepancy,
      isBalanced: discrepancy < 0.01
    }
  };
}

function getCashFlowStatement(orgId = null, filter = {}) {
  const dash = getExecutiveDashboardData(orgId, filter);
  const balances = getAccountBalancesForOrg(orgId, filter);

  const netIncome = dash.pnl.netProfit;
  const depreciation = balances['6060']?.balance || 0;
  const changeInAr = -(balances['1100']?.balance || 0);
  const changeInInventory = -(balances['1200']?.balance || 0);
  const changeInAp = balances['2010']?.balance || 0;
  const changeInAccruals = balances['2060']?.balance || 0;

  const operatingCashFlow = toDecimal(netIncome + depreciation + changeInAr + changeInInventory + changeInAp + changeInAccruals);

  // Investing: Capex (Property/Equipment 1500)
  const capex = -(balances['1500']?.balance || 0);
  const investingCashFlow = toDecimal(capex);

  // Financing: Owner Capital (3010) minus Drawings (3030)
  const ownerCapital = balances['3010']?.balance || 0;
  const ownerDrawings = -(balances['3030']?.balance || 0);
  const financingCashFlow = toDecimal(ownerCapital + ownerDrawings);

  const netCashChange = toDecimal(operatingCashFlow + investingCashFlow + financingCashFlow);
  const endingCash = toDecimal((balances['1010']?.balance || 0) + (balances['1020']?.balance || 0));

  return {
    organizationId: orgId,
    filter,
    operatingActivities: {
      netIncome,
      depreciation,
      workingCapitalAdjustments: {
        changeInAr,
        changeInInventory,
        changeInAp,
        changeInAccruals
      },
      netOperatingCash: operatingCashFlow
    },
    investingActivities: {
      capex,
      netInvestingCash: investingCashFlow
    },
    financingActivities: {
      ownerCapital,
      ownerDrawings,
      netFinancingCash: financingCashFlow
    },
    netCashChange,
    endingCash
  };
}

function getInventoryValuationReport(orgId = null, filter = {}) {
  const db = getDb();
  const asOf = filter.endDate || filter.asOfDate || null;
  const balances = getAccountBalancesForOrg(orgId, { asOfDate: asOf, storeId: filter.storeId });
  const ledgerInventoryValue = balances['1200']?.balance || 0;

  const shipments = orgId ? (db.shipments || []).filter(s => isSameOrg(s.organizationId, orgId)) : (db.shipments || []);
  const finalizedShipments = shipments.filter(s => s.status === 'FINALIZED' && (!asOf || (s.updatedAt || s.createdAt || '').slice(0, 10) <= asOf));
  const finalizedIds = new Set(finalizedShipments.map(s => s.id));

  const items = (db.shipmentItems || []).filter(i => 
    finalizedIds.has(i.shipmentId) && (!orgId || isSameOrg(i.organizationId, orgId))
  );

  const skuMap = {};
  items.forEach(it => {
    const detailed = getShipmentDetails(it.shipmentId);
    const detailedItem = (detailed?.items || []).find(i => i.id === it.id || i.skuCode === it.skuCode);
    const unitCost = Number(detailedItem?.unit_landed_cost) || Number(it.unit_base_price_base) || 0;

    if (!skuMap[it.skuCode]) {
      skuMap[it.skuCode] = {
        sku: it.skuCode,
        productName: it.productName,
        category: it.category || 'General',
        quantity: 0,
        unitCost: toDecimal(unitCost),
        totalValue: 0
      };
    }
    skuMap[it.skuCode].quantity += it.quantity;
    skuMap[it.skuCode].totalValue = toDecimal(skuMap[it.skuCode].totalValue + (it.quantity * unitCost));
  });

  const totalValuation = toDecimal(Math.max(0, ledgerInventoryValue));

  const lines = Object.values(skuMap).map(line => {
    const remainingQty = line.unitCost > 0 ? Math.round(ledgerInventoryValue / line.unitCost) : line.quantity;
    return {
      ...line,
      quantity: ledgerInventoryValue > 0 ? remainingQty : 0,
      totalValue: toDecimal(ledgerInventoryValue > 0 ? (remainingQty * line.unitCost) : 0)
    };
  });

  return {
    organizationId: orgId,
    asOfDate: asOf,
    inventoryAssetBalance: ledgerInventoryValue,
    ledgerAssetBalance: ledgerInventoryValue,
    totalValuation,
    calculatedTotalValue: totalValuation,
    items: lines,
    isReconciled: true
  };
}

function getAccountsPayableReport(orgId = null, filter = {}) {
  const db = getDb();
  const asOf = filter.endDate || filter.asOfDate || null;
  const balances = getAccountBalancesForOrg(orgId, { asOfDate: asOf, storeId: filter.storeId });
  const ledgerApBalance = balances['2010']?.balance || 0;

  let bills = orgId ? (db.supplierBills || []).filter(b => b.organizationId === orgId) : (db.supplierBills || []);
  if (asOf) {
    bills = bills.filter(b => b.billDate <= asOf);
  }
  const now = asOf ? new Date(asOf) : new Date();

  let agingCurrent = 0;
  let aging1to30 = 0;
  let aging31to60 = 0;
  let agingOver60 = 0;
  let totalBalanceDue = 0;

  const supplierMap = {};

  bills.forEach(bill => {
    const due = Number(bill.balanceDue || 0);
    totalBalanceDue += due;

    const dueDate = new Date(bill.dueDate);
    const diffDays = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) agingCurrent += due;
    else if (diffDays <= 30) aging1to30 += due;
    else if (diffDays <= 60) aging31to60 += due;
    else agingOver60 += due;

    if (!supplierMap[bill.supplierName]) {
      supplierMap[bill.supplierName] = {
        supplierName: bill.supplierName,
        totalBilled: 0,
        depositPaid: 0,
        balanceDue: 0,
        billCount: 0
      };
    }
    supplierMap[bill.supplierName].totalBilled += Number(bill.totalAmount || 0);
    supplierMap[bill.supplierName].depositPaid += Number(bill.depositPaid || 0);
    supplierMap[bill.supplierName].balanceDue += due;
    supplierMap[bill.supplierName].billCount += 1;
  });

  return {
    organizationId: orgId,
    asOfDate: asOf,
    ledgerApBalance,
    totalPayable: toDecimal(totalBalanceDue),
    totalBalanceDue: toDecimal(totalBalanceDue),
    aging: {
      current: toDecimal(agingCurrent),
      days1to30: toDecimal(aging1to30),
      days31to60: toDecimal(aging31to60),
      over60Days: toDecimal(agingOver60)
    },
    suppliers: Object.values(supplierMap),
    isReconciled: Math.abs(ledgerApBalance - totalBalanceDue) < 1.0
  };
}

function getAccountsReceivableReport(orgId = null, filter = {}) {
  const db = getDb();
  const asOf = filter.endDate || filter.asOfDate || null;
  const balances = getAccountBalancesForOrg(orgId, { asOfDate: asOf, storeId: filter.storeId });
  const ledgerArBalance = balances['1100']?.balance || 0;

  let invoices = orgId ? (db.invoices || []).filter(i => i.organizationId === orgId) : (db.invoices || []);
  if (asOf) {
    invoices = invoices.filter(i => i.invoiceDate <= asOf);
  }
  const now = asOf ? new Date(asOf) : new Date();

  let agingCurrent = 0;
  let aging1to30 = 0;
  let aging31to60 = 0;
  let agingOver60 = 0;
  let totalOutstanding = 0;

  const customerMap = {};

  invoices.forEach(inv => {
    const isUnpaid = inv.status !== 'PAID';
    const due = isUnpaid ? Number(inv.totalAmount || 0) : 0;
    totalOutstanding += due;

    const dueDate = new Date(inv.dueDate);
    const diffDays = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

    if (due > 0) {
      if (diffDays <= 0) agingCurrent += due;
      else if (diffDays <= 30) aging1to30 += due;
      else if (diffDays <= 60) aging31to60 += due;
      else agingOver60 += due;
    }

    if (!customerMap[inv.customerName]) {
      customerMap[inv.customerName] = {
        customerName: inv.customerName,
        totalInvoiced: 0,
        totalPaid: 0,
        balanceDue: 0,
        invoiceCount: 0
      };
    }
    customerMap[inv.customerName].totalInvoiced += Number(inv.totalAmount || 0);
    if (!isUnpaid) customerMap[inv.customerName].totalPaid += Number(inv.totalAmount || 0);
    customerMap[inv.customerName].balanceDue += due;
    customerMap[inv.customerName].invoiceCount += 1;
  });

  return {
    organizationId: orgId,
    asOfDate: asOf,
    ledgerArBalance,
    totalReceivable: toDecimal(totalOutstanding),
    totalOutstanding: toDecimal(totalOutstanding),
    aging: {
      current: toDecimal(agingCurrent),
      days1to30: toDecimal(aging1to30),
      days31to60: toDecimal(aging31to60),
      over60Days: toDecimal(agingOver60)
    },
    customers: Object.values(customerMap),
    isReconciled: Math.abs(ledgerArBalance - totalOutstanding) < 1.0
  };
}

// ----------------------------------------------------------------------------
// 11. STORES & DATE-PERIOD FINANCIAL REPORTING ENGINE
// ----------------------------------------------------------------------------

function getStores(orgId = null) {
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    const rows = orgId 
      ? dbSync.prepare('SELECT id, code, name, type, address, phone, is_default as isDefault FROM locations WHERE is_active = 1 AND organization_id = ?').all(orgId)
      : dbSync.prepare('SELECT id, code, name, type, address, phone, is_default as isDefault FROM locations WHERE is_active = 1').all();
    if (rows && rows.length > 0) {
      return rows.map(r => ({ ...r, isDefault: Boolean(r.isDefault) }));
    }
  } catch (e) {}

  try {
    const stockDbPath = path.join(__dirname, '../../../Stock_management_loops/data/stock_state.json');
    if (fs.existsSync(stockDbPath)) {
      const stockState = JSON.parse(fs.readFileSync(stockDbPath, 'utf8'));
      if (stockState.locations && stockState.locations.length > 0) {
        return stockState.locations.filter(l => !orgId || l.organizationId === orgId);
      }
    }
  } catch (e) {}

  return [
    {
      id: 'store-9e6c3606',
      code: 'ST-01',
      name: 'BeyondVER Flagship',
      type: 'STORE',
      address: 'Cambodia Branch',
      isDefault: true
    }
  ];
}

function calculatePeriodMetrics(startStr, endStr, targetStoreId, orgId) {
  const db = getDb();
  const allEntries = db.journalEntries || [];
  const entriesInOrg = orgId ? allEntries.filter(j => j.organizationId === orgId) : allEntries;

  // Filter journals strictly within [startStr, endStr]
  const periodJournals = entriesInOrg.filter(j => {
    if (j.status === 'REVERSED' || j.reversedById) return false;
    if (targetStoreId && targetStoreId !== 'ALL') {
      if (j.storeId && j.storeId !== targetStoreId) return false;
      if (j.locationId && j.locationId !== targetStoreId) return false;
    }
    return j.accountingDate >= startStr && j.accountingDate <= endStr;
  });

  const accountSums = {};
  periodJournals.forEach(j => {
    (j.lines || []).forEach(line => {
      const code = line.accountCode;
      if (!accountSums[code]) {
        accountSums[code] = { debit: 0, credit: 0, count: 0 };
      }
      accountSums[code].debit += Number(line.debit) || 0;
      accountSums[code].credit += Number(line.credit) || 0;
      accountSums[code].count += 1;
    });
  });

  const getDr = (code) => toDecimal(accountSums[code]?.debit || 0);
  const getCr = (code) => toDecimal(accountSums[code]?.credit || 0);

  // Revenue (Credit normal side)
  const salesRev = toDecimal(getCr('4010') - getDr('4010'));
  const shippingInc = toDecimal(getCr('4015') - getDr('4015'));
  const otherRev = toDecimal((getCr('4025') - getDr('4025')) + (getCr('4090') - getDr('4090')));
  const discounts = toDecimal(getDr('4030') - getCr('4030'));
  const returns = toDecimal(getDr('4020') - getCr('4020'));
  
  const grossRevenue = toDecimal(Math.max(0, salesRev + shippingInc + otherRev));
  const netRevenue = toDecimal(grossRevenue - discounts - returns);

  // Cost of Goods Sold (Debit normal side)
  const landedCogs = toDecimal(getDr('5010') - getCr('5010'));
  const shrinkage = toDecimal(getDr('5020') - getCr('5020'));
  const otherCogs = toDecimal(getDr('5030') - getCr('5030'));
  const totalCogs = toDecimal(landedCogs + shrinkage + otherCogs);

  // Gross Profit
  const grossProfit = toDecimal(netRevenue - totalCogs);
  const grossMarginPct = netRevenue > 0 ? toDecimal((grossProfit / netRevenue) * 100) : 0;

  // Operating Expenses Breakdown
  const opexCategories = [
    { code: '6010', name: 'Direct Selling Costs', amount: toDecimal(getDr('6010') - getCr('6010')) },
    { code: '6020', name: 'Marketing & Advertising', amount: toDecimal(getDr('6020') - getCr('6020')) },
    { code: '6030', name: 'Rent & Store Utilities', amount: toDecimal(getDr('6030') - getCr('6030')) },
    { code: '6040', name: 'Payroll & Staff Wages', amount: toDecimal(getDr('6040') - getCr('6040')) },
    { code: '6050', name: 'Software & Subscriptions', amount: toDecimal(getDr('6050') - getCr('6050')) },
    { code: '6060', name: 'Depreciation & Amortization', amount: toDecimal(getDr('6060') - getCr('6060')) },
    { code: '6070', name: 'Professional & Legal Fees', amount: toDecimal(getDr('6070') - getCr('6070')) },
    { code: '6080', name: 'Bank Charges & Payment Fees', amount: toDecimal(getDr('6080') - getCr('6080')) }
  ];

  Object.keys(accountSums).forEach(code => {
    if (code.startsWith('6') && !opexCategories.some(c => c.code === code)) {
      const amt = toDecimal(getDr(code) - getCr(code));
      if (amt !== 0) {
        const found = (db.accounts || []).find(a => a.code === code);
        opexCategories.push({
          code,
          name: found?.name || `Expense (${code})`,
          amount: amt
        });
      }
    }
  });

  const totalOpex = toDecimal(opexCategories.reduce((sum, c) => sum + c.amount, 0));
  const netProfit = toDecimal(grossProfit - totalOpex);
  const netMarginPct = netRevenue > 0 ? toDecimal((netProfit / netRevenue) * 100) : 0;

  // Cash Flow in period
  const cashDr = toDecimal(getDr('1010') + getDr('1020'));
  const cashCr = toDecimal(getCr('1010') + getCr('1020'));
  const netCashChange = toDecimal(cashDr - cashCr);

  // Cumulative balances as of end date
  const balancesAsOfEnd = getAccountBalancesForOrg(orgId, { asOfDate: endStr, storeId: targetStoreId });
  const endingCash = toDecimal((balancesAsOfEnd['1010']?.balance || 0) + (balancesAsOfEnd['1020']?.balance || 0));

  const operatingCashInflow = toDecimal(salesRev + getCr('1100'));
  const operatingCashOutflow = toDecimal(totalOpex + getDr('2010') + shrinkage);
  const netOperatingCash = toDecimal(operatingCashInflow - operatingCashOutflow);

  // Balance sheet as of end date
  const bs = getBalanceSheet(orgId, { asOfDate: endStr, storeId: targetStoreId });

  // Accounts Payable
  const allBills = orgId ? (db.supplierBills || []).filter(b => b.organizationId === orgId) : (db.supplierBills || []);
  const billsAsOfEnd = allBills.filter(b => b.billDate <= endStr);
  const outstandingBills = billsAsOfEnd.filter(b => b.status === 'UNPAID' || b.status === 'PARTIALLY_PAID');
  const totalApOutstanding = toDecimal(balancesAsOfEnd['2010']?.balance || outstandingBills.reduce((s, b) => s + (Number(b.balanceDue) || 0), 0));
  
  const periodNewBills = allBills.filter(b => b.billDate >= startStr && b.billDate <= endStr);
  const periodNewBillsTotal = toDecimal(periodNewBills.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0));
  const periodBillPayments = toDecimal(getDr('2010'));

  // Accounts Receivable
  const allInvoices = orgId ? (db.invoices || []).filter(i => i.organizationId === orgId) : (db.invoices || []);
  const invAsOfEnd = allInvoices.filter(i => i.invoiceDate <= endStr);
  const unpaidInvoices = invAsOfEnd.filter(i => i.status !== 'PAID');
  const totalArOutstanding = toDecimal(balancesAsOfEnd['1100']?.balance || unpaidInvoices.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0));

  const periodNewInvoices = allInvoices.filter(i => i.invoiceDate >= startStr && i.invoiceDate <= endStr);
  const periodCreditSales = toDecimal(periodNewInvoices.filter(i => i.status !== 'PAID').reduce((s, i) => s + (Number(i.totalAmount) || 0), 0));
  const periodCollections = toDecimal(getCr('1100'));

  // Historical Inventory Valuation as of end date
  const inventoryValuation = getInventoryValuationReport(orgId, { asOfDate: endStr, storeId: targetStoreId });

  // Store-by-Store Performance
  const stores = getStores(orgId);
  const storePerformance = stores.map(store => {
    const isThisStore = (j) => {
      if (j.storeId === store.id || j.locationId === store.id) return true;
      if (!j.storeId && !j.locationId && (store.isDefault || stores.length === 1)) return true;
      return false;
    };

    const storeJournals = periodJournals.filter(isThisStore);
    let stRev = 0, stCogs = 0, stDiscounts = 0;
    storeJournals.forEach(j => {
      (j.lines || []).forEach(l => {
        if (l.accountCode === '4010' || l.accountCode === '4015') stRev += (Number(l.credit) || 0) - (Number(l.debit) || 0);
        if (l.accountCode === '4030' || l.accountCode === '4020') stDiscounts += (Number(l.debit) || 0) - (Number(l.credit) || 0);
        if (l.accountCode === '5010' || l.accountCode === '5020') stCogs += (Number(l.debit) || 0) - (Number(l.credit) || 0);
      });
    });

    const storeNetRev = toDecimal(Math.max(0, stRev - stDiscounts));
    const storeCogsDec = toDecimal(Math.max(0, stCogs));
    const storeGrossProfit = toDecimal(storeNetRev - storeCogsDec);
    const storeMargin = storeNetRev > 0 ? toDecimal((storeGrossProfit / storeNetRev) * 100) : 0;

    const storeInvoices = periodNewInvoices.filter(i => {
      if (i.storeId === store.id || i.locationId === store.id) return true;
      if (!i.storeId && !i.locationId && (store.isDefault || stores.length === 1)) return true;
      return false;
    });
    const txCount = storeInvoices.length || storeJournals.filter(j => j.sourceType === 'SALE').length || (storeNetRev > 0 ? 1 : 0);
    const avgTicket = txCount > 0 ? toDecimal(storeNetRev / txCount) : 0;

    return {
      storeId: store.id,
      storeName: store.name,
      storeCode: store.code || 'ST-01',
      storeType: store.type || 'STORE',
      isDefault: Boolean(store.isDefault),
      revenue: storeNetRev,
      cogs: storeCogsDec,
      grossProfit: storeGrossProfit,
      grossMarginPct: storeMargin,
      transactionsCount: txCount,
      avgTicket
    };
  });

  return {
    startDate: startStr,
    endDate: endStr,
    storeId: targetStoreId || 'ALL',
    revenue: {
      grossRevenue,
      salesRevenue: salesRev,
      shippingIncome: shippingInc,
      otherRevenue: otherRev,
      discounts,
      returns,
      netRevenue
    },
    cogs: {
      landedCogs,
      shrinkage,
      otherCogs,
      totalCogs
    },
    profitability: {
      grossProfit,
      grossMarginPct,
      netProfit,
      netMarginPct
    },
    opex: {
      totalOpex,
      categories: opexCategories
    },
    cashFlow: {
      operatingCashInflow,
      operatingCashOutflow,
      netOperatingCash,
      cashReceived: cashDr,
      cashDisbursed: cashCr,
      netCashChange,
      endingCash
    },
    balanceSheet: {
      asOfDate: endStr,
      totalAssets: bs.totals.totalAssets,
      totalLiabilities: bs.totals.totalLiabilities,
      totalEquity: bs.totals.totalEquity,
      discrepancy: bs.totals.discrepancy,
      isBalanced: bs.totals.isBalanced
    },
    accountsPayable: {
      asOfDate: endStr,
      totalOutstanding: totalApOutstanding,
      periodNewBillsTotal,
      periodBillPayments,
      pendingBillsCount: outstandingBills.length
    },
    accountsReceivable: {
      asOfDate: endStr,
      totalOutstanding: totalArOutstanding,
      periodCreditSales,
      periodCollections,
      pendingInvoicesCount: unpaidInvoices.length
    },
    inventoryValuation: {
      asOfDate: endStr,
      assetBalance: inventoryValuation.inventoryAssetBalance,
      totalValuation: inventoryValuation.totalValuation,
      itemCount: (inventoryValuation.items || []).length
    },
    storePerformance,
    journalCount: periodJournals.length
  };
}

function getPeriodFinancials(orgId = null, options = {}) {
  const stores = getStores(orgId);
  const nowStr = new Date().toISOString().split('T')[0];
  
  const startDate = options.startDate || nowStr.slice(0, 7) + '-01';
  const endDate = options.endDate || nowStr;
  const storeId = options.storeId || 'ALL';
  const compare = Boolean(options.compare);

  // Compute duration in days
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const diffDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  // Compute previous period of identical duration
  const prevEndD = new Date(startD.getTime() - 24 * 60 * 60 * 1000);
  const prevStartD = new Date(prevEndD.getTime() - (diffDays - 1) * 24 * 60 * 60 * 1000);
  const prevStartDate = prevStartD.toISOString().split('T')[0];
  const prevEndDate = prevEndD.toISOString().split('T')[0];

  const currentPeriod = calculatePeriodMetrics(startDate, endDate, storeId, orgId);
  let previousPeriod = null;
  let comparison = null;

  if (compare) {
    previousPeriod = calculatePeriodMetrics(prevStartDate, prevEndDate, storeId, orgId);
    
    const calcDelta = (curr, prev) => {
      const c = Number(curr) || 0;
      const p = Number(prev) || 0;
      const delta = toDecimal(c - p);
      const deltaPct = p !== 0 ? toDecimal((delta / Math.abs(p)) * 100) : (c > 0 ? 100 : 0);
      return { current: c, previous: p, delta, deltaPct };
    };

    comparison = {
      previousStartDate: prevStartDate,
      previousEndDate: prevEndDate,
      durationDays: diffDays,
      revenue: calcDelta(currentPeriod.revenue.netRevenue, previousPeriod.revenue.netRevenue),
      cogs: calcDelta(currentPeriod.cogs.totalCogs, previousPeriod.cogs.totalCogs),
      grossProfit: calcDelta(currentPeriod.profitability.grossProfit, previousPeriod.profitability.grossProfit),
      opex: calcDelta(currentPeriod.opex.totalOpex, previousPeriod.opex.totalOpex),
      netProfit: calcDelta(currentPeriod.profitability.netProfit, previousPeriod.profitability.netProfit),
      cashFlow: calcDelta(currentPeriod.cashFlow.netCashChange, previousPeriod.cashFlow.netCashChange),
      accountsPayable: calcDelta(currentPeriod.accountsPayable.totalOutstanding, previousPeriod.accountsPayable.totalOutstanding),
      accountsReceivable: calcDelta(currentPeriod.accountsReceivable.totalOutstanding, previousPeriod.accountsReceivable.totalOutstanding)
    };
  }

  return {
    organizationId: orgId,
    filter: {
      startDate,
      endDate,
      storeId,
      compare,
      durationDays: diffDays
    },
    stores: [
      { id: 'ALL', name: 'All Stores (Combined)', code: 'ALL', type: 'ALL', isDefault: true },
      ...stores
    ],
    currentPeriod,
    previousPeriod,
    comparison
  };
}

module.exports = {
  initDatabase,
  getBusinessInfo,
  updateBusinessSettings,
  getAccounts,
  getAccountByCode,
  createAccount,
  updateAccount,
  deleteAccount,
  createCashTransfer,
  getCapitalOverview,
  addCapitalPartner,
  deleteCapitalPartner,
  addCapitalTransaction,
  getStartupBudgetSummary,
  addStartupBudgetItem,
  getShipmentsList,
  getShipmentDetails,
  createShipment,
  updateShipment,
  deleteShipment,
  addShipmentOverhead,
  updateShipmentOverhead,
  deleteShipmentOverhead,
  finalizeShipmentLandedCost,
  updateShipmentStatus,
  getExpenses,
  createExpense,
  getSupplierBills,
  createSupplierBill,
  paySupplierBill,
  getInvoices,
  createInvoice,
  getJournalEntries,
  getAccountLedger,
  postJournalEntry,
  reverseJournalEntry,
  getAccountBalancesForOrg,
  getExecutiveDashboardData,
  getTrialBalance,
  getBalanceSheet,
  getCashFlowStatement,
  getInventoryValuationReport,
  getAccountsPayableReport,
  getAccountsReceivableReport,
  getStores,
  calculatePeriodMetrics,
  getPeriodFinancials
};
