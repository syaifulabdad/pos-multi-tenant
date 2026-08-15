# D1 migrations

Drizzle-generated, global D1 migrations live in this directory. Migrations apply to the shared database and must remain backward compatible for every tenant; tenant-specific migrations are prohibited.

Generate, validate, and apply migrations with:

```sh
npm run db:generate
npm run db:check
npm run db:validate
npm run db:migrate:local
```

`db:validate` applies the complete migration history to an isolated D1 database and runs a populated upgrade-preservation scenario. The scenario retains existing session and audit rows, creates organization and master-data hierarchies, verifies multi-unit/price/supplier/customer rows, and requires cross-tenant organization, product-category, product-unit, and branch-price foreign keys to reject invalid relations. It does not modify the normal local development database.

Migration `0005_ancient_silvermane.sql` introduces the Phase 2 master tables: categories, brands, units, products, product units, append-only product prices, suppliers, and customers. Its composite `(tenant_id, id)` relationships are intentional security boundaries and must not be replaced with unscoped parent IDs.
