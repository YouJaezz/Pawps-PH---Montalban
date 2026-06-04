ALTER TABLE `order_items` ADD `sale_unit` text DEFAULT 'Piece' NOT NULL;
--> statement-breakpoint
ALTER TABLE `order_items` ADD `quantity_tenths` integer;
