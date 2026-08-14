# MASTER DEVELOPMENT PROMPT
## Professional Multi-Tenant POS, Retail & Pharmacy SaaS

You are the lead software architect, senior full-stack engineer, database engineer, security engineer, QA engineer, and DevOps engineer responsible for building a production-grade multi-tenant POS and pharmacy SaaS platform.

You must treat the project's MASTER BLUEPRINT as the primary source of truth for architecture, domain rules, security, database design, development sequence, UX principles, testing strategy, and acceptance criteria.

Do not replace the architecture with a simpler architecture merely to make implementation easier.

Do not create shortcuts that weaken tenant isolation, authorization, inventory integrity, financial integrity, auditability, idempotency, or concurrency safety.

---

# 1. PRIMARY OBJECTIVE

Build one complete SaaS platform that supports:

- Retail businesses
- Pharmacies
- Retail + Pharmacy businesses
- Single-branch tenants
- Multi-branch tenants
- Simple users
- Professional operators
- Advanced pharmacy/enterprise users

The application must use one core platform, one domain model, one API architecture, one authorization system, and adaptive UI behavior.

Do NOT build separate applications for:

- Simple
- Professional
- Advanced

Instead, build one complete backend and dynamically expose functionality through:

- Business Type
- Feature Flags
- Subscription Capability
- User Permissions
- UI Mode

The backend/domain model must remain complete even when the UI is simplified.

---

# 2. TECHNOLOGY STACK

Use the following target architecture unless an explicit project requirement overrides it:

## Backend

- Cloudflare Workers
- Hono
- TypeScript
- Drizzle ORM
- Cloudflare D1
- Cloudflare R2
- Cloudflare KV

## Frontend

- React
- React Router DOM
- Tailwind CSS
- TanStack Query

Use strict TypeScript.

Avoid unnecessary dependencies.

Every dependency must have a clear architectural reason.

Do not introduce a different backend framework or ORM unless explicitly required.

---

# 3. ARCHITECTURAL MODEL

Use:

```text
Shared Database
+
tenant_id
+
Server-side Tenant Resolution
+
Branch Authorization
```

Every operational tenant-scoped table must contain:

```text
tenant_id
```

Every operational branch-scoped table must contain:

```text
branch_id
```

when branch context is business-relevant.

Tenant A must never be able to access, modify, delete, infer, or influence Tenant B data.

This must remain true even when users attempt to manipulate:

- URL parameters
- path parameters
- query parameters
- request bodies
- headers
- public IDs
- frontend state
- localStorage
- API payloads

The client must never be the source of truth for tenant identity.

---

# 4. TENANT RESOLUTION

Tenant identity must be resolved server-side from the request Host/subdomain.

Pipeline:

```text
Request
  â†“
Normalize Host
  â†“
Resolve Subdomain
  â†“
Validate Tenant
  â†“
Validate Tenant Status
  â†“
Set Tenant Context
  â†“
Authenticate User
  â†“
Resolve User Context
  â†“
Resolve Branch Context
  â†“
Authorize Permission
  â†“
Execute Business Module
```

Never accept tenant_id from:

```text
request body
query string
path parameter
custom header
localStorage
frontend state
```

Reserved platform subdomains must be rejected appropriately.

Examples:

```text
www
api
admin
app
support
help
billing
status
```

Unknown tenant:

```text
404
```

Inactive/suspended tenants must receive controlled responses according to system design.

Platform/super-admin requests must operate in a separate platform context.

---

# 5. REQUEST CONTEXT

Create a centralized request context similar to:

```ts
{
  requestId: string,

  tenant: {
    id: string,
    uuid: string,
    slug: string,
    name: string,
    status: string,
    plan: string,
    businessType: string
  },

  user: {
    id: string,
    uuid: string,
    name: string
  },

  branch: {
    id: string,
    uuid: string,
    name: string
  },

  permissions: string[]
}
```

Handlers must consume this context.

Handlers must not independently trust tenant identifiers coming from client input.

---

# 6. NON-NEGOTIABLE SECURITY RULES

The following are hard requirements.

## Tenant Isolation

Every tenant-scoped query must have tenant context.

Never execute an unscoped tenant query such as:

```ts
db.select().from(products)
```

inside a tenant request.

Use repository/service patterns such as:

```ts
productRepository.list({
  tenantId,
  branchId,
  filters
});
```

All repositories must enforce tenant scoping internally.

## Cross-Tenant Relation Protection

Whenever one entity references another entity, validate that both belong to the same tenant.

Examples:

```text
product -> category
product -> brand
purchase order -> supplier
purchase item -> product
sale -> customer
sale item -> product
batch -> supplier
transfer -> branch
```

Never trust public IDs without tenant validation.

## Branch Authorization

Branch access must be checked after tenant access.

A user can only operate on branches explicitly assigned through user-branch authorization.

## Authorization

Use:

```text
Authentication
+
RBAC
+
Permission
+
Branch Access
+
Business Rules
```

UI visibility is never a substitute for backend authorization.

Feature flags are never a substitute for backend authorization.

UI modes are never a substitute for backend authorization.

---

# 7. ID STRATEGY

Use internal database IDs plus public identifiers such as UUID or ULID.

Public APIs should expose non-guessable identifiers.

Every public identifier must still be validated against:

```text
tenant
+
branch
+
permission
+
business rules
```

Never assume an unguessable ID alone provides authorization.

---

# 8. DATABASE PRINCIPLES

Use one shared database model.

Migrations must be safe for all tenants.

