"use client";

import { useMemo, useState } from "react";

import { AddCatalogItemButton } from "@/app/suppliers/AddCatalogItemButton";
import { CatalogItemEditButton } from "@/app/suppliers/CatalogItemEditButton";
import { ScrollableTable } from "@/components/ScrollableTable";
import {
  displayCatalogBrand,
  displayCatalogFlavor,
  displayCatalogProductName,
  formatBulkTierNote,
  formatPackLabel,
  resolveCatalogItemDetails,
} from "@/lib/catalog-item-display";
import { displayCatalogItemType } from "@/lib/catalog-item-types";
import { formatSupplierPrice } from "@/lib/price-units";

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
  priceUnit: string | null;
  unitsPerCase: number | null;
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
      const item = displayCatalogProductName(r);
      const brand = displayCatalogBrand(r.brand);
      const flavor = displayCatalogFlavor(r.variant, r.itemName);
      const details = resolveCatalogItemDetails(r);
      const hay = [
        r.supplierName,
        item,
        brand,
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
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-800">Catalog</div>
          <div className="text-[10px] text-zinc-600">
            {props.rows.length} items · {filterLabel}
          </div>
        </div>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="max-w-[140px] rounded-md border border-zinc-300 bg-white px-2 py-1 text-[10px] text-zinc-900 outline-none"
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
          className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1 text-[10px] text-zinc-900 outline-none sm:w-36"
        />
        <AddCatalogItemButton
          suppliers={props.suppliers.map((s) => ({ id: s.id, name: s.name }))}
          defaultSupplierId={
            supplierFilter !== "all"
              ? Number.parseInt(supplierFilter, 10)
              : undefined
          }
        />
      </div>

      <ScrollableTable maxHeight="max-h-[min(52vh,520px)]" className="mt-2 min-h-0 flex-1">
        <table className="w-full table-auto text-[11px]">
          <thead className="sticky top-0 z-10 bg-zinc-100 text-left text-[10px] text-zinc-600">
            <tr>
              <th className="px-2 py-1.5 font-medium">Supplier</th>
              <th className="px-2 py-1.5 font-medium">Item</th>
              <th className="hidden px-2 py-1.5 font-medium sm:table-cell">Brand</th>
              <th className="hidden px-2 py-1.5 font-medium sm:table-cell">Flavor</th>
              <th className="hidden px-2 py-1.5 font-medium md:table-cell">Type</th>
              <th className="hidden w-14 px-2 py-1.5 font-medium lg:table-cell">
                Pack size
              </th>
              <th className="w-20 px-2 py-1.5 font-medium">WS</th>
              <th className="hidden w-16 px-2 py-1.5 font-medium lg:table-cell">
                Sup. retail
              </th>
              <th className="w-12 px-2 py-1.5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 ? (
              <tr>
                <td className="px-2 py-3 text-zinc-600" colSpan={9}>
                  {props.rows.length === 0
                    ? "No items — upload a price list."
                    : `No match for ${filterLabel}.`}
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const item = displayCatalogProductName(r);
                const brand = displayCatalogBrand(r.brand);
                const flavor = displayCatalogFlavor(r.variant, r.itemName);
                const details = resolveCatalogItemDetails(r);
                const sizeLabel = formatPackLabel(
                  details.packSize,
                  details.packUnit,
                );
                const bulkTiers = formatBulkTierNote(r.notes);

                return (
                  <tr key={r.id} className="hover:bg-white/[0.03]">
                    <td className="max-w-[88px] truncate px-2 py-1 text-zinc-600">
                      {r.supplierName}
                    </td>
                    <td className="max-w-[140px] truncate px-2 py-1 font-medium text-zinc-800">
                      {item}
                    </td>
                    <td className="hidden max-w-[100px] truncate px-2 py-1 text-zinc-700 sm:table-cell">
                      {brand}
                    </td>
                    <td className="hidden max-w-[100px] truncate px-2 py-1 text-zinc-600 sm:table-cell">
                      {flavor}
                    </td>
                    <td className="hidden max-w-[120px] truncate px-2 py-1 text-zinc-600 md:table-cell">
                      {displayCatalogItemType(r.itemType)}
                    </td>
                    <td className="hidden px-2 py-1 text-zinc-600 lg:table-cell">
                      {sizeLabel}
                    </td>
                    <td className="px-2 py-1">
                      <div className="font-medium text-zinc-800">
                        {formatSupplierPrice(r.unitCost, r.priceUnit)}
                      </div>
                      {bulkTiers ? (
                        <div className="truncate text-[9px] text-zinc-600">
                          {bulkTiers}
                        </div>
                      ) : null}
                    </td>
                    <td className="hidden px-2 py-1 text-zinc-600 lg:table-cell">
                      {formatSupplierPrice(details.retailPrice, r.priceUnit)}
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
                        itemType={r.itemType}
                        priceUnit={r.priceUnit}
                        unitsPerCase={r.unitsPerCase}
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
