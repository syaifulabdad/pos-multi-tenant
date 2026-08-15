CREATE TABLE `brands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "brands_status_check" CHECK("brands"."status" IN ('active', 'inactive')),
	CONSTRAINT "brands_code_uppercase_check" CHECK("brands"."code" = upper("brands"."code"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_uuid_unique` ON `brands` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `brands_tenant_code_unique` ON `brands` (`tenant_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `brands_tenant_id_unique` ON `brands` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `brands_tenant_status_idx` ON `brands` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`parent_id` integer,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`parent_id`) REFERENCES `categories`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "categories_status_check" CHECK("categories"."status" IN ('active', 'inactive')),
	CONSTRAINT "categories_code_uppercase_check" CHECK("categories"."code" = upper("categories"."code")),
	CONSTRAINT "categories_parent_self_check" CHECK("categories"."parent_id" IS NULL OR "categories"."parent_id" <> "categories"."id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_uuid_unique` ON `categories` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_tenant_code_unique` ON `categories` (`tenant_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_tenant_id_unique` ON `categories` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `categories_tenant_parent_idx` ON `categories` (`tenant_id`,`parent_id`);--> statement-breakpoint
CREATE INDEX `categories_tenant_status_idx` ON `categories` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'individual' NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "customers_status_check" CHECK("customers"."status" IN ('active', 'inactive')),
	CONSTRAINT "customers_type_check" CHECK("customers"."type" IN ('individual', 'business')),
	CONSTRAINT "customers_code_uppercase_check" CHECK("customers"."code" = upper("customers"."code"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_uuid_unique` ON `customers` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_tenant_code_unique` ON `customers` (`tenant_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_tenant_id_unique` ON `customers` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `customers_tenant_status_idx` ON `customers` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `customers_tenant_name_idx` ON `customers` (`tenant_id`,`name`);--> statement-breakpoint
CREATE INDEX `customers_tenant_phone_idx` ON `customers` (`tenant_id`,`phone`);--> statement-breakpoint
CREATE TABLE `product_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`product_unit_id` integer NOT NULL,
	`branch_id` integer,
	`amount_minor` integer NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`,`product_unit_id`) REFERENCES `product_units`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`created_by`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "product_prices_amount_check" CHECK("product_prices"."amount_minor" >= 0),
	CONSTRAINT "product_prices_currency_check" CHECK(length("product_prices"."currency") = 3),
	CONSTRAINT "product_prices_status_check" CHECK("product_prices"."status" IN ('active', 'superseded')),
	CONSTRAINT "product_prices_validity_check" CHECK("product_prices"."valid_to" IS NULL OR "product_prices"."valid_to" > "product_prices"."valid_from")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_prices_uuid_unique` ON `product_prices` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_prices_active_global_unique` ON `product_prices` (`tenant_id`,`product_unit_id`) WHERE "product_prices"."branch_id" IS NULL AND "product_prices"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `product_prices_active_branch_unique` ON `product_prices` (`tenant_id`,`product_unit_id`,`branch_id`) WHERE "product_prices"."branch_id" IS NOT NULL AND "product_prices"."status" = 'active';--> statement-breakpoint
CREATE INDEX `product_prices_tenant_unit_history_idx` ON `product_prices` (`tenant_id`,`product_unit_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `product_units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`unit_id` integer NOT NULL,
	`conversion_numerator` integer DEFAULT 1 NOT NULL,
	`conversion_denominator` integer DEFAULT 1 NOT NULL,
	`barcode` text,
	`is_base` integer DEFAULT false NOT NULL,
	`is_sale_unit` integer DEFAULT true NOT NULL,
	`is_purchase_unit` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`,`product_id`) REFERENCES `products`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`unit_id`) REFERENCES `units`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "product_units_status_check" CHECK("product_units"."status" IN ('active', 'inactive')),
	CONSTRAINT "product_units_conversion_check" CHECK("product_units"."conversion_numerator" > 0 AND "product_units"."conversion_denominator" > 0),
	CONSTRAINT "product_units_base_conversion_check" CHECK("product_units"."is_base" = 0 OR ("product_units"."conversion_numerator" = 1 AND "product_units"."conversion_denominator" = 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_units_uuid_unique` ON `product_units` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_units_tenant_product_unit_unique` ON `product_units` (`tenant_id`,`product_id`,`unit_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_units_tenant_id_unique` ON `product_units` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_units_tenant_barcode_unique` ON `product_units` (`tenant_id`,`barcode`) WHERE "product_units"."barcode" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `product_units_one_base_unique` ON `product_units` (`tenant_id`,`product_id`) WHERE "product_units"."is_base" = 1;--> statement-breakpoint
CREATE INDEX `product_units_tenant_product_idx` ON `product_units` (`tenant_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`category_id` integer,
	`brand_id` integer,
	`base_unit_id` integer NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'stock' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`track_batches` integer DEFAULT false NOT NULL,
	`track_expiry` integer DEFAULT false NOT NULL,
	`allow_decimal` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`,`category_id`) REFERENCES `categories`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`brand_id`) REFERENCES `brands`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`base_unit_id`) REFERENCES `units`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "products_status_check" CHECK("products"."status" IN ('active', 'inactive')),
	CONSTRAINT "products_type_check" CHECK("products"."type" IN ('stock', 'service')),
	CONSTRAINT "products_sku_uppercase_check" CHECK("products"."sku" = upper("products"."sku")),
	CONSTRAINT "products_expiry_requires_batch_check" CHECK("products"."track_expiry" = 0 OR "products"."track_batches" = 1),
	CONSTRAINT "products_service_tracking_check" CHECK("products"."type" = 'stock' OR ("products"."track_batches" = 0 AND "products"."track_expiry" = 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_uuid_unique` ON `products` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_tenant_sku_unique` ON `products` (`tenant_id`,`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_tenant_id_unique` ON `products` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `products_tenant_category_idx` ON `products` (`tenant_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `products_tenant_brand_idx` ON `products` (`tenant_id`,`brand_id`);--> statement-breakpoint
CREATE INDEX `products_tenant_status_idx` ON `products` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`phone` text,
	`email` text,
	`address` text,
	`tax_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "suppliers_status_check" CHECK("suppliers"."status" IN ('active', 'inactive')),
	CONSTRAINT "suppliers_code_uppercase_check" CHECK("suppliers"."code" = upper("suppliers"."code"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_uuid_unique` ON `suppliers` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_tenant_code_unique` ON `suppliers` (`tenant_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_tenant_id_unique` ON `suppliers` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `suppliers_tenant_status_idx` ON `suppliers` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `suppliers_tenant_name_idx` ON `suppliers` (`tenant_id`,`name`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`precision` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "units_status_check" CHECK("units"."status" IN ('active', 'inactive')),
	CONSTRAINT "units_code_uppercase_check" CHECK("units"."code" = upper("units"."code")),
	CONSTRAINT "units_precision_check" CHECK("units"."precision" BETWEEN 0 AND 6)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `units_uuid_unique` ON `units` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `units_tenant_code_unique` ON `units` (`tenant_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `units_tenant_id_unique` ON `units` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `units_tenant_status_idx` ON `units` (`tenant_id`,`status`);