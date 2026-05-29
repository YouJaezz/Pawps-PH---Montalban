ALTER TABLE `delivery_logs` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT (unixepoch() * 1000);--> statement-breakpoint
ALTER TABLE `orders` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT (unixepoch() * 1000);--> statement-breakpoint
ALTER TABLE `transport_jobs` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT (unixepoch() * 1000);--> statement-breakpoint
ALTER TABLE `order_items` ADD `unit_cost` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Fix existing rows that were stored in seconds (unixepoch()) instead of ms.
UPDATE `orders` SET `created_at` = `created_at` * 1000 WHERE `created_at` < 1000000000000;
--> statement-breakpoint
UPDATE `delivery_logs` SET `created_at` = `created_at` * 1000 WHERE `created_at` < 1000000000000;
--> statement-breakpoint
UPDATE `transport_jobs` SET `created_at` = `created_at` * 1000 WHERE `created_at` < 1000000000000;