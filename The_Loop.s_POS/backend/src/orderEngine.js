// The Loop.s POS — Order Engine & Cart Processing
const { loadDb, saveDb, generateUuid } = require('./db');

function formatCurrency(val) {
  return Number(Number(val || 0).toFixed(2));
}

function generateOrderNumber(registerCode) {
  const d = new Date();
  const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const randSeq = String(Math.floor(1000 + Math.random() * 9000));
  return `${registerCode || 'REG01'}-${yyyymmdd}-${randSeq}`;
}

function calculateCartTotals(items, orderDiscountPct = 0, taxRate = 0.10) {
  let subtotal = 0;
  let totalLineDiscounts = 0;

  const processedLines = items.map((item, idx) => {
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice) || 0;
    const lineDiscount = Number(item.lineDiscount) || 0;
    const lineRaw = unitPrice * qty;
    const lineAfterDiscount = Math.max(0, lineRaw - lineDiscount);

    subtotal += lineRaw;
    totalLineDiscounts += lineDiscount;

    return {
      lineNo: idx + 1,
      productId: item.productId,
      variantSku: item.variantSku,
      itemTitle: item.itemTitle || item.name,
      quantity: qty,
      unitPrice: formatCurrency(unitPrice),
      lineDiscount: formatCurrency(lineDiscount),
      discountReason: item.discountReason || null,
      taxCode: 'VAT-10',
      taxRate: taxRate,
      lineTotal: formatCurrency(lineAfterDiscount)
    };
  });

  const orderDiscountAmount = formatCurrency((subtotal - totalLineDiscounts) * (Number(orderDiscountPct) / 100));
  const totalDiscounts = formatCurrency(totalLineDiscounts + orderDiscountAmount);
  const netTaxable = Math.max(0, subtotal - totalDiscounts);
  const taxTotal = formatCurrency(netTaxable * taxRate);
  const grandTotal = formatCurrency(netTaxable + taxTotal);

  return {
    subtotal: formatCurrency(subtotal),
    discountTotal: totalDiscounts,
    taxTotal,
    totalAmount: grandTotal,
    lines: processedLines
  };
}

