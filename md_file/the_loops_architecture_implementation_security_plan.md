# The Loops Universal Retail Suite

## Final Architecture, Backend Structure, Security Standard & Implementation Plan

**Document status:** Proposed target architecture\
**Current project status:** Based on the architecture blueprint and
environment details provided so far. The source code has not yet been
audited, so implementation status and file-level changes must be
verified against the actual repository.

------------------------------------------------------------------------

## 1. Executive Summary

The Loops Universal Retail Suite will support:

1.  **Offline-first Point of Sale (POS):** Stores can continue approved
    checkout operations during internet outages and synchronize
    transactions safely when connectivity returns.
2.  **Central accounting with store-level reporting:** One company-wide
    accounting ledger and chart of accounts, with store, register and
    department dimensions for reporting.
3.  **Central and independent purchasing:** A central warehouse can
    purchase and distribute inventory, while authorized stores can also
    purchase directly from suppliers.
4.  **Three independently owned backend services:** Stock Management,
    Finance/Accounting and POS.
5.  **One API Gateway and one unified React/Vite frontend.**
6.  **JWT-based authentication and server-side authorization**, with
    secure token lifecycle management.
7.  **A gradual transition from the current SQLite/JSON persistence to
    managed MySQL for cloud production**, after an audit and tested
    migration.

The recommended approach is to improve the existing codebase in stages.
Do not rewrite the whole application or migrate databases before the
current implementation has been inspected.

## 2. Current Environment and Assumptions

The current local development arrangement has been described as:

  Component                       Local port Current path
  ----------------------------- ------------ -----------------------------------
  Stock API                             3000 `Stock_management_loops/backend/`
  Finance API                           3001 `account_system_Loops/backend/`
  POS API                               3002 `The_Loop.s_POS/backend/`
  API Gateway                           5000 `gateway/server.js`
  Unified React/Vite frontend           5175 `The_Loop.s_POS/frontend/`
  Root process launcher                  --- `start-all.js`

The current database arrangement was clarified as SQLite, not an active
MySQL deployment. JSON persistence files have also been described:

-   `The_Loop.s_POS/backend/data/pos_state.json`
-   `Stock_management_loops/backend/data/store.json`
-   `account_system_Loops/backend/data/loops_finance_state.json`

The architecture blueprint also describes a possible shared SQLite
database and shared database module. These details must be verified in
source code. In particular, determine whether the services use one
SQLite database, separate SQLite databases, or a mixture of SQLite and
JSON.

**Important distinction:** This document defines the target design. It
does not claim that all target features already exist in the current
code.

## 3. Target High-Level Architecture

``` text
                   Unified React/Vite SPA
          Accounting | Stock | POS | Reports | Admin
                              |
                              v
                     API Gateway :5000
             TLS | Authentication | Authorization
                  Rate Limits | Routing | Audit
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
       Stock API          Finance API         POS API
       :3000              :3001               :3002
             |                |                |
             v                v                v
       Stock DB           Finance DB          POS DB
       MySQL              MySQL               MySQL
             |                |                |
             +----------------+----------------+
                              |
                Reliable Integration Layer
             Outbox / Inbox / Retry / Reconciliation

 POS browser application:
 IndexedDB + durable offline queue + service worker
```

### 3.1 Service ownership

  -----------------------------------------------------------------------
  Service                             Owns
  ----------------------------------- -----------------------------------
  Stock Management                    Products, categories, suppliers,
                                      purchase orders, goods receipts,
                                      warehouses, store stock, transfers,
                                      stock ledger and stock valuation
                                      data

  Finance/Accounting                  Chart of accounts, journals,
                                      general ledger, expenses, supplier
                                      bills, financial periods, tax
                                      accounting and financial reports

  POS                                 Sales, order lifecycle, payment
                                      records, returns/refunds,
                                      registers, shifts, receipts and
                                      offline transaction synchronization

  API Gateway                         External routing, request
                                      authentication, coarse-grained
                                      access checks, rate limits, request
                                      IDs and gateway-level logging

  Unified frontend                    User interface and client-side
                                      experience; it must not be the
                                      authority for business rules or
                                      permissions
  -----------------------------------------------------------------------

