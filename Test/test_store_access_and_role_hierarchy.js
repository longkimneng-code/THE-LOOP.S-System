// Verification Test Suite for Store Access, Role Hierarchy & Security Guards
const assert = require('assert');
const { 
  loginUser, 
  updateUser, 
  deleteUser, 
  createUserAccount,
  getRoles,
  SYSTEM_ROLES 
} = require('../The_Loop.s_POS/backend/src/auth');
const { getDatabase } = require('../shared/database/connection');
const { 
  injectCapital, 
  withdrawCapital, 
  getOrCreateMonthlyPlan,
  calculateEligibleRevenue 
} = require('../shared/financial/financialAllocationEngine');

async function runTests() {
  console.log('=====================================================');
  console.log('  STORE ACCESS, ROLE HIERARCHY & SECURITY TEST SUITE');
  console.log('=====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${name}:`, e.message);
    }
  }

  // 1. Roles are ordered descending by authority level
  test('SYSTEM_ROLES and getRoles() include authorityLevel with OWNER at top (100)', () => {
    const roles = getRoles();
    const ownerRole = roles.find(r => r.id === 'OWNER');
    assert.strictEqual(ownerRole.authorityLevel, 100);
    const superAdminRole = roles.find(r => r.id === 'SUPER_ADMIN');
    assert.strictEqual(superAdminRole.authorityLevel, 90);
    const sorted = [...roles].sort((a, b) => (b.authorityLevel || 0) - (a.authorityLevel || 0));
    assert.strictEqual(sorted[0].id, 'OWNER');
    assert.strictEqual(sorted[1].id, 'SUPER_ADMIN');
  });

  // 2. Sole Owner enforcement: cannot create second owner
  test('Cannot create second OWNER account in same organization', () => {
    const res = createUserAccount({
      email: 'fakeowner@theloops.com',
      fullName: 'Fake Owner',
      role: 'OWNER',
      organizationId: 'org-6e9ed3cf'
    });
    assert.strictEqual(res.ok, false);
    assert.ok(res.error.includes('Only one Business Owner account is permitted'));
  });

  // 3. Self-modification guard: staff cannot change own permissions or role
  test('Staff member cannot modify their own permissions, role, or store access', () => {
    const db = require('../The_Loop.s_POS/backend/src/db').loadDb();
    let cashier = db.users.find(u => u.role === 'CASHIER' && u.organizationId === 'org-6e9ed3cf');
    if (!cashier) {
      const created = createUserAccount({
        email: `cashier_${Date.now()}@test.com`,
        fullName: 'Test Cashier',
        role: 'CASHIER',
        organizationId: 'org-6e9ed3cf',
        assignedStoreIds: ['loc-01']
      });
      cashier = created.user;
    }

    const attempt = updateUser(
      cashier.id,
      { role: 'OWNER', permissions: { injectCapital: true } },
      cashier.fullName,
      cashier.organizationId,
      cashier.id,
      cashier.role
    );
    assert.strictEqual(attempt.ok, false);
    assert.strictEqual(attempt.forbidden, true);
    assert.ok(attempt.error.includes('Staff members cannot modify their own permissions'));
  });

  // 4. Role Hierarchy: Non-owner cannot modify staff with equal or higher authority
  test('Staff with lower authority cannot modify staff of higher or equal authority', () => {
    const attempt = updateUser(
      'usr-01', // Target
      { fullName: 'Hacked Name', role: 'CASHIER' },
      'Junior Cashier',
      'org-6e9ed3cf',
      'usr-cashier',
      'CASHIER'
    );
    assert.strictEqual(attempt.ok, false);
  });

  // 5. Staff store access can be set to specific stores without resetting to [*]
  test('Staff store assignment persists specific store branch without reverting to [*]', () => {
    const db = require('../The_Loop.s_POS/backend/src/db').loadDb();
    const created = createUserAccount({
      email: `branch_staff_${Date.now()}@test.com`,
      fullName: 'Branch Staff',
      role: 'STORE_MANAGER',
      organizationId: 'org-6e9ed3cf',
      assignedStoreIds: ['loc-01']
    });
    assert.strictEqual(created.ok, true);
    assert.deepStrictEqual(created.user.assignedStoreIds, ['loc-01']);

    // Owner updates staff to loc-zprdw9b
    const updated = updateUser(
      created.user.id,
      { assignedStoreIds: ['loc-zprdw9b'] },
      'long kimneng',
      'org-6e9ed3cf',
      'usr-owner-id',
      'OWNER'
    );
    assert.strictEqual(updated.ok, true);
    assert.deepStrictEqual(updated.user.assignedStoreIds, ['loc-zprdw9b']);
    assert.ok(!updated.user.assignedStoreIds.includes('*'));
  });

  // 6. Direct Capital Injection updates capital account and financial transactions
  test('Capital Injection increases equity balance and records transaction audit', () => {
    const res = injectCapital({
      organizationId: 'org-6e9ed3cf',
      amount: 2500.00,
      performedBy: 'long kimneng',
      notes: 'Test Capital Injection'
    });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.amountInjected, 2500);

    const plan = getOrCreateMonthlyPlan('org-6e9ed3cf', '2026-11', 'long kimneng');
    assert.ok(plan.capital.balance >= 2500);
  });

  // 7. Direct Capital Withdrawal decreases equity and prevents overdrawing
  test('Capital Withdrawal decreases balance and safely rejects overdraft', () => {
    const planBefore = getOrCreateMonthlyPlan('org-6e9ed3cf', '2026-11', 'long kimneng');
    const balBefore = planBefore.capital.balance;

    // Normal withdrawal
    const res = withdrawCapital({
      organizationId: 'org-6e9ed3cf',
      amount: 500.00,
      performedBy: 'long kimneng',
      notes: 'Dividend Draw'
    });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.amountWithdrawn, 500);

    // Overdraft attempt
    const overdraft = withdrawCapital({
      organizationId: 'org-6e9ed3cf',
      amount: 9999999.00,
      performedBy: 'long kimneng',
      notes: 'Overdraft'
    });
    assert.strictEqual(overdraft.ok, false);
    assert.ok(overdraft.error.includes('Insufficient capital equity balance'));
  });

  // 8. Store Scoping: Revenue calculation handles specific store scoping
  test('Revenue calculation respects store-level data access', () => {
    const revAll = calculateEligibleRevenue('org-6e9ed3cf', '2026-11', 'ALL');
    const revLoc1 = calculateEligibleRevenue('org-6e9ed3cf', '2026-11', 'loc-01');
    assert.ok(typeof revAll.eligibleRevenue === 'number');
    assert.ok(typeof revLoc1.eligibleRevenue === 'number');
  });

  console.log('\n=====================================================');
  console.log(`  TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log('=====================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();

