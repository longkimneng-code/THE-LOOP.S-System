// The Loop.s POS — Enterprise Shift Management Engine (Section 13)
// Full shift lifecycle, dual-currency float, real-time telemetry, Z-reports, and audit tracking
const { loadDb, saveDb, generateUuid } = require('./db');

function formatCurrency(val) {
  return Number(Number(val || 0).toFixed(2));
}

function getExchangeRate() {
  const db = loadDb();
  return Number(db.organization?.exchangeRate) || 4000;
}

// ----------------------------------------------------------------------------
// 1. OPEN SHIFT (Section 13.1 & 13.2)
// ----------------------------------------------------------------------------
function openShift({
  registerId,
  cashierUserId,
  openingFloatUsd = 0,
  openingFloatKhr = 0,
  openingNotes = ''
}, authUser = null) {
  const db = loadDb();
  const rate = getExchangeRate();

  const cashier = (cashierUserId ? db.users.find(u => u.id === cashierUserId) : null) || authUser || db.users[0];
  if (!cashier) {
    return { ok: false, error: 'Cashier user not found' };
  }

  const cashierOrgId = cashier.organizationId || db.organization?.id || 'org-loops-001';

  // 1. Identify or auto-assign the register within cashier's organization
  let register = null;
  if (registerId) {
    register = db.registers.find(r => r.id === registerId);
  }

  // If register not found or belongs to another organization, find one in cashier's organization
  if (!register || (register.organizationId && register.organizationId !== cashierOrgId)) {
    register = db.registers.find(r => (r.organizationId || cashierOrgId) === cashierOrgId);
  }

  // If still no register exists for this organization, auto-create one for cashier's store
  if (!register) {
    const userStore = (db.locations || []).find(l => (l.organizationId || cashierOrgId) === cashierOrgId) || {
      id: `store-${cashierOrgId.slice(-6)}`,
      name: `${cashier.fullName}'s Store`,
      organizationId: cashierOrgId
    };
    register = {
      id: `reg-${userStore.id}-01`,
      organizationId: cashierOrgId,
      locationId: userStore.id,
      storeId: userStore.id,
      registerCode: 'REG-01',
      name: `${userStore.name} Main Register 01`,
      status: 'CLOSED',
      currentShiftId: null,
      currentCashierId: null
    };
    if (!db.registers) db.registers = [];
    db.registers.push(register);
    saveDb();
  }

  // Section 15.8 Location Access Check: Cashier must be authorized for this store
  const targetStoreId = register.locationId || register.storeId || 'loc-1';
  const { canUserAccessStore } = require('./storeManager');
  if (cashier.role !== 'OWNER' && cashier.role !== 'SUPER_ADMIN') {
    if (!canUserAccessStore(cashier, targetStoreId)) {
      return {
        ok: false,
        error: `Access Denied: Cashier ${cashier.fullName} is not authorized to open shifts or operate registers at store "${targetStoreId}".`
      };
    }
  }

  // Security Rule 13.8: Cashier cannot have multiple simultaneous shifts
  const existingCashierShift = db.shifts.find(
    s => s.cashierUserId === cashier.id && s.status === 'ACTIVE'
  );
  if (existingCashierShift) {
    return {
      ok: false,
      error: `Cashier ${cashier.fullName} already has an active shift (#${existingCashierShift.id}) on register ${existingCashierShift.registerId}. Please close it before opening a new shift.`,
      activeShiftId: existingCashierShift.id
    };
  }

  // Security Rule 13.8: Register cannot have multiple simultaneous shifts
  const existingRegisterShift = db.shifts.find(
    s => s.registerId === register.id && s.status === 'ACTIVE'
  );
  if (existingRegisterShift) {
    return {
      ok: false,
      error: `Register ${register.registerCode} already has an active shift (#${existingRegisterShift.id}). It must be closed before a new shift can begin.`,
      activeShiftId: existingRegisterShift.id
    };
  }

  // If register was marked OPEN but had no active shift in db, heal it
  if (register.status === 'OPEN') {
    register.status = 'CLOSED';
    register.currentShiftId = null;
    register.currentCashierId = null;
  }

  const shiftId = 'shift-' + Date.now().toString().slice(-6) + '-' + generateUuid().slice(0, 4);
  const floatUsd = formatCurrency(openingFloatUsd);
  const floatKhr = Math.round(Number(openingFloatKhr) || 0);
  const totalOpeningUsd = formatCurrency(floatUsd + (floatKhr / rate));

  const store = (db.locations || []).find(l => l.id === targetStoreId);
  const newShift = {
    id: shiftId,
    businessId: register.organizationId || db.organization?.id || 'org-loops-001',
    organizationId: register.organizationId || db.organization?.id || 'org-loops-001',
    storeId: targetStoreId,
    storeName: store?.name || 'Sisowath Flagship Store',
    registerId: register.id,
    registerCode: register.registerCode,
    employeeId: cashier.id,
    cashierUserId: cashier.id,
    cashierName: cashier.fullName || 'Cashier',
    cashierEmail: cashier.email,
    openedAt: new Date().toISOString(),
    closedAt: null,
    exchangeRateSnapshot: rate,
    exchangeRateAtOpen: rate,
    openingFloatUsd: floatUsd,
    openingFloatKhr: floatKhr,
    totalOpeningFloatUsd: totalOpeningUsd,
    openingNotes: openingNotes || '',
    expectedCashUsd: floatUsd,
    expectedCashKhr: floatKhr,
    countedCashUsd: null,
    countedCashKhr: null,
    cashDifferenceUsd: 0.00,
    cashDifferenceKhr: 0,
    closingNotes: null,
    status: 'ACTIVE',
    auditTrail: [
      {
        action: 'SHIFT_OPENED',
        by: cashier.fullName,
        timestamp: new Date().toISOString(),
        details: `Shift opened with float: $${floatUsd} USD + ${floatKhr.toLocaleString()} KHR`
      }
    ]
  };

  register.status = 'OPEN';
  register.currentShiftId = shiftId;
  register.currentCashierId = cashier.id;

  db.shifts.unshift(newShift);

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'SHIFT_OPENED',
    userId: cashier.id,
    userName: cashier.fullName,
    details: `Shift #${shiftId} opened on ${register.registerCode} by ${cashier.fullName}`,
    timestamp: new Date().toISOString()
  });

  saveDb();
  return { ok: true, shift: newShift, register };
}