A service may request another service to perform an operation, but it
must not directly write to another service's database.

### 3.2 Communication rules

-   Use synchronous REST calls when the user needs an immediate result,
    such as checking a product or submitting a purchase order.
-   Use asynchronous events for business facts that must be delivered
    reliably, such as `SaleCompleted`, `GoodsReceived`,
    `PurchaseApproved` and `StockTransferReceived`.
-   Use a transactional outbox in the source service and an
    inbox/deduplication record in the receiving service.
-   Give each event a globally unique ID and each command a stable
    idempotency key.
-   Retry transient errors with bounded exponential backoff and jitter.
-   Send repeatedly failing messages to a dead-letter or failed-event
    queue for investigation.
-   Provide reconciliation jobs and an operator screen for unresolved
    integration events.
-   Do not report a cross-service operation as fully complete until its
    required business acknowledgements have been recorded.

A MySQL-backed outbox and worker process is sufficient for an initial
deployment. Add RabbitMQ or another broker only when throughput,
isolation or operational needs justify it.

## 4. Backend Structure Standard

Each backend should use a consistent layered structure. Keep the
existing repository paths initially; apply the structure inside each
existing backend rather than performing a disruptive folder rename.

Recommended structure for **each** service:

``` text
backend/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   ├── env.js
│   │   ├── database.js
│   │   ├── logger.js
│   │   └── security.js
│   ├── routes/
│   │   ├── index.js
│   │   └── v1/
│   │       └── <resource>.routes.js
│   ├── controllers/
│   │   └── <resource>.controller.js
│   ├── services/
│   │   └── <resource>.service.js
│   ├── repositories/
│   │   └── <resource>.repository.js
│   ├── models/
│   │   └── <resource>.model.js
│   ├── middleware/
│   │   ├── authenticate.js
│   │   ├── authorize.js
│   │   ├── validate.js
│   │   ├── rate-limit.js
│   │   ├── request-id.js
│   │   ├── error-handler.js
│   │   └── not-found.js
│   ├── validators/
│   │   └── <resource>.schema.js
│   ├── integrations/
│   │   ├── clients/
│   │   ├── events/
│   │   └── outbox/
│   ├── jobs/
│   ├── utils/
│   └── tests/
├── migrations/
├── seeds/
├── data/                 # Development-only/local data where required
├── logs/                 # Normally outside version control
├── package.json
└── README.md
```

Replace `<resource>` with domain names such as `products`, `purchases`,
`sales`, `journals` or `transfers`.

### 4.1 Responsibility of each layer

  -----------------------------------------------------------------------
  Layer                   Responsibility          Must not do
  ----------------------- ----------------------- -----------------------
  Routes                  HTTP paths, methods and Contain business logic
                          middleware composition  

  Middleware              Authentication,         Implement domain
                          authorization,          workflows
                          validation, request     
                          metadata and limits     

  Controllers             Translate HTTP request  Contain SQL or complex
                          into service call and   business rules
                          HTTP response           

  Services                Business rules,         Depend on Express
                          workflows and           request/response
                          transaction             objects
                          coordination            

  Repositories            Database queries and    Decide business policy
                          persistence             

  Models/schemas          Data structures and     Become a second source
                          validation definitions  of business logic

  Integrations            Communicate with other  Bypass service
                          services and process    ownership
                          events                  

  Jobs/workers            Retry, synchronization, Depend on a browser
                          scheduled tasks and     request staying open
                          reconciliation          

  Tests                   Unit, integration,      Use production data
                          contract and end-to-end 
                          verification            
  -----------------------------------------------------------------------

### 4.2 Request flow

``` text
HTTP request
   |
   v
Request ID / structured logging
   |
   v
Rate limiting
   |
   v
JWT authentication
   |
   v
Authorization + organization/store scope
   |
   v
Request validation
   |
   v
Route -> Controller -> Service -> Repository
   |
   v
Database transaction
   |
   v
Outbox event (when required)
   |
   v
Standard response / centralized error handler
```

Use an `app.js` that configures Express and middleware, and a separate
`server.js` that starts listening. This makes automated tests easier
because tests can import the app without opening a network port.