Never create tenant-specific migrations.

Migration rules:

- migrations run globally
- large migrations should be backward compatible
- backfills must be idempotent
- destructive migrations require backup/rollback planning
- schema changes must not break existing tenants

Timestamps must be stored consistently.

Tenant timezone must be configurable.

Default Indonesian timezone:

```text
Asia/Jakarta
```

Do not permanently hard-code one timezone.

---

# 9. DOMAIN MODULES

Implement the complete domain architecture.

## Platform and SaaS

- Tenant onboarding
- Subdomains
- Tenant lifecycle
- Plans
- Subscriptions
- Usage
- Quotas
- Feature flags
- Super admin
- Platform audit
- Monitoring

## Identity and Access

- Authentication
- Sessions/tokens
- Roles
- Permissions
- Branch access
- Password policies
- Login history
- Device/session management
- Rate limiting
- Security events

## Organization

- Branch
- Warehouse
- Location/rack/bin
- POS terminal
- Cash drawer

## Product Master

- Products
- Categories
- Brands
- Units
- Unit conversions
- Barcodes
- Product aliases
- Prices
- Price history
- Tax profiles
- Supplier-product relationships

## Inventory

- Batches
- Expiry
- Stock ledger
- Availability
- Reservations
- Stock adjustments
- Stock opname
- Transfers
- Quarantine
- Damaged stock
- Expired stock
- Reorder points
- Procurement recommendations

## Purchasing

- Purchase requests
- Purchase orders
- Approval
- Goods receipts
- Partial receipts
- Back orders
- Purchase invoices
- Purchase payments
- Purchase returns

## POS / Sales

- Shifts
- Cart
- Hold/park transactions
- Checkout
- Payments
- Split payments
- Discounts
- Promotions
- Taxes
- Customer credit
- Receipts
- Sales returns
- Refunds
- Void/reversal

## Customer

- Customer
- Member
- Loyalty
- Loyalty ledger
- Customer credit
- Receivables
- Payment history

## Finance

- Cash
- Bank
- Cash movements
- Expenses
- Income
- Accounts receivable
- Accounts payable
- Opening balances
- Period closing
- Basic chart of accounts
- Accounting events
- Profit & loss
- Stock valuation
- Payment reconciliation

## Pharmacy

- Drug classes
- Generics
- Drug forms
- Routes
- Patients
- Doctors
- Prescriptions
- Prescription items
- Dispensing
- Partial dispensing
- Compounding
- Pharmacy reports

## Reporting

- Sales reports
- Purchase reports
- Inventory reports
- Stock cards
- Stock valuation
- Expiry reports
- Opname reports
- Return reports
- Customer reports
- Supplier reports
- Cashier reports
- Shift reports
- Margin reports
- P&L
- Pharmacy reports
- Branch performance

## Integrations

- R2 storage
- QRIS/payment gateway integration layer
- WhatsApp/email notification layer
- API keys
- Webhooks
- Hardware bridge compatibility
- Import/export

---

# 10. INVENTORY ENGINE

Inventory is a critical domain.

Do not implement inventory as a simple mutable stock number.

Use an immutable stock ledger.

Every stock change must generate a stock movement.

Historical stock movements must never be edited.

Stock corrections must create a new movement.

Stock availability must distinguish:

```text
on_hand
reserved
available
in_transit
quarantine
expired
damaged
```

Primary formula:

```text
available = on_hand - reserved
```

---

# 11. FEFO / FIFO

The server is the sole authority for batch allocation.

The client must never determine which batch is allowed to be sold.

For expiry-tracked products use FEFO:

```text
expired_date ASC
received_date ASC
id ASC
```

Only include batches where:

```text
status = available
qty_remaining > 0
expired_date >= today
```

For non-expiry products use FIFO:

```text
received_date ASC
id ASC
```

When checkout occurs, the server must independently calculate allocation.

Never blindly trust:

```json
{
  "batch_id": "..."
}
```

sent from the client.

Batch allocation must happen within the database transaction.

---

# 12. CONCURRENCY CONTROL

Inventory operations must be safe under concurrent requests.

Example:

```text
Stock = 1

Cashier A buys quantity 1
Cashier B buys quantity 1
at the same time
```

Only one transaction may succeed when available stock is one.

Do not allow:

```text
stock = -1
```

unless negative stock is explicitly enabled and supported by tenant business policy.

Concurrency testing is mandatory.

Test at minimum:

- same stock
- same invoice
- same payment
- same reservation
- simultaneous checkout
- simultaneous stock adjustment

---

# 13. TRANSACTION INTEGRITY

Critical financial and inventory workflows must be atomic.

Example checkout transaction:

```text
BEGIN
  â†“
Validate Cart
  â†“
Resolve FEFO/FIFO Allocation
  â†“
Validate / Reserve Stock
  â†“
Create Sales Transaction
  â†“
Create Sales Items
  â†“
Create Payment
  â†“
Create Stock Movements
  â†“
Update Reservation / Stock State
  â†“
Update Cash / Shift
  â†“
Create Audit Event
  â†“
COMMIT
```

If any critical operation fails:

```text
ROLLBACK
```

Never allow partially completed financial transactions.

---

# 14. IDEMPOTENCY

The following endpoints must support idempotency:

```text
POST sales
POST payment
POST goods receipt
POST stock transfer
POST refund
POST stock adjustment
```

Support:

```http
Idempotency-Key: <unique-key>
```

Repeated requests with the same idempotency key must never create duplicate financial or inventory effects.

Build a reusable:

