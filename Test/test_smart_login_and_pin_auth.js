// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — SMART LOGIN & COMPANY PIN TEST SUITE
// Tests all acceptance criteria for:
// 1. Smart Login Redirection (Backoffice vs POS vs Both vs None)
// 2. Company-Scoped Quick PIN Authentication & Isolation
// 3. Same PIN across different companies
// 4. Rate limiting & temporary lockout on repeated failed PINs
// 5. Automatic unique PIN generation and uniqueness validation
// 6. Separate PIN view & edit permissions (viewUserPin vs editUserPin)
// ============================================================================

const assert = require('assert');
const BASE_URL = 'http://localhost:3002';

async function req(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

let passed = 0;
let failed = 0;

async function it(desc, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n========================================================');
  console.log('🧪 RUNNING SMART LOGIN & COMPANY PIN AUTHENTICATION TESTS');
  console.log('========================================================\n');

  // Obtain master owner token for provisioning test users
  const ownerLoginRes = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'owner@theloops.com', password: 'password123' })
  });
  assert.strictEqual(ownerLoginRes.status, 200, 'Owner login failed');
  const ownerToken = ownerLoginRes.data.token;
  const ownerOrgId = ownerLoginRes.data.user.organizationId || 'org-6e9ed3cf';

  // --------------------------------------------------------------------------
  // SUITE 1: SMART LOGIN REDIRECTION
  // --------------------------------------------------------------------------
  console.log('--- 1. SMART LOGIN REDIRECTION TESTS ---');

  await it('User with both Backoffice and POS permissions redirects to /admin by default', async () => {
    const res = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'owner@theloops.com', password: 'password123' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
    assert.strictEqual(res.data.redirectUrl, '/admin');
    assert.strictEqual(res.data.canBackoffice, true);
    assert.strictEqual(res.data.canPos, true);
  });

  await it('User with POS-only permission redirects to /pos', async () => {
    const res = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'cashier1@theloops.com', password: 'password123' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
    assert.strictEqual(res.data.redirectUrl, '/pos');
    assert.strictEqual(res.data.canBackoffice, false);
    assert.strictEqual(res.data.canPos, true);
  });

  // Create backoffice-only user (Accountant) via API
  const accountantEmail = `accountant_${Date.now()}@theloops.com`;
  const boCreateRes = await req('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      email: accountantEmail,
      fullName: 'Accountant Test',
      role: 'ACCOUNTANT',
      password: 'password123',
      organizationId: ownerOrgId,
      permissions: { accessBackoffice: true, openPos: false, makeSales: false }
    })
  });
  assert.strictEqual(boCreateRes.status, 201, 'Failed to create accountant test user');

  await it('User with Backoffice-only permission redirects to /admin', async () => {
    const res = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: accountantEmail, password: 'password123' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
    assert.strictEqual(res.data.redirectUrl, '/admin');
    assert.strictEqual(res.data.canBackoffice, true);
    assert.strictEqual(res.data.canPos, false);
  });

  // Create user with zero permissions
  const nopermEmail = `noperms_${Date.now()}@theloops.com`;
  const noPermCreateRes = await req('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      email: nopermEmail,
      fullName: 'No Perms User',
      role: 'CUSTOM_NONE',
      password: 'password123',
      organizationId: ownerOrgId,
      permissions: {
        openPos: false,
        makeSales: false,
        accessBackoffice: false,
        manageEmployees: false,
        changeSystemSettings: false,
        accessStockApp: false,
        accessFinanceApp: false,
        viewFinancialReports: false
      }
    })
  });
  assert.strictEqual(noPermCreateRes.status, 201, 'Failed to create no-perms test user');

  await it('User without any permission is denied access with appropriate error message', async () => {
    const res = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: nopermEmail, password: 'password123' })
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.ok, false);
    assert.match(res.data.error, /permission/i);
  });

  // --------------------------------------------------------------------------
  // SUITE 2: QUICK PIN LOGIN — COMPANY-BASED AUTHENTICATION & CROSS-COMPANY ISOLATION
  // --------------------------------------------------------------------------
  console.log('\n--- 2. QUICK PIN LOGIN & COMPANY ISOLATION TESTS ---');

  // Register Company 1 and Company 2
  const randSuffix = Date.now().toString().slice(-6);
  const comp1Reg = await req('/api/auth/register-business', {
    method: 'POST',
    body: JSON.stringify({
      businessName: `Company Alpha ${randSuffix}`,
      ownerName: 'Alpha Owner',
      email: `alpha_owner_${randSuffix}@alpha.com`,
      password: 'password123',
      country: 'Cambodia',
      defaultCurrency: 'USD'
    })
  });
  assert.strictEqual(comp1Reg.status, 201, 'Failed to register Company Alpha');
  const comp1OrgId = comp1Reg.data.organization.id;
  const comp1OwnerToken = comp1Reg.data.token;

  const comp2Reg = await req('/api/auth/register-business', {
    method: 'POST',
    body: JSON.stringify({
      businessName: `Company Beta ${randSuffix}`,
      ownerName: 'Beta Owner',
      email: `beta_owner_${randSuffix}@beta.com`,
      password: 'password123',
      country: 'Cambodia',
      defaultCurrency: 'USD'
    })
  });
  assert.strictEqual(comp2Reg.status, 201, 'Failed to register Company Beta');
  const comp2OrgId = comp2Reg.data.organization.id;
  const comp2OwnerToken = comp2Reg.data.token;

  // Create staff in Company Alpha with PIN 6321
  const uComp1Res = await req('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${comp1OwnerToken}` },
    body: JSON.stringify({
      fullName: 'Alpha User One',
      email: `alpha_user1_${randSuffix}@alpha.com`,
      role: 'CASHIER',
      pin: '6321'
    })
  });
  assert.strictEqual(uComp1Res.status, 201, 'Failed to create user in Company Alpha');

  // Create staff in Company Beta with the EXACT SAME PIN 6321
  const uComp2Res = await req('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${comp2OwnerToken}` },
    body: JSON.stringify({
      fullName: 'Beta User One',
      email: `beta_user1_${randSuffix}@beta.com`,
      role: 'CASHIER',
      pin: '6321' // Same PIN across different companies!
    })
  });
  assert.strictEqual(uComp2Res.status, 201, 'Failed to create user in Company Beta with same PIN');

  await it('Company 1 + PIN 6321 authenticates only as Company 1 Alpha User', async () => {
    const res = await req('/api/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ pin: '6321', organizationId: comp1OrgId })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
    assert.strictEqual(res.data.user.email, `alpha_user1_${randSuffix}@alpha.com`);
    assert.strictEqual(res.data.user.organizationId, comp1OrgId);
  });

  await it('Company 2 + PIN 6321 authenticates only as Company 2 Beta User', async () => {
    const res = await req('/api/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ pin: '6321', organizationId: comp2OrgId })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
    assert.strictEqual(res.data.user.email, `beta_user1_${randSuffix}@beta.com`);
    assert.strictEqual(res.data.user.organizationId, comp2OrgId);
  });

  await it('PIN 6321 cannot authenticate into Company with no matching user', async () => {
    const res = await req('/api/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ pin: '6321', organizationId: ownerOrgId })
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.ok, false);
    assert.strictEqual(res.data.error, 'Invalid PIN. Please try again.');
  });

  await it('Random incorrect PIN is rejected with clean error message', async () => {
    const res = await req('/api/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ pin: '0000', organizationId: comp1OrgId })
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.ok, false);
    assert.strictEqual(res.data.error, 'Invalid PIN. Please try again.');
  });

  // Create inactive user
  const inactEmail = `inact_${Date.now()}@alpha.com`;
  const inactUserRes = await req('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${comp1OwnerToken}` },
    body: JSON.stringify({
      fullName: 'Inactive Staff',
      email: inactEmail,
      role: 'CASHIER',
      pin: '7842',
      status: 'INACTIVE'
    })
  });
  assert.strictEqual(inactUserRes.status, 201);
  const inactUserId = inactUserRes.data.user.id;

  // Make sure status is set to INACTIVE
  await req(`/api/users/${inactUserId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${comp1OwnerToken}` },
    body: JSON.stringify({ status: 'INACTIVE', active: false })
  });

  await it('Inactive user PIN is rejected with "This account is inactive."', async () => {
    const res = await req('/api/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ pin: '7842', organizationId: comp1OrgId })
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.ok, false);
    assert.strictEqual(res.data.error, 'This account is inactive.');
  });

  // Create user without POS permission
  const noPosEmail = `nopos_${Date.now()}@alpha.com`;
  const noPosRes = await req('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${comp1OwnerToken}` },
    body: JSON.stringify({
      fullName: 'No POS Staff',
      email: noPosEmail,
      role: 'ACCOUNTANT',
      pin: '8491',
      permissions: { openPos: false, makeSales: false, accessBackoffice: true }
    })
  });
  assert.strictEqual(noPosRes.status, 201);

  await it('User without POS permission is denied Quick PIN login', async () => {
    const res = await req('/api/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ pin: '8491', organizationId: comp1OrgId })
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.ok, false);
    assert.strictEqual(res.data.error, 'You do not have permission to access this store.');
  });

  // Rate Limiting & Temporary Lockout test
  await it('5 consecutive failed PIN attempts trigger 10-minute temporary lockout', async () => {
    const rateOrg = `org-rate-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      await req('/api/auth/pin', {
        method: 'POST',
        body: JSON.stringify({ pin: '9988', organizationId: rateOrg })
      });
    }

    const lockedRes = await req('/api/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ pin: '9988', organizationId: rateOrg })
    });
    assert.strictEqual(lockedRes.status, 401);
    assert.strictEqual(lockedRes.data.code, 'PIN_LOCKED');
    assert.strictEqual(lockedRes.data.error, 'Too many failed attempts. Please try again later.');
  });

  // --------------------------------------------------------------------------
  // SUITE 3: AUTOMATIC UNIQUE PIN GENERATION & USER CREATION
  // --------------------------------------------------------------------------
  console.log('\n--- 3. AUTOMATIC PIN GENERATION & UNIQUENESS TESTS ---');

  let autoPinCreated = null;

  await it('Creating a user automatically generates a unique PIN when not supplied', async () => {
    const autoUserEmail = `autopin_${Date.now()}@theloops.com`;
    const res = await req('/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Auto PIN Employee',
        email: autoUserEmail,
        role: 'CASHIER'
      })
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.ok, true);
    assert.ok(res.data.initialPin, 'Should have auto-generated initialPin');
    assert.strictEqual(typeof res.data.initialPin, 'string');
    assert.strictEqual(res.data.initialPin.length, 4);
    autoPinCreated = res.data.initialPin;
  });

  await it('Duplicate PIN in the SAME company is rejected with 400 Bad Request', async () => {
    const dupUserEmail = `dup_pin_${Date.now()}@theloops.com`;
    const res = await req('/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Duplicate PIN Employee',
        email: dupUserEmail,
        role: 'CASHIER',
        pin: autoPinCreated // Attempt duplicate PIN in same company
      })
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.ok, false);
    assert.match(res.data.error, /already assigned to another user in this company/i);
  });

  // --------------------------------------------------------------------------
  // SUITE 4: PIN VIEW & EDIT PERMISSIONS (viewUserPin vs editUserPin)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. SEPARATE PIN VIEW & EDIT PERMISSIONS TESTS ---');

  // Create Admin A: viewUserPin = true, editUserPin = false
  const adminAEmail = `admin_view_only_${Date.now()}@theloops.com`;
  const adminARes = await req('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      email: adminAEmail,
      fullName: 'Admin View Only',
      role: 'POS_ADMIN',
      password: 'password123',
      permissions: {
        accessBackoffice: true,
        manageEmployees: true,
        viewUserPin: true,
        editUserPin: false
      }
    })
  });
  assert.strictEqual(adminARes.status, 201);

  // Create Admin B: viewUserPin = false, editUserPin = true
  const adminBEmail = `admin_edit_only_${Date.now()}@theloops.com`;
  const adminBRes = await req('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      email: adminBEmail,
      fullName: 'Admin Edit Only',
      role: 'POS_ADMIN',
      password: 'password123',
      permissions: {
        accessBackoffice: true,
        manageEmployees: true,
        viewUserPin: false,
        editUserPin: true
      }
    })
  });
  assert.strictEqual(adminBRes.status, 201);

  // Create Regular Employee: viewUserPin = false, editUserPin = false
  const regularEmail = `reg_cashier_${Date.now()}@theloops.com`;
  const regRes = await req('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      email: regularEmail,
      fullName: 'Regular Cashier',
      role: 'CASHIER',
      password: 'password123',
      permissions: {
        viewUserPin: false,
        editUserPin: false
      }
    })
  });
  assert.strictEqual(regRes.status, 201);

  const tokenAdminA = (await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: adminAEmail, password: 'password123' })
  })).data.token;

  const tokenAdminB = (await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: adminBEmail, password: 'password123' })
  })).data.token;

  const tokenRegular = (await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: regularEmail, password: 'password123' })
  })).data.token;

  // Target cashier to inspect
  const targetCashierId = 'usr-03';

  await it('Admin A (viewUserPin: true) CAN reveal PIN', async () => {
    const res = await req(`/api/users/${targetCashierId}/reveal-pin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
    assert.strictEqual(res.data.pin, '1111');
  });

  await it('Admin A (editUserPin: false) CANNOT regenerate or edit PIN (403 Forbidden)', async () => {
    const resRegen = await req(`/api/users/${targetCashierId}/regenerate-pin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(resRegen.status, 403);
    assert.strictEqual(resRegen.data.ok, false);

    const resEdit = await req(`/api/users/${targetCashierId}/pin`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ pin: '5566' })
    });
    assert.strictEqual(resEdit.status, 403);
    assert.strictEqual(resEdit.data.ok, false);
  });

  await it('Admin B (viewUserPin: false) CANNOT reveal PIN (403 Forbidden)', async () => {
    const res = await req(`/api/users/${targetCashierId}/reveal-pin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdminB}` }
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.ok, false);
    assert.match(res.data.error, /permission/i);
  });

  let newlyRegeneratedPin = null;

  await it('Admin B (editUserPin: true) CAN regenerate PIN', async () => {
    const res = await req(`/api/users/${targetCashierId}/regenerate-pin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdminB}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
    assert.ok(res.data.pin);
    newlyRegeneratedPin = res.data.pin;
    assert.notStrictEqual(newlyRegeneratedPin, '1111');
  });

  await it('After PIN regeneration, old PIN 1111 cannot authenticate', async () => {
    const res = await req('/api/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ pin: '1111', organizationId: ownerOrgId })
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.ok, false);
  });

  await it('After PIN regeneration, new PIN authenticates immediately', async () => {
    const res = await req('/api/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ pin: newlyRegeneratedPin, organizationId: ownerOrgId })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
    assert.strictEqual(res.data.user.id, targetCashierId);
  });

  await it('Regular Employee (no PIN permissions) CANNOT reveal or regenerate PIN (403 Forbidden)', async () => {
    const resReveal = await req(`/api/users/${targetCashierId}/reveal-pin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenRegular}` }
    });
    assert.strictEqual(resReveal.status, 403);

    const resRegen = await req(`/api/users/${targetCashierId}/regenerate-pin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenRegular}` }
    });
    assert.strictEqual(resRegen.status, 403);
  });

  // Restore usr-03 PIN to 1111 for demo convenience
  await req(`/api/users/${targetCashierId}/pin`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ pin: '1111' })
  });

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n========================================================');
  console.log(`TEST EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
