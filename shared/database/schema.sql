-- ============================================================================
-- THE LOOPS UNIVERSAL RETAIL SUITE — ENTERPRISE DATABASE SCHEMA
-- Authoritative Relational Database for POS, Stock Management & Finance
-- Enforces Multi-Tenant Isolation with Foreign Keys & Unique Constraints
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- 1. ORGANIZATIONS (Multi-Tenant Root)
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    owner_email TEXT NOT NULL UNIQUE,
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    country TEXT DEFAULT 'Cambodia',
    currency TEXT DEFAULT 'USD',
    exchange_rate REAL DEFAULT 4000.0,
    tax_rate REAL DEFAULT 0.1,
    tax_inclusive INTEGER DEFAULT 0,
    allow_public_registration INTEGER DEFAULT 1,
    logo TEXT DEFAULT '',
    company_code TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_email ON organizations(owner_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_company_code ON organizations(company_code);

-- 2. USERS & STAFF ACCOUNTS
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    roles_json TEXT NOT NULL DEFAULT '[]',
    password_hash TEXT NOT NULL,
    pin_hash TEXT DEFAULT '9999',
    company_pin_hash TEXT,
    pin_encrypted TEXT,
    active INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    assigned_store_ids_json TEXT DEFAULT '["*"]',
    app_access_json TEXT DEFAULT '{"pos":true,"stock":true,"finance":true}',
    permissions_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    UNIQUE(organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_company_pin ON users(organization_id, company_pin_hash) WHERE company_pin_hash IS NOT NULL AND status != 'DELETED';

-- 3. USER SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_org ON sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- 4. STORES & WAREHOUSE LOCATIONS
CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'STORE', -- 'STORE' or 'WAREHOUSE'
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    manager_id TEXT DEFAULT NULL,
    manager_name TEXT DEFAULT '',
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_loc_org ON locations(organization_id);

-- 5. POS REGISTERS
CREATE TABLE IF NOT EXISTS registers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    register_code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'CLOSED', -- 'OPEN' or 'CLOSED'
    current_shift_id TEXT DEFAULT NULL,
    current_cashier_id TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(location_id, register_code)
);

CREATE INDEX IF NOT EXISTS idx_registers_org ON registers(organization_id);
CREATE INDEX IF NOT EXISTS idx_registers_loc ON registers(location_id);

-- 6. CASHIER SHIFTS & MOVEMENTS
CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    store_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    register_id TEXT NOT NULL REFERENCES registers(id) ON DELETE CASCADE,
    cashier_id TEXT NOT NULL REFERENCES users(id),
    cashier_name TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    closed_at TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN' or 'CLOSED'
    starting_cash_usd REAL DEFAULT 0.0,
    starting_cash_khr REAL DEFAULT 0.0,
    expected_cash_usd REAL DEFAULT 0.0,
    expected_cash_khr REAL DEFAULT 0.0,
    actual_cash_usd REAL DEFAULT 0.0,
    actual_cash_khr REAL DEFAULT 0.0,
    discrepancy_usd REAL DEFAULT 0.0,
    discrepancy_khr REAL DEFAULT 0.0,
    closing_note TEXT DEFAULT '',
    cash_movements_json TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shifts_org ON shifts(organization_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

-- 7. PRODUCT CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_org ON categories(organization_id);

-- 8. PRODUCTS (Owned by Stock Management)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    brand TEXT DEFAULT 'General',
    stock_unit TEXT DEFAULT 'piece',
    image_url TEXT DEFAULT '',
    description TEXT DEFAULT '',
    cost_minor INTEGER DEFAULT 0,
    retail_minor INTEGER DEFAULT 0,
    has_variants INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);

-- 9. PRODUCT VARIANTS & SKUS
CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    title TEXT NOT NULL,
    barcode TEXT NOT NULL,
    cost_minor INTEGER DEFAULT 0,
    retail_minor INTEGER DEFAULT 0,
    on_hand INTEGER DEFAULT 0,
    reserved INTEGER DEFAULT 0,
    damaged INTEGER DEFAULT 0,
    rop INTEGER DEFAULT 5,
    created_at TEXT NOT NULL,
    UNIQUE(organization_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_variants_org ON product_variants(organization_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode);

-- 10. STOCK BALANCES PER LOCATION
CREATE TABLE IF NOT EXISTS stock_balances (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    on_hand INTEGER DEFAULT 0,
    reserved INTEGER DEFAULT 0,
    damaged INTEGER DEFAULT 0,
    rop INTEGER DEFAULT 5,
    updated_at TEXT NOT NULL,
    UNIQUE(location_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_balances_org ON stock_balances(organization_id);
CREATE INDEX IF NOT EXISTS idx_balances_loc_sku ON stock_balances(location_id, sku);

-- 11. STOCK AUDIT LEDGER (Immutable Inventory Movements)
CREATE TABLE IF NOT EXISTS stock_ledger (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    type TEXT NOT NULL, -- 'INITIAL_SET', 'PURCHASE_RECEIPT', 'SALE_DEDUCTION', 'SALE_RETURN', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT'
    sku TEXT NOT NULL,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    variant_title TEXT NOT NULL,
    location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    location_name TEXT NOT NULL,
    delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    unit_cost_minor INTEGER DEFAULT 0,
    reference_no TEXT DEFAULT '',
    staff TEXT DEFAULT 'System',
    reason TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_ledger_org ON stock_ledger(organization_id);
CREATE INDEX IF NOT EXISTS idx_ledger_loc ON stock_ledger(location_id);
CREATE INDEX IF NOT EXISTS idx_ledger_sku ON stock_ledger(sku);

-- 12. SUPPLIERS (Owned by Finance)
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    country TEXT DEFAULT 'Cambodia',
    currency TEXT DEFAULT 'USD',
    payment_terms_days INTEGER DEFAULT 30,
    created_at TEXT NOT NULL,
    UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);

-- 13. PURCHASE SHIPMENTS / ORDERS (Owned by Finance)
CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    shipment_number TEXT NOT NULL,
    supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT NOT NULL,
    origin_country TEXT DEFAULT 'Cambodia',
    incoterms TEXT DEFAULT 'FOB',
    status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'TRANSIT', 'CUSTOMS', 'RECEIVED'
    order_date TEXT NOT NULL,
    expected_arrival TEXT DEFAULT '',
    currency TEXT DEFAULT 'USD',
    total_fob_minor INTEGER DEFAULT 0,
    total_overheads_minor INTEGER DEFAULT 0,
    total_landed_cost_minor INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    finalized_at TEXT DEFAULT NULL,
    UNIQUE(organization_id, shipment_number)
);

CREATE INDEX IF NOT EXISTS idx_shipments_org ON shipments(organization_id);

-- 14. SHIPMENT ITEMS
CREATE TABLE IF NOT EXISTS shipment_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    fob_unit_cost_minor INTEGER NOT NULL,
    fob_total_minor INTEGER NOT NULL,
    landed_unit_cost_minor INTEGER NOT NULL,
    landed_total_minor INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shipment_items_org ON shipment_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment ON shipment_items(shipment_id);

-- 15. SHIPMENT OVERHEADS (Freight, Customs, Taxes, Insurance)
CREATE TABLE IF NOT EXISTS shipment_overheads (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    overhead_type TEXT NOT NULL, -- 'SHIPPING_OCEAN', 'CUSTOMS_IMPORT_TAX', 'INSURANCE', 'LOCAL_CLEARANCE'
    vendor_name TEXT DEFAULT '',
    invoice_reference TEXT DEFAULT '',
    amount_minor INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD'
);

CREATE INDEX IF NOT EXISTS idx_overheads_shipment ON shipment_overheads(shipment_id);

-- 16. SUPPLIER BILLS (Accounts Payable)
CREATE TABLE IF NOT EXISTS supplier_bills (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bill_number TEXT NOT NULL,
    supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    paid_amount_minor INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE'
    created_at TEXT NOT NULL,
    UNIQUE(organization_id, bill_number)
);

CREATE INDEX IF NOT EXISTS idx_bills_org ON supplier_bills(organization_id);

-- 17. OPERATING EXPENSES (OPEX)
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    expense_number TEXT NOT NULL,
    category TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    payment_method TEXT DEFAULT 'CASH',
    date TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE(organization_id, expense_number)
);

CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id);

-- 18. CUSTOMER INVOICES
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PAID', -- 'PENDING', 'PAID', 'VOID'
    date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);

