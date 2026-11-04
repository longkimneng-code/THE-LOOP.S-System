// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — SECURITY & ARCHITECTURE TEST SUITE
// Automated verification for Section 14 (Testing & Acceptance Criteria)
// Tests: RFC 7519/8725 JWT, Refresh Rotation, RBAC, Store Scoping, Headers, Rate Limits, Outbox
// ============================================================================

const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const { signToken, verifyToken, decodeToken } = require('../shared/security/jwt');
const { generateTokenPair, rotateRefreshToken, revokeSession } = require('../shared/security/tokenService');
const { checkRole, checkStoreScope, checkRateLimit } = require('../shared/security/middleware');
const { publishIntegrationEvent, processPendingEvents } = require('../shared/database/eventBus');
const { processOutboxBatch } = require('../shared/database/outboxWorker');
const { getDatabase } = require('../shared/database/connection');

let passedTests = 0;
let failedTests = 0;

function logHeader(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70) + '\n');
}

async function runTest(category, testName, testFn) {
  process.stdout.write(`[TEST] ${category} -> ${testName}... `);
  try {
    await testFn();
    console.log('\x1b[32m✔ PASS\x1b[0m');
    passedTests++;
  } catch (err) {
    console.log(`\x1b[31m✘ FAIL: ${err.message}\x1b[0m`);
    failedTests++;
  }
}

