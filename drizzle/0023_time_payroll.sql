ALTER TABLE `users` ADD `hourly_rate_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`clock_in_at` integer NOT NULL,
	`clock_out_at` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payroll_payouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`period_year` integer NOT NULL,
	`period_month` integer NOT NULL,
	`minutes_worked` integer NOT NULL,
	`hourly_rate_cents` integer NOT NULL,
	`gross_pay_cents` integer NOT NULL,
	`status` text DEFAULT 'Accrued' NOT NULL,
	`paid_at` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
