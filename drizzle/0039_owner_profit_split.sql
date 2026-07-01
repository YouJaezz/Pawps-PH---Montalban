CREATE TABLE `owner_profit_split_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner1_name` text DEFAULT 'Owner 1' NOT NULL,
	`owner2_name` text DEFAULT 'Owner 2' NOT NULL,
	`owner1_percent` integer DEFAULT 40 NOT NULL,
	`owner2_percent` integer DEFAULT 40 NOT NULL,
	`payroll_pool_percent` integer DEFAULT 20 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `owner_profit_split_settings` (
	`id`,
	`owner1_name`,
	`owner2_name`,
	`owner1_percent`,
	`owner2_percent`,
	`payroll_pool_percent`
) VALUES (1, 'Owner 1', 'Owner 2', 40, 40, 20);
