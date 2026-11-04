# The Loops System --- Fashion Inventory & Stock Management Platform

## Complete Product Requirements, Architecture, Data Model & Implementation Specification

**Industry:** Fashion, apparel retail, boutique brands and garment
studios\
**Architecture:** Single location at launch; designed for multiple
branches and stock locations\
**Inventory model:** Style → Color × Size variant (SKU)\
**Technology:** Next.js App Router + TypeScript + Tailwind CSS + Prisma
ORM + SQLite for local development\
**Core principle:** Every stock change is recorded in an append-only
movement ledger. Current stock is never silently overwritten.

------------------------------------------------------------------------

# 1. Executive Summary

The Loops System is a fashion-specific inventory platform. It manages
garment styles, color and size variants, suppliers, purchase orders,
receiving, sales, returns, defects, stock counts, stock locations,
pricing, labels and reporting.

Unlike generic inventory systems, its central product structure is:

**Collection → Garment Style → Variant (Color × Size) → Stock by
Location**

A style is the design or garment model, such as
`LP-TEE-001 Heavyweight Boxy Tee`. A variant is one sellable
combination, such as `LP-TEE-001-BLK-M`. Each variant has its own SKU,
barcode, cost, retail price, reorder settings and stock balance.

## 1.1 Main goals

-   See stock by style, color, size and location.
-   Record the first quantity brought into the system as opening stock.
-   Record every later receipt as a separate stock-in event.
-   Record sales, dispatches, returns, defects and count corrections.
-   Always know total received, total sold, current physical stock,
    reserved stock and available stock.
-   Trace every movement to a date, staff member, reason and source
    document.
-   Track unit cost and retail value without mixing financial values
    with physical quantities.
-   Make receiving and stock-out operations quick enough for daily store
    use.
-   Keep the design extensible to multiple branches without requiring a
    rewrite.

## 1.2 Important inventory terminology

  -----------------------------------------------------------------------
  Term                                Definition
  ----------------------------------- -----------------------------------
  Opening stock                       Starting quantity entered when a
                                      SKU/location is first initialized

  Subsequent stock in                 Any receipt after opening stock,
                                      such as a supplier delivery

  Gross stock received                Opening stock + all subsequent
                                      receipts

  Gross units sold                    Units sold/dispatches, excluding
                                      cancelled or voided sales

  Customer return                     A previously sold item returned by
                                      a customer

  Current on-hand                     Physical sellable quantity
                                      currently recorded at the location

  Reserved                            On-hand units allocated to orders
                                      but not yet dispatched

  Available                           On-hand minus reserved

  Damaged/defective                   Physical units that cannot
                                      currently be sold

  Stock adjustment                    A documented correction after a
                                      physical count or investigation

  Stock transfer                      Movement between locations; not a
                                      sale or new purchase
  -----------------------------------------------------------------------

**Do not treat "total stock in minus total sales" as the only
current-stock calculation.** Returns, defects, supplier returns,
transfers and count adjustments must also be represented.

------------------------------------------------------------------------

# 2. Recommended Stock Tracking Method

## 2.1 Source of truth: append-only stock movement ledger

Every event that changes physical inventory creates a `StockMovement`
record. Examples:

-   `OPENING_STOCK`
-   `RECEIVE_STOCK`
-   `SALE_OUT`
-   `CUSTOMER_RETURN_IN`
-   `DEFECT_OUT`
-   `SUPPLIER_RETURN_OUT`
-   `COUNT_GAIN`
-   `COUNT_LOSS`
-   `TRANSFER_OUT`
-   `TRANSFER_IN`
-   `MANUAL_ADJUSTMENT_IN`
-   `MANUAL_ADJUSTMENT_OUT`

The ledger is append-only for normal application users. Do not edit or
delete a posted movement to correct it. Create a reversing movement and
then the correct movement, preserving the audit trail.

Each movement should record: - SKU/variant and stock location - Movement
type - Signed quantity delta (`+` increases stock, `-` decreases
stock) - On-hand balance after the movement - Unit cost snapshot, when
relevant - Source document and reference number - Reason/note -
Staff/user who performed it - Timestamp - Idempotency key to prevent
duplicate submissions - Optional link to the movement being reversed

## 2.2 Fast current balance: stock balance snapshot

Keep a `StockBalance` row for each **variant + location**. It stores
current quantities for fast screens and reports. Update the ledger and
balance together in one database transaction.

Recommended quantity fields:

-   `quantityOnHand`: sellable physical units currently in stock.
-   `quantityReserved`: units allocated to open orders.
-   `quantityDamaged`: known physical units held separately and not
    sellable.
-   `quantityAvailable`: calculated as
    `quantityOnHand - quantityReserved`; do not accept user edits to
    this field.

Damaged goods should not remain in sellable `quantityOnHand`. When an
item becomes damaged, create a negative `DEFECT_OUT` movement from
sellable stock and, if damaged goods are physically retained, a
corresponding positive movement into a non-sellable/damaged stock
location or a separate damaged balance. This avoids accidentally selling
defective units.

The ledger is the audit source; the balance is the transactional
operational snapshot. A reconciliation tool should be able to recompute
balances from the ledger and identify differences.

## 2.3 Opening stock workflow

When setting up an existing shop in The Loops System:

