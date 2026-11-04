// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — REPEATABLE DEMO SEED ENGINE
// Seeds sample/demo data strictly for 'org-loops-001' (Sisowat Flagship)
// Newly registered tenants NEVER receive this data and remain 100% pristine.
// ============================================================================

const { getDatabase } = require('./connection');

function seedDemoOrganization() {
  const db = getDatabase();
  console.log('[Seed] Seeding demo organization (org-loops-001)...');

  const now = new Date().toISOString();

  db.exec('BEGIN TRANSACTION;');

  try {
    // 1. Demo Organization
    db.prepare(`
      INSERT INTO organizations (
        id, name, owner_name, owner_email, phone, address, country, currency,
        exchange_rate, tax_rate, tax_inclusive, allow_public_registration, logo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        exchange_rate = excluded.exchange_rate,
        updated_at = excluded.updated_at
    `).run(
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
      now,
      now
    );

    // 2. Demo Owner & Staff
    const insertUser = db.prepare(`
      INSERT INTO users (
        id, organization_id, email, full_name, role, roles_json, password_hash,
        pin_hash, active, status, assigned_store_ids_json, app_access_json, permissions_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, email) DO UPDATE SET
        full_name = excluded.full_name,
        role = excluded.role,
        pin_hash = excluded.pin_hash,
        password_hash = excluded.password_hash
    `);

    insertUser.run(
      'usr-01',
      'org-loops-001',
      'admin@theloops.com',
      'Vannak Kem',
      'OWNER',
      JSON.stringify(['OWNER', 'SUPER_ADMIN', 'STOCK_ADMIN', 'FINANCE_ADMIN']),
      '0000',
      '9999',
      1,
      'ACTIVE',
      JSON.stringify(['*']),
      JSON.stringify({ pos: true, stock: true, finance: true, admin: true }),
      JSON.stringify({ all: true }),
      now
    );

    insertUser.run(
      'usr-02',
      'org-loops-001',
      'manager@theloops.com',
      'Sokha Meas',
      'STORE_MANAGER',
      JSON.stringify(['STORE_MANAGER', 'STOCK_MANAGER']),
      '0000',
      '1234',
      1,
      'ACTIVE',
      JSON.stringify(['*']),
      JSON.stringify({ pos: true, stock: true }),
      JSON.stringify({ refundTransactions: true, viewFinancialReports: true }),
      now
    );

    insertUser.run(
      'usr-03',
      'org-loops-001',
      'cashier1@theloops.com',
      'Dara Chea',
      'CASHIER',
      JSON.stringify(['CASHIER']),
      '0000',
      '5555',
      1,
      'ACTIVE',
      JSON.stringify(['loc-1']),
      JSON.stringify({ pos: true }),
      JSON.stringify({ openPos: true, makeSales: true }),
      now
    );

    // 3. Demo Stores / Locations
    const insertLoc = db.prepare(`
      INSERT INTO locations (
        id, organization_id, code, name, type, address, phone, manager_id, manager_name, is_default, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, code) DO UPDATE SET
        name = excluded.name
    `);

    insertLoc.run(
      'loc-1',
      'org-loops-001',
      'SH-01',
      'Sisowat HighSchool',
      'STORE',
      'Preah Sisowath Quay, Phnom Penh',
      '+855 23 888 999',
      'usr-01',
      'Sokha Meas',
      1,
      1,
      now
    );

    // 4. Demo Register
    db.prepare(`
      INSERT INTO registers (
        id, organization_id, location_id, register_code, name, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(location_id, register_code) DO NOTHING
    `).run(
      'reg-01',
      'org-loops-001',
      'loc-1',
      'REG-01',
      'Main Register 01',
      'CLOSED',
      now
    );

    db.exec('COMMIT;');
    console.log('[Seed] Demo organization seeded successfully.');
    return { ok: true };
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('[Seed] Seeding failed:', err);
    throw err;
  }
}

if (require.main === module) {
  seedDemoOrganization();
}

module.exports = { seedDemoOrganization };
