// ============================================================================
// Loops Finance V3 — Mathematical Calculations & Precision Accounting Engine
// Strict 4-decimal currency & quantity precision; no floating point leakages
// ============================================================================

/**
 * Formats or converts any value to a precise number with 4 decimal places
 */
function toDecimal(num) {
  if (num === null || num === undefined || isNaN(num)) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 10000) / 10000;
}

/**
 * Two-decimal precision for display and balance checks
 */
function toCents(num) {
  if (num === null || num === undefined || isNaN(num)) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

/**
 * ----------------------------------------------------------------------------
 * 1. LANDED COST ALLOCATION ENGINE
 * ----------------------------------------------------------------------------
 * Calculates exact landed cost per SKU, distributes overheads by chosen basis,
 * and assigns rounding remainder to the largest line item to maintain exact balance.
 */
function calculateLandedCost(items, overheads) {
  if (!items || items.length === 0) {
    return { items: [], totalGoodsCost: 0, totalOverheadCost: 0, totalLandedCost: 0 };
  }

  // 1. Calculate totals for each potential allocation basis
  let totalGoodsValue = 0;
  let totalGrossWeight = 0;
  let totalVolumeCbm = 0;
  let totalUnits = 0;

  const normalizedItems = items.map(item => {
    const qty = Number(item.quantity) || 1;
    const unitPriceBase = toDecimal(item.unit_base_price_base || item.unitBasePriceBase || item.unit_base_price_fc || 0);
    const lineGoodsValue = toDecimal(qty * unitPriceBase);

    const unitWeight = Number(item.unit_weight_kg || item.unitWeightKg || 0);
    const lineWeight = toDecimal(unitWeight * qty);

    const unitCbm = Number(item.unit_volume_cbm || item.unitVolumeCbm || 0);
    const lineCbm = toDecimal(unitCbm * qty);

    totalGoodsValue += lineGoodsValue;
    totalGrossWeight += lineWeight;
    totalVolumeCbm += lineCbm;
    totalUnits += qty;

    return {
      ...item,
      quantity: qty,
      unit_base_price_base: unitPriceBase,
      total_base_price_base: lineGoodsValue,
      unit_weight_kg: unitWeight,
      total_weight_kg: lineWeight,
      unit_volume_cbm: unitCbm,
      total_volume_cbm: lineCbm,
      allocated_freight: 0,
      allocated_duty: 0,
      allocated_clearance: 0,
      allocated_trucking: 0,
      allocated_other: 0,
      total_allocated_overhead: 0
    };
  });

  let totalCapitalizedOverhead = 0;

  // 2. Distribute each overhead pool across items
  overheads.forEach(overhead => {
    const isCapitalizable = overhead.is_capitalizable !== false && overhead.isCapitalizable !== false;
    if (!isCapitalizable) return; // Non-capitalizable items go directly to operating expense

    const amount = toDecimal(overhead.amount_base || overhead.amountBase || overhead.amount || 0);
    if (amount <= 0) return;

    totalCapitalizedOverhead += amount;
    const basis = (overhead.allocation_basis || overhead.allocationBasis || 'BY_WEIGHT').toUpperCase();
    const category = (overhead.category || '').toUpperCase();

    // Determine target overhead bucket on item
    let targetBucket = 'allocated_other';
    if (category.includes('FREIGHT')) targetBucket = 'allocated_freight';
    else if (category.includes('DUTY') || category.includes('TARIFF')) targetBucket = 'allocated_duty';
    else if (category.includes('CLEARANCE') || category.includes('BROKERAGE') || category.includes('PORT')) targetBucket = 'allocated_clearance';
    else if (category.includes('TRUCKING') || category.includes('DRAYAGE')) targetBucket = 'allocated_trucking';

    let totalBasisDenominator = 1;
    if (basis === 'BY_WEIGHT') totalBasisDenominator = totalGrossWeight > 0 ? totalGrossWeight : (totalGoodsValue > 0 ? totalGoodsValue : totalUnits);
    else if (basis === 'BY_VALUE') totalBasisDenominator = totalGoodsValue > 0 ? totalGoodsValue : (totalUnits > 0 ? totalUnits : 1);
    else if (basis === 'BY_VOLUME') totalBasisDenominator = totalVolumeCbm > 0 ? totalVolumeCbm : (totalGoodsValue > 0 ? totalGoodsValue : totalUnits);
    else if (basis === 'BY_QUANTITY') totalBasisDenominator = totalUnits > 0 ? totalUnits : 1;

    let allocatedSum = 0;
    let maxLineIndex = 0;
    let maxLineBasis = -1;

    normalizedItems.forEach((item, idx) => {
      let lineBasisNumerator = 0;
      if (basis === 'BY_WEIGHT') lineBasisNumerator = totalGrossWeight > 0 ? item.total_weight_kg : (totalGoodsValue > 0 ? item.total_base_price_base : item.quantity);
      else if (basis === 'BY_VALUE') lineBasisNumerator = totalGoodsValue > 0 ? item.total_base_price_base : item.quantity;
      else if (basis === 'BY_VOLUME') lineBasisNumerator = totalVolumeCbm > 0 ? item.total_volume_cbm : (totalGoodsValue > 0 ? item.total_base_price_base : item.quantity);
      else if (basis === 'BY_QUANTITY') lineBasisNumerator = item.quantity;

      if (lineBasisNumerator > maxLineBasis) {
        maxLineBasis = lineBasisNumerator;
        maxLineIndex = idx;
      }

      // Calculate allocation with intermediate decimal precision
      const ratio = totalBasisDenominator > 0 ? (lineBasisNumerator / totalBasisDenominator) : (1 / normalizedItems.length);
      const allocatedPortion = toCents(amount * ratio);
      item[targetBucket] = toDecimal(item[targetBucket] + allocatedPortion);
      allocatedSum += allocatedPortion;
    });

    // Remainder balancing: Assign rounding cent discrepancy to the largest line item
    const remainder = toCents(amount - allocatedSum);
    if (Math.abs(remainder) > 0.0001 && normalizedItems[maxLineIndex]) {
      normalizedItems[maxLineIndex][targetBucket] = toDecimal(normalizedItems[maxLineIndex][targetBucket] + remainder);
    }
  });

  // 3. Finalize each item's total landed cost, unit landed cost, margin % and markup %
  let grandTotalLanded = 0;
  const processedItems = normalizedItems.map(item => {
    const itemOverheads = toDecimal(
      item.allocated_freight + 
      item.allocated_duty + 
      item.allocated_clearance + 
      item.allocated_trucking + 
      item.allocated_other
    );

    const totalLanded = toDecimal(item.total_base_price_base + itemOverheads);
    const unitLanded = toDecimal(totalLanded / item.quantity);
    grandTotalLanded += totalLanded;

    const retailPrice = Number(item.target_retail_price || item.targetRetailPrice || 0);
    let grossMarginPct = 0;
    let markupPct = 0;

    if (retailPrice > 0) {
      grossMarginPct = toDecimal(((retailPrice - unitLanded) / retailPrice) * 100);
      markupPct = unitLanded > 0 ? toDecimal(((retailPrice - unitLanded) / unitLanded) * 100) : 0;
    }

    return {
      ...item,
      total_allocated_overhead: itemOverheads,
      total_landed_cost: totalLanded,
      unit_landed_cost: unitLanded,
      projected_margin_pct: grossMarginPct,
      projected_markup_pct: markupPct
    };
  });

  return {
    items: processedItems,
    totalGoodsCost: toDecimal(totalGoodsValue),
    totalOverheadCost: toDecimal(totalCapitalizedOverhead),
    totalLandedCost: toDecimal(grandTotalLanded)
  };
}

/**
 * ----------------------------------------------------------------------------
 * 2. COMPREHENSIVE PROFIT & LOSS (P&L) CALCULATION ENGINE
 * ----------------------------------------------------------------------------
 * Strictly enforces V3 corrected hierarchy:
 * Gross Revenue -> Net Revenue -> Landed COGS -> Gross Profit ->
 * Contribution Margin -> EBITDA -> Depreciation -> EBIT -> Net Profit
 */
function calculatePnL({
  salesRevenue = 0,
  shippingIncome = 0,
  discounts = 0,
  returns = 0,
  landedCogs = 0,
  damagedInventory = 0,
  inventoryShrinkage = 0,
  directSellingCosts = 0, // Packaging, payment fees
  marketingCosts = 0,     // Meta ads, promo
  occupancyRent = 0,      // Rent & utilities
  payrollWages = 0,       // Staff salaries
  adminSoftware = 0,      // Software subscriptions, office supplies
  professionalFees = 0,   // Accounting, legal
  depreciation = 0,       // Asset depreciation
  otherOperating = 0,
  interestExpense = 0,
  realizedFxGainLoss = 0,
  otherIncome = 0,
  incomeTaxExpense = 0
}) {
  // Step 1: Net Revenue
  const grossRevenue = toDecimal(Number(salesRevenue) + Number(shippingIncome));
  const deductions = toDecimal(Number(discounts) + Number(returns));
  const netRevenue = toDecimal(grossRevenue - deductions);

  // Step 2: Cost of Goods Sold (Landed COGS)
  const totalCogs = toDecimal(Number(landedCogs) + Number(damagedInventory) + Number(inventoryShrinkage));

  // Step 3: Gross Profit & Margin
  const grossProfit = toDecimal(netRevenue - totalCogs);
  const grossMarginPct = netRevenue > 0 ? toDecimal((grossProfit / netRevenue) * 100) : 0;

  // Step 4: Contribution Margin
  const variableCosts = toDecimal(Number(directSellingCosts) + Number(marketingCosts));
  const contributionMargin = toDecimal(grossProfit - variableCosts);
  const contributionMarginPct = netRevenue > 0 ? toDecimal((contributionMargin / netRevenue) * 100) : 0;

  // Step 5: EBITDA (Operating Profit before D&A)
  const fixedOpex = toDecimal(
    Number(occupancyRent) + 
    Number(payrollWages) + 
    Number(adminSoftware) + 
    Number(professionalFees) + 
    Number(otherOperating)
  );
  const totalOpex = toDecimal(variableCosts + fixedOpex);
  const ebitda = toDecimal(contributionMargin - fixedOpex);

  // Step 6: EBIT (Operating Profit)
  const ebit = toDecimal(ebitda - Number(depreciation));

  // Step 7: Non-Operating & Tax
  const nonOperatingBalance = toDecimal(Number(otherIncome) - Number(interestExpense) - Number(realizedFxGainLoss));
  const preTaxIncome = toDecimal(ebit + nonOperatingBalance);
  const netProfit = toDecimal(preTaxIncome - Number(incomeTaxExpense));
  const netMarginPct = netRevenue > 0 ? toDecimal((netProfit / netRevenue) * 100) : 0;

  return {
    grossRevenue,
    discounts,
    returns,
    netRevenue,
    landedCogs: Number(landedCogs),
    damagedInventory: Number(damagedInventory),
    inventoryShrinkage: Number(inventoryShrinkage),
    totalCogs,
    grossProfit,
    grossMarginPct,
    directSellingCosts: Number(directSellingCosts),
    marketingCosts: Number(marketingCosts),
    variableCosts,
    contributionMargin,
    contributionMarginPct,
    occupancyRent: Number(occupancyRent),
    payrollWages: Number(payrollWages),
    adminSoftware: Number(adminSoftware),
    professionalFees: Number(professionalFees),
    fixedOpex,
    totalOpex,
    ebitda,
    depreciation: Number(depreciation),
    ebit,
    nonOperatingBalance,
    preTaxIncome,
    incomeTaxExpense: Number(incomeTaxExpense),
    netProfit,
    netMarginPct
  };
}

/**
 * ----------------------------------------------------------------------------
 * 3. HEALTH SCORE (0-100) & FINANCIAL RUNWAY ALGORITHM
 * ----------------------------------------------------------------------------
 */
function calculateHealthScoreAndRunway({
  cashBalance = 0,
  safeCashBuffer = 5000,
  netProfit = 0,
  netRevenue = 0,
  accountsReceivable = 0,
  accountsPayable = 0,
  inventoryValue = 0,
  monthlyCogs = 0,
  monthlyOpex = 0
}) {
  // 1. Liquidity Score (25% weight): Cash vs Safe Buffer
  const liquidityRatio = safeCashBuffer > 0 ? (cashBalance / safeCashBuffer) : 1;
  const liquidityScore = Math.min(100, Math.max(0, liquidityRatio * 80));

  // 2. Profitability Score (25% weight): Net Margin %
  const netMargin = netRevenue > 0 ? (netProfit / netRevenue) : 0;
  let profitScore = 50;
  if (netMargin > 0.25) profitScore = 100;
  else if (netMargin > 0.15) profitScore = 85;
  else if (netMargin > 0.05) profitScore = 70;
  else if (netMargin >= 0) profitScore = 55;
  else profitScore = Math.max(0, 50 - Math.abs(netMargin) * 150);

  // 3. Stock Turnover Score (15% weight)
  const turnoverRatio = inventoryValue > 0 ? (monthlyCogs * 12) / inventoryValue : 2;
  const turnoverScore = Math.min(100, Math.max(20, turnoverRatio * 20));

  // 4. Obligations Score (15% weight): AP vs Cash
  let obligationsScore = 100;
  if (accountsPayable > 0) {
    const coverage = cashBalance / accountsPayable;
    if (coverage >= 2) obligationsScore = 100;
    else if (coverage >= 1) obligationsScore = 80;
    else obligationsScore = Math.max(10, coverage * 70);
  }

  // 5. Expense Stability Score (10% weight)
  const expenseRatio = netRevenue > 0 ? (monthlyOpex / netRevenue) : 0.5;
  const expenseScore = Math.min(100, Math.max(10, (1 - expenseRatio) * 120));

  // 6. Runway Score (10% weight)
  const netMonthlyBurn = monthlyOpex - (netRevenue - monthlyCogs);
  let runwayMonths = 'Not burning cash';
  let runwayScore = 100;

  if (netMonthlyBurn > 0) {
    const months = toDecimal(cashBalance / netMonthlyBurn);
    runwayMonths = months;
    if (months >= 12) runwayScore = 100;
    else if (months >= 6) runwayScore = 80;
    else if (months >= 3) runwayScore = 50;
    else runwayScore = Math.max(5, months * 12);
  }

  // Weighted Total Score
  const totalHealthScore = Math.round(
    (liquidityScore * 0.25) +
    (profitScore * 0.25) +
    (turnoverScore * 0.15) +
    (obligationsScore * 0.15) +
    (expenseScore * 0.10) +
    (runwayScore * 0.10)
  );

  return {
    totalHealthScore,
    grade: totalHealthScore >= 85 ? 'EXCELLENT' : totalHealthScore >= 70 ? 'HEALTHY' : totalHealthScore >= 50 ? 'CAUTION' : 'CRITICAL',
    runwayMonths,
    isBurningCash: netMonthlyBurn > 0,
    factors: {
      liquidity: Math.round(liquidityScore),
      profitability: Math.round(profitScore),
      turnover: Math.round(turnoverScore),
      obligations: Math.round(obligationsScore),
      expenseControl: Math.round(expenseScore),
      runway: Math.round(runwayScore)
    }
  };
}

module.exports = {
  toDecimal,
  toCents,
  calculateLandedCost,
  calculatePnL,
  calculateHealthScoreAndRunway
};

