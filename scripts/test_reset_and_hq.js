// Comprehensive Acceptance Tests for:
// 1. Reset Store Data (Ecosystem)
// 2. Switch Store Headquarters (HQ) (Stock Management -> Settings)

const http = require('http');

const POS_BASE = 'http://localhost:3002';
const STOCK_BASE = 'http://localhost:3000';

function request(baseUrl, method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function loginUser(email, password) {
  const res = await request(POS_BASE, 'POST', '/api/auth/login', {
    identifier: email,
    password: password
  });
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user };
}

async function runTests() {
  console.log('================================================================');
  console.log('ACCEPTANCE TEST SUITE: RESET STORE DATA & SWITCH STORE HQ');
  console.log('================================================================\n');

  console.log('1. Authenticating test users...');
  const owner = await loginUser('neng@gmail.com', 'password123');
  const staffPanha = await loginUser('panha@gmial.com', 'password123');

  console.log(`- Owner: ${owner.user.fullName} (${owner.user.id}), Role: ${owner.user.role}`);
  console.log(`- Staff (Panha): ${staffPanha.user.fullName} (${staffPanha.user.id}), Role: ${staffPanha.user.role}\n`);

  // ===========================================================================
  // PART A: SWITCH STORE HEADQUARTERS (HQ) ACCEPTANCE TESTS
  // ===========================================================================
  console.log('----------------------------------------------------------------');
  console.log('PART A: SWITCH STORE HEADQUARTERS (HQ) TESTS');
  console.log('----------------------------------------------------------------');

  // Test HQ-1: Query current HQ
  console.log('HQ-1: Querying current HQ state...');
  const initialHqRes = await request(POS_BASE, 'GET', '/api/stores/hq', null, owner.token);
  console.log(`- Current HQ: ${initialHqRes.data.currentHq?.name} (${initialHqRes.data.currentHq?.id})`);
  console.log(`- Total Branches: ${initialHqRes.data.branches?.length}`);
  const hq1Pass = initialHqRes.status === 200 && initialHqRes.data.currentHq != null;
  console.log(`- Assertion HQ-1: ${hq1Pass ? 'PASSED' : 'FAILED'}`);

  // Test HQ-2: Unauthorized user cannot switch HQ
  console.log('\nHQ-2: Testing unauthorized user attempt to switch HQ...');
  const unauthorizedHqRes = await request(POS_BASE, 'POST', '/api/stores/switch-hq', {
    targetStoreId: 'loc-zprdw9b'
  }, staffPanha.token);
  const hq2Pass = unauthorizedHqRes.status === 403;
  console.log(`- Panha (non-owner) switch attempt: HTTP ${unauthorizedHqRes.status} (${unauthorizedHqRes.data?.error || ''})`);
  console.log(`- Assertion HQ-2: ${hq2Pass ? 'PASSED (HTTP 403 Forbidden)' : 'FAILED'}`);

  // Test HQ-3: Cannot assign store outside organization
  console.log('\nHQ-3: Testing assignment of non-existent/invalid store ID...');
  const invalidStoreHqRes = await request(POS_BASE, 'POST', '/api/stores/switch-hq', {
    targetStoreId: 'loc-nonexistent-999'
  }, owner.token);
  const hq3Pass = invalidStoreHqRes.status === 404;
  console.log(`- Invalid store switch attempt: HTTP ${invalidStoreHqRes.status} (${invalidStoreHqRes.data?.error || ''})`);
  console.log(`- Assertion HQ-3: ${hq3Pass ? 'PASSED (HTTP 404 Not Found)' : 'FAILED'}`);

  // Test HQ-4: Owner switches HQ to BEYONDSISOWAT (loc-zprdw9b)
  console.log('\nHQ-4: Owner switches HQ to BEYONDSISOWAT (loc-zprdw9b)...');
  const switchHqRes = await request(POS_BASE, 'POST', '/api/stores/switch-hq', {
    targetStoreId: 'loc-zprdw9b'
  }, owner.token);
  const hq4Pass = switchHqRes.status === 200 && switchHqRes.data.newHq?.id === 'loc-zprdw9b';
  console.log(`- Switch result: ${switchHqRes.status === 200 ? 'SUCCESS: ' + switchHqRes.data.message : 'FAILED'}`);
  console.log(`- Assertion HQ-4: ${hq4Pass ? 'PASSED' : 'FAILED'}`);

  // Test HQ-5: Verify atomic single HQ designation in database & settings
  console.log('\nHQ-5: Verifying atomic single active HQ via Stock API...');
  const stockHqCheck = await request(STOCK_BASE, 'GET', '/api/stores/hq', null, owner.token);
  const activeHqList = stockHqCheck.data.branches?.filter(b => b.is_hq === 1 || b.is_default === 1) || [];
  const hq5Pass = stockHqCheck.data.currentHq?.id === 'loc-zprdw9b' && activeHqList.length === 1;
  console.log(`- Stock API Current HQ: ${stockHqCheck.data.currentHq?.name} (${stockHqCheck.data.currentHq?.id})`);
  console.log(`- Active HQ Count: ${activeHqList.length} (must be exactly 1)`);
  console.log(`- Assertion HQ-5: ${hq5Pass ? 'PASSED (Atomic single HQ verified across microservices)' : 'FAILED'}`);

  // Test HQ-6: Switch HQ back to Main Branch (loc-01)
  console.log('\nHQ-6: Switching HQ back to Main Branch (loc-01)...');
  const switchBackRes = await request(POS_BASE, 'POST', '/api/stores/switch-hq', {
    targetStoreId: 'loc-01'
  }, owner.token);
  const hq6Pass = switchBackRes.status === 200 && switchBackRes.data.newHq?.id === 'loc-01';
  console.log(`- Switch back result: ${switchBackRes.data.message}`);
  console.log(`- Assertion HQ-6: ${hq6Pass ? 'PASSED' : 'FAILED'}`);

  // Test HQ-7: HQ Audit trail contains history
  console.log('\nHQ-7: Checking HQ audit trail...');
  const hqAuditCheck = await request(POS_BASE, 'GET', '/api/stores/hq', null, owner.token);
  const hq7Pass = hqAuditCheck.data.history?.length >= 2;
  console.log(`- Recorded HQ changes in audit log: ${hqAuditCheck.data.history?.length}`);
  console.log(`- Latest change: ${hqAuditCheck.data.history?.[0]?.previous_hq_name} -> ${hqAuditCheck.data.history?.[0]?.new_hq_name}`);
  console.log(`- Assertion HQ-7: ${hq7Pass ? 'PASSED (Audit history permanently logged)' : 'FAILED'}`);

  // ===========================================================================
  // PART B: RESET STORE DATA ACCEPTANCE TESTS
  // ===========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('PART B: RESET STORE DATA ACCEPTANCE TESTS');
  console.log('----------------------------------------------------------------');

  // Test RST-1: Unauthorized user cannot execute reset
  console.log('RST-1: Testing unauthorized user attempt to reset store...');
  const unauthResetRes = await request(POS_BASE, 'POST', '/api/ecosystem/reset-store-data', {
    storeId: 'loc-zprdw9b',
    confirmationText: 'RESET STORE DATA',
    password: 'password123'
  }, staffPanha.token);
  const rst1Pass = unauthResetRes.status === 403;
  console.log(`- Panha reset attempt: HTTP ${unauthResetRes.status} (${unauthResetRes.data?.error || ''})`);
  console.log(`- Assertion RST-1: ${rst1Pass ? 'PASSED (HTTP 403 Forbidden)' : 'FAILED'}`);

  // Test RST-2: Incorrect confirmation text is rejected
  console.log('\nRST-2: Testing incorrect confirmation text...');
  const badConfirmRes = await request(POS_BASE, 'POST', '/api/ecosystem/reset-store-data', {
    storeId: 'loc-zprdw9b',
    confirmationText: 'wipe data please',
    password: 'password123'
  }, owner.token);
  const rst2Pass = badConfirmRes.status === 400;
  console.log(`- Bad confirmation text: HTTP ${badConfirmRes.status} (${badConfirmRes.data?.error || ''})`);
  console.log(`- Assertion RST-2: ${rst2Pass ? 'PASSED (Exact string matching enforced)' : 'FAILED'}`);

  // Test RST-3: Incorrect password fails re-authentication
  console.log('\nRST-3: Testing incorrect password re-authentication...');
  const badPassRes = await request(POS_BASE, 'POST', '/api/ecosystem/reset-store-data', {
    storeId: 'loc-zprdw9b',
    confirmationText: 'RESET STORE DATA',
    password: 'wrong_password_xyz'
  }, owner.token);
  const rst3Pass = badPassRes.status === 401;
  console.log(`- Bad password: HTTP ${badPassRes.status} (${badPassRes.data?.error || ''})`);
  console.log(`- Assertion RST-3: ${rst3Pass ? 'PASSED (HTTP 401 Re-authentication required)' : 'FAILED'}`);

  // Setup sample operational records for SSW store (loc-zprdw9b)
  console.log('\nRST-Setup: Seeding sample shift for SSW store to test reset...');
  const sampleShift = await request(POS_BASE, 'POST', '/api/shifts/open', {
    storeId: 'loc-zprdw9b',
    cashierUserId: staffPanha.user.id,
    openingFloatUsd: 75.00,
    openingNotes: 'SSW pre-reset shift'
  }, staffPanha.token);
  console.log(`- Sample SSW Shift created: ${sampleShift.data.shift?.id || 'FAILED'}`);

  // Test RST-4: Execute valid Reset on SSW Store (loc-zprdw9b)
  console.log('\nRST-4: Executing valid Reset Store Data on BEYONDSISOWAT (loc-zprdw9b)...');
  const validResetRes = await request(POS_BASE, 'POST', '/api/ecosystem/reset-store-data', {
    storeId: 'loc-zprdw9b',
    confirmationText: 'RESET STORE DATA',
    password: 'password123'
  }, owner.token);
  const rst4Pass = validResetRes.status === 200 && validResetRes.data.ok === true;
  console.log(`- Reset execution: HTTP ${validResetRes.status} (${validResetRes.data?.message || ''})`);
  console.log(`- Backup file created: ${validResetRes.data?.backupFile}`);
  console.log(`- Records cleared: ${validResetRes.data?.recordsCleared}`);
  console.log(`- Assertion RST-4: ${rst4Pass ? 'PASSED' : 'FAILED'}`);

  // Test RST-5: Verify SSW Store starts fresh with 0 open shifts
  console.log('\nRST-5: Verifying SSW store starts fresh with no active shifts...');
  const sswShiftCheck = await request(POS_BASE, 'GET', `/api/shifts/current?storeId=loc-zprdw9b&cashierId=${staffPanha.user.id}`, null, staffPanha.token);
  const rst5Pass = sswShiftCheck.data.hasActiveShift === false;
  console.log(`- SSW Active Shift: ${sswShiftCheck.data.hasActiveShift ? 'STILL OPEN (BUG)' : 'FRESH STATE (NO ACTIVE SHIFT)'}`);
  console.log(`- Assertion RST-5: ${rst5Pass ? 'PASSED (Fresh operational state)' : 'FAILED'}`);

  // Test RST-6: Verify Main Store (loc-01) is UNTOUCHED (Store Isolation)
  console.log('\nRST-6: Verifying Main Store (loc-01) data remains intact (Store Isolation)...');
  const mainStoreCatalog = await request(POS_BASE, 'GET', '/api/catalog?storeId=loc-01', null, owner.token);
  const rst6Pass = mainStoreCatalog.status === 200 && mainStoreCatalog.data.products?.length > 0;
  console.log(`- Main Store Catalog Products: ${mainStoreCatalog.data.products?.length} products active`);
  console.log(`- Assertion RST-6: ${rst6Pass ? 'PASSED (Store Isolation preserved)' : 'FAILED'}`);

  // Test RST-7: Verify Store Owner can still log in with existing credentials
  console.log('\nRST-7: Verifying Owner and staff can log in with same credentials...');
  const postResetOwnerLogin = await loginUser('neng@gmail.com', 'password123');
  const postResetStaffLogin = await loginUser('panha@gmial.com', 'password123');
  const rst7Pass = postResetOwnerLogin.user.id === owner.user.id && postResetStaffLogin.user.id === staffPanha.user.id;
  console.log(`- Owner Relogin: SUCCESS (${postResetOwnerLogin.user.email})`);
  console.log(`- Staff Relogin: SUCCESS (${postResetStaffLogin.user.email})`);
  console.log(`- Assertion RST-7: ${rst7Pass ? 'PASSED (Credentials and accounts 100% intact)' : 'FAILED'}`);

  // Test RST-8: Reset History Log is queryable
  console.log('\nRST-8: Querying Reset Audit History API...');
  const historyRes = await request(POS_BASE, 'GET', '/api/ecosystem/reset-store-data/history', null, owner.token);
  const rst8Pass = historyRes.status === 200 && historyRes.data.history?.length > 0;
  console.log(`- Reset Audit Records: ${historyRes.data.history?.length}`);
  console.log(`- Latest Audit: Store "${historyRes.data.history?.[0]?.store_name}", Cleared: ${historyRes.data.history?.[0]?.records_cleared_count} records`);
  console.log(`- Assertion RST-8: ${rst8Pass ? 'PASSED (Permanent audit history available)' : 'FAILED'}`);

  console.log('\n================================================================');
  console.log('ALL ACCEPTANCE TESTS (HQ & RESET STORE DATA) COMPLETED!');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});

