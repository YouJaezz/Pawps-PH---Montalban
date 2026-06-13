import { AppShell } from "@/components/AppShell";
import { createDeliveryLog } from "@/app/delivery/actions";
import { DeliveryLogTable } from "@/app/delivery/DeliveryLogTable";
import { db } from "@/db";
import { deliveryLogs, deliveryStatusHistory } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";

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

  const logIds = rows.map((d) => d.id);
  const allHistory =
    logIds.length === 0
      ? []
      : await db
          .select({
            deliveryLogId: deliveryStatusHistory.deliveryLogId,
            id: deliveryStatusHistory.id,
            previousStatus: deliveryStatusHistory.previousStatus,
            newStatus: deliveryStatusHistory.newStatus,
            note: deliveryStatusHistory.note,
            changedAt: deliveryStatusHistory.changedAt,
          })
          .from(deliveryStatusHistory)
          .where(inArray(deliveryStatusHistory.deliveryLogId, logIds))
          .orderBy(desc(deliveryStatusHistory.changedAt));

  const historyByLog = new Map<number, Array<Omit<(typeof allHistory)[number], "deliveryLogId">>>();
  for (const entry of allHistory) {
    const list = historyByLog.get(entry.deliveryLogId) ?? [];
    const { deliveryLogId, ...rest } = entry;
    void deliveryLogId;
    list.push(rest);
    historyByLog.set(entry.deliveryLogId, list);
  }

  const tableRows = rows.map((d) => ({
    ...d,
    history: historyByLog.get(d.id) ?? [],
  }));

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-400">Delivery Log</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Delivery log
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Queue once, then update status and fees inline — history is kept automatically.
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
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Customer name</div>
                  <input
                    name="customerName"
                    placeholder="Matches FB workflow"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Location</div>
                  <input
                    name="location"
                    placeholder="e.g. Montalban"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <div className="text-xs text-zinc-300">Method</div>
                    <select
                      name="deliveryMethod"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
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
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
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
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Reference</div>
                  <input
                    name="reference"
                    placeholder="Lalamove booking / tracking"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Notes</div>
                  <input
                    name="notes"
                    placeholder="Optional notes"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
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
              <div className="text-sm font-medium text-zinc-100">
                Recent deliveries ({tableRows.length})
              </div>
              <div className="mt-4">
                <DeliveryLogTable rows={tableRows} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
