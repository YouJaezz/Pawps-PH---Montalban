-- Repair double-multiplied timestamps (year 50417+ display bug)
UPDATE `orders` SET `created_at` = CAST(`created_at` / 1000 AS INTEGER) WHERE `created_at` >= 1000000000000000;--> statement-breakpoint
UPDATE `orders` SET `created_at` = CAST(`created_at` / 1000 AS INTEGER) WHERE `created_at` >= 1000000000000000;--> statement-breakpoint
UPDATE `delivery_logs` SET `created_at` = CAST(`created_at` / 1000 AS INTEGER) WHERE `created_at` >= 1000000000000000;--> statement-breakpoint
UPDATE `transport_jobs` SET `created_at` = CAST(`created_at` / 1000 AS INTEGER) WHERE `created_at` >= 1000000000000000;--> statement-breakpoint
UPDATE `pre_orders` SET `created_at` = CAST(`created_at` / 1000 AS INTEGER) WHERE `created_at` >= 1000000000000000;--> statement-breakpoint
UPDATE `stock_movements` SET `created_at` = CAST(`created_at` / 1000 AS INTEGER) WHERE `created_at` >= 1000000000000000;
