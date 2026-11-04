// ============================================================================
// Loops Finance V3 — Complete Default Seed Data
// Includes all 65 Chart of Accounts, Worked Landed Cost Example & Startup State
// ============================================================================

const initialBusiness = {
  id: 'bus-loops-001',
  name: 'The Loops Flagship Store',
  legalName: 'The Loops Universal Retail Co., Ltd.',
  taxId: 'TX-8921-LOOP',
  baseCurrency: 'USD',
  fiscalYearStartMonth: 1,
  accountingBasis: 'ACCRUAL',
  isTaxRegistered: true
};

const initialSettings = {
  id: 'set-loops-001',
  businessId: 'bus-loops-001',
  safeCashBuffer: 10000,
  defaultMarkupTarget: 45,
  autoReverseAccruals: true,
  ownerModeDefault: 'SIMPLE',
  lockPeriodDate: null
};

// All 65 Chart of Accounts from Loops Finance V3 Specification
const initialAccounts = [
  // 1000 - Assets
  { code: '1010', name: 'Cash on Hand', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },
  { code: '1015', name: 'Petty Cash', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '1020', name: 'Bank Operating Account', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },
  { code: '1030', name: 'Payment Gateway Clearing', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },
  { code: '1110', name: 'Allowance for Doubtful Accounts', type: 'CONTRA_ASSET', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '1150', name: 'Supplier Advances', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },
  { code: '1160', name: 'Staff Advances & Other Receivables', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '1200', name: 'Inventory Asset', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },
  { code: '1205', name: 'Inventory Reserve (Obsolescence)', type: 'CONTRA_ASSET', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '1210', name: 'Goods in Transit', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },
  { code: '1215', name: 'Landed Cost Clearing', type: 'CLEARING', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },
  { code: '1220', name: 'Input VAT Receivable', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '1225', name: 'Import VAT Receivable', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '1300', name: 'Prepaid Expenses', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '1310', name: 'Deposits Paid', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '1500', name: 'Property, Plant & Equipment', type: 'ASSET', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '1590', name: 'Accumulated Depreciation', type: 'CONTRA_ASSET', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '1999', name: 'Suspense Account', type: 'CLEARING', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },

  // 2000 - Liabilities
  { code: '2010', name: 'Accounts Payable', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: true, balance: 0 },
  { code: '2020', name: 'Goods Received Not Invoiced (GRNI)', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: true, balance: 0 },
  { code: '2030', name: 'Output VAT Payable', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '2040', name: 'Withholding Tax Payable', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '2050', name: 'Customs Duty & Import Taxes Payable', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '2060', name: 'Accrued Expenses', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: true, balance: 0 },
  { code: '2070', name: 'Payroll Liabilities', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '2080', name: 'Customer Deposits & Store Credit', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '2085', name: 'Gift Card Liability', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '2090', name: 'Refunds Payable', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '2095', name: 'Income Tax Payable', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '2100', name: 'Loans Payable - Current', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '2150', name: 'Loans Payable - Long Term', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '2160', name: 'Accrued Interest Payable', type: 'LIABILITY', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },

  // 3000 - Equity
  { code: '3010', name: 'Owner Capital', type: 'EQUITY', normalSide: 'CREDIT', isSystemProtected: true, balance: 0 },
  { code: '3020', name: 'Additional Paid-in Capital', type: 'EQUITY', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '3030', name: 'Owner Drawings', type: 'CONTRA_EQUITY', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },
  { code: '3040', name: 'Dividends Declared', type: 'CONTRA_EQUITY', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '3050', name: 'Opening Balance Equity', type: 'EQUITY', normalSide: 'CREDIT', isSystemProtected: true, balance: 0 },
  { code: '3100', name: 'Retained Earnings', type: 'EQUITY', normalSide: 'CREDIT', isSystemProtected: true, balance: 0 },
  { code: '3200', name: 'Current Year Earnings', type: 'EQUITY', normalSide: 'CREDIT', isSystemProtected: true, balance: 0 },

  // 4000 - Revenue
  { code: '4010', name: 'Sales Revenue', type: 'REVENUE', normalSide: 'CREDIT', isSystemProtected: true, balance: 0 },
  { code: '4015', name: 'Shipping Income', type: 'REVENUE', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '4020', name: 'Sales Returns & Allowances', type: 'CONTRA_REVENUE', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '4030', name: 'Discounts Given', type: 'CONTRA_REVENUE', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },

  // 5000 - Cost of Goods Sold
  { code: '5010', name: 'Landed Cost of Goods Sold', type: 'COGS', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },
  { code: '5020', name: 'Damaged Inventory Write-off', type: 'COGS', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '5030', name: 'Inventory Adjustments & Shrinkage', type: 'COGS', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '5040', name: 'Landed Cost Variance on Sold Units', type: 'COGS', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },

  // 6000 - Operating Expenses
  { code: '6010', name: 'Direct Selling Costs', type: 'OPERATING_EXPENSE', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '6015', name: 'Payment Gateway Fees', type: 'OPERATING_EXPENSE', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '6020', name: 'Marketing and Advertising', type: 'OPERATING_EXPENSE', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '6030', name: 'Rent & Store Utilities', type: 'OPERATING_EXPENSE', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '6040', name: 'Payroll & Staff Wages', type: 'OPERATING_EXPENSE', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '6050', name: 'Administration & Software', type: 'OPERATING_EXPENSE', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '6055', name: 'Professional Fees', type: 'OPERATING_EXPENSE', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '6060', name: 'Depreciation & Amortization', type: 'OPERATING_EXPENSE', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },
  { code: '6070', name: 'Bank Charges & Wire Fees', type: 'OPERATING_EXPENSE', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '6080', name: 'Bad Debt Expense', type: 'OPERATING_EXPENSE', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '6090', name: 'Rounding Differences', type: 'OPERATING_EXPENSE', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },

  // 7000-9000 - Non-Operating & Tax
  { code: '7010', name: 'Interest Expense', type: 'NON_OPERATING', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 },
  { code: '7020', name: 'Realized FX Gain or Loss', type: 'NON_OPERATING', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },
  { code: '7030', name: 'Unrealized FX Gain or Loss', type: 'NON_OPERATING', normalSide: 'DEBIT', isSystemProtected: true, balance: 0 },
  { code: '8010', name: 'Interest Income', type: 'OTHER_INCOME', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '8090', name: 'Other Income', type: 'OTHER_INCOME', normalSide: 'CREDIT', isSystemProtected: false, balance: 0 },
  { code: '9010', name: 'Corporate Income Tax Expense', type: 'TAX', normalSide: 'DEBIT', isSystemProtected: false, balance: 0 }
];

