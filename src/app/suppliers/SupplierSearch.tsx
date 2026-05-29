"use client";

import { useMemo, useState } from "react";

import { ScrollableTable } from "@/components/ScrollableTable";
import {
  displayCatalogFlavor,
  displayCatalogItem,
  formatBulkTierNote,
  formatMoneyOrDash,
  formatPackLabel,
  resolveCatalogItemDetails,
} from "@/lib/catalog-item-display";

export type SupplierCatalogRow = {
  id: number;
  supplierId: number;
  supplierName: string;
  itemName: string;
  brand: string | null;
  productName: string | null;
  variant: string | null;
  itemType: string | null;
  sku: string | null;
  unitCost: number | null;
  packSize: string | null;
  packUnit: string | null;
  perKiloPrice: number | null;
  retailPrice: number | null;
  notes: string | null;
  fileName: string | null;
};

export type SupplierFilterOption = {
  id: number;
  name: string;
  itemCount: number;
};

export function SupplierSearch(props: {
  rows: SupplierCatalogRow[];
  suppliers: SupplierFilterOption[];
}) {
  const [query, setQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let list = props.rows;
    if (supplierFilter !== "all") {
      const sid = Number.parseInt(supplierFilter, 10);
      list = list.filter((r) => r.supplierId === sid);
    }

    const q = query.trim().toLowerCase();
    if (!q) return list;

    return list.filter((r) => {
      const item = displayCatalogItem(r.brand, r.itemName);
      const flavor = displayCatalogFlavor(r.variant, r.itemName);
      const details = resolveCatalogItemDetails(r);
      const hay = [
        r.supplierName,
        item,
        flavor,
        r.brand,
        r.productName,
        r.itemName,
        r.variant,
        r.itemType,
        r.sku,
        r.notes,
        r.fileName,
        details.packSize,
        formatPackLabel(details.packSize, details.packUnit),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [props.rows, query, supplierFilter]);

  const filterLabel =
    supplierFilter === "all"
      ? "all suppliers"
      : (props.suppliers.find((s) => String(s.id) === supplierFilter)?.name ??
        "supplier");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-zinc-100">Supplier catalog</div>
          <div className="mt-0.5 text-xs text-zinc-400">
            Filter by supplier — each upload is separate per supplier.
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="min-w-[140px] flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20 sm:flex-none"
          >
            <option value="all">All suppliers ({props.rows.length})</option>
            {props.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.itemCount})
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="min-w-[120px] flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20 sm:w-44 sm:flex-none"
          />
        </div>
      </div>

      <ScrollableTable maxHeight="max-h-[min(70vh,720px)]">
        <table className="w-full table-auto text-sm">
          <thead className="bg-white/5 text-left text-[11px] text-zinc-400">
            <tr>
              <th className="px-2 py-2 font-medium">Supplier</th>
              <th className="hidden w-24 px-2 py-2 font-medium xl:table-cell">
                Type
              </th>
              <th className="px-2 py-2 font-medium">Item</th>
              <th className="px-2 py-2 font-medium">Flavor</th>
              <th className="hidden w-16 px-2 py-2 font-medium sm:table-cell">
                Size
              </th>
              <th className="hidden w-20 px-2 py-2 font-medium md:table-cell">
                Per kg
              </th>
              <th className="w-24 px-2 py-2 font-medium">Wholesale</th>
              <th className="hidden w-20 px-2 py-2 font-medium lg:table-cell">
                Retail
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-zinc-400" colSpan={8}>
                  {props.rows.length === 0
                    ? "No catalog items — upload a price list per supplier."
                    : `No items for ${filterLabel}. Try another supplier filter.`}
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const item = displayCatalogItem(r.brand, r.itemName);
                const flavor = displayCatalogFlavor(r.variant, r.itemName);
                const details = resolveCatalogItemDetails(r);
                const sizeLabel = formatPackLabel(
                  details.packSize,
                  details.packUnit,
                );
                const bulkTiers = formatBulkTierNote(r.notes);

                return (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="px-2 py-2 text-xs text-zinc-400">
                      {r.supplierName}
                    </td>
                    <td className="hidden px-2 py-2 text-[11px] text-zinc-500 xl:table-cell">
                      {r.itemType ?? "—"}
                    </td>
                    <td className="px-2 py-2 font-medium text-zinc-50">{item}</td>
                    <td className="px-2 py-2 text-zinc-300">{flavor}</td>
                    <td className="hidden px-2 py-2 text-zinc-300 sm:table-cell">
                      {sizeLabel}
                    </td>
                    <td className="hidden px-2 py-2 text-zinc-300 md:table-cell">
                      {formatMoneyOrDash(details.perKiloPrice)}
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium text-zinc-100">
                        {formatMoneyOrDash(r.unitCost)}
                      </div>
                      {bulkTiers ? (
                        <div className="mt-0.5 text-[10px] leading-snug text-zinc-500">
                          {bulkTiers}
                        </div>
                      ) : null}
                    </td>
                    <td className="hidden px-2 py-2 text-zinc-300 lg:table-cell">
                      {formatMoneyOrDash(details.retailPrice)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ScrollableTable>
      <div className="mt-2 text-[11px] text-zinc-500">
        Showing {filtered.length} of {props.rows.length} total · {filterLabel}
      </div>
    </div>
  );
}
