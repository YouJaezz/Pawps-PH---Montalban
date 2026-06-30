ALTER TABLE `shop_cash_outflows` ADD `funding_source` text DEFAULT 'shop_cash' NOT NULL;
--> statement-breakpoint
CREATE TABLE `investor_capital_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`amount_cents` integer NOT NULL,
	`description` text NOT NULL,
	`contributed_at` integer NOT NULL,
	`investor_id` integer,
	`notes` text,
	`recorded_by_user_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `supplier_price_changes_new` (
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
	`new_document_id` integer,
	`change_source` text DEFAULT 'catalog_upload' NOT NULL,
	`shop_cash_outflow_id` integer,
	`recorded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `supplier_price_changes_new` (
	`id`, `supplier_id`, `item_key`, `item_name`, `brand`, `variant`,
	`previous_unit_cost`, `new_unit_cost`, `change_percent`,
	`previous_document_id`, `new_document_id`, `change_source`, `recorded_at`
)
SELECT
	`id`, `supplier_id`, `item_key`, `item_name`, `brand`, `variant`,
	`previous_unit_cost`, `new_unit_cost`, `change_percent`,
	`previous_document_id`, `new_document_id`, 'catalog_upload', `recorded_at`
FROM `supplier_price_changes`;
--> statement-breakpoint
DROP TABLE `supplier_price_changes`;
--> statement-breakpoint
ALTER TABLE `supplier_price_changes_new` RENAME TO `supplier_price_changes`;
