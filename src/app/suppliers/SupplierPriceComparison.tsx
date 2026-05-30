"use client";

import { useMemo, useState } from "react";

import type { PriceComparisonRow } from "@/db/queries/supplier-comparison";
import { formatPhpFromCents } from "@/lib/money";

type SortMode = "expensive" | "cheap" | "name";
type PriceView = "wholesale" | "retail" | "both";

function priceCell(cents: number | null, isBest: boolean) {
  if (cents == null) return "—";
  return (
    <span className={isBest ? "font-semibold text-emerald-300" : "text-zinc-200"}>
      {formatPhpFromCents(cents)}
    </span>
  );
}

export function SupplierPriceComparison(props: { rows: PriceComparisonRow[] }) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("expensive");
  const [priceView, setPriceView] = useState<PriceView>("both");

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

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-zinc-100">
            Cross-supplier price comparison
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">
            Items sold by 2+ suppliers — green = cheapest for that tier.
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none"
          >
            <option value="expensive">Most → least expensive</option>
            <option value="cheap">Cheapest first</option>
            <option value="name">By item name</option>
          </select>
          <select
            value={priceView}
            onChange={(e) => setPriceView(e.target.value as PriceView)}
            className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none"
          >
            <option value="both">Wholesale + retail</option>
            <option value="wholesale">Wholesale only</option>
            <option value="retail">Retail only</option>
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item..."
            className="min-w-[120px] rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none sm:w-40"
          />
        </div>
      </div>

      {props.rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          Upload catalogs from 2+ suppliers with overlapping items to compare prices.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered.map((row) => (
            <div
              key={row.itemKey}
              className="rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-medium text-zinc-50">{row.itemLabel}</span>
                  {row.flavor !== "—" ? (
                    <span className="ml-2 text-xs text-zinc-400">{row.flavor}</span>
                  ) : null}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {row.offers.length} suppliers
                </div>
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[320px] text-xs">
                  <thead>
                    <tr className="text-left text-[10px] text-zinc-500">
                      <th className="py-1 pr-3">Supplier</th>
                      {(priceView === "both" || priceView === "wholesale") && (
                        <th className="py-1 pr-3">Wholesale</th>
                      )}
                      {(priceView === "both" || priceView === "retail") && (
                        <th className="py-1">Retail</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {row.offers.map((o) => (
                      <tr key={o.supplierId} className="border-t border-white/5">
                        <td className="py-1.5 pr-3 text-zinc-400">{o.supplierName}</td>
                        {(priceView === "both" || priceView === "wholesale") && (
                          <td className="py-1.5 pr-3">
                            {priceCell(
                              o.wholesaleCents,
                              o.wholesaleCents != null &&
                                o.wholesaleCents === row.bestWholesale,
                            )}
                          </td>
                        )}
                        {(priceView === "both" || priceView === "retail") && (
                          <td className="py-1.5">
                            {priceCell(
                              o.retailCents,
                              o.retailCents != null &&
                                o.retailCents === row.bestRetail,
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 text-[11px] text-zinc-500">
        {filtered.length} of {props.rows.length} comparable items
      </div>
    </div>
  );
}
