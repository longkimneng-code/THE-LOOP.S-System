/**
 * Automated Verification: The Loops Universal Retail Suite Unified Architecture
 */

const assert = require('assert');

async function runTests() {
  console.log('\n======================================================');
  console.log('  TESTING UNIFIED RETAIL ARCHITECTURE & API GATEWAY');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`\x1b[32m✔ [PASS]\x1b[0m ${name}`);
      passed++;
    } catch (err) {
      console.error(`\x1b[31m✖ [FAIL]\x1b[0m ${name}:`, err.message);
    }
  }

  // 1. Gateway Health Check
  await test('1. Gateway Aggregated Health Check (/api/health)', async () => {
    const res = await fetch('http://localhost:5000/api/health');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.status, 'HEALTHY');
    assert.strictEqual(data.services.pos.online, true, 'POS microservice offline');
    assert.strictEqual(data.services.stock.online, true, 'Stock microservice offline');
    assert.strictEqual(data.services.finance.online, true, 'Finance microservice offline');
  });

  // 2. Gateway Proxy to Stock Microservice (Port 3000)
  await test('2. Gateway Proxy /api/stock/products -> Stock :3000', async () => {
    const res = await fetch('http://localhost:5000/api/stock/products');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.products || data), 'Stock products should be an array');
  });

  // 3. Gateway Proxy to Finance Microservice (Port 3001)
  await test('3. Gateway Proxy /api/finance/business -> Finance :3001', async () => {
    const res = await fetch('http://localhost:5000/api/finance/business');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.business, 'Expected data.business to exist');
  });

  // 4. Gateway Proxy to POS Microservice (Port 3002)
  await test('4. Gateway Proxy /api/pos/status -> POS :3002', async () => {
    const res = await fetch('http://localhost:5000/api/pos/status');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.pos.online, true);
  });

  // 5. Gateway Proxy to POS Authentication (/api/auth/login with Owner PIN)
  let ownerToken = null;
  await test('5. Authenticate via Gateway as OWNER (PIN 9999 / 7531)', async () => {
    let res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '9999', app: 'POS' })
    });
    if (res.status === 401) {
      res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '7531', app: 'POS' })
      });
    }
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.user.role, 'OWNER');
    assert.ok(data.token);
    ownerToken = data.token;
  });

  // 6. Gateway Proxy to POS PIN Authentication endpoint (/api/auth/pin)
  await test('6. Authenticate via Gateway with /api/auth/pin', async () => {
    let res = await fetch('http://localhost:5000/api/auth/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '9999', app: 'POS' })
    });
    if (res.status === 401) {
      res = await fetch('http://localhost:5000/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '7531', app: 'POS' })
      });
    }
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.user.role, 'OWNER');
    assert.ok(data.token);
  });

  // 7. Verify /api/auth/me session with Owner token
  await test('7. Validate Owner Session Token (/api/auth/me)', async () => {
    const res = await fetch('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.user.role, 'OWNER');
    assert.strictEqual(data.user.appAccess.pos, true);
  });

  // 8. Gateway Proxy to Frontend Web Portal
  await test('8. Gateway Proxy Root / -> Unified Frontend :5175', async () => {
    const res = await fetch('http://localhost:5000/');
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('<div id="root"></div>') || html.includes('<!DOCTYPE html>'));
  });

  console.log('\n------------------------------------------------------');
  console.log(`  SUMMARY: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('======================================================\n');
}

runTests();