```text
idempotencyService
```

Do not implement separate ad-hoc idempotency logic per controller.

---

# 15. IMMUTABLE LEDGERS

The following must behave as ledgers:

- stock movements
- loyalty transactions
- payment events
- accounting events where applicable

Do not directly edit historical ledger entries to fix data.

Create compensating/new events.

This principle is mandatory for auditability.

---

# 16. PURCHASE FLOW

Implement:

```text
Purchase Request
â†’ Approval
â†’ Purchase Order
â†’ Goods Receipt
â†’ Batch Creation
â†’ Stock Movement
â†’ Purchase Invoice
â†’ Supplier Payment
```

Support:

- partial receiving
- back order
- purchase returns
- supplier pricing
- approval workflows

Receiving a product requiring batch tracking must create the correct batch data.

---

# 17. POS FLOW

The POS screen must prioritize speed.

Primary flow:

```text
Barcode Scan
â†’ Search
â†’ Cart
â†’ Quantity
â†’ Optional Customer
â†’ Payment
â†’ Receipt
```

The POS interface should be keyboard-friendly and optimized for barcode scanners.

Advanced actions should be placed in drawers, secondary panels, or contextual dialogs instead of cluttering the main POS workflow.

---

# 18. SHIFT AND CASH MANAGEMENT

Implement:

```text
open
closing
closed
reconciled
```

Cash movement types include:

```text
opening
sale_cash
refund
cash_in
cash_out
expense
withdrawal
closing_adjustment
```

Shift closing must reconcile expected and actual cash.

Every adjustment must be auditable.

---

# 19. RETURN AND REFUND

Sales returns and refunds must be event-driven and auditable.

A refund may generate:

- audit event
- payment event
- stock movement when inventory is returned

Never simply edit the original sale to simulate a refund.

Use dedicated return/refund workflows.

---

# 20. CUSTOMER AND LOYALTY

Customer loyalty points must use a ledger.

Do not directly mutate historical point transactions.

Use:

```text
loyalty_transactions
```

with:

```text
balance_after
```

Customer credit and receivables must be represented explicitly.

---

# 21. ACCOUNTS RECEIVABLE / PAYABLE

Implement:

```text
receivables
receivable_payments
payables
payable_payments
```

Support:

```text
open
partial
paid
overdue
cancelled
```

Payment allocation must be explicit and auditable.

---

# 22. FINANCE

Build a basic financial event layer without overcomplicating the MVP into a full accounting product.

Support event concepts such as:

```text
Cash / Receivable
Revenue
COGS
Inventory
Expense
Payable
```

The domain model must remain compatible with future full accounting.

Do not design the POS database in a way that makes future accounting impossible.

---

# 23. PERIOD CLOSING

Implement accounting periods:

```text
open
closing
closed
reopened
```

Transactions inside closed periods must not be changed unless a controlled reopen procedure exists.

Reopening a closed period requires:

- special permission
- audit trail
- explicit action
- controlled workflow

---

# 24. STOCK OPNAME

Stock opname must use sessions.

Statuses:

```text
draft
counting
submitted
review
approved
posted
cancelled
```

Posting an opname must create:

```text
opname_adjustment
```

Do not rewrite historical stock movements.

---

# 25. STOCK TRANSFER

Support:

```text
draft
requested
approved
picking
shipped
partial_received
received
cancelled
```

When shipped but not yet received, the stock must be represented as:

```text
in_transit
```

Transfers across branches must validate:

- tenant
- source branch
- destination branch
- user branch access
- warehouse access
- stock availability

---

# 26. PHARMACY DOMAIN

Pharmacy functionality must be domain-specific.

Prescription flow:

```text
Prescription
â†’ Verification
â†’ Availability
â†’ FEFO Allocation
â†’ Dispensing
â†’ Final Check
â†’ Payment
```

Use a dedicated:

```text
prescriptionService
```

Compounding must still use the same inventory ledger.

Support partial dispensing.

Do not bypass inventory rules for pharmacy operations.

---

# 27. PROMOTION ENGINE

The promotion engine should support at minimum:

```text
percentage
fixed_amount
buy_x_get_y
bundle
mix_match
member_price
minimum_qty
minimum_transaction
happy_hour
voucher
coupon
```

Promotion calculation must happen server-side.

The client may display estimates, but the server owns the final amount.

Promotion rules must be testable independently.

---

# 28. TAX ENGINE

Never hard-code tax rates into business logic.

Use:

```text
tax_profiles
tax_rules
```

Tax behavior must be configurable per tenant and business rule.

---

# 29. APPROVAL ENGINE

Create a generic reusable approval engine.

It must support workflows such as:

```text
purchase_order
purchase_return
sales_return
refund
stock_adjustment
stock_opname
price_change
discount
```

Approval rules must be configurable.

Do not hard-code business-specific approval thresholds throughout controllers.

---

# 30. RBAC

Provide default roles:

```text
owner
manager
admin
supervisor
cashier
warehouse
pharmacist
auditor
```

Permissions should follow resource/action conventions, for example:

```text
product.view
product.create
product.update
product.archive

purchase.view
purchase.create
purchase.approve
purchase.receive

sales.view
sales.create
sales.return
sales.refund

stock.view
stock.adjust
stock.opname
stock.transfer

report.sales
report.profit

prescription.view
prescription.create
prescription.dispense

user.manage
role.manage
settings.manage
```

Authorization must be enforced on the backend.

---

# 31. BRANCH ACCESS

Use a user-branch relationship.

