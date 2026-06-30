CREATE TABLE `investor_funds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`investor_name` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`type` text NOT NULL,
	`date` integer NOT NULL,
	`notes` text,
	`recorded_by_user_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
