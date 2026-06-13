"use client";

import Link from "next/link";

import { ScrollableTable } from "@/components/ScrollableTable";
import { TableToolbar } from "@/components/TableToolbar";
import type { StockAlertRow } from "@/lib/stock-alerts";
import { stockAlertLabel } from "@/lib/stock-alerts";
import { displayCatalogItemType } from "@/lib/catalog-item-types";
import { rowSearchText, matchesQuery } from "@/lib/table-filter";
import { useMemo, useState } from "react";

export function StockAlertsTable(props: {
  rows: StockAlertRow[];
  showLink?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");

  const enriched = useMemo(
    () =>
      props.rows.map((r) => ({
        ...r,
        searchText: rowSearchText([
          r.name,
          r.brand,
          r.variant,
          r.itemType,
          stockAlertLabel(r.level),
        ]),
      })),
    [props.rows],
  );

  const filtered = useMemo(() => {
    let list = enriched;
    if (levelFilter === "empty") list = list.filter((r) => r.level === "empty");
    else if (levelFilter === "low") list = list.filter((r) => r.level === "low");
    if (query.trim()) list = list.filter((r) => matchesQuery(r.searchText, query));
    return list;
  }, [enriched, query, levelFilter]);

  return (
    <div>
      <TableToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search item, brand, type…"
        shown={filtered.length}
        total={props.rows.length}
        filters={[
          {
            id: "level",
            value: levelFilter,
            onChange: setLevelFilter,
            "aria-label": "Filter alert level",
            options: [
              { value: "all", label: "All alerts" },
              { value: "empty", label: "Out of stock" },
              { value: "low", label: "Low stock" },
            ],
          },
        ]}
      />
      <ScrollableTable maxHeight="max-h-[min(50vh,420px)]" className="mt-3">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">On hand</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-zinc-500">
                  {props.rows.length === 0
                    ? "All items are adequately stocked."
                    : "No matches."}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-white/5">
                  <td className="px-3 py-2">
                    <div className="font-medium text-zinc-200">{r.name}</div>
                    <div className="text-[10px] text-zinc-500">
                      {r.brand}
                      {r.variant ? ` · ${r.variant}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {displayCatalogItemType(r.itemType)}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">
                    <div>{r.displayQty}</div>
                    {r.displayQtyDetail !== "—" ? (
                      <div className="text-[10px] text-zinc-500">
                        {r.displayQtyDetail}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.level === "empty"
                          ? "text-red-400"
                          : "text-amber-300"
                      }
                    >
                      {stockAlertLabel(r.level)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollableTable>
      {props.showLink ? (
        <Link
          href="/products"
          className="mt-3 inline-block text-xs text-zinc-400 underline hover:text-zinc-200"
        >
          Open Inventory →
        </Link>
      ) : null}
    </div>
  );
}
