# Loops Finance V3 – Corrected Specification

Nov 1, 2026 · @kimneng

## My take

V2 has the right accounting core but is built for an accountant, not for a shop owner who opens it every day. Keep the ledger design; change how people reach it.

**What is good and stays:** ledger-first design, immutable posted journals with reversals, idempotent events, landed cost as a main feature, decimal-only money, and clear ownership between Stock Loops and Finance. I re-ran the worked landed-cost example and it is correct (Product A $11.77, Product B $3.82 per unit).

**The three biggest problems:**

1. **No MVP.** Twelve modules and nine phases means nothing ships for a long time. The first release should be: record money in and out, run the ledger, cost one shipment, see profit and cash.
2. **Accountant-first UX.** Twelve menu items, debits and credits, and terms like GRNI and CCC on the main screens. An owner needs plain words, guided forms and a simple home screen. The ledger stays underneath.
3. **Gaps and wrong calls for a real accounting system.** Missing: opening balances, manual and recurring journals, accruals and prepayments, document numbering, customer deposits, loans, payroll journals, year-end close steps. Wrong or risky: Stock Loops sending "supplier deposit paid" events (Finance should own payments), SQLite for money, EBITDA shown as "operating profit", and a chart of accounts with holes.

## What I corrected

Fourteen changes from V2, each applied in the sections below.

| # | Problem in V2 | Why it matters | Fix in V3 |
| --- | --- | --- | --- |
| 1 | 12 modules, 9 phases, no MVP | Nothing ships for months | MVP first, then releases (see Roadmap) |
| 2 | 12 menu items, accounting terms everywhere | Owners get lost | 6 owner areas, Simple mode and Accountant mode (see UX design) |
| 3 | Stock Loops sends supplier deposit and payment events | Two systems touch cash | Finance owns all payments and banking; Stock Loops only sees status (see Stock Management Loops integration) |
| 4 | COGS source not defined | Two apps could show different costs | Stock Loops sends quantities only; Finance computes cost (see Landed cost and inventory valuation) |
| 5 | No inventory valuation method chosen | COGS cannot be calculated | Weighted average per SKU by default, FIFO as a later option |
| 6 | SQLite for local development | Prisma on SQLite does not keep exact decimals | PostgreSQL in every environment |
| 7 | Next.js 14 pinned | Outdated | Use the current stable Next.js release |
| 8 | Dashboard shows "Operating profit / EBITDA" as one KPI | They are different numbers | Show EBITDA, depreciation and operating profit separately |
| 9 | Chart of accounts has holes | Cannot post customer deposits, accruals, customs payable, shrinkage, rounding | Expanded starter chart (see Chart of accounts) |
| 10 | FX gain and loss in different ranges, no unrealized FX | Period-end revaluation cannot post | Realized and unrealized FX accounts side by side |
| 11 | No opening balances or data migration | Existing businesses cannot start | Opening balance wizard (see Accounting system requirements) |
| 12 | No manual, recurring or adjusting journals; no accruals, prepayments or document numbering | Accountants cannot correct or close the books | Added to the requirements checklist |
| 13 | Customer deposits, gift cards, store credit, loans, payroll not covered | Real liabilities with no account | Added accounts and posting rules |
| 14 | Post-sale landed-cost adjustment not defined | Final cost arrives after goods are sold | Clear split rule between remaining stock and COGS (see Landed cost and inventory valuation) |

## Product summary and principles

Loops Finance is the accounting system and money dashboard for businesses that import, stock and sell products. It answers six owner questions: how much cash do I have, what is my stock worth, what did each product really cost, am I making profit, what do I owe, and can I afford the next shipment.

**Ownership:**

- **Stock Management Loops** owns products, SKUs, purchase orders, physical quantities, warehouse work and sales capture.
- **Loops Finance** owns the ledger, payments, banking, AP, AR, capital, landed cost, inventory value, tax and reports.

**Principles:**

1. The ledger is the single source of financial truth.
2. Posted entries never change; mistakes are fixed by reversal and replacement.
3. Every number can be clicked through to its entries and source documents.
4. Owners see plain words; accountants can switch to full debit and credit detail.
5. The app suggests and pre-fills; people confirm. No silent auto-posting of anything unusual.
6. Estimates and actuals are shown side by side and labelled.
7. Forecasts and AI answers are never presented as posted facts.
8. Every business is isolated from every other business at the database level.

## UX design: easy for owners, complete for accountants

The same ledger serves two views. **Simple mode** (default for owners) uses plain words, guided forms and no debits or credits. **Accountant mode** shows journals, account codes and ledger detail on every record. A toggle in the top bar switches, and each user's choice is remembered.

### Navigation: 6 areas instead of 12