1.  Create the garment style.
2.  Create all required color × size variants.
3.  Enter the opening quantity for each variant and location.
4.  Confirm the opening stock date and optional opening reference (for
    example, `OPENING-2026-001`).
5.  Preview all rows and totals.
6.  Confirm once.
7.  The system creates one `OPENING_STOCK` movement for every non-zero
    SKU/location row and initializes the matching balances.

Opening stock is a one-time baseline per variant/location. If a missed
quantity is discovered later, use a count adjustment, not another
opening-stock entry. A privileged migration workflow may correct an
opening balance, but it must reverse the original movement and create a
replacement with an audit reason.

## 2.4 Example stock history

SKU: `LP-TEE-001-BLK-M`, Location: Main Store

  Date     Movement                        In   Out   Balance
  -------- ---------------------------- ----- ----- ---------
  1 Nov    Opening stock                  100     0       100
  5 Nov    Supplier receipt PO-001         50     0       150
  7 Nov    Sale SO-001                      0    12       138
  8 Nov    Sale SO-002                      0    23       115
  9 Nov    Defect write-off                 0     3       112
  12 Nov   Supplier receipt PO-002         30     0       142
  14 Nov   Customer return (sellable)       2     0       144

Current on-hand = **144 units**. Gross stock received = **180 units**
(100 opening + 50 + 30 subsequent receipts). Gross sold = **35 units**.
Defects = **3 units**. Sellable customer returns = **2 units**.

The dashboard must distinguish gross sales from net sales/stock
reduction. A returned item is not a new supplier receipt.

## 2.5 Example stock summary per SKU

  Metric                        Quantity
  --------------------------- ----------
  Opening stock                      100
  Subsequent stock in                 80
  Gross stock received               180
  Gross sold                          35
  Sellable customer returns            2
  Defect write-offs                    3
  Supplier returns                     0
  Count adjustments (net)              0
  Current on-hand                    144
  Reserved                            10
  Available                          134

Formula for sellable stock, assuming all movement types are classified
correctly:

`Current on-hand = Opening + receipts + sellable customer returns + count gains + other stock-in movements - sales - defects - supplier returns - count losses - other stock-out movements`

Transfers between locations must net to zero across the whole business:
one location gets `TRANSFER_OUT`, the destination gets `TRANSFER_IN`. A
transfer must not change company-wide total stock.

------------------------------------------------------------------------

# 3. Architecture

``` text
┌──────────────────────────────────────────────────────────────┐
│ Next.js App Router UI                                         │
│ Dashboard | Products | Stock Ops | Purchase Orders | Reports  │
│ Tailwind | Accessible components | TanStack Table | Barcode  │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│ Server Actions / Route Handlers                                │
│ Authentication | Authorization | Zod validation               │
│ Business rules | Idempotency | Audit logging                   │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│ Domain / Service Layer                                         │
│ Product service | Receiving service | Stock ledger service     │
│ Sales service | Return service | Transfer service | Reporting   │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│ Prisma ORM                                                     │
│ Atomic database transactions; ledger + balance updated together│
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│ SQLite (local development / single-user deployment)            │
│ Consider PostgreSQL for production multi-user concurrent use   │
└──────────────────────────────────────────────────────────────┘
```

## 3.1 Important architecture recommendations

-   Use server-side authorization for every write operation; hiding a
    button is not security.
-   Put stock rules in reusable server-side service functions, not only
    in React components.
-   Validate all input with Zod.
-   Use Prisma `$transaction` for movement + balance + source-document
    updates.
-   Use an idempotency key on receiving, sales and other write requests
    to prevent duplicate stock changes after double-clicks or network
    retries.
-   Use integer quantities; do not use floating point for stock.
-   Store money as integer minor units (for example, cents) or use a
    carefully tested fixed-precision money strategy. Do not use
    JavaScript floating-point arithmetic for money.
-   SQLite is excellent for local development and a small single-user
    installation. For multiple staff writing concurrently or a hosted
    multi-branch system, plan to migrate to PostgreSQL.
-   Back up the database automatically and test restoration. A local
    SQLite file is not a backup strategy by itself.
-   Use UTC timestamps in storage and display them in the store's
    configured timezone.

------------------------------------------------------------------------

# 4. Data Model

The following is a recommended starting schema. It adds stock locations,
opening stock, receiving history, sales, returns, transfers, count
sessions, users and audit support. It is a foundation to refine during
implementation, not a substitute for migration tests.

## 4.1 Prisma schema

``` prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum Season {
  SPRING
  SUMMER
  FALL
  WINTER
  ALL_YEAR
}

enum StockMovementType {
  OPENING_STOCK
  RECEIVE_STOCK
  SALE_OUT
  CUSTOMER_RETURN_IN
  DEFECT_OUT
  SUPPLIER_RETURN_OUT
  COUNT_GAIN
  COUNT_LOSS
  MANUAL_ADJUSTMENT_IN
  MANUAL_ADJUSTMENT_OUT
  TRANSFER_IN
  TRANSFER_OUT
  REVERSAL
}

enum PurchaseOrderStatus {
  DRAFT
  PENDING
  PARTIAL
  COMPLETED
  CANCELLED
}

enum DocumentStatus {
  DRAFT
  POSTED
  VOIDED
}

enum ReturnDisposition {
  RESTOCK
  DAMAGED
  QUARANTINE
}

model Collection {
  id        String   @id @default(cuid())
  name      String
  season    Season
  year      Int
  isActive  Boolean  @default(true)
  products  Product[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Category {
  id       String    @id @default(cuid())
  name     String
  slug     String    @unique
  parentId String?
  parent   Category? @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")
  products Product[]
}

model Supplier {
  id             String          @id @default(cuid())
  name           String
  contactPerson  String?
  email          String?
  phone          String?
  leadTimeDays   Int             @default(14)
  notes          String?
  products       Product[]
  purchaseOrders PurchaseOrder[]
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}

model Location {
  id          String         @id @default(cuid())
  name        String
  code        String         @unique
  type        String         @default("STORE") // STORE, STOCKROOM, WAREHOUSE, DAMAGED, QUARANTINE
  address     String?
  isActive    Boolean        @default(true)
  balances    StockBalance[]
  movements   StockMovement[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
}

model Product {
  id                String           @id @default(cuid())
  styleCode         String           @unique
  name              String
  description       String?
  brand             String           @default("The Loops")
  material          String?
  fabricWeightGsm   Int?
  fitType           String?
  careInstructions  String?
  imageUrl          String?
  categoryId        String
  category          Category         @relation(fields: [categoryId], references: [id])
  collectionId      String?
  collection        Collection?      @relation(fields: [collectionId], references: [id])
  supplierId        String?
  supplier          Supplier?        @relation(fields: [supplierId], references: [id])
  variants          ProductVariant[]
  isActive          Boolean          @default(true)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
}

model ProductVariant {
  id              String          @id @default(cuid())
  productId       String
  product         Product         @relation(fields: [productId], references: [id], onDelete: Restrict)
  sku             String          @unique
  barcode         String          @unique
  colorName       String
  colorCode       String          // normalized code, e.g. BLK
  colorHex        String          @default("#000000")
  size            String
  sizeSort        Int             @default(0)
  costMinor       Int             // cost in currency minor units
  retailMinor     Int             // retail price in currency minor units
  wholesaleMinor  Int?
  currencyCode    String          @default("USD")
  reorderPoint    Int             @default(5)
  safetyStock     Int             @default(2)
  balances        StockBalance[]
  movements       StockMovement[]
  poItems         PurchaseOrderItem[]
  saleItems       SaleItem[]
  returnItems     ReturnItem[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([productId, colorCode, size])
  @@index([productId])
}

model StockBalance {
  id                String         @id @default(cuid())
  variantId         String
  variant           ProductVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)
  locationId        String
  location          Location       @relation(fields: [locationId], references: [id], onDelete: Restrict)
  quantityOnHand    Int            @default(0)
  quantityReserved  Int            @default(0)
  quantityDamaged   Int            @default(0)
  rackLocation      String?
  updatedAt         DateTime       @updatedAt

  @@unique([variantId, locationId])
  @@index([locationId])
}

model StockMovement {
  id                String             @id @default(cuid())
  variantId         String
  variant           ProductVariant     @relation(fields: [variantId], references: [id], onDelete: Restrict)
  locationId        String
  location          Location           @relation(fields: [locationId], references: [id], onDelete: Restrict)
  type              StockMovementType
  quantityDelta     Int
  balanceAfter      Int
  unitCostMinor     Int?
  currencyCode      String             @default("USD")
  referenceNo       String?
  sourceType        String?            // OPENING, PO_RECEIPT, SALE, RETURN, COUNT, TRANSFER
  sourceId          String?
  reasonNote        String?
  performedBy       String
  idempotencyKey    String?            @unique
  reversesMovementId String?
  createdAt         DateTime           @default(now())

  @@index([variantId, locationId, createdAt])
  @@index([referenceNo])
  @@index([sourceType, sourceId])
}

model PurchaseOrder {
  id           String              @id @default(cuid())
  poNumber     String              @unique
  supplierId   String
  supplier     Supplier            @relation(fields: [supplierId], references: [id])
  status       PurchaseOrderStatus @default(DRAFT)
  expectedDate DateTime?
  notes        String?
  items        PurchaseOrderItem[]
  receipts     GoodsReceipt[]
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
}

model PurchaseOrderItem {
  id                String         @id @default(cuid())
  purchaseOrderId   String
  purchaseOrder     PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  variantId         String
  variant           ProductVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)
  quantityOrdered   Int
  unitCostMinor     Int
  receivedQuantity  Int            @default(0)

  @@unique([purchaseOrderId, variantId])
}

model GoodsReceipt {
  id              String        @id @default(cuid())
  receiptNumber   String        @unique
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  supplierRef     String?
  status          DocumentStatus @default(DRAFT)
  receivedAt      DateTime      @default(now())
  receivedBy      String
  notes           String?
  lines           GoodsReceiptLine[]
  createdAt       DateTime      @default(now())
}

model GoodsReceiptLine {
  id             String       @id @default(cuid())
  goodsReceiptId String
  goodsReceipt   GoodsReceipt @relation(fields: [goodsReceiptId], references: [id], onDelete: Cascade)
  poItemId       String?
  variantId      String
  locationId     String
  quantity       Int
  unitCostMinor  Int
}

model Sale {
  id          String         @id @default(cuid())
  saleNumber  String         @unique
  status      DocumentStatus @default(DRAFT)
  soldAt      DateTime       @default(now())
  soldBy      String
  channel     String         @default("STORE") // STORE, ONLINE, WHOLESALE
  notes       String?
  items       SaleItem[]
  createdAt   DateTime       @default(now())
}

model SaleItem {
  id             String         @id @default(cuid())
  saleId         String
  sale           Sale           @relation(fields: [saleId], references: [id], onDelete: Cascade)
  variantId      String
  variant        ProductVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)
  locationId     String
  quantity       Int
  unitPriceMinor Int
  unitCostMinor  Int
}

model CustomerReturn {
  id           String         @id @default(cuid())
  returnNumber String         @unique
  originalSaleId String?
  status       DocumentStatus @default(DRAFT)
  returnedAt   DateTime       @default(now())
  processedBy  String
  reason       String?
  items        ReturnItem[]
}

model ReturnItem {
  id              String            @id @default(cuid())
  customerReturnId String
  customerReturn  CustomerReturn    @relation(fields: [customerReturnId], references: [id], onDelete: Cascade)
  variantId       String
  variant         ProductVariant    @relation(fields: [variantId], references: [id], onDelete: Restrict)
  locationId      String
  quantity        Int
  disposition     ReturnDisposition
}

model StockCount {
  id          String         @id @default(cuid())
  countNumber String         @unique
  locationId  String
  status      DocumentStatus @default(DRAFT)
  countedBy   String
  countedAt   DateTime       @default(now())
  notes       String?
  lines       StockCountLine[]
}

model StockCountLine {
  id               String     @id @default(cuid())
  stockCountId     String
  stockCount       StockCount @relation(fields: [stockCountId], references: [id], onDelete: Cascade)
  variantId        String
  expectedQuantity Int
  countedQuantity  Int
  variance         Int
}

model StockTransfer {
  id             String         @id @default(cuid())
  transferNumber String         @unique
  fromLocationId String
  toLocationId   String
  status         DocumentStatus @default(DRAFT)
  transferredBy  String
  notes          String?
  lines          StockTransferLine[]
  createdAt      DateTime       @default(now())
}

model StockTransferLine {
  id              String        @id @default(cuid())
  stockTransferId String
  stockTransfer   StockTransfer @relation(fields: [stockTransferId], references: [id], onDelete: Cascade)
  variantId       String
  quantity        Int
}

model AppUser {
  id          String   @id @default(cuid())
  name        String
  email       String   @unique
  passwordHash String
  role        String   @default("STAFF") // OWNER, MANAGER, STAFF
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
}

model AuditLog {
  id          String   @id @default(cuid())
  userId      String?
  action      String
  entityType  String
  entityId    String
  summary     String
  metadata    String?  // JSON string; avoid storing secrets
  createdAt   DateTime @default(now())

  @@index([entityType, entityId, createdAt])
}
```

