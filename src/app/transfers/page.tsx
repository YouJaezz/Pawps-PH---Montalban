import { desc, eq, or, sql } from "drizzle-orm";

import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import { branchStockTransfers, branches, products, type StockUnit, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { formatOrderWhenLong, timestampMsColumn } from "@/lib/order-timestamp";
import { formatDualStock } from "@/lib/product-stock";

export const dynamic = "force-dynamic";

function formatTransferQty(row: {
  stockUnit: StockUnit;
  quantity: number;
  kgPerSack: number | null;
  unitsPerCase: number | null;
  itemType: string | null;
}) {
  const dual = formatDualStock(row.stockUnit, row.quantity, {
    kgPerSack: row.kgPerSack,
    unitsPerCase: row.unitsPerCase,
    itemType: row.itemType,
  });
  if (dual.secondary === "—") return dual.primary;
  return `${dual.primary} (${dual.secondary})`;
}

export default async function TransferHistoryPage(props: {
  searchParams?: Promise<{ branchId?: string }>;
}) {
  const session = await requireAdmin();
  const searchParams = (await props.searchParams) ?? {};
  const branchIdRaw = (searchParams.branchId ?? "").trim();
  const branchId = branchIdRaw ? Number(branchIdRaw) : null;

  const [branchRows, rows] = await Promise.all([
    db
      .select({ id: branches.id, name: branches.name, isDefault: branches.isDefault })
      .from(branches)
      .where(eq(branches.active, true))
      .orderBy(desc(branches.isDefault), branches.name),
    db
      .select({
        id: branchStockTransfers.id,
        productId: branchStockTransfers.productId,
        productName: products.name,
        brand: products.brand,
        variant: products.variant,
        stockUnit: products.stockUnit,
        kgPerSack: products.kgPerSack,
        unitsPerCase: products.unitsPerCase,
        itemType: products.itemType,
        fromBranchId: branchStockTransfers.fromBranchId,
        toBranchId: branchStockTransfers.toBranchId,
        fromBranchName: branches.name,
        toBranchName: sql<string>`(SELECT name FROM branches b2 WHERE b2.id = ${branchStockTransfers.toBranchId})`,
        quantity: branchStockTransfers.quantity,
        note: branchStockTransfers.note,
        createdAt: branchStockTransfers.createdAt,
        createdByUserId: branchStockTransfers.createdByUserId,
        createdByName: users.name,
      })
      .from(branchStockTransfers)
      .innerJoin(products, eq(products.id, branchStockTransfers.productId))
      .innerJoin(branches, eq(branches.id, branchStockTransfers.fromBranchId))
      .leftJoin(users, eq(users.id, branchStockTransfers.createdByUserId))
      .where(
        branchId != null && Number.isFinite(branchId)
          ? or(
              eq(branchStockTransfers.fromBranchId, branchId),
              eq(branchStockTransfers.toBranchId, branchId),
            )
          : undefined,
      )
      .orderBy(
        desc(timestampMsColumn(branchStockTransfers.createdAt)),
        desc(branchStockTransfers.id),
      )
      .limit(300),
  ]);

  const branchOptions = [
    { id: "", name: "All branches" },
    ...branchRows.map((b) => ({
      id: String(b.id),
      name: `${b.name}${b.isDefault ? " (default)" : ""}`,
    })),
  ];

  return (
    <AppShell session={session}>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Transfer History</h1>
            <p className="text-sm text-zinc-400">
              Track inventory moved between branches.
            </p>
          </div>

          <form className="flex flex-wrap items-end gap-2">
            <label className="block space-y-1">
              <span className="text-[11px] text-zinc-500">Branch</span>
              <select
                name="branchId"
                defaultValue={branchIdRaw}
                className="w-60 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
              >
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg border border-brand-cyan/30 px-3 py-2 text-sm text-brand-cyan/90 hover:bg-brand-blue/10"
            >
              Apply
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface-elevated p-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-[11px] text-zinc-400">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">From</th>
                  <th className="px-3 py-2">To</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2">By</th>
                </tr>
              </thead>
              <tbody className="text-zinc-200">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-sm text-zinc-500" colSpan={7}>
                      No transfers found.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-b border-white/5">
                      <td className="px-3 py-2 text-[12px] text-zinc-400">
                        {r.createdAt ? formatOrderWhenLong(r.createdAt) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-zinc-100">
                          {r.brand} {r.productName}
                        </div>
                        {r.variant ? (
                          <div className="text-[12px] text-zinc-500">{r.variant}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-zinc-300">
                        {r.fromBranchName}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-zinc-300">
                        {r.toBranchName}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-zinc-100">
                        {formatTransferQty({
                          stockUnit: r.stockUnit as unknown as StockUnit,
                          quantity: r.quantity,
                          kgPerSack: r.kgPerSack,
                          unitsPerCase: r.unitsPerCase,
                          itemType: r.itemType,
                        })}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-zinc-400">
                        {r.note || "—"}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-zinc-400">
                        {r.createdByName || (r.createdByUserId ? `User #${r.createdByUserId}` : "—")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

