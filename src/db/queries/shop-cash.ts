import { cache } from "react";
import { desc, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { branches, products, shopCashOutflows, suppliers } from "@/db/schema";
import { phMonthBounds, phNow } from "@/lib/ph-time";

export type ShopCashLedgerRow = {
  id: number;
  kind: "expense" | "restock";
  expenseCategory: string | null;
  amountCents: number;
  description: string;
  vendor: string | null;
  reference: string | null;
  productId: number | null;
  productLabel: string | null;
  branchId: number | null;
  branchName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  stockQtyAdded: number | null;
  paidAt: string;
  notes: string | null;
};

export async function getShopCashOutflowTotals(monthStartMs?: number, monthEndMs?: number) {
  const monthFilter =
    monthStartMs != null && monthEndMs != null
      ? sql`${shopCashOutflows.paidAt} >= ${new Date(monthStartMs)} AND ${shopCashOutflows.paidAt} < ${new Date(monthEndMs)}`
      : sql`1=1`;

  const [row] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${shopCashOutflows.amountCents}), 0)`,
      expenseCents: sql<number>`coalesce(sum(case when ${shopCashOutflows.kind} = 'expense' then ${shopCashOutflows.amountCents} else 0 end), 0)`,
      restockCents: sql<number>`coalesce(sum(case when ${shopCashOutflows.kind} = 'restock' then ${shopCashOutflows.amountCents} else 0 end), 0)`,
      entryCount: sql<number>`count(*)`,
    })
    .from(shopCashOutflows)
    .where(monthFilter);

  return {
    totalCents: Number(row?.totalCents ?? 0),
    expenseCents: Number(row?.expenseCents ?? 0),
    restockCents: Number(row?.restockCents ?? 0),
    entryCount: Number(row?.entryCount ?? 0),
  };
}

export const getShopCashDashboard = cache(async () => {
  const now = phNow();
  const { start: monthStart, end: monthEnd } = phMonthBounds(now.year, now.month);
  const monthStartMs = monthStart.getTime();
  const monthEndMs = monthEnd.getTime();

  const [allTime, thisMonth, rawEntries] = await Promise.all([
    getShopCashOutflowTotals(),
    getShopCashOutflowTotals(monthStartMs, monthEndMs),
    db
      .select()
      .from(shopCashOutflows)
      .orderBy(desc(shopCashOutflows.paidAt), desc(shopCashOutflows.id))
      .limit(80),
  ]);

  const productIds = [
    ...new Set(rawEntries.map((e) => e.productId).filter((id): id is number => id != null)),
  ];
  const branchIds = [
    ...new Set(rawEntries.map((e) => e.branchId).filter((id): id is number => id != null)),
  ];
  const supplierIds = [
    ...new Set(rawEntries.map((e) => e.supplierId).filter((id): id is number => id != null)),
  ];

  const [productRows, branchRows, supplierRows] = await Promise.all([
    productIds.length
      ? db
          .select({
            id: products.id,
            name: products.name,
            variant: products.variant,
          })
          .from(products)
          .where(inArray(products.id, productIds))
      : Promise.resolve([]),
    branchIds.length
      ? db
          .select({ id: branches.id, name: branches.name })
          .from(branches)
          .where(inArray(branches.id, branchIds))
      : Promise.resolve([]),
    supplierIds.length
      ? db
          .select({ id: suppliers.id, name: suppliers.name })
          .from(suppliers)
          .where(inArray(suppliers.id, supplierIds))
      : Promise.resolve([]),
  ]);

  const productLabel = new Map(
    productRows.map((p) => [
      p.id,
      `${p.name}${p.variant ? ` (${p.variant})` : ""}`,
    ]),
  );
  const branchName = new Map(branchRows.map((b) => [b.id, b.name]));
  const supplierName = new Map(supplierRows.map((s) => [s.id, s.name]));

  const entries: ShopCashLedgerRow[] = rawEntries.map((e) => ({
    id: e.id,
    kind: e.kind as "expense" | "restock",
    expenseCategory: e.expenseCategory,
    amountCents: e.amountCents,
    description: e.description,
    vendor: e.vendor,
    reference: e.reference,
    productId: e.productId,
    productLabel: e.productId ? (productLabel.get(e.productId) ?? null) : null,
    branchId: e.branchId,
    branchName: e.branchId ? (branchName.get(e.branchId) ?? null) : null,
    supplierId: e.supplierId,
    supplierName: e.supplierId ? (supplierName.get(e.supplierId) ?? null) : null,
    stockQtyAdded: e.stockQtyAdded,
    paidAt: e.paidAt.toISOString(),
    notes: e.notes,
  }));

  return { allTime, thisMonth, entries };
});
