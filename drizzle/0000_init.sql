CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contact` text,
	`total_spend` integer DEFAULT 0 NOT NULL,
	`location` text
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_name` text NOT NULL,
	`location` text,
	`total_amount` integer NOT NULL,
	`amount_paid` integer DEFAULT 0 NOT NULL,
	`payment_status` text DEFAULT 'Pending' NOT NULL,
	`delivery_method` text,
	`store_type` text DEFAULT 'Online' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`brand` text NOT NULL,
	`variant` text,
	`cost_price` integer NOT NULL,
	`retail_price` integer NOT NULL,
	`bulk_price` integer NOT NULL,
	`stock_quantity` integer DEFAULT 0 NOT NULL,
	`expiry_date` integer
);
