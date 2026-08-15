CREATE TABLE `tenant_domains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`hostname` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`verified_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "tenant_domains_hostname_lowercase_check" CHECK("tenant_domains"."hostname" = lower("tenant_domains"."hostname"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_domains_hostname_unique` ON `tenant_domains` (`hostname`);--> statement-breakpoint
CREATE INDEX `tenant_domains_tenant_idx` ON `tenant_domains` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `tenant_domains_verified_idx` ON `tenant_domains` (`verified_at`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`plan` text DEFAULT 'starter' NOT NULL,
	`business_type` text DEFAULT 'retail' NOT NULL,
	`ui_mode` text DEFAULT 'simple' NOT NULL,
	`timezone` text DEFAULT 'Asia/Jakarta' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "tenants_status_check" CHECK("tenants"."status" IN ('pending', 'active', 'suspended', 'inactive')),
	CONSTRAINT "tenants_business_type_check" CHECK("tenants"."business_type" IN ('retail', 'pharmacy', 'retail_pharmacy')),
	CONSTRAINT "tenants_ui_mode_check" CHECK("tenants"."ui_mode" IN ('simple', 'professional', 'advanced')),
	CONSTRAINT "tenants_slug_lowercase_check" CHECK("tenants"."slug" = lower("tenants"."slug")),
	CONSTRAINT "tenants_slug_length_check" CHECK(length("tenants"."slug") BETWEEN 2 AND 63)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_uuid_unique` ON `tenants` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE INDEX `tenants_status_idx` ON `tenants` (`status`);