// Initial Capital Accounts
const initialCapitalAccounts = [
  {
    id: 'cap-founder-001',
    partnerName: 'Managing Founder',
    partnerRole: 'Principal Shareholder',
    ownershipPercentage: 80,
    totalInvested: 50000,
    totalWithdrawn: 2500,
    currentEquity: 47500
  },
  {
    id: 'cap-angel-002',
    partnerName: 'Studio Angel Partner',
    partnerRole: 'Silent Investor',
    ownershipPercentage: 20,
    totalInvested: 10000,
    totalWithdrawn: 0,
    currentEquity: 10000
  }
];

const initialCapitalTransactions = [
  {
    id: 'ctx-001',
    capitalAccountId: 'cap-founder-001',
    type: 'INITIAL_INVESTMENT',
    amount: 50000,
    transactionDate: '2026-09-01',
    paymentMethod: 'BANK_TRANSFER',
    notes: 'Initial equity deposit to launch Loops Flagship Store'
  },
  {
    id: 'ctx-002',
    capitalAccountId: 'cap-angel-002',
    type: 'CAPITAL_INJECTION',
    amount: 10000,
    transactionDate: '2026-09-15',
    paymentMethod: 'BANK_TRANSFER',
    notes: 'Expansion capital contribution for initial inventory batch'
  },
  {
    id: 'ctx-003',
    capitalAccountId: 'cap-founder-001',
    type: 'OWNER_DRAWING',
    amount: 2500,
    transactionDate: '2026-10-25',
    paymentMethod: 'BANK_TRANSFER',
    notes: 'Quarterly founder drawings'
  }
];

