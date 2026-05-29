ALTER TABLE `products` ADD `archived` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `supplier_catalog_items` ADD `item_type` text;
--> statement-breakpoint
ALTER TABLE `supplier_catalog_items` ADD `product_name` text;