### Schema implementation notes

1.  Validate that every quantity is a positive integer at document-line
    level. `quantityDelta` is signed and generated by the service, not
    entered directly by a user.
2.  `StockBalance` is unique by variant and location. Do not use one
    global balance if multiple locations are enabled.
3.  The schema uses `costMinor` and `retailMinor` to avoid
    floating-point currency errors. Configure the store currency and its
    minor-unit convention.
4.  Add a database-level or service-level rule that a sale cannot reduce
    available stock below zero unless an owner explicitly enables
    backorders.
5.  Posted documents and movements must not be physically deleted.
6.  Add indexes based on actual query patterns after measuring
    performance.
7.  For a production deployment, review authentication, database
    migrations, backups, restore testing and concurrency before going
    live.
8.  Prisma enum support and migration behavior should be verified
    against the exact Prisma version used by the project.

------------------------------------------------------------------------

# 5. Stock Operation Workflows

## 5.1 Opening stock (initial inventory setup)

Page: `/stock-ops/opening-stock`

-   Choose the opening stock date and location.
-   Search/select a style.
-   Display its color × size matrix.
-   Enter opening quantity for each variant.
-   Allow CSV import for a large first inventory count.
-   Show total units and estimated inventory cost before posting.
-   Prevent duplicate opening entries for the same variant/location.
-   On confirmation, create `OPENING_STOCK` ledger movements and
    balances atomically.
-   Print or export an opening-stock report.

Opening stock is not a purchase order and should not increase supplier
purchase totals.

## 5.2 Receive additional stock

Page: `/stock-ops/receive`

-   Select an existing purchase order, or choose an approved non-PO
    receipt workflow.
-   Scan barcode or search SKU.
-   Enter quantity received per variant.
-   Support partial deliveries: ordered 100, received 60 now, remaining
    40 later.
-   Record supplier delivery note/invoice reference, receiving date,
    staff member and destination location.
-   Capture actual received unit cost if it differs from the PO
    estimate.
-   Allow damaged-on-arrival quantities to be recorded separately and
    excluded from sellable stock.
-   Preview expected vs received quantities.
-   Post once; update PO received quantities, receipt status, stock
    balance and movement ledger in one transaction.
-   Prevent receiving more than ordered unless an authorized override is
    recorded.

