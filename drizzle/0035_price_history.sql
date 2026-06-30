CREATE TABLE `price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`price_kind` text NOT NULL,
	`old_price` integer NOT NULL,
	`new_price` integer NOT NULL,
	`changed_by_user_id` integer,
	`changed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`reason` text
);