// Startup Budget (CAPEX vs OPEX)
const initialStartupBudgets = [
  {
    id: 'bud-launch-001',
    name: 'Retail Store Launch & Equipment',
    totalBudgetCapex: 25000,
    totalBudgetOpex: 15000,
    totalActualSpent: 22400,
    status: 'ACTIVE'
  }
];

const initialStartupBudgetItems = [
  {
    id: 'sbi-001',
    budgetId: 'bud-launch-001',
    category: 'Store Renovation',
    classification: 'CAPEX',
    phase: 'PRE_LAUNCH',
    name: 'Custom Oak Modular Display Units & Lighting',
    budgetedAmount: 12000,
    actualAmount: 11500,
    status: 'PAID',
    notes: 'Completed by Atelier Woodworks'
  },
  {
    id: 'sbi-002',
    budgetId: 'bud-launch-001',
    category: 'POS & Barcode Hardware',
    classification: 'CAPEX',
    phase: 'PRE_LAUNCH',
    name: 'Dual-display Register, Star Receipt & Zebra Barcode Printers',
    budgetedAmount: 3500,
    actualAmount: 3200,
    status: 'PAID',
    notes: 'Installed and configured with Stock Loops POS'
  },
  {
    id: 'sbi-003',
    budgetId: 'bud-launch-001',
    category: 'Lease Security Deposit',
    classification: 'DEPOSIT',
    phase: 'PRE_LAUNCH',
    name: '3 Months Mall Space Lease Security Deposit',
    budgetedAmount: 9500,
    actualAmount: 9500,
    status: 'PAID',
    notes: 'Held in escrow account 1310'
  },
  {
    id: 'sbi-004',
    budgetId: 'bud-launch-001',
    category: 'Branding & Launch Blitz',
    classification: 'OPEX',
    phase: 'PRE_LAUNCH',
    name: 'Window vinyls, store packaging bags & influencer seeding',
    budgetedAmount: 5000,
    actualAmount: 3800,
    status: 'PAID',
    notes: 'Delivered before Grand Opening'
  },
  {
    id: 'sbi-005',
    budgetId: 'bud-launch-001',
    category: 'Safety Operating Buffer',
    classification: 'OPEX',
    phase: 'PRE_LAUNCH',
    name: '60-Day Runway Reserve Buffer',
    budgetedAmount: 10000,
    actualAmount: 0,
    status: 'PLANNED',
    notes: 'Maintained in Bank Operating Account'
  }
];

// Exact Worked Example from Loops Finance V3 Specification
// Product A (500 units @ $10.00 base, 100 kg, 0.5 CBM) -> Landed $11.7686 ($11.77)
// Product B (1,000 units @ $2.00 base, 900 kg, 2.5 CBM) -> Landed $3.8157 ($3.82)
const initialShipments = [
  {
    id: 'ship-worked-001',
    shipmentCode: 'IMP-2026-001',
    supplierName: 'Shenzhen Precision Craft Manufacturing',
    originCountry: 'China',
    shippingTerms: 'FOB',
    status: 'FINALIZED',
    foreignCurrency: 'USD',
    exchangeRate: 1.0,
    totalGoodsCostBase: 7000.0,
    totalOverheadsBase: 2700.0,
    totalLandedCostBase: 9700.0,
    notes: 'Benchmark shipment verifying exact V3 landed cost distribution across lightweight vs heavy goods.'
  },
  {
    id: 'ship-draft-002',
    shipmentCode: 'IMP-2026-002',
    supplierName: 'Osaka Minimalist Goods Co.',
    originCountry: 'Japan',
    shippingTerms: 'CIF',
    status: 'ESTIMATE',
    foreignCurrency: 'USD',
    exchangeRate: 1.0,
    totalGoodsCostBase: 5400.0,
    totalOverheadsBase: 1200.0,
    totalLandedCostBase: 6600.0,
    notes: 'Winter replenishment batch currently scheduled for port departure.'
  }
];

