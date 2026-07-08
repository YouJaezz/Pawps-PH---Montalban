"use client";

import { useMemo, useState } from "react";

import { ProductEditButton, type ProductEditRow } from "@/app/products/ProductEditButton";
import { deleteProduct } from "@/app/products/delete-actions";
import { ScrollableTable } from "@/components/ScrollableTable";
import { TableToolbar } from "@/components/TableToolbar";
import { matchesQuery } from "@/lib/table-filter";
import { formatDualStock } from "@/lib/product-stock";
import {
  inventoryComparableQuantity,
  replenishmentStatus,
} from "@/lib/inventory-replenishment";
import type { StockUnit } from "@/db/schema";

export type InventoryTableRow = {
  id: number;
  item: string;
  brand: string;
  flavor: string;
  itemTypeLabel: string;
  supplierName: string;
  supplierId: number | null;
  supplierRetail: string;
  supplierWs: string;
  purchaseTier: string;
  ourRetail: string;
  ourWs: string;
  stockPrimary: string;
  stockSecondary: string;
  branchSummary: string;
  profitRetail: string;
  profitBulk: string | null;
  unitSuffix: string;
  stockQuantity: number;
  branchQtyById: Record<number, number>;
  searchText: string;
  productEdit: ProductEditRow;
};

export type InventorySupplierOption = { id: number; name: string };

export type InventoryBranchOption = { id: number; name: string };

