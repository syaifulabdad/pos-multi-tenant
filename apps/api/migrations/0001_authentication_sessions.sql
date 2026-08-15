CREATE TABLE `audit_logs` (
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
	FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `audit_logs_tenant_created_idx` ON `audit_logs` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_tenant_entity_idx` ON `audit_logs` (`tenant_id`,`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_tenant_user_idx` ON `audit_logs` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `login_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`user_id` integer,
	`email_hash` text NOT NULL,
	`success` integer NOT NULL,
	`failure_reason` text,
	`ip_address` text,
	`user_agent` text,
	`request_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `login_history_tenant_created_idx` ON `login_history` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `login_history_tenant_user_idx` ON `login_history` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`user_id` integer,
	`request_id` text NOT NULL,
	`event_type` text NOT NULL,
	`severity` text DEFAULT 'warning' NOT NULL,
	`metadata_json` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `security_events_tenant_created_idx` ON `security_events` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `security_events_tenant_type_idx` ON `security_events` (`tenant_id`,`event_type`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`revoked_at` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_uuid_unique` ON `sessions` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_tenant_user_idx` ON `sessions` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expiry_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tenant_id` integer NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`failed_login_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`password_changed_at` text,
	`last_login_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "users_email_lowercase_check" CHECK("users"."email" = lower("users"."email")),
	CONSTRAINT "users_failed_login_attempts_check" CHECK("users"."failed_login_attempts" >= 0),
	CONSTRAINT "users_status_check" CHECK("users"."status" IN ('invited', 'active', 'disabled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_uuid_unique` ON `users` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_tenant_email_unique` ON `users` (`tenant_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_tenant_id_unique` ON `users` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `users_tenant_status_idx` ON `users` (`tenant_id`,`status`);