Every separate delivery creates its own `GoodsReceipt` and
`RECEIVE_STOCK` movement. Never replace the previous receipt quantity
with the latest delivery quantity.

## 5.3 Sale / dispatch (stock out)

Page: `/stock-ops/sales`

-   Scan barcode or search SKU.
-   Select location and enter quantity.
-   Show on-hand, reserved and available quantities before posting.
-   Prevent sale quantity from exceeding available quantity by default.
-   Record sale number, channel, staff member, unit selling price and
    cost snapshot.
-   Post sale and `SALE_OUT` movements atomically.
-   A cancelled draft has no stock impact.
-   A posted sale must be reversed through a controlled return/void
    workflow, never deleted.

## 5.4 Customer returns

Page: `/stock-ops/returns`

For each returned item, staff must choose a disposition:

-   **Restock:** clean and sellable; increase sellable on-hand.
-   **Damaged:** not sellable; place in damaged stock or write off.
-   **Quarantine:** needs inspection; keep outside sellable stock until
    approved.

Capture original sale reference, reason, quantity, condition, staff
member and decision. Prevent returned quantity from exceeding the
eligible sold quantity unless a manager override is documented.

## 5.5 Defect / write-off

Page: `/stock-ops/defects`

-   Select SKU, location and quantity.
-   Select defect reason: fabric tear, stain, broken zipper, wrong
    print, missing button, other.
-   Add notes and optional image evidence.
-   Remove units from sellable stock.
-   If retained physically, move to a damaged/quarantine location; if
    discarded, record a write-off.
-   Require manager approval above a configurable quantity/value
    threshold.

## 5.6 Physical stock count and adjustment

Page: `/stock-ops/stock-count`

-   Start a count for a location or selected category.
-   Freeze or snapshot expected quantities at count start.
-   Enter physical counted quantities, optionally blind-count (hide
    expected number).
-   Show variance only after count submission.
-   Require a reason for every variance.
-   Manager reviews and posts adjustments.
-   Create `COUNT_GAIN` or `COUNT_LOSS` movements; never overwrite the
    balance without a ledger event.
-   Keep the count sheet and approval history.

## 5.7 Transfers between locations

Page: `/stock-ops/transfers`

-   Choose source and destination location.
-   Add variant quantities.
-   Reserve or deduct source stock when dispatching.
-   Confirm receipt at destination.
-   Use paired `TRANSFER_OUT` and `TRANSFER_IN` movements linked by one
    transfer document.
-   Support in-transit status if dispatch and arrival happen at
    different times.
-   Company-wide stock must not change because of an internal transfer.

## 5.8 Reservations

Reservations are not physical stock movements. When an order is
reserved, increase `quantityReserved`; when fulfilled, reduce both
`quantityOnHand` and `quantityReserved`; when cancelled, release the
reservation. Keep reservation events/audit history separately if order
management is introduced.

------------------------------------------------------------------------

# 6. Garment Inspector: Full Product Detail

When a user opens `/products/[id]`, show the following sections.

## 6.1 Style information

-   Style code and garment name
-   Brand
-   Collection/drop, season and year
-   Category and optional subcategory
-   Description
-   Fabric composition
-   Fabric weight (GSM or oz)
-   Fit and silhouette
-   Care instructions
-   Product images
-   Supplier/factory
-   Active/discontinued status
-   Created and last-updated timestamps

## 6.2 Variant matrix

Rows represent colors; columns represent sizes. Each cell shows:

-   SKU
-   Barcode
-   On-hand
-   Reserved
-   Available
-   Reorder point
-   Stock status
-   Optional location breakdown

Example:

  Color            XS    S    M    L   XL   Total on-hand
  -------------- ---- ---- ---- ---- ---- ---------------
  Jet Black         5   12   20    8    3              48
  Raw Ecru          2    9   15   11    4              41
  Faded Indigo      4    7   14    6    0              31

Stock status should use **available quantity** for reorder warnings and
clearly distinguish physical on-hand from available-to-sell:

-   Out of stock: on-hand = 0
-   Fully reserved: on-hand \> 0 and available = 0
-   Low stock: available ≤ reorder point
-   Healthy: available \> reorder point

A variant can be physically present but fully reserved. Do not label
that as ordinary out of stock.

## 6.3 Financial metrics

Per variant and aggregated per style:

-   Unit cost
-   Retail price
-   Wholesale price
-   Gross margin percentage: `(retail - cost) / retail × 100`
-   Markup percentage: `(retail - cost) / cost × 100`
-   Current inventory cost value: `on-hand × unit cost`
-   Potential retail value: `on-hand × retail price`
-   Available retail value: `available × retail price`

Handle zero retail price and zero cost safely; show "N/A" rather than
dividing by zero.

For accurate historical inventory valuation, use the cost snapshot
recorded on each receipt/movement and define a costing method (for
example, weighted average). Do not assume today's product cost was
always the historical cost.

## 6.4 Stock placement

-   Location name
-   Rack/bin/shelf reference
-   On-hand and reserved by location
-   Last movement date
-   Quick link to location ledger

## 6.5 Movement history

Filterable timeline with: - Date/time - Movement type - In/out
quantity - Balance after - Unit cost snapshot - Reference number - Staff
member - Reason/note - Related source document

------------------------------------------------------------------------

