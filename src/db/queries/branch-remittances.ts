import { cache } from "react";
import { and, desc, eq, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { branches, orders } from "@/db/schema";

export type BranchPendingRemitRow = {
  branchId: number;
  branchName: string;
  /** Walk-in cash on orders not yet Completed (still with branch). */
  pendingRemitCents: number;
  /** Walk-in cash on Completed orders (already remitted / received). */
  remittedCents: number;
  /** All walk-in cash collected (pending + remitted). */
  cashCollectedCents: number;
  pendingOrderCount: number;
};

/**
 * Pending to remit = walk-in cash on open (non-Completed, non-Cancelled) orders.
 * Completed = already remitted / received by accountant — no separate remittance record needed.
 */
export const getBranchPendingRemittances = cache(async () => {
  const activeBranches = await db
    .select({
      id: branches.id,
      name: branches.name,
      isDefault: branches.isDefault,
    })
    .from(branches)
    .where(eq(branches.active, true))
    .orderBy(desc(branches.isDefault), branches.name);

  if (activeBranches.length === 0) return [] as BranchPendingRemitRow[];

  const pendingByBranch = await db
    .select({
      branchId: orders.branchId,
      pendingRemitCents: sql<number>`coalesce(sum(${orders.amountPaid}), 0)`,
      pendingOrderCount: sql<number>`count(*)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.storeType, "Walk-in"),
        sql`${orders.amountPaid} > 0`,
        notInArray(orders.orderStatus, ["Cancelled", "Completed"]),
      ),
    )
    .groupBy(orders.branchId);

  const remittedByBranch = await db
    .select({
      branchId: orders.branchId,
      remittedCents: sql<number>`coalesce(sum(${orders.amountPaid}), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.storeType, "Walk-in"),
        eq(orders.orderStatus, "Completed"),
        sql`${orders.amountPaid} > 0`,
      ),
    )
    .groupBy(orders.branchId);

  const pendingMap = new Map<
    number,
    { pendingRemitCents: number; pendingOrderCount: number }
  >();
  for (const row of pendingByBranch) {
    const id = Number(row.branchId ?? 0);
    if (!id) continue;
    pendingMap.set(id, {
      pendingRemitCents: Number(row.pendingRemitCents ?? 0),
      pendingOrderCount: Number(row.pendingOrderCount ?? 0),
    });
  }

  const remittedMap = new Map<number, number>();
  for (const row of remittedByBranch) {
    const id = Number(row.branchId ?? 0);
    if (!id) continue;
    remittedMap.set(id, Number(row.remittedCents ?? 0));
  }

  return activeBranches
    .map((b) => {
      const pending = pendingMap.get(b.id) ?? {
        pendingRemitCents: 0,
        pendingOrderCount: 0,
      };
      const remittedCents = remittedMap.get(b.id) ?? 0;
      return {
        branchId: b.id,
        branchName: b.name,
        pendingRemitCents: pending.pendingRemitCents,
        remittedCents,
        cashCollectedCents: pending.pendingRemitCents + remittedCents,
        pendingOrderCount: pending.pendingOrderCount,
      } satisfies BranchPendingRemitRow;
    })
    .sort((a, b) => b.pendingRemitCents - a.pendingRemitCents);
});
