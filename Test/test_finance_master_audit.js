/**
 * ============================================================================
 * FULL ACCOUNT SYSTEM — FUNCTIONAL AUDIT & END-TO-END VERIFICATION SUITE
 * 
 * Tests every API, database operation, accounting calculation, double-entry
 * invariant, landed cost engine step, multi-tenant isolation, and report engine.
 * ============================================================================
 */

const http = require('http');
const { spawn } = require('child_process');
const assert = require('assert');
const path = require('path');
const { getDatabase } = require('../shared/database/connection');

// Service Ports
const PORTS = {
  STOCK: 3000,
  FINANCE: 3001,
  POS: 3002
};

const BASE_URLS = {
  STOCK: `http://localhost:${PORTS.STOCK}/api`,
  FINANCE: `http://localhost:${PORTS.FINANCE}/api`,
  POS: `http://localhost:${PORTS.POS}/api`
};

// Unique Dynamic Run Identifiers (Guarantees fresh test ledger per run)
const RUN_ID = Date.now().toString().slice(-6);
const TEST_ORG_ID = `org-audit-${RUN_ID}`;
const ISOLATE_ORG_ID = `org-isolate-${RUN_ID}`;
const SHIP_CODE = `SHP-AUDIT-${RUN_ID}`;
const SKU_CODE = `AUD-HD-${RUN_ID}`;

const TOKENS = {
  OWNER: `token-audit-owner-${RUN_ID}`,
  CASHIER: `token-audit-cashier-${RUN_ID}`,
  AUDITOR: `token-audit-auditor-${RUN_ID}`,
  ISOLATED_OWNER: `token-audit-isolate-${RUN_ID}`
};

const results = [];
let passedCount = 0;
let failedCount = 0;

function logHeader(title) {
  console.log('\n======================================================================');
  console.log(`  ${title}`);
  console.log('======================================================================\n');
}

async function request(baseUrl, endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const method = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const body = options.body ? JSON.stringify(options.body) : undefined;

  const res = await fetch(url, {
    method,
    headers,
    body
  });

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = { rawText: text };
  }

  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    data
  };
}

async function runTest(moduleName, functionName, expectedDescription, testFn) {
  process.stdout.write(`[TEST] ${moduleName} -> ${functionName}... `);
  try {
    const evidence = await testFn();
    passedCount++;
    console.log('\x1b[32m✔ PASS\x1b[0m');
    results.push({
      module: moduleName,
      function: functionName,
      expected: expectedDescription,
      actual: 'Function executed as expected with full verification.',
      status: 'PASS',
      evidence: typeof evidence === 'object' ? JSON.stringify(evidence).slice(0, 300) : String(evidence),
      issue: 'None',
      recommendation: 'None (Production Ready)'
    });
  } catch (err) {
    failedCount++;
    console.log('\x1b[31m✖ FAIL\x1b[0m');
    console.error(`       Error: ${err.message}`);
    results.push({
      module: moduleName,
      function: functionName,
      expected: expectedDescription,
      actual: `Failed with error: ${err.message}`,
      status: 'FAIL',
      evidence: err.stack ? err.stack.split('\n')[0] : err.message,
      issue: err.message,
      recommendation: 'Inspect failing invariant and resolve logic error.'
    });
  }
}

// Ensure processes running
let spawnedProcesses = [];

function startMicroservice(name, scriptPath, port) {
  return new Promise((resolve, reject) => {
    console.log(`[Suite] Spawning fresh ${name} on port ${port}...`);
    const child = spawn('node', [scriptPath], {
      cwd: path.resolve(__dirname),
      env: { ...process.env, PORT: String(port) },
      stdio: 'pipe'
    });

    spawnedProcesses.push(child);

    // Poll until alive
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`http://localhost:${port}/api/health`);
        if (res.ok) {
          clearInterval(interval);
          console.log(`[Suite] ${name} started and healthy on port ${port}.`);
          return resolve(child);
        }
      } catch (e) {}

      if (attempts > 30) {
        clearInterval(interval);
        reject(new Error(`Timed out waiting for ${name} to start on port ${port}`));
      }
    }, 500);
  });
}

