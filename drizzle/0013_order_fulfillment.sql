UPDATE `orders` SET `order_status` = 'Confirmed' WHERE `order_status` = 'Active';
--> statement-breakpoint
ALTER TABLE `orders` ADD `contact` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `notes` text;
