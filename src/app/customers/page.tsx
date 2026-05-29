import { createCustomer } from "@/app/customers/actions";
import { deleteCustomer } from "@/app/customers/delete-actions";
import { AppShell } from "@/components/AppShell";
import { ScrollableTable } from "@/components/ScrollableTable";
import { db } from "@/db";
import { customers } from "@/db/schema";

export default async function CustomersPage() {
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      contact: customers.contact,
      location: customers.location,
      totalSpend: customers.totalSpend,
    })
    .from(customers);

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-400">Customers</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Add customers and track contact/location.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-medium text-zinc-100">
                Add customer
              </div>
              <form action={createCustomer} className="mt-5 space-y-4">
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Name *</div>
                  <input
                    name="name"
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
                  <div className="text-xs text-zinc-300">Location</div>
                  <input
                    name="location"
                    placeholder="e.g. Montalban"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
                >
                  Add customer
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    Customer list
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    Spend rollup will update when orders are marked paid.
                  </div>
                </div>
                <div className="text-xs text-zinc-400">{rows.length} customers</div>
              </div>

              <ScrollableTable maxHeight="max-h-[min(65vh,640px)]">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-white/5 text-left text-zinc-300">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="hidden px-4 py-3 font-medium md:table-cell">
                        Contact
                      </th>
                      <th className="hidden px-4 py-3 font-medium lg:table-cell">
                        Location
                      </th>
                      <th className="w-28 px-4 py-3 font-medium">Spend</th>
                      <th className="w-20 px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {rows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-zinc-400" colSpan={4}>
                          No customers yet — add your first customer on the left.
                        </td>
                      </tr>
                    ) : (
                      rows.map((c) => (
                        <tr key={c.id} className="hover:bg-white/5">
                          <td className="px-4 py-3 font-medium text-zinc-50">
                            <div className="truncate">{c.name}</div>
                            <div className="mt-1 text-xs text-zinc-400 md:hidden">
                              {c.contact ?? "—"}
                              {c.location ? ` • ${c.location}` : ""}
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-zinc-200 md:table-cell">
                            {c.contact ?? "—"}
                          </td>
                          <td className="hidden px-4 py-3 text-zinc-200 lg:table-cell">
                            {c.location ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-200">
                            ₱{(c.totalSpend / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <form action={deleteCustomer}>
                              <input type="hidden" name="customerId" value={c.id} />
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