# 7. Pages and User Experience

## 7.1 Dashboard (`/`)

KPI cards: - Current inventory cost value - Potential retail value -
Total styles - Active variants/SKUs - Total physical on-hand units -
Reserved units and available units - Low-stock variants - Out-of-stock
variants

Charts and lists: - Stock health by variant - Stock value by
collection/category - Fast-moving styles (based on posted sales) -
Recent stock movements - Recent receipts - Reorder suggestions

Clearly state the date range and whether sales figures are gross or net
of returns.

## 7.2 Product catalog (`/products`)

-   Search style code, product name, SKU and barcode.
-   Filter by collection, category, supplier, color, size and stock
    status.
-   Sort and paginate.
-   Show color swatches and aggregate stock.
-   Export filtered results to CSV.
-   Bulk activate/deactivate products; never delete products with
    movement history.

### Add garment wizard

1.  Style information: name, style code, category, collection, fabric,
    fit, care, supplier, images.
2.  Colors: color name, internal color code, hex value.
3.  Sizes: choose a size run and ordering.
4.  Variant generation: preview color × size combinations; exclude
    combinations that are not manufactured.
5.  Pricing and reorder settings: cost, retail, wholesale, reorder
    point, safety stock.
6.  SKU/barcode generation: preview and check uniqueness.
7.  Initial stock: optionally enter opening quantity by variant and
    location, or skip and do it later.
8.  Review and create.

SKU generation should be deterministic and editable before saving, for
example `LP-TEE-001-BLK-M`. Do not regenerate existing SKUs if a product
name changes. Barcode values must be unique and generated using a
supported barcode standard. A Code 128 barcode is suitable for internal
SKUs; use EAN-13 only when valid registered/allocated EAN numbers are
available.

## 7.3 Garment inspector (`/products/[id]`)

Tabs: - Overview - Variants & Stock - Costing & Pricing - Stock
Locations - Movement History - Purchase History

## 7.4 Stock operations (`/stock-ops`)

Provide prominent actions: - Opening stock - Receive stock - Record
sale/dispatch - Customer return - Defect/write-off - Stock count -
Transfer

Use barcode-first entry where practical. Every action should show a
confirmation preview before posting.

## 7.5 Purchase orders (`/purchase-orders`)

-   Supplier directory
-   Create/edit draft PO
-   Add variant lines and quantities
-   Expected delivery date
-   Unit cost and estimated total
-   Partial receipt history
-   Remaining quantity
-   Completion/cancellation workflow

## 7.6 Labels (`/labels`)

-   2 × 3 inch tag template (configurable)
-   Brand/logo
-   Style code
-   Garment name
-   Color and size
-   Retail price and currency
-   Barcode and human-readable SKU
-   Select individual variants or an entire style
-   Print preview and batch printing

Use a real barcode library and verify scanner readability at the target
print size. Keep print CSS separate from the normal application layout.

## 7.7 Reports (`/reports`)

-   Stock on hand by style, variant and location
-   Opening stock report
-   Stock received by date/supplier
-   Sales by style/color/size/date/channel
-   Returns and defects
-   Stock adjustment variance
-   Movement ledger
-   Low-stock/reorder report
-   Inventory valuation
-   Gross margin report
-   Slow-moving/dead-stock report

Allow CSV export. Restrict sensitive cost and margin reports by role.

## 7.8 Settings (`/settings`)

-   Store name, logo and currency
-   Timezone and date format
-   Default location
-   SKU and document-number prefixes
-   Size runs and categories
-   Reorder defaults
-   Staff accounts and roles
-   Backup/export tools

------------------------------------------------------------------------

# 8. Business Rules and Data Integrity

These rules are critical and should be implemented before building
advanced dashboards.

1.  A style code is unique.
2.  A SKU is globally unique.
3.  A barcode is globally unique.
4.  A product cannot have duplicate color-code + size combinations.
5.  A variant must belong to exactly one style.
6.  A stock balance is unique per variant and location.
7.  Quantities must be whole numbers and cannot be negative unless a
    specifically approved backorder feature is introduced.
8.  A sale cannot exceed available stock by default.
9.  A posted stock movement cannot be edited or deleted by normal users.
10. Corrections are made using reversal and replacement movements.
11. Every stock-affecting document is posted atomically with its ledger
    entries and balance updates.
12. A repeated request with the same idempotency key must not post
    twice.
13. Draft and cancelled documents do not change stock.
14. Partial receipts update only the quantities actually received.
15. Transfers must have matching source and destination quantities.
16. Returns must record condition/disposition.
17. Stock count variances require a reason and authorized approval.
18. Product deactivation is preferred over deletion.
19. All financial amounts use integer minor units or a rigorously
    defined decimal strategy.
20. Every write records the acting user and timestamp.

## 8.1 Posting a stock movement safely

Recommended service-layer pseudocode:

``` ts
await prisma.$transaction(async (tx) => {
  // 1. Check idempotency key. If already posted, return prior result.
  // 2. Load the variant/location balance.
  // 3. Validate quantity and business rules.
  // 4. Calculate signed delta and new balance.
  // 5. Reject a negative on-hand or available balance when prohibited.
  // 6. Update StockBalance.
  // 7. Insert immutable StockMovement with balanceAfter.
  // 8. Update the source document/line status and audit log.
  // 9. Return the updated balance and movement.
});
```