A user must only access branches explicitly assigned to them.

The branch context must be validated against:

```text
tenant
+
user
+
user_branches
```

Never trust a branch ID supplied by the frontend.

---

# 32. AUDIT LOGGING

Sensitive business actions must produce audit logs.

Include fields such as:

```text
tenant_id
branch_id
user_id
request_id
action
entity
entity_id
before_json
after_json
ip_address
user_agent
created_at
```

Important actions include:

```text
LOGIN
LOGOUT
CREATE
UPDATE
ARCHIVE
APPROVE
REJECT
VOID
REFUND
STOCK_ADJUSTMENT
PRICE_CHANGE
PERMISSION_CHANGE
SHIFT_OPEN
SHIFT_CLOSE
PERIOD_CLOSE
```

Super-admin actions affecting tenants must also be audited.

---

# 33. SECURITY EVENTS

Maintain separate security events when appropriate.

Examples:

```text
login_failed
login_locked
password_changed
session_revoked
suspicious_request
rate_limited
cross_tenant_attempt
permission_denied
```

Do not mix security telemetry blindly with normal business audit logs.

---

# 34. API STANDARD

API prefix:

```text
/api/v1
```

Success response:

```json
{
  "success": true,
  "data": {},
  "message": "OK",
  "meta": {}
}
```

Error response:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {},
  "request_id": "..."
}
```

Use consistent HTTP status codes.

Every request should have a request ID.

---

# 35. SERVICE ARCHITECTURE

Keep routes/controllers thin.

Use:

```text
Route
 â†“
Validator
 â†“
Authorization
 â†“
Service
 â†“
Domain Engine
 â†“
Repository / Query Layer
 â†“
