ALTER TABLE `products` ADD `stock_unit` text DEFAULT 'Piece' NOT NULL;
--> statement-breakpoint
ALTER TABLE `products` ADD `pack_size` text;