// ----------------------------------------------------------------------------
// 2. GET SHIFT DETAILS & TELEMETRY (Section 13.3)
// ----------------------------------------------------------------------------
function getShiftDetails(shiftId) {
  const db = loadDb();
  const shift = db.shifts.find(s => s.id === shiftId);
  if (!shift) return null;

  const rate = shift.exchangeRateAtOpen || getExchangeRate();
  const orders = db.orders.filter(o => o.shiftId === shift.id && o.status === 'COMPLETED');
  const orderIds = orders.map(o => o.id);
  const payments = db.payments.filter(p => orderIds.includes(p.orderId));
  const movements = (db.cashMovements || []).filter(m => m.shiftId === shift.id);
  const refunds = (db.refunds || []).filter(r => r.shiftId === shift.id || (r.orderId && orderIds.includes(r.orderId)));

  let cashSalesUsd = 0;
  let cashSalesKhr = 0;
  let cardSalesUsd = 0;
  let qrSalesUsd = 0;
  let storeCreditSalesUsd = 0;
  let mixedSalesCount = 0;

  // Tender accounting
  payments.forEach(p => {
    const isKhr = p.currencyCode === 'KHR';
    const amtUsd = Number(p.amount) || 0;
    const amtKhr = Number(p.amountKhr) || Math.round(amtUsd * rate);

    if (p.method === 'CASH') {
      if (isKhr) {
        cashSalesKhr += amtKhr;
      } else {
        cashSalesUsd += amtUsd;
      }
    } else if (p.method === 'CREDIT_CARD') {
      cardSalesUsd += amtUsd;
    } else if (p.method === 'QR_KHQR') {
      qrSalesUsd += amtUsd;
    } else if (p.method === 'STORE_CREDIT') {
      storeCreditSalesUsd += amtUsd;
    }
  });

  // Check mixed-currency orders
  orders.forEach(o => {
    const orderPmts = payments.filter(p => p.orderId === o.id);
    const hasUsd = orderPmts.some(p => p.currencyCode === 'USD');
    const hasKhr = orderPmts.some(p => p.currencyCode === 'KHR');
    if (hasUsd && hasKhr) mixedSalesCount++;
  });

  // Petty cash movements
  let paidInUsd = 0;
  let paidOutUsd = 0;
  let safeDropUsd = 0;

  movements.forEach(m => {
    const amt = Number(m.amount) || 0;
    if (m.type === 'PAID_IN') paidInUsd += amt;
    else if (m.type === 'PAID_OUT') paidOutUsd += amt;
    else if (m.type === 'SAFE_DROP') safeDropUsd += amt;
  });

  // Refunds
  let refundTotalUsd = 0;
  refunds.forEach(r => {
    refundTotalUsd += Number(r.totalRefund) || 0;
  });

  // Expected Cash Calculations (Separate USD and KHR tracking)
  const expectedCashUsd = formatCurrency(
    (shift.openingFloatUsd || 0) + cashSalesUsd + paidInUsd - paidOutUsd - safeDropUsd
  );
  const expectedCashKhr = Math.round(
    (shift.openingFloatKhr || 0) + cashSalesKhr
  );
  const expectedTotalNormalizedUsd = formatCurrency(expectedCashUsd + (expectedCashKhr / rate));

  // Duration
  const openTime = new Date(shift.openedAt).getTime();
  const closeTime = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();
  const durationMs = Math.max(0, closeTime - openTime);
  const durationMinutes = Math.floor(durationMs / 60000);
  const durationHours = (durationMinutes / 60).toFixed(1);

  // Unpaid saved orders created during this shift
  const unpaidSavedOrders = (db.savedOrders || []).filter(
    so => so.shiftId === shift.id && so.status === 'ON_HOLD'
  );

  return {
    shift,
    summary: {
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      durationMinutes,
      durationHours: `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`,
      exchangeRate: rate,
      openingFloatUsd: shift.openingFloatUsd || 0,
      openingFloatKhr: shift.openingFloatKhr || 0,
      totalOpeningFloatUsd: shift.totalOpeningFloatUsd || shift.openingFloatUsd || 0,
      cashSalesUsd: formatCurrency(cashSalesUsd),
      cashSalesKhr: Math.round(cashSalesKhr),
      cardSalesUsd: formatCurrency(cardSalesUsd),
      qrSalesUsd: formatCurrency(qrSalesUsd),
      storeCreditSalesUsd: formatCurrency(storeCreditSalesUsd),
      mixedCurrencyTransactions: mixedSalesCount,
      totalSalesRevenueUsd: formatCurrency(
        cashSalesUsd + (cashSalesKhr / rate) + cardSalesUsd + qrSalesUsd + storeCreditSalesUsd
      ),
      totalSalesRevenueKhr: Math.round(
        (cashSalesUsd * rate) + cashSalesKhr + (cardSalesUsd * rate) + (qrSalesUsd * rate) + (storeCreditSalesUsd * rate)
      ),
      totalOrderCount: orders.length,
      refundCount: refunds.length,
      refundTotalUsd: formatCurrency(refundTotalUsd),
      paidInUsd: formatCurrency(paidInUsd),
      paidOutUsd: formatCurrency(paidOutUsd),
      safeDropUsd: formatCurrency(safeDropUsd),
      expectedCashUsd,
      expectedCashKhr,
      expectedCashInDrawer: expectedTotalNormalizedUsd,
      unpaidSavedOrdersCount: unpaidSavedOrders.length
    },
    orders,
    cashMovements: movements,
    refunds,
    unpaidSavedOrders
  };
}