### 4.3 Naming and coding conventions

-   Use consistent plural resource names in REST paths.
-   Use `async/await` and centralized asynchronous error handling.
-   Keep controllers small.
-   Use parameterized SQL or a safely configured ORM.
-   Never concatenate untrusted input into SQL.
-   Validate request bodies, path parameters, query parameters and
    uploaded files.
-   Return consistent error objects with a stable error code and request
    ID.
-   Do not return stack traces, SQL statements, tokens or secrets to
    clients.
-   Use database transactions for multi-row business operations.
-   Add unit tests for service-layer business rules and integration
    tests for repositories and API routes.

Suggested response shape:

``` json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "server-generated-id"
  }
}
```

Suggested error shape:

``` json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request could not be processed."
  },
  "meta": {
    "requestId": "server-generated-id"
  }
}
```

Do not expose internal error details in production responses.

## 5. JWT Authentication and Authorization

JWT means **JSON Web Token**. Use JWT as part of a complete
authentication design, not as a substitute for authorization, secure
sessions or password security.

### 5.1 Recommended token design

Use short-lived access tokens and rotating refresh tokens.

  -----------------------------------------------------------------------
  Token                               Recommended policy
  ----------------------------------- -----------------------------------
  Access token                        Short lifetime, typically 5--15
                                      minutes

  Refresh token                       Longer lifetime, rotated on every
                                      use and revocable

  Password                            Store only a strong salted password
                                      hash

  Signing key                         Strong secret or asymmetric private
                                      key stored in a secret manager
  -----------------------------------------------------------------------

For a browser-based application, a safer default is:

-   Keep access tokens in memory where practical.
-   Store refresh tokens in `HttpOnly`, `Secure`, appropriately
    configured `SameSite` cookies.
-   Do not store long-lived refresh tokens in `localStorage`.
-   Use CSRF protection for cookie-authenticated state-changing
    requests.
-   Use HTTPS everywhere outside local development.
-   Rotate refresh tokens and detect reuse of an already-rotated token.
-   Revoke refresh-token sessions on logout, password reset, account
    disablement or suspected compromise.
-   Maintain a server-side session/refresh-token record so access can be
    revoked operationally.
-   Never put passwords, secrets, sensitive personal information or
    unnecessary authorization data in JWT claims.

### 5.2 JWT claims

Keep claims minimal. A token may contain:

``` json
{
  "sub": "user-id",
  "iss": "https://auth.example.com",
  "aud": "loops-api",
  "iat": 1790000000,
  "exp": 1790000900,
  "jti": "unique-token-id",
  "sid": "session-id",
  "org": "organization-id"
}
```

The exact claims and token format must be consistent across services.
Store and resolve current roles and permissions server-side where
possible; do not rely on a long-lived role claim that may become stale.

### 5.3 JWT verification requirements

Every protected API must verify:

-   Cryptographic signature using an explicitly configured algorithm
    allowlist.
-   Expected issuer (`iss`).
-   Expected audience (`aud`).
-   Expiry (`exp`) and not-before (`nbf`) where used.
-   Token type and intended use.
-   Session/token revocation policy where applicable.

Never accept the algorithm specified by an untrusted token without an
explicit allowlist. Never use `jwt.decode()` as authentication; decoding
does not verify the signature.

Use asymmetric signing such as EdDSA or RS256 when practical: the
authentication issuer holds the private signing key, while API services
receive only the public verification key. If using a shared HMAC secret,
protect and rotate it carefully. The chosen algorithm must be supported
consistently by the selected JWT library and deployment environment.

### 5.4 Authorization and RBAC

Implement backend role-based access control with organization and store
scoping.

Example roles:

-   System Administrator
-   Organization Owner
-   Finance Manager
-   Accountant
-   Stock Manager
-   Purchasing Officer
-   Store Manager
-   Cashier
-   Auditor / Read-only

Authorization must consider:

1.  User identity.
2.  Organization membership.
3.  Store assignment.
4.  Role and explicit permissions.
5.  Resource ownership and business state.

A cashier assigned to Store A must not access Store B's orders by
changing an ID in the URL. Every repository query for tenant-owned data
must include the correct organization and, where relevant, store scope.

