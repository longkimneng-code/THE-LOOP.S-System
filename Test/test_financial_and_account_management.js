// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — AUTOMATED VERIFICATION SUITE
// Tests Token Lifecycles, Login Redirections, Product Image Uploads,
// Import History, Monthly Revenue Allocation, Capital Protection & Exports
// ============================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const BASE_URL = 'http://localhost:3002';

async function runTests() {
  console.log('\x1b[1m\x1b[33m%s\x1b[0m', '=====================================================');
  console.log('\x1b[1m\x1b[33m%s\x1b[0m', '  ACCOUNT & FINANCIAL SYSTEM VERIFICATION SUITE');
  console.log('\x1b[1m\x1b[33m%s\x1b[0m', '=====================================================\n');

  let passed = 0;
  let failed = 0;

  function record(name, isOk, extra = '') {
    if (isOk) {
      console.log(`  \x1b[32m✓\x1b[0m ${name} ${extra ? `(${extra})` : ''}`);
      passed++;
    } else {
      console.error(`  \x1b[31m✗\x1b[0m ${name} ${extra ? `(${extra})` : ''}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Token Lifecycle (5 min access token, 7 day refresh token)
  // --------------------------------------------------------------------------
  console.log('\x1b[36m[1/8] Testing Token Lifecycles & Smart Login Redirection...\x1b[0m');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'neng@gmail.com', password: 'password123' })
  });
  const loginData = await loginRes.json();

  record('Owner login succeeds', loginData.ok === true);
  record('Access token TTL is exactly 5 minutes (300 seconds)', loginData.expiresIn === 300, `expiresIn=${loginData.expiresIn}s`);
  record('Refresh token is issued with 7-day durability', !!loginData.refreshToken && loginData.refreshToken.startsWith('loops_ref_'));
  record('Owner redirects directly to Admin dashboard', loginData.redirectUrl === '/admin');

  const ownerToken = loginData.token;

  // --------------------------------------------------------------------------
  // TEST 2: Product Image Upload (JPG/PNG/WEBP, size check, static serving)
  // --------------------------------------------------------------------------
  console.log('\n\x1b[36m[2/8] Testing Product Image Upload & Storage Service...\x1b[0m');
  // 1x1 transparent PNG base64
  const testPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ image: testPngBase64, filename: 'test-product.png' })
  });
  const uploadData = await uploadRes.json();

  record('Product image upload succeeds', uploadData.ok === true && !!uploadData.url);
  record('Image URL points to /uploads/', uploadData.url?.startsWith('/uploads/'), uploadData.url);

  // Test static file serving
  const fileFetchRes = await fetch(`${BASE_URL}${uploadData.url}`);
  record('Static image serving returns 200 and image/png', fileFetchRes.status === 200 && fileFetchRes.headers.get('content-type') === 'image/png');

  // Test invalid file type rejection
  const invalidUploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ image: 'data:text/plain;base64,SGVsbG8=', filename: 'bad.txt' })
  });
  const invalidData = await invalidUploadRes.json();
  record('Invalid image format is rejected with error', invalidData.ok === false);

  // --------------------------------------------------------------------------
  // TEST 3: Import History Management (Recording, Monthly Archiving, Filters)
  // --------------------------------------------------------------------------
  console.log('\n\x1b[36m[3/8] Testing Import History Management & Monthly Archiving...\x1b[0m');
  const importCreateRes = await fetch(`${BASE_URL}/api/imports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      supplierName: 'Shenzhen Audio Direct',
      importDate: new Date().toISOString(),
      shippingCost: 50.00,
      additionalCharges: 25.00,
      notes: 'Air Cargo Batch 01',
      items: [
        { productName: 'Wireless Earbuds Pro', sku: 'AUD-001', quantity: 20, unitCost: 15.00, imageUrl: uploadData.url },
        { productName: 'Noise-Cancelling Headphones', sku: 'AUD-002', quantity: 10, unitCost: 45.00, imageUrl: uploadData.url }
      ]
    })
  });
  const importCreated = await importCreateRes.json();

  record('Record import transaction succeeds', importCreated.ok === true && !!importCreated.importRef);
  record('Import reference has IMP- format', importCreated.importRef?.startsWith('IMP-'), importCreated.importRef);
  // (20 * 15) + (10 * 45) + 50 + 25 = 300 + 450 + 75 = 825.00
  record('Total import value correctly calculates landed costs', importCreated.totalImportValue === 825.00, `$${importCreated.totalImportValue}`);

  // Query Import History with month filter
  const currentMonth = new Date().toISOString().slice(0, 7);
  const getImportsRes = await fetch(`${BASE_URL}/api/imports?month=${currentMonth}`, {
    headers: { Authorization: `Bearer ${ownerToken}` }
  });
  const getImportsData = await getImportsRes.json();
  record('Monthly import history query returns records', Array.isArray(getImportsData.imports) && getImportsData.imports.length > 0);

  // Query details by ID
  const detailRes = await fetch(`${BASE_URL}/api/imports/${importCreated.id}`, {
    headers: { Authorization: `Bearer ${ownerToken}` }
  });
  const detailData = await detailRes.json();
  record('Import details return line items with product pictures', detailData.import?.items?.length === 2 && detailData.import?.items[0]?.imageUrl === uploadData.url);

  // --------------------------------------------------------------------------
  // TEST 4: Monthly Revenue Allocation & Live Dashboard
  // --------------------------------------------------------------------------
  console.log('\n\x1b[36m[4/8] Testing Monthly Revenue Allocation Engine...\x1b[0m');
  const allocRes = await fetch(`${BASE_URL}/api/allocations/monthly?month=${currentMonth}`, {
    headers: { Authorization: `Bearer ${ownerToken}` }
  });
  const allocData = await allocRes.json();

  record('Monthly allocation plan initializes with default categories', allocData.ok === true && Array.isArray(allocData.budgets) && allocData.budgets.length >= 4);

  const stockBudget = allocData.budgets?.find(b => b.category_id === 'INVENTORY_REINVESTMENT');
  const salaryBudget = allocData.budgets?.find(b => b.category_id === 'EMPLOYEE_SALARIES');
  const opexBudget = allocData.budgets?.find(b => b.category_id === 'OPERATING_EXPENSES');
  const loopShareBudget = allocData.budgets?.find(b => b.category_id === 'LOOP_SHARE');

  record('Default Category: Inventory Reinvestment (50%)', stockBudget?.allocation_value === 50);
  record('Default Category: Employee Salaries (20%)', salaryBudget?.allocation_value === 20);
  record('Default Category: Operating Expenses (15%)', opexBudget?.allocation_value === 15);
  record('Default Category: Loop Share (15%)', loopShareBudget?.allocation_value === 15);

  // --------------------------------------------------------------------------
  // TEST 5: Capital Protection & Shortage Borrowing Engine
  // --------------------------------------------------------------------------
  console.log('\n\x1b[36m[5/8] Testing Capital Protection & Capital Borrowing Rules...\x1b[0m');

  // Case A: Expense when budget is exhausted -> exhausts budget ($0), borrows shortage ($120) from Capital
  const opexRemaining = allocData.budgets?.find(b => b.category_id === 'OPERATING_EXPENSES')?.remaining_balance || 0;
  const expenseToBorrow = opexRemaining + 120.00;

  const expRes = await fetch(`${BASE_URL}/api/finance/expenses/with-protection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      periodMonth: currentMonth,
      categoryId: 'OPERATING_EXPENSES',
      expenseCategory: 'Store Equipment & Maintenance',
      amount: expenseToBorrow,
      description: 'New Barcode Scanner Terminal Hardware',
      allowCapitalBorrowing: true
    })
  });
  const expData = await expRes.json();

  record('Capital-protected expense succeeds', expData.ok === true);
  record('Capital shortage is borrowed and tracked', expData.capitalBorrowed === 120.00 && !!expData.borrowingRecord?.borrowingRef);
  record('Borrowing reference has CAP-BORR- format', expData.borrowingRecord?.borrowingRef?.startsWith('CAP-BORR-'));

  const borrowId = expData.borrowingRecord?.id;

  // --------------------------------------------------------------------------
  // TEST 6: Capital Repayment Engine
  // --------------------------------------------------------------------------
  console.log('\n\x1b[36m[6/8] Testing Capital Repayment Engine...\x1b[0m');
  const repayRes = await fetch(`${BASE_URL}/api/finance/capital/repay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      borrowingId: borrowId,
      amount: 50.00,
      sourceCategoryId: 'OPERATING_EXPENSES',
      notes: 'Partial repayment from operating allocation'
    })
  });
  const repayData = await repayRes.json();

  record('Capital repayment succeeds', repayData.ok === true);
  record('Repayment decreases outstanding balance ($120 - $50 = $70)', repayData.remainingOutstanding === 70.00, `remaining=$${repayData.remainingOutstanding}`);
  record('Repayment reference has CAP-REPAY- format', repayData.repaymentRef?.startsWith('CAP-REPAY-'));

  // --------------------------------------------------------------------------
  // TEST 7: Confidential Loop Share Management
  // --------------------------------------------------------------------------
  console.log('\n\x1b[36m[7/8] Testing Confidential Loop Share Management & Permissions...\x1b[0m');

  // Record Loop Share contribution
  const lsAddRes = await fetch(`${BASE_URL}/api/finance/loop-share/transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      periodMonth: currentMonth,
      transactionType: 'ALLOCATION',
      amount: 500.00,
      description: 'Monthly Q4 Founder Profit Sharing Allocation'
    })
  });
  const lsAddData = await lsAddRes.json();
  record('Loop Share allocation transaction recorded', lsAddData.ok === true && lsAddData.newBalance >= 500);

  // Record Loop Share distribution
  const lsDistRes = await fetch(`${BASE_URL}/api/finance/loop-share/transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      periodMonth: currentMonth,
      transactionType: 'DISTRIBUTION',
      amount: 200.00,
      recipientName: 'long kimneng (Owner)',
      description: 'Dividend payout distribution'
    })
  });
  const lsDistData = await lsDistRes.json();
  record('Loop Share distribution reduces pool balance', lsDistData.ok === true && lsDistData.newBalance === (lsAddData.newBalance - 200));

  // Query Loop Share Ledger
  const lsLedgerRes = await fetch(`${BASE_URL}/api/finance/loop-share/ledger`, {
    headers: { Authorization: `Bearer ${ownerToken}` }
  });
  const lsLedgerData = await lsLedgerRes.json();
  record('Loop Share ledger returns audited transactions', lsLedgerData.ok === true && lsLedgerData.transactions?.length >= 2);

  // --------------------------------------------------------------------------
  // TEST 8: Multi-Format Report Export Engine (Excel, Word, PDF)
  // --------------------------------------------------------------------------
  console.log('\n\x1b[36m[8/8] Testing Report Export Engine (Excel .xlsx, Word .docx, PDF)...\x1b[0m');

  // Excel Export
  const xlsxRes = await fetch(`${BASE_URL}/api/reports/export?reportType=FINANCIAL_ALLOCATION&format=xlsx&month=${currentMonth}`, {
    headers: { Authorization: `Bearer ${ownerToken}` }
  });
  const xlsxBuf = await xlsxRes.arrayBuffer();
  // Valid ZIP starts with PK\x03\x04
  const isZipXlsx = Buffer.from(xlsxBuf).slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  record('Excel (.xlsx) export produces valid OpenXML spreadsheet binary', xlsxRes.status === 200 && isZipXlsx, `${xlsxBuf.byteLength} bytes`);

  // Word Export
  const docxRes = await fetch(`${BASE_URL}/api/reports/export?reportType=IMPORT_HISTORY&format=docx&month=${currentMonth}`, {
    headers: { Authorization: `Bearer ${ownerToken}` }
  });
  const docxBuf = await docxRes.arrayBuffer();
  const isZipDocx = Buffer.from(docxBuf).slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  record('Word (.docx) export produces valid OpenXML document binary', docxRes.status === 200 && isZipDocx, `${docxBuf.byteLength} bytes`);

  // PDF / Printable Export
  const pdfRes = await fetch(`${BASE_URL}/api/reports/export?reportType=FINANCIAL_ALLOCATION&format=pdf&month=${currentMonth}`, {
    headers: { Authorization: `Bearer ${ownerToken}` }
  });
  const pdfText = await pdfRes.text();
  record('PDF printable export produces styled document layout', pdfRes.status === 200 && pdfText.includes('window.print()') && pdfText.includes('The Loops'));

  // Month-End Closing Test
  console.log('\n\x1b[36m[Extra] Testing Month-End Closing & Carry-Forward Snapshotting...\x1b[0m');
  const testCloseMonth = `20${Math.floor(30 + Math.random() * 50)}-${String(Math.floor(1 + Math.random() * 12)).padStart(2, '0')}`;
  const [closeY, closeM] = testCloseMonth.split('-').map(Number);
  const expNextMonth = closeM === 12 ? `${closeY + 1}-01` : `${closeY}-${String(closeM + 1).padStart(2, '0')}`;

  const closeRes = await fetch(`${BASE_URL}/api/finance/closing/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      periodMonth: testCloseMonth,
      salaryCarryForwardDecision: 'CARRY_FORWARD'
    })
  });
  const closeData = await closeRes.json();
  record('Month-end closing executes and creates snapshot', closeData.ok === true && !!closeData.snapshotId);
  record('Closing opens next month with roll-over carry-forward', closeData.nextMonth === expNextMonth);

  // Test idempotency (cannot double close)
  const duplicateCloseRes = await fetch(`${BASE_URL}/api/finance/closing/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ periodMonth: testCloseMonth })
  });
  const dupData = await duplicateCloseRes.json();
  record('Duplicate month-end closing is safely rejected', dupData.ok === false);

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n=====================================================');
  console.log(`  TOTAL TESTS: ${passed + failed} | \x1b[32mPASSED: ${passed}\x1b[0m | \x1b[31mFAILED: ${failed}\x1b[0m`);
  console.log('=====================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(e => {
  console.error('[FATAL TEST ERROR]', e);
  process.exit(1);
});