| Area | What the owner does here | Includes |
| --- | --- | --- |
| Home | See cash, profit, what needs attention | Dashboard, alerts, health score |
| Sales and Customers | Record sales, invoice customers, collect money | Invoices, receipts, credit notes, customer deposits, AR aging |
| Bills and Suppliers | Enter bills, pay suppliers, track advances | Supplier bills, payments, advances, expenses, recurring bills, AP aging |
| Imports | Cost a shipment and see true cost per item | Shipments, overhead bills, estimate vs actual, landed cost |
| Reports | Read profit, cash and stock value | P&L, balance sheet, cash flow, product profit, forecast, budgets |
| Accounting and Settings | Accountant work and setup | Journals, chart of accounts, banking, tax, fixed assets, periods, users, integrations, audit |

Contextual tabs sit inside each area (for example Shipments: Overview, Items, Costs, Documents, Journal). Permissions hide areas a user cannot use.

### One "+ New" button everywhere

Record a sale or customer payment · Enter a supplier bill · Pay a supplier · Add an expense · Add capital or record a withdrawal · Move money between accounts · New shipment · Journal entry (Accountant mode only).

### Home screen

Five cards: **Cash now**, **Customers owe you**, **You owe**, **Stock value** (including stock on the way), **Profit this month**. Below them: a **Needs attention** list (overdue bills, cash below safe level, unmatched bank lines, failed integration events, shipments missing final bills) and a 30-day cash outlook. Every card opens its supporting report.

### Plain words for owners

| Accounting term | Simple mode label |
| --- | --- |
| Accounts Payable | Bills to pay |
| Accounts Receivable | Customers owe you |
| Supplier Advances | Paid to suppliers in advance |
| Goods Received Not Invoiced | Stock received, bill not yet arrived |
| Goods in Transit | Stock on the way |
| Landed cost | True cost per item |
| Cost of Goods Sold | Cost of what you sold |
| Owner Drawings | Money you took out |
| Net working capital | Cash and stock minus short-term bills |
| Cash conversion cycle | Days your cash is tied up |

### Screen rules

1. **Guided forms with smart defaults.** Date, currency, tax code, account and payment method are pre-filled from the supplier, customer or last use.
2. **Plain-language preview before posting.** Example: "This will add $7,000 to stock on the way and record $7,000 owed to Supplier X." Accountant mode adds the journal lines.
3. **Clear status on every record:** Draft, Awaiting approval, Posted, Reversed. Only Draft can be edited; Posted is fixed.
4. **Fix mistakes with "Reverse and correct"**, which asks for a reason and creates the reversal and a pre-filled replacement. Nobody has to learn journal reversal.
5. **Errors say how to fix them.** Not "journal unbalanced" but "Allocation is $0.02 short; assign it to the largest line?"
6. **Click-through everywhere.** Any total opens its lines; any line opens its document and journal.
7. **Fast capture.** Mobile photo of a receipt creates a draft expense; CSV import with a preview and error list for bills, customers, products and bank lines; global search by amount, name, reference or document number.
8. **Empty states teach.** A new area shows one sentence on what it is for and one button for the first action.
9. **Saved filters and views** on every table; export any table to CSV or Excel.
10. **Accessible and localized:** keyboard navigation, readable contrast, business-level language, date and number formats, and currency symbols.

### First-run setup (about 10 minutes)

1. Business details: name, country, base currency, fiscal year start.
2. Tax setup: tax registered or not, default rates.
3. Starter chart of accounts (editable template).
4. Opening balances: cash and bank, stock, money owed to you, money you owe, capital, loans.
5. Connect Stock Management Loops and map suppliers and products.
6. Invite users and assign roles.

The app shows a checklist on Home until all six steps are done.

### Roles

| Role | Can do |
| --- | --- |
| Owner | Everything, including period close and user management |
| Accountant | Journals, reconciliation, tax, period close, reports |
| Manager | Approve bills, payments and budgets; view reports |
| Staff | Enter drafts (expenses, bills, invoices); cannot approve or post |
| Viewer or Auditor | Read-only access to reports, ledger and documents |

## Accounting system requirements (complete checklist)

This is everything a full accounting system needs, with the release each item belongs to. V2 covered most of the accounting core; the rows marked **New** were missing.