Use deny-by-default authorization. Hiding a frontend button is not a
security control.

### 5.5 Password and account security

-   Hash passwords with Argon2id (preferred where supported) or a
    properly configured bcrypt implementation.
-   Never encrypt passwords for later recovery; store one-way hashes.
-   Enforce sensible password length and breached-password screening.
-   Add login rate limits and progressive delays.
-   Avoid account-enumeration messages.
-   Require MFA for administrators, finance approvers and other
    high-privilege accounts.
-   Use secure account recovery with short-lived, single-use tokens.
-   Log security-sensitive events without logging passwords, tokens or
    secrets.

## 6. Cybersecurity Protection Standard

Use the following as the minimum security baseline. Align implementation
and periodic reviews with OWASP ASVS, OWASP API Security Top 10, OWASP
Cheat Sheet Series and applicable privacy and payment-card requirements.

### 6.1 Network and infrastructure

-   Expose only the HTTPS entry point publicly.
-   Keep service ports 3000--3002 and internal database ports private to
    the application network.
-   Do not expose MySQL or SQLite files to the public internet.
-   Use firewall/security-group rules with least privilege.
-   Use TLS for all external traffic and service-to-service traffic
    where deployment topology requires it.
-   Set secure HTTP headers, including an appropriate Content Security
    Policy, HSTS, `X-Content-Type-Options` and clickjacking protection.
-   Restrict CORS to known frontend origins; do not combine wildcard
    origins with credentials.
-   Separate development, staging and production environments.
-   Do not run production processes as root.
-   Patch the operating system, Node.js runtime and dependencies
    regularly.

### 6.2 API and application security

-   Validate all input on the server.
-   Use parameterized queries.
-   Apply request body size limits and upload restrictions.
-   Rate-limit login, password recovery, expensive reports and sensitive
    endpoints.
-   Protect against brute force, credential stuffing and automated
    abuse.
-   Use CSRF protection when authentication relies on cookies.
-   Use output encoding and safe React rendering to reduce XSS risk.
-   Avoid unsafe HTML injection.
-   Protect against IDOR/BOLA by checking object-level permissions on
    every request.
-   Use explicit allowlists for mass assignment; do not pass arbitrary
    request bodies directly into database updates.
-   Set timeouts and limits on outbound HTTP calls.
-   Validate webhook signatures and timestamps; reject replayed webhook
    events.
-   Use idempotency keys for payment, sale, refund and other retryable
    commands.
-   Do not reveal whether a user, email address or account exists
    unnecessarily.

### 6.3 Database security

-   Use separate database users for each service.
-   Grant each service access only to its own database and required
    operations.
-   Never use a database root account in the application.
-   Encrypt backups and protect backup credentials.
-   Use encrypted storage and managed encryption keys in production.
-   Restrict database network access to approved application hosts.
-   Use migrations reviewed and tested before production deployment.
-   Audit sensitive changes and privileged reads where appropriate.
-   Test restoration, not just backup creation.
-   Avoid storing payment-card PAN, CVV or track data. Use a
    PCI-compliant payment provider and tokenization; never store CVV
    after authorization.

### 6.4 Secrets management

-   Keep secrets out of source code, Git history, frontend bundles, logs
    and error messages.
-   Use a secret manager or protected deployment environment variables.
-   Commit only `.env.example` with placeholder values.
-   Rotate database passwords, JWT signing keys, API keys and webhook
    secrets.
-   Maintain separate keys per environment.
-   Have a documented emergency key-rotation procedure.
-   If a secret is committed or exposed, revoke/rotate it immediately;
    deleting it from the latest commit is not sufficient.

### 6.5 Logging, monitoring and incident response

Log:

-   Authentication successes and failures.
-   Permission denials.
-   Password resets and MFA changes.
-   Role and store-assignment changes.
-   Financial approvals and journal postings.
-   Stock adjustments, transfers and refunds.
-   Integration failures and reconciliation outcomes.
-   Administrative configuration changes.

Logs should include timestamp, request ID, actor ID, organization/store
context, action, target record and outcome where appropriate.

