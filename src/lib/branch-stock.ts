import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  branchStock,
  branches,
  products,
  stockMovements,
  type StockUnit,
} from "@/db/schema";

export type BranchRow = {
  id: number;
  name: string;
  location: string | null;
  notes: string | null;
  isDefault: boolean;
  active: boolean;
};

export type ProductBranchStock = {
  branchId: number;
  branchName: string;
  isDefault: boolean;
  stockQuantity: number;
};

type MovementType = "Sale" | "Restock" | "Adjustment" | "Cancel" | "Transfer";

export async function getActiveBranches(): Promise<BranchRow[]> {
  return db
    .select({
      id: branches.id,
      name: branches.name,
      location: branches.location,
      notes: branches.notes,
      isDefault: branches.isDefault,
      active: branches.active,
    })
    .from(branches)
    .where(eq(branches.active, true))
    .orderBy(sql`${branches.isDefault} DESC`, branches.name);
}

export async function getAllBranches(): Promise<BranchRow[]> {
  return db
    .select({
      id: branches.id,
      name: branches.name,
      location: branches.location,
      notes: branches.notes,
      isDefault: branches.isDefault,
      active: branches.active,
    })
    .from(branches)
    .orderBy(sql`${branches.isDefault} DESC`, branches.name);
}

export async function getDefaultBranchId(): Promise<number> {
  const [row] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.isDefault, true), eq(branches.active, true)))
    .limit(1);
  if (row) return row.id;

  const [fallback] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.active, true))
    .orderBy(branches.id)
    .limit(1);
  if (!fallback) {
    throw new Error("No active branch configured. Add a branch in Settings → Branches.");
  }
  return fallback.id;
}

export async function resolveSaleBranchId(
  raw: FormDataEntryValue | null | undefined,
): Promise<number> {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    const [row] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, parsed), eq(branches.active, true)))
      .limit(1);
    if (row) return row.id;
  }
  return getDefaultBranchId();
}

export async function getBranchName(branchId: number | null | undefined) {
  if (!branchId) return "PAWPS Shop";
  const [row] = await db
    .select({ name: branches.name })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  return row?.name ?? "Branch";
}

export async function getBranchStockQuantity(
  branchId: number,
  productId: number,
): Promise<number> {
  const [row] = await db
    .select({ stockQuantity: branchStock.stockQuantity })
    .from(branchStock)
    .where(
      and(eq(branchStock.branchId, branchId), eq(branchStock.productId, productId)),
    )
    .limit(1);
  return row?.stockQuantity ?? 0;
}

export async function getProductBranchStock(
  productId: number,
): Promise<ProductBranchStock[]> {
  const active = await getActiveBranches();
  if (active.length === 0) return [];

  const rows = await db
    .select({
      branchId: branchStock.branchId,
      stockQuantity: branchStock.stockQuantity,
    })
    .from(branchStock)
    .where(eq(branchStock.productId, productId));

  const byBranch = new Map(rows.map((r) => [r.branchId, r.stockQuantity]));

  return active.map((b) => ({
    branchId: b.id,
    branchName: b.name,
    isDefault: b.isDefault,
    stockQuantity: byBranch.get(b.id) ?? 0,
  }));
}

export async function getBranchStockForProducts(
  productIds: number[],
): Promise<Map<number, ProductBranchStock[]>> {
  const result = new Map<number, ProductBranchStock[]>();
  if (productIds.length === 0) return result;

  const active = await getActiveBranches();
  if (active.length === 0) return result;

  const rows = await db
    .select({
      productId: branchStock.productId,
      branchId: branchStock.branchId,
      stockQuantity: branchStock.stockQuantity,
    })
    .from(branchStock)
    .where(inArray(branchStock.productId, productIds));

  const byProduct = new Map<number, Map<number, number>>();
  for (const row of rows) {
    let branchMap = byProduct.get(row.productId);
    if (!branchMap) {
      branchMap = new Map();
      byProduct.set(row.productId, branchMap);
    }
    branchMap.set(row.branchId, row.stockQuantity);
  }

  for (const productId of productIds) {
    const branchMap = byProduct.get(productId) ?? new Map();
    result.set(
      productId,
      active.map((b) => ({
        branchId: b.id,
        branchName: b.name,
        isDefault: b.isDefault,
        stockQuantity: branchMap.get(b.id) ?? 0,
      })),
    );
  }

  return result;
}

