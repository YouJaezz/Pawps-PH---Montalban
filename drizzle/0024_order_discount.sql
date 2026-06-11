ALTER TABLE `orders` ADD `subtotal_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_type` text DEFAULT 'None' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_value` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_note` text;--> statement-breakpoint
UPDATE `orders` SET `subtotal_cents` = `total_amount` WHERE `subtotal_cents` = 0;