Never log passwords, access tokens, refresh tokens, full payment-card
data, secret keys or unnecessary personal information.

Set alerts for repeated login failures, unusual privilege changes,
repeated API errors, failed backups, outbox backlog growth, database
capacity and suspicious access patterns.

Prepare an incident plan covering containment, credential/key rotation,
evidence preservation, notification obligations, recovery and
post-incident review.

### 6.6 Dependency and software supply-chain security

-   Pin and review dependency versions.
-   Run dependency vulnerability scans in CI.
-   Remove unused packages.
-   Use lockfiles and reproducible builds.
-   Protect the main branch and require code review for production
    changes.
-   Scan for accidentally committed secrets.
-   Generate and retain software bills of materials (SBOMs) where
    practical.
-   Build production artifacts in controlled CI environments.
-   Review container images and use minimal, patched base images.

### 6.7 Retail-specific fraud and operational controls

-   Require approval for high-value refunds, stock adjustments and
    purchasing.
-   Maintain immutable audit history for financial and stock movements.
-   Separate duties where practical: a user who creates a supplier bill
    should not necessarily approve its payment.
-   Record cashier, register, shift and store on every POS transaction.
-   Reconcile cash drawers, card settlements and sales totals.
-   Detect duplicate payment callbacks and duplicate offline uploads.
-   Require reason codes for voids, refunds, discounts and stock
    adjustments.
-   Apply limits to offline discounts, refunds and cash operations.
-   Alert on repeated failed syncs or unusually large offline
    transaction batches.

## 7. Offline-First POS Design

### 7.1 Local components

The POS frontend should become a Progressive Web App (PWA) with:

-   Service worker for application-shell caching.
-   IndexedDB for local catalogue/configuration and durable transaction
    records.
-   Durable pending-sync queue.
-   Device identity and register identity.
-   Local sequence numbers and globally unique transaction IDs.
-   Clear connection and synchronization status.

Do not rely on browser cache or `localStorage` as the only storage for
completed sales. IndexedDB is the appropriate browser database for
structured, durable offline records, but the application must still
handle storage quota errors, device loss and browser data clearing.

### 7.2 Offline transaction lifecycle

``` text
Cashier completes checkout
        |
        v
Validate against locally cached rules
        |
        v
Persist sale + payment record in IndexedDB
        |
        v
Return receipt / local confirmation
        |
        v
Queue transaction for synchronization
        |
        v
Connection restored
        |
        v
Upload with stable sale ID + idempotency key
        |
        v
Server validates and records transaction
        |
        +------> Stock event
        |
        +------> Finance event
        |
        v
Server acknowledgement
        |
        v
Mark local record synchronized
```

The POS must not delete the local transaction merely because it received
an HTTP response. Retain an auditable local record according to a
defined retention policy.

### 7.3 Offline safeguards

-   Do not overwrite cloud stock with local stock.
-   Treat offline stock as an estimate based on the last synchronized
    snapshot and local sales.
-   Define behavior for two stores selling the same remaining stock
    while disconnected.
-   Restrict offline price changes and discounts.
-   Define offline refund/void policy.
-   Only allow payment methods that explicitly support the intended
    offline mode.
-   Encrypt sensitive local data where feasible and protect access to
    the device.
-   Provide device deactivation and remote session revocation when the
    device reconnects.
-   Test browser restart, power loss, storage errors, duplicate uploads
    and partial synchronization.

## 8. Central Accounting and Store-Level Reporting

Use one company-wide general ledger and chart of accounts, with
reporting dimensions.

Recommended dimensions on financial source transactions and journal
lines:

-   `organization_id`
-   `store_id` (nullable only for genuinely central transactions)
-   `department_id` (optional)
-   `source_service`
-   `source_transaction_id`
-   `transaction_date`
-   `account_id`

Reports should support consolidated company totals and individual store
views:

-   Profit and loss.
-   Revenue and discounts.
-   Cost of goods sold.
-   Operating expenses.
-   Cash and card clearing.
-   Inventory valuation.
-   Accounts payable.
-   Tax summaries.
-   Register and cashier reconciliation.

A store is a reporting dimension under the central company ledger, not a
separate legal entity unless the company's legal/accounting structure
requires that.

