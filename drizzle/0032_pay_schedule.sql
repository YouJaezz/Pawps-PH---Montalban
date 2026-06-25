ALTER TABLE `users` ADD `pay_schedule` text DEFAULT 'semi_monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE `payroll_payouts` ADD `period_day` integer DEFAULT 0 NOT NULL;
