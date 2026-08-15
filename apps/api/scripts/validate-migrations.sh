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

# Validate that later migrations preserve rows created by prior releases and enforce new FKs.
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
wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  INSERT INTO branches (id, uuid, tenant_id, code, name, status, timezone)
  VALUES (1, '0198c000-0000-7000-8000-000000000004', 1, 'TEST01', 'Test Branch', 'active', 'Asia/Jakarta');
"
wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --file migrations/0003_rate_limit_buckets.sql
wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --file migrations/0004_organization_resources.sql
wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  INSERT INTO warehouses (id, uuid, tenant_id, branch_id, code, name)
  VALUES (1, '0198c000-0000-7000-8000-000000000005', 1, 1, 'WH01', 'Test Warehouse');
  INSERT INTO locations (id, uuid, tenant_id, warehouse_id, code, name, type)
  VALUES (1, '0198c000-0000-7000-8000-000000000006', 1, 1, 'RACK01', 'Test Rack', 'storage');
  INSERT INTO pos_terminals (id, uuid, tenant_id, branch_id, code, name)
  VALUES (1, '0198c000-0000-7000-8000-000000000007', 1, 1, 'POS01', 'Test POS');
  INSERT INTO tenants (id, uuid, slug, name, status)
  VALUES (2, '0198c000-0000-7000-8000-000000000008', 'migration-other', 'Other Tenant', 'active');
  INSERT INTO users (id, uuid, tenant_id, email, name, password_hash, status)
  VALUES (2, '0198c000-0000-7000-8000-000000000009', 2, 'other@example.test', 'Other User', 'test-hash', 'active');
  INSERT INTO branches (id, uuid, tenant_id, code, name, status, timezone)
  VALUES (2, '0198c000-0000-7000-8000-000000000010', 2, 'OTHER01', 'Other Branch', 'active', 'Asia/Jakarta');
"

if wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  INSERT INTO warehouses (uuid, tenant_id, branch_id, code, name)
  VALUES ('0198c000-0000-7000-8000-000000000011', 1, 2, 'CROSS01', 'Cross Tenant');
" >/dev/null 2>&1; then
  echo "Cross-tenant organization foreign key was not enforced." >&2
  exit 1
fi

wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --file migrations/0005_ancient_silvermane.sql
wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  INSERT INTO categories (id, uuid, tenant_id, code, name)
  VALUES (1, '0198c000-0000-7000-8000-000000000012', 1, 'MED', 'Medicines');
  INSERT INTO brands (id, uuid, tenant_id, code, name)
  VALUES (1, '0198c000-0000-7000-8000-000000000013', 1, 'GENERIC', 'Generic');
  INSERT INTO units (id, uuid, tenant_id, code, name, symbol, precision)
  VALUES (1, '0198c000-0000-7000-8000-000000000014', 1, 'PCS', 'Piece', 'pc', 0);
  INSERT INTO products
    (id, uuid, tenant_id, category_id, brand_id, base_unit_id, sku, name)
  VALUES
    (1, '0198c000-0000-7000-8000-000000000015', 1, 1, 1, 1, 'TESTSKU', 'Test Product');
  INSERT INTO product_units
    (id, uuid, tenant_id, product_id, unit_id, is_base)
  VALUES (1, '0198c000-0000-7000-8000-000000000016', 1, 1, 1, 1);
  INSERT INTO product_prices
    (id, uuid, tenant_id, product_unit_id, branch_id, amount_minor, valid_from, created_by)
  VALUES
    (1, '0198c000-0000-7000-8000-000000000017', 1, 1, 1, 12500, '2026-08-15T00:00:00.000Z', 1);
  INSERT INTO suppliers (id, uuid, tenant_id, code, name)
  VALUES (1, '0198c000-0000-7000-8000-000000000018', 1, 'SUP01', 'Test Supplier');
  INSERT INTO customers (id, uuid, tenant_id, code, name)
  VALUES (1, '0198c000-0000-7000-8000-000000000019', 1, 'CUS01', 'Test Customer');

  INSERT INTO categories (id, uuid, tenant_id, code, name)
  VALUES (2, '0198c000-0000-7000-8000-000000000020', 2, 'OTHER', 'Other Category');
  INSERT INTO units (id, uuid, tenant_id, code, name, symbol, precision)
  VALUES (2, '0198c000-0000-7000-8000-000000000021', 2, 'OTHER', 'Other Unit', 'o', 0);
  INSERT INTO products (id, uuid, tenant_id, base_unit_id, sku, name)
  VALUES (2, '0198c000-0000-7000-8000-000000000025', 2, 2, 'OTHERSKU', 'Other Product');
  INSERT INTO product_units (id, uuid, tenant_id, product_id, unit_id, is_base)
  VALUES (2, '0198c000-0000-7000-8000-000000000026', 2, 2, 2, 1);
  INSERT INTO suppliers (id, uuid, tenant_id, code, name)
  VALUES (2, '0198c000-0000-7000-8000-000000000027', 2, 'OTHERSUP', 'Other Supplier');