// ----------------------------------------------------------------------------
// 3. GET ACTIVE SHIFT FOR CURRENT CASHIER / REGISTER
// ----------------------------------------------------------------------------
function getActiveShift(registerId, cashierUserId, organizationId = null, storeId = null) {
  const db = loadDb();
  let shift = null;

  // 1. Check if the specified cashier has an active shift
  if (cashierUserId) {
    shift = db.shifts.find(s => s.cashierUserId === cashierUserId && s.status === 'ACTIVE');
  }
  // 2. Check if the specified register has an active shift
  if (!shift && registerId && registerId !== 'reg-01') {
    shift = db.shifts.find(s => s.registerId === registerId && s.status === 'ACTIVE');
  }
  // 3. Check if the store has an active shift
  if (!shift && storeId) {
    shift = db.shifts.find(s => (s.storeId === storeId || s.locationId === storeId) && s.status === 'ACTIVE');
  }
  // 4. Check if the organization has an active shift
  if (!shift && organizationId) {
    shift = db.shifts.find(s => s.status === 'ACTIVE' && (s.organizationId || s.businessId || 'org-loops-001') === organizationId);
  }
  // 5. Check if registerId matches regardless of 'reg-01'
  if (!shift && registerId) {
    shift = db.shifts.find(s => s.registerId === registerId && s.status === 'ACTIVE');
  }
  // 6. Graceful fallback: If ANY active shift exists in the database, return it
  if (!shift) {
    shift = db.shifts.find(s => s.status === 'ACTIVE') || null;
  }

  // Enforce tenant boundary only if organizationId is explicitly provided and doesn't match
  if (shift && organizationId) {
    const shiftOrg = shift.organizationId || shift.businessId || 'org-loops-001';
    if (shiftOrg !== organizationId && organizationId !== 'org-loops-001') {
      shift = null;
    }
  }

  if (!shift) {
    return { hasActiveShift: false, shift: null, summary: null };
  }

  const details = getShiftDetails(shift.id);
  const reg = db.registers.find(r => r.id === shift.registerId) || db.registers[0];
  return {
    hasActiveShift: true,
    shift: details.shift,
    summary: details.summary,
    register: reg
  };
}