| Area | Requirement | Release |
| --- | --- | --- |
| Setup | Base currency, fiscal year start, accounting basis (accrual by default). Base currency locks after the first posting. | MVP |
| Setup | **New:** Opening balance wizard that posts one balanced opening journal, with balances per currency | MVP |
| Setup | Chart of accounts from country templates: parent-child accounts, active or inactive, protected system accounts, normal balance by type | MVP |
| Setup | **New:** Gapless document numbering per business, document type and fiscal year, with prefixes (invoice, bill, receipt, voucher, credit note, journal) | MVP |
| Setup | Dimensions on every line: branch, channel, department. Built into the schema from day one, reported later. | Release 3 |
| Ledger | Journal engine: balanced, same-business accounts, period lock, immutable once posted, source reference, idempotency key, database transaction | MVP |
| Ledger | **New:** Manual journals with narrative, attachment and approval; adjusting and reversing journals | MVP |
| Ledger | **New:** Recurring journals (rent, depreciation, prepayment release) with review before posting | Release 2 |
| Ledger | Reverse and correct with reason; reversal links to the original | MVP |
| Ledger | **New:** Suspense and rounding accounts that raise an alert when they hold a balance | MVP |
| Ledger | General ledger, account activity and trial balance with drill-down to source documents | MVP |
| Payables | Supplier bills, supplier credit notes, payments, allocation to bills, advances, aging, supplier statements | MVP |
| Payables | Payment vouchers with proof of payment; batch payment runs | Release 2 |
| Receivables | Invoices, receipts, partial payments, credit notes, aging, customer statements | MVP |
| Receivables | **New:** Customer deposits, store credit, gift cards, bad-debt write-off | Release 2 |
| Cash | Cash, bank and payment-gateway accounts; transfers between accounts; petty cash | MVP |
| Cash | Bank statement CSV import, matching, reconciliation sign-off and history | Release 2 |
| Inventory | Weighted-average cost per SKU, landed cost, goods in transit, GRNI, write-offs, adjustments | MVP |
| Inventory | Reconciliation of Finance stock value with Stock Loops quantities and the ledger | MVP |
| Inventory | FIFO cost layers as an option | Release 3 |
| Multi-currency | Transaction-date rates, fixed rates, rate history, realized FX on payment | MVP |
| Multi-currency | **New:** Period-end revaluation with unrealized FX gain or loss that reverses next period | Release 2 |
| Tax | Tax codes and rates, input and output tax, tax payable and receivable accounts, recoverable or non-recoverable flag per line | MVP |
| Tax | Tax period reports and filing summary; withholding tax | Release 2 |
| Equity | Capital contributions, drawings, dividends, shareholder percentages, retained earnings transfer | MVP |
| Financing | **New:** Loans with principal, interest and repayment schedule | Release 2 |
| Payroll | **New:** Payroll journal import (wages, deductions, employer cost, payroll liabilities). No payroll calculation engine. | Release 2 |
| Period-end | **New:** Accruals and prepayments with monthly release schedule | Release 2 |
| Period-end | Fixed asset register, depreciation schedule and monthly journals, disposal, net book value | Release 2 |
| Period-end | **New:** Close checklist (subledgers reconciled, trial balance verified, bank reconciled), period lock, controlled reopen, year-end close | Release 2 |
| Reports | P&L, balance sheet, trial balance, general ledger, AP and AR aging, inventory valuation | MVP |
| Reports | Cash flow statement (indirect), budget versus actual, product and shipment profit, period comparison | Release 2 |
| Reports | Every export marked Draft, Provisional or Final, with period, currency and preparation date | MVP |
| Control | Audit log of who did what and when; documents attached to records; creator cannot approve their own entry | MVP |
| Control | **New:** Approval thresholds by amount and document type | Release 2 |
| Control | **New:** Data export, backup and restore, and a configurable record-retention period | MVP |
| Planning | Budgets, CAPEX and OPEX plan, cash forecast, runway, scenarios | Release 2 and 3 |

## Chart of accounts (corrected starter)

V2 listed 33 accounts; this starter has 65, because V2 could not post customer deposits, accruals, customs payables, shrinkage, payment fees or rounding. Accounts marked **System** are protected: posting rules depend on them and they cannot be deleted or retyped. Everything else is editable per business and country.

