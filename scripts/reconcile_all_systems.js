const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../shared/database/connection');

function reconcile() {
  console.log('--- RECONCILING ALL PLATFORMS DATA ---');
  const sqlDb = getDatabase();

  const posStatePath = path.resolve(__dirname, '..', 'The_Loop.s_POS', 'backend', 'data', 'pos_state.json');
  const stockStorePath = path.resolve(__dirname, '..', 'Stock_management_loops', 'backend', 'data', 'store.json');

  const posDb = JSON.parse(fs.readFileSync(posStatePath, 'utf8'));
  const stockStore = JSON.parse(fs.readFileSync(stockStorePath, 'utf8'));

  // 1. RECONCILE SQLITE POS_ORDERS
  const validOrgId = 'org-6e9ed3cf';
  const validStoreId = 'loc-01';
  const validRegId = 'reg-loc01-01';
  const validUserId = sqlDb.prepare('SELECT id FROM users LIMIT 1').get()?.id || 'usr-owner-83bbcc';

  posDb.orders.forEach(ord => {
    const lines = posDb.orderLines.filter(l => l.orderId === ord.id);
    const payments = posDb.payments.filter(p => p.orderId === ord.id);

    const itemsJson = JSON.stringify(lines.map(l => ({
      productId: l.productId,
      sku: l.variantSku,
      title: l.itemTitle,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      total: l.lineTotal
    })));

    const paymentsJson = JSON.stringify(payments);

    sqlDb.prepare(`
      INSERT OR REPLACE INTO pos_orders (
        id, organization_id, receipt_number, store_id, register_id, shift_id,
        cashier_id, cashier_name, subtotal_minor, tax_minor, discount_minor,
        total_minor, exchange_rate, payment_methods_json, items_json, status, created_at
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
    `).run(
      ord.id,
      validOrgId,
      ord.orderNumber,
      validStoreId,
      validRegId,
      validUserId,
      ord.cashierName || 'Cashier',
      Math.round(ord.subtotal * 100),
      Math.round(ord.taxTotal * 100),
      Math.round(ord.discountTotal * 100),
      Math.round(ord.totalAmount * 100),
      ord.exchangeRate || 4000,
      paymentsJson,
      itemsJson,
      ord.createdAt
    );
  });
  console.log(`SQLite pos_orders synced: ${posDb.orders.length} real orders.`);

  // 2. RECONCILE INVENTORY BALANCES ACROSS STORES
  // Actual physical stock:
  // Cattie: 2 imported, 1 sold at loc-01 -> 1 at loc-01, 0 at loc-zprdw9b. Total: 1.
  // Glasses: 20 imported, 8 transferred to loc-zprdw9b, 12 sold at loc-01 -> 0 at loc-01, 8 at loc-zprdw9b. Total: 8.
  const trueBalances = [
    { id: 'bal-loc-01-BV-GEN-2723', sku: 'BV-GEN-2723', locationId: 'loc-01', onHand: 1 },
    { id: 'bal-loc-01-BV-GEN-5280', sku: 'BV-GEN-5280', locationId: 'loc-01', onHand: 0 },
    { id: 'bal-loc-zprdw9b-BV-GEN-2723', sku: 'BV-GEN-2723', locationId: 'loc-zprdw9b', onHand: 0 },
    { id: 'bal-loc-zprdw9b-BV-GEN-5280', sku: 'BV-GEN-5280', locationId: 'loc-zprdw9b', onHand: 8 }
  ];

  // Update SQLite stock_balances
  trueBalances.forEach(b => {
    sqlDb.prepare(`
      INSERT INTO stock_balances (id, organization_id, location_id, sku, on_hand, reserved, damaged, rop, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 0, 5, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET on_hand = excluded.on_hand, updated_at = datetime('now')
    `).run(b.id, validOrgId, b.locationId, b.sku, b.onHand);
  });

  // Update SQLite product_variants on_hand and cost_minor
  sqlDb.prepare('UPDATE product_variants SET on_hand = 1, cost_minor = 581 WHERE sku = ?').run('BV-GEN-2723');
  sqlDb.prepare('UPDATE product_variants SET on_hand = 8, cost_minor = 334 WHERE sku = ?').run('BV-GEN-5280');
  sqlDb.prepare('UPDATE products SET cost_minor = 581 WHERE code = ?').run('BV-GEN-2723');
  sqlDb.prepare('UPDATE products SET cost_minor = 334 WHERE code = ?').run('BV-GEN-5280');
  console.log('SQLite stock_balances and product_variants reconciled.');

  // 3. RECONCILE STOCK OS STORE.JSON
  stockStore.stockBalances = trueBalances.map(b => ({
    id: b.id,
    sku: b.sku,
    locationId: b.locationId,
    onHand: b.onHand,
    reserved: 0,
    damaged: 0,
    rop: 5
  }));

  (stockStore.products || []).forEach(p => {
    (p.variants || []).forEach(v => {
      if (v.sku === 'BV-GEN-2723') {
        v.onHand = 1;
        v.costMinor = 581;
      }
      if (v.sku === 'BV-GEN-5280') {
        v.onHand = 8;
        v.costMinor = 334;
      }
    });
  });

  // Reconcile stockStore.sales: ONLY the 5 real POS orders!
  stockStore.sales = posDb.orders.map(ord => {
    const lines = posDb.orderLines.filter(l => l.orderId === ord.id);
    const payments = posDb.payments.filter(p => p.orderId === ord.id);
    return {
      id: 'sale-' + ord.id.slice(0, 8),
      saleNumber: ord.orderNumber,
      orderNumber: ord.orderNumber,
      customerId: ord.customerId || 'WALK_IN',
      customerName: ord.customerName || 'Walk-in Retail Guest',
      date: ord.createdAt.replace('T', ' ').substring(0, 19),
      locationId: ord.storeId || 'loc-01',
      locationName: ord.storeName || 'BeyondVER Main Branch',
      subtotalMinor: Math.round(ord.subtotal * 100),
      discountMinor: Math.round(ord.discountTotal * 100),
      taxMinor: Math.round(ord.taxTotal * 100),
      totalMinor: Math.round(ord.totalAmount * 100),
      method: payments[0]?.method || 'CASH',
      status: 'COMPLETED',
      items: lines.map(l => ({
        sku: l.variantSku,
        title: l.itemTitle,
        qty: l.quantity,
        priceMinor: Math.round(l.unitPrice * 100),
        costMinor: l.variantSku === 'BV-GEN-2723' ? 581 : 334
      }))
    };
  });

  // Clean stockStore.ledger: eliminate duplicate SALE_OUT entries
  // Keep transfers, imports, and the 5 real POS sales
  const realSaleNumbers = new Set(posDb.orders.map(o => o.orderNumber));
  stockStore.ledger = (stockStore.ledger || []).filter(entry => {
    if (entry.type !== 'SALE_OUT') return true;
    // Keep only if reference_no or reason matches a real POS orderNumber
    return realSaleNumbers.has(entry.referenceNo) || 
      (entry.reason && [...realSaleNumbers].some(rn => entry.reason.includes(rn))) ||
      (entry.note && [...realSaleNumbers].some(rn => entry.note.includes(rn)));
  });

  fs.writeFileSync(stockStorePath, JSON.stringify(stockStore, null, 2), 'utf8');
  console.log('Stock OS store.json reconciled with exact 5 sales and 9 units physical stock.');

  // Check totals
  const totalUnits = stockStore.products.reduce((s, p) => s + p.variants.reduce((vs, v) => vs + v.onHand, 0), 0);
  const totalCogs = stockStore.products.reduce((s, p) => s + p.variants.reduce((vs, v) => vs + (v.onHand * (v.costMinor || 0)), 0), 0) / 100;
  const totalSalesRevenue = stockStore.sales.reduce((s, sl) => s + sl.totalMinor, 0) / 100;
  const totalUnitsSold = stockStore.sales.reduce((s, sl) => s + sl.items.reduce((is, i) => is + i.qty, 0), 0);

  console.log('\n--- VERIFICATION OF RECONCILED TOTALS ---');
  console.log(`Physical Stock On Hand: ${totalUnits} units`);
  console.log(`Inventory Capital Valuation: $${totalCogs.toFixed(2)} COGS`);
  console.log(`POS Gross Commercial Revenue: $${totalSalesRevenue.toFixed(2)}`);
  console.log(`Volume Sold: ${totalUnitsSold} units`);
  console.log('-----------------------------------------');
}

reconcile();

