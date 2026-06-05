"use client";

import { useMemo, useState } from "react";

import { ScrollableTable } from "@/components/ScrollableTable";
import { TableToolbar } from "@/components/TableToolbar";
import { matchesQuery } from "@/lib/table-filter";

export type ExpiringSoonRow = {
  id: number;
  name: string;
  subtitle: string;
  stockQuantity: number;
  expiryLabel: string;
  searchText: string;
};

export function ExpiringSoonTable(props: { rows: ExpiringSoonRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return props.rows;
    return props.rows.filter((r) => matchesQuery(r.searchText, query));
  }, [props.rows, query]);

  return (
    <div>
      <TableToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search product, brand, flavor…"
        shown={filtered.length}
        total={props.rows.length}
      />

      <ScrollableTable maxHeight="max-h-[min(50vh,400px)]">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-zinc-300">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Expiry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {props.rows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-zinc-400" colSpan={3}>
                  No expiring items found (or no products yet).
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-zinc-400" colSpan={3}>
                  No items match your search.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-50">{p.name}</div>
                    {p.subtitle ? (
                      <div className="text-xs text-zinc-400">{p.subtitle}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-200">{p.stockQuantity}</td>
                  <td className="px-4 py-3 text-zinc-200">{p.expiryLabel}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollableTable>
    </div>
  );
}
