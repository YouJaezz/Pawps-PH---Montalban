CREATE TABLE `attendance_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`auto_cutoff_enabled` integer DEFAULT true NOT NULL,
	`cutoff_hour` integer DEFAULT 19 NOT NULL,
	`cutoff_minute` integer DEFAULT 30 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `attendance_settings` (`id`, `auto_cutoff_enabled`, `cutoff_hour`, `cutoff_minute`) VALUES (1, 1, 19, 30);