| Code | Account | Type | Normal side | Note |
| --- | --- | --- | --- | --- |
| 1010 | Cash on Hand | Asset | Debit |  |
| 1015 | Petty Cash | Asset | Debit | New |
| 1020 | Bank Accounts (one sub-account per bank) | Asset | Debit |  |
| 1030 | Payment Gateway Clearing | Asset | Debit | System |
| 1100 | Accounts Receivable | Asset | Debit | System |
| 1110 | Allowance for Doubtful Accounts | Contra-asset | Credit | New |
| 1150 | Supplier Advances | Asset | Debit | System |
| 1160 | Staff Advances and Other Receivables | Asset | Debit | New |
| 1200 | Inventory | Asset | Debit | System |
| 1205 | Inventory Reserve (obsolescence) | Contra-asset | Credit | New |
| 1210 | Goods in Transit | Asset | Debit | System |
| 1215 | Landed Cost Clearing | Asset | Debit | New, System |
| 1220 | Input VAT Receivable | Asset | Debit |  |
| 1225 | Import VAT Receivable | Asset | Debit | New |
| 1300 | Prepaid Expenses | Asset | Debit |  |
| 1310 | Deposits Paid (refundable lease and utility) | Asset | Debit | New |
| 1500 | Property and Equipment | Asset | Debit |  |
| 1590 | Accumulated Depreciation | Contra-asset | Credit |  |
| 1999 | Suspense (must be zero at close) | Clearing | Either | New, System |
| 2010 | Accounts Payable | Liability | Credit | System |
| 2020 | Goods Received Not Invoiced | Liability | Credit | System |
| 2030 | Output VAT Payable | Liability | Credit |  |
| 2040 | Withholding Tax Payable | Liability | Credit | New |
| 2050 | Customs Duty and Import Taxes Payable | Liability | Credit | New |
| 2060 | Accrued Expenses | Liability | Credit | New, System |
| 2070 | Payroll Liabilities | Liability | Credit | New |
| 2080 | Customer Deposits and Store Credit | Liability | Credit | New |
| 2085 | Gift Card Liability | Liability | Credit | New |
| 2090 | Refunds Payable | Liability | Credit | New |
| 2095 | Income Tax Payable | Liability | Credit | New |
| 2100 | Loans Payable, current | Liability | Credit |  |
| 2150 | Loans Payable, long-term | Liability | Credit | New |
| 2160 | Accrued Interest Payable | Liability | Credit | New |
| 3010 | Owner Capital | Equity | Credit | System |
| 3020 | Additional Paid-in Capital | Equity | Credit |  |
| 3030 | Owner Drawings | Contra-equity | Debit | System |
| 3040 | Dividends Declared | Contra-equity | Debit | New |
| 3050 | Opening Balance Equity (must be zero after setup) | Equity | Credit | New, System |
| 3100 | Retained Earnings | Equity | Credit | System |
| 3200 | Current Year Earnings (calculated, not posted to) | Equity | Credit | New, System |
| 4010 | Sales Revenue | Revenue | Credit | System |
| 4015 | Shipping Income | Revenue | Credit | New |
| 4020 | Sales Returns and Allowances | Contra-revenue | Debit |  |
| 4030 | Discounts | Contra-revenue | Debit |  |
| 5010 | Landed Cost of Goods Sold | COGS | Debit | System |
| 5020 | Damaged Inventory Write-off | COGS | Debit |  |
| 5030 | Inventory Adjustments and Shrinkage | COGS | Debit | New |
| 5040 | Landed Cost Variance on Sold Units | COGS | Debit | New, System |
| 6010 | Direct Selling Costs | Operating expense | Debit |  |
| 6015 | Payment Gateway Fees | Operating expense | Debit | New |
| 6020 | Marketing and Advertising | Operating expense | Debit |  |
| 6030 | Rent and Utilities | Operating expense | Debit |  |
| 6040 | Payroll | Operating expense | Debit |  |
| 6050 | Administration and Software | Operating expense | Debit |  |
| 6055 | Professional Fees | Operating expense | Debit | New |
| 6060 | Depreciation and Amortization | Operating expense | Debit | System |
| 6070 | Bank Charges | Operating expense | Debit | New |
| 6080 | Bad Debt Expense | Operating expense | Debit | New |
| 6090 | Rounding Differences | Operating expense | Either | New, System |
| 7010 | Interest Expense | Non-operating | Debit |  |
| 7020 | Realized FX Gain or Loss | Non-operating | Either | System |
| 7030 | Unrealized FX Gain or Loss | Non-operating | Either | New, System |
| 8010 | Interest Income | Other income | Credit | New |
| 8090 | Other Income | Other income | Credit |  |
| 9010 | Income Tax Expense | Tax | Debit | New |

## Posting rules

Each business event creates one balanced journal. Owners see the plain-language preview; accountants see these lines. Account codes refer to the chart above.

