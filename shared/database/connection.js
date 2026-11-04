// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — RELATIONAL DATABASE CONNECTION
// Singleton Database Connection via Node 24 Native SQLite Engine
// ============================================================================

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'theloops_enterprise.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbInstance = null;

function getDatabase() {
  if (dbInstance) return dbInstance;

  dbInstance = new DatabaseSync(DB_PATH);

  // Performance & Concurrency Pragmas
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA busy_timeout = 5000;');
  dbInstance.exec('PRAGMA synchronous = NORMAL;');

  // Schema Migrations for existing databases (ensure columns exist before running index creation in schemaSql)
  try { dbInstance.exec("ALTER TABLE users ADD COLUMN company_pin_hash TEXT;"); } catch (e) {}
  try { dbInstance.exec("ALTER TABLE users ADD COLUMN pin_encrypted TEXT;"); } catch (e) {}
  try { dbInstance.exec("ALTER TABLE organizations ADD COLUMN company_code TEXT;"); } catch (e) {}

  // Initialize Schema
  if (fs.existsSync(SCHEMA_PATH)) {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    dbInstance.exec(schemaSql);
  }

  try { dbInstance.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_company_pin ON users(organization_id, company_pin_hash) WHERE company_pin_hash IS NOT NULL AND status != 'DELETED';"); } catch (e) {}
  try { dbInstance.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_org_company_code ON organizations(company_code);"); } catch (e) {}
  try {
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS shipping_categories (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
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

      -- 1. Import History Management
      CREATE TABLE IF NOT EXISTS import_history (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          import_ref TEXT NOT NULL,
          import_date TEXT NOT NULL,
          month_period TEXT NOT NULL,
          year_period INTEGER NOT NULL,
          performed_by_id TEXT,
          performed_by_name TEXT NOT NULL,
          supplier_id TEXT,
          supplier_name TEXT DEFAULT '',
          items_json TEXT NOT NULL DEFAULT '[]',
          product_count INTEGER DEFAULT 0,
          total_quantity REAL DEFAULT 0,
          total_import_value REAL DEFAULT 0.0,
          shipping_cost REAL DEFAULT 0.0,
          additional_charges REAL DEFAULT 0.0,
          status TEXT DEFAULT 'COMPLETED',
          import_source TEXT DEFAULT 'MANUAL',
          purchase_date TEXT,
          received_date TEXT,
          is_archived INTEGER DEFAULT 0,
          documents_json TEXT DEFAULT '[]',
          notes TEXT DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_imp_org_period ON import_history(organization_id, month_period);
      CREATE INDEX IF NOT EXISTS idx_imp_ref ON import_history(import_ref);

      -- 2. Monthly Revenue Allocations
      CREATE TABLE IF NOT EXISTS monthly_revenue_allocations (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          period_month TEXT NOT NULL,
          period_year INTEGER NOT NULL,
          status TEXT DEFAULT 'ACTIVE',
          eligible_revenue REAL DEFAULT 0.0,
          total_allocated REAL DEFAULT 0.0,
          unallocated_reserve REAL DEFAULT 0.0,
          categories_config_json TEXT NOT NULL,
          created_by TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          closed_at TEXT,
          UNIQUE(organization_id, period_month)
      );
      CREATE INDEX IF NOT EXISTS idx_rev_alloc_org_month ON monthly_revenue_allocations(organization_id, period_month);

      -- 3. Budget Allocations (Live category tracking & carry forwards)
      CREATE TABLE IF NOT EXISTS budget_allocations (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          period_month TEXT NOT NULL,
          category_id TEXT NOT NULL,
          category_name TEXT NOT NULL,
          allocation_type TEXT NOT NULL,
          allocation_value REAL NOT NULL,
          allocated_amount REAL DEFAULT 0.0,
          opening_carry_forward REAL DEFAULT 0.0,
          available_budget REAL DEFAULT 0.0,
          spent_amount REAL DEFAULT 0.0,
          borrowed_from_capital REAL DEFAULT 0.0,
          repaid_to_capital REAL DEFAULT 0.0,
          remaining_balance REAL DEFAULT 0.0,
          allows_carry_forward INTEGER DEFAULT 1,
          carry_forward_action TEXT DEFAULT 'AUTO',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(organization_id, period_month, category_id)
      );
      CREATE INDEX IF NOT EXISTS idx_budget_alloc_org_month ON budget_allocations(organization_id, period_month);

      -- 4. Capital Borrowings
      CREATE TABLE IF NOT EXISTS capital_borrowings (
          id TEXT PRIMARY KEY,
          borrowing_ref TEXT NOT NULL UNIQUE,
          organization_id TEXT NOT NULL,
          period_month TEXT NOT NULL,
          date TEXT NOT NULL,
          budget_category_id TEXT NOT NULL,
          amount REAL NOT NULL,
          repaid_amount REAL DEFAULT 0.0,
          outstanding_amount REAL NOT NULL,
          status TEXT DEFAULT 'OUTSTANDING',
          reason TEXT NOT NULL,
          user_id TEXT,
          user_name TEXT NOT NULL,
          approved_by TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cap_borrow_org ON capital_borrowings(organization_id, period_month);

      -- 5. Capital Repayments
      CREATE TABLE IF NOT EXISTS capital_repayments (
          id TEXT PRIMARY KEY,
          repayment_ref TEXT NOT NULL UNIQUE,
          borrowing_id TEXT NOT NULL,
          organization_id TEXT NOT NULL,
          period_month TEXT NOT NULL,
          date TEXT NOT NULL,
          amount REAL NOT NULL,
          source_category_id TEXT NOT NULL,
          performed_by TEXT NOT NULL,
          notes TEXT DEFAULT '',
          created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cap_repay_org ON capital_repayments(organization_id, period_month);

      -- 6. Loop Share Ledger
      CREATE TABLE IF NOT EXISTS loop_share_ledger (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          period_month TEXT NOT NULL,
          transaction_type TEXT NOT NULL,
          amount REAL NOT NULL,
          balance_after REAL NOT NULL,
          date TEXT NOT NULL,
          reference TEXT DEFAULT '',
          recipient_name TEXT DEFAULT '',
          description TEXT NOT NULL,
          authorized_by TEXT NOT NULL,
          created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_loopshare_org ON loop_share_ledger(organization_id, period_month);

      -- 7. Monthly Closing Snapshots
      CREATE TABLE IF NOT EXISTS monthly_closing_snapshots (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          period_month TEXT NOT NULL,
          period_year INTEGER NOT NULL,
          closed_at TEXT NOT NULL,
          closed_by TEXT NOT NULL,
          snapshot_data_json TEXT NOT NULL,
          is_reopened INTEGER DEFAULT 0,
          reopened_at TEXT,
          reopened_by TEXT,
          reopen_reason TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(organization_id, period_month)
      );
      CREATE INDEX IF NOT EXISTS idx_closing_snap_org ON monthly_closing_snapshots(organization_id, period_month);

      -- 8. Financial Transaction History & Audit Ledger
      CREATE TABLE IF NOT EXISTS financial_transactions (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          date TEXT NOT NULL,
          transaction_type TEXT NOT NULL,
          category TEXT NOT NULL,
          amount REAL NOT NULL,
          source_account TEXT,
          destination_account TEXT,
          reference_id TEXT,
          performed_by TEXT NOT NULL,
          approval_status TEXT DEFAULT 'APPROVED',
          description TEXT NOT NULL,
          attachment_url TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_fin_tx_org_date ON financial_transactions(organization_id, date);

      -- 9. Export Audit Logs
      CREATE TABLE IF NOT EXISTS export_audit_logs (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          report_type TEXT NOT NULL,
          file_format TEXT NOT NULL,
          user_id TEXT,
          user_name TEXT NOT NULL,
          period_or_date_range TEXT,
          downloaded_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_export_audit_org ON export_audit_logs(organization_id);
    `);
  } catch (e) {
    console.warn('[DB] Schema expansion warning:', e.message);
  }

  return dbInstance;
}

module.exports = {
  getDatabase,
  DB_PATH
};

