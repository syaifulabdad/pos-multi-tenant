CREATE TABLE `branches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`timezone` text DEFAULT 'Asia/Jakarta' NOT NULL,
	`address` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "branches_status_check" CHECK("branches"."status" IN ('active', 'inactive')),
	CONSTRAINT "branches_code_uppercase_check" CHECK("branches"."code" = upper("branches"."code"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branches_uuid_unique` ON `branches` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `branches_tenant_code_unique` ON `branches` (`tenant_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `branches_tenant_id_unique` ON `branches` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `branches_tenant_status_idx` ON `branches` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`resource` text NOT NULL,
	`action` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_code_unique` ON `permissions` (`code`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`tenant_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	`permission_id` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`tenant_id`, `role_id`, `permission_id`),
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`role_id`) REFERENCES `roles`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `role_permissions_permission_idx` ON `role_permissions` (`permission_id`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_system` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "roles_code_lowercase_check" CHECK("roles"."code" = lower("roles"."code"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_uuid_unique` ON `roles` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `roles_tenant_code_unique` ON `roles` (`tenant_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `roles_tenant_id_unique` ON `roles` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `roles_tenant_active_idx` ON `roles` (`tenant_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `user_branches` (
	`tenant_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`tenant_id`, `user_id`, `branch_id`),
	FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_branches_tenant_user_idx` ON `user_branches` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_branches_one_default_unique` ON `user_branches` (`tenant_id`,`user_id`) WHERE "user_branches"."is_default" = 1;--> statement-breakpoint
CREATE TABLE `user_roles` (
	`tenant_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`tenant_id`, `user_id`, `role_id`),
	FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`role_id`) REFERENCES `roles`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_roles_tenant_user_idx` ON `user_roles` (`tenant_id`,`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`active_branch_id` integer,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`revoked_at` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`active_branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "uuid", "tenant_id", "user_id", "active_branch_id", "token_hash", "expires_at", "last_seen_at", "revoked_at", "ip_address", "user_agent", "created_at") SELECT "id", "uuid", "tenant_id", "user_id", NULL, "token_hash", "expires_at", "last_seen_at", "revoked_at", "ip_address", "user_agent", "created_at" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_uuid_unique` ON `sessions` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_tenant_user_idx` ON `sessions` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expiry_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `__new_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`branch_id` integer,
	`user_id` integer,
	`request_id` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`before_json` text,
	`after_json` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_audit_logs`("id", "tenant_id", "branch_id", "user_id", "request_id", "action", "entity", "entity_id", "before_json", "after_json", "ip_address", "user_agent", "created_at") SELECT "id", "tenant_id", "branch_id", "user_id", "request_id", "action", "entity", "entity_id", "before_json", "after_json", "ip_address", "user_agent", "created_at" FROM `audit_logs`;--> statement-breakpoint
DROP TABLE `audit_logs`;--> statement-breakpoint
ALTER TABLE `__new_audit_logs` RENAME TO `audit_logs`;--> statement-breakpoint
CREATE INDEX `audit_logs_tenant_created_idx` ON `audit_logs` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_tenant_entity_idx` ON `audit_logs` (`tenant_id`,`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_tenant_user_idx` ON `audit_logs` (`tenant_id`,`user_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `permissions` (`code`, `resource`, `action`, `description`) VALUES
	('branch.view', 'branch', 'view', 'View assigned branches'),
	('branch.switch', 'branch', 'switch', 'Switch between assigned branches'),
	('product.view', 'product', 'view', 'View products'),
	('product.create', 'product', 'create', 'Create products'),
	('product.update', 'product', 'update', 'Update products'),
	('product.archive', 'product', 'archive', 'Archive products'),
	('purchase.view', 'purchase', 'view', 'View purchases'),
	('purchase.create', 'purchase', 'create', 'Create purchases'),
	('purchase.approve', 'purchase', 'approve', 'Approve purchases'),
	('purchase.receive', 'purchase', 'receive', 'Receive purchases'),
	('sales.view', 'sales', 'view', 'View sales'),
	('sales.create', 'sales', 'create', 'Create sales'),
	('sales.return', 'sales', 'return', 'Process sales returns'),
	('sales.refund', 'sales', 'refund', 'Process sales refunds'),
	('stock.view', 'stock', 'view', 'View stock'),
	('stock.adjust', 'stock', 'adjust', 'Adjust stock'),
	('stock.opname', 'stock', 'opname', 'Run stock opname'),
	('stock.transfer', 'stock', 'transfer', 'Transfer stock'),
	('report.sales', 'report', 'sales', 'View sales reports'),
	('report.profit', 'report', 'profit', 'View profit reports'),
	('prescription.view', 'prescription', 'view', 'View prescriptions'),
	('prescription.create', 'prescription', 'create', 'Create prescriptions'),
	('prescription.dispense', 'prescription', 'dispense', 'Dispense prescriptions'),
	('user.manage', 'user', 'manage', 'Manage users'),
	('role.manage', 'role', 'manage', 'Manage roles and permissions'),
	('settings.manage', 'settings', 'manage', 'Manage tenant settings');
