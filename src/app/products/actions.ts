"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  products,
  stockMovements,
  supplierCatalogItems,
  STOCK_UNITS,
  type StockUnit,
} from "@/db/schema";
import {
  displayStockQuantity,
  parseKgPerSackFromInput,
  parseStockQuantityInput,
} from "@/lib/product-stock";
import {
  displayCatalogFlavor,
  displayCatalogItem,
} from "@/lib/catalog-item-display";
import { requireAuth } from "@/lib/auth-guard";
import { tryAutoFulfillPreOrdersForProduct } from "@/lib/preorder-fulfillment";
import { and, eq } from "drizzle-orm";

function parseMoneyToCents(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  if (!str) return 0;
  const n = Number(str);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function parseIntOr(value: FormDataEntryValue | null, fallback: number) {
  const str = typeof value === "string" ? value.trim() : "";
  const n = Number.parseInt(str, 10);
  return Number.isFinite(n) ? n : fallback;
}

export type CreateProductResult = {
  ok: boolean;
  error?: string;
  itemLabel?: string;
  stockQuantity?: number;
  stockUnit?: StockUnit;
  costPerUnitCents?: number;
  totalPurchaseCents?: number;
  retailPriceCents?: number;
  bulkPriceCents?: number;
  retailProfitPerUnitCents?: number;
  bulkProfitPerUnitCents?: number | null;
  totalRetailProfitCents?: number;
  totalBulkProfitCents?: number | null;
};

export async function createProduct(
  _prev: CreateProductResult | null,
  formData: FormData,
): Promise<CreateProductResult> {
  await requireAuth();

  const supplierId = Number.parseInt(
    String(formData.get("supplierId") ?? ""),
    10,
  );
  const catalogItemIdRaw = String(formData.get("supplierCatalogItemId") ?? "");
  const catalogItemId = catalogItemIdRaw
    ? Number.parseInt(catalogItemIdRaw, 10)
    : null;

  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    return { ok: false, error: "Select a supplier." };
  }

  let name = String(formData.get("name") ?? "").trim();
  let brand = String(formData.get("brand") ?? "").trim();
  let variant = String(formData.get("variant") ?? "").trim() || null;
  let costPrice = parseMoneyToCents(formData.get("costPrice"));
  let supplierRetailPrice = parseMoneyToCents(formData.get("supplierRetailPrice"));
  let supplierBulkPrice = parseMoneyToCents(formData.get("supplierBulkPrice"));

  const purchaseTierRaw = String(formData.get("purchaseTier") ?? "Wholesale");
  const purchaseTier =
    purchaseTierRaw === "Retail" ? ("Retail" as const) : ("Wholesale" as const);

  if (catalogItemId && Number.isFinite(catalogItemId)) {
    const [catalogRow] = await db
      .select({
        itemName: supplierCatalogItems.itemName,
        brand: supplierCatalogItems.brand,
        variant: supplierCatalogItems.variant,
        unitCost: supplierCatalogItems.unitCost,
        retailPrice: supplierCatalogItems.retailPrice,
        perKiloPrice: supplierCatalogItems.perKiloPrice,
        packSize: supplierCatalogItems.packSize,
        packUnit: supplierCatalogItems.packUnit,
      })
      .from(supplierCatalogItems)
      .where(eq(supplierCatalogItems.id, catalogItemId))
      .limit(1);

    if (catalogRow) {
      name =
        name ||
        displayCatalogItem(catalogRow.brand, catalogRow.itemName);
      brand = brand || catalogRow.brand || name;
      variant =
        variant ||
        (displayCatalogFlavor(catalogRow.variant, catalogRow.itemName) !== "—"
          ? displayCatalogFlavor(catalogRow.variant, catalogRow.itemName)
          : null);

      if (!formData.get("costPrice")) {
        const trackInKg = formData.get("trackInKg") === "on";
        if (trackInKg && catalogRow.perKiloPrice != null && catalogRow.perKiloPrice > 0) {
          costPrice = catalogRow.perKiloPrice;
        } else {
          costPrice =
            purchaseTier === "Retail"
              ? (catalogRow.retailPrice ?? catalogRow.unitCost ?? 0)
              : (catalogRow.unitCost ?? 0);
        }
      }
      if (!formData.get("supplierRetailPrice") && catalogRow.retailPrice != null) {
        supplierRetailPrice = catalogRow.retailPrice;
      }
      if (!formData.get("supplierBulkPrice") && catalogRow.unitCost != null) {
        supplierBulkPrice = catalogRow.unitCost;
      }
    }
  }

  if (!name || !brand) {
    return { ok: false, error: "Product name and brand are required." };
  }

  if (costPrice <= 0) {
    return { ok: false, error: "Cost must be set from supplier wholesale price." };
  }

  const retailPrice = parseMoneyToCents(formData.get("retailPrice"));
  const bulkPrice = parseMoneyToCents(formData.get("bulkPrice"));

  const trackInKg = formData.get("trackInKg") === "on";
  const stockEntryMode =
    String(formData.get("stockEntryMode") ?? "") === "sacks" ? "sacks" : "kg";
  const kgPerSack = parseKgPerSackFromInput(String(formData.get("kgPerSack") ?? ""));

  const stockUnit: StockUnit = trackInKg ? "Kilogram" : "Piece";
  const stockQuantity =
    parseStockQuantityInput(String(formData.get("stockQuantity") ?? "0"), stockUnit, {
      stockEntryMode,
      kgPerSack,
    }) ?? 0;

  const inserted = await db
    .insert(products)
    .values({
      name,
      brand,
      variant,
      costPrice,
      retailPrice,
      bulkPrice,
      stockQuantity,
      stockUnit,
      kgPerSack: trackInKg ? kgPerSack : null,
      expiryDate: null,
      supplierId,
      supplierCatalogItemId:
        catalogItemId && Number.isFinite(catalogItemId) ? catalogItemId : null,
      supplierRetailPrice: supplierRetailPrice || null,
      supplierBulkPrice: supplierBulkPrice || null,
      purchaseTier,
    })
    .returning({ id: products.id });

  const productId = inserted[0]?.id;
  if (!productId) {
    return { ok: false, error: "Failed to create product." };
  }

  if (stockQuantity > 0) {
    await db.insert(stockMovements).values({
      productId,
      movementType: "Restock",
      quantityDelta: stockQuantity,
      note: "Initial stock",
    });
    await tryAutoFulfillPreOrdersForProduct(productId);
  }

  revalidatePath("/products");
  revalidatePath("/preorders");
  revalidatePath("/orders");
  revalidatePath("/");

  const effectiveQty = displayStockQuantity(stockUnit, stockQuantity);
  const retailProfitPerUnitCents = Math.max(0, retailPrice - costPrice);
  const bulkProfitPerUnitCents =
    bulkPrice > 0 ? Math.max(0, bulkPrice - costPrice) : null;

  return {
    ok: true,
    itemLabel: variant ? `${name} (${variant})` : name,
    stockQuantity: effectiveQty,
    stockUnit,
    costPerUnitCents: costPrice,
    totalPurchaseCents: Math.round(costPrice * effectiveQty),
    retailPriceCents: retailPrice,
    bulkPriceCents: bulkPrice,
    retailProfitPerUnitCents,
    bulkProfitPerUnitCents,
    totalRetailProfitCents: Math.round(retailProfitPerUnitCents * effectiveQty),
    totalBulkProfitCents:
      bulkProfitPerUnitCents != null
        ? Math.round(bulkProfitPerUnitCents * effectiveQty)
        : null,
  };
}