"

if wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  INSERT INTO products (uuid, tenant_id, category_id, base_unit_id, sku, name)
  VALUES ('0198c000-0000-7000-8000-000000000022', 1, 2, 1, 'CROSSCAT', 'Cross Category');
" >/dev/null 2>&1; then
  echo "Cross-tenant product/category foreign key was not enforced." >&2
  exit 1
fi

if wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  INSERT INTO products (uuid, tenant_id, base_unit_id, sku, name)
  VALUES ('0198c000-0000-7000-8000-000000000023', 1, 2, 'CROSSUNIT', 'Cross Unit');
" >/dev/null 2>&1; then
  echo "Cross-tenant product/unit foreign key was not enforced." >&2
  exit 1
fi

if wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  INSERT INTO product_prices
    (uuid, tenant_id, product_unit_id, branch_id, amount_minor, valid_from, created_by)
  VALUES
    ('0198c000-0000-7000-8000-000000000024', 1, 1, 2, 13000, '2026-08-15T01:00:00.000Z', 1);
" >/dev/null 2>&1; then
  echo "Cross-tenant product-price/branch foreign key was not enforced." >&2
  exit 1
fi

wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --file migrations/0006_wandering_northstar.sql
wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  INSERT INTO inventory_batches
    (id, uuid, tenant_id, product_id, supplier_id, batch_number, received_at,
     expires_at, unit_cost_minor, created_by)
  VALUES
    (1, '0198c000-0000-7000-8000-000000000028', 1, 1, 1, 'BATCH01',
     '2026-08-01T00:00:00.000Z', '2027-08-01T00:00:00.000Z', 9000, 1);
  INSERT INTO inventory_balances
    (id, tenant_id, branch_id, warehouse_id, location_id, product_id, batch_id,
     batch_key, on_hand_minor, reserved_minor)
  VALUES (1, 1, 1, 1, 1, 1, 1, '1', 10, 3);
  INSERT INTO stock_movements
    (id, uuid, tenant_id, branch_id, warehouse_id, location_id, product_id,
     batch_id, batch_key, type, quantity_minor, balance_after_minor,
     reserved_after_minor, reason, reference_type, reference_uuid, created_by)
  VALUES
    (1, '0198c000-0000-7000-8000-000000000029', 1, 1, 1, 1, 1, 1, '1',
     'opening', 10, 10, 3, 'Migration opening stock', 'opening',
     'migration-opening-reference', 1);
  INSERT INTO inventory_reservations
    (id, uuid, tenant_id, branch_id, product_id, requested_minor, status,
     expires_at, created_by)
  VALUES
    (1, '0198c000-0000-7000-8000-000000000030', 1, 1, 1, 3, 'active',
     '2026-08-15T08:15:00.000Z', 1);
  INSERT INTO inventory_reservation_items
    (id, tenant_id, reservation_id, branch_id, warehouse_id, location_id,
     product_id, batch_id, batch_key, quantity_minor)
  VALUES (1, 1, 1, 1, 1, 1, 1, 1, '1', 3);
