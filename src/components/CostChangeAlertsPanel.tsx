import Link from "next/link";

import type { CostChangeAlert } from "@/db/queries/price-alerts";
import { formatPhpFromCents } from "@/lib/money";
import { productsShopCashHref, productsSuppliersHref } from "@/lib/nav-urls";

function formatDateShort(d: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}

function sourceLabel(source: CostChangeAlert["source"]) {
  switch (source) {
    case "restock":
      return "Restock";
    case "supplier_catalog":
      return "Supplier list";
    case "inventory":
      return "Inventory";
    default:
      return source;
  }
}

function changeColor(pct: number | null) {
  if (pct == null) return "text-zinc-400";
  if (pct > 0) return "text-red-300";
  if (pct < 0) return "text-emerald-300";
  return "text-zinc-300";
}

export function CostChangeAlertsPanel(props: {
  alerts: CostChangeAlert[];
  compact?: boolean;
}) {
  if (!props.alerts.length) {
    return (
      <p className="text-xs text-zinc-500">
        No cost price changes recorded yet. Restock payments with a different unit cost
        will appear here automatically.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[520px] text-xs">
        <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Product</th>
            {!props.compact ? <th className="px-3 py-2">Supplier</th> : null}
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2 text-right">Was</th>
            <th className="px-3 py-2 text-right">Now</th>
            <th className="px-3 py-2 text-right">Δ</th>
          </tr>
        </thead>
        <tbody>
          {props.alerts.map((row) => (
            <tr key={row.id} className="border-t border-white/5">
              <td className="px-3 py-2 text-zinc-400">
                {formatDateShort(row.recordedAt)}
              </td>
              <td className="max-w-[160px] truncate px-3 py-2 text-zinc-200">
                {row.productLabel ?? "—"}
              </td>
              {!props.compact ? (
                <td className="max-w-[120px] truncate px-3 py-2 text-zinc-500">
                  {row.supplierName ?? "—"}
                </td>
              ) : null}
              <td className="px-3 py-2 text-zinc-400">{sourceLabel(row.source)}</td>
              <td className="px-3 py-2 text-right text-zinc-500">
                {row.previousCents != null
                  ? formatPhpFromCents(row.previousCents)
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right text-zinc-200">
                {row.newCents != null ? formatPhpFromCents(row.newCents) : "—"}
              </td>
              <td className={`px-3 py-2 text-right font-medium ${changeColor(row.changePercent)}`}>
                {row.changePercent != null
                  ? `${row.changePercent > 0 ? "+" : ""}${row.changePercent}%`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-white/5 px-3 py-2 text-[10px] text-zinc-600">
        <Link href={productsSuppliersHref} className="underline hover:text-zinc-400">
          Supplier price analytics
        </Link>
        {" · "}
        <Link href={productsShopCashHref} className="underline hover:text-zinc-400">
          Record restock
        </Link>
      </p>
    </div>
  );
}