const initialShipmentItems = [
  {
    id: 'isi-prod-a',
    shipmentId: 'ship-worked-001',
    skuCode: 'SKU-WATCH-01',
    productName: 'Ultra-Light Titanium Chrono Watch',
    variantName: 'Classic Obsidian / Matte',
    quantity: 500,
    unit_base_price_fc: 10.0,
    unit_base_price_base: 10.0,
    total_base_price_base: 5000.0,
    unit_weight_kg: 0.2,
    total_weight_kg: 100.0,
    unit_volume_cbm: 0.001,
    total_volume_cbm: 0.5,
    allocated_freight: 150.0,
    allocated_duty: 500.0,
    allocated_clearance: 214.29,
    allocated_trucking: 20.0,
    allocated_other: 0.0,
    total_allocated_overhead: 884.29,
    total_landed_cost: 5884.29,
    unit_landed_cost: 11.7686,
    target_retail_price: 28.0,
    projected_margin_pct: 57.97,
    projected_markup_pct: 137.92
  },
  {
    id: 'isi-prod-b',
    shipmentId: 'ship-worked-001',
    skuCode: 'SKU-DUFFLE-02',
    productName: 'Heavy Canvas Travel Duffle Pack',
    variantName: 'Midnight Charcoal 45L',
    quantity: 1000,
    unit_base_price_fc: 2.0,
    unit_base_price_base: 2.0,
    total_base_price_base: 2000.0,
    unit_weight_kg: 0.9,
    total_weight_kg: 900.0,
    unit_volume_cbm: 0.0025,
    total_volume_cbm: 2.5,
    allocated_freight: 1350.0,
    allocated_duty: 200.0,
    allocated_clearance: 85.71,
    allocated_trucking: 180.0,
    allocated_other: 0.0,
    total_allocated_overhead: 1815.71,
    total_landed_cost: 3815.71,
    unit_landed_cost: 3.8157,
    target_retail_price: 12.0,
    projected_margin_pct: 68.20,
    projected_markup_pct: 214.49
  }
];

const initialShipmentOverheads = [
  {
    id: 'ovh-001',
    shipmentId: 'ship-worked-001',
    category: 'INTERNATIONAL_FREIGHT',
    vendorName: 'Pacific Sea Forwarding Lines',
    invoiceNumber: 'INV-PSF-8891',
    currency: 'USD',
    exchangeRate: 1.0,
    amountForeign: 1500.0,
    amountBase: 1500.0,
    isCapitalizable: true,
    allocationBasis: 'BY_WEIGHT',
    isPaid: true
  },
  {
    id: 'ovh-002',
    shipmentId: 'ship-worked-001',
    category: 'CUSTOMS_DUTY',
    vendorName: 'Port Customs & Border Tariff Dept',
    invoiceNumber: 'DUTY-2026-99',
    currency: 'USD',
    exchangeRate: 1.0,
    amountForeign: 700.0,
    amountBase: 700.0,
    isCapitalizable: true,
    allocationBasis: 'BY_VALUE',
    isPaid: true
  },
  {
    id: 'ovh-003',
    shipmentId: 'ship-worked-001',
    category: 'PORT_CLEARANCE_THC',
    vendorName: 'Apex Maritime Port Clearing Broker',
    invoiceNumber: 'APX-7712',
    currency: 'USD',
    exchangeRate: 1.0,
    amountForeign: 300.0,
    amountBase: 300.0,
    isCapitalizable: true,
    allocationBasis: 'BY_VALUE',
    isPaid: true
  },
  {
    id: 'ovh-004',
    shipmentId: 'ship-worked-001',
    category: 'LOCAL_TRUCKING',
    vendorName: 'Metropolitan Express Drayage Co.',
    invoiceNumber: 'METRO-441',
    currency: 'USD',
    exchangeRate: 1.0,
    amountForeign: 200.0,
    amountBase: 200.0,
    isCapitalizable: true,
    allocationBasis: 'BY_WEIGHT',
    isPaid: true
  }
];