// ----------------------------------------------------------------------------
// 4. CLOSE SHIFT (Section 13.4)
// ----------------------------------------------------------------------------
function closeShift({
  shiftId,
  countedCashUsd = 0,
  countedCashKhr = 0,
  closingNotes = '',
  closedByUserId,
  registerId
}) {
  const db = loadDb();
  let shift = null;

  if (shiftId) {
    shift = db.shifts.find(s => s.id === shiftId && s.status === 'ACTIVE');
  }
  if (!shift && registerId) {
    shift = db.shifts.find(s => s.registerId === registerId && s.status === 'ACTIVE');
  }
  if (!shift && closedByUserId) {
    shift = db.shifts.find(s => s.cashierUserId === closedByUserId && s.status === 'ACTIVE');
  }
  if (!shift) {
    // If only one active shift exists, resolve it
    shift = db.shifts.find(s => s.status === 'ACTIVE');
  }

  if (!shift) {
    // If all shifts are closed, ensure all registers are set to CLOSED
    let cleaned = false;
    (db.registers || []).forEach(r => {
      if (r.status === 'OPEN') {
        r.status = 'CLOSED';
        r.currentShiftId = null;
        r.currentCashierId = null;
        cleaned = true;
      }
    });
    if (cleaned) saveDb();
    return { ok: false, error: 'Active shift not found or already closed' };
  }

  const details = getShiftDetails(shiftId);
  const rate = shift.exchangeRateAtOpen || getExchangeRate();

  const countedUsd = formatCurrency(countedCashUsd);
  const countedKhr = Math.round(Number(countedCashKhr) || 0);
  const countedTotalUsd = formatCurrency(countedUsd + (countedKhr / rate));

  const expectedUsd = details.summary.expectedCashUsd;
  const expectedKhr = details.summary.expectedCashKhr;
  const expectedTotalUsd = details.summary.expectedCashInDrawer;

  const diffUsd = formatCurrency(countedUsd - expectedUsd);
  const diffKhr = Math.round(countedKhr - expectedKhr);
  const diffTotalUsd = formatCurrency(countedTotalUsd - expectedTotalUsd);

  // Require closing notes if there is a discrepancy
  const hasDiscrepancy = Math.abs(diffTotalUsd) >= 0.05;
  if (hasDiscrepancy && (!closingNotes || closingNotes.trim().length === 0)) {
    return {
      ok: false,
      error: `Cash discrepancy detected (${diffTotalUsd >= 0 ? '+' : ''}$${diffTotalUsd}). Closing notes explaining the discrepancy are required by business policy.`
    };
  }

  const closedByUser = db.users.find(u => u.id === closedByUserId) || { fullName: shift.cashierName };

  shift.closedAt = new Date().toISOString();
  shift.countedCashUsd = countedUsd;
  shift.countedCashKhr = countedKhr;
  shift.countedCash = countedTotalUsd;
  shift.expectedCash = expectedTotalUsd;
  shift.expectedCashUsd = expectedUsd;
  shift.expectedCashKhr = expectedKhr;
  shift.cashDifferenceUsd = diffUsd;
  shift.cashDifferenceKhr = diffKhr;
  shift.cashOverShort = diffTotalUsd;
  shift.closingNotes = closingNotes || '';
  shift.closedByUserId = closedByUser.id || shift.cashierUserId;
  shift.closedByName = closedByUser.fullName || shift.cashierName;
  shift.status = 'CLOSED';

  shift.auditTrail = shift.auditTrail || [];
  shift.auditTrail.push({
    action: 'SHIFT_CLOSED',
    by: closedByUser.fullName || shift.cashierName,
    timestamp: new Date().toISOString(),
    details: `Shift closed. Counted: $${countedUsd} USD + ${countedKhr.toLocaleString()} KHR. Discrepancy: $${diffTotalUsd}.`
  });

  // Update register
  const register = db.registers.find(r => r.id === shift.registerId);
  if (register) {
    register.status = 'CLOSED';
    register.currentShiftId = null;
    register.currentCashierId = null;
  }

  // Queue SHIFT_CLOSED Z-Report event into outbox for Loops Finance
  const zReportPayload = {
    shiftId: shift.id,
    registerId: shift.registerId,
    registerCode: register?.registerCode || 'REG-01',
    cashierUserId: shift.cashierUserId,
    cashierName: shift.cashierName,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    durationHours: details.summary.durationHours,
    openingFloatUsd: shift.openingFloatUsd,
    openingFloatKhr: shift.openingFloatKhr,
    countedCashUsd: countedUsd,
    countedCashKhr: countedKhr,
    expectedCashUsd: expectedUsd,
    expectedCashKhr: expectedKhr,
    cashDifferenceUsd: diffUsd,
    cashDifferenceKhr: diffKhr,
    closingNotes: shift.closingNotes,
    tenderTotals: {
      cashUsd: details.summary.cashSalesUsd,
      cashKhr: details.summary.cashSalesKhr,
      card: details.summary.cardSalesUsd,
      qr: details.summary.qrSalesUsd,
      storeCredit: details.summary.storeCreditSalesUsd,
      totalUsd: details.summary.totalSalesRevenueUsd,
      totalKhr: details.summary.totalSalesRevenueKhr
    },
    orderCount: details.summary.totalOrderCount,
    refundCount: details.summary.refundCount,
    refundTotalUsd: details.summary.refundTotalUsd,
    cashMovements: details.cashMovements
  };

  db.outbox.unshift({
    id: generateUuid(),
    eventType: 'SHIFT_CLOSED',
    schemaVersion: 1,
    sourceSystem: 'POS',
    payload: zReportPayload,
    status: 'PENDING',
    attemptCount: 0,
    createdAt: new Date().toISOString()
  });

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'SHIFT_CLOSED',
    userId: closedByUser.id || shift.cashierUserId,
    userName: closedByUser.fullName || shift.cashierName,
    details: `Shift #${shift.id} closed on ${register?.registerCode || 'REG-01'}. Counted: $${countedTotalUsd}, Discrepancy: $${diffTotalUsd}`,
    timestamp: new Date().toISOString()
  });

  saveDb();

  return {
    ok: true,
    shift,
    summary: details.summary,
    zReport: zReportPayload,
    discrepancy: diffTotalUsd
  };
}

