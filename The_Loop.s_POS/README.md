# 🏬 The Loop.s POS Terminal

> Universal Point of Sale (POS) system for **The Loops System**, integrated directly with **Stock Management Loops** and **Account System Loops**.

---

## 📌 Architecture & Integration Overview

- **Port Allocation**: Backend API on `Port 3002`, Frontend Web App on `Port 5175`.
- **Master Plan**: Refer to the complete specification in [`../THE_LOOPS_POS_INTEGRATED_SYSTEM_PLAN.md`](../THE_LOOPS_POS_INTEGRATED_SYSTEM_PLAN.md).
- **Core Integrations**:
  - **Single Identity Hub**: Users created at any dashboard (POS, Stock, or Finance) automatically have access across all three platforms with RBAC roles and Cashier PIN support.
  - **Stock Management Loops (`Port 3000`)**: Immediate `SALE_OUT` deduction from the append-only stock movement ledger upon checkout.
  - **Account System Loops (`Port 3001`)**: Automatic paid invoice generation and double-entry general ledger posting (`Dr Cash / Cr Sales Revenue`, `Dr Landed COGS / Cr Inventory Asset`).

---

## 🚀 Quick Start (Planned)

```bash
# Backend (Port 3002)
npm run dev:backend

# Frontend (Port 5175)
npm run dev:frontend
```

