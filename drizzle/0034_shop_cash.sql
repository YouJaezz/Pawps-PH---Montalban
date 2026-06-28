CREATE TABLE `shop_cash_outflows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`expense_category` text,
	`amount_cents` integer NOT NULL,
	`description` text NOT NULL,
	`vendor` text,
	`reference` text,
	`product_id` integer,
	`branch_id` integer,
	`supplier_id` integer,
	`stock_qty_added` integer,
	`paid_at` integer NOT NULL,
	`notes` text,
	`recorded_by_user_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
