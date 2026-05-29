import { AppShell } from "@/components/AppShell";
import { ScrollableTable } from "@/components/ScrollableTable";
import { createDeliveryLog } from "@/app/delivery/actions";
import { deleteDeliveryLog } from "@/app/delivery/delete-actions";
import { db } from "@/db";
import { deliveryLogs } from "@/db/schema";
import { desc } from "drizzle-orm";

export default async function DeliveryLogPage() {
  const rows = await db
    .select({
      id: deliveryLogs.id,
      orderId: deliveryLogs.orderId,
      customerName: deliveryLogs.customerName,
      location: deliveryLogs.location,
      deliveryMethod: deliveryLogs.deliveryMethod,
      status: deliveryLogs.status,
      fee: deliveryLogs.fee,
      reference: deliveryLogs.reference,
      notes: deliveryLogs.notes,
      createdAt: deliveryLogs.createdAt,
    })
    .from(deliveryLogs)
    .orderBy(desc(deliveryLogs.createdAt))
    .limit(50);

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-400">Delivery Log</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Delivery log
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Track Montalban Free Delivery vs Lalamove with status + fees.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-medium text-zinc-100">
                New delivery log
              </div>
              <form action={createDeliveryLog} className="mt-5 space-y-4">
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Order ID (optional)</div>
                  <input
                    name="orderId"
                    inputMode="numeric"
                    placeholder="e.g. 123"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Customer name</div>
                  <input
                    name="customerName"
                    placeholder="Matches FB workflow"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Location</div>
                  <input
                    name="location"
                    placeholder="e.g. Montalban"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <div className="text-xs text-zinc-300">Method</div>
                    <select
                      name="deliveryMethod"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                      defaultValue="Montalban Free Delivery"
                    >
                      <option>Montalban Free Delivery</option>
                      <option>Lalamove</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <div className="text-xs text-zinc-300">Status</div>
                    <select
                      name="status"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                      defaultValue="Queued"
                    >
                      <option>Queued</option>
                      <option>Booked</option>
                      <option>Picked Up</option>
                      <option>Delivered</option>
                      <option>Cancelled</option>
                    </select>
                  </label>
                </div>

                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Fee (₱)</div>
                  <input
                    name="fee"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Reference</div>
                  <input
                    name="reference"
                    placeholder="Lalamove booking / tracking"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Notes</div>
                  <input
                    name="notes"
                    placeholder="Optional notes"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
                >
                  Add delivery log
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    Recent deliveries
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    Latest 50 logs.
                  </div>
                </div>
                <div className="text-xs text-zinc-400">{rows.length} shown</div>
              </div>

              <ScrollableTable maxHeight="max-h-[min(65vh,640px)]">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-white/5 text-left text-zinc-300">
                    <tr>
                      <th className="hidden w-20 px-4 py-3 font-medium sm:table-cell">
                        Order
                      </th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="hidden px-4 py-3 font-medium md:table-cell">
                        Method
                      </th>
                      <th className="w-24 px-4 py-3 font-medium">Status</th>
                      <th className="w-24 px-4 py-3 font-medium">Fee</th>
                      <th className="w-20 px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {rows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-zinc-400" colSpan={5}>
                          No delivery logs yet — add one on the left.
                        </td>
                      </tr>
                    ) : (
                      rows.map((d) => (
                        <tr key={d.id} className="hover:bg-white/5">
                          <td className="hidden px-4 py-3 text-zinc-200 sm:table-cell">
                            {d.orderId ? `#${d.orderId}` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-zinc-50">
                              {d.customerName ?? "—"}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {d.location ?? "—"}
                            </div>
                            <div className="mt-1 text-xs text-zinc-400 md:hidden">
                              {d.deliveryMethod}
                              {d.orderId ? ` • #${d.orderId}` : ""}
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-zinc-200 md:table-cell">
                            {d.deliveryMethod}
                          </td>
                          <td className="px-4 py-3 text-zinc-200">{d.status}</td>
                          <td className="px-4 py-3 text-zinc-200">
                            ₱{(d.fee / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <form action={deleteDeliveryLog}>
                              <input type="hidden" name="id" value={d.id} />
                              <button
                                type="submit"
                                className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/15"
                              >
                                Delete
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