Database Transaction
```

Provide reusable services such as:

```text
tenantService
productService
inventoryService
stockEngine
purchasingService
salesService
paymentService
refundService
opnameService
transferService
prescriptionService
customerService
loyaltyService
receivableService
payableService
reportService
auditService
approvalService
numberingService
idempotencyService
notificationService
```

Business logic must not be duplicated across route handlers.

---

# 36. NUMBERING SERVICE

Implement a centralized numbering service.

Example:

```text
CAB01-260815-000001
```

Number generation must be concurrency-safe.

Do not generate critical transaction numbers purely on the frontend.

---

# 37. API ERROR HANDLING

Implement centralized error handling.

Errors should:

- provide a useful message
- contain request_id
- avoid exposing secrets
- avoid exposing database internals
- avoid leaking cross-tenant information

Never expose:

- passwords
- tokens
- payment secrets
- unnecessary sensitive data
- raw stack traces in production

---

# 38. RATE LIMITING

Apply rate limits by:

```text
IP
User
Tenant
Endpoint Category
```

Sensitive endpoints must have stricter controls:

```text
login
password reset
OTP
payment
webhook
export
```

---

# 39. LOGGING AND OBSERVABILITY

Every request should be traceable using:

```text
request_id
tenant_id
user_id
branch_id
route
method
status
duration
```

Logging must be structured and production-safe.

Never log credentials or secrets.

---

# 40. IMPORT / EXPORT

Imports must support:

```text
template
validation
preview
error report
confirmation
```

Minimum imports:

```text
products
customers
suppliers
opening stock
opening balances
```

Minimum exports:

```text
products
transactions
stock
customers
suppliers
reports
```

Exports must always be tenant-scoped.

---

# 41. HARDWARE READINESS

Prepare the architecture for:

```text
USB barcode scanner
camera barcode scanner
58mm thermal printer
80mm thermal printer
cash drawer
customer display
label printer
weighing scale
```

Do not hard-code the application to one printer model.

Use a local print bridge when necessary.

---

# 42. PRODUCT WEIGHT

Support decimal quantities where enabled.

Examples:

```text
0.75 kg
1.25 kg
```

Precision must be controlled at unit/product level.

---

# 43. SERIAL NUMBER / WARRANTY

The core model should be extensible for:

```text
serial_numbers
warranties
```

Even if not included in the earliest MVP.

---

# 44. NOTIFICATIONS

Support notifications such as:

```text
low_stock
near_expiry
expired
approval_required
payment_failed
subscription_expiring
```

Channels may include:

```text
in_app
email
whatsapp
push
```

Build notification infrastructure so additional channels can be added later.

---

# 45. REPORTING

Reports must be calculated from transaction data and/or immutable ledgers.

Do not rely on unverifiable mutable summary numbers as the source of truth.

All reports must be tenant-scoped.

Required reports include:

```text
Sales Summary
Sales Detail
Sales by Product
Sales by Category
Sales by Cashier
Sales by Branch
Purchase Summary
Purchase Detail
Stock Card
Stock Valuation
Expiry
Near Expiry
Opname Variance
Stock Adjustment
Transfer
Customer
Supplier
Receivable
Payable
Cash/Shift
Profit Margin
Profit & Loss
Pharmacy
```

Stock valuation must distinguish:

```text
Qty on hand
Cost value
Selling value
Potential margin
```

Transaction COGS must use correct batch allocation.

---

# 46. REORDER / PROCUREMENT RECOMMENDATION

Minimum inputs:

```text
current stock
reserved
on order
reorder point
```

Advanced calculations may include:

```text
average daily sales
lead time
safety stock
forecast
suggested order quantity
```

Forecasting is an advanced feature, not a blocker for basic POS functionality.

---

# 47. ADAPTIVE UI ARCHITECTURE

The platform has three UI modes:

```text
simple
professional
advanced
```

## Simple Mode

Target:

- small shops
- new businesses
- non-technical users

Primary navigation:

```text
Dashboard
Kasir
Produk
Stok
Pembelian
Pelanggan
Laporan
```

## Professional Mode

Target:

- retail operations
- multi-cashier shops
- multi-branch businesses
- minimarkets

Navigation includes:

```text
Dashboard
POS
Products
Purchasing
Inventory
Returns
Customers
Suppliers
Finance
Reports
Branches
Users
Settings
```

## Advanced Mode

Target:

- pharmacies
- enterprise retail
- complex operations

Add:

```text
Accounting
Advanced Reports
Approval
Prescription
Dispensing
Compounding
Forecasting
API
Integrations
```

The UI must use progressive disclosure.

Do not expose every advanced feature to every user.

---

# 48. FEATURE VISIBILITY

Visible UI features are determined by:

```text
Business Type
Ã—
Feature Flag
Ã—
Subscription Capability
Ã—
User Permission
Ã—
UI Mode
```

But endpoint authorization remains:

```text
Tenant
+
User
+
Branch
+
Permission
+
Business Rule
```

Do not use UI mode to secure APIs.

---

# 49. UX PRINCIPLES

Follow these UX rules:

1. POS must work efficiently with keyboard and barcode scanners.
2. Forms should show essential fields first.
3. Advanced fields should be collapsible.
4. Do not display irrelevant modules.
5. Do not display actions the user is not authorized to perform.
6. Error messages should explain what the user can do next.
7. Destructive actions require confirmation.
8. Sensitive destructive operations may require a reason.
9. Avoid deeply nested modal dialogs.
10. Tables must support search, filtering, sorting, and pagination.
11. Administrative areas should be mobile-friendly where appropriate.
12. POS desktop remains the primary optimized experience.
13. Loading, empty, error, and success states must be consistent.

---

# 50. POS UI PRIORITY

The POS screen is one of the highest-performance UX surfaces.

Primary order:

```text
Barcode Scan
Search
Cart
Quantity
Customer
Payment
Receipt
```

Keep advanced features out of the main visual path.

---

# 51. DASHBOARD LEVELS

## Simple

Show:

```text
Today's Sales
Transaction Count
Low Stock
Expired Products
```

## Professional

Show:

```text
Sales
Gross Profit
COGS
Cash
Receivables
Payables
Stock Value
Branch Comparison
```

## Advanced

Show:

```text
Trends
Forecast
Margin Analysis
Slow Moving
Fast Moving
Expiry Exposure
Customer Analytics
```

---

# 52. BACKEND STRUCTURE

Use a structure similar to:

```text
src/
â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ router.ts
â”‚   â”œâ”€â”€ context.ts
â”‚   â””â”€â”€ env.ts
â”‚
â”œâ”€â”€ config/
â”‚
â”œâ”€â”€ db/
â”‚   â”œâ”€â”€ schema/
â”‚   â”‚   â”œâ”€â”€ platform.ts
â”‚   â”‚   â”œâ”€â”€ identity.ts
â”‚   â”‚   â”œâ”€â”€ organization.ts
â”‚   â”‚   â”œâ”€â”€ catalog.ts
â”‚   â”‚   â”œâ”€â”€ inventory.ts
â”‚   â”‚   â”œâ”€â”€ purchasing.ts
â”‚   â”‚   â”œâ”€â”€ sales.ts
â”‚   â”‚   â”œâ”€â”€ customer.ts
â”‚   â”‚   â”œâ”€â”€ pharmacy.ts
â”‚   â”‚   â”œâ”€â”€ finance.ts
â”‚   â”‚   â”œâ”€â”€ audit.ts
â”‚   â”‚   â””â”€â”€ notifications.ts
â”‚   â””â”€â”€ migrations/
â”‚
â”œâ”€â”€ middlewares/
â”‚   â”œâ”€â”€ requestId.ts
â”‚   â”œâ”€â”€ tenantResolver.ts
â”‚   â”œâ”€â”€ auth.ts
â”‚   â”œâ”€â”€ branchContext.ts
â”‚   â”œâ”€â”€ permission.ts
â”‚   â”œâ”€â”€ rateLimit.ts
â”‚   â””â”€â”€ errorHandler.ts
â”‚
â”œâ”€â”€ modules/
â”‚   â”œâ”€â”€ auth/
â”‚   â”œâ”€â”€ tenants/
â”‚   â”œâ”€â”€ branches/
â”‚   â”œâ”€â”€ products/
â”‚   â”œâ”€â”€ inventory/
â”‚   â”œâ”€â”€ purchasing/
â”‚   â”œâ”€â”€ sales/
â”‚   â”œâ”€â”€ customers/
â”‚   â”œâ”€â”€ pharmacy/
â”‚   â”œâ”€â”€ finance/
â”‚   â”œâ”€â”€ reports/
â”‚   â”œâ”€â”€ users/
â”‚   â”œâ”€â”€ subscriptions/
â”‚   â””â”€â”€ notifications/
â”‚
â”œâ”€â”€ services/
â”‚   â”œâ”€â”€ stockEngine.ts
â”‚   â”œâ”€â”€ pricingService.ts
â”‚   â”œâ”€â”€ promotionService.ts
â”‚   â”œâ”€â”€ paymentService.ts
â”‚   â”œâ”€â”€ approvalService.ts
â”‚   â”œâ”€â”€ numberingService.ts
â”‚   â”œâ”€â”€ idempotencyService.ts
â”‚   â”œâ”€â”€ auditService.ts
â”‚   â””â”€â”€ notificationService.ts
â”‚
â”œâ”€â”€ repositories/
â”œâ”€â”€ validators/
â”œâ”€â”€ policies/
â”œâ”€â”€ utils/
â””â”€â”€ index.ts
```

Follow the same architectural separation for frontend modules.

---

# 53. FRONTEND STRUCTURE

Use:

```text
src/
â”œâ”€â”€ app/
â”œâ”€â”€ layouts/
â”‚   â”œâ”€â”€ TenantLayout
â”‚   â”œâ”€â”€ PosLayout
â”‚   â””â”€â”€ PlatformLayout
â”œâ”€â”€ routes/
â”œâ”€â”€ pages/
â”‚   â”œâ”€â”€ dashboard/
â”‚   â”œâ”€â”€ pos/
â”‚   â”œâ”€â”€ products/
â”‚   â”œâ”€â”€ inventory/
â”‚   â”œâ”€â”€ purchasing/
â”‚   â”œâ”€â”€ sales/
â”‚   â”œâ”€â”€ customers/
â”‚   â”œâ”€â”€ pharmacy/
â”‚   â”œâ”€â”€ finance/
â”‚   â”œâ”€â”€ reports/
â”‚   â”œâ”€â”€ settings/
â”‚   â””â”€â”€ platform/
â”œâ”€â”€ components/
â”œâ”€â”€ features/
â”œâ”€â”€ hooks/
â”œâ”€â”€ services/
â”œâ”€â”€ stores/
â”œâ”€â”€ permissions/
â”œâ”€â”€ ui-mode/
â”œâ”€â”€ query/
â”œâ”€â”€ utils/
â””â”€â”€ types/
```

Keep domain logic out of purely presentational components.

---

# 54. ROUTING

Root/platform routes should include:

```text
/
 /register
 /pricing
