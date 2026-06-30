import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  priceHistory,
  products,
  supplierCatalogItems,
  supplierPriceChanges,
} from "@/db/schema";
import { formatPhpFromCents } from "@/lib/money";
import { catalogItemKey, percentChange } from "@/lib/supplier-item-key";

export type RestockCostUpdateResult = {
  updated: boolean;
  oldCostCents: number;
  newCostCents: number;
  changePercent: number | null;
  message: string | null;
};

/** Apply unit cost from a restock payment (amount ÷ qty) to product + supplier catalog. */
export async function applyRestockUnitCostUpdate(params: {
  productId: number;
  amountCents: number;
  costDivisor: number;
  supplierId: number | null;
  outflowId: number;
  userId: number | null;
  stockQtyLabel?: string;
}): Promise<RestockCostUpdateResult> {
  const {
    productId,
    amountCents,
    costDivisor,
    supplierId,
    outflowId,
    userId,
    stockQtyLabel,
  } = params;

  if (costDivisor <= 0 || amountCents <= 0) {
    return {
      updated: false,
      oldCostCents: 0,
      newCostCents: 0,
      changePercent: null,
      message: null,
    };
  }

  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      brand: products.brand,
      variant: products.variant,
      costPrice: products.costPrice,
      supplierId: products.supplierId,
      supplierCatalogItemId: products.supplierCatalogItemId,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    return {
      updated: false,
      oldCostCents: 0,
      newCostCents: 0,
      changePercent: null,
      message: null,
    };
  }

  const newCostCents = Math.round(amountCents / costDivisor);
  const oldCostCents = product.costPrice;

  if (newCostCents === oldCostCents) {
    return {
      updated: false,
      oldCostCents,
      newCostCents,
      changePercent: null,
      message: null,
    };
  }

  const changePct = percentChange(oldCostCents, newCostCents);
  const qtyNote = stockQtyLabel ?? `${costDivisor} units`;
  const reason = `Restock payment #${outflowId} — ${formatPhpFromCents(amountCents)} ÷ ${qtyNote}`;

  await db.insert(priceHistory).values({
    productId,
    priceKind: "cost",
    oldPrice: oldCostCents,
    newPrice: newCostCents,
    changedByUserId: userId,
    reason,
  });

  await db
    .update(products)
    .set({ costPrice: newCostCents })
    .where(eq(products.id, productId));

  const resolvedSupplierId = supplierId ?? product.supplierId;
  const itemKey = catalogItemKey({
    brand: product.brand,
    variant: product.variant,
    itemName: product.name,
  });

  if (product.supplierCatalogItemId) {
    const [catalog] = await db
      .select({ unitCost: supplierCatalogItems.unitCost })
      .from(supplierCatalogItems)
      .where(eq(supplierCatalogItems.id, product.supplierCatalogItemId))
      .limit(1);

    const previousCatalogCost = catalog?.unitCost ?? oldCostCents;

    await db
      .update(supplierCatalogItems)
      .set({ unitCost: newCostCents })
      .where(eq(supplierCatalogItems.id, product.supplierCatalogItemId));

    if (resolvedSupplierId) {
      await db.insert(supplierPriceChanges).values({
        supplierId: resolvedSupplierId,
        itemKey,
        itemName: product.name,
        brand: product.brand,
        variant: product.variant,
        previousUnitCost: previousCatalogCost,
        newUnitCost: newCostCents,
        changePercent: changePct != null ? Math.round(changePct) : null,
        changeSource: "restock",
        shopCashOutflowId: outflowId,
        recordedAt: new Date(),
      });
    }
  } else if (resolvedSupplierId) {
    await db.insert(supplierPriceChanges).values({
      supplierId: resolvedSupplierId,
      itemKey,
      itemName: product.name,
      brand: product.brand,
      variant: product.variant,
      previousUnitCost: oldCostCents,
      newUnitCost: newCostCents,
      changePercent: changePct != null ? Math.round(changePct) : null,
      changeSource: "restock",
      shopCashOutflowId: outflowId,
      recordedAt: new Date(),
    });
  }

  const direction = newCostCents > oldCostCents ? "increased" : "decreased";
  const pctLabel =
    changePct != null
      ? ` (${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}%)`
      : "";

  return {
    updated: true,
    oldCostCents,
    newCostCents,
    changePercent: changePct != null ? Math.round(changePct) : null,
    message: `Unit cost ${direction} from ${formatPhpFromCents(oldCostCents)} to ${formatPhpFromCents(newCostCents)}${pctLabel}.`,
  };
}
