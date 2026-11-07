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

function syncShiftToSqlite(shift, isClosing = false) {
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSql = getDatabase();
    if (isClosing) {
      dbSql.prepare(`
        UPDATE shifts SET
          status = 'CLOSED',
          closed_at = ?,
          actual_cash_usd = ?,
          actual_cash_khr = ?,
          discrepancy_usd = ?,
          discrepancy_khr = ?,
          closing_note = ?
        WHERE id = ?
      `).run(
        shift.closedAt,
        shift.countedCashUsd || 0,
        shift.countedCashKhr || 0,
        shift.cashDifferenceUsd || 0,
        shift.cashDifferenceKhr || 0,
        shift.closingNotes || '',
        shift.id
      );
    } else {
      dbSql.prepare(`
        INSERT OR REPLACE INTO shifts (
          id, organization_id, store_id, register_id, cashier_id, cashier_name,
          opened_at, closed_at, status, starting_cash_usd, starting_cash_khr,
          expected_cash_usd, expected_cash_khr, actual_cash_usd, actual_cash_khr,
          discrepancy_usd, discrepancy_khr, closing_note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        shift.id,
        shift.organizationId || shift.businessId || 'org-loops-001',
        shift.storeId || 'loc-01',
        shift.registerId || 'reg-01',
        shift.cashierUserId || shift.employeeId,
        shift.cashierName || 'Cashier',
        shift.openedAt,
        shift.closedAt || null,
        shift.status === 'ACTIVE' ? 'OPEN' : 'CLOSED',
        shift.openingFloatUsd || 0,
        shift.openingFloatKhr || 0,
        shift.expectedCashUsd || shift.openingFloatUsd || 0,
        shift.expectedCashKhr || shift.openingFloatKhr || 0,
        shift.countedCashUsd || 0,
        shift.countedCashKhr || 0,
        shift.cashDifferenceUsd || 0,
        shift.cashDifferenceKhr || 0,
        shift.closingNotes || '',
        shift.openedAt
      );
    }
  } catch (e) {
    // Non-blocking sync warning
  }
}


// ----------------------------------------------------------------------------
// 1. OPEN SHIFT (Section 13.1 & 13.2)
// ----------------------------------------------------------------------------
function openShift({
  registerId,
  cashierUserId,
  storeId,
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

  // Determine targetStoreId
  let targetStoreId = storeId;
  if (!targetStoreId && registerId) {
    const r = (db.registers || []).find(reg => reg.id === registerId);
    if (r) targetStoreId = r.locationId || r.storeId;
  }
  if (!targetStoreId) {
    targetStoreId = (cashier.assignedStoreIds?.[0] !== '*' && cashier.assignedStoreIds?.[0]) ||
                    (cashier.locations?.[0] !== '*' && cashier.locations?.[0]) ||
                    (db.locations?.[0]?.id || 'loc-01');
  }

  // Section 15.8 / Specification Section 4: Store Access Check
  const { canUserAccessStore } = require('./storeManager');
  if (cashier.role !== 'OWNER' && cashier.role !== 'SUPER_ADMIN') {
    if (!canUserAccessStore(cashier, targetStoreId)) {
      return {
        ok: false,
        code: 403,
        error: `Access Denied: Cashier ${cashier.fullName} is not authorized to open shifts or operate registers at store "${targetStoreId}".`
      };
    }
  }

  // Section 2 & 6: Prevent simultaneous duplicate shifts for the same user in the same store
  const existingStoreShift = db.shifts.find(
    s => s.cashierUserId === cashier.id &&
         (s.storeId === targetStoreId || s.locationId === targetStoreId) &&
         s.status === 'ACTIVE'
  );
  if (existingStoreShift) {
    return {
      ok: false,
      code: 409,
      error: `Cashier ${cashier.fullName} already has an active shift (#${existingStoreShift.id}) in store "${targetStoreId}". Please close it before opening a new shift.`,
      activeShiftId: existingStoreShift.id
    };
  }

  // Identify or auto-assign the register within the target store
  let register = null;
  if (registerId) {
    register = (db.registers || []).find(r => r.id === registerId && (r.locationId === targetStoreId || r.storeId === targetStoreId));
  }
  if (!register) {
    register = (db.registers || []).find(r => (r.locationId === targetStoreId || r.storeId === targetStoreId));
  }
  if (!register) {
    const userStore = (db.locations || []).find(l => l.id === targetStoreId) || {
      id: targetStoreId,
      name: `${cashier.fullName}'s Store`,
      organizationId: cashierOrgId
    };
    register = {
      id: `reg-${targetStoreId.replace(/[^a-zA-Z0-9]/g, '')}-01`,
      organizationId: cashierOrgId,
      locationId: userStore.id,
      storeId: userStore.id,
      registerCode: 'REG-01',
      name: `${userStore.name} Register 01`,
      status: 'CLOSED',
      currentShiftId: null,
      currentCashierId: null
    };
    if (!db.registers) db.registers = [];
    db.registers.push(register);
  }

  const shiftId = 'shift-' + Date.now().toString().slice(-6) + '-' + generateUuid().slice(0, 4);
  const posSessionId = 'sess-' + Date.now().toString(36) + '-' + generateUuid().slice(0, 6);
  const floatUsd = formatCurrency(openingFloatUsd);
  const floatKhr = Math.round(Number(openingFloatKhr) || 0);
  const totalOpeningUsd = formatCurrency(floatUsd + (floatKhr / rate));

  const store = (db.locations || []).find(l => l.id === targetStoreId);
  const newShift = {
    id: shiftId,
    posSessionId,
    businessId: register.organizationId || cashierOrgId,
    organizationId: register.organizationId || cashierOrgId,
    storeId: targetStoreId,
    storeName: store?.name || targetStoreId,
    registerId: register.id,
    registerCode: register.registerCode,
    employeeId: cashier.id,
    cashierUserId: cashier.id,
    cashierName: cashier.fullName || 'Cashier',
    cashierEmail: cashier.email,
    openedAt: new Date().toISOString(),
    closedAt: null,
    closedByUserId: null,
    closedByName: null,
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
        details: `Shift opened with float: ${floatUsd} USD + ${floatKhr.toLocaleString()} KHR`
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
    details: `Shift #${shiftId} (Session ${posSessionId}) opened in store ${targetStoreId} by ${cashier.fullName}`,
    timestamp: new Date().toISOString()
  });

  saveDb();
  syncShiftToSqlite(newShift, false);
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

  // 1. Strict Cashier-and-Store Scoped Session (Section 2 & 3)
  if (cashierUserId && storeId) {
    shift = db.shifts.find(s =>
      s.cashierUserId === cashierUserId &&
      (s.storeId === storeId || s.locationId === storeId) &&
      s.status === 'ACTIVE'
    );
  } else if (cashierUserId) {
    // If cashierUserId is provided without storeId, find any active shift for this cashier
    shift = db.shifts.find(s => s.cashierUserId === cashierUserId && s.status === 'ACTIVE');
  } else if (registerId && storeId) {
    shift = db.shifts.find(s =>
      s.registerId === registerId &&
      (s.storeId === storeId || s.locationId === storeId) &&
      s.status === 'ACTIVE'
    );
  } else if (storeId) {
    shift = db.shifts.find(s => (s.storeId === storeId || s.locationId === storeId) && s.status === 'ACTIVE');
  } else if (registerId) {
    shift = db.shifts.find(s => s.registerId === registerId && s.status === 'ACTIVE');
  }

  // Calculate userActiveShifts for multi-store visibility
  const userActiveShifts = cashierUserId
    ? (db.shifts || [])
        .filter(s => s.cashierUserId === cashierUserId && s.status === 'ACTIVE')
        .map(s => ({
          shiftId: s.id,
          posSessionId: s.posSessionId,
          storeId: s.storeId,
          storeName: s.storeName,
          registerId: s.registerId,
          openedAt: s.openedAt
        }))
    : [];

  if (!shift) {
    return {
      hasActiveShift: false,
      shift: null,
      summary: null,
      userActiveShifts
    };
  }

  const details = getShiftDetails(shift.id);
  const reg = db.registers.find(r => r.id === shift.registerId) || db.registers[0];
  return {
    hasActiveShift: true,
    shift: details.shift,
    summary: details.summary,
    register: reg,
    userActiveShifts
  };
}

