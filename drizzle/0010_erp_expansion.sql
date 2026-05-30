ALTER TABLE `products` ADD `purchase_tier` text DEFAULT 'Wholesale' NOT NULL;
--> statement-breakpoint
CREATE TABLE `pre_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`customer_name` text,
	`expected_date` integer,
	`deposit_cents` integer DEFAULT 0 NOT NULL,
	`total_cost_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pre_order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pre_order_id` integer NOT NULL,
	`supplier_catalog_item_id` integer,
	`item_name` text NOT NULL,
	`brand` text,
	`variant` text,
	`quantity` integer DEFAULT 0 NOT NULL,
	`unit_cost_cents` integer DEFAULT 0 NOT NULL,
	`line_total_cents` integer DEFAULT 0 NOT NULL,
	`received_qty` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `delivery_status_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`delivery_log_id` integer NOT NULL,
	`previous_status` text,
	`new_status` text NOT NULL,
	`note` text,
	`changed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transport_pricing_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`base_fee_cents` integer DEFAULT 15000 NOT NULL,
	`per_km_cents` integer DEFAULT 2500 NOT NULL,
	`minimum_fee_cents` integer DEFAULT 15000 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `transport_pricing_settings` (`id`, `base_fee_cents`, `per_km_cents`, `minimum_fee_cents`) VALUES (1, 15000, 2500, 15000);
--> statement-breakpoint
ALTER TABLE `transport_jobs` ADD `distance_km_tenths` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `transport_jobs` ADD `base_fee_cents` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `transport_jobs` ADD `distance_fee_cents` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `transport_jobs` ADD `extras_total_cents` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `transport_jobs` ADD `tracking_token` text;
--> statement-breakpoint
ALTER TABLE `transport_jobs` ADD `driver_lat` text;
--> statement-breakpoint
ALTER TABLE `transport_jobs` ADD `driver_lng` text;
--> statement-breakpoint
ALTER TABLE `transport_jobs` ADD `last_location_at` integer;
--> statement-breakpoint
ALTER TABLE `transport_jobs` ADD `receipt_number` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `transport_jobs_tracking_token_unique` ON `transport_jobs` (`tracking_token`);
--> statement-breakpoint
CREATE TABLE `transport_extras` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transport_job_id` integer NOT NULL,
	`label` text NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transport_location_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transport_job_id` integer NOT NULL,
	`lat` text NOT NULL,
	`lng` text NOT NULL,
	`recorded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
