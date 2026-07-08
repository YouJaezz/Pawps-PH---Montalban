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
  /** ISO date string (YYYY-MM-DD) or null — safe for client components */
  lastRemittedAt: string | null;
};

function toIsoDate(value: Date | number | string | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(Number(value) || String(value));
  if (!Number.isFinite(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function isMissingTableError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("no such table") ||
    msg.includes("branch_cash_remittances")
  );
}

export const getBranchPendingRemittances = cache(async () => {
  try {
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

    const activeOrders = ne(orders.orderStatus, "Cancelled");

    const collectedByBranch = await db
      .select({
        branchId: orders.branchId,
        cashCollectedCents: sql<number>`coalesce(sum(${orders.amountPaid}), 0)`,
      })
      .from(orders)
      .where(
        and(
          activeOrders,
          eq(orders.storeType, "Walk-in"),
          sql`${orders.amountPaid} > 0`,
        ),
      )
      .groupBy(orders.branchId);

    let remittedByBranch: Array<{
      branchId: number;
      remittedCents: number;
      lastRemittedAt: number | null;
    }> = [];

    try {
      remittedByBranch = await db
        .select({
          branchId: branchCashRemittances.branchId,
          remittedCents: sql<number>`coalesce(sum(${branchCashRemittances.amountCents}), 0)`,
          lastRemittedAt: sql<number | null>`max(${branchCashRemittances.remittedAt})`,
        })
        .from(branchCashRemittances)
        .groupBy(branchCashRemittances.branchId);
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
      remittedByBranch = [];
    }

    const collectedMap = new Map<number, number>();
    for (const row of collectedByBranch) {
      const id = Number(row.branchId ?? 0);
      if (!id) continue;
      collectedMap.set(id, Number(row.cashCollectedCents ?? 0));
    }

    const remittedMap = new Map<
      number,
      { remittedCents: number; lastRemittedAt: string | null }
    >();
    for (const row of remittedByBranch) {
      const id = Number(row.branchId ?? 0);
      if (!id) continue;
      remittedMap.set(id, {
        remittedCents: Number(row.remittedCents ?? 0),
        lastRemittedAt: toIsoDate(row.lastRemittedAt),
      });
    }

    return activeBranches
      .map((b) => {
        const cashCollectedCents = collectedMap.get(b.id) ?? 0;
        const remitted = remittedMap.get(b.id) ?? {
          remittedCents: 0,
          lastRemittedAt: null,
        };
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
  } catch (err) {
    if (isMissingTableError(err)) return [] as BranchPendingRemitRow[];
    throw err;
  }
});

export type BranchRemittanceLedgerRow = {
  id: number;
  branchId: number;
  branchName: string;
  amountCents: number;
  /** ISO date string YYYY-MM-DD */
  remittedAt: string;
  note: string | null;
};

export const getRecentBranchRemittances = cache(async (limit = 25) => {
  try {
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
      id: r.id,
      branchId: r.branchId,
      branchName: r.branchName,
      amountCents: r.amountCents,
      remittedAt: toIsoDate(r.remittedAt) ?? "",
      note: r.note,
    })) satisfies BranchRemittanceLedgerRow[];
  } catch (err) {
    if (isMissingTableError(err)) return [] as BranchRemittanceLedgerRow[];
    throw err;
  }
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
