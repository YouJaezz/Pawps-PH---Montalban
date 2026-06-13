import Link from "next/link";

import { createSupplier } from "@/app/suppliers/actions";
import { SupplierDeleteButton } from "@/app/suppliers/SupplierDeleteButton";
import { SupplierEditButton } from "@/app/suppliers/SupplierEditButton";
import { SupplierPriceComparison } from "@/app/suppliers/SupplierPriceComparison";
import { UploadCatalogForm } from "@/app/suppliers/UploadCatalogForm";
import { SupplierInflationPanel } from "@/app/suppliers/SupplierInflationPanel";
import { SupplierSearch } from "@/app/suppliers/SupplierSearch";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import {
  backfillSupplierPriceHistoryIfEmpty,
  getSupplierInflationInsights,
} from "@/db/queries/supplier-inflation";
import { getSupplierPriceComparison } from "@/db/queries/supplier-comparison";
import { getSupplierCatalogRows } from "@/db/queries/suppliers";
import { suppliers } from "@/db/schema";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-900 outline-none focus:border-zinc-300";

export default async function SuppliersPage() {
  await backfillSupplierPriceHistoryIfEmpty();

  const supplierRows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      contact: suppliers.contact,
      location: suppliers.location,
      notes: suppliers.notes,
    })
    .from(suppliers)
    .orderBy(suppliers.name);

  const { suppliersWithCounts, searchRows } = await getSupplierCatalogRows();

  const inflation = await getSupplierInflationInsights();
  const priceComparison = await getSupplierPriceComparison();

  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col px-0 py-3">
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-xs text-zinc-600">Suppliers</div>
            <h1 className="text-xl font-semibold tracking-tight">Supplier catalog</h1>
          </div>
          <Link
            href="/suppliers/normalize"
            className="rounded-md border border-brand-blue/30 bg-brand-blue/10 px-2.5 py-1 text-[10px] text-brand-blue hover:bg-brand-blue/15"
          >
            Normalize pricelist →
          </Link>
        </div>

        <div className="mt-3 shrink-0">
          <SupplierPriceComparison rows={priceComparison} />
        </div>

        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="flex shrink-0 flex-col gap-2 lg:max-h-[min(52vh,520px)] lg:overflow-y-auto">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-[11px] font-medium text-zinc-800">Add supplier</div>
              <form action={createSupplier} className="mt-2 space-y-1.5">
                <input
                  name="name"
                  required
                  placeholder="Name *"
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input name="contact" placeholder="Contact" className={inputClass} />
                  <input name="location" placeholder="City" className={inputClass} />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-md bg-zinc-50 py-1 text-[10px] font-medium text-zinc-900 hover:bg-white"
                >
                  Save
                </button>
              </form>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-[11px] font-medium text-zinc-800">Upload list</div>
              <UploadCatalogForm suppliers={supplierRows} />
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                Suppliers ({supplierRows.length})
              </div>
              <ul className="mt-1.5 max-h-32 space-y-1 overflow-y-auto text-[10px]">
                {supplierRows.length === 0 ? (
                  <li className="text-zinc-600">None yet</li>
                ) : (
                  supplierRows.map((s) => (
                    <li
                      key={s.id}
                      className="border-b border-zinc-100 py-1 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 truncate">
                          <span className="text-zinc-800">{s.name}</span>
                          {s.location ? (
                            <span className="text-zinc-600"> · {s.location}</span>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <SupplierEditButton
                            supplierId={s.id}
                            name={s.name}
                            contact={s.contact}
                            location={s.location}
                          />
                          <SupplierDeleteButton supplierId={s.id} name={s.name} />
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </aside>

          <div className="flex min-h-0 flex-col gap-2">
            <SupplierSearch rows={searchRows} suppliers={suppliersWithCounts} />
            <SupplierInflationPanel {...inflation} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
