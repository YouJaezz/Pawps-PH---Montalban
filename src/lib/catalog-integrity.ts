import type { Client } from "@libsql/client";

import { catalogItemKey } from "@/lib/supplier-item-key";

type CatalogRow = {
  id: number;
  supplier_id: number;
  item_name: string;
  brand: string | null;
  variant: string | null;
};

/** Merge duplicate supplier catalog rows (e.g. "Lamb and Rice" vs "Rice & Lamb"). */
export async function repairCatalogDuplicates(client: Client) {
  const result = await client.execute(`
    SELECT id, supplier_id, item_name, brand, variant
    FROM supplier_catalog_items
    ORDER BY supplier_id, id
  `);

  const rows = result.rows as unknown as CatalogRow[];
  const groups = new Map<string, CatalogRow[]>();

  for (const row of rows) {
    const key = `${row.supplier_id}|${catalogItemKey({
      brand: row.brand,
      variant: row.variant,
      itemName: row.item_name,
    })}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  let merged = 0;

  for (const bucket of groups.values()) {
    if (bucket.length <= 1) continue;

    const keep = bucket[0]!;
    const duplicateIds = bucket.slice(1).map((row) => row.id);

    for (const dupId of duplicateIds) {
      await client.execute(
        "UPDATE products SET supplier_catalog_item_id = ? WHERE supplier_catalog_item_id = ?",
        [keep.id, dupId],
      );
      await client.execute(
        "UPDATE pre_order_items SET supplier_catalog_item_id = ? WHERE supplier_catalog_item_id = ?",
        [keep.id, dupId],
      );
      await client.execute(
        "DELETE FROM supplier_catalog_items WHERE id = ?",
        [dupId],
      );
      merged += 1;
    }
  }

  if (merged > 0) {
    console.log(`Repair: merged ${merged} duplicate supplier catalog item(s)`);
  }
}