// ----------------------------------------------------------------------------
// 5. SHIFT HISTORY WITH ADVANCED FILTERS (Section 13.5)
// ----------------------------------------------------------------------------
function getShiftHistory({
  cashierId = 'ALL',
  registerId = 'ALL',
  storeId = 'ALL',
  status = 'ALL',
  dateRange = 'ALL',
  hasDiscrepancy = 'ALL',
  search = '',
  user = null,
  organizationId = null
} = {}) {
  const db = loadDb();
  let list = db.shifts || [];

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  list = list.filter(s => {
    // Multi-tenant organization isolation
    const targetOrg = organizationId || user?.organizationId;
    if (targetOrg) {
      const shiftOrg = s.organizationId || s.businessId || 'org-loops-001';
      if (shiftOrg !== targetOrg) return false;
    }

    // Section 15.10 Store-Based Filtering & Authorization
    if (storeId && storeId !== 'ALL') {
      const shiftStore = s.storeId || s.locationId || 'loc-1';
      if (shiftStore !== storeId) return false;
    }

    if (user && user.role !== 'OWNER' && user.role !== 'SUPER_ADMIN') {
      const { canUserAccessStore } = require('./storeManager');
      const shiftStore = s.storeId || s.locationId || 'loc-1';
      if (!canUserAccessStore(user, shiftStore)) return false;
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      const matchId = (s.id || '').toLowerCase().includes(q);
      const matchCashier = (s.cashierName || '').toLowerCase().includes(q);
      const matchReg = (s.registerCode || '').toLowerCase().includes(q);
      if (!matchId && !matchCashier && !matchReg) return false;
    }

    // Cashier
    if (cashierId !== 'ALL' && s.cashierUserId !== cashierId) return false;

    // Register
    if (registerId !== 'ALL' && s.registerId !== registerId) return false;

    // Status
    if (status !== 'ALL' && s.status !== status) return false;

    // Discrepancy
    if (hasDiscrepancy === 'YES') {
      if (Math.abs(Number(s.cashOverShort || 0)) < 0.05) return false;
    } else if (hasDiscrepancy === 'NO') {
      if (Math.abs(Number(s.cashOverShort || 0)) >= 0.05) return false;
    }

    // Date Range
    if (dateRange === 'TODAY') {
      const openDate = (s.openedAt || '').split('T')[0];
      if (openDate !== todayStr) return false;
    } else if (dateRange === '7DAYS') {
      const past7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      if (new Date(s.openedAt) < past7) return false;
    } else if (dateRange === '30DAYS') {
      const past30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      if (new Date(s.openedAt) < past30) return false;
    }

    return true;
  });

  // Enrich with live calculation summary
  return list.map(shift => {
    const details = getShiftDetails(shift.id);
    return {
      ...shift,
      summary: details?.summary || {}
    };
  });
}

