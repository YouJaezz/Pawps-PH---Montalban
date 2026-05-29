import { createSupplier, uploadSupplierCatalog } from "@/app/suppliers/actions";
import { SupplierInflationPanel } from "@/app/suppliers/SupplierInflationPanel";
import { SupplierSearch } from "@/app/suppliers/SupplierSearch";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import {
  backfillSupplierPriceHistoryIfEmpty,
  getSupplierInflationInsights,
} from "@/db/queries/supplier-inflation";
import { getSupplierCatalogRows } from "@/db/queries/suppliers";
import { suppliers } from "@/db/schema";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20";

export default async function SuppliersPage() {
  await backfillSupplierPriceHistoryIfEmpty();

  const supplierRows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      contact: suppliers.contact,
      location: suppliers.location,
    })
    .from(suppliers)
    .orderBy(suppliers.name);

  const { suppliersWithCounts, searchRows, docs, supplierById } =
    await getSupplierCatalogRows();

  const inflation = await getSupplierInflationInsights();

  const latestDocBySupplier = new Map<number, (typeof docs)[0]>();
  for (const doc of docs) {
    if (!latestDocBySupplier.has(doc.supplierId)) {
      latestDocBySupplier.set(doc.supplierId, doc);
    }
  }

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-400">Suppliers</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Supplier catalog
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Upload price lists per supplier. Re-uploading replaces that supplier&apos;s
          catalog only.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-6">
          <div className="space-y-4 xl:col-span-2 xl:max-w-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium text-zinc-100">Add supplier</div>
              <form action={createSupplier} className="mt-3 space-y-2.5">
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-400">Name *</span>
                  <input name="name" required placeholder="Distributor name" className={inputClass} />
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-400">Contact</span>
                  <input name="contact" placeholder="Phone / FB" className={inputClass} />
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-400">Location</span>
                  <input name="location" placeholder="City" className={inputClass} />
                </label>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-zinc-50 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white"
                >
                  Save
                </button>
              </form>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium text-zinc-100">Upload price list</div>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Replaces only the selected supplier&apos;s catalog.
              </p>
              <form action={uploadSupplierCatalog} className="mt-3 space-y-2.5">
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-400">Supplier *</span>
                  <select
                    name="supplierId"
                    required
                    className={inputClass}
                    defaultValue={supplierRows[0]?.id ?? ""}
                  >
                    {supplierRows.length === 0 ? (
                      <option value="">Add a supplier first</option>
                    ) : (
                      supplierRows.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-400">File *</span>
                  <input
                    name="file"
                    type="file"
                    required
                    accept=".xlsx,.xls,.csv,.txt,.pdf"
                    className="w-full text-[11px] text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-zinc-200"
                  />
                </label>
                <button
                  type="submit"
                  disabled={supplierRows.length === 0}
                  className="w-full rounded-lg bg-zinc-50 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
                >
                  Upload &amp; replace
                </button>
              </form>
            </div>

            {docs.length > 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-medium text-zinc-300">Latest per supplier</div>
                <ul className="mt-2 space-y-1.5 text-[11px] text-zinc-500">
                  {Array.from(latestDocBySupplier.values()).map((doc) => (
                    <li key={doc.id} className="flex justify-between gap-2">
                      <span className="truncate text-zinc-400">
                        {supplierById.get(doc.supplierId)} · {doc.fileName}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="space-y-5 xl:col-span-4">
            <SupplierSearch rows={searchRows} suppliers={suppliersWithCounts} />
            <SupplierInflationPanel {...inflation} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
