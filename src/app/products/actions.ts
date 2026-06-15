"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  products,
  supplierCatalogItems,
  STOCK_UNITS,
  type StockUnit,
} from "@/db/schema";
import {
  displayStockQuantity,
  parseKgPerSackFromInput,
  parseStockQuantityInput,
} from "@/lib/product-stock";
import { normalizeCatalogItemType } from "@/lib/catalog-item-types";
import { requireAuth } from "@/lib/auth-guard";
import { linkPreOrderItemsToProduct } from "@/lib/preorder-inventory-link";
import { tryAutoFulfillPreOrdersForProduct } from "@/lib/preorder-fulfillment";
import {
  adjustBranchStock,
  getActiveBranches,
  getDefaultBranchId,
  setBranchStockQuantity,
  transferBranchStock as transferBranchStockCore,
  getProductBranchStock,
} from "@/lib/branch-stock";
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
  let itemType = normalizeCatalogItemType(String(formData.get("itemType") ?? ""));
  let packSize: string | null = null;
  let costPrice = parseMoneyToCents(formData.get("costPrice"));
  let supplierRetailPrice = parseMoneyToCents(formData.get("supplierRetailPrice"));
  let supplierBulkPrice = parseMoneyToCents(formData.get("supplierBulkPrice"));

  const purchaseTierRaw = String(formData.get("purchaseTier") ?? "Wholesale");
  const purchaseTier =
    purchaseTierRaw === "Retail" ? ("Retail" as const) : ("Wholesale" as const);

  const trackInKg = formData.get("trackInKg") === "on";
  const stockEntryModeRaw = String(formData.get("stockEntryMode") ?? "");
  const stockEntryMode =
    stockEntryModeRaw === "sacks"
      ? ("sacks" as const)
      : stockEntryModeRaw === "cases"
        ? ("cases" as const)
        : stockEntryModeRaw === "pcs"
          ? ("pcs" as const)
          : ("kg" as const);
  const kgPerSack = parseKgPerSackFromInput(String(formData.get("kgPerSack") ?? ""));
  const unitsPerCaseRaw = Number.parseInt(String(formData.get("unitsPerCase") ?? "24"), 10);
  const unitsPerCase =
    Number.isFinite(unitsPerCaseRaw) && unitsPerCaseRaw > 0 ? unitsPerCaseRaw : 24;

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
        itemType: supplierCatalogItems.itemType,
        priceUnit: supplierCatalogItems.priceUnit,
        unitsPerCase: supplierCatalogItems.unitsPerCase,
      })
      .from(supplierCatalogItems)
      .where(eq(supplierCatalogItems.id, catalogItemId))
      .limit(1);

    if (catalogRow) {
      const catalogItemName = catalogRow.itemName?.trim() ?? "";
      const catalogBrand = catalogRow.brand?.trim() ?? "";

      name = name || catalogItemName;
      brand = brand || catalogBrand || name;
      variant = variant || catalogRow.variant?.trim() || null;

      supplierRetailPrice = catalogRow.retailPrice ?? 0;
      supplierBulkPrice = catalogRow.unitCost ?? 0;
      itemType = normalizeCatalogItemType(catalogRow.itemType);
      if (catalogRow.packSize && catalogRow.packUnit) {
        packSize = `${catalogRow.packSize} ${catalogRow.packUnit}`;
      } else if (catalogRow.packSize) {
        packSize = catalogRow.packSize;
      }

      const ws = catalogRow.unitCost ?? 0;
      const supRetail = catalogRow.retailPrice ?? ws;
      const base = purchaseTier === "Retail" ? supRetail : ws;
      const caseSize = catalogRow.unitsPerCase ?? unitsPerCase;

      if (!formData.get("costPrice")) {
        if (trackInKg && catalogRow.perKiloPrice != null && catalogRow.perKiloPrice > 0) {
          costPrice = catalogRow.perKiloPrice;
        } else if (
          catalogRow.priceUnit === "Case" &&
          caseSize > 0
        ) {
          costPrice = Math.round(base / caseSize);
        } else if (trackInKg && kgPerSack != null && kgPerSack > 0) {
          costPrice = Math.round(base / (kgPerSack / 10));
        } else {
          costPrice = base;
        }
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

  const stockUnit: StockUnit = trackInKg ? "Kilogram" : "Piece";
  const stockQuantity =
    parseStockQuantityInput(String(formData.get("stockQuantity") ?? "0"), stockUnit, {
      stockEntryMode,
      kgPerSack,
      unitsPerCase,
    }) ?? 0;

  const inserted = await db
    .insert(products)
    .values({
      name,
      brand,
      variant,
      itemType,
      packSize,
      costPrice,
      retailPrice,
      bulkPrice,
      stockQuantity: 0,
      stockUnit,
      kgPerSack: trackInKg ? kgPerSack : null,
      unitsPerCase: trackInKg ? null : unitsPerCase,
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

  await linkPreOrderItemsToProduct({
    id: productId,
    name,
    brand,
    variant,
    supplierCatalogItemId:
      catalogItemId && Number.isFinite(catalogItemId) ? catalogItemId : null,
  });

  if (stockQuantity > 0) {
    const defaultBranchId = await getDefaultBranchId();
    await adjustBranchStock({
      branchId: defaultBranchId,
      productId,
      delta: stockQuantity,
      movementType: "Restock",
      note: "Initial stock",
    });
    await tryAutoFulfillPreOrdersForProduct(productId);
  } else {
    const defaultBranchId = await getDefaultBranchId();
    await setBranchStockQuantity({
      branchId: defaultBranchId,
      productId,
      quantity: 0,
      note: "Initial branch row",
    });
  }

  revalidatePath("/products");
  revalidatePath("/branches");
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
  const branchIdRaw = Number.parseInt(String(formData.get("branchId") ?? ""), 10);

  if (!Number.isFinite(productId) || productId <= 0) {
    throw new Error("Invalid product.");
  }
  if (quantity <= 0) {
    throw new Error("Enter a quantity to add.");
  }

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.archived, false)))
    .limit(1);

  if (!product) throw new Error("Product not found.");

  const branchId =
    Number.isFinite(branchIdRaw) && branchIdRaw > 0
      ? branchIdRaw
      : await getDefaultBranchId();

  await adjustBranchStock({
    branchId,
    productId,
    delta: quantity,
    movementType: "Restock",
    note: noteRaw.length ? noteRaw : "Manual restock",
  });

  await tryAutoFulfillPreOrdersForProduct(productId);

  revalidatePath("/products");
  revalidatePath("/branches");
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
  const itemType = normalizeCatalogItemType(String(formData.get("itemType") ?? ""));

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

  if (retailPrice <= 0) throw new Error("Retail sell price is required.");

  const [existing] = await db
    .select({
      id: products.id,
      stockUnit: products.stockUnit,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.archived, false)))
    .limit(1);

  if (!existing) throw new Error("Product not found.");

  const resolvedStockUnit =
    stockUnit === "Sack" ? ("Kilogram" as const) : stockUnit;
  const unitForParse =
    resolvedStockUnit === "Kilogram" ? "Kilogram" : resolvedStockUnit;

  await db
    .update(products)
    .set({
      name,
      brand,
      variant,
      itemType,
      packSize,
      stockUnit: resolvedStockUnit,
      kgPerSack:
        stockUnit === "Kilogram" || stockUnit === "Sack" ? kgPerSack : null,
      retailPrice,
      bulkPrice,
    })
    .where(eq(products.id, productId));

  const activeBranches = await getActiveBranches();
  const currentBranchStock = await getProductBranchStock(productId);
  let stockIncreased = false;

  for (const branch of activeBranches) {
    const raw = String(formData.get(`branchStock_${branch.id}`) ?? "").trim();
    if (!raw.length) continue;

    const parsed = parseStockQuantityInput(raw, unitForParse, {
      stockEntryMode,
      kgPerSack,
    });
    if (parsed == null) {
      throw new Error(`Enter a valid stock quantity for ${branch.name}.`);
    }

    const current =
      currentBranchStock.find((r) => r.branchId === branch.id)?.stockQuantity ?? 0;
    if (parsed > current) stockIncreased = true;

    await setBranchStockQuantity({
      branchId: branch.id,
      productId,
      quantity: parsed,
      note: `Stock edit — ${branch.name}`,
    });
  }

  if (stockIncreased) {
    await tryAutoFulfillPreOrdersForProduct(productId);
  }

  revalidatePath("/products");
  revalidatePath("/branches");
  revalidatePath("/preorders");
  revalidatePath("/orders");
  revalidatePath("/");
}

