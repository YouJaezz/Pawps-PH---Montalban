import { AppShell } from "@/components/AppShell";
import { ScrollableTable } from "@/components/ScrollableTable";
import { createTransportJob } from "@/app/transport/actions";
import { deleteTransportJob } from "@/app/transport/delete-actions";
import { db } from "@/db";
import { transportJobs } from "@/db/schema";
import { desc } from "drizzle-orm";

export default async function TransportPage() {
  const rows = await db
    .select({
      id: transportJobs.id,
      customerName: transportJobs.customerName,
      contact: transportJobs.contact,
      pickupLocation: transportJobs.pickupLocation,
      dropoffLocation: transportJobs.dropoffLocation,
      petDetails: transportJobs.petDetails,
      serviceType: transportJobs.serviceType,
      status: transportJobs.status,
      fee: transportJobs.fee,
      createdAt: transportJobs.createdAt,
    })
    .from(transportJobs)
    .orderBy(desc(transportJobs.createdAt))
    .limit(50);

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-400">Pet Transportation</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Transport jobs
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Track pet taxi / service trips with fees and status.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-medium text-zinc-100">
                New transport job
              </div>
              <form action={createTransportJob} className="mt-5 space-y-4">
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Customer name *</div>
                  <input
                    name="customerName"
                    required
                    placeholder="e.g. Jane Doe"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Contact</div>
                  <input
                    name="contact"
                    placeholder="FB / phone"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Pickup *</div>
                  <input
                    name="pickupLocation"
                    required
                    placeholder="Pickup location"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Dropoff *</div>
                  <input
                    name="dropoffLocation"
                    required
                    placeholder="Dropoff location"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Pet details</div>
                  <input
                    name="petDetails"
                    placeholder="e.g. 1 cat in carrier"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <div className="text-xs text-zinc-300">Service type</div>
                    <select
                      name="serviceType"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                      defaultValue="Pet Taxi"
                    >
                      <option>Pet Taxi</option>
                      <option>Vet Visit</option>
                      <option>Grooming Visit</option>
                      <option>Boarding Transfer</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <div className="text-xs text-zinc-300">Status</div>
                    <select
                      name="status"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                      defaultValue="Requested"
                    >
                      <option>Requested</option>
                      <option>Scheduled</option>
                      <option>In Transit</option>
                      <option>Completed</option>
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
                  Create job
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    Recent jobs
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    Latest 50 jobs.
                  </div>
                </div>
                <div className="text-xs text-zinc-400">{rows.length} shown</div>
              </div>

              <ScrollableTable maxHeight="max-h-[min(65vh,640px)]">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-white/5 text-left text-zinc-300">
                    <tr>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="hidden px-4 py-3 font-medium md:table-cell">
                        Route
                      </th>
                      <th className="hidden px-4 py-3 font-medium lg:table-cell">
                        Type
                      </th>
                      <th className="w-28 px-4 py-3 font-medium">Status</th>
                      <th className="w-24 px-4 py-3 font-medium">Fee</th>
                      <th className="w-20 px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {rows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-zinc-400" colSpan={5}>
                          No transport jobs yet — create your first one on the
                          left.
                        </td>
                      </tr>
                    ) : (
                      rows.map((j) => (
                        <tr key={j.id} className="hover:bg-white/5">
                          <td className="px-4 py-3">
                            <div className="font-medium text-zinc-50">
                              {j.customerName}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {j.contact ?? "—"}
                            </div>
                            <div className="mt-1 text-xs text-zinc-400 md:hidden">
                              {j.pickupLocation} → {j.dropoffLocation}
                              {j.petDetails ? ` • ${j.petDetails}` : ""}
                              {j.serviceType ? ` • ${j.serviceType}` : ""}
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-zinc-200 md:table-cell">
                            <div className="truncate max-w-[280px]">
                              {j.pickupLocation} → {j.dropoffLocation}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {j.petDetails ?? "—"}
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-zinc-200 lg:table-cell">
                            {j.serviceType}
                          </td>
                          <td className="px-4 py-3 text-zinc-200">
                            {j.status}
                          </td>
                          <td className="px-4 py-3 text-zinc-200">
                            ₱{(j.fee / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <form action={deleteTransportJob}>
                              <input type="hidden" name="id" value={j.id} />
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

