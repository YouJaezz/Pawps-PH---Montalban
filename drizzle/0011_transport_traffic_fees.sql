ALTER TABLE `transport_pricing_settings` ADD `traffic_per_min_cents` integer DEFAULT 800 NOT NULL;
--> statement-breakpoint
ALTER TABLE `transport_pricing_settings` ADD `stop_light_fee_cents` integer DEFAULT 2000 NOT NULL;
--> statement-breakpoint
UPDATE `transport_pricing_settings` SET `traffic_per_min_cents` = 800, `stop_light_fee_cents` = 2000 WHERE `id` = 1;
--> statement-breakpoint
ALTER TABLE `transport_jobs` ADD `traffic_fee_cents` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `transport_jobs` ADD `stop_light_fee_cents` integer DEFAULT 0 NOT NULL;