function processCheckout({
  registerId,
  shiftId,
  cashierUserId,
  customer,
  items,
  payments,
  orderDiscountPct = 0,
  savedOrderId = null
}) {
  const db = loadDb();

  if (!items || items.length === 0) {
    return { ok: false, error: 'Cannot checkout with an empty cart' };
  }

  // Section 13.1 Strict Backend Enforcement: Shift required before selling
  const activeShift = (shiftId && db.shifts.find(s => s.id === shiftId && s.status === 'ACTIVE'))
    || (registerId && db.shifts.find(s => s.registerId === registerId && s.status === 'ACTIVE'))
    || (cashierUserId && db.shifts.find(s => s.cashierUserId === cashierUserId && s.status === 'ACTIVE'))
    || db.shifts.find(s => s.status === 'ACTIVE');

  if (!activeShift) {
    return {
      ok: false,
      requiresShift: true,
      error: 'Shift required before selling. Cashier must open an active shift before performing sales transactions.'
    };
  }

  const register = (activeShift && db.registers.find(r => r.id === activeShift.registerId))
    || db.registers.find(r => r.id === registerId)
    || db.registers[0];

  // Calculate totals
  const taxRate = db.organization.taxRate || 0.10;
  const exchangeRate = Number(db.organization.exchangeRate) || 4000;
  const totals = calculateCartTotals(items, orderDiscountPct, taxRate);

  // Validate payments with multi-currency conversion (USD & KHR)
  const totalTendered = payments.reduce((sum, p) => {
    if (p.currencyCode === 'KHR') {
      const khrVal = Number(p.amountKhr || p.amount || 0);
      return sum + (khrVal / exchangeRate);
    }
    return sum + (Number(p.amount) || 0);
  }, 0);

  if (totalTendered < (totals.totalAmount - 0.02)) { // minor cent tolerance
    return { 
      ok: false, 
      error: `Tendered amount ($${formatCurrency(totalTendered)}) is less than total order amount ($${totals.totalAmount})` 
    };
  }

  const orderId = generateUuid();
  const orderNumber = generateOrderNumber(register.registerCode);

  // Create order lines and update local inventory cache
  const orderLines = totals.lines.map(l => {
    // Find variant in local catalog and decrement
    db.products.forEach(p => {
      const v = (p.variants || []).find(vr => vr.sku === l.variantSku);
      if (v) {
        v.onHand = Math.max(0, (v.onHand || 0) - l.quantity);
        v.available = Math.max(0, (v.available || 0) - l.quantity);
      }
    });

    return {
      id: generateUuid(),
      orderId,
      lineNo: l.lineNo,
      productId: l.productId,
      variantSku: l.variantSku,
      itemTitle: l.itemTitle,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineDiscount: l.lineDiscount,
      taxAmount: formatCurrency((l.lineTotal / (totals.subtotal - totals.discountTotal || 1)) * totals.taxTotal),
      lineTotal: l.lineTotal
    };
  });

  // Calculate change for cash payment
  let cashChangeUsd = 0;
  const processedPayments = payments.map(p => {
    const isKhr = p.currencyCode === 'KHR';
    const rawAmt = isKhr ? Number(p.amountKhr || p.amount) : Number(p.amount);
    const normalizedUsd = isKhr ? formatCurrency(rawAmt / exchangeRate) : formatCurrency(rawAmt);
    const tenderedUsd = isKhr ? (Number(p.tenderedKhr || rawAmt) / exchangeRate) : (Number(p.tenderedAmount) || rawAmt);
    const changeUsd = Math.max(0, tenderedUsd - normalizedUsd);

    if (p.method === 'CASH') {
      cashChangeUsd += changeUsd;
      // Update expected cash in active shift (normalized to USD base)
      activeShift.expectedCash = formatCurrency((activeShift.expectedCash || 0) + normalizedUsd);
    }

    return {
      id: generateUuid(),
      orderId,
      method: p.method, // CASH, CREDIT_CARD, QR_KHQR, STORE_CREDIT
      currencyCode: isKhr ? 'KHR' : 'USD',
      exchangeRate: isKhr ? exchangeRate : 1.0,
      amount: normalizedUsd,
      amountKhr: isKhr ? rawAmt : Math.round(normalizedUsd * exchangeRate),
      tenderedAmount: isKhr ? (tenderedUsd * exchangeRate) : tenderedUsd,
      changeGiven: changeUsd,
      changeGivenKhr: Math.round(changeUsd * exchangeRate),
      referenceCode: p.referenceCode || (p.method === 'QR_KHQR' ? `KHQR-${Date.now().toString().slice(-6)}` : null)
    };
  });

  const targetStoreId = register.locationId || register.storeId || 'loc-1';
  const targetStore = (db.locations || []).find(l => l.id === targetStoreId);

  const orderRecord = {
    id: orderId,
    transactionId: orderId,
    orderNumber,
    businessId: register.organizationId || db.organization?.id || 'org-loops-001',
    organizationId: register.organizationId || db.organization?.id || 'org-loops-001',
    storeId: targetStoreId,
    storeName: targetStore?.name || 'Sisowath Flagship Store',
    registerId: register.id,
    registerCode: register.registerCode,
    shiftId: activeShift.id,
    employeeId: cashierUserId || activeShift.cashierUserId,
    cashierUserId: cashierUserId || activeShift.cashierUserId,
    customerId: customer?.id || null,
    customerName: customer?.name || 'Walk-in Customer',
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    totalAmount: totals.totalAmount,
    currencyCode: 'USD',
    exchangeRate,
    khrTotal: Math.round(totals.totalAmount * exchangeRate),
    status: 'COMPLETED',
    savedOrderId: savedOrderId || null,
    createdAt: new Date().toISOString()
  };

  if (savedOrderId) {
    try {
      const { markSavedOrderCompleted } = require('./savedOrderEngine');
      markSavedOrderCompleted({
        savedOrderId,
        completedOrderId: orderNumber,
        completingCashierId: orderRecord.cashierUserId,
        completingShiftId: activeShift.id
      });
    } catch (e) {
      console.warn('[Checkout] Could not link saved order:', e.message);
    }
  }

  db.orders.unshift(orderRecord);
  db.orderLines.push(...orderLines);
  db.payments.push(...processedPayments);

  // 1. Atomically sync completed sale into SQLite Enterprise Database (pos_orders, stock_balances, stock_ledger)
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const sqlDb = getDatabase();

    const itemsJson = JSON.stringify(orderLines.map(l => {
      let costMinor = 0;
      db.products.forEach(p => {
        const v = (p.variants || []).find(vr => vr.sku === l.variantSku);
        if (v) costMinor = (v.costMinor && v.costMinor > 0) ? v.costMinor : (p.costMinor || 0);
      });
      return {
        productId: l.productId,
        sku: l.variantSku,
        title: l.itemTitle,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        costMinor,
        total: l.lineTotal
      };
    }));

    const paymentsJson = JSON.stringify(processedPayments);

    sqlDb.prepare(`
      INSERT INTO pos_orders (
        id, organization_id, receipt_number, store_id, register_id, shift_id,
        cashier_id, cashier_name, subtotal_minor, tax_minor, discount_minor,
        total_minor, exchange_rate, payment_methods_json, items_json, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
    `).run(
      orderRecord.id,
      orderRecord.organizationId,
      orderRecord.orderNumber,
      orderRecord.storeId,
      orderRecord.registerId,
      orderRecord.shiftId,
      orderRecord.cashierUserId,
      activeShift?.cashierName || 'Cashier',
      Math.round(totals.subtotal * 100),
      Math.round(totals.taxTotal * 100),
      Math.round(totals.discountTotal * 100),
      Math.round(totals.totalAmount * 100),
      exchangeRate,
      paymentsJson,
      itemsJson,
      orderRecord.createdAt
    );

    // Update SQLite stock_balances and stock_ledger
    orderLines.forEach(l => {
      const q = l.quantity;
      const sku = l.variantSku;
      const targetStoreId = orderRecord.storeId;

      const balRow = sqlDb.prepare('SELECT on_hand FROM stock_balances WHERE sku = ? AND location_id = ?').get(sku, targetStoreId);
      const prevBal = balRow ? balRow.on_hand : 0;
      const newBal = Math.max(0, prevBal - q);

      sqlDb.prepare(`
        INSERT INTO stock_balances (id, organization_id, location_id, sku, on_hand, reserved, damaged, rop, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, 0, 5, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET on_hand = excluded.on_hand, updated_at = datetime('now')
      `).run(`bal-${targetStoreId}-${sku}`, orderRecord.organizationId, targetStoreId, sku, newBal);

      sqlDb.prepare(`
        INSERT INTO stock_ledger (
          id, organization_id, timestamp, type, sku, product_code, product_name,
          variant_title, location_id, location_name, delta, balance_after,
          unit_cost_minor, reference_no, staff, reason
        ) VALUES (?, ?, datetime('now'), 'SALE_OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'mov-' + generateUuid().slice(0, 8),
        orderRecord.organizationId,
        sku,
        sku,
        l.itemTitle,
        l.itemTitle,
        targetStoreId,
        orderRecord.storeName,
        -q,
        newBal,
        0,
        orderRecord.orderNumber,
        activeShift?.cashierName || 'Cashier',
        `POS Sale #${orderRecord.orderNumber}`
      );
    });
  } catch (sqlErr) {
    console.warn('[Checkout] SQLite sync error:', sqlErr.message);
  }

  // 2. Synchronize directly into Stock Management (store.json)
  try {
    const fs = require('fs');
    const path = require('path');
    const stockStorePath = path.resolve(__dirname, '..', '..', '..', 'Stock_management_loops', 'backend', 'data', 'store.json');
    if (fs.existsSync(stockStorePath)) {
      const stockStore = JSON.parse(fs.readFileSync(stockStorePath, 'utf8'));
      orderLines.forEach(l => {
        const sku = l.variantSku;
        const q = l.quantity;
        const targetStoreId = orderRecord.storeId;

        let locBal = (stockStore.stockBalances || []).find(b => b.sku === sku && b.locationId === targetStoreId)
          || (stockStore.stockBalances || []).find(b => b.sku === sku);
        if (locBal) {
          locBal.onHand = Math.max(0, locBal.onHand - q);
        }

        // Decrement variant onHand in Stock store.json
        (stockStore.products || []).forEach(sp => {
          (sp.variants || []).forEach(sv => {
            if (sv.sku === sku) {
              sv.onHand = Math.max(0, (sv.onHand || 0) - q);
            }
          });
        });

        // Add ledger entry
        if (!stockStore.ledger) stockStore.ledger = [];
        stockStore.ledger.unshift({
          id: 'mov-' + generateUuid().slice(0, 8),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          type: 'SALE_OUT',
          sku,
          productCode: sku,
          productName: l.itemTitle,
          variantTitle: l.itemTitle,
          locationId: targetStoreId,
          locationName: orderRecord.storeName,
          delta: -q,
          balanceAfter: locBal ? locBal.onHand : 0,
          unitCostMinor: 0,
          referenceNo: orderRecord.orderNumber,
          staff: activeShift?.cashierName || 'Cashier',
          reason: `POS Sale #${orderRecord.orderNumber}`
        });
      });

      // Add sale record
      if (!stockStore.sales) stockStore.sales = [];
      stockStore.sales.unshift({
        id: 'sale-' + generateUuid().slice(0, 8),
        saleNumber: orderRecord.orderNumber,
        customerId: customer?.id || 'WALK_IN',
        customerName: customer?.name || 'Walk-in Retail Guest',
        date: new Date().toISOString().replace('T', ' ').substring(0, 19),
        locationId: orderRecord.storeId,
        locationName: orderRecord.storeName,
        subtotalMinor: Math.round(totals.subtotal * 100),
        discountMinor: Math.round(totals.discountTotal * 100),
        taxMinor: Math.round(totals.taxTotal * 100),
        totalMinor: Math.round(totals.totalAmount * 100),
        method: processedPayments[0]?.method || 'CASH',
        status: 'COMPLETED',
        items: orderLines.map(l => ({
          sku: l.variantSku,
          title: l.itemTitle,
          qty: l.quantity,
          priceMinor: Math.round(l.unitPrice * 100)
        }))
      });

      fs.writeFileSync(stockStorePath, JSON.stringify(stockStore, null, 2), 'utf8');
    }
  } catch (stkErr) {
    console.warn('[Checkout] Stock store.json sync error:', stkErr.message);
  }

  // Queue Transactional Event into POS Outbox
  const outboxEvent = {
    id: generateUuid(),
    eventType: 'ORDER_COMPLETED',
    schemaVersion: 1,
    sourceSystem: 'POS',
    organizationId: orderRecord.organizationId,
    locationId: register.locationId,
    registerId: register.id,
    orderId,
    orderNumber,
    payload: {
      orderId,
      orderNumber,
      timestamp: orderRecord.createdAt,
      locationId: register.locationId,
      cashierUserId: orderRecord.cashierUserId,
      customerName: orderRecord.customerName,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      totalAmount: totals.totalAmount,
      exchangeRate,
      khrTotal: orderRecord.khrTotal,
      items: orderLines.map(l => ({
        productId: l.productId,
        sku: l.variantSku,
        title: l.itemTitle,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        total: l.lineTotal
      })),
      payments: processedPayments.map(p => ({
        method: p.method,
        currencyCode: p.currencyCode,
        amount: p.amount,
        amountKhr: p.amountKhr,
        referenceCode: p.referenceCode
      }))
    },
    status: 'PENDING',
    attemptCount: 0,
    createdAt: new Date().toISOString()
  };

  db.outbox.unshift(outboxEvent);
  saveDb();

  return {
    ok: true,
    order: orderRecord,
    lines: orderLines,
    payments: processedPayments,
    change: formatCurrency(cashChangeUsd),
    changeKhr: Math.round(cashChangeUsd * exchangeRate),
    exchangeRate,
    outboxEventId: outboxEvent.id
  };
}

