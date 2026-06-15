CREATE TABLE `branches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`location` text,
	`notes` text,
	`is_default` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `branches` (`name`, `location`, `notes`, `is_default`, `active`)
VALUES ('PAWPS Shop', 'Montalban store', 'Main shop — all existing stock starts here', 1, 1);
--> statement-breakpoint
CREATE TABLE `branch_stock` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`stock_quantity` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branch_stock_branch_product_unique` ON `branch_stock` (`branch_id`,`product_id`);
--> statement-breakpoint
INSERT INTO `branch_stock` (`branch_id`, `product_id`, `stock_quantity`)
SELECT 1, `id`, `stock_quantity` FROM `products`;
--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `branch_id` integer;
--> statement-breakpoint
UPDATE `stock_movements` SET `branch_id` = 1 WHERE `branch_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `branch_id` integer;
--> statement-breakpoint
UPDATE `orders` SET `branch_id` = 1 WHERE `branch_id` IS NULL;
