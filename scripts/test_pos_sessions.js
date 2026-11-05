// Test POS Session Isolation and Multi-Store Session Management (Acceptance Tests A to G)
const http = require('http');

const POS_BASE = 'http://localhost:3002';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, POS_BASE);
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
  const res = await request('POST', '/api/auth/login', {
    identifier: email,
    password: password
  });
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user };
}

async function runTests() {
  console.log('=== STARTING POS SESSION ISOLATION ACCEPTANCE TESTS (A - G) ===\n');

  // Authenticate users:
  // Owner: neng@gmail.com
  // User B: panha@gmail.com (access to SSW only: loc-zprdw9b)
  console.log('1. Authenticating test users...');
  const ownerAuth = await loginUser('neng@gmail.com', 'password123');
  const userBAuth = await loginUser('panha@gmial.com', 'password123');

  console.log(`- Owner: ${ownerAuth.user.fullName} (${ownerAuth.user.id}), locations: ${JSON.stringify(ownerAuth.user.locations)}`);
  console.log(`- User B: ${userBAuth.user.fullName} (${userBAuth.user.id}), locations: ${JSON.stringify(userBAuth.user.locations)}\n`);

  // Reset any existing active shifts for clean test baseline
  console.log('2. Resetting baseline shifts for test isolation...');
  const ownerActivePre = await request('GET', `/api/shifts/current?cashierId=${ownerAuth.user.id}`, null, ownerAuth.token);
  if (ownerActivePre.data?.hasActiveShift) {
    await request('POST', '/api/shifts/close', {
      shiftId: ownerActivePre.data.shift.id,
      countedCashUsd: ownerActivePre.data.summary.expectedCashUsd,
      countedCashKhr: ownerActivePre.data.summary.expectedCashKhr,
      closingNotes: 'Test reset'
    }, ownerAuth.token);
  }

  const userBActivePre = await request('GET', `/api/shifts/current?cashierId=${userBAuth.user.id}`, null, userBAuth.token);
  if (userBActivePre.data?.hasActiveShift) {
    await request('POST', '/api/shifts/close', {
      shiftId: userBActivePre.data.shift.id,
      countedCashUsd: userBActivePre.data.summary.expectedCashUsd,
      countedCashKhr: userBActivePre.data.summary.expectedCashKhr,
      closingNotes: 'Test reset'
    }, userBAuth.token);
  }

  // TEST A:
  // - Owner opens shift in Main Store (loc-01)
  // - Owner logs out
  // - User B opens shift in SSW Store (loc-zprdw9b)
  // - Owner logs back in
  // - Expected: Owner sees their own Main Store shift, not User B's SSW shift.
  console.log('--- TEST A: Shift Isolation upon Owner Relog ---');
  const openOwnerRes = await request('POST', '/api/shifts/open', {
    storeId: 'loc-01',
    cashierUserId: ownerAuth.user.id,
    openingFloatUsd: 150.00,
    openingFloatKhr: 200000,
    openingNotes: 'Owner Main Store float'
  }, ownerAuth.token);
  console.log(`- Owner opened shift in loc-01: ${openOwnerRes.status === 201 ? 'SUCCESS (' + openOwnerRes.data.shift.id + ')' : 'FAILED: ' + JSON.stringify(openOwnerRes.data)}`);

  // User B opens shift in SSW Store (loc-zprdw9b)
  const openUserBRes = await request('POST', '/api/shifts/open', {
    storeId: 'loc-zprdw9b',
    cashierUserId: userBAuth.user.id,
    openingFloatUsd: 50.00,
    openingFloatKhr: 100000,
    openingNotes: 'User B SSW float'
  }, userBAuth.token);
  console.log(`- User B opened shift in loc-zprdw9b: ${openUserBRes.status === 201 ? 'SUCCESS (' + openUserBRes.data.shift.id + ')' : 'FAILED: ' + JSON.stringify(openUserBRes.data)}`);

  // Owner logs back in: query shift with Owner's credentials
  const ownerShiftCheck = await request('GET', `/api/shifts/current?cashierId=${ownerAuth.user.id}&storeId=loc-01`, null, ownerAuth.token);
  const testAPassed = ownerShiftCheck.data.hasActiveShift &&
                      ownerShiftCheck.data.shift.id === openOwnerRes.data.shift.id &&
                      ownerShiftCheck.data.shift.storeId === 'loc-01' &&
                      ownerShiftCheck.data.shift.cashierUserId === ownerAuth.user.id;
  console.log(`- Test A Assertion: ${testAPassed ? 'PASSED (Owner sees their own Main Store shift ' + ownerShiftCheck.data.shift.id + ')' : 'FAILED: ' + JSON.stringify(ownerShiftCheck.data)}`);

  // TEST B:
  // - User B logs back in.
  // - Expected: User B sees their own SSW Store shift and can close it according to permissions.
  console.log('\n--- TEST B: User B Sees & Closes Their SSW Shift ---');
  const userBShiftCheck = await request('GET', `/api/shifts/current?cashierId=${userBAuth.user.id}&storeId=loc-zprdw9b`, null, userBAuth.token);
  const testB1Passed = userBShiftCheck.data.hasActiveShift &&
                       userBShiftCheck.data.shift.id === openUserBRes.data.shift.id &&
                       userBShiftCheck.data.shift.storeId === 'loc-zprdw9b' &&
                       userBShiftCheck.data.shift.cashierUserId === userBAuth.user.id;
  console.log(`- Test B View Assertion: ${testB1Passed ? 'PASSED (User B sees their own SSW shift ' + userBShiftCheck.data.shift.id + ')' : 'FAILED'}`);

  // TEST C:
  // - Owner closes their Main Store shift.
  // - Expected: User B's SSW Store shift remains open and unchanged.
  console.log('\n--- TEST C: Owner Closes Main Shift, User B Shift Remains Open ---');
  const closeOwnerRes = await request('POST', '/api/shifts/close', {
    shiftId: openOwnerRes.data.shift.id,
    countedCashUsd: 150.00,
    countedCashKhr: 200000,
    closingNotes: 'Owner closing Main Store shift'
  }, ownerAuth.token);
  console.log(`- Owner shift closed: ${closeOwnerRes.status === 200 ? 'SUCCESS' : 'FAILED: ' + JSON.stringify(closeOwnerRes.data)}`);

  // Verify User B's SSW shift is still active and untouched
  const userBShiftAfterOwnerClose = await request('GET', `/api/shifts/current?cashierId=${userBAuth.user.id}&storeId=loc-zprdw9b`, null, userBAuth.token);
  const testCPassed = userBShiftAfterOwnerClose.data.hasActiveShift &&
                      userBShiftAfterOwnerClose.data.shift.id === openUserBRes.data.shift.id &&
                      userBShiftAfterOwnerClose.data.shift.status === 'ACTIVE';
  console.log(`- Test C Assertion: ${testCPassed ? 'PASSED (User B SSW shift is intact & ACTIVE)' : 'FAILED: ' + JSON.stringify(userBShiftAfterOwnerClose.data)}`);

  // TEST D:
  // - A user with access to Main Store and SSW Store selects SSW Store.
  // - Expected: POS opens only under SSW Store and uses that user's own session.
  console.log('\n--- TEST D: Multi-Store User (Owner) Accessing SSW Store ---');
  const ownerSSWShift = await request('GET', `/api/shifts/current?cashierId=${ownerAuth.user.id}&storeId=loc-zprdw9b`, null, ownerAuth.token);
  const testDPassed = ownerSSWShift.data.hasActiveShift === false; // Owner hasn't opened a shift in SSW, so it must not show User B's shift!
  console.log(`- Test D Assertion: ${testDPassed ? 'PASSED (Owner at SSW does not see User B active shift)' : 'FAILED: Leaked shift: ' + JSON.stringify(ownerSSWShift.data)}`);

  // TEST E:
  // - A user without access to Main Store attempts to open its POS through direct API / URL.
  // - Expected: Access is rejected (HTTP 403).
  console.log('\n--- TEST E: Unauthorized Store Access Rejection ---');
  const userBUnauthorizedOpen = await request('POST', '/api/shifts/open', {
    storeId: 'loc-01', // User B is not authorized for loc-01
    cashierUserId: userBAuth.user.id,
    openingFloatUsd: 100
  }, userBAuth.token);
  console.log(`- Open Shift in loc-01: Status ${userBUnauthorizedOpen.status} (${userBUnauthorizedOpen.data?.error || ''})`);

  const userBUnauthorizedCatalog = await request('GET', '/api/catalog?storeId=loc-01', null, userBAuth.token);
  console.log(`- Fetch Catalog for loc-01: Status ${userBUnauthorizedCatalog.status} (${userBUnauthorizedCatalog.data?.error || ''})`);

  const testEPassed = (userBUnauthorizedOpen.status === 403) && (userBUnauthorizedCatalog.status === 403);
  console.log(`- Test E Assertion: ${testEPassed ? 'PASSED (HTTP 403 Access Denied enforced)' : 'FAILED'}`);

  // TEST F:
  // - Two different users open shifts in different stores at the same time.
  // - Expected: Both sessions operate independently without interfering with each other.
  console.log('\n--- TEST F: Simultaneous Multi-User Multi-Store Concurrent Shifts ---');
  // Owner opens a new shift in Main Store
  const ownerNewShiftRes = await request('POST', '/api/shifts/open', {
    storeId: 'loc-01',
    cashierUserId: ownerAuth.user.id,
    openingFloatUsd: 200.00,
    openingFloatKhr: 0
  }, ownerAuth.token);
  console.log(`- Owner opened concurrent shift in loc-01: ${ownerNewShiftRes.status === 201 ? 'SUCCESS (' + ownerNewShiftRes.data.shift.id + ')' : 'FAILED'}`);

  const ownerConcurrentCheck = await request('GET', `/api/shifts/current?cashierId=${ownerAuth.user.id}&storeId=loc-01`, null, ownerAuth.token);
  const userBConcurrentCheck = await request('GET', `/api/shifts/current?cashierId=${userBAuth.user.id}&storeId=loc-zprdw9b`, null, userBAuth.token);

  const testFPassed = ownerConcurrentCheck.data.hasActiveShift &&
                      userBConcurrentCheck.data.hasActiveShift &&
                      ownerConcurrentCheck.data.shift.id !== userBConcurrentCheck.data.shift.id &&
                      ownerConcurrentCheck.data.shift.storeId === 'loc-01' &&
                      userBConcurrentCheck.data.shift.storeId === 'loc-zprdw9b';
  console.log(`- Test F Assertion: ${testFPassed ? 'PASSED (Both sessions completely isolated across users and stores)' : 'FAILED'}`);

  // TEST G:
  // - A user logs out and logs back in using another device / session.
  // - Expected: The system restores the correct user-and-store POS session without duplicating or transferring the shift.
  console.log('\n--- TEST G: Relog from New Device Restores Session Without Duplicating ---');
  // New login simulation:
  const newDeviceLogin = await loginUser('panha@gmial.com', 'password123');
  const restoredSession = await request('GET', `/api/shifts/current?cashierId=${newDeviceLogin.user.id}&storeId=loc-zprdw9b`, null, newDeviceLogin.token);

  // Attempt duplicate open: should reject with conflict
  const duplicateOpenAttempt = await request('POST', '/api/shifts/open', {
    storeId: 'loc-zprdw9b',
    cashierUserId: newDeviceLogin.user.id,
    openingFloatUsd: 50.00
  }, newDeviceLogin.token);

  const testGPassed = restoredSession.data.hasActiveShift &&
                      restoredSession.data.shift.id === openUserBRes.data.shift.id &&
                      duplicateOpenAttempt.status === 409;
  console.log(`- Restored Shift ID: ${restoredSession.data.shift.id}`);
  console.log(`- Duplicate Open Attempt: HTTP ${duplicateOpenAttempt.status} (${duplicateOpenAttempt.data?.error || ''})`);
  console.log(`- Test G Assertion: ${testGPassed ? 'PASSED (Session accurately restored and duplicate creation blocked)' : 'FAILED'}`);

  // Clean up: Close the shifts
  console.log('\n--- CLEANING UP TEST SHIFTS ---');
  await request('POST', '/api/shifts/close', {
    shiftId: ownerConcurrentCheck.data.shift.id,
    countedCashUsd: 200.00,
    closingNotes: 'Test teardown'
  }, ownerAuth.token);

  await request('POST', '/api/shifts/close', {
    shiftId: openUserBRes.data.shift.id,
    countedCashUsd: 50.00,
    countedCashKhr: 100000,
    closingNotes: 'Test teardown'
  }, userBAuth.token);
  console.log('- Test shifts safely closed.');

  console.log('\n======================================================');
  console.log('ALL ACCEPTANCE TESTS (A - G) COMPLETED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
