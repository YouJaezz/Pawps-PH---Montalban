import { db } from "@/db";
import { preOrderItems, products } from "@/db/schema";
import { and, eq, isNull, or } from "drizzle-orm";

export type ProductLinkTarget = {
  id: number;
  name: string;
  brand: string | null;
  variant: string | null;
  supplierCatalogItemId: number | null;
};

function normalizeLabel(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

/** Attach waiting pre-order lines to a new or updated inventory product. */
export async function linkPreOrderItemsToProduct(product: ProductLinkTarget) {
  let linked = 0;

  if (product.supplierCatalogItemId) {
    const byCatalog = await db
      .update(preOrderItems)
      .set({ productId: product.id })
      .where(
        and(
          isNull(preOrderItems.productId),
          eq(preOrderItems.supplierCatalogItemId, product.supplierCatalogItemId),
        ),
      )
      .returning({ id: preOrderItems.id });
    linked += byCatalog.length;
  }

  const nameKey = normalizeLabel(product.name);
  if (!nameKey) return linked;

  const orphanRows = await db
    .select({
      id: preOrderItems.id,
      itemName: preOrderItems.itemName,
      brand: preOrderItems.brand,
      variant: preOrderItems.variant,
    })
    .from(preOrderItems)
    .where(isNull(preOrderItems.productId));

  for (const row of orphanRows) {
    if (normalizeLabel(row.itemName) !== nameKey) continue;

    const rowBrand = normalizeLabel(row.brand);
    const productBrand = normalizeLabel(product.brand);
    if (rowBrand && productBrand && rowBrand !== productBrand) continue;

    const rowVariant = normalizeLabel(row.variant);
    const productVariant = normalizeLabel(product.variant);
    if (rowVariant && productVariant && rowVariant !== productVariant) continue;

    await db
      .update(preOrderItems)
      .set({ productId: product.id })
      .where(eq(preOrderItems.id, row.id));
    linked += 1;
  }

  return linked;
}

/** Open customer pre-orders that reference this product (directly or via catalog). */
export async function getOpenPreOrderIdsForProduct(productId: number) {
  const [product] = await db
    .select({
      id: products.id,
      supplierCatalogItemId: products.supplierCatalogItemId,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.archived, false)))
    .limit(1);

  if (!product) return [];

  const matchConditions = [eq(preOrderItems.productId, productId)];
  if (product.supplierCatalogItemId) {
    const catalogMatch = and(
      isNull(preOrderItems.productId),
      eq(preOrderItems.supplierCatalogItemId, product.supplierCatalogItemId),
    );
    if (catalogMatch) matchConditions.push(catalogMatch);
  }

  const matchWhere =
    matchConditions.length === 1 ? matchConditions[0]! : or(...matchConditions);

  const itemRows = await db
    .select({ preOrderId: preOrderItems.preOrderId })
    .from(preOrderItems)
    .where(matchWhere);

  return [...new Set(itemRows.map((row) => row.preOrderId))];
}