-- 19. POS SALES ORDERS (Owned by POS)
CREATE TABLE IF NOT EXISTS pos_orders (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    receipt_number TEXT NOT NULL,
    store_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    register_id TEXT NOT NULL REFERENCES registers(id) ON DELETE CASCADE,
    shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
    cashier_id TEXT NOT NULL REFERENCES users(id),
    cashier_name TEXT NOT NULL,
    subtotal_minor INTEGER NOT NULL,
    tax_minor INTEGER DEFAULT 0,
    discount_minor INTEGER DEFAULT 0,
    total_minor INTEGER NOT NULL,
    exchange_rate REAL DEFAULT 4000.0,
    payment_methods_json TEXT NOT NULL DEFAULT '[]',
    items_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'REFUNDED', 'VOID'
    created_at TEXT NOT NULL,
    UNIQUE(organization_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_orders_org ON pos_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_store ON pos_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_receipt ON pos_orders(receipt_number);

-- 20. SAVED / PARKED ORDERS
CREATE TABLE IF NOT EXISTS saved_orders (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    store_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    register_id TEXT NOT NULL REFERENCES registers(id) ON DELETE CASCADE,
    customer_name TEXT DEFAULT 'Walk-in Guest',
    order_tag TEXT DEFAULT '',
    items_json TEXT NOT NULL DEFAULT '[]',
    total_minor INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'HOLD', -- 'HOLD', 'RESUMED', 'CANCELLED'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_orders_org ON saved_orders(organization_id);

-- 21. CHART OF ACCOUNTS (Owned by Finance)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
    normal_side TEXT NOT NULL, -- 'DEBIT' or 'CREDIT'
    balance_minor INTEGER DEFAULT 0,
    description TEXT DEFAULT '',
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_accounts_org ON chart_of_accounts(organization_id);

-- 22. GENERAL LEDGER & BALANCED JOURNALS
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entry_number TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    source_module TEXT NOT NULL, -- 'FINANCE', 'POS', 'STOCK'
    reference_id TEXT DEFAULT '',
    lines_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    UNIQUE(organization_id, entry_number)
);

CREATE INDEX IF NOT EXISTS idx_journal_org ON journal_entries(organization_id);

-- 23. TRANSACTIONAL INTEGRATION EVENT BUS (Outbox / Inbox Pattern)
CREATE TABLE IF NOT EXISTS integration_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_app TEXT NOT NULL, -- 'POS', 'STOCK', 'FINANCE'
    source_id TEXT NOT NULL,
    dest_app TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'SALE_COMPLETED', 'STOCK_DEDUCTED', 'GOODS_RECEIVED', 'FINANCE_POSTED'
    idempotency_key TEXT NOT NULL UNIQUE,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSED', 'FAILED'
    retry_count INTEGER DEFAULT 0,
    error_message TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    processed_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_org ON integration_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON integration_events(status);

-- 24. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    user_id TEXT DEFAULT NULL,
    user_name TEXT DEFAULT 'System',
    details_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);

-- 25. SHIPPING CATEGORIES
CREATE TABLE IF NOT EXISTS shipping_categories (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    shipping_method TEXT DEFAULT 'Air Cargo',
    status TEXT DEFAULT 'ACTIVE',
    created_by TEXT DEFAULT 'Owner',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_shipcat_org ON shipping_categories(organization_id);

-- 26. CAPITAL ACCOUNTS & INVESTORS
CREATE TABLE IF NOT EXISTS capital_accounts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    partner_name TEXT NOT NULL,
    partner_role TEXT DEFAULT 'Co-investor',
    ownership_percentage REAL DEFAULT 0.0,
    total_invested REAL DEFAULT 0.0,
    total_withdrawn REAL DEFAULT 0.0,
    current_equity REAL DEFAULT 0.0,
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_capital_org ON capital_accounts(organization_id);
