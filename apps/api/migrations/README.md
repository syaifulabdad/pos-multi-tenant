# D1 migrations

Drizzle-generated, global D1 migrations live in this directory. Migrations apply to the shared database and must remain backward compatible for every tenant; tenant-specific migrations are prohibited.

Generate, validate, and apply migrations with:

```sh
npm run db:generate
npm run db:check
npm run db:validate
npm run db:migrate:local
```

`db:validate` applies the complete migration history to an isolated D1 database and runs an upgrade-preservation scenario with existing session and audit rows, organization hierarchy inserts, and an explicit cross-tenant foreign-key rejection. It does not modify the normal local development database.
