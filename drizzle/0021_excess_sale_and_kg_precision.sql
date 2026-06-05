ALTER TABLE `order_items` ADD `is_excess_sale` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `order_items` ADD `line_note` text;
--> statement-breakpoint
UPDATE `order_items` SET `quantity_tenths` = `quantity_tenths` * 10 WHERE `sale_unit` = 'Kilogram' AND `quantity_tenths` IS NOT NULL;