For concurrent writes, make sure the balance update is protected against
lost updates. SQLite serializes writes but application-level retry/error
handling is still required. When moving to PostgreSQL, use appropriate
row locking or atomic conditional updates.

## 8.2 Reconciliation

Build an admin-only reconciliation task that: - Replays each
variant/location ledger in timestamp order. - Calculates expected
on-hand. - Compares the result with `StockBalance.quantityOnHand`. -
Reports mismatches without silently changing balances. - Allows an
authorized user to create a documented correction after investigation.

------------------------------------------------------------------------

# 9. API Design

Use route handlers under `src/app/api` or server actions. Keep the
service layer independent of the HTTP interface.

Suggested endpoints:

  Method   Endpoint                   Purpose
  -------- -------------------------- ---------------------------------
  GET      `/api/products`            Search/list styles
  POST     `/api/products`            Create style and variants
  GET      `/api/products/[id]`       Style detail and variant matrix
  PATCH    `/api/products/[id]`       Update style metadata
  GET      `/api/stock/balances`      Current stock by SKU/location
  GET      `/api/stock/movements`     Search movement ledger
  POST     `/api/stock/opening`       Post opening stock
  POST     `/api/stock/receipts`      Post a goods receipt
  POST     `/api/stock/sales`         Post sale/dispatch
  POST     `/api/stock/returns`       Post customer return
  POST     `/api/stock/defects`       Record defect/write-off
  POST     `/api/stock/counts`        Create/post stock count
  POST     `/api/stock/transfers`     Create/post transfer
  GET      `/api/purchase-orders`     List purchase orders
  POST     `/api/purchase-orders`     Create purchase order
  GET      `/api/analytics/summary`   Dashboard metrics
  GET      `/api/reports/stock`       Stock report/export

Use consistent response shapes and meaningful HTTP status codes.
Validate request bodies with Zod and return field-level validation
errors.

------------------------------------------------------------------------

# 10. Security, Roles and Audit

Initial roles:

  -----------------------------------------------------------------------
  Role                                Permissions
  ----------------------------------- -----------------------------------
  Owner                               Full access, settings, users,
                                      cost/margin reports, overrides

  Manager                             Products, purchasing, stock
                                      operations, counts, reports and
                                      approvals

  Staff                               View products and perform permitted
                                      receiving/sales/returns

  Viewer                              Read-only access to permitted pages
  -----------------------------------------------------------------------

Security requirements: - Hash passwords with a modern password hashing
algorithm; never store plaintext passwords. - Use a maintained
authentication solution rather than building password/session security
from scratch. - Enforce permissions on the server for every mutation and
sensitive report. - Protect session cookies and validate CSRF/origin
protections appropriate to the chosen auth approach. - Rate-limit login
and sensitive endpoints. - Do not expose supplier costs, margins or
staff information to unauthorized roles. - Keep an audit log for product
edits, price changes, approvals, user changes and stock operations. -
Never log passwords, session tokens or secrets.

------------------------------------------------------------------------

# 11. Project Directory Structure