// Initial Supplier Bills with 30/70 Advance payment term tracking
const initialSupplierBills = [
  {
    id: 'sbill-001',
    billNumber: 'BILL-SZ-2026-88',
    supplierName: 'Shenzhen Precision Craft Manufacturing',
    billDate: '2026-10-10',
    dueDate: '2026-11-10',
    currency: 'USD',
    totalAmount: 7000.0,
    depositPaid: 2100.0, // 30% advance paid on PO creation
    balanceDue: 4900.0,  // 70% remaining balance
    status: 'PARTIALLY_PAID',
    linkedPoNumber: 'PO-2026-004',
    linkedShipmentId: 'ship-worked-001',
    notes: 'Factory production batch balance due upon Bill of Lading delivery'
  },
  {
    id: 'sbill-002',
    billNumber: 'BILL-METRO-441',
    supplierName: 'Metropolitan Express Drayage Co.',
    billDate: '2026-10-18',
    dueDate: '2026-11-18',
    currency: 'USD',
    totalAmount: 200.0,
    depositPaid: 0.0,
    balanceDue: 0.0,
    status: 'PAID',
    linkedPoNumber: null,
    linkedShipmentId: 'ship-worked-001',
    notes: 'Port-to-warehouse inland delivery freight'
  }
];

// Operating Expenses
const initialExpenses = [
  {
    id: 'exp-001',
    expenseNumber: 'EXP-2026-001',
    category: 'Rent & Store Utilities',
    tier: 'OCCUPANCY_RENT',
    vendorPayee: 'Apex Commercial Plaza REIT',
    amount: 3400.0,
    expenseDate: '2026-10-01',
    paymentMethod: 'BANK_TRANSFER',
    notes: 'October flagship retail store rental & base maintenance'
  },
  {
    id: 'exp-002',
    expenseNumber: 'EXP-2026-002',
    category: 'Marketing and Advertising',
    tier: 'MARKETING_ADS',
    vendorPayee: 'Meta Platforms (Instagram Ads)',
    amount: 2150.0,
    expenseDate: '2026-10-12',
    paymentMethod: 'CREDIT_CARD',
    notes: 'Fall fashion & accessories conversion campaign'
  },
  {
    id: 'exp-003',
    expenseNumber: 'EXP-2026-003',
    category: 'Payroll & Staff Wages',
    tier: 'PAYROLL_WAGES',
    vendorPayee: 'Retail Staff Payroll',
    amount: 3200.0,
    expenseDate: '2026-10-25',
    paymentMethod: 'BANK_TRANSFER',
    notes: 'October monthly store sales & cashier staff payroll'
  },
  {
    id: 'exp-004',
    expenseNumber: 'EXP-2026-004',
    category: 'Direct Selling Costs',
    tier: 'DIRECT_SELLING',
    vendorPayee: 'EcoPackaging Supplies',
    amount: 480.0,
    expenseDate: '2026-10-14',
    paymentMethod: 'BANK_TRANSFER',
    notes: 'Recyclable luxury shopping bags and embossed hang-tags'
  }
];

// Recurring Bills
const initialRecurringBills = [
  {
    id: 'rec-001',
    title: 'Flagship Store Commercial Lease',
    category: 'Rent & Store Utilities',
    amount: 3400.0,
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    nextDueDate: '2026-11-01',
    autoPost: false,
    isActive: true
  },
  {
    id: 'rec-002',
    title: 'POS Cloud & Security Infrastructure',
    category: 'Administration & Software',
    amount: 199.0,
    frequency: 'MONTHLY',
    dayOfMonth: 5,
    nextDueDate: '2026-11-05',
    autoPost: true,
    isActive: true
  }
];

