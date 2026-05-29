import { StatCard } from "@/components/StatCard";
import { ScrollableTable } from "@/components/ScrollableTable";
import {
  displayCatalogFlavor,
  displayCatalogItem,
  formatMoneyOrDash,
} from "@/lib/catalog-item-display";
import type { PriceChangeRow, SupplierUploadSummary } from "@/db/queries/supplier-inflation";

function formatDateShort(d: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
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
  if (value < 0) return "text-emerald-300";
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

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-medium text-zinc-100">Price update analytics</div>
        <div className="mt-1 text-xs text-zinc-400">
          Each new upload replaces that supplier&apos;s catalog and records wholesale
          price changes vs the previous list.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Price list uploads"
          value={`${props.uploadCount}`}
          subtitle="Total files uploaded"
        />
        <StatCard
          title="Tracked price changes"
          value={`${props.changeEventCount}`}
          subtitle="Items compared across updates"
        />
        <StatCard
          title="Avg wholesale change"
          value={formatPercent(props.overallAvgInflationPercent)}
          subtitle="Across all recorded updates"
        />
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-400">
          Upload a price list twice for the same supplier to see inflation trends.
        </div>
      ) : null}

      {props.uploadSummaries.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-medium text-zinc-100">Updates by upload</div>
          <div className="mt-1 text-xs text-zinc-400">
            Average wholesale change when each new list replaced the previous one.
          </div>

          <ScrollableTable maxHeight="max-h-[min(40vh,360px)]">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-white/5 text-left text-[12px] text-zinc-300">
                <tr>
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Supplier</th>
                  <th className="hidden px-3 py-3 font-medium md:table-cell">File</th>
                  <th className="w-24 px-3 py-3 font-medium">Avg change</th>
                  <th className="hidden w-20 px-3 py-3 font-medium sm:table-cell">Up</th>
                  <th className="hidden w-20 px-3 py-3 font-medium sm:table-cell">Down</th>
                  <th className="hidden w-20 px-3 py-3 font-medium lg:table-cell">New</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {props.uploadSummaries.map((u) => (
                  <tr key={u.documentId} className="hover:bg-white/5">
                    <td className="px-3 py-3 text-zinc-200">
                      {formatDateShort(u.uploadedAt)}
                    </td>
                    <td className="px-3 py-3 font-medium text-zinc-50">
                      {u.supplierName}
                    </td>
                    <td className="hidden px-3 py-3 text-zinc-400 md:table-cell">
                      <div className="truncate">{u.fileName}</div>
                    </td>
                    <td
                      className={`px-3 py-3 font-medium ${changeColor(u.avgChangePercent)}`}
                    >
                      {formatPercent(u.avgChangePercent)}
                    </td>
                    <td className="hidden px-3 py-3 text-red-300 sm:table-cell">
                      {u.itemsIncreased}
                    </td>
                    <td className="hidden px-3 py-3 text-emerald-300 sm:table-cell">
                      {u.itemsDecreased}
                    </td>
                    <td className="hidden px-3 py-3 text-zinc-300 lg:table-cell">
                      {u.itemsNew}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      ) : null}

      {props.topIncreases.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-medium text-zinc-100">Biggest price increases</div>
          <div className="mt-1 text-xs text-zinc-400">
            Items with the largest wholesale hikes on recent uploads.
          </div>

          <ScrollableTable maxHeight="max-h-[min(45vh,400px)]">
            <table className="w-full table-auto text-sm">
              <thead className="bg-white/5 text-left text-[12px] text-zinc-300">
                <tr>
                  <th className="px-3 py-3 font-medium">Item</th>
                  <th className="px-3 py-3 font-medium">Flavor</th>
                  <th className="hidden w-28 px-3 py-3 font-medium md:table-cell">Old</th>
                  <th className="hidden w-28 px-3 py-3 font-medium md:table-cell">New</th>
                  <th className="w-24 px-3 py-3 font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {props.topIncreases.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5">
                    <td className="px-3 py-3 font-medium text-zinc-50">
                      {displayCatalogItem(row.brand, row.itemName)}
                    </td>
                    <td className="px-3 py-3 text-zinc-200">
                      {displayCatalogFlavor(row.variant, row.itemName)}
                    </td>
                    <td className="hidden px-3 py-3 text-zinc-300 md:table-cell">
                      {formatMoneyOrDash(row.previousUnitCost)}
                    </td>
                    <td className="hidden px-3 py-3 text-zinc-200 md:table-cell">
                      {formatMoneyOrDash(row.newUnitCost)}
                    </td>
                    <td
                      className={`px-3 py-3 font-medium ${changeColor(row.changePercent)}`}
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

      {props.latestChanges.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-medium text-zinc-100">Recent price changes</div>
          <ScrollableTable maxHeight="max-h-[min(50vh,480px)]">
            <table className="w-full table-auto text-sm">
              <thead className="bg-white/5 text-left text-[12px] text-zinc-300">
                <tr>
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Item</th>
                  <th className="hidden w-28 px-3 py-3 font-medium md:table-cell">Old</th>
                  <th className="hidden w-28 px-3 py-3 font-medium md:table-cell">New</th>
                  <th className="w-24 px-3 py-3 font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {props.latestChanges.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5">
                    <td className="px-3 py-3 text-zinc-400">
                      {formatDateShort(row.recordedAt)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-zinc-50">
                        {displayCatalogItem(row.brand, row.itemName)}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {displayCatalogFlavor(row.variant, row.itemName)} ·{" "}
                        {row.supplierName}
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 text-zinc-300 md:table-cell">
                      {row.newUnitCost == null ? (
                        <span className="text-zinc-500">Removed</span>
                      ) : (
                        formatMoneyOrDash(row.previousUnitCost)
                      )}
                    </td>
                    <td className="hidden px-3 py-3 text-zinc-200 md:table-cell">
                      {row.newUnitCost == null ? (
                        <span className="text-zinc-500">—</span>
                      ) : (
                        formatMoneyOrDash(row.newUnitCost)
                      )}
                    </td>
                    <td
                      className={`px-3 py-3 font-medium ${changeColor(row.changePercent)}`}
                    >
                      {row.newUnitCost == null
                        ? "Removed"
                        : row.previousUnitCost == null
                          ? "New"
                          : formatPercent(row.changePercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      ) : null}
    </div>
  );
}