Journal entries must balance. Finance owns journal posting and
accounting periods. POS supplies sales/payment facts; Stock supplies
inventory valuation and movement facts. Finance validates and posts the
resulting accounting entries.

## 9. Inventory: Central and Independent Purchasing

Support two purchasing routes using one consistent inventory ledger.

### 9.1 Central purchasing

``` text
Supplier
  -> Central purchase order
  -> Central goods receipt
  -> Central warehouse stock
  -> Transfer request
  -> Dispatch
  -> Store receipt
  -> Store stock
```

### 9.2 Independent store purchasing

``` text
Store purchase request/order
  -> Approval according to policy
  -> Supplier delivery to store
  -> Store goods receipt
  -> Store stock
  -> Supplier bill / Finance workflow
```

### 9.3 Required controls

-   Purchase approval limits by role and store.
-   Separate purchase order, goods receipt and supplier bill states.
-   Partial receipts and backorders.
-   Dispatch and receipt confirmation for transfers.
-   Variance handling for damaged, missing or excess quantities.
-   Stock ledger entries for every movement.
-   Supplier and purchase document references.
-   Store and warehouse stock balances.
-   Inventory valuation policy consistently applied by Finance and
    Stock.

## 10. Database and Persistence Strategy

### 10.1 Transition strategy

  -----------------------------------------------------------------------
  Stage                               Recommendation
  ----------------------------------- -----------------------------------
  Current development                 Keep SQLite while auditing the
                                      current implementation

  Production target                   Managed MySQL 8

  Offline browser POS                 IndexedDB

  JSON files                          Use only for explicit
                                      import/export, backup or a defined
                                      recovery mechanism; not as a
                                      competing source of truth
  -----------------------------------------------------------------------

For an initial cloud deployment, one managed MySQL server can host three
separately owned logical databases:

-   `loops_stock`
-   `loops_finance`
-   `loops_pos`

Each service gets its own restricted database user. Cross-service
operations must use APIs/events, not direct cross-database writes.

### 10.2 Audit the current persistence first

Determine:

-   Which SQLite file each service actually opens.
-   Whether a shared SQLite file is used.
-   Whether JSON files are read, written or used only as fallback.
-   Whether both SQLite and JSON can be modified for the same
    transaction.
-   How writes are made atomic.
-   What happens after process termination during a write.
-   Whether migrations and backups exist.
-   Whether all services can safely run concurrently.

Do not allow SQLite, JSON and MySQL to become three competing
authorities for the same business records.

### 10.3 Migration controls

-   Create versioned MySQL migrations.
-   Back up SQLite and JSON data before conversion.
-   Migrate into a staging database first.
-   Compare record counts and key totals.
-   Reconcile stock quantities against stock ledger movements.
-   Reconcile trial balance and journal totals.
-   Reconcile POS orders, payments and refunds.
-   Run the old and new systems in a controlled validation period if
    necessary.
-   Define a rollback and cutover plan.
-   Never perform an untested migration directly on production data.

## 11. Multi-Store Data Model

At minimum, design or verify these entities:

  Entity                   Purpose
  ------------------------ -------------------------------------
  organizations            Tenant/company
  users                    User identities
  roles / permissions      Authorization policy
  user_store_assignments   User access to stores
  stores                   Retail branches
  warehouses               Central or regional stock locations
  registers                POS terminals
  shifts                   Cashier/register shifts
  products                 Product catalogue
  product_variants         Product options/SKUs
  stock_balances           Quantity by product and location
  stock_ledger             Immutable movement history
  suppliers                Supplier records
  purchase_orders          Central or store procurement
  goods_receipts           Actual received quantities
  stock_transfers          Inter-location transfers
  pos_orders               Sales
  pos_payments             Payment records
  journal_entries          Accounting postings
  journal_lines            Debit/credit details
  integration_outbox       Events awaiting publication
  integration_inbox        Received event deduplication
  audit_logs               Security and business audit history

Use organization and location foreign keys consistently. Add database
indexes for common organization/store/date queries. Use unique
constraints for business identifiers and idempotency keys.

## 12. Cloud Deployment Target

Recommended initial production arrangement:

