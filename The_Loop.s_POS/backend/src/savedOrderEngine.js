// The Loop.s POS — Saved Orders & Unpaid Orders (Hold Orders) Engine (Section 14)
// Preserves unpaid carts, customer identities, cross-shift resumption, and audit history
const { loadDb, saveDb, generateUuid } = require('./db');

function formatCurrency(val) {
  return Number(Number(val || 0).toFixed(2));
}

function getExchangeRate() {
  const db = loadDb();
  return Number(db.organization?.exchangeRate) || 4000;
}

// ----------------------------------------------------------------------------
// 1. SAVE AN UNPAID ORDER (Section 14.1)
// ----------------------------------------------------------------------------
function saveUnpaidOrder(params = {}) {
  const customerName = params.customerName || params.customer?.name;
  const customerPhone = params.customerPhone || params.customer?.phone || '';
  const orderNote = params.orderNote || params.notes || params.customer?.notes || '';
  const expectedPickup = params.expectedPickup || params.customer?.expectedPickup || null;
  const cartItems = params.cartItems || params.items || [];
  const cashierUserId = params.cashierUserId;
  const cashierName = params.cashierName;
  const shiftId = params.shiftId;
  const registerId = params.registerId;
  const orderDiscountPct = params.orderDiscountPct || params.discountPct || 0;
  const db = loadDb();
  const rate = getExchangeRate();

  // Rule 14.1: Customer Name is mandatory
  if (!customerName || customerName.trim().length === 0) {
    return { ok: false, error: 'Customer name is required to save an unpaid order.' };
  }

  if (!cartItems || cartItems.length === 0) {
    return { ok: false, error: 'Cannot save an order with an empty cart.' };
  }

  const cashier = db.users.find(u => u.id === cashierUserId) || {
    id: cashierUserId,
    fullName: cashierName || 'Cashier'
  };

  const register = db.registers.find(r => r.id === registerId) || db.registers[0];

  // Calculate cart financials without charging or deducting stock
  let subtotal = 0;
  let totalLineDiscounts = 0;

  const processedItems = cartItems.map((item, idx) => {
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice) || 0;
    const lineDiscount = Number(item.lineDiscount) || 0;
    const rawTotal = unitPrice * qty;
    const afterDiscount = Math.max(0, rawTotal - lineDiscount);

    subtotal += rawTotal;
    totalLineDiscounts += lineDiscount;

    return {
      lineNo: idx + 1,
      productId: item.productId,
      variantSku: item.variantSku,
      itemTitle: item.itemTitle || item.name,
      quantity: qty,
      unitPrice: formatCurrency(unitPrice),
      lineDiscount: formatCurrency(lineDiscount),
      lineTotal: formatCurrency(afterDiscount),
      image: item.image || item.imageUrl || '📦'
    };
  });

  const taxRate = db.organization?.taxRate || 0.10;
  const orderDiscountAmount = formatCurrency(
    (subtotal - totalLineDiscounts) * (Number(orderDiscountPct) / 100)
  );
  const totalDiscounts = formatCurrency(totalLineDiscounts + orderDiscountAmount);
  const netTaxable = Math.max(0, subtotal - totalDiscounts);
  const taxTotal = formatCurrency(netTaxable * taxRate);
  const grandTotal = formatCurrency(netTaxable + taxTotal);
  const grandTotalKhr = Math.round(grandTotal * rate);

  const savedOrderId = 'saved-' + generateUuid().slice(0, 8);
  const holdNumber = 'HOLD-' + Math.floor(1000 + Math.random() * 9000);
  const orderOrgId = register?.organizationId || cashier?.organizationId || params.organizationId || 'org-loops-001';

  const newSavedOrder = {
    id: savedOrderId,
    organizationId: orderOrgId,
    orderNumber: holdNumber,
    customerName: customerName.trim(),
    customerPhone: (customerPhone || '').trim(),
    orderNote: (orderNote || '').trim(),
    expectedPickup: expectedPickup || null,
    customer: {
      name: customerName.trim(),
      phone: (customerPhone || '').trim(),
      notes: (orderNote || '').trim(),
      expectedPickup: expectedPickup || null
    },
    cashierUserId: cashier.id,
    cashierName: cashier.fullName,
    originalShiftId: shiftId || null,
    completingShiftId: null,
    storeId: register.locationId || 'loc-1',
    registerId: register.id,
    registerCode: register.registerCode,
    items: processedItems,
    itemCount: processedItems.reduce((acc, i) => acc + i.quantity, 0),
    orderDiscountPct: Number(orderDiscountPct) || 0,
    subtotal: formatCurrency(subtotal),
    discountTotal: totalDiscounts,
    taxTotal,
    totalAmount: grandTotal,
    totalAmountKhr: grandTotalKhr,
    currencyCode: 'USD',
    exchangeRateSnapshot: rate,
    paymentStatus: 'UNPAID',
    status: 'ON_HOLD', // 'ON_HOLD', 'PAID', 'CANCELLED'
    completedOrderId: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    auditTrail: [
      {
        action: 'ORDER_SAVED_ON_HOLD',
        by: cashier.fullName,
        timestamp: new Date().toISOString(),
        details: `Cart saved for customer "${customerName}" with ${processedItems.length} line items ($${grandTotal})`
      }
    ]
  };

  if (!db.savedOrders) db.savedOrders = [];
  db.savedOrders.unshift(newSavedOrder);

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'ORDER_HELD',
    userId: cashier.id,
    userName: cashier.fullName,
    details: `Order #${holdNumber} held for "${customerName}" ($${grandTotal})`,
    timestamp: new Date().toISOString()
  });

  saveDb();
  return { ok: true, savedOrder: newSavedOrder };
}

