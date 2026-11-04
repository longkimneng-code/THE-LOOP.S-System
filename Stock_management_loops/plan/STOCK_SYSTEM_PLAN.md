# 🌐 The Loops System — Universal Retail Management Platform
## Complete Architecture, Universal Data Model & Multi-Industry Specification

> **Target Platform:** Universal Physical Product Retail OS  
> **Supported Retail Verticals:** Electronics & Tech, Cosmetics & Beauty, Bags & Luggage, Jewelry & Watches, Stationery & Gifts, Footwear, Apparel, Homeware & Lifestyle, General Merchandise (*Explicitly excluding Food & Beverage*).  
> **Architecture:** Multi-Business (Tenant Isolation), Multi-Location, Configurable Variant Attributes, Append-Only Stock Movement Ledger.  
> **Tech Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Prisma ORM + SQLite (Local) / PostgreSQL (Production).  

---

## 1. Executive Summary & Transformation

**The Loops System** has been refactored from a fashion-specific system into a **Universal Retail Inventory and Business Management Platform**.

### Key Architectural Shifts:
1. **Terminology De-coupling**:
   * *Garment Catalog* $\rightarrow$ **Product Catalog**
   * *Garment* $\rightarrow$ **Product**
   * *Garment Inspector* $\rightarrow$ **Product Details**
   * *Garment Variant* $\rightarrow$ **Product Variant**
   * *Size/Color Matrix* $\rightarrow$ **Variant Matrix** (Attribute-agnostic)
   * *Fashion Inventory* $\rightarrow$ **Inventory Management**
2. **Product Flexibility**:
   * Products can have **No Variants** (Single default SKU created automatically) or **Multiple Variants** (configurable option dimensions such as *Model*, *Shade*, *Storage Capacity*, *Finish*, *Material*, *Size*, *Color*).
3. **Multi-Location Invariance**:
   * Stock balances are strictly tracked per `(SKU, Location)`.
   * Inter-store transfers create offsetting `STOCK_TRANSFER_OUT` and `STOCK_TRANSFER_IN` movements, conserving company-wide stock.
4. **Append-Only Movement Ledger**:
   * `Available = On-Hand − Reserved`.
   * Movements are permanent and immutable. Corrections create new offsetting records.

---

## 2. Universal 9-Tab Navigation

```
1. 📊 Dashboard            — Valuation (COGS vs Retail), Today's Sales, Replenishment Triggers, Movement Stream
2. 📦 Product Catalog       — Multi-category filtering, Search, Universal New Product Wizard (Single/Multi-Variant)
3. 🔄 Inventory Management  — Location Balances by SKU, Append-only Movement Ledger, Stock Adjustments
4. 💳 Sales & Orders        — Retail POS Terminal, Customer Linking, Payment Methods, Returns with Disposition
5. 🚚 Purchasing & Suppliers — Supplier Profiles, PO Lifecycle, Partial Shipments, Goods Receipt (GRN)
6. 👥 Customers             — Customer Profiles, Purchase History, Lifetime Value, Total Spend
7. 📈 Reports & Analytics   — Asset Valuation, Gross Margin %, Product Velocity, Low-Stock / OOS Reports
8. 🏬 Stores & Locations    — Flagship Stores, Warehouses, Storage Rooms, Stock Transfers
9. ⚙️ Settings & Attributes  — Business Identity, Taxes, Custom Attribute Studio (Color, Model, Shade, Size, etc.)
```

---

## 3. Data Model & Prisma Entity Relationships

```
[Business] 1 ──── N [Location]
    │
    ├── 1 ──── N [Category]
    ├── 1 ──── N [Brand]
    ├── 1 ──── N [Supplier] ──── N [PurchaseOrder] ──── N [GoodsReceipt]
    ├── 1 ──── N [Customer] ──── N [Sale] ──── N [Payment]
    │
    └── 1 ──── N [Product] ──── N [ProductVariant / SKU]
                                     │
                                     ├── 1 ──── N [StockBalance] (per Location)
                                     │                 │
                                     │                 └── 1 ──── N [StockMovement]
                                     │
                                     ├── N ──── N [ProductAttributeValue]
                                     ├── 1 ──── N [StockTransferItem]
                                     └── 1 ──── N [StockCountItem]
```

### Complete Schema Reference
The production-grade schema is located at [`prisma/schema.prisma`](./prisma/schema.prisma) with all 28 core universal models:
`Business`, `BusinessSettings`, `AppUser`, `Role`, `Permission`, `Location`, `Category`, `Brand`, `Product`, `ProductImage`, `ProductAttribute`, `ProductAttributeValue`, `ProductVariant`, `SKU`, `Supplier`, `StockBalance`, `StockMovement`, `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceipt`, `GoodsReceiptItem`, `Sale`, `SaleItem`, `Payment`, `Customer`, `CustomerReturn`, `CustomerReturnItem`, `StockTransfer`, `StockTransferItem`, `StockCount`, `StockCountItem`, and `AuditLog`.

---

## 4. Universal Movement Types

| Movement Type | Signed Delta | Triggering Operation | Description |
| :--- | :---: | :--- | :--- |
| `OPENING_STOCK` | `+` | System Onboarding | Initial baseline entered when business launches. |
| `RECEIVE_STOCK` | `+` | PO Delivery / GRN | Vendor delivery received against purchase orders. |
| `SALE_OUT` | `−` | Completed Retail Sale | Deducted upon payment completion at register or POS. |
| `CUSTOMER_RETURN` | `+` | Return Inspection | Items returned by customer approved as sellable. |
| `SUPPLIER_RETURN` | `−` | Defective Batch Out | Goods sent back to supplier for credit/replacement. |
| `DAMAGED_STOCK` | `−` | Defect Write-Off | Moved out of sellable on-hand into damaged quarantine. |
| `STOCK_ADJUSTMENT` | `±` | Physical Stocktake | Discrepancy corrections from cycle counts. |
| `STOCK_TRANSFER_OUT`| `−` | Inter-Store Transfer | Dispatched from source location. |
| `STOCK_TRANSFER_IN` | `+` | Inter-Store Transfer | Received at destination location. |
| `RESERVED_STOCK` | `0` | Order Hold | Deducts available (`onHand - reserved`) without changing physical on-hand. |
| `RELEASE_RESERVED_STOCK`| `0`| Order Cancellation | Releases held units back to available stock. |

---

## 5. Universal Retail Data Portability Suite

The platform includes a client-side export engine:
* **Microsoft Excel (`.xlsx`)**: Native multi-sheet workbook with formulas and column styling.
* **Executive PDF Report (`.pdf`)**: Formal stock valuation report with certified signature lines for internal and external auditors.
* **Microsoft Word (`.doc`)**: Structured document format for documentation.
* **Universal CSV (`.csv`)**: Clean UTF-8 BOM encoding for ERP/POS compatibility.
