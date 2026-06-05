ALTER TABLE `supplier_catalog_items` ADD `price_unit` text DEFAULT 'Sack';
ALTER TABLE `supplier_catalog_items` ADD `units_per_case` integer DEFAULT 24;
ALTER TABLE `products` ADD `units_per_case` integer DEFAULT 24;
