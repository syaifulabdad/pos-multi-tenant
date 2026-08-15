CREATE TABLE `rate_limit_buckets` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`tenant_id` integer NOT NULL,
	`category` text NOT NULL,
	`scope` text NOT NULL,
	`request_count` integer NOT NULL,
	`window_started_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "rate_limit_buckets_count_check" CHECK("rate_limit_buckets"."request_count" >= 0),
	CONSTRAINT "rate_limit_buckets_window_check" CHECK("rate_limit_buckets"."expires_at" > "rate_limit_buckets"."window_started_at")
);
--> statement-breakpoint
CREATE INDEX `rate_limit_buckets_tenant_category_idx` ON `rate_limit_buckets` (`tenant_id`,`category`);--> statement-breakpoint
CREATE INDEX `rate_limit_buckets_expiry_idx` ON `rate_limit_buckets` (`expires_at`);