``` text
stock-management-loops/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── public/
│   └── logo.svg
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── products/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── stock-ops/
│   │   │   ├── page.tsx
│   │   │   ├── opening-stock/page.tsx
│   │   │   ├── receive/page.tsx
│   │   │   ├── sales/page.tsx
│   │   │   ├── returns/page.tsx
│   │   │   ├── defects/page.tsx
│   │   │   ├── stock-count/page.tsx
│   │   │   ├── transfers/page.tsx
│   │   │   └── history/page.tsx
│   │   ├── purchase-orders/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── labels/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── settings/page.tsx
│   │   └── api/
│   │       ├── products/route.ts
│   │       ├── stock/
│   │       ├── purchase-orders/route.ts
│   │       └── analytics/summary/route.ts
│   ├── components/
│   │   ├── ui/
│   │   ├── app-sidebar.tsx
│   │   ├── app-header.tsx
│   │   ├── product-form/
│   │   ├── variant-matrix.tsx
│   │   ├── stock-status.tsx
│   │   ├── stock-movement-table.tsx
│   │   ├── barcode-scanner-input.tsx
│   │   └── printable-hang-tag.tsx
│   ├── server/
│   │   ├── services/
│   │   │   ├── product.service.ts
│   │   │   ├── stock-ledger.service.ts
│   │   │   ├── receiving.service.ts
│   │   │   ├── sales.service.ts
│   │   │   ├── returns.service.ts
│   │   │   ├── transfers.service.ts
│   │   │   └── reporting.service.ts
│   │   └── validators/
│   └── lib/
│       ├── prisma.ts
│       ├── auth.ts
│       ├── currency.ts
│       ├── sku.ts
│       └── utils.ts
├── .env
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

------------------------------------------------------------------------

# 12. Recommended Technology Choices

-   **Next.js App Router + TypeScript:** application framework and type
    safety.
-   **Tailwind CSS:** styling.
-   **Prisma:** database access and migrations.
-   **SQLite:** local development and small single-user deployments.
-   **PostgreSQL:** recommended production database when multiple
    users/branches write concurrently.
-   **Zod:** request and form validation.
-   **TanStack Table:** catalog, ledger and report tables.
-   **A maintained authentication library:** login, sessions and role
    integration.
-   **A maintained barcode library:** Code 128 generation and print
    output.
-   **A chart library:** dashboard analytics.
-   **React Hook Form (optional):** complex product and receiving forms.

Pin compatible package versions and test the exact Next.js, Prisma and
SQLite versions together. Use `prisma migrate dev` for development
schema changes and `prisma migrate deploy` for deployment; avoid relying
on `db push` as the production migration process.

------------------------------------------------------------------------

# 13. Testing Requirements

Before launch, test at least these scenarios:

1.  Create a style with multiple colors and sizes; confirm correct
    variant count and unique SKUs/barcodes.
2.  Post opening stock; verify balances and ledger entries.
3.  Attempt a second opening entry for the same SKU/location; ensure it
    is blocked.
4.  Receive a partial PO twice; confirm cumulative received quantity and
    remaining quantity are correct.
5.  Double-submit a receipt; confirm idempotency prevents duplicate
    stock.
6.  Sell stock; confirm on-hand and available decrease.
7.  Attempt to sell more than available; confirm rejection.
8.  Reserve stock; confirm available decreases but on-hand does not.
9.  Cancel reservation; confirm available is restored.
10. Return a sellable item; confirm on-hand increases.
11. Return a damaged item; confirm it does not increase sellable stock.
12. Write off defects; confirm stock and audit trail.
13. Post a stock count variance; confirm a gain/loss movement is
    created.
14. Transfer stock; confirm source decreases and destination increases
    by the same amount.
15. Reverse a posted movement; confirm the original remains visible.
16. Reconcile ledger and balances; confirm no mismatch.
17. Test concurrent stock operations on the same SKU.
18. Test role permissions and unauthorized API calls.
19. Restore a database backup and verify data integrity.
20. Print and scan hang tags at actual size.

------------------------------------------------------------------------

# 14. Implementation Roadmap

## Phase 1 --- Foundation

-   Create Next.js project and UI shell.
-   Configure Prisma, SQLite and environment variables.
-   Implement authentication and roles.
-   Add categories, collections, suppliers, locations, products and
    variants.
-   Add seed data.

## Phase 2 --- Core stock engine

-   Implement stock balance and append-only movement ledger.
-   Implement opening stock workflow.
-   Implement additional stock receipts and partial PO receiving.
-   Implement sales/dispatch.
-   Add idempotency and atomic posting.
-   Build stock history and reconciliation.

## Phase 3 --- Daily operations

-   Customer returns and disposition.
-   Defects/write-offs.
-   Reservations.
-   Physical stock counts.
-   Location transfers.

## Phase 4 --- Fashion-specific UX

-   Product wizard and variant matrix.
-   Garment inspector.
-   Barcode scanning and hang-tag printing.
-   Search, filters and CSV import/export.

## Phase 5 --- Analytics and production readiness

-   Dashboard and reports.
-   Reorder suggestions.
-   Inventory valuation and margin reporting.
-   Backup/restore automation.
-   Security, concurrency and performance testing.
-   Production deployment and migration plan.

------------------------------------------------------------------------

# 15. Local Development Setup

## Prerequisites

-   Node.js LTS
-   npm
-   Git

## Initial commands

``` bash
# 1. Create the application
npx create-next-app@latest stock-management-loops --typescript --tailwind --eslint --app --src-dir

cd stock-management-loops

# 2. Install core dependencies
npm install @prisma/client zod
npm install -D prisma tsx

# 3. Initialize Prisma
npx prisma init --datasource-provider sqlite
```

Set `.env`:

``` env
DATABASE_URL="file:./dev.db"
```

Then:

``` bash
# 4. Add the schema and create the development migration
npx prisma migrate dev --name init

# 5. Generate Prisma Client if needed
npx prisma generate

# 6. Seed sample fashion products and variants
npx prisma db seed

# 7. Start the development server
npm run dev
```

Configure the Prisma seed command in `package.json` according to the
installed Prisma version. Use migrations for ongoing schema changes.

------------------------------------------------------------------------

# 16. Final Product Principles

The Loops System must follow these rules:

1.  **A style is not a SKU.** Every color × size combination is its own
    variant.
2.  **Opening stock is recorded once.** It establishes the starting
    point for each variant/location.
3.  **Every later receipt is a new event.** Never overwrite earlier
    stock-in quantities.
4.  **Sales are movements, not edits.** Every posted sale creates
    traceable stock-out records.
5.  **Current stock is auditable.** It comes from the ledger and is
    mirrored in a transactional balance.
6.  **Returns need a condition.** Sellable, damaged and quarantine
    returns must be treated differently.
7.  **Transfers are not sales.** They move stock between locations
    without changing total company stock.
8.  **Posted history is immutable.** Corrections use reversals and new
    movements.
9.  **The balance and ledger update together.** No partial stock
    updates.
10. **The system must always answer:** What was the opening stock? How
    much came in later? How much was sold? What was returned or written
    off? What is physically here now? What is reserved? What can still
    be sold?

**Recommended first development milestone:** Build product/variant
creation, opening stock, additional stock receiving, sales/dispatch and
the movement ledger before spending time on advanced charts. If these
five parts are correct, the rest of the platform has a reliable
foundation.
