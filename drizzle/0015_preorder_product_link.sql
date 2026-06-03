ALTER TABLE `pre_order_items` ADD `product_id` integer;
--> statement-breakpoint
UPDATE `pre_order_items`
SET `product_id` = (
  SELECT `products`.`id`
  FROM `products`
  WHERE `products`.`supplier_catalog_item_id` = `pre_order_items`.`supplier_catalog_item_id`
    AND `products`.`archived` = 0
  LIMIT 1
)
WHERE `product_id` IS NULL
  AND `supplier_catalog_item_id` IS NOT NULL;
