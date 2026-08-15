#!/usr/bin/env bash
set -euo pipefail

DATABASE="pos-multi-tenant-development"
FRESH_STATE="../../.migration-test"
UPGRADE_STATE="../../.migration-upgrade-test"

cleanup() {
  rm -rf "$FRESH_STATE" "$UPGRADE_STATE"
}
trap cleanup EXIT
cleanup

# Validate the complete migration journal against an empty D1 database.
wrangler d1 migrations apply "$DATABASE" --local --persist-to "$FRESH_STATE"

# Validate that the RBAC migration preserves rows created by prior releases.
wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --file migrations/0000_tenant_resolution.sql
wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --file migrations/0001_authentication_sessions.sql
wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  INSERT INTO tenants (id, uuid, slug, name, status)
  VALUES (1, '0198c000-0000-7000-8000-000000000001', 'migration-test', 'Migration Test', 'active');
  INSERT INTO users (id, uuid, tenant_id, email, name, password_hash, status)
  VALUES (1, '0198c000-0000-7000-8000-000000000002', 1, 'test@example.test', 'Test User', 'test-hash', 'active');
  INSERT INTO sessions
    (id, uuid, tenant_id, user_id, token_hash, expires_at, last_seen_at)
  VALUES
    (1, '0198c000-0000-7000-8000-000000000003', 1, 1, 'test-token-hash', '2099-01-01T00:00:00.000Z', '2026-08-15T00:00:00.000Z');
  INSERT INTO audit_logs
    (id, tenant_id, user_id, request_id, action, entity)
  VALUES (1, 1, 1, 'migration-test-request', 'LOGIN', 'session');
"
wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --file migrations/0002_rbac_branch_access.sql
wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --file migrations/0003_rate_limit_buckets.sql

RESULT="$(wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  SELECT CASE
    WHEN (SELECT count(*) FROM sessions WHERE id = 1 AND active_branch_id IS NULL) = 1
     AND (SELECT count(*) FROM audit_logs WHERE id = 1) = 1
     AND (SELECT count(*) FROM permissions) = 26
     AND (SELECT count(*) FROM pragma_table_info('rate_limit_buckets')) = 8
    THEN 'ok' ELSE 'failed'
  END AS migration_upgrade;
")"

echo "$RESULT" | grep -q '"migration_upgrade": "ok"'
echo "Migration upgrade preservation check passed."
