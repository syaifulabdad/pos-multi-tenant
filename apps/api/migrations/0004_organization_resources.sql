CREATE TABLE `warehouses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`address` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`,`branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "warehouses_status_check" CHECK("warehouses"."status" IN ('active', 'inactive')),
	CONSTRAINT "warehouses_code_uppercase_check" CHECK("warehouses"."code" = upper("warehouses"."code"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warehouses_uuid_unique` ON `warehouses` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `warehouses_tenant_code_unique` ON `warehouses` (`tenant_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `warehouses_tenant_id_unique` ON `warehouses` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `warehouses_tenant_branch_idx` ON `warehouses` (`tenant_id`,`branch_id`);--> statement-breakpoint
CREATE INDEX `warehouses_tenant_status_idx` ON `warehouses` (`tenant_id`,`status`);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`warehouse_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'storage' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`,`warehouse_id`) REFERENCES `warehouses`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "locations_type_check" CHECK("locations"."type" IN ('storage', 'sales_floor', 'receiving', 'quarantine', 'damaged', 'expired')),
	CONSTRAINT "locations_status_check" CHECK("locations"."status" IN ('active', 'inactive')),
	CONSTRAINT "locations_code_uppercase_check" CHECK("locations"."code" = upper("locations"."code"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_uuid_unique` ON `locations` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `locations_tenant_warehouse_code_unique` ON `locations` (`tenant_id`,`warehouse_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `locations_tenant_id_unique` ON `locations` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `locations_tenant_warehouse_idx` ON `locations` (`tenant_id`,`warehouse_id`);--> statement-breakpoint
CREATE INDEX `locations_tenant_status_idx` ON `locations` (`tenant_id`,`status`);
--> statement-breakpoint
CREATE TABLE `pos_terminals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_seen_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`,`branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "pos_terminals_status_check" CHECK("pos_terminals"."status" IN ('active', 'inactive')),
	CONSTRAINT "pos_terminals_code_uppercase_check" CHECK("pos_terminals"."code" = upper("pos_terminals"."code"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pos_terminals_uuid_unique` ON `pos_terminals` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `pos_terminals_tenant_code_unique` ON `pos_terminals` (`tenant_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `pos_terminals_tenant_id_unique` ON `pos_terminals` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `pos_terminals_tenant_branch_idx` ON `pos_terminals` (`tenant_id`,`branch_id`);--> statement-breakpoint
CREATE INDEX `pos_terminals_tenant_status_idx` ON `pos_terminals` (`tenant_id`,`status`);
