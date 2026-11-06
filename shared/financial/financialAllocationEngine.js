// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — FINANCIAL ALLOCATION & LEDGER ENGINE
// Authoritative Engine for Revenue Allocation, Capital Protection,
// Budget Carry-Forward, Loop Share, Month-End Closing & Imports
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDatabase } = require('../database/connection');

// Decimal-safe helper to eliminate floating point issues
function roundMoney(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

function getYearMonthKey(dateInput = null) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getPreviousMonthKey(yearMonth) {
  const [yStr, mStr] = yearMonth.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10);
  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

// ----------------------------------------------------------------------------
// 0. SCHEMA INTEGRITY: ENSURE INVENTORY REINVESTMENT & POOL COLUMNS
// ----------------------------------------------------------------------------
function ensureAllocationSchema() {
  const db = getDatabase();
  try {
    const cols = db.prepare('PRAGMA table_info(monthly_revenue_allocations)').all().map(c => c.name);
    const newCols = [
      { name: 'actual_product_cost', type: 'REAL DEFAULT 0.0' },
      { name: 'additional_reinvestment_percent', type: 'REAL DEFAULT 0.0' },
      { name: 'additional_reinvestment_amount', type: 'REAL DEFAULT 0.0' },
      { name: 'total_inventory_reinvestment', type: 'REAL DEFAULT 0.0' },
      { name: 'remaining_allocation_pool', type: 'REAL DEFAULT 0.0' },
      { name: 'inventory_reserve_balance', type: 'REAL DEFAULT 0.0' },
      { name: 'actual_inventory_purchases', type: 'REAL DEFAULT 0.0' },
      { name: 'reinvestment_shortfall', type: 'REAL DEFAULT 0.0' },
      { name: 'has_shortfall', type: 'INTEGER DEFAULT 0' }
    ];
    for (const col of newCols) {
      if (!cols.includes(col.name)) {
        db.prepare(`ALTER TABLE monthly_revenue_allocations ADD COLUMN ${col.name} ${col.type}`).run();
      }
    }
    const expCols = db.prepare('PRAGMA table_info(expenses)').all().map(c => c.name);
    if (!expCols.includes('budget_category_id')) {
      db.prepare("ALTER TABLE expenses ADD COLUMN budget_category_id TEXT DEFAULT 'OPERATING_EXPENSES'").run();
    }
  } catch (e) {
    // Non-fatal if already present
  }
}

// ----------------------------------------------------------------------------
// 1. PURE MASTER FORMULA: INVENTORY REINVESTMENT & REMAINING POOL (TESTS A-F)
// ----------------------------------------------------------------------------
function calculateInventoryReinvestmentAndPool({
  recordedSales = 0.0,
  eligibleRevenue = 0.0,
  actualProductCost = 0.0,
  additionalReinvestmentPercent = 0.0
}) {
  const eligibleRev = roundMoney(eligibleRevenue);
  const cost = roundMoney(actualProductCost);
  const pct = Number(additionalReinvestmentPercent || 0);

  // Section 3: Additional Reinvestment = Eligible Collected Revenue * Additional Reinvestment Percentage
  const additionalReinvestment = roundMoney(eligibleRev * (pct / 100.0));

  // Section 4: Whole-Dollar Rounding: round UP to next whole dollar using mathematical ceiling (Math.ceil)
  const rawReinvestment = roundMoney(cost + additionalReinvestment);
  const totalReinvestment = Math.ceil(rawReinvestment);

  // Section 5 & 6:
  let remainingAllocationPool = 0.0;
  let hasShortfall = false;
  let shortfall = 0.0;

  if (totalReinvestment > eligibleRev) {
    hasShortfall = true;
    shortfall = roundMoney(totalReinvestment - eligibleRev);
    remainingAllocationPool = 0.0;
  } else {
    remainingAllocationPool = roundMoney(eligibleRev - totalReinvestment);
  }

  return {
    recordedSales: roundMoney(recordedSales),
    eligibleRevenue: eligibleRev,
    actualProductCost: cost,
    additionalReinvestmentPercent: pct,
    additionalReinvestment,
    additionalReinvestmentAmount: additionalReinvestment,
    rawReinvestment,
    totalReinvestment,
    totalInventoryReinvestment: totalReinvestment,
    remainingAllocationPool,
    hasShortfall,
    shortfall,
    reinvestmentShortfall: shortfall
  };
}

// ----------------------------------------------------------------------------
// HELPER: RESOLVE VALID ORGANIZATION ID
// ----------------------------------------------------------------------------
function resolveOrgId(organizationId) {
  try {
    const db = getDatabase();
    if (organizationId) {
      const exists = db.prepare('SELECT id FROM organizations WHERE id = ?').get(organizationId);
      if (exists) return organizationId;
    }
    const defaultOrg = db.prepare('SELECT id FROM organizations LIMIT 1').get();
    if (defaultOrg && defaultOrg.id) return defaultOrg.id;
  } catch (e) {}
  return organizationId || 'org-loops-001';
}

// ----------------------------------------------------------------------------
// 2. COLLECTED REVENUE CALCULATION & ACTUAL PRODUCT COST
// ----------------------------------------------------------------------------
function calculateEligibleRevenue(organizationId, periodMonth, storeId = null) {
  const db = getDatabase();
  const orgId = resolveOrgId(organizationId);
  const [yearStr, monthStr] = periodMonth.split('-');
  const startIso = `${periodMonth}-01T00:00:00.000Z`;
  
  // Calculate end of month ISO
  const nextMonthKey = (() => {
    let y = parseInt(yearStr, 10);
    let m = parseInt(monthStr, 10);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    return `${y}-${String(m).padStart(2, '0')}-01T00:00:00.000Z`;
  })();

  let totalSales = 0.0;
  let collectedRevenue = 0.0;
  let refunds = 0.0;
  let actualProductCost = 0.0;

  try {
    let orderQuery = `
      SELECT id, total_minor, status, created_at, items_json, store_id
      FROM pos_orders
      WHERE organization_id = ? AND created_at >= ? AND created_at < ?
    `;
    const orderParams = [orgId, startIso, nextMonthKey];
    if (storeId && storeId !== 'ALL') {
      orderQuery += ` AND store_id = ?`;
      orderParams.push(storeId);
    }
    const orders = db.prepare(orderQuery).all(...orderParams);

    orders.forEach(o => {
      const orderTotal = roundMoney((o.total_minor || 0) / 100.0);

      if (o.status === 'REFUNDED') {
        refunds = roundMoney(refunds + orderTotal);
      } else if (o.status !== 'CANCELLED' && o.status !== 'VOID') {
        totalSales = roundMoney(totalSales + orderTotal);
        // Exclude unpaid invoices and outstanding receivables
        if (o.status === 'COMPLETED' || o.status === 'PAID') {
          collectedRevenue = roundMoney(collectedRevenue + orderTotal);
        } else if (o.status === 'PARTIAL_PAID' && o.paid_minor) {
          collectedRevenue = roundMoney(collectedRevenue + roundMoney(o.paid_minor / 100.0));
        } else {
          collectedRevenue = roundMoney(collectedRevenue + orderTotal);
        }

        // Calculate actual product cost from order lines
        if (o.items_json) {
          try {
            const items = JSON.parse(o.items_json);
            items.forEach(it => {
              const q = Number(it.quantity || 1);
              let costMinor = it.costMinor !== undefined ? it.costMinor : (it.cost ? it.cost * 100 : 0);
              if (!costMinor && (it.sku || it.productId)) {
                const prodRow = db.prepare(`
                  SELECT COALESCE(pv.cost_minor, p.cost_minor, 0) as cost_minor
                  FROM product_variants pv
                  LEFT JOIN products p ON pv.product_id = p.id
                  WHERE pv.sku = ? OR pv.product_id = ? OR p.id = ? OR p.code = ?
                  LIMIT 1
                `).get(it.sku, it.productId, it.productId, it.sku);
                if (prodRow && prodRow.cost_minor) {
                  costMinor = prodRow.cost_minor;
                }
              }
              const lineCost = roundMoney((q * costMinor) / 100.0);
              actualProductCost = roundMoney(actualProductCost + lineCost);
            });
          } catch (e) {}
        }
      }
    });
  } catch (e) {
    console.warn('[FinanceEngine] Error reading pos_orders:', e.message);
  }

  // Check stock_ledger for SALES COGS if not found on pos_orders
  if (actualProductCost === 0) {
    try {
      const ledgerRows = db.prepare(`
        SELECT delta, unit_cost_minor, type
        FROM stock_ledger
        WHERE organization_id = ? AND timestamp >= ? AND timestamp < ?
          AND type IN ('SALE', 'RETURN_STOCK', 'SALE_REFUND')
      `).all(orgId, startIso.replace('T', ' ').substring(0, 19), nextMonthKey.replace('T', ' ').substring(0, 19));

      ledgerRows.forEach(r => {
        const cost = roundMoney((Math.abs(r.delta || 0) * (r.unit_cost_minor || 0)) / 100.0);
        if (r.type === 'SALE') {
          actualProductCost = roundMoney(actualProductCost + cost);
        } else {
          actualProductCost = Math.max(0, roundMoney(actualProductCost - cost));
        }
      });
    } catch (e) {}
  }

  // 2. Also check invoices if any
  try {
    let invQuery = `
      SELECT total, paid_amount, status, created_at
      FROM invoices
      WHERE organization_id = ? AND created_at >= ? AND created_at < ?
    `;
    const invParams = [orgId, startIso, nextMonthKey];
    if (storeId && storeId !== 'ALL') {
      invQuery += ` AND store_id = ?`;
      invParams.push(storeId);
    }
    const invs = db.prepare(invQuery).all(...invParams);

    invs.forEach(inv => {
      if (inv.status !== 'CANCELLED' && inv.status !== 'DRAFT') {
        const invTotal = roundMoney(inv.total || 0);
        const invPaid = roundMoney(inv.paid_amount || 0);
        totalSales = roundMoney(totalSales + invTotal);
        collectedRevenue = roundMoney(collectedRevenue + invPaid);
      }
    });
  } catch (e) {}

  const outstandingReceivables = Math.max(0, roundMoney(totalSales - collectedRevenue));
  const eligibleRevenue = Math.max(0, roundMoney(collectedRevenue - refunds));

  return {
    organizationId: orgId,
    periodMonth,
    periodYear: parseInt(yearStr, 10),
    totalSales,
    collectedRevenue,
    outstandingReceivables,
    refunds,
    eligibleRevenue,
    actualProductCost
  };
}

// ----------------------------------------------------------------------------
// 3. DEFAULT ALLOCATION PLAN CONFIGURATION
// ----------------------------------------------------------------------------
function getDefaultAllocationCategories() {
  return [
    {
      id: 'EMPLOYEE_SALARIES',
      name: 'Employee Salaries',
      type: 'PERCENT',
      value: 40.0,
      priority: 1,
      allowsCarryForward: false,
      carryForwardAction: 'MANUAL_CHOICE',
      enabled: true,
      description: 'Payroll and staff wage allocations from Remaining Allocation Pool'
    },
    {
      id: 'OPERATING_EXPENSES',
      name: 'Operating Expenses',
      type: 'PERCENT',
      value: 30.0,
      priority: 2,
      allowsCarryForward: true,
      carryForwardAction: 'AUTO',
      enabled: true,
      description: 'Rent, utilities, wifi, office supplies from Remaining Allocation Pool'
    },
    {
      id: 'LOOP_SHARE',
      name: 'Loop Share (Profit Sharing)',
      type: 'PERCENT',
      value: 30.0,
      priority: 3,
      allowsCarryForward: true,
      carryForwardAction: 'AUTO',
      enabled: true,
      description: 'Confidential founder / stakeholder profit-sharing pool from Remaining Allocation Pool'
    },
    {
      id: 'RESERVE',
      name: 'Remaining Revenue / Capital Reserve',
      type: 'PERCENT',
      value: 0.0,
      priority: 4,
      allowsCarryForward: true,
      carryForwardAction: 'AUTO',
      enabled: true,
      description: 'Surplus and unallocated retained business reserve'
    }
  ];
}

// ----------------------------------------------------------------------------
// 3. GET OR INITIALIZE MONTHLY REVENUE ALLOCATION PLAN
// ----------------------------------------------------------------------------
function getOrCreateMonthlyPlan(organizationId, periodMonth, createdBy = 'Business Owner') {
  const db = getDatabase();
  ensureAllocationSchema();
  const orgId = resolveOrgId(organizationId);
  const [yearStr] = periodMonth.split('-');

  let planRow = db.prepare(`
    SELECT * FROM monthly_revenue_allocations
    WHERE organization_id = ? AND period_month = ?
  `).get(orgId, periodMonth);

  if (!planRow) {
    const id = `mra-${periodMonth}-${crypto.randomBytes(4).toString('hex')}`;
    const defaultCategories = getDefaultAllocationCategories();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO monthly_revenue_allocations
      (id, organization_id, period_month, period_year, status, eligible_revenue, total_allocated, unallocated_reserve, categories_config_json,
       actual_product_cost, additional_reinvestment_percent, additional_reinvestment_amount, total_inventory_reinvestment,
       remaining_allocation_pool, inventory_reserve_balance, actual_inventory_purchases, reinvestment_shortfall, has_shortfall,
       created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'ACTIVE', 0.0, 0.0, 0.0, ?, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0, ?, ?, ?)
    `).run(id, orgId, periodMonth, parseInt(yearStr, 10), JSON.stringify(defaultCategories), createdBy, now, now);

    planRow = db.prepare(`SELECT * FROM monthly_revenue_allocations WHERE id = ?`).get(id);
  }

  // Ensure category budget records exist
  let rawCategories = JSON.parse(planRow.categories_config_json || '[]');
  if (rawCategories.some(c => c.id === 'INVENTORY_REINVESTMENT')) {
    rawCategories = rawCategories.filter(c => c.id !== 'INVENTORY_REINVESTMENT');
    try {
      db.prepare('UPDATE monthly_revenue_allocations SET categories_config_json = ? WHERE id = ?').run(JSON.stringify(rawCategories), planRow.id);
    } catch (e) {}
  }
  const categories = rawCategories;
  const prevMonth = getPreviousMonthKey(periodMonth);

  // Ensure INVENTORY_REINVESTMENT row exists in budget_allocations
  let invBudget = db.prepare(`
    SELECT * FROM budget_allocations
    WHERE organization_id = ? AND period_month = ? AND category_id = 'INVENTORY_REINVESTMENT'
  `).get(orgId, periodMonth);
  if (!invBudget) {
    const budgetId = `ba-${periodMonth}-inv-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO budget_allocations
        (id, organization_id, period_month, category_id, category_name, allocation_type, allocation_value, allocated_amount, opening_carry_forward, available_budget, spent_amount, borrowed_from_capital, repaid_to_capital, remaining_balance, allows_carry_forward, carry_forward_action, created_at, updated_at)
        VALUES (?, ?, ?, 'INVENTORY_REINVESTMENT', 'Inventory Reinvestment & Reserve', 'FORMULA', 'COGS + %', 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1, 'AUTO', ?, ?)
      `).run(budgetId, orgId, periodMonth, now, now);
    } catch (e) {}
  }

  categories.forEach(cat => {
    let budgetRow = db.prepare(`
      SELECT * FROM budget_allocations
      WHERE organization_id = ? AND period_month = ? AND category_id = ?
    `).get(orgId, periodMonth, cat.id);

    if (!budgetRow) {
      // Check carry-forward from previous month
      let openingCarryForward = 0.0;
      if (cat.allowsCarryForward) {
        const prevBudget = db.prepare(`
          SELECT remaining_balance, carry_forward_action FROM budget_allocations
          WHERE organization_id = ? AND period_month = ? AND category_id = ?
        `).get(orgId, prevMonth, cat.id);

        if (prevBudget && prevBudget.remaining_balance > 0) {
          if (cat.id === 'EMPLOYEE_SALARIES') {
            if (prevBudget.carry_forward_action === 'CARRY_FORWARD') {
              openingCarryForward = roundMoney(prevBudget.remaining_balance);
            }
          } else {
            openingCarryForward = roundMoney(prevBudget.remaining_balance);
          }
        }
      }

      const budgetId = `ba-${periodMonth}-${cat.id.toLowerCase()}-${crypto.randomBytes(3).toString('hex')}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO budget_allocations
        (id, organization_id, period_month, category_id, category_name, allocation_type, allocation_value, allocated_amount, opening_carry_forward, available_budget, spent_amount, borrowed_from_capital, repaid_to_capital, remaining_balance, allows_carry_forward, carry_forward_action, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, 0.0, 0.0, 0.0, ?, ?, ?, ?, ?)
      `).run(
        budgetId,
        orgId,
        periodMonth,
        cat.id,
        cat.name,
        cat.type,
        cat.value,
        openingCarryForward,
        openingCarryForward,
        openingCarryForward,
        cat.allowsCarryForward ? 1 : 0,
        cat.carryForwardAction || 'AUTO',
        now,
        now
      );
    }
  });

  return syncMonthlyAllocations(orgId, periodMonth);
}

// ----------------------------------------------------------------------------
// 4. SYNC LIVE MONTHLY ALLOCATIONS & BALANCES
// ----------------------------------------------------------------------------
function syncMonthlyAllocations(organizationId, periodMonth) {
  const db = getDatabase();
  ensureAllocationSchema();
  const orgId = resolveOrgId(organizationId);
  const rev = calculateEligibleRevenue(orgId, periodMonth);

  const planRow = db.prepare(`
    SELECT * FROM monthly_revenue_allocations
    WHERE organization_id = ? AND period_month = ?
  `).get(orgId, periodMonth);

  if (!planRow) return null;

  const categories = JSON.parse(planRow.categories_config_json || '[]');
  const additionalPercent = planRow.additional_reinvestment_percent !== undefined && planRow.additional_reinvestment_percent !== null
    ? Number(planRow.additional_reinvestment_percent)
    : 0.0;

  // Master Pure Formula Calculation per Sections 1-6
  const calc = calculateInventoryReinvestmentAndPool({
    recordedSales: rev.totalSales,
    eligibleRevenue: rev.eligibleRevenue,
    actualProductCost: rev.actualProductCost,
    additionalReinvestmentPercent: additionalPercent
  });

  let totalAllocatedExcludingInv = 0.0;

  // 1. Calculate allocated amounts per category:
  // - INVENTORY_REINVESTMENT uses totalInventoryReinvestment
  // - Other percentage categories (Salaries, OPEX, Loop Share) calculate against remainingAllocationPool!
  categories.forEach(cat => {
    let allocated = 0.0;
    if (cat.enabled !== false) {
      if (cat.id === 'INVENTORY_REINVESTMENT') {
        allocated = calc.totalInventoryReinvestment;
      } else if (cat.type === 'PERCENT') {
        allocated = roundMoney(calc.remainingAllocationPool * (Number(cat.value) / 100));
        totalAllocatedExcludingInv = roundMoney(totalAllocatedExcludingInv + allocated);
      } else {
        allocated = roundMoney(Number(cat.value));
        totalAllocatedExcludingInv = roundMoney(totalAllocatedExcludingInv + allocated);
      }
    }
    cat.calculatedAmount = allocated;
  });

  const totalAllocated = roundMoney(calc.totalInventoryReinvestment + totalAllocatedExcludingInv);
  const unallocatedReserve = Math.max(0, roundMoney(calc.remainingAllocationPool - totalAllocatedExcludingInv));

  // Compute actual inventory purchases for Section 7
  let actualInventoryPurchases = 0.0;
  try {
    const [yStr, mStr] = periodMonth.split('-');
    const startIso = `${periodMonth}-01T00:00:00.000Z`;
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + 1;
    if (m > 12) { m = 1; y += 1; }
    const nextIso = `${y}-${String(m).padStart(2, '0')}-01T00:00:00.000Z`;

    const billSum = db.prepare(`
      SELECT SUM(amount) as total
      FROM supplier_bills
      WHERE (organization_id = ? OR organization_id IS NULL)
        AND bill_date >= ? AND bill_date < ?
        AND payment_status = 'PAID'
    `).get(orgId, startIso, nextIso);

    if (billSum && billSum.total) {
      actualInventoryPurchases = roundMoney(billSum.total);
    }
  } catch (e) {}

  const inventoryReserveBalance = Math.max(0, roundMoney(calc.totalInventoryReinvestment - actualInventoryPurchases));

  // Update plan record with all required master calculation columns
  db.prepare(`
    UPDATE monthly_revenue_allocations
    SET eligible_revenue = ?,
        total_allocated = ?,
        unallocated_reserve = ?,
        actual_product_cost = ?,
        additional_reinvestment_percent = ?,
        additional_reinvestment_amount = ?,
        total_inventory_reinvestment = ?,
        remaining_allocation_pool = ?,
        inventory_reserve_balance = ?,
        actual_inventory_purchases = ?,
        reinvestment_shortfall = ?,
        has_shortfall = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    rev.eligibleRevenue,
    totalAllocated,
    unallocatedReserve,
    calc.actualProductCost,
    calc.additionalReinvestmentPercent,
    calc.additionalReinvestmentAmount,
    calc.totalInventoryReinvestment,
    calc.remainingAllocationPool,
    inventoryReserveBalance,
    actualInventoryPurchases,
    calc.reinvestmentShortfall,
    calc.hasShortfall ? 1 : 0,
    new Date().toISOString(),
    planRow.id
  );

  // 2. Update each category budget record and compute real spending
  const prevMonthKey = getPreviousMonthKey(periodMonth);
  const prevBudgets = db.prepare(`
    SELECT category_id, remaining_balance, allows_carry_forward, carry_forward_action, borrowed_from_capital, repaid_to_capital
    FROM budget_allocations
    WHERE organization_id = ? AND period_month = ?
  `).all(orgId, prevMonthKey);
  const prevMap = {};
  prevBudgets.forEach(pb => { prevMap[pb.category_id] = pb; });

  const budgetRows = db.prepare(`
    SELECT * FROM budget_allocations
    WHERE organization_id = ? AND period_month = ?
  `).all(orgId, periodMonth);

  budgetRows.forEach(b => {
    // Dynamic Carry-Forward Integrity:
    // If previous month has net capital debt or remaining balance is 0 or less, carry-forward MUST be exactly 0.00!
    const pb = prevMap[b.category_id];
    let correctCarryForward = 0.0;
    if (pb && b.allows_carry_forward) {
      const netCapitalDebt = roundMoney((pb.borrowed_from_capital || 0) - (pb.repaid_to_capital || 0));
      if (netCapitalDebt > 0 || pb.remaining_balance <= 0) {
        correctCarryForward = 0.0;
      } else {
        if (b.category_id === 'EMPLOYEE_SALARIES') {
          if (pb.carry_forward_action === 'CARRY_FORWARD') {
            correctCarryForward = roundMoney(pb.remaining_balance);
          }
        } else {
          correctCarryForward = roundMoney(pb.remaining_balance);
        }
      }
    }

    if (roundMoney(b.opening_carry_forward || 0) !== correctCarryForward) {
      b.opening_carry_forward = correctCarryForward;
      try {
        db.prepare(`UPDATE budget_allocations SET opening_carry_forward = ?, updated_at = ? WHERE id = ?`).run(correctCarryForward, new Date().toISOString(), b.id);
      } catch (e) {}
    }

    const config = categories.find(c => c.id === b.category_id) || {};
    let allocated = config.calculatedAmount || 0.0;
    let available = roundMoney((b.opening_carry_forward || 0.0) + allocated);

    // Compute actual spending in this category for this month
    let actualSpent = b.spent_amount || 0.0;

    // A. Operating expenses
    if (b.category_id === 'OPERATING_EXPENSES') {
      try {
        const [yStr, mStr] = periodMonth.split('-');
        const startIso = `${periodMonth}-01T00:00:00.000Z`;
        let y = parseInt(yStr, 10);
        let m = parseInt(mStr, 10) + 1;
        if (m > 12) { m = 1; y += 1; }
        const nextIso = `${y}-${String(m).padStart(2, '0')}-01T00:00:00.000Z`;

        const expSum = db.prepare(`
          SELECT SUM(amount_minor) as total_minor
          FROM expenses
          WHERE (organization_id = ? OR organization_id IS NULL)
            AND date >= ? AND date < ?
            AND (budget_category_id = 'OPERATING_EXPENSES' OR (budget_category_id IS NULL AND category NOT LIKE '%Payroll%' AND category NOT LIKE '%Salary%' AND category NOT LIKE '%Wage%'))
        `).get(orgId, startIso, nextIso);

        if (expSum && expSum.total_minor) {
          actualSpent = roundMoney(expSum.total_minor / 100.0);
        }
      } catch (e) {}
    }

    // B. Employee Salaries & Staff Payroll
    if (b.category_id === 'EMPLOYEE_SALARIES') {
      try {
        const [yStr, mStr] = periodMonth.split('-');
        const startIso = `${periodMonth}-01T00:00:00.000Z`;
        let y = parseInt(yStr, 10);
        let m = parseInt(mStr, 10) + 1;
        if (m > 12) { m = 1; y += 1; }
        const nextIso = `${y}-${String(m).padStart(2, '0')}-01T00:00:00.000Z`;

        const salSum = db.prepare(`
          SELECT SUM(amount_minor) as total_minor
          FROM expenses
          WHERE (organization_id = ? OR organization_id IS NULL)
            AND date >= ? AND date < ?
            AND (budget_category_id = 'EMPLOYEE_SALARIES' OR category LIKE '%Payroll%' OR category LIKE '%Salary%' OR category LIKE '%Wage%')
        `).get(orgId, startIso, nextIso);

        if (salSum && salSum.total_minor) {
          actualSpent = roundMoney(salSum.total_minor / 100.0);
        }
      } catch (e) {}
    }

    // C. Inventory Purchases (from Top Section 2 Calculation)
    if (b.category_id === 'INVENTORY_REINVESTMENT') {
      allocated = calc.totalInventoryReinvestment;
      available = calc.totalInventoryReinvestment;
      actualSpent = actualInventoryPurchases;
    }

    // D. Store Share (Profit Sharing) Payouts & Sync
    if (b.category_id === 'LOOP_SHARE') {
      try {
        const distSum = db.prepare(`
          SELECT SUM(amount) as total_dist
          FROM loop_share_ledger
          WHERE (organization_id = ? OR organization_id IS NULL)
            AND period_month = ?
            AND transaction_type IN ('DISTRIBUTION', 'WITHDRAWAL', 'PAYMENT')
        `).get(orgId, periodMonth);
        if (distSum && distSum.total_dist) {
          actualSpent = roundMoney(distSum.total_dist);
        }

        const currentAlloc = roundMoney(allocated);
        if (currentAlloc > 0) {
          const existingAlloc = db.prepare(`
            SELECT * FROM loop_share_ledger
            WHERE (organization_id = ? OR organization_id IS NULL)
              AND period_month = ?
              AND transaction_type = 'ALLOCATION'
          `).get(orgId, periodMonth);

          const nowIso = new Date().toISOString();
          if (!existingAlloc) {
            db.prepare(`
              INSERT INTO loop_share_ledger
              (id, organization_id, period_month, transaction_type, amount, balance_after, date, reference, recipient_name, description, authorized_by, created_at)
              VALUES (?, ?, ?, 'ALLOCATION', ?, ?, ?, ?, 'Store Share Reserve', ?, 'Revenue Allocation Engine', ?)
            `).run(
              `ls-${crypto.randomUUID()}`,
              orgId,
              periodMonth,
              currentAlloc,
              currentAlloc,
              nowIso,
              `SHARE-ALLOC-${periodMonth.replace('-', '')}`,
              `Monthly Profit Sharing Allocation (${periodMonth})`,
              nowIso
            );
          } else if (Math.abs(existingAlloc.amount - currentAlloc) > 0.01) {
            const diff = roundMoney(currentAlloc - existingAlloc.amount);
            db.prepare(`
              UPDATE loop_share_ledger
              SET amount = ?, balance_after = balance_after + ?, updated_at = ?
              WHERE id = ?
            `).run(currentAlloc, diff, nowIso, existingAlloc.id);
          }
        }
      } catch (e) {
        console.warn('[FinanceEngine] Store share sync error:', e.message);
      }
    }

    // Remaining balance
    const remaining = b.category_id === 'INVENTORY_REINVESTMENT' 
      ? inventoryReserveBalance 
      : Math.max(0, roundMoney(available - actualSpent));

    db.prepare(`
      UPDATE budget_allocations
      SET allocated_amount = ?, available_budget = ?, spent_amount = ?, remaining_balance = ?, updated_at = ?
      WHERE id = ?
    `).run(allocated, available, actualSpent, remaining, new Date().toISOString(), b.id);
  });

  return getMonthlyDashboardData(orgId, periodMonth);
}

// ----------------------------------------------------------------------------
// 5. GET MONTHLY LIVE DASHBOARD TELEMETRY
// ----------------------------------------------------------------------------
function getMonthlyDashboardData(organizationId, periodMonth) {
  const db = getDatabase();
  const orgId = resolveOrgId(organizationId);

  const rev = calculateEligibleRevenue(orgId, periodMonth);
  const plan = db.prepare(`
    SELECT * FROM monthly_revenue_allocations
    WHERE organization_id = ? AND period_month = ?
  `).get(orgId, periodMonth);

  const budgets = db.prepare(`
    SELECT * FROM budget_allocations
    WHERE organization_id = ? AND period_month = ?
    ORDER BY created_at ASC
  `).all(orgId, periodMonth);

  // Capital Account Balances
  let capitalBalance = 0.0;
  try {
    const capAccount = db.prepare(`
      SELECT COALESCE(current_equity, (total_invested - total_withdrawn), 0.0) as balance FROM capital_accounts
      WHERE organization_id = ? LIMIT 1
    `).get(orgId);
    if (capAccount && capAccount.balance !== undefined && capAccount.balance !== null) {
      capitalBalance = roundMoney(capAccount.balance);
    }
  } catch (e) {}

  // Live Cash Now from general ledger
  let cashNow = 0.0;
  try {
    const { getExecutiveDashboardData } = require('../../account_system_Loops/backend/src/db');
    const dash = getExecutiveDashboardData(orgId);
    if (dash && dash.kpiCards && typeof dash.kpiCards.cashNow === 'number') {
      cashNow = roundMoney(dash.kpiCards.cashNow);
    }
  } catch (e) {
    cashNow = capitalBalance;
  }

  // All Capital Borrowings
  const allBorrowings = db.prepare(`
    SELECT * FROM capital_borrowings
    WHERE organization_id = ?
    ORDER BY date DESC, created_at DESC
  `).all(orgId);

  // Active (Unresolved) Capital Borrowings
  const activeBorrowings = allBorrowings.filter(b => b.status !== 'FULLY_REPAID' && b.status !== 'NOT_TO_PAY' && Number(b.outstanding_amount || 0) > 0);

  const totalBorrowed = allBorrowings.reduce((s, b) => roundMoney(s + (b.amount || 0)), 0);
  const totalRepaid = allBorrowings.reduce((s, b) => roundMoney(s + (b.repaid_amount || 0)), 0);
  const totalOutstandingRepayment = activeBorrowings.reduce((s, b) => roundMoney(s + (b.outstanding_amount || 0)), 0);
  const effectiveCapital = cashNow > 0 ? cashNow : capitalBalance;
  const netLiquidCash = Math.max(0, roundMoney(effectiveCapital - totalOutstandingRepayment));

  // Store / Loop Share Telemetry (Net pool balance)
  let loopShareBalance = 0.0;
  try {
    const netShare = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type IN ('ALLOCATION', 'ADJUSTMENT_ADD') THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN transaction_type IN ('DISTRIBUTION', 'WITHDRAWAL', 'PAYMENT', 'ADJUSTMENT_SUB') THEN amount ELSE 0 END), 0) as balance
      FROM loop_share_ledger
      WHERE organization_id = ? OR organization_id IS NULL
    `).get(orgId);
    if (netShare && netShare.balance !== null) {
      loopShareBalance = Math.max(0, roundMoney(netShare.balance));
    }
  } catch (e) {}

  // 17 Metrics from Master Requirements Sections 1-8
  const addlPct = plan ? Number(plan.additional_reinvestment_percent || 0.0) : 0.0;
  const addlAmt = plan ? Number(plan.additional_reinvestment_amount || 0.0) : 0.0;
  const rawReinv = roundMoney(rev.actualProductCost + addlAmt);
  const totalReinv = plan ? Number(plan.total_inventory_reinvestment || 0.0) : Math.ceil(rawReinv);
  const remPool = plan ? Number(plan.remaining_allocation_pool || 0.0) : Math.max(0, roundMoney(rev.eligibleRevenue - totalReinv));
  const hasShort = plan ? Boolean(plan.has_shortfall) : (totalReinv > rev.eligibleRevenue);
  const shortAmt = plan ? Number(plan.reinvestment_shortfall || 0.0) : (hasShort ? roundMoney(totalReinv - rev.eligibleRevenue) : 0.0);
  const invPurchases = plan ? Number(plan.actual_inventory_purchases || 0.0) : 0.0;
  const invReserve = plan ? Number(plan.inventory_reserve_balance || 0.0) : Math.max(0, roundMoney(totalReinv - invPurchases));
  const invPurchShortfall = invPurchases > totalReinv ? roundMoney(invPurchases - totalReinv) : 0.0;

  const metrics = {
    // Section 1: Financial Calculation Basis (5 figures)
    totalRecordedSales: rev.totalSales,
    collectedPayments: rev.collectedRevenue,
    outstandingReceivables: rev.outstandingReceivables,
    refundsReversals: rev.refunds,
    eligibleCollectedRevenue: rev.eligibleRevenue,

    // Section 2, 3, 4: Inventory Reinvestment (5 figures)
    actualProductCost: rev.actualProductCost,
    additionalReinvestmentPercent: addlPct,
    additionalReinvestmentAmount: addlAmt,
    rawReinvestment: rawReinv,
    totalInventoryReinvestment: totalReinv,

    // Section 5, 6: Remaining Allocation Pool & Safeguard (3 figures)
    remainingAllocationPool: remPool,
    hasShortfall: hasShort,
    reinvestmentShortfall: shortAmt,

    // Section 7: Inventory Reserve & Actual Purchases (4 figures)
    inventoryReserveOpening: totalReinv,
    actualInventoryPurchases: invPurchases,
    inventoryReserveBalance: invReserve,
    inventoryReserveShortfall: invPurchShortfall
  };

  return {
    organizationId: orgId,
    periodMonth,
    revenue: rev,
    metrics,
    plan: plan ? {
      ...plan,
      categoriesConfig: JSON.parse(plan.categories_config_json || '[]')
    } : null,
    budgets,
    capital: {
      balance: effectiveCapital,
      cashNow: effectiveCapital,
      netLiquidCash,
      borrowed: totalBorrowed,
      repaid: totalRepaid,
      outstandingRepayment: totalOutstandingRepayment,
      activeBorrowings,
      allBorrowings
    },
    loopShare: {
      balance: loopShareBalance
    }
  };
}

// ----------------------------------------------------------------------------
// 6. RECORD EXPENSE WITH CAPITAL PROTECTION & BORROWING SHORTAGE
// ----------------------------------------------------------------------------
function recordExpenseWithCapitalProtection({
  organizationId,
  periodMonth,
  categoryId = 'OPERATING_EXPENSES',
  expenseCategory,
  amount,
  description,
  paymentDate,
  invoiceRef = '',
  supplierName = '',
  performedBy = 'Administrator',
  allowCapitalBorrowing = true
}) {
  const db = getDatabase();
  const orgId = resolveOrgId(organizationId);
  const monthKey = periodMonth || getYearMonthKey(paymentDate);
  const totalExpense = roundMoney(amount);

  if (totalExpense <= 0) {
    return { ok: false, error: 'Expense amount must be greater than zero.' };
  }

  // Ensure monthly plan exists
  getOrCreateMonthlyPlan(orgId, monthKey, performedBy);

  // Fetch current budget allocation
  const budget = db.prepare(`
    SELECT * FROM budget_allocations
    WHERE organization_id = ? AND period_month = ? AND category_id = ?
  `).get(orgId, monthKey, categoryId);

  if (!budget) {
    return { ok: false, error: `Budget allocation category '${categoryId}' not found for month ${monthKey}.` };
  }

  const availableBudget = roundMoney(budget.remaining_balance || 0);

  let budgetDeduction = 0.0;
  let capitalBorrowingRequired = 0.0;

  if (availableBudget >= totalExpense) {
    // Expense budget has sufficient funds: capital is untouched!
    budgetDeduction = totalExpense;
    capitalBorrowingRequired = 0.0;
  } else {
    // Insufficient funds: use remaining budget first, borrow shortage from capital
    budgetDeduction = availableBudget;
    capitalBorrowingRequired = roundMoney(totalExpense - availableBudget);

    if (!allowCapitalBorrowing) {
      return {
        ok: false,
        shortage: capitalBorrowingRequired,
        error: `Insufficient budget ($${availableBudget.toFixed(2)} available). Shortage of $${capitalBorrowingRequired.toFixed(2)} requires authorized capital borrowing approval.`
      };
    }
  }

  // Record borrowing if shortage exists
  let borrowingRecord = null;
  if (capitalBorrowingRequired > 0) {
    const borrowRef = `CAP-BORR-${monthKey.replace('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const borrowId = `cb-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO capital_borrowings
      (id, borrowing_ref, organization_id, period_month, date, budget_category_id, amount, repaid_amount, outstanding_amount, status, reason, user_name, approved_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, ?, 'OUTSTANDING', ?, ?, ?, ?, ?)
    `).run(
      borrowId,
      borrowRef,
      orgId,
      monthKey,
      paymentDate || now,
      categoryId,
      capitalBorrowingRequired,
      capitalBorrowingRequired,
      `Capital borrowing advance for ${expenseCategory || 'expense'}: ${description}`,
      performedBy,
      performedBy,
      now,
      now
    );

    borrowingRecord = {
      id: borrowId,
      borrowingRef: borrowRef,
      amount: capitalBorrowingRequired,
      outstandingAmount: capitalBorrowingRequired
    };

    // Deduct from capital account
    try {
      db.prepare(`
        UPDATE capital_accounts
        SET current_equity = COALESCE(current_equity, 0.0) - ?
        WHERE organization_id = ?
      `).run(capitalBorrowingRequired, orgId);
    } catch (e) {}

    // Update budget's borrowed_from_capital
    db.prepare(`
      UPDATE budget_allocations
      SET borrowed_from_capital = borrowed_from_capital + ?, updated_at = ?
      WHERE id = ?
    `).run(capitalBorrowingRequired, now, budget.id);
  }

  // Create standard expense record in expenses table
  const expenseId = `exp-${crypto.randomUUID()}`;
  const expenseNumber = `EXP-${Date.now().toString().slice(-6)}`;
  const amountMinor = Math.round(totalExpense * 100);
  const now = new Date().toISOString();
  const payee = supplierName || (description && description.includes('—') ? description.split('—')[0].trim() : (categoryId === 'EMPLOYEE_SALARIES' ? 'Staff Payee' : 'Vendor Payee'));

  try { db.exec("ALTER TABLE expenses ADD COLUMN vendor_payee TEXT;"); } catch (e) {}
  try { db.exec("ALTER TABLE expenses ADD COLUMN notes TEXT;"); } catch (e) {}

  try {
    db.prepare(`
      INSERT INTO expenses
      (id, organization_id, expense_number, category, budget_category_id, amount_minor, payment_method, date, description, vendor_payee, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'CASH', ?, ?, ?, ?, ?)
    `).run(
      expenseId,
      orgId,
      expenseNumber,
      expenseCategory || (categoryId === 'EMPLOYEE_SALARIES' ? 'Payroll & Staff Wages' : 'Operational'),
      categoryId || 'OPERATING_EXPENSES',
      amountMinor,
      paymentDate || now,
      description,
      payee,
      description,
      now
    );
  } catch (e) {
    try {
      db.prepare(`
        INSERT INTO expenses
        (id, organization_id, expense_number, category, budget_category_id, amount_minor, payment_method, date, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'CASH', ?, ?, ?)
      `).run(
        expenseId,
        orgId,
        expenseNumber,
        expenseCategory || (categoryId === 'EMPLOYEE_SALARIES' ? 'Payroll & Staff Wages' : 'Operational'),
        categoryId || 'OPERATING_EXPENSES',
        amountMinor,
        paymentDate || now,
        description,
        now
      );
    } catch (err2) {
      console.warn('[FinanceEngine] Could not write to expenses table:', err2.message);
    }
  }

  // Record in master financial transaction history
  recordFinancialTransaction({
    organizationId: orgId,
    date: paymentDate || now,
    transactionType: categoryId === 'EMPLOYEE_SALARIES' ? 'SALARY_PAYMENT' : 'EXPENSE_PAYMENT',
    category: expenseCategory || (categoryId === 'EMPLOYEE_SALARIES' ? 'Payroll & Staff Wages' : 'Operating Expense'),
    amount: totalExpense,
    sourceAccount: capitalBorrowingRequired > 0 
      ? `Budget ($${budgetDeduction}) + Capital ($${capitalBorrowingRequired})` 
      : (categoryId === 'EMPLOYEE_SALARIES' ? 'Salaries Budget' : 'Operating Budget'),
    destinationAccount: supplierName || (categoryId === 'EMPLOYEE_SALARIES' ? 'Staff Employee' : 'Operational Expense'),
    referenceId: expenseId,
    performedBy,
    description: `${description} [Budget: $${budgetDeduction.toFixed(2)}, Capital Borrowed: $${capitalBorrowingRequired.toFixed(2)}]`
  });

  // Auto-post double-entry expense journal entry so Cash and Profit update in General Ledger
  try {
    const { postJournalEntry, getAccountByCode } = require('../../account_system_Loops/backend/src/db');
    let expenseAccountCode = '6050';
    const catCheck = `${categoryId || ''} ${expenseCategory || ''} ${description || ''}`.toLowerCase();
    if (categoryId === 'EMPLOYEE_SALARIES' || catCheck.includes('payroll') || catCheck.includes('salary') || catCheck.includes('wage')) {
      expenseAccountCode = '6040'; // Payroll & Staff Wages
    } else if (catCheck.includes('rent') || catCheck.includes('utilit') || catCheck.includes('electric') || catCheck.includes('water')) {
      expenseAccountCode = '6030'; // Rent & Store Utilities
    } else if (catCheck.includes('marketing') || catCheck.includes('advertis')) {
      expenseAccountCode = '6020'; // Marketing & Advertising
    } else if (catCheck.includes('direct selling') || catCheck.includes('shipping')) {
      expenseAccountCode = '6010'; // Direct Selling
    } else if (catCheck.includes('equip') || catCheck.includes('maintenance') || catCheck.includes('admin') || catCheck.includes('software')) {
      expenseAccountCode = '6050'; // Admin / Software / Store Equipment
    }

    const expAcc = (getAccountByCode && getAccountByCode(expenseAccountCode)) || { name: 'Operating Expense' };
    const isCashPay = (paymentMethod || 'CASH').toUpperCase() === 'CASH';
    const paymentAccountCode = isCashPay ? '1010' : '1020';
    const paymentAccountName = isCashPay ? 'Cash in Register Drawer' : 'Bank Operating Account';

    postJournalEntry({
      sourceType: 'EXPENSE',
      sourceId: expenseId,
      organizationId: orgId,
      accountingDate: paymentDate || now.slice(0, 10),
      memo: `Expense: ${payee} — ${expenseCategory || 'Operating Expense'}`,
      lines: [
        {
          accountCode: expenseAccountCode,
          accountName: expAcc.name,
          debit: totalExpense,
          credit: 0
        },
        {
          accountCode: paymentAccountCode,
          accountName: paymentAccountName,
          debit: 0,
          credit: totalExpense
        }
      ]
    });
  } catch (jErr) {
    console.warn('[FinanceEngine] Could not post journal entry for expense:', jErr.message);
  }

  syncMonthlyAllocations(orgId, monthKey);

  return {
    ok: true,
    expenseId,
    totalExpense,
    budgetDeducted: budgetDeduction,
    capitalBorrowed: capitalBorrowingRequired,
    borrowingRecord,
    message: capitalBorrowingRequired > 0
      ? `Expense of $${totalExpense.toFixed(2)} recorded: $${budgetDeduction.toFixed(2)} deducted from budget, $${capitalBorrowingRequired.toFixed(2)} borrowed from capital.`
      : `Expense of $${totalExpense.toFixed(2)} fully funded by operating budget. Capital untouched.`
  };
}

// ----------------------------------------------------------------------------
// 7. CAPITAL REPAYMENT ENGINE
// ----------------------------------------------------------------------------
function processCapitalRepayment({
  organizationId,
  borrowingId,
  amount,
  sourceCategoryId = 'OPERATING_EXPENSES',
  performedBy = 'Administrator',
  notes = ''
}) {
  const db = getDatabase();
  const orgId = resolveOrgId(organizationId);
  const repayAmount = roundMoney(amount);

  if (repayAmount <= 0) {
    return { ok: false, error: 'Repayment amount must be greater than zero.' };
  }

  const borrowing = db.prepare(`
    SELECT * FROM capital_borrowings
    WHERE id = ? AND organization_id = ?
  `).get(borrowingId, orgId);

  if (!borrowing) {
    return { ok: false, error: 'Capital borrowing record not found.' };
  }

  if (borrowing.status === 'FULLY_REPAID' || borrowing.outstanding_amount <= 0) {
    return { ok: false, error: 'This capital borrowing is already fully repaid.' };
  }

  const actualRepay = Math.min(repayAmount, roundMoney(borrowing.outstanding_amount));
  const newOutstanding = roundMoney(borrowing.outstanding_amount - actualRepay);
  const newRepaidTotal = roundMoney(borrowing.repaid_amount + actualRepay);
  const newStatus = newOutstanding <= 0.01 ? 'FULLY_REPAID' : 'PARTIALLY_REPAID';
  const now = new Date().toISOString();

  // 0. Enforce Allocation Funding & Sufficiency Check
  // If expense borrowed the capital, that expense budget must be used and have enough money to pay back
  const effectiveCategoryId = sourceCategoryId || borrowing.budget_category_id || 'OPERATING_EXPENSES';
  const monthKey = borrowing.period_month || new Date().toISOString().slice(0, 7);

  let sourceBudget = db.prepare(`
    SELECT * FROM budget_allocations
    WHERE organization_id = ? AND period_month = ? AND category_id = ?
  `).get(orgId, monthKey, effectiveCategoryId);

  if (!sourceBudget) {
    const curMonth = new Date().toISOString().slice(0, 7);
    sourceBudget = db.prepare(`
      SELECT * FROM budget_allocations
      WHERE organization_id = ? AND period_month = ? AND category_id = ?
    `).get(orgId, curMonth, effectiveCategoryId);
  }

  const categoryLabel = sourceBudget?.category_name || (effectiveCategoryId === 'EMPLOYEE_SALARIES' ? 'Employee Salaries' : 'Operating Expenses');
  const availableBudget = roundMoney(sourceBudget?.remaining_balance || 0);

  if (!sourceBudget || availableBudget < actualRepay) {
    return {
      ok: false,
      error: `Insufficient budget in ${categoryLabel}. Available: $${availableBudget.toFixed(2)}, Required: $${actualRepay.toFixed(2)}. Cannot repay capital advance without sufficient allocated funds.`
    };
  }

  // Deduct repayment from source category budget
  db.prepare(`
    UPDATE budget_allocations
    SET spent_amount = spent_amount + ?,
        remaining_balance = remaining_balance - ?,
        repaid_to_capital = repaid_to_capital + ?,
        updated_at = ?
    WHERE id = ?
  `).run(actualRepay, actualRepay, actualRepay, now, sourceBudget.id);

  // 1. Update borrowing record
  db.prepare(`
    UPDATE capital_borrowings
    SET repaid_amount = ?, outstanding_amount = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(newRepaidTotal, Math.max(0, newOutstanding), newStatus, now, borrowingId);

  // 2. Insert repayment audit
  const repayRef = `CAP-REPAY-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const repayId = `cr-${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO capital_repayments
    (id, repayment_ref, borrowing_id, organization_id, period_month, date, amount, source_category_id, performed_by, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    repayId,
    repayRef,
    borrowingId,
    orgId,
    borrowing.period_month,
    now,
    actualRepay,
    sourceCategoryId,
    performedBy,
    notes,
    now
  );

  // 3. Restore capital account balance
  try {
    db.prepare(`
      UPDATE capital_accounts
      SET current_equity = COALESCE(current_equity, 0.0) + ?
      WHERE organization_id = ?
    `).run(actualRepay, orgId);
  } catch (e) {}

  // 4. Record financial transaction
  recordFinancialTransaction({
    organizationId: orgId,
    date: now,
    transactionType: 'CAPITAL_REPAYMENT',
    category: 'Capital Management',
    amount: actualRepay,
    sourceAccount: sourceCategoryId,
    destinationAccount: 'Business Capital',
    referenceId: repayId,
    performedBy,
    description: `Repaid $${actualRepay.toFixed(2)} to capital for borrowing ${borrowing.borrowing_ref}. Outstanding: $${newOutstanding.toFixed(2)}`
  });

  syncMonthlyAllocations(orgId, borrowing.period_month);

  return {
    ok: true,
    repaymentRef: repayRef,
    amountRepaid: actualRepay,
    remainingOutstanding: Math.max(0, newOutstanding),
    status: newStatus
  };
}

/**
 * 7b. CAPITAL BORROWING DISMISSAL (DECIDE NOT TO PAY)
 * When business owner decides not to pay/repay a capital borrowing advance:
 * 1. Mark borrowing status as 'NOT_TO_PAY'
 * 2. Set outstanding_amount = 0.0 (removes it from active borrowings)
 * 3. Log audit event and transaction record for full transparency and permanent history
 */
function dismissCapitalBorrowing({
  organizationId,
  borrowingId,
  performedBy = 'Administrator',
  reason = 'Written off / Owner decision not to pay'
}) {
  const db = getDatabase();
  const orgId = resolveOrgId(organizationId);

  const borrowing = db.prepare(`
    SELECT * FROM capital_borrowings
    WHERE id = ? AND organization_id = ?
  `).get(borrowingId, orgId);

  if (!borrowing) {
    return { ok: false, error: 'Capital borrowing record not found.' };
  }

  if (borrowing.status === 'FULLY_REPAID' || borrowing.status === 'NOT_TO_PAY') {
    return { ok: false, error: `Borrowing is already marked as ${borrowing.status}.` };
  }

  const dismissedAmount = roundMoney(borrowing.outstanding_amount);
  const now = new Date().toISOString();

  // 1. Update status to NOT_TO_PAY and zero out outstanding amount
  db.prepare(`
    UPDATE capital_borrowings
    SET outstanding_amount = 0.0, status = 'NOT_TO_PAY', reason = ?, updated_at = ?
    WHERE id = ?
  `).run(`${borrowing.reason || ''} [DECISION: NOT TO PAY - ${reason}]`, now, borrowingId);

  // 2. Audit log
  try {
    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, action, entity_type, entity_id, user_name, details, created_at)
      VALUES (?, ?, 'BORROWING_DISMISSED_NOT_TO_PAY', 'capital_borrowings', ?, ?, ?, ?)
    `).run(
      `aud-${crypto.randomUUID()}`,
      orgId,
      borrowingId,
      performedBy,
      JSON.stringify({ borrowingRef: borrowing.borrowing_ref, dismissedAmount, reason }),
      now
    );
  } catch (e) {}

  // 3. Record in master financial transaction history
  recordFinancialTransaction({
    organizationId: orgId,
    date: now,
    transactionType: 'CAPITAL_BORROWING_DISMISSED',
    category: 'Capital Management',
    amount: dismissedAmount,
    sourceAccount: 'CAPITAL_ACCOUNT',
    destinationAccount: borrowing.budget_category_id || 'OPERATING_EXPENSES',
    referenceId: borrowing.borrowing_ref,
    performedBy,
    description: `Borrowing dismissed without repayment (Owner decision not to pay): ${reason}`
  });

  syncMonthlyAllocations(orgId, borrowing.period_month);

  return {
    ok: true,
    message: `Borrowing ${borrowing.borrowing_ref} ($${dismissedAmount.toFixed(2)}) marked as Decide Not to Pay. Permanently recorded in borrowing history.`,
    borrowingId,
    dismissedAmount
  };
}

/**
 * Direct Capital Injection
 */
function injectCapital({ organizationId, amount, storeId = null, storeName = null, performedBy = 'Owner', notes = '' }) {
  const db = getDatabase();
  const orgId = resolveOrgId(organizationId);
  const val = roundMoney(amount);
  if (val <= 0) return { ok: false, error: 'Injection amount must be greater than zero.' };

  const now = new Date().toISOString();
  const txRef = `CAP-INJ-${Date.now().toString().slice(-6)}`;

  let cap = db.prepare('SELECT * FROM capital_accounts WHERE organization_id = ?').get(orgId);
  if (!cap) {
    db.prepare(`
      INSERT INTO capital_accounts (id, organization_id, partner_name, partner_role, ownership_percentage, total_invested, total_withdrawn, current_equity, notes, created_at)
      VALUES (?, ?, ?, 'Owner', 100.0, ?, 0, ?, ?, ?)
    `).run(`cap-${crypto.randomUUID().slice(0, 8)}`, orgId, performedBy, val, val, notes || 'Initial Capital Injection', now);
  } else {
    db.prepare(`
      UPDATE capital_accounts
      SET current_equity = COALESCE(current_equity, 0) + ?, total_invested = COALESCE(total_invested, 0) + ?
      WHERE id = ?
    `).run(val, val, cap.id);
  }

  recordFinancialTransaction({
    organizationId: orgId,
    date: now,
    transactionType: 'CAPITAL_INJECTION',
    category: 'Capital Management',
    amount: val,
    sourceAccount: 'Owner Capital Injection',
    destinationAccount: 'Business Capital Reserve',
    referenceId: txRef,
    performedBy,
    description: notes || `Direct capital injection of $${val.toFixed(2)} by ${performedBy}`
  });

  return { ok: true, amountInjected: val, reference: txRef };
}

/**
 * Direct Capital Withdrawal
 */
function withdrawCapital({ organizationId, amount, storeId = null, storeName = null, performedBy = 'Owner', notes = '' }) {
  const db = getDatabase();
  const orgId = resolveOrgId(organizationId);
  const val = roundMoney(amount);
  if (val <= 0) return { ok: false, error: 'Withdrawal amount must be greater than zero.' };

  let cap = db.prepare('SELECT * FROM capital_accounts WHERE organization_id = ?').get(orgId);
  const currentBal = cap ? Number(cap.current_equity || 0) : 0;
  if (currentBal < val) {
    return { ok: false, error: `Insufficient capital equity balance ($${currentBal.toFixed(2)} available). Cannot withdraw $${val.toFixed(2)}.` };
  }

  const now = new Date().toISOString();
  const txRef = `CAP-WDR-${Date.now().toString().slice(-6)}`;

  db.prepare(`
    UPDATE capital_accounts
    SET current_equity = current_equity - ?, total_withdrawn = COALESCE(total_withdrawn, 0) + ?
    WHERE id = ?
  `).run(val, val, cap.id);

  recordFinancialTransaction({
    organizationId: orgId,
    date: now,
    transactionType: 'CAPITAL_WITHDRAWAL',
    category: 'Capital Management',
    amount: val,
    sourceAccount: 'Business Capital Reserve',
    destinationAccount: 'Owner Drawing / Dividend',
    referenceId: txRef,
    performedBy,
    description: notes || `Capital withdrawal / owner draw of $${val.toFixed(2)} by ${performedBy}`
  });

  return { ok: true, amountWithdrawn: val, reference: txRef };
}

// ----------------------------------------------------------------------------
// 8. LOOP SHARE MANAGEMENT ENGINE
// ----------------------------------------------------------------------------
function recordLoopShareTransaction({
  organizationId,
  periodMonth,
  transactionType, // 'ALLOCATION', 'DISTRIBUTION', 'WITHDRAWAL', 'ADJUSTMENT'
  amount,
  recipientName = '',
  description,
  authorizedBy = 'Owner'
}) {
  const db = getDatabase();
  const orgId = resolveOrgId(organizationId);
  const monthKey = periodMonth || getYearMonthKey();
  const txAmount = roundMoney(amount);

  // Get current net balance
  const netShare = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN transaction_type IN ('ALLOCATION', 'ADJUSTMENT_ADD') THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN transaction_type IN ('DISTRIBUTION', 'WITHDRAWAL', 'PAYMENT', 'ADJUSTMENT_SUB') THEN amount ELSE 0 END), 0) as balance
    FROM loop_share_ledger
    WHERE organization_id = ? OR organization_id IS NULL
  `).get(orgId);

  const prevBalance = Math.max(0, roundMoney(netShare?.balance || 0));
  let newBalance = prevBalance;

  if (transactionType === 'ALLOCATION' || transactionType === 'ADJUSTMENT_ADD') {
    newBalance = roundMoney(prevBalance + txAmount);
  } else if (transactionType === 'DISTRIBUTION' || transactionType === 'WITHDRAWAL' || transactionType === 'PAYMENT') {
    if (txAmount > prevBalance) {
      return { ok: false, error: `Insufficient Store Share balance ($${prevBalance.toFixed(2)} available). Cannot distribute $${txAmount.toFixed(2)}.` };
    }
    newBalance = roundMoney(prevBalance - txAmount);
  }

  const txId = `ls-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO loop_share_ledger
    (id, organization_id, period_month, transaction_type, amount, balance_after, date, reference, recipient_name, description, authorized_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    txId,
    orgId,
    monthKey,
    transactionType,
    txAmount,
    newBalance,
    now,
    `LS-${monthKey.replace('-', '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    recipientName,
    description,
    authorizedBy,
    now
  );

  recordFinancialTransaction({
    organizationId: orgId,
    date: now,
    transactionType: 'LOOP_SHARE_DISTRIBUTION',
    category: 'Profit Sharing',
    amount: txAmount,
    sourceAccount: 'Loop Share Pool',
    destinationAccount: recipientName || 'Shareholder',
    referenceId: txId,
    performedBy: authorizedBy,
    description: `Store Share ${transactionType}: ${description}`
  });

  if (transactionType === 'DISTRIBUTION' || transactionType === 'WITHDRAWAL') {
    try {
      db.prepare(`
        UPDATE budget_allocations
        SET spent_amount = spent_amount + ?,
            remaining_balance = MAX(0, remaining_balance - ?),
            updated_at = ?
        WHERE (organization_id = ? OR organization_id IS NULL)
          AND period_month = ?
          AND category_id = 'LOOP_SHARE'
      `).run(txAmount, txAmount, now, orgId, monthKey);
    } catch (e) {}
  }

  return {
    ok: true,
    transactionId: txId,
    transactionType,
    amount: txAmount,
    previousBalance: prevBalance,
    newBalance
  };
}

// ----------------------------------------------------------------------------
// 9. AUTOMATIC MONTH-END CLOSING & SNAPSHOTS
// ----------------------------------------------------------------------------
function executeMonthEndClosing({
  organizationId,
  periodMonth,
  closedBy = 'Business Owner',
  salaryCarryForwardDecision = 'CARRY_FORWARD', // 'CARRY_FORWARD', 'RESET_TO_RESERVE', 'MANUAL_AMOUNT'
  manualSalaryAmount = 0.0
}) {
  const db = getDatabase();
  const orgId = resolveOrgId(organizationId);
  const [yearStr] = periodMonth.split('-');

  const [y, m] = periodMonth.split('-').map(Number);
  let nextY = y;
  let nextM = m + 1;
  if (nextM > 12) { nextM = 1; nextY += 1; }
  const nextMonthKey = `${nextY}-${String(nextM).padStart(2, '0')}`;

  // 1. Prevent duplicate closing
  const existing = db.prepare(`
    SELECT * FROM monthly_closing_snapshots
    WHERE organization_id = ? AND period_month = ? AND is_reopened = 0
  `).get(orgId, periodMonth);

  if (existing) {
    return {
      ok: true,
      isAlreadyClosed: true,
      periodMonth,
      nextMonth: nextMonthKey,
      message: `Period ${periodMonth} is already finalized and closed.`
    };
  }

  // 2. Run final sync
  const liveData = syncMonthlyAllocations(orgId, periodMonth);

  // 3. Handle Salary Carry-Forward Decision
  const salaryBudget = db.prepare(`
    SELECT * FROM budget_allocations
    WHERE organization_id = ? AND period_month = ? AND category_id = 'EMPLOYEE_SALARIES'
  `).get(orgId, periodMonth);

  if (salaryBudget && salaryBudget.remaining_balance > 0) {
    db.prepare(`
      UPDATE budget_allocations
      SET carry_forward_action = ?, updated_at = ?
      WHERE id = ?
    `).run(salaryCarryForwardDecision, new Date().toISOString(), salaryBudget.id);
  }

  // 4. Close monthly plan record
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE monthly_revenue_allocations
    SET status = 'CLOSED', closed_at = ?, updated_at = ?
    WHERE organization_id = ? AND period_month = ?
  `).run(now, now, orgId, periodMonth);

  // 5. Generate Snapshot Payload
  const snapshotData = {
    ...liveData,
    finalizedAt: now,
    finalizedBy: closedBy,
    salaryCarryForwardDecision,
    manualSalaryAmount
  };

  const snapId = `snap-${periodMonth}-${crypto.randomBytes(4).toString('hex')}`;
  db.prepare(`
    INSERT OR REPLACE INTO monthly_closing_snapshots
    (id, organization_id, period_month, period_year, closed_at, closed_by, snapshot_data_json, is_reopened, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    snapId,
    orgId,
    periodMonth,
    parseInt(yearStr, 10),
    now,
    closedBy,
    JSON.stringify(snapshotData),
    now
  );

  // 6. Automatically initialize next month with roll-over carry-forwards
  // 4b. Archive all completed imports for this closed month into permanent history
  try {
    db.prepare(`
      UPDATE import_history
      SET is_archived = 1, updated_at = ?
      WHERE organization_id = ? AND month_period = ?
    `).run(new Date().toISOString(), orgId, periodMonth);
  } catch (archErr) {
    console.warn('[Closing] Archive imports error:', archErr.message);
  }

  getOrCreateMonthlyPlan(orgId, nextMonthKey, closedBy);

  return {
    ok: true,
    snapshotId: snapId,
    periodMonth,
    nextMonth: nextMonthKey,
    message: `Month ${periodMonth} successfully closed. ${nextMonthKey} opened with carry-forward balances.`
  };
}

// ----------------------------------------------------------------------------
// 10. FINANCIAL TRANSACTIONS AUDIT LEDGER
// ----------------------------------------------------------------------------
function recordFinancialTransaction({
  organizationId,
  date,
  transactionType,
  category,
  amount,
  sourceAccount = '',
  destinationAccount = '',
  referenceId = '',
  performedBy = 'Administrator',
  description = '',
  attachmentUrl = ''
}) {
  const db = getDatabase();
  const orgId = resolveOrgId(organizationId);
  const id = `tx-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO financial_transactions
      (id, organization_id, date, transaction_type, category, amount, source_account, destination_account, reference_id, performed_by, approval_status, description, attachment_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?, ?)
    `).run(
      id,
      orgId,
      date || now,
      transactionType,
      category,
      roundMoney(amount),
      sourceAccount,
      destinationAccount,
      referenceId,
      performedBy,
      description,
      attachmentUrl,
      now,
      now
    );
  } catch (e) {
    console.warn('[FinanceEngine] Error recording financial transaction:', e.message);
  }

  return id;
}

// ----------------------------------------------------------------------------
// 11. IMPORT HISTORY ENGINE
// ----------------------------------------------------------------------------
function recordImportHistory({
  organizationId,
  importDate,
  purchaseDate = null,
  receivedDate = null,
  supplierId = null,
  supplierName = '',
  items = [],
  shippingCost = 0.0,
  additionalCharges = 0.0,
  importSource = 'MANUAL',
  documents = [],
  notes = '',
  performedById = null,
  performedByName = 'Administrator',
  isArchived = 0
}) {
  const db = getDatabase();
  const orgId = resolveOrgId(organizationId);
  const now = new Date().toISOString();
  const dateIso = importDate || now;
  const monthPeriod = getYearMonthKey(dateIso);
  const yearPeriod = parseInt(monthPeriod.split('-')[0], 10);
  const boughtDate = purchaseDate || dateIso;
  const arrivedDate = receivedDate || now;

  const importRef = `IMP-${monthPeriod.replace('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const id = `imp-${crypto.randomUUID()}`;

  const { generateAutoSku, generateAutoBarcode, pushImportToStockAndPos } = require('../inventory/stockSyncBridge');

  const cleanItems = (items || []).map(it => {
    const cat = it.category || 'General';
    const sku = (it.skuCode || it.sku || generateAutoSku(cat, it.productName || it.name)).trim();
    const barcode = (it.barcode || generateAutoBarcode()).trim();
    const qty = Number(it.quantity) || 1;
    const cost = Number(it.unitLandedCost || it.unitCost || it.cost || it.unitBasePrice) || 0.0;
    const retail = Number(it.targetRetailPrice || it.retailPrice) || (cost > 0 ? cost * 1.5 : 25.0);

    return {
      productId: it.productId || it.id || '',
      productName: it.productName || it.name || 'Unnamed Product',
      category: cat,
      sku: sku,
      skuCode: sku,
      barcode: barcode,
      imageUrl: it.imageUrl || it.image || '',
      quantity: qty,
      unitCost: cost,
      unitLandedCost: cost,
      targetRetailPrice: retail,
      totalCost: roundMoney(qty * cost),
      notes: it.notes || ''
    };
  });

  const productCount = cleanItems.length;
  const totalQuantity = cleanItems.reduce((s, it) => s + it.quantity, 0);
  const itemsTotalValue = cleanItems.reduce((s, it) => s + it.totalCost, 0);
  const totalImportValue = roundMoney(itemsTotalValue + Number(shippingCost || 0) + Number(additionalCharges || 0));

  db.prepare(`
    INSERT INTO import_history
    (id, organization_id, import_ref, import_date, month_period, year_period, performed_by_id, performed_by_name, supplier_id, supplier_name, items_json, product_count, total_quantity, total_import_value, shipping_cost, additional_charges, status, import_source, documents_json, notes, created_at, updated_at, purchase_date, received_date, is_archived)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    orgId,
    importRef,
    dateIso,
    monthPeriod,
    yearPeriod,
    performedById,
    performedByName,
    supplierId,
    supplierName,
    JSON.stringify(cleanItems),
    productCount,
    totalQuantity,
    totalImportValue,
    roundMoney(shippingCost),
    roundMoney(additionalCharges),
    importSource,
    JSON.stringify(documents || []),
    notes,
    now,
    now,
    boughtDate,
    arrivedDate,
    isArchived ? 1 : 0
  );

  // Directly push to Stock Management (Port 3000), POS Catalog (Port 3002), and SQLite!
  try {
    pushImportToStockAndPos({
      importRef,
      supplierName,
      purchaseDate: boughtDate,
      receivedDate: arrivedDate,
      items: cleanItems,
      organizationId: orgId,
      performedByName
    });
  } catch (syncErr) {
    console.warn('[FinancialAllocationEngine] Push to stock/POS failed:', syncErr.message);
  }

  // Also record in financial transactions
  recordFinancialTransaction({
    organizationId: orgId,
    date: dateIso,
    transactionType: 'INVENTORY_PURCHASE',
    category: 'Inventory Import',
    amount: totalImportValue,
    sourceAccount: 'Inventory Reserve',
    destinationAccount: supplierName || 'Supplier Import',
    referenceId: importRef,
    performedBy: performedByName,
    description: `Import ${importRef} from ${supplierName || 'Supplier'}: ${productCount} products (${totalQuantity} items)`
  });

  return {
    ok: true,
    id,
    importRef,
    totalImportValue,
    productCount,
    totalQuantity,
    purchaseDate: boughtDate,
    receivedDate: arrivedDate
  };
}