// Sales & Customer Receivables
const initialInvoices = [
  {
    id: 'inv-001',
    invoiceNumber: 'INV-2026-0101',
    customerName: 'Studio Walk-in Customers (POS Batch)',
    invoiceDate: '2026-10-28',
    dueDate: '2026-10-28',
    subtotal: 18200.0,
    taxAmount: 0.0,
    discountAmount: 420.0,
    totalAmount: 17780.0,
    landedCogsAmount: 7600.0,
    status: 'PAID',
    channel: 'RETAIL_POS',
    notes: 'Live POS register sales from Weekend Launch'
  },
  {
    id: 'inv-002',
    invoiceNumber: 'INV-2026-0102',
    customerName: 'Highland Boutique Collective',
    invoiceDate: '2026-10-30',
    dueDate: '2026-11-15',
    subtotal: 10200.0,
    taxAmount: 0.0,
    discountAmount: 200.0,
    totalAmount: 10000.0,
    landedCogsAmount: 5000.0,
    status: 'POSTED',
    channel: 'WHOLESALE',
    notes: 'B2B Wholesale consignment order (net 15 days)'
  }
];

// Immutable Journal Entries
const initialJournalEntries = [
  {
    id: 'je-cap-001',
    entryNumber: 'JRN-2026-0001',
    accountingDate: '2026-09-01',
    status: 'POSTED',
    sourceType: 'CAPITAL',
    sourceId: 'ctx-001',
    memo: 'Founder seed capital contribution to launch business',
    totalDebit: 50000.0,
    totalCredit: 50000.0,
    lines: [
      { accountCode: '1020', accountName: 'Bank Operating Account', debit: 50000.0, credit: 0.0, memo: 'Capital funds received' },
      { accountCode: '3010', accountName: 'Owner Capital', debit: 0.0, credit: 50000.0, memo: 'Owner equity recorded' }
    ]
  },
  {
    id: 'je-ship-001',
    entryNumber: 'JRN-2026-0002',
    accountingDate: '2026-10-15',
    status: 'POSTED',
    sourceType: 'IMPORT_LANDED',
    sourceId: 'ship-worked-001',
    memo: 'Capitalize true landed cost for shipment IMP-2026-001',
    totalDebit: 9700.0,
    totalCredit: 9700.0,
    lines: [
      { accountCode: '1200', accountName: 'Inventory Asset', debit: 9700.0, credit: 0.0, memo: 'Physical inventory capitalized at true landed cost' },
      { accountCode: '2020', accountName: 'Goods Received Not Invoiced (GRNI)', debit: 0.0, credit: 7000.0, memo: 'Goods receipt liability cleared' },
      { accountCode: '1215', accountName: 'Landed Cost Clearing', debit: 0.0, credit: 2700.0, memo: 'Overhead clearing pool allocated to stock' }
    ]
  },
  {
    id: 'je-sale-001',
    entryNumber: 'JRN-2026-0003',
    accountingDate: '2026-10-28',
    status: 'POSTED',
    sourceType: 'SALE',
    sourceId: 'inv-001',
    memo: 'POS Sales batch & landed COGS derecognition',
    totalDebit: 25380.0,
    totalCredit: 25380.0,
    lines: [
      { accountCode: '1020', accountName: 'Bank Operating Account', debit: 17780.0, credit: 0.0, memo: 'POS sales cash proceeds' },
      { accountCode: '4010', accountName: 'Sales Revenue', debit: 0.0, credit: 17780.0, memo: 'Gross retail sales revenue' },
      { accountCode: '5010', accountName: 'Landed Cost of Goods Sold', debit: 7600.0, credit: 0.0, memo: 'Landed cost of sold items expensed' },
      { accountCode: '1200', accountName: 'Inventory Asset', debit: 0.0, credit: 7600.0, memo: 'Relieve sold inventory at landed cost' }
    ]
  }
];

module.exports = {
  initialBusiness,
  initialSettings,
  initialAccounts,
  initialCapitalAccounts,
  initialCapitalTransactions,
  initialStartupBudgets,
  initialStartupBudgetItems,
  initialShipments,
  initialShipmentItems,
  initialShipmentOverheads,
  initialSupplierBills,
  initialExpenses,
  initialRecurringBills,
  initialInvoices,
  initialJournalEntries
};

