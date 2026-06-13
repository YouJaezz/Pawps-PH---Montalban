import { createCustomer } from "@/app/customers/actions";
import { CustomersTable } from "@/app/customers/CustomersTable";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { rowSearchText } from "@/lib/table-filter";

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

  const customerTableRows = rows.map((c) => ({
    id: c.id,
    name: c.name,
    contact: c.contact,
    location: c.location,
    totalSpend: c.totalSpend,
    searchText: rowSearchText([c.name, c.contact, c.location]),
  }));

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-600">Customers</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Add customers and track contact/location.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
              <div className="text-sm font-medium text-zinc-800">
                Add customer
              </div>
              <form action={createCustomer} className="mt-5 space-y-4">
                <label className="space-y-1">
                  <div className="text-xs text-zinc-700">Name *</div>
                  <input
                    name="name"
                    required
                    placeholder="e.g. Jane Doe"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-600 outline-none focus:border-zinc-300"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-700">Contact</div>
                  <input
                    name="contact"
                    placeholder="FB / phone"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-600 outline-none focus:border-zinc-300"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-700">Location</div>
                  <input
                    name="location"
                    placeholder="e.g. Montalban"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-600 outline-none focus:border-zinc-300"
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
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-zinc-800">
                    Customer list
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">
                    Spend rollup will update when orders are marked paid.
                  </div>
                </div>
                <div className="text-xs text-zinc-600">{rows.length} customers</div>
              </div>

              <CustomersTable rows={customerTableRows} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