export function InventoryTable(props: {
  rows: InventoryTableRow[];
  suppliers: InventorySupplierOption[];
  branches: InventoryBranchOption[];
  limitedView?: boolean;
}) {
  const limited = props.limitedView ?? false;
  const [query, setQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  const filtered = useMemo(() => {
    let list = props.rows;

    if (supplierFilter !== "all") {
      const sid = Number.parseInt(supplierFilter, 10);
      list = list.filter((r) => r.supplierId === sid);
    }

    if (branchFilter !== "all") {
      const branchId = Number.parseInt(branchFilter, 10);
      list = list.filter((r) => (r.branchQtyById[branchId] ?? 0) > 0);
    }

    if (stockFilter === "in") {
      list = list.filter((r) => {
        const raw =
          branchFilter !== "all"
            ? (r.branchQtyById[Number.parseInt(branchFilter, 10)] ?? 0)
            : r.stockQuantity;
        return raw > 0;
      });
    } else if (stockFilter === "out") {
      list = list.filter((r) => {
        const raw =
          branchFilter !== "all"
            ? (r.branchQtyById[Number.parseInt(branchFilter, 10)] ?? 0)
            : r.stockQuantity;
        return raw <= 0;
      });
    } else if (stockFilter === "low") {
      list = list.filter((r) => {
        const raw =
          branchFilter !== "all"
            ? (r.branchQtyById[Number.parseInt(branchFilter, 10)] ?? 0)
            : r.stockQuantity;
        const comparable = inventoryComparableQuantity({
          stockUnit: r.productEdit.stockUnit,
          rawQuantity: raw,
          itemType: r.productEdit.itemType,
        });
        return replenishmentStatus(comparable, 5) === "low";
      });
    }

    if (query.trim()) {
      list = list.filter((r) => matchesQuery(r.searchText, query));
    }

    return list;
  }, [props.rows, query, supplierFilter, stockFilter, branchFilter]);

  return (
    <div>
      <TableToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search item, brand, flavor, supplier…"
        shown={filtered.length}
        total={props.rows.length}
        filters={[
          {
            id: "branch",
            value: branchFilter,
            onChange: setBranchFilter,
            "aria-label": "Filter by branch",
            options: [
              { value: "all", label: "All branches" },
              ...props.branches.map((b) => ({
                value: String(b.id),
                label: b.name,
              })),
            ],
          },
          {
            id: "supplier",
            value: supplierFilter,
            onChange: setSupplierFilter,
            "aria-label": "Filter by supplier",
            options: [
              { value: "all", label: "All suppliers" },
              ...props.suppliers.map((s) => ({
                value: String(s.id),
                label: s.name,
              })),
            ],
          },
          {
            id: "stock",
            value: stockFilter,
            onChange: setStockFilter,
            "aria-label": "Filter by stock",
            options: [
              { value: "all", label: "All stock" },
              { value: "in", label: "In stock" },
              { value: "low", label: "Low stock (≤5)" },
              { value: "out", label: "Out of stock" },
            ],
          },
        ]}
      />

      <ScrollableTable maxHeight="max-h-[min(75vh,800px)]">
        <table className="w-full table-auto text-xs">
          <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
            <tr>
              <th className="px-2 py-2">Item</th>
              <th className="hidden px-2 py-2 sm:table-cell">Brand</th>
              <th className="px-2 py-2">Flavor</th>
              {!limited ? (
                <>
                  <th className="hidden px-2 py-2 md:table-cell">Type</th>
                  <th className="hidden px-2 py-2 md:table-cell">Supplier</th>
                  <th className="hidden px-2 py-2 lg:table-cell">Sup. retail</th>
                  <th className="hidden px-2 py-2 lg:table-cell">Sup. WS</th>
                  <th className="hidden px-2 py-2 md:table-cell">Bought as</th>
                </>
              ) : null}
              <th className="hidden px-2 py-2 sm:table-cell">Retail</th>
              {!limited ? (
                <th className="hidden px-2 py-2 sm:table-cell">Our WS</th>
              ) : null}
              <th className="px-2 py-2">Stock</th>
              <th className="hidden px-2 py-2 lg:table-cell">
                {branchFilter === "all" ? "Branches" : "Other branches"}
              </th>
              {!limited ? (
                <th className="hidden px-2 py-2 xl:table-cell">Profit</th>
              ) : null}
              <th className="w-24 px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {props.rows.length === 0 ? (
              <tr>
                <td className="px-3 py-5 text-zinc-400" colSpan={13}>
                  No inventory — pick a supplier catalog item to add.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-5 text-zinc-400" colSpan={13}>
                  No items match your search or filters.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const stockUnit = p.productEdit.stockUnit as StockUnit;
                const branchId =
                  branchFilter !== "all"
                    ? Number.parseInt(branchFilter, 10)
                    : null;
                const displayQty =
                  branchId != null
                    ? (p.branchQtyById[branchId] ?? 0)
                    : p.stockQuantity;
                const stockAt = formatDualStock(stockUnit, displayQty, {
                  kgPerSack: p.productEdit.kgPerSack,
                  unitsPerCase: p.productEdit.unitsPerCase,
                });

                return (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="px-2 py-2 font-medium text-zinc-50">{p.item}</td>
                  <td className="hidden px-2 py-2 text-zinc-300 sm:table-cell">
                    {p.brand}
                  </td>
                  <td className="px-2 py-2 text-zinc-300">{p.flavor}</td>
                  {!limited ? (
                    <>
                      <td className="hidden px-2 py-2 text-zinc-400 md:table-cell">
                        {p.itemTypeLabel}
                      </td>
                      <td className="hidden px-2 py-2 text-zinc-400 md:table-cell">
                        {p.supplierName}
                      </td>
                      <td className="hidden px-2 py-2 text-zinc-400 lg:table-cell">
                        {p.supplierRetail}
                      </td>
                      <td className="hidden px-2 py-2 text-zinc-400 lg:table-cell">
                        {p.supplierWs}
                      </td>
                      <td className="hidden px-2 py-2 text-zinc-400 md:table-cell">
                        {p.purchaseTier}
                      </td>
                    </>
                  ) : null}
                  <td className="hidden px-2 py-2 text-zinc-200 sm:table-cell">
                    {p.ourRetail}
                    <span className="text-[9px] text-zinc-600">{p.unitSuffix}</span>
                  </td>
                  {!limited ? (
                    <td className="hidden px-2 py-2 text-zinc-200 sm:table-cell">
                      {p.ourWs}
                    </td>
                  ) : null}
                  <td className="px-2 py-2 font-medium">
                    <div>{stockAt.primary}</div>
                    {stockAt.secondary !== "—" ? (
                      <div className="text-[9px] font-normal text-zinc-500">
                        {stockAt.secondary}
                      </div>
                    ) : null}
                    {branchId != null ? (
                      <div className="text-[9px] font-normal text-brand-cyan/70">
                        at {props.branches.find((b) => b.id === branchId)?.name}
                      </div>
                    ) : null}
                  </td>
                  <td className="hidden px-2 py-2 text-[10px] text-zinc-400 lg:table-cell">
                    {branchFilter === "all"
                      ? p.branchSummary
                      : p.branchSummary
                          .split(" · ")
                          .filter(
                            (part) =>
                              !part.startsWith(
                                `${props.branches.find((b) => b.id === branchId)?.name ?? ""}:`,
                              ),
                          )
                          .join(" · ") || "—"}
                  </td>
                  {!limited ? (
                    <td className="hidden px-2 py-2 text-brand-cyan/90 xl:table-cell">
                      <div>
                        R: +{p.profitRetail}
                        {p.unitSuffix}
                      </div>
                      {p.profitBulk ? (
                        <div className="text-[10px] text-brand-cyan/80">
                          W: +{p.profitBulk}
                          {p.unitSuffix}
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-2 py-2 align-top">
                    <div className="flex flex-col gap-1.5">
                      <ProductEditButton product={p.productEdit} />
                      {!limited ? (
                        <form action={deleteProduct}>
                          <input type="hidden" name="productId" value={p.id} />
                          <button
                            type="submit"
                            className="text-[10px] text-red-400/80 hover:text-red-300"
                          >
                            Delete
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ScrollableTable>
    </div>
  );
}