async function ensureBranchStockRow(branchId: number, productId: number) {
  const [existing] = await db
    .select({ id: branchStock.id })
    .from(branchStock)
    .where(
      and(eq(branchStock.branchId, branchId), eq(branchStock.productId, productId)),
    )
    .limit(1);
  if (existing) return;

  await db.insert(branchStock).values({
    branchId,
    productId,
    stockQuantity: 0,
  });
}

export async function syncProductStockTotal(productId: number): Promise<number> {
  const [sumRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${branchStock.stockQuantity}), 0)`,
    })
    .from(branchStock)
    .where(eq(branchStock.productId, productId));

  const total = Number(sumRow?.total ?? 0);
  await db
    .update(products)
    .set({ stockQuantity: total })
    .where(eq(products.id, productId));
  return total;
}

export async function adjustBranchStock(params: {
  branchId: number;
  productId: number;
  delta: number;
  movementType: MovementType;
  note?: string | null;
  relatedOrderId?: number;
}) {
  if (params.delta === 0) return;

  await ensureBranchStockRow(params.branchId, params.productId);

  const current = await getBranchStockQuantity(params.branchId, params.productId);
  const next = current + params.delta;
  if (next < 0) {
    throw new Error("Not enough stock at this branch.");
  }

  await db
    .update(branchStock)
    .set({ stockQuantity: next })
    .where(
      and(
        eq(branchStock.branchId, params.branchId),
        eq(branchStock.productId, params.productId),
      ),
    );

  await db.insert(stockMovements).values({
    productId: params.productId,
    branchId: params.branchId,
    movementType: params.movementType,
    quantityDelta: params.delta,
    relatedOrderId: params.relatedOrderId ?? null,
    note: params.note ?? null,
  });

  await syncProductStockTotal(params.productId);
}

export async function setBranchStockQuantity(params: {
  branchId: number;
  productId: number;
  quantity: number;
  note?: string | null;
}) {
  if (params.quantity < 0) {
    throw new Error("Stock quantity cannot be negative.");
  }

  await ensureBranchStockRow(params.branchId, params.productId);
  const current = await getBranchStockQuantity(params.branchId, params.productId);
  const delta = params.quantity - current;
  if (delta === 0) return;

  await adjustBranchStock({
    branchId: params.branchId,
    productId: params.productId,
    delta,
    movementType: "Adjustment",
    note: params.note ?? "Branch stock update",
  });
}

export async function transferBranchStock(params: {
  fromBranchId: number;
  toBranchId: number;
  productId: number;
  quantity: number;
  note?: string | null;
}) {
  if (params.fromBranchId === params.toBranchId) {
    throw new Error("Choose two different branches.");
  }
  if (params.quantity <= 0) {
    throw new Error("Enter a quantity to move.");
  }

  const label = params.note?.trim() || "Branch transfer";
  await adjustBranchStock({
    branchId: params.fromBranchId,
    productId: params.productId,
    delta: -params.quantity,
    movementType: "Transfer",
    note: `${label} (out)`,
  });
  await adjustBranchStock({
    branchId: params.toBranchId,
    productId: params.productId,
    delta: params.quantity,
    movementType: "Transfer",
    note: `${label} (in)`,
  });
}

export function formatBranchStockSummary(
  rows: ProductBranchStock[],
  stockUnit: StockUnit,
  formatQty: (unit: StockUnit, stored: number) => string,
): string {
  const withStock = rows.filter((r) => r.stockQuantity > 0);
  if (withStock.length === 0) return "—";
  return withStock
    .map((r) => `${r.branchName}: ${formatQty(stockUnit, r.stockQuantity)}`)
    .join(" · ");
}