| Event | Debit | Credit | Rule |
| --- | --- | --- | --- |
| Opening balances | Assets | Liabilities, plus 3050 for the difference | 3050 must be zero once setup is complete |
| Owner puts in capital | Bank | 3010 Owner Capital | Equity, never revenue |
| Owner withdraws money | 3030 Owner Drawings | Bank | Not an expense |
| Supplier deposit paid | 1150 Supplier Advances | Bank | Asset until applied |
| Goods received, bill not yet in | 1200 Inventory, or 1210 Goods in Transit before ownership passes | 2020 GRNI | Timing follows the shipping terms set on the shipment |
| Supplier bill entered | 2020 GRNI (price difference to 1200) | 2010 Accounts Payable | Clears GRNI |
| Apply advance to bill | 2010 Accounts Payable | 1150 Supplier Advances | Partial application allowed |
| Pay supplier | 2010 Accounts Payable | Bank | Foreign-currency difference goes to 7020 |
| Import overhead bill, capitalizable | 1215 Landed Cost Clearing; recoverable tax to 1225 | 2010 Accounts Payable or Bank | Each overhead line is flagged capitalizable or not |
| Import overhead bill, not capitalizable | Expense account | 2010 Accounts Payable or Bank | For example storage after release |
| Landed cost allocated to stock | 1200 Inventory | 1215 Landed Cost Clearing | 1215 must be zero when the shipment is finalized |
| Sale | Bank, 1030 or 1100 | 4010 Sales Revenue; 2030 Output VAT | Discount to 4030; shipping charged to 4015 |
| Cost of sale | 5010 Landed COGS | 1200 Inventory | Computed by Finance at weighted-average cost |
| Gateway fee | 6015 Payment Gateway Fees | 1030 Gateway Clearing | Bank receives net payout |
| Refund to customer | 4020 Returns; 2030 Output VAT | Bank or 2090 Refunds Payable | Stock restored only after receipt and inspection (Dr 1200, Cr 5010) |
| Damaged or lost stock | 5020 or 5030 | 1200 Inventory | Needs approval above a set amount |
| Customer deposit received | Bank | 2080 Customer Deposits | Applied to the invoice later (Dr 2080, Cr 1100) |
| Expense bill | Expense account; input tax to 1220 | 2010 Accounts Payable | Paid later: Dr 2010, Cr Bank |
| Expense paid in advance | 1300 Prepaid Expenses | Bank | Released monthly to the expense account |
| Expense incurred, not yet billed | Expense account | 2060 Accrued Expenses | Reverses automatically at the start of next period |
| Depreciation | 6060 | 1590 Accumulated Depreciation | Monthly, from the asset schedule |
| Payroll | 6040 Payroll | 2070 Payroll Liabilities; Bank | Imported summary, not calculated here |
| Loan received | Bank | 2100 or 2150 | Repayment: Dr loan, Dr 7010 interest, Cr Bank |
| Bad debt write-off | 1110 Allowance (or 6080 if no allowance) | 1100 Accounts Receivable | Needs approval |
| Foreign-currency revaluation | Open foreign balances | 7030 Unrealized FX | Auto-reverses next period; history rates are never changed |
| Year-end close | Revenue and expense accounts | 3100 Retained Earnings | Only after the period is locked by an authorized user |

## Landed cost and inventory valuation

Finance computes inventory cost and COGS itself, using **weighted-average cost per SKU** by default. Stock Loops sends quantities only, never costs. FIFO layers can be added later without changing the ledger.

### Overhead lines

Each overhead bill line carries: amount and currency, exchange rate and its source, **capitalizable** (yes or no), **recoverable tax** (yes or no), and an allocation basis. Recoverable tax goes to a receivable account, not into stock cost. Non-capitalizable costs go to expense.

The app suggests a default basis so the user rarely has to choose:

| Cost | Suggested basis |
| --- | --- |
| Sea or air freight | Weight (or volume if the carrier charges by CBM) |
| Cargo insurance | Value |
| Customs duty | Customs value |
| Port and clearance, brokerage | Value |
| Local trucking | Weight or volume |
| Packaging and tagging | Quantity |
| Anything else | Manual |

### Allocation rule

```latex
Allocation_i = OverheadPool \times \frac{Basis_i}{\sum_j Basis_j}
```

Basis is value, weight, volume or quantity. Manual allocation must sum exactly to the pool.

**Controls:**

1. The total basis must be greater than zero, and every line needs the data for its chosen basis. If weight is missing, the app offers value or quantity instead.
2. Calculate with unrounded decimals, then round to the currency's decimals only when posting.
3. Put any rounding remainder on the largest eligible line, so allocations always equal the pool exactly.
4. Post inventory value from the **line total**, not from rounded unit cost times quantity. Unit cost is stored to 4 decimals.
5. Save the inputs, method and result of every allocation for audit.

### Worked example (checked)

Allocation by weight for freight and trucking, by value for duty and clearance. Amounts in USD at posting precision.

| Item | Qty | Goods | Freight | Duty | Clearance | Trucking | Landed total | Unit cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Product A | 500 | 5,000.00 | 150.00 | 500.00 | 214.29 | 20.00 | 5,884.29 | 11.7686 |
| Product B | 1,000 | 2,000.00 | 1,350.00 | 200.00 | 85.71 | 180.00 | 3,815.71 | 3.8157 |
| Total | 1,500 | 7,000.00 | 1,500.00 | 700.00 | 300.00 | 200.00 | 9,700.00 |  |

Displayed to cents, unit cost is $11.77 for A and $3.82 for B, matching V2. The ledger holds $9,700.00, which is $7,000 goods plus $2,700 overheads, with nothing lost to rounding.

### Shipment stages

1. **Estimate:** items, quantities, foreign prices, weights, volumes, rate, estimated overheads. Provisional cost is shown.
2. **Received:** actual quantities counted by Stock Loops. Stock is valued at provisional cost.
3. **Actual bills:** supplier, freight, customs and trucking bills are attached and allocated.
4. **Compare:** estimate, actual and difference per cost type and per SKU, with the reason for large overruns.
5. **Final:** cost is locked. Finance posts adjustment journals.
6. **Reconciled:** quantities and value agree with Stock Loops.

Prior estimates and adjustments stay in the shipment history. A finalized shipment is never edited; a later correction is a new adjustment version.

### When final cost arrives after some units are sold