export async function restockProduct(formData: FormData) {
  await requireAuth();

  const productId = Number.parseInt(String(formData.get("productId") ?? ""), 10);
  const quantity = parseIntOr(formData.get("quantity"), 0);
  const noteRaw = String(formData.get("note") ?? "").trim();

  if (!Number.isFinite(productId) || productId <= 0) {
    throw new Error("Invalid product.");
  }
  if (quantity <= 0) {
    throw new Error("Enter a quantity to add.");
  }

  const [product] = await db
    .select({
      id: products.id,
      stockQuantity: products.stockQuantity,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.archived, false)))
    .limit(1);

  if (!product) throw new Error("Product not found.");

  await db
    .update(products)
    .set({ stockQuantity: product.stockQuantity + quantity })
    .where(eq(products.id, productId));

  await db.insert(stockMovements).values({
    productId,
    movementType: "Restock",
    quantityDelta: quantity,
    note: noteRaw.length ? noteRaw : "Manual restock",
  });

  await tryAutoFulfillPreOrdersForProduct(productId);

  revalidatePath("/products");
  revalidatePath("/preorders");
  revalidatePath("/orders");
  revalidatePath("/");
}

export async function updateProduct(formData: FormData) {
  await requireAuth();

  const productId = Number.parseInt(String(formData.get("productId") ?? ""), 10);
  if (!Number.isFinite(productId) || productId <= 0) {
    throw new Error("Invalid product.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const variantRaw = String(formData.get("variant") ?? "").trim();
  const variant = variantRaw.length ? variantRaw : null;
  const packSizeRaw = String(formData.get("packSize") ?? "").trim();
  const packSize = packSizeRaw.length ? packSizeRaw : null;

  const stockUnitRaw = String(formData.get("stockUnit") ?? "Piece");
  const stockUnit = (STOCK_UNITS as readonly string[]).includes(stockUnitRaw)
    ? (stockUnitRaw as StockUnit)
    : ("Piece" as const);
  const kgPerSack = parseKgPerSackFromInput(String(formData.get("kgPerSack") ?? ""));
  const stockEntryMode =
    String(formData.get("stockEntryMode") ?? "") === "sacks" ? "sacks" : "kg";

  if (!name || !brand) {
    throw new Error("Product name and brand are required.");
  }

  const retailPrice = parseMoneyToCents(formData.get("retailPrice"));
  const bulkPrice = parseMoneyToCents(formData.get("bulkPrice"));
  const unitForParse =
    stockUnit === "Kilogram" || stockUnit === "Sack" ? "Kilogram" : stockUnit;
  const newStockStored = parseStockQuantityInput(
    String(formData.get("stockQuantity") ?? ""),
    unitForParse,
    { stockEntryMode, kgPerSack },
  );

  if (retailPrice <= 0) throw new Error("Retail sell price is required.");
  if (newStockStored == null) throw new Error("Enter a valid stock quantity.");

  const [existing] = await db
    .select({
      id: products.id,
      stockQuantity: products.stockQuantity,
      stockUnit: products.stockUnit,
      costPrice: products.costPrice,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.archived, false)))
    .limit(1);

  if (!existing) throw new Error("Product not found.");

  const stockDelta = newStockStored - existing.stockQuantity;

  await db
    .update(products)
    .set({
      name,
      brand,
      variant,
      packSize,
      stockUnit: stockUnit === "Sack" ? "Kilogram" : stockUnit,
      kgPerSack:
        stockUnit === "Kilogram" || stockUnit === "Sack" ? kgPerSack : null,
      stockQuantity: newStockStored,
      retailPrice,
      bulkPrice,
    })
    .where(eq(products.id, productId));

  if (stockDelta !== 0) {
    await db.insert(stockMovements).values({
      productId,
      movementType: "Adjustment",
      quantityDelta: stockDelta,
      note: "Manual edit — stock corrected",
    });
  }

  revalidatePath("/products");
  revalidatePath("/orders");
  revalidatePath("/");
}
