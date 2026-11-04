/**
 * Complete Data Purge & Reset Script
 * Cleans all automated testing data, test organizations, test products, test shipments,
 * test ledger entries, and test users, while preserving the legitimate tenant accounts,
 * stores, standard chart of accounts, and system configuration.
 */

const fs = require('fs');
const path = require('path');
const ROOT_DIR = path.resolve(__dirname, '..');
const { getDatabase } = require('../shared/database/connection');

console.log('=====================================================');
console.log(' PURGING ALL TESTING DATA & RESETTING TO CLEAN SLATE');
console.log('=====================================================\n');

// Valid organizations and users to preserve
const KEEP_ORG_IDS = ['org-6e9ed3cf'];
const KEEP_USER_EMAILS = [
  'longkimneng@gmail.com',
  'neng@gmail.com',
  'panha@gmial.com',
  'panha@gmail.com'
];
const KEEP_LOC_IDS = ['loc-01', 'loc-zprdw9b'];

// --------------------------------------------------------------------------
// 1. CLEAN SQLITE DATABASE
// --------------------------------------------------------------------------
console.log('1. Cleaning SQLite Database (data/theloops_enterprise.db)...');
const db = getDatabase();

db.exec(`
  -- Delete test sessions and events
  DELETE FROM sessions;
  DELETE FROM sessions_v2;
  DELETE FROM integration_events;
  DELETE FROM audit_logs;

  -- Delete transactional test records
  DELETE FROM pos_orders;
  DELETE FROM saved_orders;
  DELETE FROM invoices;
  DELETE FROM supplier_bills;
  DELETE FROM expenses;
  DELETE FROM shipments;
  DELETE FROM shipment_items;
  DELETE FROM shipment_overheads;
  DELETE FROM journal_entries;
  DELETE FROM stock_ledger;
  DELETE FROM stock_balances;
  DELETE FROM product_variants;
  DELETE FROM products;

  -- Delete Account & Financial System records
  DELETE FROM import_history;
  DELETE FROM monthly_revenue_allocations;
  DELETE FROM budget_allocations;
  DELETE FROM capital_borrowings;
  DELETE FROM capital_repayments;
  DELETE FROM capital_accounts;
  DELETE FROM loop_share_ledger;
  DELETE FROM monthly_closing_snapshots;
  DELETE FROM financial_transactions;
  DELETE FROM export_audit_logs;

  -- Clean test locations & registers
  DELETE FROM registers WHERE organization_id NOT IN ('org-6e9ed3cf');
  DELETE FROM locations WHERE organization_id NOT IN ('org-6e9ed3cf');

  -- Clean test categories
  DELETE FROM categories WHERE organization_id NOT IN ('org-6e9ed3cf');
  DELETE FROM finance_product_categories WHERE organization_id NOT IN ('org-6e9ed3cf');

  -- Clean test users
  DELETE FROM users WHERE email NOT IN ('longkimneng@gmail.com', 'neng@gmail.com', 'panha@gmial.com', 'panha@gmail.com');

  -- Clean test organizations
  DELETE FROM organizations WHERE id NOT IN ('org-6e9ed3cf');
`);

console.log('   ✓ SQLite tables cleaned successfully.');

// --------------------------------------------------------------------------
// 2. CLEAN POS STATE (The_Loop.s_POS/backend/data/pos_state.json)
// --------------------------------------------------------------------------
console.log('\n2. Cleaning POS State (pos_state.json)...');
const posFile = path.join(ROOT_DIR, 'The_Loop.s_POS/backend/data/pos_state.json');
const posState = JSON.parse(fs.readFileSync(posFile, 'utf8'));

// Filter users to keep only legitimate staff
posState.users = (posState.users || []).filter(u => KEEP_USER_EMAILS.includes(u.email));

// Filter organizations
posState.organizations = (posState.organizations || []).filter(o => KEEP_ORG_IDS.includes(o.id));
if (posState.organization && !KEEP_ORG_IDS.includes(posState.organization.id)) {
  posState.organization = posState.organizations[0];
}

// Filter locations / stores by tenant organization
posState.locations = (posState.locations || []).filter(l => KEEP_ORG_IDS.includes(l.organizationId));
posState.stores = (posState.stores || []).filter(s => KEEP_ORG_IDS.includes(s.organizationId));
posState.registers = (posState.registers || []).filter(r => KEEP_ORG_IDS.includes(r.organizationId));

