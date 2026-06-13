"use client";

import { useMemo, useState } from "react";

import { ScrollableTable } from "@/components/ScrollableTable";
import type { PriceComparisonRow } from "@/db/queries/supplier-comparison";
import { formatPhpFromCents } from "@/lib/money";

type SortMode = "expensive" | "cheap" | "name";
type PriceView = "wholesale" | "retail";

function formatPrice(cents: number | null) {
  if (cents == null) return "—";
  return formatPhpFromCents(cents);
}

export function SupplierPriceComparison(props: { rows: PriceComparisonRow[] }) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("cheap");
  const [priceView, setPriceView] = useState<PriceView>("wholesale");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = props.rows;
    if (q) {
      list = list.filter(
        (r) =>
          r.itemLabel.toLowerCase().includes(q) ||
          r.flavor.toLowerCase().includes(q),
      );
    }
    if (sortMode === "expensive") {
      list = [...list].sort((a, b) => b.sortPrice - a.sortPrice);
    } else if (sortMode === "cheap") {
      list = [...list].sort((a, b) => {
        const aMin = a.bestWholesale ?? a.bestRetail ?? Infinity;
        const bMin = b.bestWholesale ?? b.bestRetail ?? Infinity;
        return aMin - bMin;
      });
    } else {
      list = [...list].sort((a, b) => a.itemLabel.localeCompare(b.itemLabel));
    }
    return list;
  }, [props.rows, query, sortMode]);

  const visibleRows = expanded ? filtered : filtered.slice(0, 8);

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-800">Price comparison</div>
          <div className="text-[10px] text-zinc-600">
            Same item across 2+ suppliers · green = cheapest
          </div>
        </div>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[10px] text-zinc-900 outline-none"
        >
          <option value="cheap">Cheapest first</option>
          <option value="expensive">Most expensive</option>
          <option value="name">A–Z</option>
        </select>
        <select
          value={priceView}
          onChange={(e) => setPriceView(e.target.value as PriceView)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[10px] text-zinc-900 outline-none"
        >
          <option value="wholesale">Wholesale</option>
          <option value="retail">Retail</option>
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter…"
          className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 text-[10px] text-zinc-900 outline-none sm:w-32"
        />
      </div>

      {props.rows.length === 0 ? (
        <p className="mt-2 text-[11px] text-zinc-600">
          Upload 2+ suppliers with overlapping items to compare.
        </p>
      ) : (
        <ScrollableTable
          maxHeight={expanded ? "max-h-[min(38vh,320px)]" : "max-h-[9.5rem]"}
          className="mt-2"
        >
          <table className="w-full min-w-[640px] text-[11px]">
            <thead className="sticky top-0 z-10 bg-zinc-100 text-left text-[10px] text-zinc-600">
              <tr>
                <th className="px-2 py-1.5 font-medium">Item</th>
                <th className="hidden w-28 px-2 py-1.5 font-medium sm:table-cell">
                  Flavor
                </th>
                <th className="w-24 px-2 py-1.5 font-medium">Best</th>
                <th className="w-28 px-2 py-1.5 font-medium">At</th>
                <th className="w-24 px-2 py-1.5 font-medium">Highest</th>
                <th className="w-16 px-2 py-1.5 font-medium">Gap</th>
                <th className="min-w-[140px] px-2 py-1.5 font-medium">All offers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visibleRows.map((row) => {
                const best =
                  priceView === "wholesale" ? row.bestWholesale : row.bestRetail;
                const worst =
                  priceView === "wholesale"
                    ? row.worstWholesale
                    : row.offers.reduce<number | null>((max, o) => {
                        const p = o.retailCents;
                        if (p == null) return max;
                        return max == null ? p : Math.max(max, p);
                      }, null);
                const gap =
                  best != null && worst != null && worst > best
                    ? worst - best
                    : null;
                const bestOffer = row.offers.find((o) =>
                  priceView === "wholesale"
                    ? o.wholesaleCents === best
                    : o.retailCents === best,
                );

                return (
                  <tr key={row.itemKey} className="hover:bg-white/[0.03]">
                    <td className="max-w-[120px] truncate px-2 py-1 font-medium text-zinc-800">
                      {row.itemLabel}
                    </td>
                    <td className="hidden max-w-[100px] truncate px-2 py-1 text-zinc-600 sm:table-cell">
                      {row.flavor === "—" ? "" : row.flavor}
                    </td>
                    <td className="px-2 py-1 font-semibold text-brand-cyan/80">
                      {formatPrice(best)}
                    </td>
                    <td className="max-w-[100px] truncate px-2 py-1 text-zinc-600">
                      {bestOffer?.supplierName ?? "—"}
                    </td>
                    <td className="px-2 py-1 text-zinc-700">
                      {formatPrice(worst)}
                    </td>
                    <td className="px-2 py-1 text-amber-800/90">
                      {gap != null ? formatPrice(gap) : "—"}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {row.offers.map((o) => {
                          const cents =
                            priceView === "wholesale"
                              ? o.wholesaleCents
                              : o.retailCents;
                          const isBest = cents != null && cents === best;
                          return (
                            <span
                              key={o.supplierId}
                              className={
                                isBest
                                  ? "text-brand-cyan/80"
                                  : "text-zinc-600"
                              }
                              title={o.supplierName}
                            >
                              {o.supplierName.split(/\s+/)[0]} {formatPrice(cents)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-600">
        <span>
          {filtered.length} comparable · showing {visibleRows.length}
        </span>
        {filtered.length > 8 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-brand-blue hover:underline"
          >
            {expanded ? "Show less" : `Show all ${filtered.length}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
