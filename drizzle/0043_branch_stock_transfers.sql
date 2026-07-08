CREATE TABLE `branch_stock_transfers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`from_branch_id` integer NOT NULL,
	`to_branch_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`note` text,
	`created_by_user_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);--> statement-breakpoint
CREATE INDEX `branch_stock_transfers_product_id_idx` ON `branch_stock_transfers` (`product_id`);--> statement-breakpoint
CREATE INDEX `branch_stock_transfers_from_branch_id_idx` ON `branch_stock_transfers` (`from_branch_id`);--> statement-breakpoint
CREATE INDEX `branch_stock_transfers_to_branch_id_idx` ON `branch_stock_transfers` (`to_branch_id`);--> statement-breakpoint
CREATE INDEX `branch_stock_transfers_created_at_idx` ON `branch_stock_transfers` (`created_at`);

