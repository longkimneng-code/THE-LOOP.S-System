# The Loops System — Universal Retail Management Platform

A physical product inventory, sales, purchasing, and business management OS designed for diverse retail verticals (Electronics, Cosmetics, Bags, Jewelry, Stationery, Footwear, Apparel, Homeware, and General Merchandise).

## System Architecture & Live Application
- **Live Local Server**: `http://localhost:3000` (`npm start` or `node backend/src/server.js`)
- **Master Plan & Architecture**: 👉 **[STOCK_SYSTEM_PLAN.md](./STOCK_SYSTEM_PLAN.md)**
- **Database Schema**: 👉 **[backend/prisma/schema.prisma](./backend/prisma/schema.prisma)**

### Directory Structure
```text
Stock_management_loops/
├── backend/
│   ├── data/store.json             # Seeded universal multi-location retail data
│   ├── prisma/schema.prisma        # Complete 28-model universal retail schema
│   ├── src/
│   │   ├── db.js                   # Universal JSON & Ledger repository engine
│   │   └── server.js               # Express API & static frontend server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/             # 17 modular React components
│   │   ├── App.jsx                 # Main state & view coordinator
│   │   └── api.js                  # Axios client for backend endpoints
│   ├── dist/                       # Optimized production build bundle
│   ├── vite.config.js
│   └── package.json
└── package.json                    # Root orchestration scripts
```

### Universal Core Capabilities
- **Non-Food Retail Agnostic:** Multi-industry support without hardcoded fashion assumptions.
- **Single & Multi-Variant Products:** Configurable attribute matrix (Model, Shade, Capacity, Finish, Size, Color). Products without variants automatically receive a default SKU.
- **Append-Only Stock Ledger:** Strict audit trail recording every inventory inflow, outflow, transfer, and adjustment.
- **Multi-Location Inventory:** Flagship stores, warehouse distribution hubs, and storage rooms with stock-neutral transfers.
- **Sales & Customer Orders:** POS terminal with customer linking, discounts, taxes, and return inspection workflows.
- **Purchasing & Goods Receipt:** Purchase orders, partial delivery receiving, and vendor tracking.
- **Export & Reporting:** Instant 1-click downloads for Excel (`.xlsx`), PDF (`.pdf`), Word (`.doc`), and CSV (`.csv`).

---
*The Loops Retail Cloud Platform.*
