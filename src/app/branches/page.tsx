import Link from "next/link";

import { createBranch, setBranchActive } from "@/app/branches/actions";
import { BranchEditButton } from "@/app/branches/BranchEditButton";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import { branchStock, branches } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { sql } from "drizzle-orm";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20";

export default async function BranchesPage() {
  await requireAdmin();

  const branchRows = await db
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

  const stockStats = await db
    .select({
      branchId: branchStock.branchId,
      productCount: sql<number>`count(distinct ${branchStock.productId})`,
      stockLineCount: sql<number>`sum(case when ${branchStock.stockQuantity} > 0 then 1 else 0 end)`,
    })
    .from(branchStock)
    .groupBy(branchStock.branchId);

  const statsByBranch = new Map(
    stockStats.map((s) => [
      s.branchId,
      {
        productCount: Number(s.productCount ?? 0),
        stockLineCount: Number(s.stockLineCount ?? 0),
      },
    ]),
  );

  const tableRows = branchRows.map((b) => {
    const stats = statsByBranch.get(b.id);
    return {
      ...b,
      productCount: stats?.productCount ?? 0,
      stockLineCount: stats?.stockLineCount ?? 0,
    };
  });

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-400">Inventory</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Branches</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Track where stock is kept — shop, home storage, or other locations.
              Walk-in sales deduct from the default branch. Move stock between
              branches from the inventory edit screen.
            </p>
          </div>
          <Link
            href="/products"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5"
          >
            ← Inventory
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-medium text-zinc-100">Add branch</div>
              <p className="mt-1 text-[11px] text-zinc-500">
                Example: Home storage, neighbor pickup point, second shop.
              </p>
              <form action={createBranch} className="mt-5 space-y-4">
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Branch name *</div>
                  <input
                    name="name"
                    required
                    placeholder="e.g. Home storage"
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Location</div>
                  <input
                    name="location"
                    placeholder="Barangay / address"
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Notes</div>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="Optional details for staff"
                    className={inputClass}
                  />
                </label>
                <label className="flex items-center gap-3 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    name="isDefault"
                    className="size-4 accent-white"
                  />
                  Set as default branch
                </label>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
                >
                  Add branch
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    Branch list
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    All existing stock was assigned to PAWPS Shop. Edit quantities
                    per branch from Inventory when you move supplies home.
                  </div>
                </div>
                <div className="text-xs text-zinc-400">
                  {tableRows.filter((b) => b.active).length} active
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="text-left text-[10px] text-zinc-500">
                    <tr>
                      <th className="px-2 py-2">Branch</th>
                      <th className="px-2 py-2">Location</th>
                      <th className="px-2 py-2">Stock lines</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {tableRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-2 py-4 text-zinc-500">
                          No branches yet.
                        </td>
                      </tr>
                    ) : (
                      tableRows.map((b) => (
                        <tr key={b.id} className="align-top hover:bg-white/[0.02]">
                          <td className="px-2 py-2">
                            <div className="font-medium text-zinc-100">{b.name}</div>
                            {b.isDefault ? (
                              <div className="text-[10px] text-brand-cyan/80">
                                Default · shop sales
                              </div>
                            ) : null}
                            {b.notes ? (
                              <div className="text-[10px] text-zinc-600">{b.notes}</div>
                            ) : null}
                          </td>
                          <td className="px-2 py-2 text-zinc-400">
                            {b.location ?? "—"}
                          </td>
                          <td className="px-2 py-2 text-zinc-400">
                            {b.stockLineCount} with stock
                          </td>
                          <td className="px-2 py-2">
                            {b.active ? (
                              <span className="text-brand-cyan/80">Active</span>
                            ) : (
                              <span className="text-zinc-500">Inactive</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap items-center gap-1">
                              <BranchEditButton branch={b} />
                              {b.active && !b.isDefault ? (
                                <form action={setBranchActive}>
                                  <input type="hidden" name="branchId" value={b.id} />
                                  <button
                                    type="submit"
                                    className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-white/5"
                                  >
                                    Deactivate
                                  </button>
                                </form>
                              ) : null}
                              {!b.active ? (
                                <form action={setBranchActive}>
                                  <input type="hidden" name="branchId" value={b.id} />
                                  <input type="hidden" name="active" value="on" />
                                  <button
                                    type="submit"
                                    className="rounded border border-brand-cyan/30 px-2 py-0.5 text-[10px] text-brand-cyan/80"
                                  >
                                    Reactivate
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
