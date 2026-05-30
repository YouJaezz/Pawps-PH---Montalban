import { createPreOrder } from "@/app/preorders/actions";
import { PreOrderTable } from "@/app/preorders/PreOrderTable";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import { getSupplierCatalogRows } from "@/db/queries/suppliers";
import { preOrderItems, preOrders, suppliers } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20";

export default async function PreOrdersPage() {
  const supplierRows = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .orderBy(suppliers.name);

  const { searchRows: catalogItems } = await getSupplierCatalogRows();

  const orderRows = await db
    .select({
      id: preOrders.id,
      supplierId: preOrders.supplierId,
      status: preOrders.status,
      customerName: preOrders.customerName,
      expectedDate: preOrders.expectedDate,
      depositCents: preOrders.depositCents,
      totalCostCents: preOrders.totalCostCents,
      notes: preOrders.notes,
      createdAt: preOrders.createdAt,
    })
    .from(preOrders)
    .orderBy(desc(preOrders.createdAt))
    .limit(100);

  const supplierById = new Map(supplierRows.map((s) => [s.id, s.name]));

  const rows = await Promise.all(
    orderRows.map(async (o) => {
      const items = await db
        .select({
          id: preOrderItems.id,
          itemName: preOrderItems.itemName,
          variant: preOrderItems.variant,
          quantity: preOrderItems.quantity,
          unitCostCents: preOrderItems.unitCostCents,
          lineTotalCents: preOrderItems.lineTotalCents,
          receivedQty: preOrderItems.receivedQty,
        })
        .from(preOrderItems)
        .where(eq(preOrderItems.preOrderId, o.id));

      return {
        ...o,
        supplierName: supplierById.get(o.supplierId) ?? "Unknown",
        items,
      };
    }),
  );

  const pendingCount = rows.filter(
    (r) => !["Received", "Cancelled"].includes(r.status),
  ).length;

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-400">Pre-orders</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Supplier pre-orders
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Place orders before stock arrives — track deposits, expected dates, and
          receiving. {pendingCount} active.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium text-zinc-100">New pre-order</div>
              <form action={createPreOrder} className="mt-3 space-y-2.5">
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-400">Supplier *</span>
                  <select name="supplierId" required className={inputClass}>
                    {supplierRows.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-400">Catalog item *</span>
                  <select name="catalogItemId" required className={inputClass}>
                    {catalogItems.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.supplierName} — {c.itemName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-400">Quantity *</span>
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    defaultValue={1}
                    required
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-400">
                    Customer (optional pre-order for)
                  </span>
                  <input name="customerName" className={inputClass} />
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-400">Expected date</span>
                  <input name="expectedDate" type="date" className={inputClass} />
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-400">Deposit (₱)</span>
                  <input name="deposit" inputMode="decimal" className={inputClass} />
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-400">Notes</span>
                  <input name="notes" className={inputClass} />
                </label>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-zinc-50 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white"
                >
                  Create pre-order
                </button>
              </form>
            </div>
          </div>

          <div className="xl:col-span-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium text-zinc-100">Pre-order list</div>
              <div className="mt-3">
                <PreOrderTable rows={rows} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
