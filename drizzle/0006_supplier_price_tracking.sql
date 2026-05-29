CREATE TABLE `supplier_price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer NOT NULL,
	`document_id` integer NOT NULL,
	`item_key` text NOT NULL,
	`item_name` text NOT NULL,
	`brand` text,
	`variant` text,
	`unit_cost` integer,
	`retail_price` integer,
	`per_kilo_price` integer,
	`recorded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `supplier_price_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer NOT NULL,
	`item_key` text NOT NULL,
	`item_name` text NOT NULL,
	`brand` text,
	`variant` text,
	`previous_unit_cost` integer,
	`new_unit_cost` integer,
	`change_percent` integer,
	`previous_document_id` integer,
	`new_document_id` integer NOT NULL,
	`recorded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
