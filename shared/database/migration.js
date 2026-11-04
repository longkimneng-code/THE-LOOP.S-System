// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — AUTOMATED DATABASE MIGRATION ENGINE
// Imports and safely preserves all valid records from legacy JSON files into SQLite
// ============================================================================

const fs = require('fs');
const path = require('path');
const { getDatabase } = require('./connection');

function runMigration() {
  const db = getDatabase();
  console.log('[Migration] Starting enterprise database migration...');

  const posFile = path.resolve(__dirname, '../../The_Loop.s_POS/backend/data/pos_state.json');
  const stockFile = path.resolve(__dirname, '../../Stock_management_loops/backend/data/store.json');
  const financeFile = path.resolve(__dirname, '../../account_system_Loops/backend/data/loops_finance_state.json');

  let posData = fs.existsSync(posFile) ? JSON.parse(fs.readFileSync(posFile, 'utf8')) : {};
  let stockData = fs.existsSync(stockFile) ? JSON.parse(fs.readFileSync(stockFile, 'utf8')) : {};
  let financeData = fs.existsSync(financeFile) ? JSON.parse(fs.readFileSync(financeFile, 'utf8')) : {};

  let stats = {
    organizations: 0,
    users: 0,
    locations: 0,
    registers: 0,
    products: 0,
    variants: 0,
    balances: 0,
    suppliers: 0,
    shipments: 0,
    orders: 0,
    bills: 0,
    expenses: 0,
    accounts: 0
  };

  // Begin Migration Transaction
  db.exec('BEGIN TRANSACTION;');

  try {
    // 1. ORGANIZATIONS
    const orgs = posData.organizations || [];
    if (posData.organization && !orgs.some(o => o.id === posData.organization.id)) {
      orgs.unshift(posData.organization);
    }

    const insertOrg = db.prepare(`
      INSERT INTO organizations (
        id, name, owner_name, owner_email, phone, address, country, currency,
        exchange_rate, tax_rate, tax_inclusive, allow_public_registration, logo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        currency = excluded.currency,
        exchange_rate = excluded.exchange_rate,
        updated_at = excluded.updated_at
    `);

    for (const org of orgs) {
      if (!org.id || !org.ownerEmail) continue;
      insertOrg.run(
        org.id,
        org.name || 'The Loops Business',
        org.ownerName || 'Business Owner',
        org.ownerEmail.toLowerCase(),
        org.phone || '',
        org.address || '',
        org.country || 'Cambodia',
        org.currency || 'USD',
        org.exchangeRate || 4000.0,
        org.taxRate || 0.1,
        org.taxInclusive ? 1 : 0,
        org.allowPublicRegistration !== false ? 1 : 0,
        org.logo || '',
        org.registeredAt || new Date().toISOString(),
        new Date().toISOString()
      );
      stats.organizations++;
    }

    // Ensure default system organization org-loops-001 exists
    const defaultOrg = db.prepare('SELECT id FROM organizations WHERE id = ?').get('org-loops-001');
    if (!defaultOrg) {
      insertOrg.run(
        'org-loops-001',
        'The Loops Flagship Retail',
        'Sokha Meas',
        'owner@theloops.com',
        '+855 23 888 999',
        'Preah Sisowath Quay, Phnom Penh',
        'Cambodia',
        'USD',
        4000.0,
        0.1,
        0,
        1,
        '',
        new Date().toISOString(),
        new Date().toISOString()
      );
      stats.organizations++;
    }

    // 2. USERS
    const users = posData.users || [];
    const insertedUserIds = new Set();
    const orgToFirstUser = new Map();
    const insertUser = db.prepare(`
      INSERT INTO users (
        id, organization_id, email, full_name, role, roles_json, password_hash,
        pin_hash, active, status, assigned_store_ids_json, app_access_json, permissions_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, email) DO UPDATE SET
        full_name = excluded.full_name,
        role = excluded.role,
        roles_json = excluded.roles_json,
        password_hash = excluded.password_hash,
        pin_hash = excluded.pin_hash,
        assigned_store_ids_json = excluded.assigned_store_ids_json
    `);

    for (const u of users) {
      if (!u.id || !u.email) continue;
      const orgId = u.organizationId || 'org-loops-001';
      insertUser.run(
        u.id,
        orgId,
        u.email.toLowerCase(),
        u.fullName || 'Staff User',
        u.role || 'CASHIER',
        JSON.stringify(u.roles || [u.role || 'CASHIER']),
        u.passwordHash || '0000',
        u.pinHash || '9999',
        u.active !== false ? 1 : 0,
        u.status || 'ACTIVE',
        JSON.stringify(u.assignedStoreIds || u.locations || ['*']),
        JSON.stringify(u.appAccess || { pos: true, stock: true, finance: true }),
        JSON.stringify(u.permissions || {}),
        u.createdAt || new Date().toISOString()
      );
      insertedUserIds.add(u.id);
      if (!orgToFirstUser.has(orgId)) {
        orgToFirstUser.set(orgId, u.id);
      }
      stats.users++;
    }

    // 3. LOCATIONS / STORES
    const locs = (posData.locations || []).concat(stockData.locations || []);
    const locationIdMap = new Map();
    const orgCodeToLocId = new Map();
    const insertedLocIds = new Set();
    const insertLoc = db.prepare(`
      INSERT INTO locations (
        id, organization_id, code, name, type, address, phone, manager_id, manager_name, is_default, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, code) DO UPDATE SET
        name = excluded.name,
        address = excluded.address
    `);

    for (const l of locs) {
      if (!l.id) continue;
      const orgId = l.organizationId || 'org-loops-001';
      const locCode = (l.code || `LOC-${l.id.slice(-4)}`).toUpperCase();
      const codeKey = `${orgId}:${locCode}`;

      if (orgCodeToLocId.has(codeKey)) {
        const canonical = orgCodeToLocId.get(codeKey);
        locationIdMap.set(l.id, canonical);
      } else {
        orgCodeToLocId.set(codeKey, l.id);
        locationIdMap.set(l.id, l.id);
        insertedLocIds.add(l.id);
        insertLoc.run(
          l.id,
          orgId,
          locCode,
          l.name || 'Store Branch',
          l.type || 'STORE',
          l.address || '',
          l.phone || '',
          l.managerId || null,
          l.managerName || '',
          l.isDefault ? 1 : 0,
          l.isActive !== false ? 1 : 0,
          l.createdAt || new Date().toISOString()
        );
        stats.locations++;
      }
    }

    // Ensure default loc-1 exists
    if (!insertedLocIds.has('loc-1') && !locationIdMap.has('loc-1')) {
      insertLoc.run(
        'loc-1',
        'org-loops-001',
        'SH-01',
        'Sisowat Flagship',
        'STORE',
        'Preah Sisowath Quay, Phnom Penh',
        '+855 23 888 999',
        null,
        'Sokha Meas',
        1,
        1,
        new Date().toISOString()
      );
      locationIdMap.set('loc-1', 'loc-1');
      insertedLocIds.add('loc-1');
      stats.locations++;
    }

    // 4. REGISTERS
    const registers = posData.registers || [];
    const seenRegs = new Set();
    const insertedRegIds = new Set();
    const storeToFirstReg = new Map();
    const insertReg = db.prepare(`
      INSERT INTO registers (
        id, organization_id, location_id, register_code, name, status, current_shift_id, current_cashier_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(location_id, register_code) DO UPDATE SET
        name = excluded.name
    `);

    for (const r of registers) {
      if (!r.id || seenRegs.has(r.id)) continue;
      seenRegs.add(r.id);
      const orgId = r.organizationId || 'org-loops-001';
      const rawLocId = r.locationId || r.storeId || 'loc-1';
      const locId = locationIdMap.get(rawLocId) || (insertedLocIds.has(rawLocId) ? rawLocId : 'loc-1');
      insertReg.run(
        r.id,
        orgId,
        locId,
        r.registerCode || `REG-${r.id.slice(-4)}`,
        r.name || 'Main Register',
        r.status || 'CLOSED',
        r.currentShiftId || null,
        r.currentCashierId || null,
        r.createdAt || new Date().toISOString()
      );
      insertedRegIds.add(r.id);
      if (!storeToFirstReg.has(locId)) {
        storeToFirstReg.set(locId, r.id);
      }
      stats.registers++;
    }

    if (!insertedRegIds.has('reg-01')) {
      insertReg.run(
        'reg-01',
        'org-loops-001',
        'loc-1',
        'REG-01',
        'Main Register',
        'CLOSED',
        null,
        null,
        new Date().toISOString()
      );
      insertedRegIds.add('reg-01');
      storeToFirstReg.set('loc-1', 'reg-01');
      stats.registers++;
    }

    // 5. PRODUCTS & VARIANTS
    const products = stockData.products || [];
    const productIdMap = new Map();
    const orgCodeToProdId = new Map();
    const insertedProdIds = new Set();

    const insertProd = db.prepare(`
      INSERT INTO products (
        id, organization_id, code, name, category, brand, stock_unit, image_url, description,
        cost_minor, retail_minor, has_variants, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, code) DO UPDATE SET
        name = excluded.name,
        cost_minor = excluded.cost_minor,
        retail_minor = excluded.retail_minor,
        updated_at = excluded.updated_at
    `);

    const insertVar = db.prepare(`
      INSERT INTO product_variants (
        id, organization_id, product_id, sku, title, barcode, cost_minor, retail_minor, on_hand, reserved, damaged, rop, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, sku) DO UPDATE SET
        cost_minor = excluded.cost_minor,
        retail_minor = excluded.retail_minor,
        on_hand = excluded.on_hand
    `);

    for (const p of products) {
      if (!p.id || !p.code) continue;
      const orgId = p.organizationId || 'org-loops-001';
      const codeKey = `${orgId}:${p.code.trim().toUpperCase()}`;

      let canonicalProdId;
      if (orgCodeToProdId.has(codeKey)) {
        canonicalProdId = orgCodeToProdId.get(codeKey);
        productIdMap.set(p.id, canonicalProdId);
      } else {
        canonicalProdId = p.id;
        orgCodeToProdId.set(codeKey, canonicalProdId);
        productIdMap.set(p.id, canonicalProdId);
        insertedProdIds.add(canonicalProdId);

        insertProd.run(
          p.id,
          orgId,
          p.code.trim().toUpperCase(),
          p.name,
          p.category || 'General',
          p.brand || 'General',
          p.stockUnit || 'piece',
          p.imageUrl || '',
          p.description || '',
          p.costMinor || 0,
          p.retailMinor || 0,
          p.hasVariants ? 1 : 0,
          p.isActive !== false ? 1 : 0,
          p.createdAt || new Date().toISOString(),
          p.updatedAt || new Date().toISOString()
        );
        stats.products++;
      }

      const variants = p.variants || [{
        sku: `${p.code}-STD`,
        title: 'Standard',
        barcode: `8802${p.id.slice(-6)}`,
        costMinor: p.costMinor || 0,
        retailMinor: p.retailMinor || 0,
        onHand: p.onHand || 0
      }];

      for (const v of variants) {
        insertVar.run(
          v.id || `var-${canonicalProdId}-${v.sku}`,
          orgId,
          canonicalProdId,
          v.sku,
          v.title || 'Standard',
          v.barcode || v.sku,
          v.costMinor || 0,
          v.retailMinor || 0,
          v.onHand || 0,
          v.reserved || 0,
          v.damaged || 0,
          v.rop || 5,
          new Date().toISOString()
        );
        stats.variants++;
      }
    }

    // 6. STOCK BALANCES
    const balances = stockData.stockBalances || [];
    const insertBal = db.prepare(`
      INSERT INTO stock_balances (
        id, organization_id, location_id, sku, on_hand, reserved, damaged, rop, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(location_id, sku) DO UPDATE SET
        on_hand = excluded.on_hand,
        updated_at = excluded.updated_at
    `);

    for (const b of balances) {
      if (!b.sku || !b.locationId) continue;
      const orgId = b.organizationId || 'org-loops-001';
      const rawLocId = b.locationId;
      const locId = locationIdMap.get(rawLocId) || (insertedLocIds.has(rawLocId) ? rawLocId : 'loc-1');

      insertBal.run(
        b.id || `bal-${locId}-${b.sku}`,
        orgId,
        locId,
        b.sku,
        b.onHand || 0,
        b.reserved || 0,
        b.damaged || 0,
        b.rop || 5,
        new Date().toISOString()
      );
      stats.balances++;
    }

    // 7. SUPPLIERS
    const rawSuppliers = (financeData.suppliers || stockData.suppliers || []).slice();
    const discoveredNames = new Set(rawSuppliers.map(s => (s.name || '').toLowerCase()));
    for (const sh of (financeData.shipments || [])) {
      const sName = (sh.supplierName || '').trim();
      if (sName && !discoveredNames.has(sName.toLowerCase())) {
        discoveredNames.add(sName.toLowerCase());
        rawSuppliers.push({
          id: `sup-${sName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          organizationId: sh.organizationId || 'org-loops-001',
          name: sName,
          country: sh.originCountry || 'Japan',
          currency: sh.foreignCurrency || 'USD'
        });
      }
    }

    const seenSups = new Set();
    const insertSup = db.prepare(`
      INSERT INTO suppliers (
        id, organization_id, name, contact_name, email, phone, country, currency, payment_terms_days, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, name) DO NOTHING
    `);

    for (const s of rawSuppliers) {
      if (!s.id || !s.name || seenSups.has(s.id)) continue;
      seenSups.add(s.id);
      const orgId = s.organizationId || 'org-loops-001';
      insertSup.run(
        s.id,
        orgId,
        s.name,
        s.contactName || '',
        s.email || '',
        s.phone || '',
        s.country || 'Cambodia',
        s.currency || 'USD',
        s.paymentTermsDays || 30,
        s.createdAt || new Date().toISOString()
      );
      stats.suppliers++;
    }

    // 8. SHIPMENTS / PURCHASES
    const shipments = (financeData.shipments || []);
    const insertShipment = db.prepare(`
      INSERT INTO shipments (
        id, organization_id, shipment_number, supplier_id, supplier_name, origin_country, incoterms,
        status, order_date, expected_arrival, currency, total_fob_minor, total_overheads_minor, total_landed_cost_minor, created_at, finalized_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, shipment_number) DO NOTHING
    `);

    for (const sh of shipments) {
      const shCode = sh.shipmentCode || sh.shipmentNumber;
      if (!sh.id || !shCode) continue;
      const orgId = sh.organizationId || 'org-loops-001';
      insertShipment.run(
        sh.id,
        orgId,
        shCode,
        sh.supplierId || null,
        sh.supplierName || 'Global Supplier',
        sh.originCountry || 'Japan',
        sh.shippingTerms || sh.incoterms || 'FOB',
        sh.status || 'RECEIVED',
        sh.orderDate || new Date().toISOString(),
        sh.expectedArrival || '',
        sh.foreignCurrency || sh.currency || 'USD',
        Math.round((sh.totalFob || 0) * 100),
        Math.round((sh.totalOverheads || 0) * 100),
        Math.round((sh.totalLandedCost || 0) * 100),
        sh.createdAt || new Date().toISOString(),
        sh.finalizedAt || null
      );
      stats.shipments++;
    }

    // 9. SUPPLIER BILLS & EXPENSES
    const bills = financeData.supplierBills || [];
    const insertBill = db.prepare(`
      INSERT INTO supplier_bills (
        id, organization_id, bill_number, supplier_id, supplier_name, amount_minor, paid_amount_minor, currency, due_date, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, bill_number) DO NOTHING
    `);

    for (const b of bills) {
      if (!b.id || !b.billNumber) continue;
      const orgId = b.organizationId || 'org-loops-001';
      insertBill.run(
        b.id,
        orgId,
        b.billNumber,
        b.supplierId || null,
        b.supplierName || 'Supplier',
        b.amountMinor || 0,
        b.paidAmountMinor || 0,
        b.currency || 'USD',
        b.dueDate || new Date().toISOString(),
        b.status || 'PENDING',
        b.createdAt || new Date().toISOString()
      );
      stats.bills++;
    }

    const expenses = financeData.expenses || [];
    const insertExp = db.prepare(`
      INSERT INTO expenses (
        id, organization_id, expense_number, category, amount_minor, payment_method, date, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, expense_number) DO NOTHING
    `);

    for (const e of expenses) {
      if (!e.id || !e.expenseNumber) continue;
      const orgId = e.organizationId || 'org-loops-001';
      insertExp.run(
        e.id,
        orgId,
        e.expenseNumber,
        e.category || 'Operations',
        e.amountMinor || 0,
        e.paymentMethod || 'CASH',
        e.date || new Date().toISOString(),
        e.description || '',
        e.createdAt || new Date().toISOString()
      );
      stats.expenses++;
    }

    // 10. CHART OF ACCOUNTS
    const accounts = financeData.accounts || [];
    const insertAcc = db.prepare(`
      INSERT INTO chart_of_accounts (
        id, organization_id, code, name, type, normal_side, balance_minor, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, code) DO NOTHING
    `);

    for (const a of accounts) {
      if (!a.code || !a.name) continue;
      const orgId = a.organizationId || 'org-loops-001';
      insertAcc.run(
        a.id || `acc-${orgId}-${a.code}`,
        orgId,
        a.code,
        a.name,
        a.type || 'ASSET',
        a.normalSide || 'DEBIT',
        Math.round((a.balance || 0) * 100),
        a.description || ''
      );
      stats.accounts++;
    }

    // 11. SHIFTS
    const shifts = posData.shifts || [];
    const insertedShiftIds = new Set();
    const insertShift = db.prepare(`
      INSERT INTO shifts (
        id, organization_id, store_id, register_id, cashier_id, cashier_name,
        opened_at, closed_at, status, starting_cash_usd, starting_cash_khr,
        expected_cash_usd, expected_cash_khr, actual_cash_usd, actual_cash_khr,
        discrepancy_usd, discrepancy_khr, closing_note, cash_movements_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        closed_at = excluded.closed_at
    `);

    for (const sh of shifts) {
      if (!sh.id) continue;
      const orgId = sh.organizationId || sh.businessId || 'org-loops-001';
      const rawLocId = sh.storeId || sh.locationId;
      const storeId = locationIdMap.get(rawLocId) || (insertedLocIds.has(rawLocId) ? rawLocId : 'loc-1');
      let registerId = sh.registerId;
      if (!insertedRegIds.has(registerId)) {
        registerId = storeToFirstReg.get(storeId) || 'reg-01';
      }
      let cashierId = sh.cashierUserId || sh.cashierId || sh.employeeId;
      if (!insertedUserIds.has(cashierId)) {
        cashierId = orgToFirstUser.get(orgId) || 'usr-01';
      }

      try {
        insertShift.run(
          sh.id,
          orgId,
          storeId,
          registerId,
          cashierId,
          sh.cashierName || 'Staff',
          sh.openedAt || new Date().toISOString(),
          sh.closedAt || null,
          sh.status || 'CLOSED',
          Number(sh.openingCash || sh.startingCashUsd || 0),
          Number(sh.openingCashKhr || sh.startingCashKhr || 0),
          Number(sh.expectedCash || sh.expectedCashUsd || 0),
          Number(sh.expectedCashKhr || 0),
          Number(sh.actualCash || sh.actualCashUsd || 0),
          Number(sh.actualCashKhr || 0),
          Number(sh.discrepancy || 0),
          Number(sh.discrepancyKhr || 0),
          sh.closingNote || '',
          JSON.stringify(sh.cashMovements || []),
          sh.createdAt || sh.openedAt || new Date().toISOString()
        );
        insertedShiftIds.add(sh.id);
        stats.shifts = (stats.shifts || 0) + 1;
      } catch (err) {
        console.error(`[Migration Error] Shift failed: id=${sh.id}, orgId=${orgId}, storeId=${storeId}, regId=${registerId}, cashierId=${cashierId}:`, err.message);
        throw err;
      }
    }

    // 12. POS ORDERS
    const orders = posData.orders || [];
    const insertOrder = db.prepare(`
      INSERT INTO pos_orders (
        id, organization_id, receipt_number, store_id, register_id, shift_id, cashier_id, cashier_name,
        subtotal_minor, tax_minor, discount_minor, total_minor, exchange_rate, payment_methods_json, items_json, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, receipt_number) DO NOTHING
    `);

    for (const o of orders) {
      const recNumber = o.receiptNumber || o.orderNumber;
      if (!o.id || !recNumber) continue;
      const orgId = o.organizationId || o.businessId || 'org-loops-001';
      const rawLocId = o.storeId || o.locationId;
      const storeId = locationIdMap.get(rawLocId) || (insertedLocIds.has(rawLocId) ? rawLocId : 'loc-1');
      let registerId = o.registerId;
      if (!insertedRegIds.has(registerId)) {
        registerId = storeToFirstReg.get(storeId) || 'reg-01';
      }
      let cashierId = o.cashierUserId || o.cashierId || o.employeeId;
      if (!insertedUserIds.has(cashierId)) {
        cashierId = orgToFirstUser.get(orgId) || 'usr-01';
      }
      const shiftId = insertedShiftIds.has(o.shiftId) ? o.shiftId : null;

      try {
        insertOrder.run(
          o.id,
          orgId,
          recNumber,
          storeId,
          registerId,
          shiftId,
          cashierId,
          o.cashierName || 'Staff',
          Math.round((o.subtotal || o.total || 0) * 100),
          Math.round((o.tax || 0) * 100),
          Math.round((o.discount || 0) * 100),
          Math.round((o.total || 0) * 100),
          o.exchangeRate || 4000.0,
          JSON.stringify(o.paymentMethods || []),
          JSON.stringify(o.items || []),
          o.status || 'COMPLETED',
          o.createdAt || new Date().toISOString()
        );
        stats.orders++;
      } catch (err) {
        console.error(`[Migration Error] Order failed: id=${o.id}, orgId=${orgId}, storeId=${storeId}, regId=${registerId}, cashierId=${cashierId}:`, err.message);
        throw err;
      }
    }

    // Commit Transaction
    db.exec('COMMIT;');
    console.log('[Migration] Database migration completed successfully!');
    console.log('[Migration] Summary:', stats);
    return { ok: true, stats };
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('[Migration] Migration failed, transaction rolled back:', err);
    throw err;
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
