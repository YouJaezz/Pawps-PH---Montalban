CREATE TABLE `delivery_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer,
	`customer_name` text,
	`location` text,
	`delivery_method` text NOT NULL,
	`status` text DEFAULT 'Queued' NOT NULL,
	`fee` integer DEFAULT 0 NOT NULL,
	`reference` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`price_tier` text DEFAULT 'Retail' NOT NULL,
	`unit_price` integer NOT NULL,
	`line_total` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transport_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_name` text NOT NULL,
	`contact` text,
	`pickup_location` text NOT NULL,
	`dropoff_location` text NOT NULL,
	`pet_details` text,
	`service_type` text DEFAULT 'Pet Taxi' NOT NULL,
	`status` text DEFAULT 'Requested' NOT NULL,
	`fee` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `customer_id` integer;