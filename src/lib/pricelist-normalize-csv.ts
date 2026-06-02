import type { PawpsNormalizedRow } from "@/lib/pricelist-normalize-types";
import { CSV_HEADERS } from "@/lib/pricelist-normalize-types";

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(
  supplier: string,
  rows: PawpsNormalizedRow[],
): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        supplier,
        row.type,
        row.item,
        row.flavor,
        row.size,
        row.per_kg,
        row.wholesale,
        row.retail,
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

export function downloadCsvFilename(supplier: string): string {
  const safe = supplier
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40) || "supplier";
  const date = new Date().toISOString().slice(0, 10);
  return `pawps_${safe}_${date}.csv`;
}

export function triggerCsvDownload(
  supplier: string,
  rows: PawpsNormalizedRow[],
): void {
  const csv = rowsToCsv(supplier, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadCsvFilename(supplier);
  a.click();
  URL.revokeObjectURL(url);
}