The difference is split in proportion to units. Units from the shipment still in stock take their share into inventory value (Dr or Cr 1200). Units already sold take their share to 5040 Landed Cost Variance. Units still in stock are estimated as the lower of the quantity on hand and the quantity received. This is a policy choice for your accountant to confirm (see decisions at the end).

## Modules in V3

The 12 V2 modules keep their content but live inside the 6 navigation areas. Changes are listed.

| V2 module | Where it lives | What changed |
| --- | --- | --- |
| 1 Executive command center | Home | EBITDA, depreciation and operating profit are separate KPIs. Health score (0 to 100) shows each factor's value, target and weight: liquidity, profitability, stock turnover, obligations, expense trend, runway. |
| 2 Capital and equity | Accounting and Settings, plus the "+ New" button | Capital in, withdrawals, dividends, shareholder percentages and the retained-earnings transfer stay. Dividends use account 3040. |
| 3 Startup budget, CAPEX and OPEX | Reports, Budgets | The app suggests CAPEX, OPEX or deposit from the item type, and the accountant confirms. Shows budgeted, committed, paid and actual. Budget changes go through approval. |
| 4 Import and landed cost | Imports | Suggested allocation bases, capitalizable and recoverable flags, six clear stages (previous section). |
| 5 Sales, returns and COGS | Sales and Customers | Finance computes COGS itself from weighted-average cost. Refunded stock returns to inventory only after inspection. |
| 6 Expenses and supplier bills | Bills and Suppliers | Photo capture, recurring bills that wait for review, accruals and prepayments added. |
| 7 Accounts payable and advances | Bills and Suppliers | Finance owns all payments. Deposit schedules such as 30/70 create the payment plan and alerts. |
| 8 Accounts receivable | Sales and Customers | Customer deposits, store credit and bad-debt write-off added. |
| 9 Product profitability | Reports, Products | Price what-if simulator never touches live prices. Advertising per SKU is labelled "estimate" unless the ad platform supplies SKU data. |
| 10 Working capital | Home card and Reports | Calculation period and method are always shown. |
| 11 Cash flow, forecast, runway | Reports, Cash | 7, 30, 60, 90-day and custom forecast with a configurable minimum safe cash. |
| 12 Statements and reports | Reports | Draft, Provisional or Final label on every export. |

### Corrected formula rules

```latex
\begin{aligned}
\text{Net Revenue} &= \text{Gross Revenue} - \text{Discounts} - \text{Returns} \\
\text{Gross Profit} &= \text{Net Revenue} - \text{Landed COGS} \\
\text{Contribution Profit} &= \text{Gross Profit} - \text{Variable Selling Costs} - \text{Attributable Marketing} \\
\text{EBITDA} &= \text{Contribution Profit} - \text{Fixed Operating Expenses} \\
\text{EBIT (Operating Profit)} &= \text{EBITDA} - \text{Depreciation} - \text{Amortization} \\
\text{Net Profit} &= \text{EBIT} + \text{Other Income} - \text{Interest and Other Non-operating Costs} - \text{Income Tax}
\end{aligned}
```

```latex
\begin{aligned}
\text{Gross Margin \%} &= \frac{\text{Price} - \text{Unit Landed Cost}}{\text{Price}} \times 100 \\
\text{Markup \%} &= \frac{\text{Price} - \text{Unit Landed Cost}}{\text{Unit Landed Cost}} \times 100 \\
\text{CCC} &= \text{DIO} + \text{DSO} - \text{DPO}
\end{aligned}
```

- DIO = average inventory ÷ COGS × days in the period. DSO = average receivables ÷ credit sales × days. DPO = average payables ÷ purchases (or COGS, as configured) × days.
- If a denominator is zero or negative, show "Not available" with the reason, never a misleading percentage.
- **Runway:** use forecast cash flows when they exist. If operating cash flow is zero or positive, show "Not burning cash" instead of a negative runway. A simple historical burn rate is shown only as a labelled estimate.

## Stock Management Loops integration

V2 let Stock Loops report supplier deposits and invoices, which gives two systems control of cash. V3 fixes ownership so each fact has exactly one writer.

| Data | Owner | The other app |
| --- | --- | --- |
| Products, SKUs, barcodes, selling prices | Stock Loops | Finance keeps a read-only copy (SKU ID, name, category) |
| Physical quantities and locations | Stock Loops | Finance reconciles to them, never edits them |
| Purchase orders | Stock Loops | Finance records the commitment and links bills and shipments to it |
| Sales capture (POS, online, wholesale) | Stock Loops | Finance posts revenue, tax and payment accounting |
| Suppliers and customers | Shared ID, one record each | Stock Loops owns contact and purchasing data; Finance owns credit terms, bank details and balances |
| Cost, inventory value and COGS | Finance | Stock Loops shows cost read-only from Finance |
| Payments, bank and cash | Finance only | Stock Loops sees payment status |

### Event catalogue (corrected)