// ----------------------------------------------------------------------------
// 2. GET SAVED ORDERS LIST WITH FILTERS (Section 14.2)
// ----------------------------------------------------------------------------
function getSavedOrders({
  search = '',
  cashierId = 'ALL',
  shiftId = 'ALL',
  status = 'ALL',
  dateRange = 'ALL',
  organizationId = null,
  user = null
} = {}) {
  const db = loadDb();
  let list = db.savedOrders || [];

  const targetOrg = organizationId || user?.organizationId;
  if (targetOrg) {
    list = list.filter(o => (o.organizationId || 'org-loops-001') === targetOrg);
  }

  if (user && user.role !== 'OWNER' && user.role !== 'SUPER_ADMIN') {
    const { canUserAccessStore } = require('./storeManager');
    list = list.filter(o => canUserAccessStore(user, o.storeId || o.locationId));
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  list = list.filter(o => {
    // Search by Customer, Phone, or Hold Order Number
    if (search) {
      const q = search.toLowerCase();
      const matchCust = (o.customerName || '').toLowerCase().includes(q);
      const matchPhone = (o.customerPhone || '').toLowerCase().includes(q);
      const matchNum = (o.orderNumber || '').toLowerCase().includes(q);
      if (!matchCust && !matchPhone && !matchNum) return false;
    }

    // Cashier filter
    if (cashierId !== 'ALL' && o.cashierUserId !== cashierId) return false;

    // Shift filter
    if (shiftId !== 'ALL' && o.originalShiftId !== shiftId) return false;

    // Status filter
    if (status !== 'ALL' && o.status !== status) return false;

    // Date range
    if (dateRange === 'TODAY') {
      const d = (o.createdAt || '').split('T')[0];
      if (d !== todayStr) return false;
    } else if (dateRange === '7DAYS') {
      const past7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      if (new Date(o.createdAt) < past7) return false;
    }

    return true;
  });

  return list;
}

// ----------------------------------------------------------------------------
// 3. RESUME SAVED ORDER (Section 14.3)
// ----------------------------------------------------------------------------
function resumeSavedOrder({ savedOrderId }) {
  const db = loadDb();
  const order = (db.savedOrders || []).find(o => o.id === savedOrderId);

  if (!order) {
    return { ok: false, error: 'Saved order not found' };
  }

  if (order.status === 'PAID') {
    return { ok: false, error: `This order (#${order.orderNumber}) was already paid on ${new Date(order.completedAt).toLocaleString()}` };
  }

  if (order.status === 'CANCELLED') {
    return { ok: false, error: `This order (#${order.orderNumber}) was cancelled and cannot be resumed.` };
  }

  // Inspect live catalog for stock and price changes (Rule 14.5)
  const warnings = [];
  const restoredCartItems = order.items.map(item => {
    let currentProd = null;
    let currentVar = null;

    db.products.forEach(p => {
      (p.variants || []).forEach(v => {
        if (v.sku === item.variantSku) {
          currentProd = p;
          currentVar = v;
        }
      });
      if (!currentVar && p.code === item.variantSku) {
        currentProd = p;
      }
    });

    if (currentVar) {
      if (currentVar.price !== item.unitPrice) {
        warnings.push(`Price for "${item.itemTitle}" changed from $${item.unitPrice} to $${currentVar.price}`);
      }
      if (currentVar.onHand < item.quantity) {
        warnings.push(`Low stock warning: "${item.itemTitle}" only has ${currentVar.onHand} units physically available.`);
      }
    }

    return {
      productId: item.productId,
      variantSku: item.variantSku,
      itemTitle: item.itemTitle,
      name: item.itemTitle,
      unitPrice: currentVar ? currentVar.price : item.unitPrice,
      quantity: item.quantity,
      lineDiscount: item.lineDiscount || 0,
      image: item.image || '📦'
    };
  });

  return {
    ok: true,
    savedOrder: order,
    order: {
      ...order,
      items: restoredCartItems
    },
    restoredCartItems,
    items: restoredCartItems,
    customer: {
      name: order.customerName,
      phone: order.customerPhone,
      note: order.orderNote
    },
    orderDiscountPct: order.orderDiscountPct || 0,
    grandTotal: order.totalAmount,
    totalAmount: order.totalAmount,
    warnings
  };
}

// ----------------------------------------------------------------------------
// 4. CANCEL SAVED ORDER (Section 14.4)
// ----------------------------------------------------------------------------
function cancelSavedOrder({ savedOrderId, cancelledByUserId, reason }) {
  const db = loadDb();
  const order = (db.savedOrders || []).find(o => o.id === savedOrderId);

  if (!order) return { ok: false, error: 'Saved order not found' };
  if (order.status === 'PAID') return { ok: false, error: 'Cannot cancel a completed, paid order' };
  if (order.status === 'CANCELLED') return { ok: false, error: 'Order is already cancelled' };

  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: 'Cancellation reason is required by business policy' };
  }

  const user = db.users.find(u => u.id === cancelledByUserId) || { fullName: 'Staff' };

  order.status = 'CANCELLED';
  order.cancelledAt = new Date().toISOString();
  order.cancelledByUserId = user.id;
  order.cancelledByName = user.fullName;
  order.cancelReason = reason.trim();
  order.updatedAt = new Date().toISOString();

  order.auditTrail = order.auditTrail || [];
  order.auditTrail.push({
    action: 'ORDER_CANCELLED',
    by: user.fullName,
    timestamp: new Date().toISOString(),
    reason: reason.trim()
  });

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'HELD_ORDER_CANCELLED',
    userId: user.id,
    userName: user.fullName,
    details: `Held Order #${order.orderNumber} cancelled by ${user.fullName}. Reason: ${reason}`,
    timestamp: new Date().toISOString()
  });

  saveDb();
  return { ok: true, savedOrder: order, message: 'Saved order cancelled successfully' };
}