// ----------------------------------------------------------------------------
// 6. REOPEN SHIFT WITH AUDIT TRAIL (Section 13.4 & 13.7)
// ----------------------------------------------------------------------------
function reopenShift({ shiftId, managerUserId, reason }) {
  const db = loadDb();
  const shift = db.shifts.find(s => s.id === shiftId);

  if (!shift) return { ok: false, error: 'Shift not found' };
  if (shift.status === 'ACTIVE') return { ok: false, error: 'Shift is already open' };
  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: 'Reason is required to reopen a closed shift' };
  }

  const manager = db.users.find(u => u.id === managerUserId) || { fullName: 'Manager' };

  // Check if register currently has another active shift
  const existingActive = db.shifts.find(s => s.registerId === shift.registerId && s.status === 'ACTIVE');
  if (existingActive) {
    return {
      ok: false,
      error: `Register already has an active shift (#${existingActive.id}). Close that shift first before reopening this one.`
    };
  }

  shift.status = 'ACTIVE';
  shift.reopenedAt = new Date().toISOString();
  shift.reopenedByUserId = manager.id;
  shift.reopenedByName = manager.fullName;
  shift.reopenReason = reason;

  shift.auditTrail = shift.auditTrail || [];
  shift.auditTrail.push({
    action: 'SHIFT_REOPENED',
    by: manager.fullName,
    timestamp: new Date().toISOString(),
    reason
  });

  const register = db.registers.find(r => r.id === shift.registerId);
  if (register) {
    register.status = 'OPEN';
    register.currentShiftId = shift.id;
    register.currentCashierId = shift.cashierUserId;
  }

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'SHIFT_REOPENED',
    userId: manager.id,
    userName: manager.fullName,
    details: `Shift #${shift.id} reopened by ${manager.fullName}. Reason: ${reason}`,
    timestamp: new Date().toISOString()
  });

  saveDb();
  return { ok: true, shift, message: 'Shift reopened successfully' };
}

