CREATE TABLE `branch_cash_remittances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`remitted_at` integer NOT NULL,
	`note` text,
	`recorded_by_user_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);--> statement-breakpoint
CREATE INDEX `branch_cash_remittances_branch_id_idx` ON `branch_cash_remittances` (`branch_id`);--> statement-breakpoint
CREATE INDEX `branch_cash_remittances_remitted_at_idx` ON `branch_cash_remittances` (`remitted_at`);