-   React/Vite static frontend hosted behind HTTPS/CDN.
-   API Gateway behind HTTPS load balancing.
-   Three Node.js backend services deployed as separate
    processes/containers.
-   Background outbox and reconciliation workers.
-   Managed MySQL with private networking.
-   Centralized secret management.
-   Object storage for documents, exports and backups where appropriate.
-   Centralized logs, metrics and alerting.
-   Automated encrypted backups and point-in-time recovery.
-   Separate development, staging and production environments.

Start with Docker Compose locally and a modest cloud deployment. Do not
introduce Kubernetes until scale and operational requirements justify
it.

## 13. Implementation Plan for the Existing Codebase

### Phase 1 --- Code and persistence audit

Inspect:

-   `start-all.js`
-   `gateway/server.js`
-   `Stock_management_loops/backend/`
-   `account_system_Loops/backend/`
-   `The_Loop.s_POS/backend/`
-   `The_Loop.s_POS/frontend/`
-   `shared/database/`
-   All three JSON persistence modules/files
-   Existing integration clients, event handlers and tests

Deliverables:

-   Actual service and route inventory.
-   Database ownership and persistence map.
-   Authentication and authorization audit.
-   Integration dependency map.
-   List of existing features to preserve.
-   Prioritized defects and missing functionality.

### Phase 2 --- Backend structure and security foundation

-   Introduce `app.js` and `server.js` separation.
-   Standardize routes, controllers, services and repositories.
-   Add centralized validation and error handling.
-   Add request IDs and structured logging.
-   Implement JWT verification and refresh-token lifecycle.
-   Add role, organization and store authorization middleware.
-   Add rate limits, secure headers and CORS policy.
-   Add automated security and API tests.

Do this service by service, keeping each service runnable after each
change.

### Phase 3 --- Integration reliability

-   Standardize API contracts and event schemas.
-   Implement outbox/inbox.
-   Add idempotency and duplicate-event protection.
-   Add retry/backoff and failed-event handling.
-   Add reconciliation jobs and monitoring.
-   Test purchase, goods receipt, sale, refund and transfer flows end to
    end.

### Phase 4 --- Multi-store operations

-   Add organization/store/warehouse/register context.
-   Add central and store purchasing policies.
-   Add stock transfers and receipt confirmation.
-   Add store-level financial dimensions.
-   Add consolidated and per-store reports.
-   Test data isolation between stores and organizations.

### Phase 5 --- Offline POS

-   Add PWA/service worker.
-   Add IndexedDB schema and versioning.
-   Add local transaction persistence.
-   Add synchronization queue and idempotent upload API.
-   Add sync status and failed transaction reconciliation UI.
-   Define offline payment/refund/discount restrictions.
-   Test outages, restarts, duplicate uploads and concurrent store
    sales.

### Phase 6 --- MySQL migration

-   Design service-owned MySQL schemas.
-   Add migrations and indexes.
-   Migrate SQLite data in staging.
-   Reconcile stock, sales, payments and accounting.
-   Test backup/restore and rollback.
-   Cut over only after acceptance criteria pass.

### Phase 7 --- Production deployment

-   Containerize services and workers.
-   Configure HTTPS, private networking and secrets.
-   Set up monitoring, alerts and audit retention.
-   Configure backup and recovery.
-   Run load, security and disaster-recovery tests.
-   Complete production readiness review.

## 14. Testing and Acceptance Criteria

  Test                                        Expected result
  ------------------------------------------- -------------------------------------------
  Start/stop all services                     Clean startup, health checks and shutdown
  Invalid/expired JWT                         Request rejected
  Wrong issuer/audience/signature             Request rejected
  Revoked refresh token                       Cannot renew session
  Store A user accesses Store B               Access denied
  Cashier invokes finance approval endpoint   Access denied
  SQL injection payload                       No query manipulation
  Repeated login attempts                     Rate limited and logged
  Product update                              Correct authorized stores receive update
  Central purchase                            Receipt, stock and finance reconcile
  Independent purchase                        Correct store stock increases
  Transfer                                    Dispatch and receipt are traceable
  Online sale                                 Stock and accounting update once
  Offline sale                                Sale is durably recorded locally
  Reconnect                                   Sale synchronizes exactly once
  Duplicate event                             No duplicate stock movement or journal
  Integration service unavailable             Retry and failure visibility
  Store reports                               Store totals reconcile to company totals
  Backup restoration                          Data restored and reconciled
  Security event                              Useful audit record without secrets