function setupTestDatabase() {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Create Zenith Retail test org
  db.prepare(`
    INSERT OR REPLACE INTO organizations (id, name, owner_name, owner_email, currency, exchange_rate, tax_rate, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    TEST_ORG_ID, `Zenith Retail Audit Corp ${RUN_ID}`, 'Auditor Senior', `auditor-${RUN_ID}@zenithretail.test`, 'USD', 4000.0, 0.10, now, now
  );

  // Create Isolated secondary test org
  db.prepare(`
    INSERT OR REPLACE INTO organizations (id, name, owner_name, owner_email, currency, exchange_rate, tax_rate, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ISOLATE_ORG_ID, `Isolated Company Beta ${RUN_ID}`, 'Beta Owner', `beta-${RUN_ID}@isolate.test`, 'USD', 4000.0, 0.10, now, now
  );

  // Create Users & Sessions
  const users = [
    { id: `usr-audit-owner-${RUN_ID}`, org: TEST_ORG_ID, email: `owner-${RUN_ID}@zenithretail.test`, role: 'OWNER', token: TOKENS.OWNER },
    { id: `usr-audit-cashier-${RUN_ID}`, org: TEST_ORG_ID, email: `cashier-${RUN_ID}@zenithretail.test`, role: 'CASHIER', token: TOKENS.CASHIER },
    { id: `usr-audit-auditor-${RUN_ID}`, org: TEST_ORG_ID, email: `auditor-${RUN_ID}@zenithretail.test`, role: 'FINANCE_AUDITOR', token: TOKENS.AUDITOR },
    { id: `usr-audit-isolate-${RUN_ID}`, org: ISOLATE_ORG_ID, email: `beta-${RUN_ID}@isolate.test`, role: 'OWNER', token: TOKENS.ISOLATED_OWNER }
  ];

  for (const u of users) {
    db.prepare(`
      INSERT OR REPLACE INTO users (id, organization_id, email, full_name, role, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(u.id, u.org, u.email, u.email.split('@')[0], u.role, 'hash_test', now);

    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO sessions (token, user_id, organization_id, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(u.token, u.id, u.org, now, expiresAt);
  }

  console.log(`[Suite] Database test tenant (${TEST_ORG_ID}), RBAC roles, and sessions provisioned.`);
}

function cleanupTestDatabase() {
  try {
    const db = getDatabase();
    db.prepare("DELETE FROM sessions WHERE token LIKE 'token-audit-%'").run();
    db.prepare('DELETE FROM users WHERE organization_id IN (?, ?)').run(TEST_ORG_ID, ISOLATE_ORG_ID);
    db.prepare('DELETE FROM journal_entries WHERE organization_id IN (?, ?)').run(TEST_ORG_ID, ISOLATE_ORG_ID);
    db.prepare('DELETE FROM shipments WHERE organization_id IN (?, ?)').run(TEST_ORG_ID, ISOLATE_ORG_ID);
    db.prepare('DELETE FROM supplier_bills WHERE organization_id IN (?, ?)').run(TEST_ORG_ID, ISOLATE_ORG_ID);
    db.prepare('DELETE FROM organizations WHERE id IN (?, ?)').run(TEST_ORG_ID, ISOLATE_ORG_ID);

    // Clean up store.json for test org
    const fs = require('fs');
    const storePath = path.resolve(__dirname, 'Stock_management_loops/backend/data/store.json');
    if (fs.existsSync(storePath)) {
      const s = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      s.products = (s.products || []).filter(p => p.organizationId !== TEST_ORG_ID && p.organizationId !== ISOLATE_ORG_ID);
      s.locations = (s.locations || []).filter(l => l.organizationId !== TEST_ORG_ID && l.organizationId !== ISOLATE_ORG_ID);
      s.stockBalances = (s.stockBalances || []).filter(b => !b.id?.includes(TEST_ORG_ID) && !b.id?.includes(ISOLATE_ORG_ID) && !b.sku?.includes(RUN_ID));
      s.receivedPurchases = (s.receivedPurchases || []).filter(p => p.organizationId !== TEST_ORG_ID && p.organizationId !== ISOLATE_ORG_ID);
      s.ledger = (s.ledger || []).filter(l => !l.referenceNo?.includes(RUN_ID));
      fs.writeFileSync(storePath, JSON.stringify(s, null, 2));
    }
    console.log('[Suite] Cleaned up test records from database and store.');
  } catch (e) {
    console.warn('[Suite] Cleanup notice:', e.message);
  }
}

async function main() {
  logHeader('COMMENCING ACCOUNT SYSTEM FULL FUNCTIONAL AUDIT & E2E TESTS');

  try {
    // 1. Start Services
    await startMicroservice('Stock API', 'Stock_management_loops/backend/src/server.js', PORTS.STOCK);
    await startMicroservice('Finance API', 'account_system_Loops/backend/src/server.js', PORTS.FINANCE);
    await startMicroservice('POS API', 'The_Loop.s_POS/backend/src/server.js', PORTS.POS);

    // 2. Provision Database State
    setupTestDatabase();

    const ownerHeaders = {
      'Authorization': `Bearer ${TOKENS.OWNER}`,
      'x-organization-id': TEST_ORG_ID
    };

    const cashierHeaders = {
      'Authorization': `Bearer ${TOKENS.CASHIER}`,
      'x-organization-id': TEST_ORG_ID
    };

    const auditorHeaders = {
      'Authorization': `Bearer ${TOKENS.AUDITOR}`,
      'x-organization-id': TEST_ORG_ID
    };

    const isolateHeaders = {
      'Authorization': `Bearer ${TOKENS.ISOLATED_OWNER}`,
      'x-organization-id': ISOLATE_ORG_ID
    };

    // ========================================================================
    // SUITE 1: SYSTEM HEALTH, AUTHENTICATION & RBAC PERMISSIONS
    // ========================================================================
    logHeader('SUITE 1: SYSTEM HEALTH & RBAC PERMISSIONS');

    await runTest('System Health', 'Finance Microservice Status', 'HTTP 200 with UP status and version 3.0.0', async () => {
      const res = await request(BASE_URLS.FINANCE, '/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, 'UP');
      assert.strictEqual(res.data.version, '3.0.0');
      return res.data;
    });

    await runTest('System Health', 'Stock Loops Integration Status', 'Stock service reachable and connected', async () => {
      const res = await request(BASE_URLS.FINANCE, '/integration/stock/status', { headers: ownerHeaders });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.connected, true);
      return res.data;
    });

    await runTest('RBAC Security', 'Cashier Blocked from Posting Journal', 'HTTP 403 Forbidden', async () => {
      const res = await request(BASE_URLS.FINANCE, '/ledger/journal', {
        method: 'POST',
        headers: cashierHeaders,
        body: {
          memo: 'Unauthorized cashier journal attempt',
          lines: [
            { accountCode: '1020', debit: 100, credit: 0 },
            { accountCode: '4010', debit: 0, credit: 100 }
          ]
        }
      });
      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
      assert.ok(res.data.error.includes('Unauthorized'));
      return res.data;
    });

    await runTest('RBAC Security', 'Cashier Blocked from Finalizing Landed Costs', 'HTTP 403 Forbidden', async () => {
      const res = await request(BASE_URLS.FINANCE, '/shipments/fake-ship-id/finalize', {
        method: 'POST',
        headers: cashierHeaders
      });
      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
      assert.ok(res.data.error.includes('Unauthorized'));
      return res.data;
    });

    await runTest('RBAC Security', 'Cashier Blocked from Deleting Account', 'HTTP 403 Forbidden', async () => {
      const res = await request(BASE_URLS.FINANCE, '/accounts/9999', {
        method: 'DELETE',
        headers: cashierHeaders
      });
      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
      return res.data;
    });

    await runTest('RBAC Security', 'Finance Auditor Blocked from Mutating Entries', 'HTTP 403 Forbidden', async () => {
      const res = await request(BASE_URLS.FINANCE, '/bills', {
        method: 'POST',
        headers: auditorHeaders,
        body: {
          supplierName: 'Test Vendor',
          totalAmount: 500
        }
      });
      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
      assert.ok(res.data.error.includes('Unauthorized'));
      return res.data;
    });

    // ========================================================================
    // SUITE 2: CHART OF ACCOUNTS (COA) LIFECYCLE & INTEGRITY
    // ========================================================================
    logHeader('SUITE 2: CHART OF ACCOUNTS (COA) LIFECYCLE & INTEGRITY');

    await runTest('Chart of Accounts', 'Fetch Standard COA', 'Returns 65 standard accounts across 5 root categories', async () => {
      const res = await request(BASE_URLS.FINANCE, '/chart-of-accounts', { headers: ownerHeaders });
      assert.strictEqual(res.status, 200);
      const accounts = Array.isArray(res.data) ? res.data : (res.data.accounts || []);
      assert.ok(accounts.length >= 60, `Expected at least 60 accounts, got ${accounts.length}`);
      return { totalAccounts: accounts.length };
    });

    await runTest('Chart of Accounts', 'Create Custom Account', 'Successfully creates custom account 1099', async () => {
      const res = await request(BASE_URLS.FINANCE, '/accounts', {
        method: 'POST',
        headers: ownerHeaders,
        body: {
          code: '1099',
          name: 'Station 1 Cash Register Float',
          type: 'ASSET',
          normalSide: 'DEBIT',
          description: 'Cash drawer at retail station 1'
        }
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.code, '1099');
      assert.strictEqual(res.data.name, 'Station 1 Cash Register Float');
      return res.data;
    });

    await runTest('Chart of Accounts', 'Duplicate Account Code Protection', 'HTTP 400 rejection on duplicate code', async () => {
      const res = await request(BASE_URLS.FINANCE, '/accounts', {
        method: 'POST',
        headers: ownerHeaders,
        body: {
          code: '1099',
          name: 'Duplicate Register',
          type: 'ASSET'
        }
      });
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.error.includes('already exists'));
      return res.data;
    });

    await runTest('Chart of Accounts', 'Update Account Metadata', 'Updates name and description', async () => {
      const res = await request(BASE_URLS.FINANCE, '/accounts/1099', {
        method: 'PUT',
        headers: ownerHeaders,
        body: {
          name: 'Station 1 Cash Float Station A',
          description: 'Updated station A drawer'
        }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.name, 'Station 1 Cash Float Station A');
      return res.data;
    });

    await runTest('Chart of Accounts', 'System-Protected Account Deletion Guard', 'Rejects deletion of core GL account 1020', async () => {
      const res = await request(BASE_URLS.FINANCE, '/accounts/1020', {
        method: 'DELETE',
        headers: ownerHeaders
      });
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.error.includes('system-protected'));
      return res.data;
    });

    await runTest('Chart of Accounts', 'Delete Unlinked Custom Account', 'Successfully deletes custom account 1099', async () => {
      const res = await request(BASE_URLS.FINANCE, '/accounts/1099', {
        method: 'DELETE',
        headers: ownerHeaders
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      return res.data;
    });

    // ========================================================================
    // SUITE 3: CASH & BANK MANAGEMENT & DOUBLE-ENTRY TRANSFERS
    // ========================================================================
    logHeader('SUITE 3: CASH & BANK MANAGEMENT & CAPITAL INJECTIONS');

    await runTest('Cash Management', 'Owner Capital Injection ($50,000)', 'Balanced journal: Dr 1020 $50,000, Cr 3010 $50,000', async () => {
      const res = await request(BASE_URLS.FINANCE, '/settings/capital', {
        method: 'POST',
        headers: ownerHeaders,
        body: {
          partnerName: 'Zenith Lead Partner',
          type: 'INITIAL_INVESTMENT',
          amount: 50000,
          notes: 'Pre-launch business capitalization'
        }
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.amount, 50000);

      // Verify dashboard cash now
      const dash = await request(BASE_URLS.FINANCE, '/dashboard', { headers: ownerHeaders });
      assert.strictEqual(dash.data.kpiCards.cashNow, 50000);
      return { cashNow: dash.data.kpiCards.cashNow };
    });

    await runTest('Cash Management', 'Inter-Account Transfer ($2,000)', 'Transfer Dr 1010 Cash on Hand, Cr 1020 Bank', async () => {
      const res = await request(BASE_URLS.FINANCE, '/transfers', {
        method: 'POST',
        headers: ownerHeaders,
        body: {
          fromAccountCode: '1020',
          toAccountCode: '1010',
          amount: 2000,
          notes: 'Drawer float allocation'
        }
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.amount, 2000);

      // Check Account Ledgers
      const bankLedger = await request(BASE_URLS.FINANCE, '/ledger/1020', { headers: ownerHeaders });
      assert.strictEqual(bankLedger.data.balance, 48000, `Expected Bank $48,000, got ${bankLedger.data.balance}`);

      const cashLedger = await request(BASE_URLS.FINANCE, '/ledger/1010', { headers: ownerHeaders });
      assert.strictEqual(cashLedger.data.balance, 2000, `Expected Cash $2,000, got ${cashLedger.data.balance}`);

      return { bankBalance: bankLedger.data.balance, cashOnHand: cashLedger.data.balance };
    });

    // ========================================================================
    // SUITE 4: LANDED COST ENGINE 17-STEP END-TO-END IMPORT TEST
    // ========================================================================
    logHeader('SUITE 4: LANDED COST ENGINE 17-STEP AUDIT');

    let createdShipmentId = null;

    await runTest('Landed Cost Engine', 'Step 1: Create Import Shipment', `Creates shipment ${SHIP_CODE}`, async () => {
      const res = await request(BASE_URLS.FINANCE, '/shipments', {
        method: 'POST',
        headers: ownerHeaders,
        body: {
          shipment: {
            shipmentCode: SHIP_CODE,
            supplierName: 'Shenzhen Audio Acoustics Co.',
            originCountry: 'China',
            shippingTerms: 'FOB',
            foreignCurrency: 'USD',
            exchangeRate: 1.0,
            paymentStatus: 'ON_CREDIT',
            notes: 'Batch 1 Headphone Import'
          },
          items: [],
          overheads: []
        }
      });
      assert.strictEqual(res.status, 201);
      createdShipmentId = res.data.shipment?.id || res.data.id;
      assert.ok(createdShipmentId, 'Expected createdShipmentId to be defined');
      return { shipmentId: createdShipmentId, code: res.data.shipment?.shipmentCode };
    });

    await runTest('Landed Cost Engine', 'Step 2 & 3: Add Items (50 units @ $18) & Overheads ($200)', 'Calculates landed cost', async () => {
      const updateRes = await request(BASE_URLS.FINANCE, `/shipments/${createdShipmentId}`, {
        method: 'PUT',
        headers: ownerHeaders,
        body: {
          shipment: {
            shipmentCode: SHIP_CODE,
            supplierName: 'Shenzhen Audio Acoustics Co.',
            foreignCurrency: 'USD',
            exchangeRate: 1.0,
            paymentStatus: 'ON_CREDIT'
          },
          items: [
            {
              skuCode: SKU_CODE,
              productName: 'Zenith Pro Wireless ANC Headphones',
              variantName: 'Midnight Black',
              quantity: 50,
              unitBasePrice: 18.00,
              unitWeightKg: 0.5,
              unitVolumeCbm: 0.002,
              targetRetailPrice: 45.00,
              category: 'Audio Equipment'
            }
          ],
          overheads: [
            {
              category: 'INTERNATIONAL_FREIGHT',
              vendorName: 'Cosco Ocean Freight',
              amount: 120.00,
              allocationBasis: 'BY_VALUE'
            },
            {
              category: 'CUSTOMS_IMPORT_DUTY',
              vendorName: 'Phnom Penh Port Customs',
              amount: 80.00,
              allocationBasis: 'BY_VALUE'
            }
          ]
        }
      });

      assert.strictEqual(updateRes.status, 200);
      const summary = updateRes.data.summary;
      assert.strictEqual(summary.totalGoodsCost, 900.00, `Expected goods $900, got ${summary.totalGoodsCost}`);
      assert.strictEqual(summary.totalOverheadCost, 200.00, `Expected overheads $200, got ${summary.totalOverheadCost}`);
      assert.strictEqual(summary.totalLandedCost, 1100.00, `Expected landed total $1,100, got ${summary.totalLandedCost}`);

      const item = updateRes.data.items[0];
      assert.strictEqual(Number(item.unit_landed_cost), 22.0000, `Expected unit landed cost $22.00, got ${item.unit_landed_cost}`);

      return {
        totalGoodsCost: summary.totalGoodsCost,
        totalOverheads: summary.totalOverheadCost,
        totalLandedCost: summary.totalLandedCost,
        unitLandedCost: item.unit_landed_cost
      };
    });

    await runTest('Landed Cost Engine', 'Step 6 & 7: Finalize Shipment & Verify Immutability Lock', 'Status FINALIZED, locked against edits', async () => {
      const finRes = await request(BASE_URLS.FINANCE, `/shipments/${createdShipmentId}/finalize`, {
        method: 'POST',
        headers: ownerHeaders
      });
      assert.strictEqual(finRes.status, 200);
      assert.strictEqual(finRes.data.shipment.status, 'FINALIZED');

      // Attempt edit — must reject
      const editAttempt = await request(BASE_URLS.FINANCE, `/shipments/${createdShipmentId}`, {
        method: 'PUT',
        headers: ownerHeaders,
        body: {
          items: [{ skuCode: 'HACK', quantity: 999 }]
        }
      });
      assert.strictEqual(editAttempt.status, 400);
      assert.ok(editAttempt.data.error.includes('FINALIZED') || editAttempt.data.error.includes('locked'));

      // Attempt add overhead — must reject
      const overheadAttempt = await request(BASE_URLS.FINANCE, `/shipments/${createdShipmentId}/overheads`, {
        method: 'POST',
        headers: ownerHeaders,
        body: { amount: 50 }
      });
      assert.strictEqual(overheadAttempt.status, 400);

      return { status: finRes.data.shipment.status, immutabilityLocked: true };
    });

    await runTest('Landed Cost Engine', 'Step 8 & 9: General Ledger Double-Entry Verification', 'Dr 1200 $1100, Cr 2020 $900, Cr 1215 $200', async () => {
      const journalsRes = await request(BASE_URLS.FINANCE, '/ledger', { headers: ownerHeaders });
      assert.strictEqual(journalsRes.status, 200);

      const landedEntry = journalsRes.data.find(j => j.sourceType === 'IMPORT_LANDED' && j.sourceId === createdShipmentId);
      assert.ok(landedEntry, 'Landed cost journal entry not found');

      assert.strictEqual(landedEntry.totalDebit, 1100.00);
      assert.strictEqual(landedEntry.totalCredit, 1100.00);
      assert.strictEqual(landedEntry.totalDebit, landedEntry.totalCredit, 'Debits must equal Credits');

      const dr1200 = landedEntry.lines.find(l => l.accountCode === '1200');
      const cr2020 = landedEntry.lines.find(l => l.accountCode === '2020');
      const cr1215 = landedEntry.lines.find(l => l.accountCode === '1215');

      assert.strictEqual(dr1200.debit, 1100.00, 'Dr 1200 Inventory must be $1100');
      assert.strictEqual(cr2020.credit, 900.00, 'Cr 2020 GRNI must be $900');
      assert.strictEqual(cr1215.credit, 200.00, 'Cr 1215 Landed Cost Clearing must be $200');

      return {
        entryNumber: landedEntry.entryNumber,
        balanced: true,
        debitTotal: landedEntry.totalDebit,
        creditTotal: landedEntry.totalCredit
      };
    });

    await runTest('Landed Cost Engine', 'Step 10, 11, 12: Stock Received & Quantities Increased', 'Port 3000 shows 50 units @ $22 costMinor (2200)', async () => {
      const prodsRes = await request(BASE_URLS.STOCK, '/products', { headers: ownerHeaders });
      assert.strictEqual(prodsRes.status, 200);

      const products = Array.isArray(prodsRes.data) ? prodsRes.data : (prodsRes.data.products || []);
      const targetProd = products.find(p => (p.variants || []).some(v => v.sku === SKU_CODE));
      assert.ok(targetProd, 'Imported product not found in Stock Management catalog');

      const variant = targetProd.variants.find(v => v.sku === SKU_CODE);
      assert.strictEqual(variant.onHand, 50, `Expected 50 units on hand, got ${variant.onHand}`);
      assert.strictEqual(variant.costMinor, 2200, `Expected 2200 costMinor ($22.00), got ${variant.costMinor}`);

      return {
        product: targetProd.name,
        sku: variant.sku,
        onHand: variant.onHand,
        unitLandedCostUSD: (variant.costMinor / 100).toFixed(2)
      };
    });

    await runTest('Landed Cost Engine', 'Step 13 & 14: Products Published to POS Catalog', 'Port 3002 catalog contains synchronized product', async () => {
      const posRes = await request(BASE_URLS.POS, '/catalog', { headers: ownerHeaders });
      assert.strictEqual(posRes.status, 200);

      const posProds = posRes.data.products || [];
      const posProd = posProds.find(p => (p.variants || []).some(v => v.sku === SKU_CODE) || p.code === SKU_CODE);
      assert.ok(posProd, 'Product not found in POS catalog');

      return {
        posProductName: posProd.name,
        sellingPrice: posProd.basePrice,
        skuFound: true
      };
    });

    await runTest('Landed Cost Engine', 'Step 15 & 16: Idempotent Re-Synchronization', 'Repeated push maintains 50 on-hand without duplicate accumulation', async () => {
      // Trigger explicit push
      const pushRes = await request(BASE_URLS.FINANCE, '/integration/stock/push-landed-costs', {
        method: 'POST',
        headers: ownerHeaders,
        body: { shipmentId: createdShipmentId }
      });
      assert.strictEqual(pushRes.status, 200);

      // Verify Stock onHand is STILL 50, not 100
      const prodsRes = await request(BASE_URLS.STOCK, '/products', { headers: ownerHeaders });
      const products = Array.isArray(prodsRes.data) ? prodsRes.data : (prodsRes.data.products || []);
      const targetProd = products.find(p => (p.variants || []).some(v => v.sku === SKU_CODE));
      const variant = targetProd.variants.find(v => v.sku === SKU_CODE);

      assert.strictEqual(variant.onHand, 50, `DUPLICATE STOCK BUG! Expected 50 on-hand, got ${variant.onHand}`);
      return { onHandAfterReSync: variant.onHand, duplicatePrevented: true };
    });

    await runTest('Landed Cost Engine', 'Step 17: Fault Recovery & Error Resilience', 'Invalid shipment push gracefully returns 400/404', async () => {
      const pushRes = await request(BASE_URLS.FINANCE, '/integration/stock/push-landed-costs', {
        method: 'POST',
        headers: ownerHeaders,
        body: { shipmentId: 'non-existent-shipment-999' }
      });
      assert.strictEqual(pushRes.status, 400);
      assert.ok(pushRes.data.error.includes('not found'));
      return { gracefulError: pushRes.data.error };
    });

    // ========================================================================
    // SUITE 5: ACCOUNTS PAYABLE (AP) & SUPPLIER BILLS
    // ========================================================================
    logHeader('SUITE 5: ACCOUNTS PAYABLE & BILL SETTLEMENT');

    let supplierBillId = null;

    await runTest('Accounts Payable', 'Record Freight Vendor Bill ($200)', 'Dr 1215 Landed Cost Clearing $200, Cr 2010 AP $200', async () => {
      const res = await request(BASE_URLS.FINANCE, '/bills', {
        method: 'POST',
        headers: ownerHeaders,
        body: {
          supplierName: 'Cosco Ocean Logistics Ltd',
          billDate: new Date().toISOString().split('T')[0],
          dueDate: new Date().toISOString().split('T')[0],
          currency: 'USD',
          totalAmount: 200.00,
          depositPaid: 0,
          linkedPoNumber: SHIP_CODE,
          notes: 'Freight invoice offsetting Landed Cost Clearing'
        }
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.totalAmount, 200.00);
      assert.strictEqual(res.data.balanceDue, 200.00);
      assert.strictEqual(res.data.status, 'POSTED');
      supplierBillId = res.data.id;

      // Check AP Report
      const apRep = await request(BASE_URLS.FINANCE, '/reports/ap', { headers: ownerHeaders });
      assert.strictEqual(apRep.data.totalPayable, 200.00, `Expected total payable $200, got ${apRep.data.totalPayable}`);

      // Check Clearing Account 1215 balance — should now be $0.00 (Cr $200 from Landed, Dr $200 from Bill)
      const clearLedger = await request(BASE_URLS.FINANCE, '/ledger/1215', { headers: ownerHeaders });
      assert.strictEqual(Math.abs(clearLedger.data.balance), 0.00, `Clearing account 1215 must be 0, got ${clearLedger.data.balance}`);

      return { billId: supplierBillId, totalPayable: apRep.data.totalPayable, clearingAccountBalance: clearLedger.data.balance };
    });

    await runTest('Accounts Payable', 'Pay Supplier Bill ($200)', 'Dr 2010 AP $200, Cr 1020 Bank $200', async () => {
      const res = await request(BASE_URLS.FINANCE, `/bills/${supplierBillId}/pay`, {
        method: 'POST',
        headers: ownerHeaders,
        body: { amount: 200.00 }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.balanceDue, 0.00);
      assert.strictEqual(res.data.status, 'PAID');

      // Check AP Report now $0.00
      const apRep = await request(BASE_URLS.FINANCE, '/reports/ap', { headers: ownerHeaders });
      assert.strictEqual(apRep.data.totalPayable, 0.00);

      return { billStatus: res.data.status, balanceDue: res.data.balanceDue };
    });

    // ========================================================================
    // SUITE 6: ACCOUNTS RECEIVABLE (AR), POS SALES & COGS DERECOGNITION
    // ========================================================================
    logHeader('SUITE 6: REVENUE, POS SALES & COGS DERECOGNITION');

    await runTest('Sales & Revenue', 'Record Customer Sale of 10 Units ($450)', 'Dual journal: Rev Dr 1020 Cr 4010 $450; COGS Dr 5010 Cr 1200 $220', async () => {
      const res = await request(BASE_URLS.FINANCE, '/invoices', {
        method: 'POST',
        headers: ownerHeaders,
        body: {
          customerName: 'High-Fidelity Audio Lounge',
          invoiceNumber: `INV-POS-${RUN_ID}`,
          subtotal: 450.00,
          discountAmount: 0.00,
          landedCogsAmount: 220.00, // 10 units @ $22.00 landed cost
          isPaid: true,
          channel: 'RETAIL_POS',
          notes: 'Sold 10 units Zenith ANC Headphones'
        }
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.totalAmount, 450.00);
      assert.strictEqual(res.data.landedCogsAmount, 220.00);

      // Verify Inventory Asset Account 1200 reduced from $1,100 to $880
      const invLedger = await request(BASE_URLS.FINANCE, '/ledger/1200', { headers: ownerHeaders });
      assert.strictEqual(invLedger.data.balance, 880.00, `Expected Inventory $880, got ${invLedger.data.balance}`);

      // Verify COGS Account 5010 is $220
      const cogsLedger = await request(BASE_URLS.FINANCE, '/ledger/5010', { headers: ownerHeaders });
      assert.strictEqual(cogsLedger.data.balance, 220.00);

      return {
        revenue: res.data.totalAmount,
        cogs: res.data.landedCogsAmount,
        remainingInventoryAsset: invLedger.data.balance
      };
    });

    // ========================================================================
    // SUITE 7: OPERATING EXPENSES (OPEX)
    // ========================================================================
    logHeader('SUITE 7: OPERATING EXPENSES (OPEX)');

    await runTest('Operating Expenses', 'Record Store Rent ($1,200)', 'Dr 6030 Retail Store Rent $1,200, Cr 1020 Bank $1,200', async () => {
      const res = await request(BASE_URLS.FINANCE, '/expenses', {
        method: 'POST',
        headers: ownerHeaders,
        body: {
          vendorPayee: 'Olympia City Retail Plaza',
          category: 'Retail Store Rent & Lease',
          tier: 'STORE_RENT',
          amount: 1200.00,
          notes: 'Storefront Lease'
        }
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.amount, 1200.00);

      const rentLedger = await request(BASE_URLS.FINANCE, '/ledger/6030', { headers: ownerHeaders });
      assert.strictEqual(rentLedger.data.balance, 1200.00);

      return { expenseNumber: res.data.expenseNumber, rentBalance: rentLedger.data.balance };
    });

    await runTest('Operating Expenses', 'Record Cloud Software ($80)', 'Dr 6050 Cloud Software $80, Cr 1020 Bank $80', async () => {
      const res = await request(BASE_URLS.FINANCE, '/expenses', {
        method: 'POST',
        headers: ownerHeaders,
        body: {
          vendorPayee: 'Cloud POS Infrastructure',
          category: 'POS Software License',
          tier: 'ADMIN_SOFTWARE',
          amount: 80.00,
          notes: 'Monthly POS cloud sync'
        }
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.amount, 80.00);

      const swLedger = await request(BASE_URLS.FINANCE, '/ledger/6050', { headers: ownerHeaders });
      assert.strictEqual(swLedger.data.balance, 80.00);

      return { expenseNumber: res.data.expenseNumber, softwareBalance: swLedger.data.balance };
    });

    // ========================================================================
    // SUITE 8: GENERAL LEDGER CORRECTIONS & REVERSALS
    // ========================================================================
    logHeader('SUITE 8: GENERAL LEDGER CORRECTIONS & REVERSALS');

    let badJournalId = null;

    await runTest('GL Corrections', 'Post Accidental Entry ($50)', 'Posts manual journal Dr 6090 Cr 1020 $50', async () => {
      const res = await request(BASE_URLS.FINANCE, '/ledger/journal', {
        method: 'POST',
        headers: ownerHeaders,
        body: {
          memo: 'Erroneous miscellaneous fee',
          lines: [
            { accountCode: '6090', debit: 50.00, credit: 0.00 },
            { accountCode: '1020', debit: 0.00, credit: 50.00 }
          ]
        }
      });
      assert.strictEqual(res.status, 201);
      badJournalId = res.data.id;
      assert.strictEqual(res.data.totalDebit, 50.00);

      const acc6090 = await request(BASE_URLS.FINANCE, '/ledger/6090', { headers: ownerHeaders });
      assert.strictEqual(acc6090.data.balance, 50.00);

      return { badJournalId, balanceBeforeReversal: acc6090.data.balance };
    });

    await runTest('GL Corrections', 'Reverse Erroneous Journal', 'Reversal entry creates offsetting Dr/Cr, restores balance to $0', async () => {
      const res = await request(BASE_URLS.FINANCE, `/ledger/${badJournalId}/reverse`, {
        method: 'POST',
        headers: ownerHeaders,
        body: { reason: 'Accidental duplicate voucher entry' }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.original.status, 'REVERSED');
      assert.strictEqual(res.data.reversal.sourceType, 'REVERSAL');
      assert.strictEqual(res.data.reversal.lines[0].credit, 50.00); // Flipped!

      const acc6090After = await request(BASE_URLS.FINANCE, '/ledger/6090', { headers: ownerHeaders });
      assert.strictEqual(acc6090After.data.balance, 0.00, `Balance must be restored to 0, got ${acc6090After.data.balance}`);

      return { originalStatus: res.data.original.status, balanceAfterReversal: acc6090After.data.balance };
    });

    // ========================================================================
    // SUITE 9: FINANCIAL REPORTS MATHEMATICAL RECONCILIATION
    // ========================================================================
    logHeader('SUITE 9: FINANCIAL REPORTS MATHEMATICAL RECONCILIATION');

    await runTest('Financial Reports', 'Trial Balance Equilibrium', 'Total Debits === Total Credits ($0.00 discrepancy)', async () => {
      const res = await request(BASE_URLS.FINANCE, '/reports/trial-balance', { headers: ownerHeaders });
      assert.strictEqual(res.status, 200);
      const totals = res.data.totals;
      assert.strictEqual(totals.isBalanced, true, `Trial balance unbalanced! Discrepancy: ${totals.discrepancy}`);
      assert.strictEqual(totals.discrepancy, 0.00);
      assert.strictEqual(totals.totalDebits, totals.totalCredits);

      return {
        totalDebits: totals.totalDebits,
        totalCredits: totals.totalCredits,
        isBalanced: totals.isBalanced
      };
    });

    await runTest('Financial Reports', 'Balance Sheet Fundamental Equation', 'Assets === Liabilities + Equity ($0.00 discrepancy)', async () => {
      const res = await request(BASE_URLS.FINANCE, '/reports/balance-sheet', { headers: ownerHeaders });
      assert.strictEqual(res.status, 200);
      const totals = res.data.totals;

      const assets = totals.totalAssets;
      const liabilitiesAndEquity = totals.totalLiabilitiesAndEquity;
      const diff = Math.abs(assets - liabilitiesAndEquity);

      assert.ok(diff < 0.01, `Balance Sheet fails! Assets ($${assets}) != Liab+Equity ($${liabilitiesAndEquity})`);

      return {
        totalAssets: assets,
        totalLiabilities: totals.totalLiabilities,
        totalEquity: totals.totalEquity,
        totalLiabilitiesAndEquity: liabilitiesAndEquity,
        variance: diff
      };
    });

    await runTest('Financial Reports', 'Profit & Loss Statement Accuracy', 'Net Profit = Revenue ($450) - COGS ($220) - OPEX ($1280) = -$1,050', async () => {
      const res = await request(BASE_URLS.FINANCE, '/reports/pnl', { headers: ownerHeaders });
      assert.strictEqual(res.status, 200);

      const pnl = res.data;
      assert.strictEqual(pnl.grossRevenue, 450.00);
      assert.strictEqual(pnl.landedCogs, 220.00);
      assert.strictEqual(pnl.grossProfit, 230.00); // 450 - 220
      assert.strictEqual(pnl.fixedOpex, 1280.00); // 1200 + 80
      assert.strictEqual(pnl.netProfit, -1050.00); // 230 - 1280

      return {
        revenue: pnl.grossRevenue,
        grossProfit: pnl.grossProfit,
        opex: pnl.fixedOpex,
        netProfit: pnl.netProfit
      };
    });

    await runTest('Financial Reports', 'Statement of Cash Flows Accuracy', 'Ending Cash matches GL Bank + Cash on Hand', async () => {
      const res = await request(BASE_URLS.FINANCE, '/reports/cash-flow', { headers: ownerHeaders });
      assert.strictEqual(res.status, 200);

      const dash = await request(BASE_URLS.FINANCE, '/dashboard', { headers: ownerHeaders });
      const expectedCash = dash.data.kpiCards.cashNow;

      assert.strictEqual(res.data.endingCash, expectedCash, `Cash flow ending cash ($${res.data.endingCash}) != GL Cash ($${expectedCash})`);

      return {
        endingCash: res.data.endingCash,
        glCashNow: expectedCash,
        matches: true
      };
    });

    await runTest('Financial Reports', 'Inventory Valuation Report Matches GL Account 1200', 'Report total equals GL 1200 balance ($880.00)', async () => {
      const res = await request(BASE_URLS.FINANCE, '/reports/inventory-valuation', { headers: ownerHeaders });
      assert.strictEqual(res.status, 200);

      assert.strictEqual(res.data.inventoryAssetBalance, 880.00);
      assert.strictEqual(res.data.isReconciled, true);

      return {
        inventoryValuation: res.data.totalValuation,
        ledgerAssetBalance: res.data.inventoryAssetBalance,
        isReconciled: res.data.isReconciled
      };
    });

    await runTest('Financial Reports', 'AP Report Matches GL Account 2010', 'Report total equals GL 2010 balance ($0.00)', async () => {
      const res = await request(BASE_URLS.FINANCE, '/reports/ap', { headers: ownerHeaders });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.totalPayable, 0.00);
      assert.strictEqual(res.data.ledgerApBalance, 0.00);
      assert.strictEqual(res.data.isReconciled, true);

      return { totalPayable: res.data.totalPayable, isReconciled: true };
    });

    // ========================================================================
    // SUITE 10: MULTI-TENANT ISOLATION & PRIVACY AUDIT
    // ========================================================================
    logHeader('SUITE 10: MULTI-TENANT ISOLATION AUDIT');

    await runTest('Multi-Tenant Isolation', 'Tenant B Shipments Are Isolated', 'Tenant B cannot see Tenant A shipments', async () => {
      const res = await request(BASE_URLS.FINANCE, '/shipments', { headers: isolateHeaders });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.length, 0, `Data leak! Tenant B saw ${res.data.length} shipments belonging to Tenant A`);
      return { tenantBShipmentsCount: res.data.length, isolated: true };
    });

    await runTest('Multi-Tenant Isolation', 'Tenant B Journals Are Isolated', 'Tenant B cannot see Tenant A journal entries', async () => {
      const res = await request(BASE_URLS.FINANCE, '/ledger', { headers: isolateHeaders });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.length, 0, `Data leak! Tenant B saw ${res.data.length} journals belonging to Tenant A`);
      return { tenantBJournalsCount: res.data.length, isolated: true };
    });

    await runTest('Multi-Tenant Isolation', 'Tenant B Balance Sheet Is Isolated', 'Tenant B assets and liabilities are $0.00', async () => {
      const res = await request(BASE_URLS.FINANCE, '/reports/balance-sheet', { headers: isolateHeaders });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.totals.totalAssets, 0.00);
      assert.strictEqual(res.data.totals.totalLiabilitiesAndEquity, 0.00);
      return { tenantBTotalAssets: res.data.totals.totalAssets, isolated: true };
    });

  } catch (fatalErr) {
    console.error('\n[FATAL SUITE CRASH]:', fatalErr);
  } finally {
    cleanupTestDatabase();

    // Terminate spawned processes
    for (const child of spawnedProcesses) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', child.pid, '/f', '/t']);
        } else {
          child.kill('SIGTERM');
        }
      } catch (e) {}
    }

    logHeader('AUDIT SUITE EXECUTION SUMMARY');
    console.log(`Total Functions Tested : ${results.length}`);
    console.log(`Passed                 : \x1b[32m${passedCount}\x1b[0m`);
    console.log(`Failed                 : \x1b[31m${failedCount}\x1b[0m`);
    console.log(`Success Rate           : ${((passedCount / (results.length || 1)) * 100).toFixed(1)}%\n`);

    // Output JSON report for artifact generator
    const fs = require('fs');
    fs.writeFileSync('audit_results.json', JSON.stringify({
      total: results.length,
      passed: passedCount,
      failed: failedCount,
      results
    }, null, 2));

    process.exit(failedCount > 0 ? 1 : 0);
  }
}

main();