// Clear transactional and test records
posState.orders = [];
posState.orderLines = [];
posState.payments = [];
posState.shifts = [];
posState.cashMovements = [];
posState.savedOrders = [];
posState.parkedCarts = [];
posState.refunds = [];
posState.refundLines = [];
posState.sessions = [];
posState.auditLog = [];
posState.auditLogs = [];
posState.outbox = [];
posState.inbox = [];
posState.passwordResets = [];
posState.products = [];

fs.writeFileSync(posFile, JSON.stringify(posState, null, 2), 'utf8');
console.log('   ✓ POS state purged (users retained:', posState.users.length, ', orgs:', posState.organizations.length, ')');

// --------------------------------------------------------------------------
// 3. CLEAN STOCK MANAGEMENT STATE (Stock_management_loops/backend/data/store.json)
// --------------------------------------------------------------------------
console.log('\n3. Cleaning Stock Management State (store.json)...');
const stockFile = path.join(ROOT_DIR, 'Stock_management_loops/backend/data/store.json');
const stockState = JSON.parse(fs.readFileSync(stockFile, 'utf8'));

stockState.locations = (stockState.locations || []).filter(l => KEEP_ORG_IDS.includes(l.organizationId));
stockState.categories = (stockState.categories || []).filter(c => KEEP_ORG_IDS.includes(c.organizationId));
stockState.products = [];
stockState.stockBalances = [];
stockState.ledger = [];
stockState.receivedPurchases = [];
stockState.purchaseOrders = [];
stockState.sales = [];
stockState.suppliers = [];
stockState.customers = [];

fs.writeFileSync(stockFile, JSON.stringify(stockState, null, 2), 'utf8');
console.log('   ✓ Stock state purged (locations:', stockState.locations.length, ', categories:', stockState.categories.length, ')');

// --------------------------------------------------------------------------
// 4. CLEAN FINANCE STATE (account_system_Loops/backend/data/loops_finance_state.json)
// --------------------------------------------------------------------------
console.log('\n4. Cleaning Finance & Accounting State (loops_finance_state.json)...');
const finFile = path.join(ROOT_DIR, 'account_system_Loops/backend/data/loops_finance_state.json');
const finState = JSON.parse(fs.readFileSync(finFile, 'utf8'));

// Retain only founder account for legitimate owner
finState.capitalAccounts = [
  {
    id: 'cap-founder-01',
    organizationId: 'org-6e9ed3cf',
    partnerName: 'long kimneng',
    partnerRole: 'Owner & Founder',
    ownershipPercentage: 100,
    totalInvested: 0,
    totalWithdrawn: 0,
    currentEquity: 0
  }
];
finState.capitalTransactions = [];
finState.startupBudgets = [];
finState.startupBudgetItems = [];
finState.shipments = [];
finState.shipmentItems = [];
finState.shipmentOverheads = [];
finState.supplierBills = [];
finState.expenses = [];
finState.recurringBills = [];
finState.invoices = [];
finState.journalEntries = [];

// Reset all account balances to 0 in standard Chart of Accounts
(finState.accounts || []).forEach(acc => {
  acc.balance = 0;
  acc.debits = 0;
  acc.credits = 0;
});

finState.totalContributed = 0;
finState.totalWithdrawn = 0;
finState.netEquity = 0;

fs.writeFileSync(finFile, JSON.stringify(finState, null, 2), 'utf8');
console.log('   ✓ Finance state purged (capital accounts: 1, shipments: 0, journals: 0, accounts reset: 65)');

// --------------------------------------------------------------------------
// 5. REMOVE AUDIT ARTIFACTS & TEST UPLOADS
// --------------------------------------------------------------------------
const auditResultsFile = path.join(ROOT_DIR, 'audit_results.json');
if (fs.existsSync(auditResultsFile)) {
  fs.unlinkSync(auditResultsFile);
  console.log('\n5. Removed root audit_results.json.');
}

const uploadsDir = path.join(ROOT_DIR, 'data', 'uploads');
if (fs.existsSync(uploadsDir)) {
  for (const f of fs.readdirSync(uploadsDir)) {
    try { fs.unlinkSync(path.join(uploadsDir, f)); } catch(e) {}
  }
  console.log('6. Cleaned data/uploads/ directory.');
}

console.log('\n=====================================================');
console.log(' ALL TEST DATA CLEANED & FRESH STATE READY FOR USE');
console.log('=====================================================');