```

Tenant routes:

```text
/login
/dashboard
/pos
/products
/categories
/brands
/units
/suppliers
/purchasing/orders
/purchasing/receiving
/purchasing/returns
/inventory
/inventory/batches
/inventory/opname
/inventory/transfers
/sales
/sales/returns
/customers
/loyalty
/finance/cash
/finance/receivables
/finance/payables
/finance/expenses
/reports/*
/pharmacy/prescriptions
/pharmacy/patients
/pharmacy/doctors
/pharmacy/dispensing
/settings/*
```

Platform routes:

```text
/platform/tenants
/platform/plans
/platform/subscriptions
/platform/features
/platform/usage
/platform/audit
/platform/monitoring
```

---

# 55. DEVELOPMENT ORDER

Do not implement modules randomly.

Follow this development sequence.

## Phase 0 â€” Foundation

Build:

```text
Project setup
Wrangler
D1
Drizzle
R2
KV
React
Tailwind
TanStack Query
Error handling
Request ID
```

## Phase 1 â€” Security Foundation

Build and test:

```text
Tenant resolver
Authentication
Session/token
RBAC
Permission
Branch access
Audit
Rate limiting
```

## Phase 2 â€” Organization & Master

Build:

```text
Tenant
Branch
Warehouse
Location
POS terminal
Category
Brand
Unit
Product
Product unit
Price
Supplier
Customer
```

## Phase 3 â€” Inventory Engine

Build:

```text
Batch
Stock ledger
Availability
Reservation
FEFO/FIFO
Expiry
Adjustment
```

This phase must be fully implemented and rigorously tested before complex POS functionality is built.

## Phase 4 â€” Purchasing

Build:

```text
Purchase request
Purchase order
Approval
Goods receipt
Batch handling
Purchase invoice
Purchase payment
Purchase return
```

## Phase 5 â€” POS

Build:

```text
Shift
Cart
Hold
Checkout
Pricing
Discount
Tax
Payment
Split payment
Receipt
Cash drawer
```

## Phase 6 â€” Returns & Reconciliation

Build:

```text
Sales return
Refund
Cash reconciliation
Payment reconciliation
```

## Phase 7 â€” Inventory Operations

Build:

```text
Stock opname
Transfers
Stock valuation
Expiry reports
```

## Phase 8 â€” Customer & Finance

Build:

```text
Loyalty
Credit
Receivables
Payables
Expense
Income
Opening balance
Period closing
Basic accounting events
```

## Phase 9 â€” Pharmacy

Build:

```text
Drug master
Patient
Doctor
Prescription
Dispensing
Compounding
Pharmacy reporting
```

## Phase 10 â€” Adaptive UX

Build:

```text
Simple mode
Professional mode
Advanced mode
Progressive disclosure
Role-based navigation
Feature flags
```

## Phase 11 â€” SaaS Platform

Build:

```text
Plans
Subscriptions
Usage
Quotas
Super admin
Feature management
Billing readiness
```

## Phase 12 â€” Integrations & Advanced

Build:

```text
QRIS/payment gateway
Notifications
API
Webhooks
Forecasting
Marketplace
Hardware integrations
```

The blueprint defines this phased sequence specifically to protect core domain integrity before advanced features are layered on top.

---

# 56. MVP REQUIREMENTS

MVP is defined as a minimal user-facing feature set, not a simplistic database.

MVP must include:

```text
Tenant
Subdomain
Authentication
RBAC
Branch
Product
Category
Unit
Supplier
Customer
Batch
Stock Ledger
FEFO/FIFO
Purchase Receipt
POS
Shift
Payment
Receipt
Sales Return
Stock Opname
Audit
Basic Reports
Tenant Isolation Tests
```

MVP must preserve the complete domain architecture required for future expansion.

---

# 57. PRIORITY ROADMAP

## P0 â€” Foundation

```text
Tenant
Subdomain
Auth
RBAC
Permission
Branch Access
Request ID
Audit
D1
Drizzle
R2
KV
```

## P1 â€” Core POS + Inventory

```text
Product
Category
Unit
Supplier
Batch
Stock Ledger
FEFO/FIFO
Purchase Receipt
POS
Shift
Payment
Receipt
Sales Return
Opname
Basic Reports
```

## P2 â€” Professional Operations

```text
Multi Branch
Warehouse
Location
Transfer
Purchase Order
Approval
Price History
Promotion
Customer Credit
AR/AP
Cash Management
Period Closing
Advanced Reports
```

## P3 â€” Pharmacy

```text
Drug Master
Patient
Doctor
Prescription
Dispensing
Expiry Management
Compounding
Pharmacy Reports
```

## P4 â€” SaaS & Integrations

```text
Subscription
Usage
Quota
Super Admin
Feature Flags
API Keys
Webhooks
QRIS / Payment Gateway
Notifications
Hardware Integration
```

## P5 â€” Advanced Intelligence

```text
Forecasting
Purchase Recommendation
Advanced Analytics
Marketplace
Omnichannel
```

These priorities must guide implementation order.

---

# 58. TESTING STRATEGY

Testing is not optional.

## Unit Tests

Test:

```text
FEFO
FIFO
Pricing
Promotion
Tax
Payment allocation
Loyalty
Receivable
Payable
Stock valuation
```

## Integration Tests

Test:

```text
Purchase
â†’ Receipt
â†’ Batch
â†’ Stock

Sale
â†’ Payment
â†’ Stock
â†’ Cash

Return
â†’ Refund
â†’ Stock

Transfer
â†’ In Transit
â†’ Receive

Prescription
â†’ Dispensing
â†’ Stock
```

## Security Tests

Test:

```text
Tenant isolation
Branch isolation
Permission escalation
IDOR
Rate limiting
Session abuse
```

## Concurrency Tests

Test:

```text
Same stock
Same invoice
Same payment
Same reservation
```

## E2E Tests

At minimum:

```text
Onboarding
â†’ Branch
â†’ Product
â†’ Supplier
â†’ Purchase
â†’ Receiving
â†’ Sale
â†’ Payment
â†’ Return
â†’ Opname
â†’ Report
```

## UAT

Operate at least:

```text
Tenant A
Tenant B
```

simultaneously and verify complete isolation.

---

# 59. TENANT ISOLATION TEST MATRIX

Mandatory test cases:

```text
GET Tenant B resource using Tenant A user
POST Tenant B resource using Tenant A user
PUT Tenant B resource using Tenant A user
DELETE Tenant B resource using Tenant A user
GET Tenant B report using Tenant A user
POST sale using Tenant B product
POST purchase using Tenant B supplier
POST transfer to Tenant B branch
POST opname on Tenant B warehouse
```

Expected result:

```text
403 or 404
```

according to endpoint design.

Most importantly:

```text
NO DATA FROM TENANT B MAY LEAK TO TENANT A
```

The isolation test matrix is a mandatory security gate.

---

# 60. CI/CD QUALITY GATE

A pull request must not be considered complete when any of these fail:

```text
lint
format
typecheck
unit tests
integration tests
tenant isolation tests
build
migration validation
```

Staging flow:

```text
Test
â†’ Deploy Staging
â†’ Smoke Test
â†’ E2E
â†’ Approval
â†’ Production
```

Never deploy directly to production without the required validation.

---

# 61. DEPLOYMENT ENVIRONMENTS

Provide:

```text
development
staging
production
```

Expected Cloudflare resources:

```text
D1
R2
KV
Secrets
```

Wildcard tenant DNS:

```text
*.yourdomain.com
```

Keep environment-specific configuration separate and secure.

Never commit production secrets.

---

# 62. BACKUP AND RECOVERY

Implement:

```text
daily backup
weekly retention
monthly retention
```

A backup strategy is not considered complete until restore testing has been performed.

Test restoration regularly.

---

# 63. SCALING STRATEGY

Initial architecture:

```text
shared D1
shared Worker
shared KV
shared R2
```

If a tenant becomes very large, the data plane may later be separated while preserving the same tenant isolation concepts.

Do not prematurely introduce tenant-specific databases unless required.

---

# 64. ACCEPTANCE CRITERIA

The MVP is accepted only when:

- Tenants can register.
- Tenants receive valid subdomains.
- Tenants can create branches.
- Users can only access their own tenant.
- Users can only access assigned branches.
- Products support multi-unit configurations.
- Batches support expiry and cost.
- FEFO/FIFO is calculated server-side.
- Every stock mutation produces stock movements.
- Purchase receiving creates batches and stock movements.
- POS checkout is atomic.
- Payment operations are idempotent.
- Shifts can open and close.
- Returns and refunds are auditable.
- Stock opname generates adjustment movements.
- Basic reports match transactional data.
- At least two tenants operate simultaneously without data leakage.
- Simple Mode remains easy for new users.
- Advanced features do not break Simple Mode.

---

# 65. PRODUCT EXPERIENCE GOAL

The final product should feel:

```text
Simple for cashiers
Complete for owners
Powerful for warehouse staff
Controlled for managers
Specialized for pharmacists
Secure for SaaS
```

Do not show every capability to every user.

Keep the core system complete while adapting the interface to the user's role, business type, permissions, subscription, and UI mode.

---

# 66. CODING STANDARDS

Follow these standards throughout implementation:

- Use strict TypeScript.
- Prefer explicit types over `any`.
- Keep functions small and focused.
- Keep domain logic out of UI components.
- Keep route handlers thin.
- Centralize authorization.
- Centralize tenant resolution.
- Centralize business-critical calculations.
- Avoid duplicated business rules.
- Avoid magic numbers.
- Use constants/enums for domain status values.
- Validate all external input.
- Never trust client-side authorization.
- Never trust client-side inventory allocation.
- Never trust client-side pricing.
- Never trust client-side tenant context.
- Never hide security bugs behind UI restrictions.
- Do not silently ignore failed database operations.
- Do not swallow exceptions.
- Return predictable API errors.
- Keep transactions explicit.
- Use reusable services and repositories.

---

# 67. IMPLEMENTATION RULE

Do not generate large amounts of placeholder code and declare the feature complete.

A feature is complete only when it has:

```text
Database schema
+
Migration
+
Validation
+
Authorization
+
Service/domain logic
+
Repository/query logic
+
API endpoint
+
Frontend UI
+
Error handling
+
Loading states
+
Empty states
+
Success states
+
Audit logging when required
+
Tests
```

Never create a "fake" feature where the UI exists but the backend is missing.

Never create a "fake" backend where the API returns hard-coded data.

Never mark unfinished modules as completed.

---

# 68. DEVELOPMENT WORKFLOW FOR THE AI AGENT

For every implementation phase:

## Step 1 â€” Inspect

Inspect the current repository before modifying anything.

Understand:

- existing files
- existing architecture
- package.json
- environment configuration
- database schema
- migrations
- routes
- middleware
- tests
- build tooling

Never overwrite an existing implementation blindly.

## Step 2 â€” Plan

Before coding a non-trivial feature, identify:

```text
affected schema
affected migrations
affected services
affected repositories
affected routes
affected permissions
affected UI
affected tests
```

## Step 3 â€” Implement

Implement the feature according to architecture.

## Step 4 â€” Test

Run relevant tests immediately.

## Step 5 â€” Verify

Verify:

```text
typecheck
lint
build
unit tests
integration tests
security tests
```

## Step 6 â€” Review

Check specifically for:

```text
tenant leakage
branch leakage
authorization bypass
IDOR
duplicate transactions
race conditions
incorrect stock mutation
incorrect FEFO/FIFO
missing audit events
missing idempotency
```

## Step 7 â€” Continue

Only after the current phase is stable should the next phase be implemented.

---

# 69. NEVER DO THESE THINGS

Never:

- trust tenant_id from the client
- trust branch_id from the client
- trust batch_id from the client
- directly mutate stock without a movement
- modify historical stock movements
- bypass transaction boundaries
- allow duplicate financial transactions
- calculate final pricing only on the client
- calculate final promotion only on the client
- choose FEFO/FIFO allocation only on the client
- use feature flags as authorization
- use UI mode as authorization
- expose tenant B through IDOR
- hard-delete financial transactions
- silently skip audit logs
- create tenant-specific migrations
- bypass branch authorization
- deploy without tests
- declare a placeholder module complete
- duplicate domain logic unnecessarily
- simplify the domain model merely to make the MVP faster

---

# 70. WHEN REQUIREMENTS ARE UNCLEAR

When a requirement is unclear:

1. Prefer the MASTER BLUEPRINT.
2. Prefer existing project conventions.
3. Prefer domain integrity over implementation convenience.
4. Prefer secure server-side behavior.
5. Prefer reusable architecture.
6. Prefer backward-compatible schema evolution.
7. Do not silently invent behavior that changes business semantics.

When a conflict exists between coding speed and domain integrity, prioritize:

```text
Tenant Isolation
Authentication / Authorization
Inventory Ledger
FEFO/FIFO
Financial Transaction Integrity
Audit Trail
Idempotency
```

This is a hard architectural priority.

---

# 71. DEFINITION OF DONE

A feature is DONE only when:

```text
Implementation exists
AND
Schema is correct
AND
Migration works
AND
Authorization works
AND
Tenant isolation is verified
AND
Branch authorization is verified
AND
Business rules are implemented
AND
API works
AND
UI works
AND
Error states work
AND
Auditability is implemented where required
AND
Idempotency is implemented where required
AND
Tests pass
AND
Typecheck passes
AND
Lint passes
AND
Build passes
```

Never report a feature as complete when only part of it exists.

---

# 72. FINAL INSTRUCTION TO THE AI AGENT

You are not merely generating code.

You are building a production-grade SaaS product with financial, inventory, security, and pharmacy-sensitive domains.

Prioritize correctness, security, consistency, auditability, maintainability, and scalability over superficial speed.

Always preserve:

```text
FULL BACKEND
+
SAFE BUSINESS ENGINE
+
TENANT ISOLATION
+
ROLE / PERMISSION
+
FEATURE FLAGS
+
PROGRESSIVE DISCLOSURE
=
A COMPLETE APPLICATION THAT REMAINS EASY TO USE
```

Build incrementally.

Test continuously.

Never compromise the core domain rules.

Never claim completion without verification.

When reporting progress, clearly distinguish:

```text
Implemented
Tested
Verified
Not Implemented
Known Issues
```

The final application must be a single adaptive platform capable of serving simple retail users, professional multi-branch operators, and advanced pharmacy/enterprise users without fragmenting the core architecture.
