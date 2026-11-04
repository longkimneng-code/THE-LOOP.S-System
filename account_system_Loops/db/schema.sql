-- ============================================================================
-- Loops Finance V3 — Universal Accounting & Financial Management Platform
-- Database Schema for MySQL 8.0+
-- Converted from PostgreSQL Specification per user architecture directives
-- Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- Precision Math: DECIMAL(19,4) for currency amounts & quantities; DECIMAL(19,8) for FX rates
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `loops_finance` 
  DEFAULT CHARACTER SET utf8mb4 
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `loops_finance`;

-- Disable foreign key checks during initialization
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. BUSINESSES & SETTINGS
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `business_settings`;
DROP TABLE IF EXISTS `businesses`;

CREATE TABLE `businesses` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `legal_name` VARCHAR(255) DEFAULT NULL,
  `tax_id` VARCHAR(50) DEFAULT NULL,
  `base_currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
  `fiscal_year_start_month` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `accounting_basis` ENUM('ACCRUAL', 'CASH') NOT NULL DEFAULT 'ACCRUAL',
  `is_tax_registered` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `business_settings` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `safe_cash_buffer` DECIMAL(19,4) NOT NULL DEFAULT 5000.0000,
  `default_markup_target` DECIMAL(5,2) NOT NULL DEFAULT 40.00,
  `auto_reverse_accruals` BOOLEAN NOT NULL DEFAULT TRUE,
  `lock_period_date` DATE DEFAULT NULL,
  `owner_mode_default` ENUM('SIMPLE', 'ACCOUNTANT') NOT NULL DEFAULT 'SIMPLE',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_bus_settings` (`business_id`),
  CONSTRAINT `fk_bs_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. CHART OF ACCOUNTS (All 65 standard accounts from Loops Finance V3)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `chart_of_accounts`;

CREATE TABLE `chart_of_accounts` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(10) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `type` ENUM(
    'ASSET', 
    'CONTRA_ASSET', 
    'LIABILITY', 
    'EQUITY', 
    'CONTRA_EQUITY', 
    'REVENUE', 
    'CONTRA_REVENUE', 
    'COGS', 
    'OPERATING_EXPENSE', 
    'NON_OPERATING', 
    'OTHER_INCOME', 
    'TAX', 
    'CLEARING'
  ) NOT NULL,
  `normal_side` ENUM('DEBIT', 'CREDIT') NOT NULL,
  `is_system_protected` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `description` VARCHAR(255) DEFAULT NULL,
  `current_balance` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_coa_code` (`business_id`, `code`),
  CONSTRAINT `fk_coa_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. GENERAL LEDGER & IMMUTABLE JOURNAL ENTRIES
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `journal_lines`;
DROP TABLE IF EXISTS `journal_entries`;

CREATE TABLE `journal_entries` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `entry_number` VARCHAR(30) NOT NULL,
  `accounting_date` DATE NOT NULL,
  `status` ENUM('DRAFT', 'POSTED', 'REVERSED', 'VOID') NOT NULL DEFAULT 'POSTED',
  `source_type` VARCHAR(40) NOT NULL, -- e.g. 'MANUAL', 'SALE', 'IMPORT_LANDED', 'BILL', 'EXPENSE', 'CAPITAL'
  `source_id` VARCHAR(36) DEFAULT NULL,
  `idempotency_key` VARCHAR(100) DEFAULT NULL,
  `memo` VARCHAR(255) NOT NULL,
  `total_debit` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `total_credit` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `is_balanced` BOOLEAN GENERATED ALWAYS AS (`total_debit` = `total_credit`) STORED,
  `reversal_of_id` VARCHAR(36) DEFAULT NULL,
  `reversed_by_id` VARCHAR(36) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT 'system',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_je_number` (`business_id`, `entry_number`),
  UNIQUE KEY `idx_je_idempotent` (`business_id`, `idempotency_key`),
  KEY `idx_je_date` (`business_id`, `accounting_date`),
  CONSTRAINT `fk_je_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `journal_lines` (
  `id` VARCHAR(36) NOT NULL,
  `journal_entry_id` VARCHAR(36) NOT NULL,
  `account_id` VARCHAR(36) NOT NULL,
  `debit` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `credit` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
  `exchange_rate` DECIMAL(19,8) NOT NULL DEFAULT 1.00000000,
  `base_debit` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `base_credit` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `memo` VARCHAR(255) DEFAULT NULL,
  `dimension_branch` VARCHAR(50) DEFAULT NULL,
  `dimension_channel` VARCHAR(50) DEFAULT NULL,
  `line_order` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_jl_entry` (`journal_entry_id`),
  KEY `idx_jl_account` (`account_id`),
  CONSTRAINT `fk_jl_entry` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_jl_account` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. CAPITAL & EQUITY MANAGEMENT
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `capital_transactions`;
DROP TABLE IF EXISTS `capital_accounts`;

CREATE TABLE `capital_accounts` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `partner_name` VARCHAR(120) NOT NULL,
  `partner_role` VARCHAR(80) DEFAULT 'Co-founder',
  `ownership_percentage` DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  `total_invested` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `total_withdrawn` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `current_equity` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ca_business` (`business_id`),
  CONSTRAINT `fk_ca_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `capital_transactions` (
  `id` VARCHAR(36) NOT NULL,
  `capital_account_id` VARCHAR(36) NOT NULL,
  `type` ENUM(
    'INITIAL_INVESTMENT', 
    'CAPITAL_INJECTION', 
    'OWNER_DRAWING', 
    'DIVIDEND_PAYOUT', 
    'RETAINED_EARNINGS_ROLLOVER'
  ) NOT NULL,
  `amount` DECIMAL(19,4) NOT NULL,
  `transaction_date` DATE NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER',
  `reference_doc` VARCHAR(255) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `linked_journal_id` VARCHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ctx_account` (`capital_account_id`),
  CONSTRAINT `fk_ctx_account` FOREIGN KEY (`capital_account_id`) REFERENCES `capital_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. STARTUP BUDGET & CAPEX / OPEX TRACKER
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `startup_budget_items`;
DROP TABLE IF EXISTS `startup_budgets`;

CREATE TABLE `startup_budgets` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL DEFAULT 'Main Launch Budget',
  `total_budgeted_capex` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `total_budgeted_opex` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `total_actual_spent` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `status` ENUM('ACTIVE', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sb_business` (`business_id`),
  CONSTRAINT `fk_sb_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `startup_budget_items` (
  `id` VARCHAR(36) NOT NULL,
  `startup_budget_id` VARCHAR(36) NOT NULL,
  `category` VARCHAR(80) NOT NULL, -- e.g. 'Store Renovation', 'POS Hardware', 'Lease Deposit', 'Branding'
  `classification` ENUM('CAPEX', 'OPEX', 'DEPOSIT') NOT NULL DEFAULT 'CAPEX',
  `phase` ENUM('PRE_LAUNCH', 'POST_LAUNCH_EXPANSION') NOT NULL DEFAULT 'PRE_LAUNCH',
  `item_name` VARCHAR(150) NOT NULL,
  `budgeted_amount` DECIMAL(19,4) NOT NULL,
  `committed_amount` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `actual_paid_amount` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `status` ENUM('PLANNED', 'COMMITTED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
  `target_date` DATE DEFAULT NULL,
  `paid_date` DATE DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sbi_budget` (`startup_budget_id`),
  CONSTRAINT `fk_sbi_budget` FOREIGN KEY (`startup_budget_id`) REFERENCES `startup_budgets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. IMPORT PRODUCT & LANDED COST ENGINE
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `shipment_cost_allocations`;
DROP TABLE IF EXISTS `shipment_overheads`;
DROP TABLE IF EXISTS `import_shipment_items`;
DROP TABLE IF EXISTS `import_shipments`;

CREATE TABLE `import_shipments` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `shipment_code` VARCHAR(50) NOT NULL, -- e.g. 'IMP-2026-001'
  `supplier_name` VARCHAR(150) NOT NULL,
  `origin_country` VARCHAR(80) DEFAULT 'China',
  `destination_warehouse` VARCHAR(100) DEFAULT 'Main Flagship Warehouse',
  `shipping_terms` ENUM('FOB', 'EXW', 'CIF', 'DDP', 'CFR') NOT NULL DEFAULT 'FOB',
  `status` ENUM(
    'ESTIMATE', 
    'RECEIVED', 
    'ACTUAL_BILLS', 
    'COMPARE', 
    'FINALIZED', 
    'RECONCILED'
  ) NOT NULL DEFAULT 'ESTIMATE',
  `foreign_currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
  `exchange_rate` DECIMAL(19,8) NOT NULL DEFAULT 1.00000000,
  `departure_date` DATE DEFAULT NULL,
  `arrival_date` DATE DEFAULT NULL,
  `total_goods_cost_base` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `total_overheads_base` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `total_landed_cost_base` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_shipment_code` (`business_id`, `shipment_code`),
  CONSTRAINT `fk_shipment_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `import_shipment_items` (
  `id` VARCHAR(36) NOT NULL,
  `shipment_id` VARCHAR(36) NOT NULL,
  `sku_code` VARCHAR(60) NOT NULL,
  `product_name` VARCHAR(150) NOT NULL,
  `variant_name` VARCHAR(100) DEFAULT NULL,
  `quantity` INT UNSIGNED NOT NULL,
  `unit_base_price_fc` DECIMAL(19,4) NOT NULL, -- Foreign Currency price
  `unit_base_price_base` DECIMAL(19,4) NOT NULL, -- Base currency price
  `total_base_price_base` DECIMAL(19,4) NOT NULL,
  `unit_weight_kg` DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  `total_weight_kg` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `unit_volume_cbm` DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  `total_volume_cbm` DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  -- Overhead distributions
  `allocated_freight` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `allocated_duty` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `allocated_clearance` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `allocated_trucking` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `allocated_other` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  -- Landed results
  `total_landed_cost` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `unit_landed_cost` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `target_retail_price` DECIMAL(19,4) DEFAULT NULL,
  `projected_margin_pct` DECIMAL(5,2) DEFAULT NULL,
  `projected_markup_pct` DECIMAL(5,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_isi_shipment` (`shipment_id`),
  CONSTRAINT `fk_isi_shipment` FOREIGN KEY (`shipment_id`) REFERENCES `import_shipments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shipment_overheads` (
  `id` VARCHAR(36) NOT NULL,
  `shipment_id` VARCHAR(36) NOT NULL,
  `category` ENUM(
    'INTERNATIONAL_FREIGHT', 
    'CUSTOMS_DUTY', 
    'PORT_CLEARANCE_THC', 
    'BROKERAGE_INSPECTION', 
    'LOCAL_TRUCKING', 
    'CARGO_INSURANCE', 
    'PACKAGING_TAGGING', 
    'STORAGE_DEMURRAGE', 
    'OTHER'
  ) NOT NULL,
  `vendor_name` VARCHAR(150) NOT NULL,
  `invoice_number` VARCHAR(80) DEFAULT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
  `exchange_rate` DECIMAL(19,8) NOT NULL DEFAULT 1.00000000,
  `amount_foreign` DECIMAL(19,4) NOT NULL,
  `amount_base` DECIMAL(19,4) NOT NULL,
  `is_capitalizable` BOOLEAN NOT NULL DEFAULT TRUE, -- TRUE = added to stock cost; FALSE = expensed
  `is_recoverable_tax` BOOLEAN NOT NULL DEFAULT FALSE,
  `allocation_basis` ENUM(
    'BY_WEIGHT', 
    'BY_VALUE', 
    'BY_VOLUME', 
    'BY_QUANTITY', 
    'MANUAL'
  ) NOT NULL DEFAULT 'BY_WEIGHT',
  `is_paid` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_so_shipment` (`shipment_id`),
  CONSTRAINT `fk_so_shipment` FOREIGN KEY (`shipment_id`) REFERENCES `import_shipments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. SUPPLIER BILLS (ACCOUNTS PAYABLE & 30/70 ADVANCES)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `supplier_advances`;
DROP TABLE IF EXISTS `supplier_bill_lines`;
DROP TABLE IF EXISTS `supplier_bills`;

CREATE TABLE `supplier_bills` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `bill_number` VARCHAR(50) NOT NULL,
  `supplier_name` VARCHAR(150) NOT NULL,
  `bill_date` DATE NOT NULL,
  `due_date` DATE NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
  `exchange_rate` DECIMAL(19,8) NOT NULL DEFAULT 1.00000000,
  `total_amount` DECIMAL(19,4) NOT NULL,
  `deposit_paid` DECIMAL(19,4) NOT NULL DEFAULT 0.0000, -- e.g. 30% initial deposit
  `balance_due` DECIMAL(19,4) NOT NULL,
  `status` ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') NOT NULL DEFAULT 'UNPAID',
  `linked_po_number` VARCHAR(50) DEFAULT NULL,
  `linked_shipment_id` VARCHAR(36) DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_sb_bill_num` (`business_id`, `bill_number`),
  CONSTRAINT `fk_sbills_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `supplier_advances` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `supplier_name` VARCHAR(150) NOT NULL,
  `amount` DECIMAL(19,4) NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER',
  `applied_bill_id` VARCHAR(36) DEFAULT NULL,
  `status` ENUM('UNAPPLIED', 'PARTIALLY_APPLIED', 'FULLY_APPLIED') NOT NULL DEFAULT 'UNAPPLIED',
  `memo` VARCHAR(255) DEFAULT 'Advance deposit payment',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sa_business` (`business_id`),
  CONSTRAINT `fk_sa_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. OPERATING EXPENSES (OPEX) & RECURRING BILLS
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `expenses`;
DROP TABLE IF EXISTS `recurring_bills`;

CREATE TABLE `expenses` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `expense_number` VARCHAR(30) NOT NULL,
  `category` VARCHAR(80) NOT NULL, -- e.g. 'Rent', 'Meta Ads', 'Staff Wages', 'Packaging', 'Payment Gateway'
  `tier` ENUM(
    'DIRECT_SELLING', 
    'MARKETING_ADS', 
    'OCCUPANCY_RENT', 
    'PAYROLL_WAGES', 
    'ADMIN_SOFTWARE', 
    'TAX_FINANCIAL'
  ) NOT NULL DEFAULT 'ADMIN_SOFTWARE',
  `vendor_payee` VARCHAR(150) NOT NULL,
  `amount` DECIMAL(19,4) NOT NULL,
  `expense_date` DATE NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER',
  `receipt_url` VARCHAR(255) DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_exp_business` (`business_id`),
  CONSTRAINT `fk_exp_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `recurring_bills` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(150) NOT NULL, -- e.g. 'Retail Store Rent', 'Shopify Subscription'
  `category` VARCHAR(80) NOT NULL,
  `amount` DECIMAL(19,4) NOT NULL,
  `frequency` ENUM('MONTHLY', 'QUARTERLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
  `day_of_month` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `next_due_date` DATE NOT NULL,
  `auto_post` BOOLEAN NOT NULL DEFAULT FALSE, -- Requires review before posting in V3
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (`id`),
  KEY `idx_rb_business` (`business_id`),
  CONSTRAINT `fk_rb_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. CUSTOMER INVOICES, SALES REVENUE & RECEIVABLES (AR)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `customer_deposits`;
DROP TABLE IF EXISTS `customer_receipts`;
DROP TABLE IF EXISTS `customer_invoices`;

CREATE TABLE `customer_invoices` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `invoice_number` VARCHAR(50) NOT NULL,
  `customer_name` VARCHAR(150) NOT NULL,
  `invoice_date` DATE NOT NULL,
  `due_date` DATE NOT NULL,
  `subtotal` DECIMAL(19,4) NOT NULL,
  `tax_amount` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `discount_amount` DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  `total_amount` DECIMAL(19,4) NOT NULL,
  `landed_cogs_amount` DECIMAL(19,4) NOT NULL DEFAULT 0.0000, -- Landed cost of goods sold
  `gross_profit` DECIMAL(19,4) GENERATED ALWAYS AS (`total_amount` - `landed_cogs_amount`) STORED,
  `status` ENUM('DRAFT', 'POSTED', 'PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'POSTED',
  `channel` VARCHAR(50) DEFAULT 'RETAIL_POS',
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_ci_number` (`business_id`, `invoice_number`),
  CONSTRAINT `fk_ci_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customer_deposits` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `customer_name` VARCHAR(150) NOT NULL,
  `amount` DECIMAL(19,4) NOT NULL,
  `deposit_date` DATE NOT NULL,
  `status` ENUM('AVAILABLE', 'USED', 'REFUNDED') NOT NULL DEFAULT 'AVAILABLE',
  `notes` VARCHAR(255) DEFAULT 'Customer layaway / advance deposit',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cd_business` (`business_id`),
  CONSTRAINT `fk_cd_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. MULTI-CURRENCY EXCHANGE RATES
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `exchange_rates`;

CREATE TABLE `exchange_rates` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `from_currency` VARCHAR(3) NOT NULL,
  `to_currency` VARCHAR(3) NOT NULL,
  `rate` DECIMAL(19,8) NOT NULL,
  `effective_date` DATE NOT NULL,
  `source` VARCHAR(50) DEFAULT 'CENTRAL_BANK',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fx_pair` (`business_id`, `from_currency`, `to_currency`, `effective_date`),
  CONSTRAINT `fk_fx_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. AUDIT LOGS & INTEGRATION EVENT OUTBOX/INBOX
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `integration_events`;
DROP TABLE IF EXISTS `audit_logs`;

CREATE TABLE `audit_logs` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` VARCHAR(36) NOT NULL,
  `user_email` VARCHAR(120) DEFAULT 'owner@theloops.com',
  `details` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_bus` (`business_id`, `created_at`),
  CONSTRAINT `fk_al_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `integration_events` (
  `id` VARCHAR(36) NOT NULL,
  `business_id` VARCHAR(36) NOT NULL,
  `direction` ENUM('STOCK_TO_FINANCE', 'FINANCE_TO_STOCK') NOT NULL,
  `event_type` VARCHAR(80) NOT NULL, -- e.g. 'GOODS_RECEIVED', 'SALE_COMPLETED', 'SHIPMENT_COST_FINALIZED'
  `source_transaction_id` VARCHAR(60) NOT NULL,
  `status` ENUM('PENDING', 'PROCESSED', 'FAILED', 'REPLAYED') NOT NULL DEFAULT 'PENDING',
  `payload` JSON NOT NULL,
  `error_message` TEXT DEFAULT NULL,
  `processed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ie_status` (`business_id`, `status`),
  CONSTRAINT `fk_ie_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- SEED DATA: BUSINESSES & CHART OF ACCOUNTS (All 65 Standard V3 Accounts)
-- ============================================================================

INSERT INTO `businesses` (`id`, `name`, `legal_name`, `base_currency`, `fiscal_year_start_month`, `accounting_basis`)
VALUES ('bus-loops-001', 'The Loops Flagship Store', 'The Loops Retail Co., Ltd.', 'USD', 1, 'ACCRUAL');

INSERT INTO `business_settings` (`id`, `business_id`, `safe_cash_buffer`, `default_markup_target`, `owner_mode_default`)
VALUES ('set-loops-001', 'bus-loops-001', 10000.0000, 45.00, 'SIMPLE');

-- 65 Standard Chart of Accounts from Loops Finance V3 Specification
INSERT INTO `chart_of_accounts` (`id`, `business_id`, `code`, `name`, `type`, `normal_side`, `is_system_protected`, `description`) VALUES
-- Assets (1000 - 1999)
(UUID(), 'bus-loops-001', '1010', 'Cash on Hand', 'ASSET', 'DEBIT', 0, 'Physical cash register drawer money'),
(UUID(), 'bus-loops-001', '1015', 'Petty Cash', 'ASSET', 'DEBIT', 0, 'Small operational cash float'),
(UUID(), 'bus-loops-001', '1020', 'Bank Operating Account', 'ASSET', 'DEBIT', 0, 'Primary corporate checking/savings account'),
(UUID(), 'bus-loops-001', '1030', 'Payment Gateway Clearing', 'ASSET', 'DEBIT', 1, 'Credit card / QR / Stripe merchant processor funds in transit'),
(UUID(), 'bus-loops-001', '1100', 'Accounts Receivable', 'ASSET', 'DEBIT', 1, 'Unpaid customer orders and invoices'),
(UUID(), 'bus-loops-001', '1110', 'Allowance for Doubtful Accounts', 'CONTRA_ASSET', 'CREDIT', 0, 'Estimated uncollectible receivables provision'),
(UUID(), 'bus-loops-001', '1150', 'Supplier Advances', 'ASSET', 'DEBIT', 1, 'Prepayments and 30% initial deposits paid to suppliers'),
(UUID(), 'bus-loops-001', '1160', 'Staff Advances & Other Receivables', 'ASSET', 'DEBIT', 0, 'Short-term loans or travel advances to employees'),
(UUID(), 'bus-loops-001', '1200', 'Inventory Asset', 'ASSET', 'DEBIT', 1, 'Physical stock on hand at weighted-average landed cost'),
(UUID(), 'bus-loops-001', '1205', 'Inventory Reserve (Obsolescence)', 'CONTRA_ASSET', 'CREDIT', 0, 'Provision for slow-moving or outdated stock'),
(UUID(), 'bus-loops-001', '1210', 'Goods in Transit', 'ASSET', 'DEBIT', 1, 'Import shipments departed factory but not yet warehouse cleared'),
(UUID(), 'bus-loops-001', '1215', 'Landed Cost Clearing', 'ASSET', 'DEBIT', 1, 'Holding account for freight, duties & drayage before allocation'),
(UUID(), 'bus-loops-001', '1220', 'Input VAT Receivable', 'ASSET', 'DEBIT', 0, 'Recoverable value added tax on local purchases'),
(UUID(), 'bus-loops-001', '1225', 'Import VAT Receivable', 'ASSET', 'DEBIT', 0, 'Recoverable customs import tax paid at port of entry'),
(UUID(), 'bus-loops-001', '1300', 'Prepaid Expenses', 'ASSET', 'DEBIT', 0, 'Prepaid rent, insurance, or software licenses'),
(UUID(), 'bus-loops-001', '1310', 'Deposits Paid', 'ASSET', 'DEBIT', 0, 'Refundable commercial lease and utility security deposits'),
(UUID(), 'bus-loops-001', '1500', 'Property, Plant & Equipment', 'ASSET', 'DEBIT', 0, 'Store fit-out, shelving, POS terminals, and fixtures'),
(UUID(), 'bus-loops-001', '1590', 'Accumulated Depreciation', 'CONTRA_ASSET', 'CREDIT', 0, 'Total cumulative depreciation on store equipment'),
(UUID(), 'bus-loops-001', '1999', 'Suspense Account', 'CLEARING', 'DEBIT', 1, 'Temporary unallocated balancing clearing account'),

-- Liabilities (2000 - 2999)
(UUID(), 'bus-loops-001', '2010', 'Accounts Payable', 'LIABILITY', 'CREDIT', 1, 'Unpaid supplier invoices and vendor bills'),
(UUID(), 'bus-loops-001', '2020', 'Goods Received Not Invoiced (GRNI)', 'LIABILITY', 'CREDIT', 1, 'Stock delivered to warehouse before final supplier bill arrived'),
(UUID(), 'bus-loops-001', '2030', 'Output VAT Payable', 'LIABILITY', 'CREDIT', 0, 'Sales tax / VAT collected from customers on retail sales'),
(UUID(), 'bus-loops-001', '2040', 'Withholding Tax Payable', 'LIABILITY', 'CREDIT', 0, 'Tax withheld from supplier or contractor payouts'),
(UUID(), 'bus-loops-001', '2050', 'Customs Duty & Import Taxes Payable', 'LIABILITY', 'CREDIT', 0, 'Unpaid tariff assessments from customs authority'),
(UUID(), 'bus-loops-001', '2060', 'Accrued Expenses', 'LIABILITY', 'CREDIT', 1, 'Incurred unbilled expenses like utility or audit fees'),
(UUID(), 'bus-loops-001', '2070', 'Payroll Liabilities', 'LIABILITY', 'CREDIT', 0, 'Accrued wages, social security, and pensions due'),
(UUID(), 'bus-loops-001', '2080', 'Customer Deposits & Store Credit', 'LIABILITY', 'CREDIT', 0, 'Unearned customer advances and layaway balances'),
(UUID(), 'bus-loops-001', '2085', 'Gift Card Liability', 'LIABILITY', 'CREDIT', 0, 'Outstanding unredeemed gift cards'),
(UUID(), 'bus-loops-001', '2090', 'Refunds Payable', 'LIABILITY', 'CREDIT', 0, 'Pending approved customer refund balances'),
(UUID(), 'bus-loops-001', '2095', 'Income Tax Payable', 'LIABILITY', 'CREDIT', 0, 'Corporate income tax liability'),
(UUID(), 'bus-loops-001', '2100', 'Loans Payable - Current', 'LIABILITY', 'CREDIT', 0, 'Short-term bank loans and credit facilities due within 1 year'),
(UUID(), 'bus-loops-001', '2150', 'Loans Payable - Long Term', 'LIABILITY', 'CREDIT', 0, 'Long-term financing and business capital notes'),
(UUID(), 'bus-loops-001', '2160', 'Accrued Interest Payable', 'LIABILITY', 'CREDIT', 0, 'Interest incurred on business loans but not yet debited'),

-- Equity (3000 - 3999)
(UUID(), 'bus-loops-001', '3010', 'Owner Capital', 'EQUITY', 'CREDIT', 1, 'Initial equity capital contributed by founders'),
(UUID(), 'bus-loops-001', '3020', 'Additional Paid-in Capital', 'EQUITY', 'CREDIT', 0, 'Subsequent capital injections from partners/investors'),
(UUID(), 'bus-loops-001', '3030', 'Owner Drawings', 'CONTRA_EQUITY', 'DEBIT', 1, 'Withdrawals and personal disbursements taken by owners'),
(UUID(), 'bus-loops-001', '3040', 'Dividends Declared', 'CONTRA_EQUITY', 'DEBIT', 0, 'Formal shareholder profit distribution declarations'),
(UUID(), 'bus-loops-001', '3050', 'Opening Balance Equity', 'EQUITY', 'CREDIT', 1, 'System balance setup account (must equal zero)'),
(UUID(), 'bus-loops-001', '3100', 'Retained Earnings', 'EQUITY', 'CREDIT', 1, 'Cumulative net profits rolled over across prior fiscal years'),
(UUID(), 'bus-loops-001', '3200', 'Current Year Earnings', 'EQUITY', 'CREDIT', 1, 'Calculated live P&L balance for active fiscal period'),

-- Revenue (4000 - 4999)
(UUID(), 'bus-loops-001', '4010', 'Sales Revenue', 'REVENUE', 'CREDIT', 1, 'Gross income earned from physical product sales'),
(UUID(), 'bus-loops-001', '4015', 'Shipping Income', 'REVENUE', 'CREDIT', 0, 'Delivery / courier fees billed to customers'),
(UUID(), 'bus-loops-001', '4020', 'Sales Returns & Allowances', 'CONTRA_REVENUE', 'DEBIT', 0, 'Customer returns, refunds and return merchandise credit'),
(UUID(), 'bus-loops-001', '4030', 'Discounts Given', 'CONTRA_REVENUE', 'DEBIT', 0, 'Promotional, seasonal and retail POS discount deductions'),

-- Cost of Goods Sold (5000 - 5999)
(UUID(), 'bus-loops-001', '5010', 'Landed Cost of Goods Sold', 'COGS', 'DEBIT', 1, 'True landed inventory cost of sold merchandise'),
(UUID(), 'bus-loops-001', '5020', 'Damaged Inventory Write-off', 'COGS', 'DEBIT', 0, 'Defective, broken or unsellable stock written off'),
(UUID(), 'bus-loops-001', '5030', 'Inventory Adjustments & Shrinkage', 'COGS', 'DEBIT', 0, 'Discrepancies identified during physical cycle stocktakes'),
(UUID(), 'bus-loops-001', '5040', 'Landed Cost Variance on Sold Units', 'COGS', 'DEBIT', 1, 'Adjustments arriving after items were already sold'),

-- Operating Expenses (6000 - 6999)
(UUID(), 'bus-loops-001', '6010', 'Direct Selling Costs', 'OPERATING_EXPENSE', 'DEBIT', 0, 'Customer packaging bags, boxes, tissue, and label tape'),
(UUID(), 'bus-loops-001', '6015', 'Payment Gateway Fees', 'OPERATING_EXPENSE', 'DEBIT', 0, 'Stripe, PayPal, POS terminal swipe processing charges (2-3%)'),
(UUID(), 'bus-loops-001', '6020', 'Marketing and Advertising', 'OPERATING_EXPENSE', 'DEBIT', 0, 'Instagram/Meta ads, TikTok campaigns, printed flyers'),
(UUID(), 'bus-loops-001', '6030', 'Rent & Store Utilities', 'OPERATING_EXPENSE', 'DEBIT', 0, 'Monthly lease, electricity, water, internet'),
(UUID(), 'bus-loops-001', '6040', 'Payroll & Staff Wages', 'OPERATING_EXPENSE', 'DEBIT', 0, 'Store cashier salaries, shop manager wages, incentives'),
(UUID(), 'bus-loops-001', '6050', 'Administration & Software', 'OPERATING_EXPENSE', 'DEBIT', 0, 'SaaS subscriptions, POS licensing, office supplies'),
(UUID(), 'bus-loops-001', '6055', 'Professional Fees', 'OPERATING_EXPENSE', 'DEBIT', 0, 'External accountant, legal, tax consultant fees'),
(UUID(), 'bus-loops-001', '6060', 'Depreciation & Amortization', 'OPERATING_EXPENSE', 'DEBIT', 1, 'Periodic non-cash depreciation of fixed physical assets'),
(UUID(), 'bus-loops-001', '6070', 'Bank Charges & Wire Fees', 'OPERATING_EXPENSE', 'DEBIT', 0, 'Monthly account maintenance fees and wire transfer costs'),
(UUID(), 'bus-loops-001', '6080', 'Bad Debt Expense', 'OPERATING_EXPENSE', 'DEBIT', 0, 'Uncollectible customer receivable balances expensed'),
(UUID(), 'bus-loops-001', '6090', 'Rounding Differences', 'OPERATING_EXPENSE', 'DEBIT', 1, 'Micro-cent fractional currency rounding balancing'),

-- Non-Operating, Other Income & Tax (7000 - 9999)
(UUID(), 'bus-loops-001', '7010', 'Interest Expense', 'NON_OPERATING', 'DEBIT', 0, 'Financing interest paid on borrowings'),
(UUID(), 'bus-loops-001', '7020', 'Realized FX Gain or Loss', 'NON_OPERATING', 'DEBIT', 1, 'Currency exchange gain/loss realized upon invoice settlement'),
(UUID(), 'bus-loops-001', '7030', 'Unrealized FX Gain or Loss', 'NON_OPERATING', 'DEBIT', 1, 'Period-end open foreign balance revaluation delta'),
(UUID(), 'bus-loops-001', '8010', 'Interest Income', 'OTHER_INCOME', 'CREDIT', 0, 'Interest earned on business savings deposits'),
(UUID(), 'bus-loops-001', '8090', 'Other Income', 'OTHER_INCOME', 'CREDIT', 0, 'Miscellaneous non-operational income'),
(UUID(), 'bus-loops-001', '9010', 'Corporate Income Tax Expense', 'TAX', 'DEBIT', 0, 'National/State corporate profit tax provision');

-- Initial Founder Capital Contribution
INSERT INTO `capital_accounts` (`id`, `business_id`, `partner_name`, `partner_role`, `ownership_percentage`, `total_invested`, `current_equity`)
VALUES ('cap-founder-001', 'bus-loops-001', 'Business Owner', 'Managing Founder', 100.00, 50000.0000, 50000.0000);

INSERT INTO `capital_transactions` (`id`, `capital_account_id`, `type`, `amount`, `transaction_date`, `payment_method`, `notes`)
VALUES (UUID(), 'cap-founder-001', 'INITIAL_INVESTMENT', 50000.0000, '2026-10-01', 'BANK_TRANSFER', 'Seed capital deposited into Bank Operating Account');

-- Startup Budget Setup
INSERT INTO `startup_budgets` (`id`, `business_id`, `name`, `total_budgeted_capex`, `total_budgeted_opex`, `total_actual_spent`)
VALUES ('bud-launch-001', 'bus-loops-001', 'Retail Launch & Store Opening', 25000.0000, 15000.0000, 22400.0000);

INSERT INTO `startup_budget_items` (`id`, `startup_budget_id`, `category`, `classification`, `phase`, `item_name`, `budgeted_amount`, `committed_amount`, `actual_paid_amount`, `status`, `notes`) VALUES
(UUID(), 'bud-launch-001', 'Store Renovation', 'CAPEX', 'PRE_LAUNCH', 'Custom Oak Shelving & Display Counters', 12000.0000, 12000.0000, 11500.0000, 'PAID', 'Completed on schedule'),
(UUID(), 'bud-launch-001', 'POS Hardware', 'CAPEX', 'PRE_LAUNCH', 'Dual Screen Register, Receipt & Barcode Printers', 3500.0000, 3500.0000, 3200.0000, 'PAID', 'Star Micronics & Zebra scanners'),
(UUID(), 'bud-launch-001', 'Lease Security Deposit', 'DEPOSIT', 'PRE_LAUNCH', '3 Months Commercial Mall Space Deposit', 9500.0000, 9500.0000, 9500.0000, 'PAID', 'Refundable end of 3-year term'),
(UUID(), 'bud-launch-001', 'Initial Marketing', 'OPEX', 'PRE_LAUNCH', 'Launch Branding, Window Decals & Social Blitz', 5000.0000, 4000.0000, 3800.0000, 'PAID', 'Instagram influencer seeding'),
(UUID(), 'bud-launch-001', 'Working Capital Buffer', 'OPEX', 'PRE_LAUNCH', 'Initial 60-day Cash Operating Float', 10000.0000, 0.0000, 0.0000, 'PLANNED', 'Cash buffer maintained at bank');

-- Initial Import Shipment (Exact Worked Example from Loops Finance V3 Specification)
-- Product A: 500 units @ $10.00 | Product B: 1,000 units @ $2.00
-- Overheads: Sea Freight $1,500 (by weight), Duty $700 (by value), Clearance $300 (by value), Local Trucking $200 (by weight)
-- Target: Product A unit landed = $11.7686 ($11.77), Product B unit landed = $3.8157 ($3.82)
INSERT INTO `import_shipments` (
  `id`, `business_id`, `shipment_code`, `supplier_name`, `origin_country`, `shipping_terms`, 
  `status`, `foreign_currency`, `exchange_rate`, `total_goods_cost_base`, `total_overheads_base`, `total_landed_cost_base`, `notes`
) VALUES (
  'ship-worked-001', 'bus-loops-001', 'IMP-2026-001', 'Shenzhen Precision Craft Manufacturing', 'China', 'FOB',
  'FINALIZED', 'USD', 1.00000000, 7000.0000, 2700.0000, 9700.0000, 'First seasonal import shipment batch. True landed costs verified per V3 model.'
);

INSERT INTO `import_shipment_items` (
  `id`, `shipment_id`, `sku_code`, `product_name`, `variant_name`, `quantity`, 
  `unit_base_price_fc`, `unit_base_price_base`, `total_base_price_base`, 
  `unit_weight_kg`, `total_weight_kg`, `unit_volume_cbm`, `total_volume_cbm`,
  `allocated_freight`, `allocated_duty`, `allocated_clearance`, `allocated_trucking`, `allocated_other`,
  `total_landed_cost`, `unit_landed_cost`, `target_retail_price`, `projected_margin_pct`, `projected_markup_pct`
) VALUES 
(
  'isi-prod-a', 'ship-worked-001', 'SKU-PROD-A', 'Ultra-Light Titanium Chrono Watch', 'Classic Obsidian / Matte', 500,
  10.0000, 10.0000, 5000.0000,
  0.200, 100.000, 0.0010, 0.5000,
  150.0000, 500.0000, 214.2900, 20.0000, 0.0000,
  5884.2900, 11.7686, 28.0000, 57.97, 137.92
),
(
  'isi-prod-b', 'ship-worked-001', 'SKU-PROD-B', 'Heavy Canvas Travel Duffle Pack', 'Midnight Charcoal 45L', 1000,
  2.0000, 2.0000, 2000.0000,
  0.900, 900.000, 0.0025, 2.5000,
  1350.0000, 200.0000, 85.7100, 180.0000, 0.0000,
  3815.7100, 3.8157, 12.0000, 68.20, 214.49
);

INSERT INTO `shipment_overheads` (
  `id`, `shipment_id`, `category`, `vendor_name`, `invoice_number`, `currency`, `exchange_rate`,
  `amount_foreign`, `amount_base`, `is_capitalizable`, `allocation_basis`, `is_paid`
) VALUES
(UUID(), 'ship-worked-001', 'INTERNATIONAL_FREIGHT', 'Pacific Sea Forwarding Lines', 'INV-PSF-8891', 'USD', 1.0, 1500.0000, 1500.0000, 1, 'BY_WEIGHT', 1),
(UUID(), 'ship-worked-001', 'CUSTOMS_DUTY', 'Port Customs & Border Tariff Dept', 'DUTY-2026-99', 'USD', 1.0, 700.0000, 700.0000, 1, 'BY_VALUE', 1),
(UUID(), 'ship-worked-001', 'PORT_CLEARANCE_THC', 'Apex Maritime Port Clearing Broker', 'APX-7712', 'USD', 1.0, 300.0000, 300.0000, 1, 'BY_VALUE', 1),
(UUID(), 'ship-worked-001', 'LOCAL_TRUCKING', 'Metropolitan Express Drayage Co.', 'METRO-441', 'USD', 1.0, 200.0000, 200.0000, 1, 'BY_WEIGHT', 1);

-- Balanced Journal Entry for Landed Cost Finalization
INSERT INTO `journal_entries` (
  `id`, `business_id`, `entry_number`, `accounting_date`, `status`, `source_type`, `source_id`, `memo`, `total_debit`, `total_credit`
) VALUES (
  'je-ship-001', 'bus-loops-001', 'JRN-2026-0001', '2026-10-15', 'POSTED', 'IMPORT_LANDED', 'ship-worked-001', 
  'Landed cost capitalization for shipment IMP-2026-001 (Product A $11.77, Product B $3.82)', 9700.0000, 9700.0000
);

-- Lines: Dr 1200 Inventory ($9,700), Cr 2020 GRNI ($7,000), Cr 1215 Landed Cost Clearing ($2,700)
INSERT INTO `journal_lines` (`id`, `journal_entry_id`, `account_id`, `debit`, `credit`, `base_debit`, `base_credit`, `memo`) VALUES
(UUID(), 'je-ship-001', (SELECT `id` FROM `chart_of_accounts` WHERE `code` = '1200' AND `business_id` = 'bus-loops-001'), 9700.0000, 0.0000, 9700.0000, 0.0000, 'Capitalized true landed inventory asset'),
(UUID(), 'je-ship-001', (SELECT `id` FROM `chart_of_accounts` WHERE `code` = '2020' AND `business_id` = 'bus-loops-001'), 0.0000, 7000.0000, 0.0000, 7000.0000, 'Cleared goods receipt factory bill obligation'),
(UUID(), 'je-ship-001', (SELECT `id` FROM `chart_of_accounts` WHERE `code` = '1215' AND `business_id` = 'bus-loops-001'), 0.0000, 2700.0000, 0.0000, 2700.0000, 'Cleared allocated import overhead clearing');

-- Update Account Balance Cache
UPDATE `chart_of_accounts` SET `current_balance` = 50000.0000 WHERE `code` = '1020' AND `business_id` = 'bus-loops-001';
UPDATE `chart_of_accounts` SET `current_balance` = 9700.0000 WHERE `code` = '1200' AND `business_id` = 'bus-loops-001';
UPDATE `chart_of_accounts` SET `current_balance` = 50000.0000 WHERE `code` = '3010' AND `business_id` = 'bus-loops-001';

