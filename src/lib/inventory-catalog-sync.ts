import { db } from "@/db";
import { products } from "@/db/schema";
import { shouldRepairProductFromCatalog } from "@/lib/catalog-item-display";
import { eq } from "drizzle-orm";

type CatalogRow = {
  id: number;
  itemName: string;
  brand: string | null;
  variant: string | null;
};

type ProductRow = {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
  supplierCatalogItemId: number | null;
};

/** Fix inventory rows that stored brand as product name when linked to catalog. */
export async function repairInventoryLabelsFromCatalog(
  productRows: ProductRow[],
  catalogById: Map<number, CatalogRow>,
): Promise<boolean> {
  const repairs = productRows.filter((product) => {
    if (!product.supplierCatalogItemId) return false;
    const catalog = catalogById.get(product.supplierCatalogItemId);
    if (!catalog) return false;
    return shouldRepairProductFromCatalog(product, catalog);
  });

  if (repairs.length === 0) return false;

  await Promise.all(
    repairs.map(async (product) => {
      const catalog = catalogById.get(product.supplierCatalogItemId!)!;
      await db
        .update(products)
        .set({
          name: catalog.itemName.trim(),
          brand: catalog.brand?.trim() || product.brand,
          variant: catalog.variant?.trim() || product.variant,
        })
        .where(eq(products.id, product.id));
    }),
  );

  return true;
}