function getImportHistoryList({ organizationId, monthPeriod, yearPeriod, search, status, limit = 100, onlyArchived = false }) {
  const db = getDatabase();
  const orgId = resolveOrgId(organizationId);

  let query = `
    SELECT * FROM import_history
    WHERE organization_id = ?
  `;
  const params = [orgId];

  if (onlyArchived) {
    query += ` AND is_archived = 1`;
  }
  if (monthPeriod && monthPeriod !== 'ALL') {
    query += ` AND month_period = ?`;
    params.push(monthPeriod);
  }
  if (yearPeriod && yearPeriod !== 'ALL') {
    query += ` AND year_period = ?`;
    params.push(parseInt(yearPeriod, 10));
  }
  if (status && status !== 'ALL') {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (search && search.trim()) {
    query += ` AND (import_ref LIKE ? OR supplier_name LIKE ? OR performed_by_name LIKE ? OR notes LIKE ?)`;
    const sTerm = `%${search.trim()}%`;
    params.push(sTerm, sTerm, sTerm, sTerm);
  }

  query += ` ORDER BY COALESCE(purchase_date, import_date) DESC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(query).all(...params);

  return rows.map(r => ({
    ...r,
    purchaseDate: r.purchase_date || r.import_date,
    receivedDate: r.received_date || r.import_date,
    items: JSON.parse(r.items_json || '[]'),
    documents: JSON.parse(r.documents_json || '[]')
  }));
}

// ----------------------------------------------------------------------------
// 12. EXPORT AUDIT LOGGING
// ----------------------------------------------------------------------------
function recordExportAudit({
  organizationId,
  reportType,
  fileFormat,
  userId = null,
  userName = 'Administrator',
  periodOrDateRange = ''
}) {
  const db = getDatabase();
  const orgId = resolveOrgId(organizationId);
  const id = `exp-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO export_audit_logs
      (id, organization_id, report_type, file_format, user_id, user_name, period_or_date_range, downloaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, orgId, reportType, fileFormat, userId, userName, periodOrDateRange, now);
  } catch (e) {}

  return id;
}

module.exports = {
  roundMoney,
  getYearMonthKey,
  getPreviousMonthKey,
  ensureAllocationSchema,
  calculateInventoryReinvestmentAndPool,
  calculateEligibleRevenue,
  getDefaultAllocationCategories,
  getOrCreateMonthlyPlan,
  syncMonthlyAllocations,
  getMonthlyDashboardData,
  recordExpenseWithCapitalProtection,
  processCapitalRepayment,
  dismissCapitalBorrowing,
  injectCapital,
  withdrawCapital,
  recordLoopShareTransaction,
  executeMonthEndClosing,
  recordFinancialTransaction,
  recordImportHistory,
  getImportHistoryList,
  recordExportAudit
};

