const assert = require('assert');
const { calculateInventoryReinvestmentAndPool, roundMoney } = require('../shared/financial/financialAllocationEngine');

console.log('\x1b[1m\x1b[33m%s\x1b[0m', '======================================================================');
console.log('\x1b[1m\x1b[33m%s\x1b[0m', '  ACCEPTANCE TEST SUITE: INVENTORY REINVESTMENT & REVENUE ALLOCATION');
console.log('\x1b[1m\x1b[33m%s\x1b[0m', '======================================================================\n');

let passed = 0;
let failed = 0;

function check(testName, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  \x1b[32m✓\x1b[0m ${testName}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✗\x1b[0m ${testName}`);
    console.error(`     Actual:   ${JSON.stringify(actual)}`);
    console.error(`     Expected: ${JSON.stringify(expected)}`);
    failed++;
  }
}

// ----------------------------------------------------------------------------
// TEST A: 0% Additional Reinvestment
// ----------------------------------------------------------------------------
console.log('\x1b[36mRunning Test A (0% Additional Reinvestment)...\x1b[0m');
const resA = calculateInventoryReinvestmentAndPool({
  recordedSales: 1500.00,
  eligibleRevenue: 1250.00,
  actualProductCost: 487.35,
  additionalReinvestmentPercent: 0.0
});

check('Test A: Additional Reinvestment Amount is $0.00', resA.additionalReinvestmentAmount, 0.00);
check('Test A: Raw Reinvestment is $487.35', resA.rawReinvestment, 487.35);
check('Test A: Total Inventory Reinvestment (Math.ceil) is $488.00', resA.totalInventoryReinvestment, 488.00);
check('Test A: Remaining Allocation Pool is $762.00', resA.remainingAllocationPool, 762.00);
check('Test A: hasShortfall is false', resA.hasShortfall, false);
check('Test A: reinvestmentShortfall is $0.00', resA.reinvestmentShortfall, 0.00);

// ----------------------------------------------------------------------------
// TEST B: 10% Additional Reinvestment
// ----------------------------------------------------------------------------
console.log('\n\x1b[36mRunning Test B (10% Additional Reinvestment)...\x1b[0m');
const resB = calculateInventoryReinvestmentAndPool({
  recordedSales: 1500.00,
  eligibleRevenue: 1250.00,
  actualProductCost: 487.35,
  additionalReinvestmentPercent: 10.0
});

check('Test B: Additional Reinvestment Amount is $125.00', resB.additionalReinvestmentAmount, 125.00);
check('Test B: Raw Reinvestment is $612.35', resB.rawReinvestment, 612.35);
check('Test B: Total Inventory Reinvestment (Math.ceil) is $613.00', resB.totalInventoryReinvestment, 613.00);
check('Test B: Remaining Allocation Pool is $637.00', resB.remainingAllocationPool, 637.00);
check('Test B: hasShortfall is false', resB.hasShortfall, false);
check('Test B: reinvestmentShortfall is $0.00', resB.reinvestmentShortfall, 0.00);

// ----------------------------------------------------------------------------
// TEST C: 20% Additional Reinvestment
// ----------------------------------------------------------------------------
console.log('\n\x1b[36mRunning Test C (20% Additional Reinvestment)...\x1b[0m');
const resC = calculateInventoryReinvestmentAndPool({
  recordedSales: 1500.00,
  eligibleRevenue: 1250.00,
  actualProductCost: 487.35,
  additionalReinvestmentPercent: 20.0
});

check('Test C: Additional Reinvestment Amount is $250.00', resC.additionalReinvestmentAmount, 250.00);
check('Test C: Raw Reinvestment is $737.35', resC.rawReinvestment, 737.35);
check('Test C: Total Inventory Reinvestment (Math.ceil) is $738.00', resC.totalInventoryReinvestment, 738.00);
check('Test C: Remaining Allocation Pool is $512.00', resC.remainingAllocationPool, 512.00);
check('Test C: hasShortfall is false', resC.hasShortfall, false);

// ----------------------------------------------------------------------------
// TEST D: Exact Whole-Dollar Product Cost
// ----------------------------------------------------------------------------
console.log('\n\x1b[36mRunning Test D (Exact Whole-Dollar Product Cost)...\x1b[0m');
const resD = calculateInventoryReinvestmentAndPool({
  recordedSales: 1200.00,
  eligibleRevenue: 1000.00,
  actualProductCost: 400.00,
  additionalReinvestmentPercent: 10.0
});

check('Test D: Additional Reinvestment Amount is $100.00', resD.additionalReinvestmentAmount, 100.00);
check('Test D: Raw Reinvestment is $500.00', resD.rawReinvestment, 500.00);
check('Test D: Total Inventory Reinvestment is $500.00', resD.totalInventoryReinvestment, 500.00);
check('Test D: Remaining Allocation Pool is $500.00', resD.remainingAllocationPool, 500.00);

// ----------------------------------------------------------------------------
// TEST E: Fractional Product Cost Rounding (Math.ceil verification)
// ----------------------------------------------------------------------------
console.log('\n\x1b[36mRunning Test E (Fractional Product Cost Rounding)...\x1b[0m');
const resE = calculateInventoryReinvestmentAndPool({
  recordedSales: 1200.00,
  eligibleRevenue: 1000.00,
  actualProductCost: 400.01,
  additionalReinvestmentPercent: 0.0
});

check('Test E: Raw Reinvestment is $400.01', resE.rawReinvestment, 400.01);
check('Test E: Total Inventory Reinvestment (Math.ceil) is $401.00', resE.totalInventoryReinvestment, 401.00);
check('Test E: Remaining Allocation Pool is $599.00', resE.remainingAllocationPool, 599.00);

// ----------------------------------------------------------------------------
// TEST F: Shortfall Protection Safeguard (Total Reinvestment > Revenue)
// ----------------------------------------------------------------------------
console.log('\n\x1b[36mRunning Test F (Shortfall Protection Safeguard)...\x1b[0m');
const resF = calculateInventoryReinvestmentAndPool({
  recordedSales: 700.00,
  eligibleRevenue: 500.00,
  actualProductCost: 600.00,
  additionalReinvestmentPercent: 10.0
});

check('Test F: Additional Reinvestment Amount is $50.00', resF.additionalReinvestmentAmount, 50.00);
check('Test F: Raw Reinvestment is $650.00', resF.rawReinvestment, 650.00);
check('Test F: Total Inventory Reinvestment is $650.00', resF.totalInventoryReinvestment, 650.00);
check('Test F: Remaining Allocation Pool is strictly $0.00 (never negative)', resF.remainingAllocationPool, 0.00);
check('Test F: hasShortfall flag is true', resF.hasShortfall, true);
check('Test F: reinvestmentShortfall is $150.00', resF.reinvestmentShortfall, 150.00);

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n----------------------------------------------------------------------');
console.log(`Tests Passed: ${passed} | Tests Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32mALL TESTS A THROUGH F PASSED PERFECTLY!\x1b[0m\n');
}

