ALTER TABLE `supplier_catalog_items` ADD `price_unit` text DEFAULT 'Sack';
--> statement-breakpoint
ALTER TABLE `supplier_catalog_items` ADD `units_per_case` integer DEFAULT 24;
--> statement-breakpoint
ALTER TABLE `products` ADD `units_per_case` integer DEFAULT 24;
