CREATE TABLE `social_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`caption` text,
	`permalink` text,
	`thumbnail_url` text,
	`published_at` integer,
	`view_count` integer DEFAULT 0 NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`share_count` integer DEFAULT 0 NOT NULL,
	`reach_count` integer DEFAULT 0 NOT NULL,
	`synced_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_posts_platform_external_idx` ON `social_posts` (`platform`,`external_id`);--> statement-breakpoint
CREATE TABLE `social_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`post_external_id` text NOT NULL,
	`author_name` text,
	`author_handle` text,
	`message` text NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`published_at` integer,
	`permalink` text,
	`is_hidden` integer DEFAULT false NOT NULL,
	`synced_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_comments_platform_external_idx` ON `social_comments` (`platform`,`external_id`);
