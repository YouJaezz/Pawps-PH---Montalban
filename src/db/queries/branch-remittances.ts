import { cache } from "react";
import { and, desc, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { branchCashRemittances, branches, orders } from "@/db/schema";

export type BranchPendingRemitRow = {
  branchId: number;
  branchName: string;
  cashCollectedCents: number;
  remittedCents: number;
  pendingRemitCents: number;
  lastRemittedAt: Date | null;
};

export const getBranchPendingRemittances = cache(async () => {
  const activeBranches = await db
    .select({
      id: branches.id,
      name: branches.name,
      isDefault: branches.isDefault,
    })
    .from(branches)
    .where(eq(branches.active, true))
    .orderBy(branches.isDefault, branches.name);

  if (activeBranches.length === 0) return [] as BranchPendingRemitRow[];

  const activeOrders = ne(orders.orderStatus, "Cancelled");

  const collectedByBranch = await db
    .select({
      branchId: orders.branchId,
      cashCollectedCents: sql<number>`coalesce(sum(${orders.amountPaid}), 0)`,
    })
    .from(orders)
    .where(and(activeOrders, eq(orders.storeType, "Walk-in"), sql`${orders.amountPaid} > 0`))
    .groupBy(orders.branchId);

  const remittedByBranch = await db
    .select({
      branchId: branchCashRemittances.branchId,
      remittedCents: sql<number>`coalesce(sum(${branchCashRemittances.amountCents}), 0)`,
      lastRemittedAt: sql<number | null>`max(${branchCashRemittances.remittedAt})`,
    })
    .from(branchCashRemittances)
    .groupBy(branchCashRemittances.branchId);

  const collectedMap = new Map<number, number>();
  for (const row of collectedByBranch) {
    const id = Number(row.branchId ?? 0);
    if (!id) continue;
    collectedMap.set(id, Number(row.cashCollectedCents ?? 0));
  }

  const remittedMap = new Map<
    number,
    { remittedCents: number; lastRemittedAt: Date | null }
  >();
  for (const row of remittedByBranch) {
    const id = Number(row.branchId ?? 0);
    if (!id) continue;
    const last = row.lastRemittedAt ? new Date(Number(row.lastRemittedAt)) : null;
    remittedMap.set(id, {
      remittedCents: Number(row.remittedCents ?? 0),
      lastRemittedAt: last,
    });
  }

  return activeBranches
    .map((b) => {
      const cashCollectedCents = collectedMap.get(b.id) ?? 0;
      const remitted = remittedMap.get(b.id) ?? { remittedCents: 0, lastRemittedAt: null };
      const pendingRemitCents = cashCollectedCents - remitted.remittedCents;
      return {
        branchId: b.id,
        branchName: b.name,
        cashCollectedCents,
        remittedCents: remitted.remittedCents,
        pendingRemitCents,
        lastRemittedAt: remitted.lastRemittedAt,
      } satisfies BranchPendingRemitRow;
    })
    .sort((a, b) => b.pendingRemitCents - a.pendingRemitCents);
});

export type BranchRemittanceLedgerRow = {
  id: number;
  branchId: number;
  branchName: string;
  amountCents: number;
  remittedAt: Date;
  note: string | null;
};

export const getRecentBranchRemittances = cache(async (limit = 25) => {
  const rows = await db
    .select({
      id: branchCashRemittances.id,
      branchId: branchCashRemittances.branchId,
      branchName: branches.name,
      amountCents: branchCashRemittances.amountCents,
      remittedAt: branchCashRemittances.remittedAt,
      note: branchCashRemittances.note,
    })
    .from(branchCashRemittances)
    .innerJoin(branches, eq(branches.id, branchCashRemittances.branchId))
    .orderBy(desc(branchCashRemittances.remittedAt))
    .limit(Math.max(1, Math.min(100, limit)));

  return rows.map((r) => ({
    ...r,
    remittedAt: new Date(r.remittedAt),
  })) satisfies BranchRemittanceLedgerRow[];
});

export async function insertBranchRemittance(input: {
  branchId: number;
  amountCents: number;
  remittedAt: Date;
  note: string | null;
  recordedByUserId: number | null;
}) {
  const [row] = await db
    .insert(branchCashRemittances)
    .values({
      branchId: input.branchId,
      amountCents: input.amountCents,
      remittedAt: input.remittedAt,
      note: input.note,
      recordedByUserId: input.recordedByUserId,
    })
    .returning({ id: branchCashRemittances.id });
  return row?.id ?? null;
}

