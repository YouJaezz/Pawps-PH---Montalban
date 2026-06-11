CREATE TABLE `team_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_user_id` integer NOT NULL,
	`body` text NOT NULL,
	`is_announcement` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_chat_reads` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`last_read_message_id` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