// ----------------------------------------------------------------------------
// 5. UPDATE CUSTOMER DETAILS (Section 14.4)
// ----------------------------------------------------------------------------
function updateSavedOrderCustomer({ savedOrderId, customerName, customerPhone, orderNote, updatedByUserId }) {
  const db = loadDb();
  const order = (db.savedOrders || []).find(o => o.id === savedOrderId);

  if (!order) return { ok: false, error: 'Saved order not found' };
  if (order.status !== 'ON_HOLD') return { ok: false, error: 'Only on-hold orders can be edited' };

  const user = db.users.find(u => u.id === updatedByUserId) || { fullName: 'Staff' };

  if (customerName) order.customerName = customerName.trim();
  if (customerPhone !== undefined) order.customerPhone = customerPhone.trim();
  if (orderNote !== undefined) order.orderNote = orderNote.trim();
  order.updatedAt = new Date().toISOString();

  order.auditTrail = order.auditTrail || [];
  order.auditTrail.push({
    action: 'CUSTOMER_INFO_UPDATED',
    by: user.fullName,
    timestamp: new Date().toISOString(),
    details: `Customer info updated to: ${order.customerName} (${order.customerPhone || 'No phone'})`
  });

  saveDb();
  return { ok: true, savedOrder: order };
}

// ----------------------------------------------------------------------------
// 6. MARK SAVED ORDER AS COMPLETED / PAID (Section 14.3)
// ----------------------------------------------------------------------------
function markSavedOrderCompleted({ savedOrderId, completedOrderId, completingCashierId, completingShiftId }) {
  const db = loadDb();
  const order = (db.savedOrders || []).find(o => o.id === savedOrderId);
  if (!order) return { ok: false, error: 'Saved order not found' };

  order.status = 'PAID';
  order.paymentStatus = 'PAID';
  order.completedOrderId = completedOrderId;
  order.completingCashierId = completingCashierId;
  order.completingShiftId = completingShiftId;
  order.completedAt = new Date().toISOString();
  order.updatedAt = new Date().toISOString();

  order.auditTrail = order.auditTrail || [];
  order.auditTrail.push({
    action: 'ORDER_CHECKOUT_COMPLETED',
    by: completingCashierId,
    timestamp: new Date().toISOString(),
    details: `Saved order converted to completed sale #${completedOrderId} in shift #${completingShiftId}`
  });

  saveDb();
  return { ok: true, savedOrder: order };
}

module.exports = {
  saveUnpaidOrder,
  getSavedOrders,
  resumeSavedOrder,
  cancelSavedOrder,
  updateSavedOrderCustomer,
  markSavedOrderCompleted
};