// ----------------------------------------------------------------------------
// 7. INDIVIDUAL CASHIER SALES PERFORMANCE (Section 13.6)
// ----------------------------------------------------------------------------
function getCashierPerformance({ cashierId, dateRange = 'ALL' }) {
  const db = loadDb();
  const user = db.users.find(u => u.id === cashierId);
  if (!user) return { ok: false, error: 'Cashier user not found' };

  const rate = getExchangeRate();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Filter orders by cashier
  let orders = db.orders.filter(o => o.cashierUserId === cashierId && o.status === 'COMPLETED');
  let shifts = db.shifts.filter(s => s.cashierUserId === cashierId);

  // Apply date range filter
  if (dateRange === 'TODAY') {
    orders = orders.filter(o => (o.createdAt || '').split('T')[0] === todayStr);
    shifts = shifts.filter(s => (s.openedAt || '').split('T')[0] === todayStr);
  } else if (dateRange === '7DAYS') {
    const past7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    orders = orders.filter(o => new Date(o.createdAt) >= past7);
    shifts = shifts.filter(s => new Date(s.openedAt) >= past7);
  } else if (dateRange === '30DAYS') {
    const past30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    orders = orders.filter(o => new Date(o.createdAt) >= past30);
    shifts = shifts.filter(s => new Date(s.openedAt) >= past30);
  }

  const orderIds = orders.map(o => o.id);
  const payments = db.payments.filter(p => orderIds.includes(p.orderId));
  const refunds = (db.refunds || []).filter(r => r.cashierUserId === cashierId || orderIds.includes(r.orderId));
  const cancelledOrders = db.orders.filter(o => o.cashierUserId === cashierId && o.status === 'CANCELLED');

  let totalSalesUsd = 0;
  let cashSalesUsd = 0;
  let cashSalesKhr = 0;
  let cardSalesUsd = 0;
  let qrSalesUsd = 0;
  let storeCreditSalesUsd = 0;
  let totalDiscountsUsd = 0;

  orders.forEach(o => {
    totalSalesUsd += Number(o.totalAmount) || 0;
    totalDiscountsUsd += Number(o.discountTotal) || 0;
  });

  payments.forEach(p => {
    const amt = Number(p.amount) || 0;
    if (p.method === 'CASH') {
      if (p.currencyCode === 'KHR') cashSalesKhr += (Number(p.amountKhr) || Math.round(amt * rate));
      else cashSalesUsd += amt;
    } else if (p.method === 'CREDIT_CARD') {
      cardSalesUsd += amt;
    } else if (p.method === 'QR_KHQR') {
      qrSalesUsd += amt;
    } else if (p.method === 'STORE_CREDIT') {
      storeCreditSalesUsd += amt;
    }
  });

  let totalRefundsUsd = 0;
  refunds.forEach(r => totalRefundsUsd += Number(r.totalRefund) || 0);

  // Calculate working hours
  let totalWorkingMinutes = 0;
  shifts.forEach(s => {
    const open = new Date(s.openedAt).getTime();
    const close = s.closedAt ? new Date(s.closedAt).getTime() : Date.now();
    totalWorkingMinutes += Math.floor(Math.max(0, close - open) / 60000);
  });

  const totalTransactions = orders.length;
  const avgBasketSize = totalTransactions > 0 ? formatCurrency(totalSalesUsd / totalTransactions) : 0;
  const avgSalesPerShift = shifts.length > 0 ? formatCurrency(totalSalesUsd / shifts.length) : 0;

  // Breakdown by date
  const salesByDate = {};
  orders.forEach(o => {
    const d = (o.createdAt || '').split('T')[0] || 'Unknown';
    if (!salesByDate[d]) {
      salesByDate[d] = { date: d, count: 0, totalUsd: 0, totalKhr: 0 };
    }
    salesByDate[d].count += 1;
    salesByDate[d].totalUsd = formatCurrency(salesByDate[d].totalUsd + (Number(o.totalAmount) || 0));
    salesByDate[d].totalKhr = Math.round(salesByDate[d].totalUsd * rate);
  });

  return {
    ok: true,
    cashier: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role
    },
    dateRange,
    metrics: {
      totalTransactions,
      totalSalesUsd: formatCurrency(totalSalesUsd),
      totalSalesKhr: Math.round(totalSalesUsd * rate),
      averageTransactionValue: avgBasketSize,
      totalDiscountsUsd: formatCurrency(totalDiscountsUsd),
      totalRefundsCount: refunds.length,
      totalRefundsUsd: formatCurrency(totalRefundsUsd),
      cancelledTransactionsCount: cancelledOrders.length,
      shiftsWorkedCount: shifts.length,
      totalWorkingMinutes,
      totalWorkingHours: `${Math.floor(totalWorkingMinutes / 60)}h ${totalWorkingMinutes % 60}m`,
      averageSalesPerShift: avgSalesPerShift,
      tenders: {
        cashUsd: formatCurrency(cashSalesUsd),
        cashKhr: Math.round(cashSalesKhr),
        cardUsd: formatCurrency(cardSalesUsd),
        qrUsd: formatCurrency(qrSalesUsd),
        storeCreditUsd: formatCurrency(storeCreditSalesUsd)
      }
    },
    salesByDate: Object.values(salesByDate).sort((a, b) => b.date.localeCompare(a.date)),
    shifts: shifts.map(s => {
      const details = getShiftDetails(s.id);
      return {
        id: s.id,
        registerCode: s.registerCode,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        duration: details?.summary?.durationHours || 'Active',
        totalSalesUsd: details?.summary?.totalSalesRevenueUsd || 0,
        status: s.status,
        cashOverShort: s.cashOverShort || 0
      };
    })
  };
}

