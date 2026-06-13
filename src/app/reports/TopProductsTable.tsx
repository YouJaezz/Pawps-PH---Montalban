"use client";

import { useMemo, useState } from "react";

import { ScrollableTable } from "@/components/ScrollableTable";
import { TableToolbar } from "@/components/TableToolbar";
import { formatPhpFromCents } from "@/lib/money";
import { matchesQuery } from "@/lib/table-filter";

export type TopProductRow = {
  productId: number;
  label: string;
  quantity: number;
  revenueCents: number;
  profitCents: number;
  searchText: string;
};

export function TopProductsTable(props: { rows: TopProductRow[] }) {
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
        placeholder="Search product…"
        shown={filtered.length}
        total={props.rows.length}
      />

      <ScrollableTable maxHeight="max-h-[min(55vh,480px)]">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-700">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="w-20 px-4 py-3 font-medium">Qty</th>
              <th className="w-28 px-4 py-3 font-medium">Revenue</th>
              <th className="hidden w-28 px-4 py-3 font-medium sm:table-cell">
                Profit
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {props.rows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-zinc-600" colSpan={4}>
                  No paid sales yet — use Quick Sell to record sales.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-zinc-600" colSpan={4}>
                  No products match your search.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.productId} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <div className="truncate">{p.label}</div>
                    <div className="mt-1 text-xs text-zinc-600 sm:hidden">
                      Profit: {formatPhpFromCents(p.profitCents)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-800">{p.quantity}</td>
                  <td className="px-4 py-3 text-zinc-800">
                    {formatPhpFromCents(p.revenueCents)}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-800 sm:table-cell">
                    {formatPhpFromCents(p.profitCents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollableTable>
    </div>
  );
}
