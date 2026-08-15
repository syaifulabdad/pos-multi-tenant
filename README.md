# POS Multi-Tenant

Production-oriented multi-tenant POS foundation for retail and pharmacy operations. The architecture follows [`AGENTS.md`](./AGENTS.md) as its primary blueprint.

## Current status

### Implemented — Phase 0 Foundation

- npm workspace separation for the Cloudflare Worker API, React web app, and shared API contracts
- Hono API under `/api/v1`
- strict TypeScript configuration
- Cloudflare D1, R2, KV, and static asset bindings
- Drizzle ORM client and global migration configuration
- centralized request IDs, structured request logging, error handling, and response envelopes
- D1-aware health endpoint at `GET /api/v1/health`
- React Router, TanStack Query, Tailwind CSS, and responsive loading/error/success status UI
- unit/integration tests for response contracts, request IDs, unknown routes, and dependency failures
- lint, format, typecheck, test, and build quality gates

### Implemented — Phase 1 security foundation

- global tenant and verified custom-domain schema with lifecycle constraints
- server-side tenant resolution from the request hostname
- reserved platform subdomain rejection
- controlled handling for unknown, pending, suspended, and inactive tenants
- tenant request context and public bootstrap endpoint at `GET /api/v1/tenant/bootstrap`
- tests proving query parameters and custom headers cannot override the host tenant
- tenant-scoped users, sessions, login history, audit logs, and security events
- PBKDF2-SHA256 password hashing with random salts and timing-safe comparison
- opaque session tokens stored only as SHA-256 hashes
- host-only, HTTP-only, SameSite session cookies (`Secure` and `__Host-` in production)
- account lockout after repeated failures with atomic D1 updates
- atomic login/logout persistence with audit and login history records
- `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, and `POST /api/v1/auth/logout`
- tenant-aware login UI with loading, unavailable, error, and success states
- global permission catalog with tenant-scoped roles and role assignments
- tenant-scoped branches and explicit user-branch assignments
- one server-enforced default branch per user
- active branch persisted on the authenticated session
- reusable backend `requirePermission` and `requireBranch` middleware
- permission-denied security events and audited branch switching
- `GET /api/v1/access` and `POST /api/v1/access/branch`
- access UI showing effective permissions, active branch, and authorized branch switching
- D1-backed atomic rate-limit buckets with bounded storage per hashed scope
- login limits by tenant/IP and authenticated sensitive-action limits by tenant/user
- standard `429`, `Retry-After`, and rate-limit response headers
- rate-limit security events without storing raw scope identities in bucket keys
- tenant/user-scoped device session listing, five-minute last-seen refreshes, and atomic session revocation
- session revocation audit logs and dedicated security events
- `GET /api/v1/auth/sessions` and `DELETE /api/v1/auth/sessions/:sessionId`
- session/device UI that never exposes raw session tokens
- backend-authorized tenant user directory, secure user creation, assignment updates, and account disabling
- backend-authorized custom role creation, permission assignment, role updates, and protected system roles
- disabling a user atomically revokes that user's active sessions
- tenant-scoped read-only security-event administration with bounded result limits
- user/role mutations persisted as audit logs without password material
- `GET`/`POST`/`PATCH` administration APIs under `/api/v1/admin/users` and `/api/v1/admin/roles`
- `GET /api/v1/admin/security-events`
- permission-adaptive administration UI for users, roles, and recent security events

### Implemented — Phase 2 organization foundation (in progress)

- tenant-scoped branch, warehouse, rack/location, and POS-terminal resources
- composite tenant/parent foreign keys and tenant-safe public UUID references
- active/inactive lifecycle controls with protected last-active branch
- parent/child lifecycle rules for branches, warehouses, locations, and terminals
- typed inventory locations for storage, sales floor, receiving, quarantine, damaged, and expired stock
- audited create/update operations protected by `settings.manage` and distributed rate limits
- organization APIs under `/api/v1/admin/organization`
- adaptive organization UI for hierarchy visibility, creation, and lifecycle changes

### Tested and verified

Run `npm run validate` to reproduce all local quality gates, including applying every migration to an isolated D1 database.

### Not implemented yet

Remaining Phase 2 work includes tenant settings plus category, brand, unit, product, product-unit, price, supplier, and customer modules. No business feature is represented as complete before its backend, authorization, UI, migrations where needed, and tests exist.

## Repository layout

```text
apps/
  api/          Cloudflare Worker and Hono API
  web/          React tenant/platform web client
packages/
  contracts/    Shared versioned API types
```

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- a Cloudflare account when creating or deploying remote resources

## Local setup

```sh
npm install
npm run build:web
```

In terminal one, start the Worker (API and built static assets):

```sh
npm run dev:api
```

For frontend hot module replacement, run this in terminal two. Vite proxies `/api` to the Worker on port `8787`:

```sh
npm run dev:web
```

The committed Cloudflare resource IDs are local placeholders. Before a remote deployment, create environment-specific resources and replace the placeholders without committing secrets:

```sh
npx wrangler d1 create pos-multi-tenant-development
npx wrangler kv namespace create CACHE
npx wrangler r2 bucket create pos-multi-tenant-development
```

Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` only when local secrets are required.

## Database workflow

Schema modules live under `apps/api/src/db/schema`. Migrations are global—never tenant-specific.

```sh
npm run db:generate
npm run db:check
npm run db:validate
npm run db:migrate:local
```

## Quality gates

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build

# all gates
npm run validate
```

Never commit production credentials, Cloudflare secrets, or tenant data.