export async function transferBranchStock(formData: FormData) {
  await requireAuth();

  const productId = Number.parseInt(String(formData.get("productId") ?? ""), 10);
  const fromBranchId = Number.parseInt(String(formData.get("fromBranchId") ?? ""), 10);
  const toBranchId = Number.parseInt(String(formData.get("toBranchId") ?? ""), 10);
  const noteRaw = String(formData.get("note") ?? "").trim();

  const stockUnitRaw = String(formData.get("stockUnit") ?? "Piece");
  const stockUnit = (STOCK_UNITS as readonly string[]).includes(stockUnitRaw)
    ? (stockUnitRaw as StockUnit)
    : ("Piece" as const);
  const kgPerSack = parseKgPerSackFromInput(String(formData.get("kgPerSack") ?? ""));
  const stockEntryMode =
    String(formData.get("stockEntryMode") ?? "") === "sacks" ? "sacks" : "kg";
  const unitForParse =
    stockUnit === "Kilogram" || stockUnit === "Sack" ? "Kilogram" : stockUnit;

  if (!Number.isFinite(productId) || productId <= 0) {
    throw new Error("Invalid product.");
  }

  const quantity = parseStockQuantityInput(
    String(formData.get("transferQuantity") ?? ""),
    unitForParse,
    { stockEntryMode, kgPerSack },
  );
  if (quantity == null || quantity <= 0) {
    throw new Error("Enter a valid quantity to move.");
  }

  await transferBranchStockCore({
    fromBranchId,
    toBranchId,
    productId,
    quantity,
    note: noteRaw.length ? noteRaw : undefined,
  });

  revalidatePath("/products");
  revalidatePath("/branches");
  revalidatePath("/orders");
  revalidatePath("/");
}