| Direction | Event | Finance action |
| --- | --- | --- |
| Stock to Finance | `PURCHASE_ORDER_APPROVED` | Record commitment and expected payment plan. No journal. |
| Stock to Finance | `GOODS_RECEIVED` | Post inventory or goods in transit against GRNI, per the shipping terms |
| Stock to Finance | `SHIPMENT_CONTENT_UPDATED` | Update received quantities, weights and volumes; recalculate provisional cost |
| Stock to Finance | `SALE_COMPLETED` | Post revenue, tax and payment clearing; Finance computes and posts COGS |
| Stock to Finance | `SALE_REFUNDED` | Post refund, revenue and tax reversal. No stock value change yet. |
| Stock to Finance | `RETURN_INSPECTED` | Resellable: restore inventory. Not resellable: write off. |
| Stock to Finance | `STOCK_DAMAGED` | Write-off, with approval above a set amount |
| Stock to Finance | `STOCK_ADJUSTED` | Approved valuation adjustment |
| Stock to Finance | `STOCK_TRANSFERRED` | Reconcile location values when location accounting is on |
| Finance to Stock | `SUPPLIER_BILL_POSTED` | Tell Stock Loops the PO now has a bill |
| Finance to Stock | `PAYMENT_STATUS_CHANGED` | Unpaid, partly paid or paid, per PO |
| Finance to Stock | `SHIPMENT_COST_FINALIZED` | Publish final unit landed cost per SKU, read-only |
| Finance to Stock | `INVENTORY_VALUE_SNAPSHOT` | Daily value per SKU for reconciliation |

**Removed from V2:** `SUPPLIER_DEPOSIT_PAID` and `SUPPLIER_INVOICE_RECORDED` as Stock Loops events (Finance records both itself), and `SHIPMENT_COST_UPDATED` as a Stock Loops event (landed cost is a Finance function).

### Event rules

- Every event carries: unique event ID, business ID, source system, event type and schema version, source transaction ID, event time, effective accounting date, currency and amounts, SKU or variant references, and a checksum.
- Sender uses a transactional outbox; Finance uses an idempotent inbox. A repeated event ID never creates a second journal.
- Invalid events are rejected with a reason. Failed events retry automatically, then go to a dead-letter queue.
- The integration monitor shows queue, failures and replay buttons. Failures also appear in Home, Needs attention.
- A daily reconciliation report compares Stock Loops quantities and Finance valuation with the Inventory account, and lists every difference by SKU.

## Data model

All V2 models stay. **Bold** models are new in V3.

| Domain | Models |
| --- | --- |
| Business and access | Business, BusinessUser, Role, Permission, UserRole, BusinessSettings, FiscalYear, AccountingPeriod, **NumberSequence**, **UserPreference** |
| Dimensions | **Dimension** (branch, channel, department), **DimensionValue** |
| Currency and tax | Currency, ExchangeRate, TaxCode, TaxRate, TaxRecord, TaxPeriod |
| Ledger | Account, JournalEntry, JournalLine, JournalSource, JournalReversal, **RecurringJournal**, **OpeningBalanceBatch**, PeriodClose, **PeriodCloseChecklistItem** |
| Capital and budget | CapitalAccount, CapitalTransaction, Shareholder, StartupBudget, StartupBudgetItem, BudgetActual, BudgetApproval, **Loan**, **LoanSchedule** |
| Import and inventory | ImportShipment, ImportShipmentItem, ShipmentOverhead, ShipmentCostAllocation, **ShipmentVersion**, GoodsReceivedNote, GoodsReceivedNoteLine, SupplierAdvance, InventoryValuation, InventoryValuationAdjustment, InventoryReconciliation, **InventoryCostBalance**, **InventoryCostMovement** |
| Payables, receivables, payments | Supplier, SupplierBill, SupplierBillLine, **SupplierCreditNote**, Payment, PaymentAllocation, Expense, RecurringExpenseRule, **Accrual**, **PrepaymentSchedule**, Customer, CustomerInvoice, CustomerInvoiceLine, CustomerReceipt, CreditNote, **CustomerDeposit**, **GiftCard**, **WriteOff** |
| Banking and assets | BankAccount, BankStatement, BankStatementLine, BankReconciliation, BankReconciliationMatch, FixedAsset, DepreciationSchedule, DepreciationEntry, AssetDisposal |
| Payroll | **PayrollJournalImport** |
| Audit and integration | Document, AuditLog, IntegrationConnection, IntegrationEvent, WebhookDelivery, IdempotencyRecord, Notification, ApprovalRequest, **ApprovalRule**, **ExportLog**, **ReportSnapshot** |

### Schema rules

