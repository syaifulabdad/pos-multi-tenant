# D1 migrations

Drizzle-generated, global D1 migrations live in this directory. Migrations apply to the shared database and must remain backward compatible for every tenant; tenant-specific migrations are prohibited.

Generate, validate, and apply migrations with:

```sh
npm run db:generate
npm run db:check
npm run db:validate
npm run db:migrate:local
```

`db:validate` applies the complete migration history to an isolated D1 database and runs a populated upgrade-preservation scenario. The scenario retains existing session and audit rows, creates organization, master-data, and inventory hierarchies, and verifies multi-unit, price, supplier, customer, batch, balance, reservation, allocation, and immutable movement rows. It requires cross-tenant organization, product-category, product-unit, branch-price, supplier-batch, and branch-inventory foreign keys to reject invalid relations, and verifies that reserved stock cannot exceed on-hand stock. It does not modify the normal local development database.

Migration `0005_ancient_silvermane.sql` introduces the Phase 2 master tables: categories, brands, units, products, product units, append-only product prices, suppliers, and customers. Its composite `(tenant_id, id)` relationships are intentional security boundaries and must not be replaced with unscoped parent IDs.

Migration `0006_wandering_northstar.sql` introduces the Phase 3 inventory tables: batches, balances, reservations, reservation allocations, and append-only stock movements. Composite tenant, branch, warehouse, location, and product relationships prevent parent references from crossing isolation boundaries. Quantity checks preserve `0 <= reserved_minor <= on_hand_minor`; movement and reservation constraints protect ledger and lifecycle invariants. The unique tenant/reference movement index is the persistence boundary for idempotent inventory writes.
