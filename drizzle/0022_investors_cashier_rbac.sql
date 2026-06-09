ALTER TABLE `orders` ADD `created_by_user_id` integer;
--> statement-breakpoint
ALTER TABLE `orders` ADD `cashier_name` text;
--> statement-breakpoint
CREATE TABLE `investors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`contact` text,
	`email` text,
	`address` text,
	`id_reference` text,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `investor_agreements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`investor_id` integer NOT NULL,
	`agreement_holder` text NOT NULL,
	`capital_cents` integer NOT NULL,
	`share_percent` integer NOT NULL,
	`agreement_date` integer,
	`effective_from` integer,
	`terms_notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `investor_payouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`investor_id` integer NOT NULL,
	`agreement_id` integer NOT NULL,
	`period_year` integer NOT NULL,
	`period_month` integer NOT NULL,
	`gross_revenue_cents` integer NOT NULL,
	`cogs_cents` integer NOT NULL,
	`net_income_cents` integer NOT NULL,
	`share_percent` integer NOT NULL,
	`payout_cents` integer NOT NULL,
	`status` text DEFAULT 'Accrued' NOT NULL,
	`paid_at` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
UPDATE `users` SET `role` = 'cashier' WHERE `role` = 'staff';
