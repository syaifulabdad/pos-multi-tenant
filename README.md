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

### Implemented — Phase 1 security foundation (in progress)

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

### Tested and verified

Run `npm run validate` to reproduce all local quality gates, including applying every migration to an isolated D1 database.

### Not implemented yet

Remaining Phase 1 work: role/user administration APIs and UI plus security-event administration. No business feature is represented as complete before its backend, authorization, UI, and tests exist.

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