function processRefund({
  originalOrderNumber,
  itemsToRefund,
  refundMethod,
  reasonCode,
  cashierUserId,
  approvedByUserId
}) {
  const db = loadDb();
  const order = db.orders.find(o => o.orderNumber === originalOrderNumber || o.id === originalOrderNumber);

  if (!order) {
    return { ok: false, error: 'Original order not found' };
  }

  const existingLines = db.orderLines.filter(l => l.orderId === order.id);
  let totalRefund = 0;

  const refundId = generateUuid();
  const processedRefundLines = itemsToRefund.map(item => {
    const originalLine = existingLines.find(l => l.variantSku === item.variantSku) || existingLines[0];
    const qty = Number(item.quantity) || 1;
    const amount = formatCurrency((originalLine ? originalLine.unitPrice : 0) * qty);
    totalRefund += amount;

    // Restock assessment: if RESELLABLE, increment local stock
    if (item.restockDecision === 'RESELLABLE') {
      db.products.forEach(p => {
        const v = (p.variants || []).find(vr => vr.sku === item.variantSku);
        if (v) {
          v.onHand = (v.onHand || 0) + qty;
          v.available = (v.available || 0) + qty;
        }
      });
    }

    return {
      id: generateUuid(),
      refundId,
      variantSku: item.variantSku,
      itemTitle: item.itemTitle || originalLine?.itemTitle || 'Returned Item',
      quantity: qty,
      amount,
      restockDecision: item.restockDecision || 'RESELLABLE' // RESELLABLE, DAMAGED
    };
  });

  const refundRecord = {
    id: refundId,
    organizationId: order.organizationId || 'org-loops-001',
    originalOrderId: order.id,
    originalOrderNumber: order.orderNumber,
    shiftId: order.shiftId,
    cashierUserId,
    approvedByUserId: approvedByUserId || cashierUserId,
    reasonCode: reasonCode || 'CUSTOMER_REQUEST',
    refundMethod: refundMethod || 'CASH',
    totalRefund: formatCurrency(totalRefund),
    status: 'COMPLETED',
    createdAt: new Date().toISOString()
  };

  db.refunds.unshift(refundRecord);
  db.refundLines.push(...processedRefundLines);

  // Queue REFUND_COMPLETED event in outbox
  db.outbox.unshift({
    id: generateUuid(),
    eventType: 'REFUND_COMPLETED',
    schemaVersion: 1,
    sourceSystem: 'POS',
    payload: {
      refundId,
      originalOrderNumber: order.orderNumber,
      totalRefund: formatCurrency(totalRefund),
      refundMethod,
      items: processedRefundLines
    },
    status: 'PENDING',
    attemptCount: 0,
    createdAt: new Date().toISOString()
  });

  saveDb();

  return {
    ok: true,
    refund: refundRecord,
    lines: processedRefundLines
  };
}

function parkCart({ cartItems, note, customerName, cashierUserId }) {
  const db = loadDb();
  const parked = {
    id: 'park-' + generateUuid().slice(0, 8),
    note: note || 'Parked order',
    customerName: customerName || 'Walk-in',
    cashierUserId,
    items: cartItems,
    itemCount: cartItems.reduce((acc, i) => acc + (i.quantity || 1), 0),
    createdAt: new Date().toISOString()
  };
  db.parkedCarts.unshift(parked);
  saveDb();
  return { ok: true, parkedCart: parked };
}

function recallCart(parkedId) {
  const db = loadDb();
  const idx = db.parkedCarts.findIndex(p => p.id === parkedId);
  if (idx === -1) return { ok: false, error: 'Parked cart not found' };
  const cart = db.parkedCarts.splice(idx, 1)[0];
  saveDb();
  return { ok: true, cart };
}

module.exports = {
  calculateCartTotals,
  processCheckout,
  processRefund,
  parkCart,
  recallCart
};

