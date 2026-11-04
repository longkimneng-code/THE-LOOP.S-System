# 📊 Loops Finance V3 — Accounting & Financial Management OS

> **Platform:** Universal Retail & Import Business Financial Control Tower  
> **Based on:** [`Loops Finance V3 – Corrected Specification.md`](./Loops%20Finance%20V3%20–%20Corrected%20Specification.md)  
> **Design Architecture:** High-contrast luxury obsidian & porcelain light aesthetic per [`design_system_skill.md`](./design_system_skill.md) & [`Pro_max_skill_Ui.md`](./Pro_max_skill_Ui.md)  
> **Database:** Production MySQL 8.0 DDL [`schema.sql`](./schema.sql) with exact `DECIMAL(19,4)` currency precision  

---

## 🌟 Key Features

1. **Simple Mode vs Accountant Mode Toggle (Top Bar):**
   - **Simple Mode (Shop Owner View):** Plain-language labels ("Cash Now", "Bills to Pay", "Customers Owe You", "True Cost per Item"), guided forms, and zero confusing debits/credits.
   - **Accountant Mode (Auditor View):** Full double-entry general ledger, account codes (`1010`, `1200`, `2010`, `3010`, `5010`), debit/credit journal lines, and balancing verification badges.

2. **Core 6-Area Navigation:**
   - 📊 **Home:** 5 KPI cards (Cash Now, Customers Owe You, You Owe, Stock Value, Profit This Month), Composite Financial Health Score (0–100) across 6 weighted factors, Needs Attention alerts, 30-day cash outlook, and Cash Runway indicator.
   - 👥 **Sales & Customers:** POS sales capture, customer invoices, customer deposits (Account `2080`), and receivables aging.
   - 🧾 **Bills & Suppliers:** Supplier bills, 30/70 advance deposit schedules, operating expenses (OPEX), recurring bills, and payables aging.
   - 🚢 **Imports (Landed Cost Engine):**
     - True Landed Cost per SKU variant.
     - Distribution of international freight, customs duties, port clearance, brokerage, and inland trucking across 4 methods: **By Weight (kg)**, **By Value (Ad Valorem)**, **By Volume (CBM)**, or **By Quantity**.
     - Verified V3 Worked Example included:
       - **Product A (Watch):** Base $10.00 $\rightarrow$ True Landed **$11.77** ($11.7686)
       - **Product B (Duffle):** Base $2.00 $\rightarrow$ True Landed **$3.82** ($3.8157)
     - One-click "Finalize Landed Cost & Post to General Ledger" (`Dr 1200 Inventory`, `Cr 2020 GRNI`, `Cr 1215 Landed Cost Clearing`).
   - 📈 **Reports:**
     - Interactive **Profit & Loss (P&L)** with V3 hierarchy: $\text{Gross Revenue} \rightarrow \text{Net Revenue} \rightarrow \text{Landed COGS} \rightarrow \text{Gross Profit} \rightarrow \text{Contribution Margin} \rightarrow \text{EBITDA} \rightarrow \text{EBIT} \rightarrow \text{Net Profit}$.
     - **Balance Sheet:** Real-time equation check: $\text{Assets} \equiv \text{Liabilities} + \text{Equity}$.
     - **Startup Budget & CAPEX/OPEX Tracker:** Pre-launch capital expenditure tracking (Store fit-out, POS hardware, lease security deposits) vs operational reserves with visual variance progress bars.
     - **Margin & Price Simulator:** Real-time what-if calculator comparing Gross Margin % vs Markup %.
   - ⚙️ **Accounting & Settings:**
     - **Capital Ledger:** Founder capital injections, partner equity % splits, drawings (Account `3030`), dividends (`3040`), and retained earnings.
     - **General Ledger:** Immutable balanced journal entries with "Reverse and Correct" wizard.
     - **Chart of Accounts:** Complete 65 standard accounts from Section 5 of specification.
     - **Stock Loops Integration Monitor:** Real-time bridge status with [`Stock_management_loops`](../Stock_management_loops).

---

## 🗄️ MySQL Database Setup (`schema.sql`)

The database architecture has been configured for **MySQL 8.0+** using `schema.sql`:

```bash
# 1. Import schema.sql into your local MySQL server
mysql -u root -p < schema.sql

# 2. Configure credentials in backend/.env:
# MYSQL_HOST=localhost
# MYSQL_PORT=3306
# MYSQL_USER=root
# MYSQL_PASSWORD=your_password
# MYSQL_DATABASE=loops_finance
```

> **Resilient Fallback Mode:** If MySQL credentials are not yet configured or the MySQL service is offline, Loops Finance automatically operates in a resilient local ACID state mode with full seed data, so you can test all screens and calculations immediately without errors.

---

## 🚀 Running the Platform

### Option A: Run Both (Separate Terminals)
```bash
# Terminal 1 — Backend API Server (Port 3001)
npm run dev:backend

# Terminal 2 — Frontend Dev Server (Port 5174)
npm run dev:frontend
```

### Option B: Build for Production
```bash
npm run build:frontend
```

---

## 📐 Landed Cost Math Verification

Formula:
$$\text{Allocated Overhead}_i = \text{Overhead Pool} \times \frac{\text{Basis}_i}{\sum \text{Basis}}$$

$$\text{Unit Landed Cost}_i = \frac{\text{Factory Base Cost}_i + \sum \text{Allocated Overheads}_i}{\text{Quantity}_i}$$

*Rounding remainder is automatically assigned to the largest line item to ensure total allocated cost matches total incurred expenses to the exact cent.*