1. **Exact numbers:** PostgreSQL `Decimal(19,4)` for amounts, quantities and unit cost; `Decimal(19,8)` for exchange rates. No floats anywhere.
2. **Every money amount** stores currency, original amount, exchange rate, rate source and date, and base-currency amount.
3. **Journal lines** hold one of debit or credit (never both, never negative), account, currency, base amounts and dimension values. The journal total check runs in the database, not only in code.
4. **Tenant key on every table.** `businessId` is part of every unique key and index. PostgreSQL row-level security enforces isolation, so one missed filter in code cannot leak data.
5. **Posted records are locked.** Database rules block update and delete on posted journals and their lines. Foreign keys on accounting records restrict deletion.
6. **Two dates:** effective accounting date (decides the period) and created time (audit). Store timestamps in UTC and apply the business time zone for period boundaries.
7. **Enums for every status.** Document statuses are Draft, Awaiting approval, Posted, Reversed (plus Void for drafts never posted).
8. **Source link:** each journal stores its source type, source ID and idempotency key, unique per business.
9. **Indexes:** business, date, status, account, supplier or customer, source reference.

## Technical architecture, security and controls

### Stack

Next.js (current stable release, App Router), TypeScript, Tailwind CSS, Prisma ORM, **PostgreSQL in every environment** (run it locally with Docker), Decimal.js, Zod for input validation, TanStack Table, a charting library, object storage for documents, and a background job runner for integration retries, recurring journals and scheduled reports.

The V2 layer structure and folder layout stay: presentation, application, domain, integration, persistence, reporting. Accounting and landed-cost code lives in plain domain services with no React or route-handler code in it, so it can be tested alone.

### Rules for the posting engine

1. One function posts every journal. All use cases call it; nothing else writes journal lines.
2. It runs in one database transaction and checks, in order: tenant, period open, accounts valid, debits equal credits, idempotency key unused.
3. Document numbers are assigned inside that transaction, so they stay gapless under concurrent use.
4. Account balances are always derived from posted lines. A cached balance table speeds up reports and can be rebuilt at any time.
5. Reports for closed periods are saved as snapshots, so later corrections show as new activity and not as silent changes.

### Security and governance

- Row-level tenant isolation in PostgreSQL; the tenant is set inside each transaction.
- Role-based permissions, plus the rule that the creator of an entry cannot approve it.
- Multi-factor sign-in, session limits, and rate limiting on sign-in and APIs.
- Encryption in transit and at rest; secrets kept outside source control; signed, expiring links for documents.
- Audit log for sensitive actions: posting, reversal, approval, period lock or reopen, role changes, exports, integration replays.
- Period lock with controlled reopen that needs the Owner or Accountant role and a written reason.
- Automated backups and a restore test every month.
- Configurable record-retention period and full data export for the business.
- Least-privilege API keys for integrations, one per connection, revocable.

## Roadmap: MVP first

V2's nine phases become one decision phase and three releases, each usable on its own.

&#91;embedded content: roadmap · phase 0 plus 3 releases, 3 gates\]

Read left to right. The highlighted band is what the first users get. A release does not start until the gate before it passes, and the items match the Release column in the requirements checklist.

## Tests, release gates and decisions needed

### Required automated tests

- **Posting rules:** one test per row of the posting-rules table, checking exact debit and credit lines.
- **Invariants:** every posted journal balances; posted journals cannot be edited or deleted; reversals link to the original; duplicate events create no second journal; closed periods reject postings; AP and AR allocations never exceed the open balance.
- **Landed cost:** allocation by value, weight, volume, quantity and manual; zero or missing basis; mixed currencies; rounding remainder; partial receipt; final bills after units are sold; adjustment split; shipment cancellation. The worked example above is a fixed test case with the exact figures shown.
- **Reconciliation:** subledgers equal control accounts; Inventory account equals valuation records; statements equal the trial balance.
- **Platform:** tenant isolation (including direct database access), role permissions, concurrent posting, rollback on failure, retry and replay, backup restore.
- **UX acceptance:** a new user completes first-run setup and records a sale, a bill, a payment and a shipment without help, and Simple mode never shows a debit or credit.

### Release gates

Do not release accounting features until all of these pass: journals balance, statements equal the trial balance, inventory value equals stock and ledger, AP and AR equal their control accounts, duplicate events are handled, tenant isolation passes, and a backup has been restored successfully.

### Decisions I need from you or your accountant

| # | Decision | My recommendation |
| --- | --- | --- |
| 1 | Accounting basis | Accrual, with a cash-basis view for owners |
| 2 | Inventory valuation | Weighted average per SKU |
| 3 | Split of late landed-cost differences between stock and sold units | Proportional by units, as described in the landed cost section |
| 4 | When ownership of imported goods passes (goods in transit vs inventory) | Set per shipment from the shipping terms; tell me which terms you use most |
| 5 | Base currency and rounding per currency | Fix at setup; amounts to the currency's usual decimals |
| 6 | Tax setup: registered or not, rates, whether import tax is recoverable | Configurable; confirm with a local tax professional |
| 7 | Fiscal year start | Set at setup |
| 8 | Branches and channels reported from day one | Store from day one, report in Release 3 |
| 9 | Payroll scope | Import journal totals only |
| 10 | Record retention period and hosting region | Set by local law; confirm before launch |