// ----------------------------------------------------------------------------
// 4. CLOSE SHIFT (Section 13.4)
// ----------------------------------------------------------------------------
function closeShift({
  shiftId,
  storeId,
  registerId,
  countedCashUsd = 0,
  countedCashKhr = 0,
  closingNotes = '',
  closedByUserId
}, authUser = null) {
  const db = loadDb();
  let shift = null;

  if (shiftId) {
    shift = db.shifts.find(s => s.id === shiftId && s.status === 'ACTIVE');
  }
  if (!shift && closedByUserId && storeId) {
    shift = db.shifts.find(s =>
      s.cashierUserId === closedByUserId &&
      (s.storeId === storeId || s.locationId === storeId) &&
      s.status === 'ACTIVE'
    );
  }
  if (!shift && closedByUserId) {
    shift = db.shifts.find(s => s.cashierUserId === closedByUserId && s.status === 'ACTIVE');
  }

  // Never fall back to arbitrary active shifts! Shift isolation requires explicit target
  if (!shift) {
    return { ok: false, error: 'Active shift not found or already closed' };
  }

  const closedByUser = (closedByUserId ? db.users.find(u => u.id === closedByUserId) : null) || authUser;

  // Authorization Check (Section 5): Opener or authorized manager/owner only
  if (closedByUser) {
    const isOpener = shift.cashierUserId === closedByUser.id;
    const isAuthorizedManager = ['OWNER', 'SUPER_ADMIN', 'POS_ADMIN', 'STORE_MANAGER'].includes(closedByUser.role) ||
                                Boolean(closedByUser.permissions?.canManageShifts);
    if (!isOpener && !isAuthorizedManager) {
      return {
        ok: false,
        code: 403,
        error: `Access Denied: Only the cashier who opened this shift (${shift.cashierName}) or an authorized manager may close it.`
      };
    }
  }

  const details = getShiftDetails(shift.id);
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
      error: `Cash discrepancy detected (${diffTotalUsd >= 0 ? '+' : ''}${diffTotalUsd}). Closing notes explaining the discrepancy are required by business policy.`
    };
  }

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
  shift.closedByUserId = closedByUser?.id || shift.cashierUserId;
  shift.closedByName = closedByUser?.fullName || shift.cashierName;
  shift.status = 'CLOSED';

  shift.auditTrail = shift.auditTrail || [];
  shift.auditTrail.push({
    action: 'SHIFT_CLOSED',
    by: shift.closedByName,
    timestamp: new Date().toISOString(),
    details: `Shift closed. Counted: ${countedUsd} USD + ${countedKhr.toLocaleString()} KHR. Discrepancy: ${diffTotalUsd}.`
  });

  // Check if register has any remaining active shifts
  const register = db.registers.find(r => r.id === shift.registerId);
  if (register) {
    const otherActive = db.shifts.find(s => s.registerId === register.id && s.id !== shift.id && s.status === 'ACTIVE');
    if (!otherActive) {
      register.status = 'CLOSED';
      register.currentShiftId = null;
      register.currentCashierId = null;
    } else {
      register.currentShiftId = otherActive.id;
      register.currentCashierId = otherActive.cashierUserId;
    }
  }

  // Queue SHIFT_CLOSED Z-Report event into outbox for Loops Finance
  const zReportPayload = {
    shiftId: shift.id,
    posSessionId: shift.posSessionId,
    storeId: shift.storeId,
    registerId: shift.registerId,
    registerCode: register?.registerCode || 'REG-01',
    cashierUserId: shift.cashierUserId,
    cashierName: shift.cashierName,
    closedByUserId: shift.closedByUserId,
    closedByName: shift.closedByName,
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
    userId: shift.closedByUserId,
    userName: shift.closedByName,
    details: `Shift #${shift.id} closed on ${register?.registerCode || 'REG-01'} by ${shift.closedByName}. Counted: ${countedTotalUsd}, Discrepancy: ${diffTotalUsd}`,
    timestamp: new Date().toISOString()
  });

  saveDb();
  syncShiftToSqlite(shift, true);

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
function getManagerShiftDashboard(organizationId = null, user = null) {
  const db = loadDb();
  const rate = getExchangeRate();
  const targetOrg = organizationId || db.organization?.id || 'org-6e9ed3cf';
  const { canUserAccessStore } = require('./storeManager');

  const isUserRestricted = user && user.role !== 'OWNER' && user.role !== 'SUPER_ADMIN';

  // Active shifts
  const activeShifts = db.shifts
    .filter(s => {
      if (s.status !== 'ACTIVE' || (s.organizationId || 'org-loops-001') !== targetOrg) return false;
      if (isUserRestricted) {
        const shiftStore = s.storeId || s.locationId || 'loc-1';
        return canUserAccessStore(user, shiftStore);
      }
      return true;
    })
    .map(s => {
      const details = getShiftDetails(s.id);
      return {
        ...s,
        summary: details.summary
      };
    });

  // Recent closed shifts with discrepancies
  const shiftsWithDiscrepancy = db.shifts
    .filter(s => {
      if (s.status !== 'CLOSED' || (s.organizationId || 'org-loops-001') !== targetOrg) return false;
      if (Math.abs(Number(s.cashOverShort || 0)) < 0.05) return false;
      if (isUserRestricted) {
        const shiftStore = s.storeId || s.locationId || 'loc-1';
        return canUserAccessStore(user, shiftStore);
      }
      return true;
    })
    .slice(0, 10);

  // Register assignments
  const registers = (db.registers || [])
    .filter(reg => {
      if ((reg.organizationId || 'org-loops-001') !== targetOrg) return false;
      if (isUserRestricted) {
        const regStore = reg.storeId || reg.locationId || 'loc-1';
        return canUserAccessStore(user, regStore);
      }
      return true;
    })
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


function getUserActiveShifts(userId) {
  if (!userId) return [];
  const db = loadDb();
  return (db.shifts || [])
    .filter(s => s.cashierUserId === userId && s.status === 'ACTIVE')
    .map(s => ({
      shiftId: s.id,
      posSessionId: s.posSessionId,
      storeId: s.storeId,
      storeName: s.storeName,
      registerId: s.registerId,
      openedAt: s.openedAt,
      cashierName: s.cashierName
    }));
}

module.exports = {
  getUserActiveShifts,
  syncShiftToSqlite,
  openShift,
  getShiftDetails,
  getActiveShift,
  closeShift,
  getShiftHistory,
  reopenShift,
  getCashierPerformance,
  getManagerShiftDashboard
};