Production acceptance should include at least two stores, one central
warehouse, two registers, multiple user roles, an internet outage
simulation and a full restore test.

## 15. Recommended Repository Direction

This is a possible long-term layout. Do not rename the current folders
until the audit confirms the build and import paths.

``` text
The-Loops/
├── start-all.js
├── gateway/
│   └── server.js
├── Stock_management_loops/
│   └── backend/
├── account_system_Loops/
│   └── backend/
├── The_Loop.s_POS/
│   ├── backend/
│   └── frontend/
├── shared/
│   ├── contracts/
│   ├── authentication/
│   └── integration/
├── workers/
│   ├── outbox-worker/
│   └── reconciliation-worker/
├── infrastructure/
│   ├── docker/
│   └── deployment/
└── documentation/
    ├── architecture/
    ├── api/
    ├── security/
    └── testing/
```

Within each backend, use the layered structure in Section 4.

## 16. Security and Production Readiness Checklist

-   [ ] HTTPS enforced in production.
-   [ ] JWT signature, issuer, audience and expiry validated.
-   [ ] Refresh-token rotation and revocation implemented.
-   [ ] MFA enabled for privileged users.
-   [ ] Passwords securely hashed.
-   [ ] Backend RBAC and organization/store scoping tested.
-   [ ] CORS allowlist configured.
-   [ ] CSRF protection enabled where cookie authentication is used.
-   [ ] Rate limiting enabled.
-   [ ] Input validation and parameterized queries used.
-   [ ] Secrets removed from source control and frontend bundles.
-   [ ] Database users follow least privilege.
-   [ ] Sensitive logs are redacted.
-   [ ] Audit trails cover financial, stock and access changes.
-   [ ] Dependencies and container images scanned.
-   [ ] Encrypted backups and restore tests completed.
-   [ ] Incident response and key rotation procedures documented.
-   [ ] Payment data handled by a compliant payment provider.
-   [ ] Offline POS device and synchronization controls tested.

## 17. Standards and Further Reading

Use current versions of these authoritative security references during
implementation:

-   OWASP Application Security Verification Standard (ASVS):
    https://owasp.org/www-project-application-security-verification-standard/
-   OWASP API Security Top 10: https://owasp.org/API-Security/
-   OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/
-   JSON Web Token standards, RFC 7519:
    https://www.rfc-editor.org/rfc/rfc7519
-   JWT Best Current Practices, RFC 8725:
    https://www.rfc-editor.org/rfc/rfc8725
-   Node.js security guidance:
    https://nodejs.org/en/learn/getting-started/security-best-practices
-   MySQL documentation: https://dev.mysql.com/doc/

Security controls should be reviewed against the actual threat model,
payment provider requirements, local laws and deployment environment.
This document is an engineering baseline, not a formal security
certification.

## 18. Final Recommendation

The target architecture is:

-   Three independently owned backend services: Stock, Finance and POS.
-   One API Gateway and one unified React/Vite frontend.
-   A consistent backend structure with routes, middleware, controllers,
    services, repositories, validators, integrations, jobs and tests.
-   JWT-based authentication with secure refresh-token handling and
    server-side RBAC.
-   Central accounting with store-level dimensions and reports.
-   Central warehouse distribution plus independent store purchasing.
-   Offline-first POS using IndexedDB and a durable synchronization
    queue.
-   Reliable service integration using outbox/inbox, idempotency,
    retries and reconciliation.
-   SQLite retained during the audit and development stabilization;
    managed MySQL adopted for production after verified migration.
-   Layered cybersecurity controls covering application, API, identity,
    network, database, secrets, monitoring, backups and incident
    response.

**Implementation rule:** Audit first, preserve working business logic,
improve one service at a time, test every cross-service workflow, and
migrate to production infrastructure only after data reconciliation and
recovery tests pass.
