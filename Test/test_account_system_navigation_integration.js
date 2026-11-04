// Verification Test Suite: Admin Backoffice Navigation & Account System Integration
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const adminDashboardFile = path.resolve('The_Loop.s_POS/frontend/src/components/admin/AdminDashboardView.jsx');
const landedCostFile = path.resolve('The_Loop.s_POS/frontend/src/modules/finance/components/ImportsLandedCost.jsx');
const revenueAllocFile = path.resolve('The_Loop.s_POS/frontend/src/components/admin/MonthlyRevenueAllocationView.jsx');
const accountingSettingsFile = path.resolve('The_Loop.s_POS/frontend/src/modules/finance/components/AccountingSettings.jsx');
const loopShareFile = path.resolve('The_Loop.s_POS/frontend/src/components/admin/LoopShareManagementView.jsx');

console.log('=====================================================');
console.log('  NAVIGATION & ACCOUNT SYSTEM INTEGRATION TEST SUITE');
console.log('=====================================================');

let total = 0;
let passed = 0;

function it(description, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
  }
}

// 1. Admin Dashboard Sidebar Cleanup
it('Admin Dashboard sidebar does NOT render standalone Import History button', () => {
  const content = fs.readFileSync(adminDashboardFile, 'utf8');
  assert(!content.includes("adminTab === 'IMPORTS'"), 'adminTab === IMPORTS should be removed from sidebar navigation');
  assert(!content.includes("<span>Import History</span>"), 'Standalone Import History label should not be in sidebar');
});

it('Admin Dashboard sidebar does NOT render standalone Loop Share Management button', () => {
  const content = fs.readFileSync(adminDashboardFile, 'utf8');
  assert(!content.includes("adminTab === 'LOOP_SHARE'"), 'adminTab === LOOP_SHARE should be removed from sidebar navigation');
});

it('Admin Dashboard sidebar does NOT render standalone Monthly Financial History button', () => {
  const content = fs.readFileSync(adminDashboardFile, 'utf8');
  assert(!content.includes("adminTab === 'FINANCIAL_HISTORY'"), 'adminTab === FINANCIAL_HISTORY should be removed from sidebar navigation');
});

// 2. Landed Cost → Import History Integration
it('Landed Cost includes sub-tab switcher for Active Landed Costs and Import History Archive', () => {
  const content = fs.readFileSync(landedCostFile, 'utf8');
  assert(content.includes('Active Landed Costs & Shipments'), 'Should have Active Landed Costs tab button');
  assert(content.includes('Import History Archive'), 'Should have Import History Archive tab button');
  assert(content.includes('<ImportHistoryView isEmbedded={true} />'), 'Should render ImportHistoryView when subTab === history');
});

// 3. Revenue Allocation → Monthly Financial History Integration
it('Revenue Allocation includes sub-tab switcher for Active Month Allocation and Monthly Financial History Archive', () => {
  const content = fs.readFileSync(revenueAllocFile, 'utf8');
  assert(content.includes('Active Month Allocation & Live Control'), 'Should have Active Month Allocation tab button');
  assert(content.includes('Monthly Financial History Archive'), 'Should have Monthly Financial History Archive tab button');
  assert(content.includes('<MonthlyFinancialHistoryView isEmbedded={true} />'), 'Should render MonthlyFinancialHistoryView when subTab === history');
});

it('Revenue Allocation provides crystal-clear printable statement with media print isolation', () => {
  const content = fs.readFileSync(revenueAllocFile, 'utf8');
  assert(content.includes('id="printable-financial-statement"'), 'Should have printable-financial-statement container');
  assert(content.includes('@media print'), 'Should include media print CSS block');
});

// 4. Store Share Management → Account System Management
it('Accounting & Settings dynamically includes Store Share Management restricted by permission', () => {
  const content = fs.readFileSync(accountingSettingsFile, 'utf8');
  assert(content.includes('canManageStoreShare'), 'Should declare canManageStoreShare');
  assert(content.includes("id: 'store_share', label: 'Store Share Management'"), 'Should include Store Share Management tab');
  assert(content.includes('<LoopShareManagementView isEmbedded={true} />'), 'Should render LoopShareManagementView when subTab === store_share');
});

it('LoopShareManagementView safely omits contents from DOM when embedded and unauthorized', () => {
  const content = fs.readFileSync(loopShareFile, 'utf8');
  assert(content.includes('isEmbedded = false'), 'Should accept isEmbedded prop');
  assert(content.includes('if (isEmbedded) return null;'), 'Should completely omit from DOM when unauthorized and embedded');
});

console.log('=====================================================');
console.log(`  TOTAL INTEGRATION TESTS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
console.log('=====================================================');
assert.strictEqual(total, passed);

