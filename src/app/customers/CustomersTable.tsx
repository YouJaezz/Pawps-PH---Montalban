"use client";

import { useMemo, useState } from "react";

import { deleteCustomer } from "@/app/customers/delete-actions";
import { ScrollableTable } from "@/components/ScrollableTable";
import { TableToolbar } from "@/components/TableToolbar";
import { matchesQuery } from "@/lib/table-filter";

export type CustomerTableRow = {
  id: number;
  name: string;
  contact: string | null;
  location: string | null;
  totalSpend: number;
  searchText: string;
};

export function CustomersTable(props: { rows: CustomerTableRow[] }) {
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
        placeholder="Search name, contact, location…"
        shown={filtered.length}
        total={props.rows.length}
      />

      <ScrollableTable maxHeight="max-h-[min(65vh,640px)]">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-700">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Contact
              </th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">
                Location
              </th>
              <th className="w-28 px-4 py-3 font-medium">Spend</th>
              <th className="w-20 px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {props.rows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-zinc-600" colSpan={5}>
                  No customers yet — add your first customer on the left.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-zinc-600" colSpan={5}>
                  No customers match your search.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <div className="truncate">{c.name}</div>
                    <div className="mt-1 text-xs text-zinc-600 md:hidden">
                      {c.contact ?? "—"}
                      {c.location ? ` • ${c.location}` : ""}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-800 md:table-cell">
                    {c.contact ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-800 lg:table-cell">
                    {c.location ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-800">
                    ₱{(c.totalSpend / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <form action={deleteCustomer}>
                      <input type="hidden" name="customerId" value={c.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-800 hover:bg-red-500/15"
                      >
                        Delete
                      </button>
                    </form>
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