"

if wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  INSERT INTO inventory_batches
    (uuid, tenant_id, product_id, supplier_id, batch_number, received_at, created_by)
  VALUES
    ('0198c000-0000-7000-8000-000000000031', 1, 1, 2, 'CROSSSUP',
     '2026-08-01T00:00:00.000Z', 1);
" >/dev/null 2>&1; then
  echo "Cross-tenant inventory batch/supplier foreign key was not enforced." >&2
  exit 1
fi

if wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  INSERT INTO inventory_balances
    (tenant_id, branch_id, warehouse_id, location_id, product_id, batch_id,
     batch_key, on_hand_minor)
  VALUES (1, 2, 1, 1, 1, 1, '1', 1);
" >/dev/null 2>&1; then
  echo "Cross-tenant inventory branch foreign key was not enforced." >&2
  exit 1
fi

if wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  UPDATE inventory_balances SET on_hand_minor = 2 WHERE tenant_id = 1 AND id = 1;
" >/dev/null 2>&1; then
  echo "Reserved inventory was allowed to exceed on-hand stock." >&2
  exit 1
fi

RESULT="$(wrangler d1 execute "$DATABASE" --local --persist-to "$UPGRADE_STATE" --command "
  SELECT CASE
    WHEN (SELECT count(*) FROM sessions WHERE id = 1 AND active_branch_id IS NULL) = 1
     AND (SELECT count(*) FROM audit_logs WHERE id = 1) = 1
     AND (SELECT count(*) FROM permissions) = 26
     AND (SELECT count(*) FROM pragma_table_info('rate_limit_buckets')) = 8
     AND (SELECT count(*) FROM warehouses WHERE tenant_id = 1 AND branch_id = 1) = 1
     AND (SELECT count(*) FROM locations WHERE tenant_id = 1 AND warehouse_id = 1) = 1
     AND (SELECT count(*) FROM pos_terminals WHERE tenant_id = 1 AND branch_id = 1) = 1
     AND (SELECT count(*) FROM categories WHERE tenant_id = 1 AND id = 1) = 1
     AND (SELECT count(*) FROM brands WHERE tenant_id = 1 AND id = 1) = 1
     AND (SELECT count(*) FROM units WHERE tenant_id = 1 AND id = 1) = 1
     AND (SELECT count(*) FROM products WHERE tenant_id = 1 AND id = 1) = 1
     AND (SELECT count(*) FROM product_units WHERE tenant_id = 1 AND product_id = 1) = 1
     AND (SELECT count(*) FROM product_prices WHERE tenant_id = 1 AND branch_id = 1) = 1
     AND (SELECT count(*) FROM suppliers WHERE tenant_id = 1 AND id = 1) = 1
     AND (SELECT count(*) FROM customers WHERE tenant_id = 1 AND id = 1) = 1
     AND (SELECT count(*) FROM inventory_batches WHERE tenant_id = 1 AND product_id = 1) = 1
     AND (SELECT on_hand_minor - reserved_minor FROM inventory_balances WHERE tenant_id = 1 AND id = 1) = 7
     AND (SELECT count(*) FROM stock_movements WHERE tenant_id = 1 AND branch_id = 1) = 1
     AND (SELECT count(*) FROM inventory_reservations WHERE tenant_id = 1 AND status = 'active') = 1
     AND (SELECT count(*) FROM inventory_reservation_items WHERE tenant_id = 1 AND reservation_id = 1) = 1
    THEN 'ok' ELSE 'failed'
  END AS migration_upgrade;
")"

echo "$RESULT" | grep -q '"migration_upgrade": "ok"'
echo "Migration upgrade preservation check passed."
