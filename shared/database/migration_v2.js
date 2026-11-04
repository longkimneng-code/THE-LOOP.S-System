// ============================================================================
// Database Migration V2: Shipping Categories, Purchase Completion & Product Variants
// ============================================================================
const { getDatabase } = require('./connection');

function runMigrationV2() {
  const db = getDatabase();
  console.log('[Migration V2] Applying relational schema updates to theloops_enterprise.db...');

  db.exec(`
    -- 1. SHIPPING CATEGORIES TABLE
    CREATE TABLE IF NOT EXISTS shipping_categories (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      shipping_method TEXT DEFAULT 'Air Shipping',
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' or 'INACTIVE'
      created_by TEXT DEFAULT 'Owner',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(organization_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_shipping_cat_org ON shipping_categories(organization_id);

    -- 2. DYNAMIC VARIANT ATTRIBUTES
    CREATE TABLE IF NOT EXISTS variant_attributes (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL, -- e.g. "Model", "Storage", "Color", "Size"
      created_at TEXT NOT NULL,
      UNIQUE(organization_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_var_attr_org ON variant_attributes(organization_id);

    CREATE TABLE IF NOT EXISTS variant_attribute_values (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      attribute_id TEXT NOT NULL REFERENCES variant_attributes(id) ON DELETE CASCADE,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(attribute_id, value)
    );
    CREATE INDEX IF NOT EXISTS idx_var_attr_val ON variant_attribute_values(attribute_id);

    -- 3. GOODS RECEIPTS (Idempotent Receiving Log)
    CREATE TABLE IF NOT EXISTS purchase_receipts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      receipt_code TEXT NOT NULL,
      shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      received_by TEXT NOT NULL,
      notes TEXT DEFAULT '',
      idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'PROCESSED', -- 'PROCESSED', 'FAILED'
      created_at TEXT NOT NULL,
      UNIQUE(organization_id, receipt_code)
    );
    CREATE INDEX IF NOT EXISTS idx_receipts_shipment ON purchase_receipts(shipment_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_org ON purchase_receipts(organization_id);

    -- 4. GOODS RECEIPT ITEMS
    CREATE TABLE IF NOT EXISTS purchase_receipt_items (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      receipt_id TEXT NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
      product_id TEXT,
      variant_id TEXT,
      sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      variant_title TEXT NOT NULL,
      quantity_received INTEGER NOT NULL,
      unit_cost_minor INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON purchase_receipt_items(receipt_id);

    -- 5. FINANCE PRODUCT CATEGORIES (Finance's own category master)
    CREATE TABLE IF NOT EXISTS finance_product_categories (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      UNIQUE(organization_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_fin_prod_cat_org ON finance_product_categories(organization_id);
  `);

  // Safely alter existing tables to add columns if they don't exist
  const alterStatements = [
    // shipments
    `ALTER TABLE shipments ADD COLUMN shipping_category_id TEXT REFERENCES shipping_categories(id) ON DELETE RESTRICT;`,
    `ALTER TABLE shipments ADD COLUMN destination_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL;`,
    `ALTER TABLE shipments ADD COLUMN receiving_status TEXT DEFAULT 'PENDING';`,
    `ALTER TABLE shipments ADD COLUMN stock_sync_status TEXT DEFAULT 'PENDING';`,
    `ALTER TABLE shipments ADD COLUMN sync_error TEXT DEFAULT '';`,
    `ALTER TABLE shipments ADD COLUMN notes TEXT DEFAULT '';`,

    // shipment_items
    `ALTER TABLE shipment_items ADD COLUMN category TEXT DEFAULT '';`,
    `ALTER TABLE shipment_items ADD COLUMN product_id TEXT;`,
    `ALTER TABLE shipment_items ADD COLUMN variant_id TEXT;`,
    `ALTER TABLE shipment_items ADD COLUMN variant_title TEXT DEFAULT 'Standard';`,
    `ALTER TABLE shipment_items ADD COLUMN quantity_ordered INTEGER DEFAULT 0;`,
    `ALTER TABLE shipment_items ADD COLUMN quantity_received INTEGER DEFAULT 0;`,
    `ALTER TABLE shipment_items ADD COLUMN quantity_outstanding INTEGER DEFAULT 0;`,

    // product_variants
    `ALTER TABLE product_variants ADD COLUMN attributes_json TEXT DEFAULT '{}';`,
    `ALTER TABLE product_variants ADD COLUMN image_url TEXT DEFAULT '';`,
    `ALTER TABLE product_variants ADD COLUMN is_active INTEGER DEFAULT 1;`,
    `ALTER TABLE product_variants ADD COLUMN updated_at TEXT;`,

    // stock_ledger
    `ALTER TABLE stock_ledger ADD COLUMN previous_quantity INTEGER DEFAULT 0;`,
    `ALTER TABLE stock_ledger ADD COLUMN quantity_changed INTEGER DEFAULT 0;`,
    `ALTER TABLE stock_ledger ADD COLUMN new_quantity INTEGER DEFAULT 0;`,
    `ALTER TABLE stock_ledger ADD COLUMN product_id TEXT;`,
    `ALTER TABLE stock_ledger ADD COLUMN variant_id TEXT;`,
    `ALTER TABLE stock_ledger ADD COLUMN source_warehouse TEXT DEFAULT '';`,
    `ALTER TABLE stock_ledger ADD COLUMN destination_warehouse TEXT DEFAULT '';`
  ];

  for (const sql of alterStatements) {
    try {
      db.exec(sql);
    } catch (err) {
      // Ignore "duplicate column name" errors
      if (!err.message.includes('duplicate column')) {
        console.warn('[Migration V2 Notice]:', err.message);
      }
    }
  }

  console.log('[Migration V2] Successfully applied schema updates!');
}

if (require.main === module) {
  runMigrationV2();
}

module.exports = { runMigrationV2 };

