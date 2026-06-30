import { StatCard } from "@/components/StatCard";
import { ScrollableTable } from "@/components/ScrollableTable";
import {
  displayCatalogFlavor,
  displayCatalogItem,
} from "@/lib/catalog-item-display";
import type { PriceChangeRow, SupplierUploadSummary } from "@/db/queries/supplier-inflation";

function formatDateShort(d: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
  }).format(d);
}

function formatPercent(value: number | null) {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function changeColor(value: number | null) {
  if (value == null) return "text-zinc-400";
  if (value > 0) return "text-red-300";
  if (value < 0) return "text-brand-cyan/80";
  return "text-zinc-300";
}

export function SupplierInflationPanel(props: {
  uploadCount: number;
  changeEventCount: number;
  overallAvgInflationPercent: number | null;
  uploadSummaries: SupplierUploadSummary[];
  topIncreases: PriceChangeRow[];
  latestChanges: PriceChangeRow[];
}) {
  const hasData = props.uploadCount > 0;

  if (!hasData) {
    return (
      <details className="rounded-xl border border-white/10 bg-white/5">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-300">
          Price analytics
          <span className="ml-2 font-normal text-zinc-600">
            — upload twice per supplier to track changes
          </span>
        </summary>
      </details>
    );
  }

  return (
    <details className="rounded-xl border border-white/10 bg-white/5">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.02]">
        Price analytics
        <span className="ml-2 font-normal text-zinc-500">
          {props.uploadCount} uploads · {props.changeEventCount} changes · avg{" "}
          {formatPercent(props.overallAvgInflationPercent)}
        </span>
      </summary>

      <div className="space-y-3 border-t border-white/10 p-3">
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            title="Uploads"
            value={`${props.uploadCount}`}
            subtitle="Price lists"
          />
          <StatCard
            title="Changes"
            value={`${props.changeEventCount}`}
            subtitle="Tracked"
          />
          <StatCard
            title="Avg Δ"
            value={formatPercent(props.overallAvgInflationPercent)}
            subtitle="Wholesale"
          />
        </div>

        {props.uploadSummaries.length > 0 ? (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              By upload
            </div>
            <ScrollableTable maxHeight="max-h-36" className="mt-1">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 z-10 bg-surface-elevated text-left text-[10px] text-zinc-500">
                  <tr>
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Supplier</th>
                    <th className="px-2 py-1">Avg</th>
                    <th className="hidden px-2 py-1 sm:table-cell">↑</th>
                    <th className="hidden px-2 py-1 sm:table-cell">↓</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {props.uploadSummaries.slice(0, 12).map((u) => (
                    <tr key={u.documentId}>
                      <td className="px-2 py-1 text-zinc-400">
                        {formatDateShort(u.uploadedAt)}
                      </td>
                      <td className="max-w-[100px] truncate px-2 py-1 text-zinc-200">
                        {u.supplierName}
                      </td>
                      <td
                        className={`px-2 py-1 font-medium ${changeColor(u.avgChangePercent)}`}
                      >
                        {formatPercent(u.avgChangePercent)}
                      </td>
                      <td className="hidden px-2 py-1 text-red-300/80 sm:table-cell">
                        {u.itemsIncreased}
                      </td>
                      <td className="hidden px-2 py-1 text-brand-cyan/80/80 sm:table-cell">
                        {u.itemsDecreased}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        ) : null}

        {props.latestChanges.filter((c) => c.changeSource === "restock").length > 0 ? (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
              From restock payments
            </div>
            <ScrollableTable maxHeight="max-h-32" className="mt-1">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 z-10 bg-surface-elevated text-left text-[10px] text-zinc-500">
                  <tr>
                    <th className="px-2 py-1">Item</th>
                    <th className="px-2 py-1">Supplier</th>
                    <th className="px-2 py-1">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {props.latestChanges
                    .filter((c) => c.changeSource === "restock")
                    .slice(0, 8)
                    .map((row) => (
                      <tr key={row.id}>
                        <td className="max-w-[160px] truncate px-2 py-1 text-zinc-200">
                          {displayCatalogItem(row.brand, row.itemName)}
                        </td>
                        <td className="max-w-[100px] truncate px-2 py-1 text-zinc-500">
                          {row.supplierName}
                        </td>
                        <td
                          className={`px-2 py-1 font-medium ${changeColor(row.changePercent)}`}
                        >
                          {formatPercent(row.changePercent)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        ) : null}

        {props.topIncreases.length > 0 ? (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Biggest increases
            </div>
            <ScrollableTable maxHeight="max-h-32" className="mt-1">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 z-10 bg-surface-elevated text-left text-[10px] text-zinc-500">
                  <tr>
                    <th className="px-2 py-1">Item</th>
                    <th className="px-2 py-1">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {props.topIncreases.slice(0, 8).map((row) => (
                    <tr key={row.id}>
                      <td className="max-w-[200px] truncate px-2 py-1 text-zinc-200">
                        {displayCatalogItem(row.brand, row.itemName)}
                        <span className="text-zinc-600">
                          {" "}
                          · {displayCatalogFlavor(row.variant, row.itemName)}
                        </span>
                      </td>
                      <td
                        className={`px-2 py-1 font-medium ${changeColor(row.changePercent)}`}
                      >
                        {formatPercent(row.changePercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        ) : null}
      </div>
    </details>
  );
}