// ----------------------------------------------------------------------------
// 8. MANAGER SHIFT DASHBOARD (Section 13.7)
// ----------------------------------------------------------------------------
function getManagerShiftDashboard(organizationId = null) {
  const db = loadDb();
  const rate = getExchangeRate();
  const targetOrg = organizationId || db.organization?.id || 'org-6e9ed3cf';

  // Active shifts
  const activeShifts = db.shifts
    .filter(s => s.status === 'ACTIVE' && (s.organizationId || 'org-loops-001') === targetOrg)
    .map(s => {
      const details = getShiftDetails(s.id);
      return {
        ...s,
        summary: details.summary
      };
    });

  // Recent closed shifts with discrepancies
  const shiftsWithDiscrepancy = db.shifts
    .filter(s => s.status === 'CLOSED' && (s.organizationId || 'org-loops-001') === targetOrg && Math.abs(Number(s.cashOverShort || 0)) >= 0.05)
    .slice(0, 10);

  // Register assignments
  const registers = (db.registers || [])
    .filter(reg => (reg.organizationId || 'org-loops-001') === targetOrg)
    .map(reg => {
      const active = activeShifts.find(s => s.registerId === reg.id);
      const store = (db.locations || []).find(l => l.id === reg.storeId || l.id === reg.locationId);
      return {
        id: reg.id,
        code: reg.registerCode,
        name: reg.name,
        storeId: reg.storeId || reg.locationId || null,
        storeName: store ? store.name : 'Main Branch',
        storeCode: store ? store.code : 'STORE',
        status: reg.status,
        activeShift: active || null
      };
    });

  // Cashiers performance summary
  const cashiers = db.users
    .filter(u => (u.organizationId || 'org-loops-001') === targetOrg && (u.role === 'CASHIER' || u.role === 'STORE_MANAGER' || u.role === 'SHIFT_SUPERVISOR' || u.permissions?.makeSales))
    .map(u => {
      const orders = db.orders.filter(o => o.cashierUserId === u.id && o.status === 'COMPLETED');
      const totalSales = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
      const isWorking = activeShifts.some(s => s.cashierUserId === u.id);
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        isWorking,
        totalSalesUsd: formatCurrency(totalSales),
        orderCount: orders.length
      };
    });

  return {
    ok: true,
    totalRegisters: registers.length,
    activeShiftsCount: activeShifts.length,
    registers,
    activeShifts,
    shiftsWithDiscrepancy,
    cashiers
  };
}

module.exports = {
  openShift,
  getShiftDetails,
  getActiveShift,
  closeShift,
  getShiftHistory,
  reopenShift,
  getCashierPerformance,
  getManagerShiftDashboard
};