async function requestHttp(port, path, options = {}) {
  return new Promise((resolve) => {
    const payload = options.body ? JSON.stringify(options.body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      },
      timeout: 3000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });

    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function runAllTests() {
  logHeader('COMMENCING SECURITY & ARCHITECTURAL ACCEPTANCE VERIFICATION');

  // ========================================================================
  // SUITE 1: RFC 7519 & RFC 8725 JWT CRYPTOGRAPHIC INTEGRITY
  // ========================================================================
  logHeader('SUITE 1: RFC 7519 / RFC 8725 JWT SECURITY');

  await runTest('JWT Crypto', 'Sign & Verify Valid Access Token', async () => {
    const payload = {
      sub: 'usr-test-101',
      org: 'org-audit-test',
      role: 'STORE_MANAGER',
      storeId: 'store-wh-01'
    };

    const token = signToken(payload, { expiresInSeconds: 60 });
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(token.split('.').length, 3);

    const verified = verifyToken(token);
    assert.strictEqual(verified.sub, 'usr-test-101');
    assert.strictEqual(verified.org, 'org-audit-test');
    assert.strictEqual(verified.role, 'STORE_MANAGER');
    assert.strictEqual(verified.iss, 'https://auth.theloops.io');
    assert.strictEqual(verified.aud, 'theloops-api');
    assert.ok(verified.exp > Math.floor(Date.now() / 1000));
  });

  await runTest('JWT Crypto', 'Reject Tampered Token Signature', async () => {
    const token = signToken({ sub: 'usr-tamper' });
    const parts = token.split('.');
    // Tamper payload
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'hacker', role: 'SUPER_ADMIN' })).toString('base64');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    assert.throws(() => {
      verifyToken(tamperedToken);
    }, /Invalid token signature/);
  });

  await runTest('JWT Crypto', 'Reject "alg: none" Exploit Attack', async () => {
    const headerNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({ sub: 'hacker' })).toString('base64');
    const noneToken = `${headerNone}.${payload}.`;

    assert.throws(() => {
      verifyToken(noneToken);
    }, /Algorithm 'none' is not in the allowed algorithms list/);
  });

  await runTest('JWT Crypto', 'Reject Expired Access Token', async () => {
    // Generate token expired 10 seconds ago
    const expiredToken = signToken({ sub: 'usr-old' }, { expiresInSeconds: -10 });
    assert.throws(() => {
      verifyToken(expiredToken, { clockToleranceSeconds: 0 });
    }, /Token has expired/);
  });

  // ========================================================================
  // SUITE 2: REFRESH TOKEN LIFECYCLE & ROTATION
  // ========================================================================
  logHeader('SUITE 2: DUAL-TOKEN LIFECYCLE & REUSE DETECTION');

  let testUser = {
    id: `usr-sec-test-${Date.now()}`,
    email: 'sec-tester@theloops.test',
    fullName: 'Security Tester',
    role: 'ACCOUNTANT',
    organizationId: 'org-sec-01'
  };

  // Seed into SQLite for session foreign key
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO organizations (id, name, owner_name, owner_email, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(testUser.organizationId, 'Security Org', 'Sec Tester', testUser.email, now, now);

  db.prepare(`
    INSERT OR REPLACE INTO users (id, organization_id, email, full_name, role, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, 'hash', ?)
  `).run(testUser.id, testUser.organizationId, testUser.email, testUser.fullName, testUser.role, now);

  let activeTokens = null;

  await runTest('Token Lifecycle', 'Issue Dual Token Pair (Access JWT + Refresh Opaque)', async () => {
    activeTokens = generateTokenPair(testUser, testUser.organizationId);
    assert.ok(activeTokens.accessToken);
    assert.ok(activeTokens.refreshToken);
    assert.strictEqual(activeTokens.accessToken.split('.').length, 3);
    assert.ok(activeTokens.refreshToken.startsWith('loops_ref_'));
    assert.strictEqual(activeTokens.expiresIn, 30 * 24 * 3600); // 30 days durable POS session
  });

  let rotatedTokens = null;

  await runTest('Token Lifecycle', 'Rotate Refresh Token Successfully', async () => {
    rotatedTokens = rotateRefreshToken(activeTokens.refreshToken);
    assert.ok(rotatedTokens.accessToken);
    assert.ok(rotatedTokens.refreshToken);
    assert.notStrictEqual(rotatedTokens.refreshToken, activeTokens.refreshToken);

    // Verify new access token has valid claims
    const verified = verifyToken(rotatedTokens.accessToken);
    assert.strictEqual(verified.sub, testUser.id);
  });

  await runTest('Token Lifecycle', 'Detect Refresh Token Reuse and Invalidate All Sessions', async () => {
    // Attempt to reuse old rotated refresh token
    assert.throws(() => {
      rotateRefreshToken(activeTokens.refreshToken);
    }, /Refresh token reuse detected/);

    // Verify subsequent rotation with the new token is also now revoked
    assert.throws(() => {
      rotateRefreshToken(rotatedTokens.refreshToken);
    }, /Security Breach Alert|Invalid or non-existent/);
  });

  // ========================================================================
  // SUITE 3: RBAC & MULTI-STORE SCOPE ENFORCEMENT
  // ========================================================================
  logHeader('SUITE 3: RBAC & MULTI-STORE SCOPING');

  await runTest('RBAC', 'Allow Authorized Roles', async () => {
    const context = { isAuthenticated: true, role: 'FINANCE_ADMIN' };
    assert.strictEqual(checkRole(context, ['FINANCE_ADMIN', 'ACCOUNTANT'], 'Post Journal'), true);
  });

  await runTest('RBAC', 'Block Unauthorized Role with Deny-by-Default', async () => {
    const context = { isAuthenticated: true, role: 'CASHIER' };
    assert.throws(() => {
      checkRole(context, ['FINANCE_ADMIN', 'ACCOUNTANT'], 'Post Journal');
    }, /Forbidden: Role "CASHIER" is not authorized/);
  });

  await runTest('Multi-Store Scope', 'Allow Assigned Store Access', async () => {
    const context = { isAuthenticated: true, role: 'CASHIER', storeId: 'store-downtown' };
    assert.strictEqual(checkStoreScope(context, 'store-downtown', 'Checkout Order'), true);
  });

  await runTest('Multi-Store Scope', 'Block Cross-Store Access (Store A Cashier accessing Store B)', async () => {
    const context = { isAuthenticated: true, role: 'CASHIER', storeId: 'store-downtown' };
    assert.throws(() => {
      checkStoreScope(context, 'store-airport', 'View Orders');
    }, /Access Denied: You are assigned to store "store-downtown" and cannot perform "View Orders" on store "store-airport"/);
  });

  await runTest('Multi-Store Scope', 'Owner Bypasses Store Scoping across All Branches', async () => {
    const context = { isAuthenticated: true, role: 'OWNER', storeId: null };
    assert.strictEqual(checkStoreScope(context, 'store-airport', 'Administer Branch'), true);
  });

  // ========================================================================
  // SUITE 4: RATE LIMITING & SECURITY HEADERS
  // ========================================================================
  logHeader('SUITE 4: RATE LIMITING & SECURITY HEADERS');

  await runTest('Rate Limiter', 'Sliding Window Blocks Excessive Requests', async () => {
    const mockReq = { url: '/api/auth/login-stress-test', headers: {}, socket: { remoteAddress: '10.0.0.99' } };
    const mockRes = {
      setHeader: () => {},
      getHeader: () => null,
      writeHead: () => {},
      end: () => {}
    };

    // First 5 requests pass
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(checkRateLimit(mockReq, mockRes, 5, 10000), true);
    }
    // 6th request is blocked
    assert.strictEqual(checkRateLimit(mockReq, mockRes, 5, 10000), false);
  });

  // ========================================================================
  // SUITE 5: TRANSACTIONAL OUTBOX / INBOX RELIABILITY
  // ========================================================================
  logHeader('SUITE 5: TRANSACTIONAL OUTBOX & DEDUPLICATION');

  const testEventKey = `key-test-${Date.now()}`;

  await runTest('Outbox Event Bus', 'Publish Integration Event to Outbox', async () => {
    const event = publishIntegrationEvent({
      organizationId: testUser.organizationId,
      sourceApp: 'POS',
      sourceId: 'ord-1234',
      destApp: 'FINANCE',
      eventType: 'SALE_COMPLETED',
      idempotencyKey: testEventKey,
      payload: { receiptNumber: 'REC-1234', totalMinor: 4500 }
    });

    assert.ok(event.id);
    assert.strictEqual(event.idempotencyKey, testEventKey);
  });

  await runTest('Outbox Event Bus', 'Idempotency Key Prevents Duplicate Event Insertion', async () => {
    const duplicate = publishIntegrationEvent({
      organizationId: testUser.organizationId,
      sourceApp: 'POS',
      sourceId: 'ord-1234',
      destApp: 'FINANCE',
      eventType: 'SALE_COMPLETED',
      idempotencyKey: testEventKey, // Identical key!
      payload: { receiptNumber: 'REC-1234', totalMinor: 4500 }
    });

    // Check count in database is strictly 1
    const rowCount = db.prepare('SELECT COUNT(*) as count FROM integration_events WHERE idempotency_key = ?').get(testEventKey);
    assert.strictEqual(rowCount.count, 1, 'Duplicate event must be discarded by ON CONFLICT(idempotency_key)');
  });

  // ========================================================================
  // SUITE 6: LIVE BACKEND API INTEGRATION & HEALTH
  // ========================================================================
  logHeader('SUITE 6: LIVE MICROSERVICES HEALTH & HEADERS');

  await runTest('Live Gateway', 'Gateway /api/health with Security Headers', async () => {
    const res = await requestHttp(5000, '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.ok(res.headers['x-request-id'], 'Expected x-request-id in response');
    assert.strictEqual(res.data.status, 'HEALTHY');
  });

  await runTest('Live POS API', 'POS /api/health with Security Headers', async () => {
    const res = await requestHttp(3002, '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.headers['x-request-id']);
  });

  await runTest('Live POS Auth', 'Login returns RFC 7519 JWT & Refresh Tokens', async () => {
    let res = await requestHttp(3002, '/api/auth/login', {
      method: 'POST',
      body: { pin: '9999' }
    });
    if (res.status === 401) {
      res = await requestHttp(3002, '/api/auth/login', {
        method: 'POST',
        body: { pin: '7531' }
      });
    }

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
    assert.ok(res.data.token, 'Expected token for backward compatibility');
    assert.ok(res.data.accessToken, 'Expected accessToken');
    assert.ok(res.data.refreshToken, 'Expected refreshToken');
    assert.strictEqual(res.data.accessToken.split('.').length, 3);
  });

  await runTest('Live POS Auth', 'Token Refresh Endpoint Rotates Tokens', async () => {
    let loginRes = await requestHttp(3002, '/api/auth/login', {
      method: 'POST',
      body: { pin: '9999' }
    });
    if (loginRes.status === 401) {
      loginRes = await requestHttp(3002, '/api/auth/login', {
        method: 'POST',
        body: { pin: '7531' }
      });
    }
    const oldRefresh = loginRes.data.refreshToken;

    const refreshRes = await requestHttp(3002, '/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken: oldRefresh }
    });

    assert.strictEqual(refreshRes.status, 200);
    assert.strictEqual(refreshRes.data.ok, true);
    assert.ok(refreshRes.data.accessToken);
    assert.ok(refreshRes.data.refreshToken);
    assert.notStrictEqual(refreshRes.data.refreshToken, oldRefresh);
  });

  // Cleanup test user
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(testUser.id);
    db.prepare('DELETE FROM integration_events WHERE idempotency_key = ?').run(testEventKey);
  } catch (e) {}

  logHeader('TEST EXECUTION SUMMARY');
  console.log(`Total Tests Run : ${passedTests + failedTests}`);
  console.log(`Passed          : ${passedTests}`);
  console.log(`Failed          : ${failedTests}`);
  console.log(`Pass Rate       : ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
