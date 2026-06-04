"use client";

import { useMemo, useState } from "react";

import { CatalogItemEditButton } from "@/app/suppliers/CatalogItemEditButton";
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
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-100">Catalog</div>
          <div className="text-[10px] text-zinc-500">
            {props.rows.length} items · {filterLabel}
          </div>
        </div>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="max-w-[140px] rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-zinc-50 outline-none"
        >
          <option value="all">All ({props.rows.length})</option>
          {props.suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.itemCount})
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-28 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-zinc-50 outline-none sm:w-36"
        />
      </div>

      <ScrollableTable maxHeight="max-h-[min(52vh,520px)]" className="mt-2 min-h-0 flex-1">
        <table className="w-full table-auto text-[11px]">
          <thead className="sticky top-0 z-10 bg-[#13131f] text-left text-[10px] text-zinc-500">
            <tr>
              <th className="px-2 py-1.5 font-medium">Supplier</th>
              <th className="px-2 py-1.5 font-medium">Item</th>
              <th className="hidden px-2 py-1.5 font-medium sm:table-cell">Flavor</th>
              <th className="hidden w-14 px-2 py-1.5 font-medium md:table-cell">Size</th>
              <th className="w-20 px-2 py-1.5 font-medium">WS</th>
              <th className="hidden w-16 px-2 py-1.5 font-medium lg:table-cell">Retail</th>
              <th className="w-12 px-2 py-1.5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 ? (
              <tr>
                <td className="px-2 py-3 text-zinc-500" colSpan={7}>
                  {props.rows.length === 0
                    ? "No items — upload a price list."
                    : `No match for ${filterLabel}.`}
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
                  <tr key={r.id} className="hover:bg-white/[0.03]">
                    <td className="max-w-[88px] truncate px-2 py-1 text-zinc-500">
                      {r.supplierName}
                    </td>
                    <td className="max-w-[140px] truncate px-2 py-1 font-medium text-zinc-100">
                      {item}
                    </td>
                    <td className="hidden max-w-[100px] truncate px-2 py-1 text-zinc-400 sm:table-cell">
                      {flavor}
                    </td>
                    <td className="hidden px-2 py-1 text-zinc-400 md:table-cell">
                      {sizeLabel}
                    </td>
                    <td className="px-2 py-1">
                      <div className="font-medium text-zinc-100">
                        {formatMoneyOrDash(r.unitCost)}
                      </div>
                      {bulkTiers ? (
                        <div className="truncate text-[9px] text-zinc-600">
                          {bulkTiers}
                        </div>
                      ) : null}
                    </td>
                    <td className="hidden px-2 py-1 text-zinc-400 lg:table-cell">
                      {formatMoneyOrDash(details.retailPrice)}
                    </td>
                    <td className="px-2 py-1 align-top">
                      <CatalogItemEditButton
                        id={r.id}
                        itemName={r.itemName}
                        brand={r.brand}
                        variant={r.variant}
                        unitCost={r.unitCost}
                        retailPrice={r.retailPrice}
                        perKiloPrice={r.perKiloPrice}
                        packSize={details.packSize}
                        packUnit={details.packUnit}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ScrollableTable>
      <div className="mt-1 text-[10px] text-zinc-600">
        Showing {filtered.length} of {props.rows.length}
      </div>
    </div>
  );
}
