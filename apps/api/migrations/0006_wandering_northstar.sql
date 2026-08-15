CREATE TABLE `inventory_balances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	`warehouse_id` integer NOT NULL,
	`location_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`batch_id` integer,
	`batch_key` text NOT NULL,
	`on_hand_minor` integer DEFAULT 0 NOT NULL,
	`reserved_minor` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`,`branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`branch_id`,`warehouse_id`) REFERENCES `warehouses`(`tenant_id`,`branch_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`warehouse_id`,`location_id`) REFERENCES `locations`(`tenant_id`,`warehouse_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`product_id`) REFERENCES `products`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`product_id`,`batch_id`) REFERENCES `inventory_batches`(`tenant_id`,`product_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "inventory_balances_nonnegative_check" CHECK("inventory_balances"."on_hand_minor" >= 0 AND "inventory_balances"."reserved_minor" >= 0),
	CONSTRAINT "inventory_balances_reserved_check" CHECK("inventory_balances"."reserved_minor" <= "inventory_balances"."on_hand_minor"),
	CONSTRAINT "inventory_balances_batch_key_check" CHECK("inventory_balances"."batch_key" = coalesce(CAST("inventory_balances"."batch_id" AS TEXT), 'none'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_balances_scope_unique` ON `inventory_balances` (`tenant_id`,`branch_id`,`location_id`,`product_id`,`batch_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_balances_tenant_id_unique` ON `inventory_balances` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `inventory_balances_tenant_branch_product_idx` ON `inventory_balances` (`tenant_id`,`branch_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `inventory_balances_tenant_batch_idx` ON `inventory_balances` (`tenant_id`,`batch_id`);--> statement-breakpoint
CREATE TABLE `inventory_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`supplier_id` integer,
	`batch_number` text,
	`received_at` text NOT NULL,
	`manufactured_at` text,
	`expires_at` text,
	`unit_cost_minor` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`,`product_id`) REFERENCES `products`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`supplier_id`) REFERENCES `suppliers`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`created_by`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "inventory_batches_status_check" CHECK("inventory_batches"."status" IN ('available', 'quarantine', 'depleted', 'blocked')),
	CONSTRAINT "inventory_batches_cost_check" CHECK("inventory_batches"."unit_cost_minor" >= 0),
	CONSTRAINT "inventory_batches_currency_check" CHECK(length("inventory_batches"."currency") = 3),
	CONSTRAINT "inventory_batches_expiry_check" CHECK("inventory_batches"."expires_at" IS NULL OR "inventory_batches"."expires_at" >= "inventory_batches"."received_at"),
	CONSTRAINT "inventory_batches_manufactured_check" CHECK("inventory_batches"."manufactured_at" IS NULL OR "inventory_batches"."manufactured_at" <= "inventory_batches"."received_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_batches_uuid_unique` ON `inventory_batches` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_batches_tenant_id_unique` ON `inventory_batches` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_batches_tenant_product_id_unique` ON `inventory_batches` (`tenant_id`,`product_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_batches_tenant_product_number_unique` ON `inventory_batches` (`tenant_id`,`product_id`,`batch_number`) WHERE "inventory_batches"."batch_number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `inventory_batches_tenant_product_expiry_idx` ON `inventory_batches` (`tenant_id`,`product_id`,`expires_at`,`received_at`);--> statement-breakpoint
CREATE INDEX `inventory_batches_tenant_status_idx` ON `inventory_batches` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `inventory_reservation_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`reservation_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	`warehouse_id` integer NOT NULL,
	`location_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`batch_id` integer,
	`batch_key` text NOT NULL,
	`quantity_minor` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`,`reservation_id`) REFERENCES `inventory_reservations`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`branch_id`,`warehouse_id`) REFERENCES `warehouses`(`tenant_id`,`branch_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`warehouse_id`,`location_id`) REFERENCES `locations`(`tenant_id`,`warehouse_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`product_id`) REFERENCES `products`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`product_id`,`batch_id`) REFERENCES `inventory_batches`(`tenant_id`,`product_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "inventory_reservation_items_quantity_check" CHECK("inventory_reservation_items"."quantity_minor" > 0),
	CONSTRAINT "inventory_reservation_items_batch_key_check" CHECK("inventory_reservation_items"."batch_key" = coalesce(CAST("inventory_reservation_items"."batch_id" AS TEXT), 'none'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_reservation_items_allocation_unique` ON `inventory_reservation_items` (`tenant_id`,`reservation_id`,`location_id`,`batch_key`);--> statement-breakpoint
CREATE INDEX `inventory_reservation_items_tenant_reservation_idx` ON `inventory_reservation_items` (`tenant_id`,`reservation_id`);--> statement-breakpoint
CREATE TABLE `inventory_reservations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`requested_minor` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` text NOT NULL,
	`released_at` text,
	`consumed_at` text,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`,`branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`product_id`) REFERENCES `products`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`created_by`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "inventory_reservations_quantity_check" CHECK("inventory_reservations"."requested_minor" > 0),
	CONSTRAINT "inventory_reservations_status_check" CHECK("inventory_reservations"."status" IN ('active', 'released', 'consumed', 'expired')),
	CONSTRAINT "inventory_reservations_lifecycle_check" CHECK(("inventory_reservations"."status" = 'active' AND "inventory_reservations"."released_at" IS NULL AND "inventory_reservations"."consumed_at" IS NULL) OR ("inventory_reservations"."status" IN ('released', 'expired') AND "inventory_reservations"."released_at" IS NOT NULL AND "inventory_reservations"."consumed_at" IS NULL) OR ("inventory_reservations"."status" = 'consumed' AND "inventory_reservations"."consumed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_reservations_uuid_unique` ON `inventory_reservations` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_reservations_tenant_id_unique` ON `inventory_reservations` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `inventory_reservations_tenant_branch_status_idx` ON `inventory_reservations` (`tenant_id`,`branch_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	`warehouse_id` integer NOT NULL,
	`location_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`batch_id` integer,
	`batch_key` text NOT NULL,
	`type` text NOT NULL,
	`quantity_minor` integer NOT NULL,
	`balance_after_minor` integer NOT NULL,
	`reserved_after_minor` integer NOT NULL,
	`reason` text NOT NULL,
	`reference_type` text NOT NULL,
	`reference_uuid` text NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`,`branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`branch_id`,`warehouse_id`) REFERENCES `warehouses`(`tenant_id`,`branch_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`warehouse_id`,`location_id`) REFERENCES `locations`(`tenant_id`,`warehouse_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`product_id`) REFERENCES `products`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`product_id`,`batch_id`) REFERENCES `inventory_batches`(`tenant_id`,`product_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`created_by`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "stock_movements_type_check" CHECK("stock_movements"."type" IN ('opening', 'adjustment_in', 'adjustment_out', 'receipt', 'sale', 'sale_return', 'purchase_return', 'transfer_in', 'transfer_out', 'opname_in', 'opname_out')),
	CONSTRAINT "stock_movements_quantity_check" CHECK("stock_movements"."quantity_minor" <> 0),
	CONSTRAINT "stock_movements_balance_check" CHECK("stock_movements"."balance_after_minor" >= 0 AND "stock_movements"."reserved_after_minor" >= 0 AND "stock_movements"."reserved_after_minor" <= "stock_movements"."balance_after_minor"),
	CONSTRAINT "stock_movements_batch_key_check" CHECK("stock_movements"."batch_key" = coalesce(CAST("stock_movements"."batch_id" AS TEXT), 'none'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_movements_uuid_unique` ON `stock_movements` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `stock_movements_tenant_reference_unique` ON `stock_movements` (`tenant_id`,`reference_type`,`reference_uuid`);--> statement-breakpoint
CREATE INDEX `stock_movements_tenant_branch_product_created_idx` ON `stock_movements` (`tenant_id`,`branch_id`,`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_tenant_batch_created_idx` ON `stock_movements` (`tenant_id`,`batch_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `locations_tenant_warehouse_id_unique` ON `locations` (`tenant_id`,`warehouse_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `warehouses_tenant_branch_id_unique` ON `warehouses` (`tenant_id`,`branch_id`,`id`);