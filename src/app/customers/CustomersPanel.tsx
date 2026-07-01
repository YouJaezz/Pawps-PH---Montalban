import { createCustomer } from "@/app/customers/actions";
import { CustomersTable } from "@/app/customers/CustomersTable";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { isAdmin } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { rowSearchText } from "@/lib/table-filter";

export async function CustomersPanel() {
  const session = await getSession();
  const admin = isAdmin(session?.role);

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      contact: customers.contact,
      location: customers.location,
      totalSpend: customers.totalSpend,
    })
    .from(customers);

  const customerTableRows = rows.map((c) => ({
    id: c.id,
    name: c.name,
    contact: c.contact,
    location: c.location,
    totalSpend: c.totalSpend,
    searchText: rowSearchText([c.name, c.contact, c.location]),
  }));

  return (
    <>
      <p className="mb-4 text-sm text-zinc-400">
        Online and pre-order customers. Walk-in shop sales are tracked in Sales &amp;
        Orders without creating a customer record.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-medium text-zinc-100">Add customer</div>
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
                <div className="text-sm font-medium text-zinc-100">Customer list</div>
                <div className="mt-1 text-xs text-zinc-400">
                  Spend rollup updates when online orders are marked paid.
                </div>
              </div>
              <div className="text-xs text-zinc-400">{rows.length} customers</div>
            </div>

            <CustomersTable rows={customerTableRows} canDelete={admin} />
          </div>
        </div>
      </div>
    </>
  );
}
