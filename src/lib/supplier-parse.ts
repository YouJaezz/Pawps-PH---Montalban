import * as XLSX from "xlsx";

import type { ParsedCatalogRow } from "@/lib/catalog-fields";
export type { ParsedCatalogRow } from "@/lib/catalog-fields";

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseMoneyToCents(value: string) {
  const cleaned = value.replace(/[₱,\s]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * 100);
}

export function parseSpreadsheetBuffer(buffer: Buffer): ParsedCatalogRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];

  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (raw.length === 0) return [];

  const firstKeys = Object.keys(raw[0] ?? {}).map(normalizeHeader);
  const headerMap = new Map<string, string>();
  for (const key of Object.keys(raw[0] ?? {})) {
    headerMap.set(normalizeHeader(key), key);
  }

  const get = (row: Record<string, unknown>, aliases: string[]) => {
    for (const alias of aliases) {
      const orig = headerMap.get(normalizeHeader(alias));
      if (orig && row[orig] != null && String(row[orig]).trim()) {
        return String(row[orig]).trim();
      }
    }
    return "";
  };

  const isPawpsNormalizedCsv =
    headerMap.has("supplier") &&
    headerMap.has("wholesale") &&
    headerMap.has("item") &&
    headerMap.has("type");

  const rows: ParsedCatalogRow[] = [];

  for (const row of raw) {
    if (isPawpsNormalizedCsv) {
      const brand = get(row, ["item"]);
      if (!brand) continue;
      const flavor = get(row, ["flavor", "flavour"]);
      const itemName =
        flavor && brand.toLowerCase() !== flavor.toLowerCase()
          ? `${brand} — ${flavor}`
          : brand;
      const itemType = get(row, ["type"]);
      const costRaw = get(row, ["wholesale"]);
      const retailRaw = get(row, ["retail"]);
      const packSizeRaw = get(row, ["size"]);
      const perKiloRaw = get(row, ["per_kg", "per kg", "per kilo"]);
      const notes = get(row, ["notes", "remarks"]);

      rows.push({
        itemName,
        brand,
        productName: flavor || brand,
        variant: flavor || undefined,
        itemType: itemType || undefined,
        unitCostCents: costRaw ? parseMoneyToCents(costRaw) : undefined,
        packSize: packSizeRaw || undefined,
        perKiloCents: perKiloRaw ? parseMoneyToCents(perKiloRaw) : undefined,
        retailPriceCents: retailRaw ? parseMoneyToCents(retailRaw) : undefined,
        notes: notes || undefined,
      });
      continue;
    }

    const itemName = get(row, [
      "item",
      "item name",
      "product",
      "product name",
      "name",
      "description",
    ]);
    if (!itemName) continue;

    const itemType = get(row, ["item type", "type", "category", "department"]);
    const productName = get(row, ["product name", "name", "product"]);
    const brand = get(row, ["brand", "manufacturer"]);
    const variant = get(row, [
      "variant",
      "flavor",
      "flavour",
      "size",
    ]);
    const sku = get(row, ["sku", "code", "item code", "product code"]);
    const costRaw = get(row, [
      "wholesale",
      "cost",
      "unit cost",
      "price",
      "unit price",
    ]);
    const retailRaw = get(row, ["retail", "srp", "retail price"]);
    const packSizeRaw = get(row, [
      "size",
      "unit (kg)",
      "unit kg",
      "unit",
      "weight",
      "size kg",
      "qty",
      "quantity",
    ]);
    const packUnitRaw = get(row, ["unit type", "uom", "unit label"]);
    const perKiloRaw = get(row, [
      "per kilo",
      "per kg",
      "per_kg",
      "per_kilo",
      "perkg",
    ]);
    const notes = get(row, ["notes", "remarks"]);

    rows.push({
      itemName,
      brand: brand || undefined,
      productName: productName || undefined,
      variant: variant || undefined,
      itemType: itemType || undefined,
      sku: sku || undefined,
      unitCostCents: costRaw ? parseMoneyToCents(costRaw) : undefined,
      packSize: packSizeRaw || undefined,
      packUnit: packUnitRaw || (packSizeRaw ? "kg" : undefined),
      perKiloCents: perKiloRaw ? parseMoneyToCents(perKiloRaw) : undefined,
      retailPriceCents: retailRaw ? parseMoneyToCents(retailRaw) : undefined,
      notes: notes || undefined,
    });
  }

  // If no headers matched, treat first column as item name.
  if (rows.length === 0 && firstKeys.length > 0) {
    const firstColKey = Object.keys(raw[0] ?? {})[0];
    if (firstColKey) {
      for (const row of raw) {
        const itemName = String(row[firstColKey] ?? "").trim();
        if (itemName) rows.push({ itemName });
      }
    }
  }

  return rows;
}

export function parsePlainTextCatalog(text: string): ParsedCatalogRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: ParsedCatalogRow[] = [];
  for (const line of lines) {
    const parts = line.split(/\t|,|;|\|/).map((p) => p.trim());
    const itemName = parts[0];
    if (!itemName || itemName.toLowerCase() === "item") continue;
    rows.push({
      itemName,
      brand: parts[1] || undefined,
      variant: parts[2] || undefined,
      sku: parts[3] || undefined,
      unitCostCents: parts[4] ? parseMoneyToCents(parts[4]) : undefined,
      notes: parts.slice(5).join(" ") || undefined,
    });
  }
  return rows;
}

export async function parseSupplierFile(
  buffer: Buffer,
  fileName: string,
): Promise<ParsedCatalogRow[]> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (["xlsx", "xls", "csv"].includes(ext)) {
    return parseSpreadsheetBuffer(buffer);
  }

  if (["txt", "md"].includes(ext)) {
    return parsePlainTextCatalog(buffer.toString("utf8"));
  }

  if (ext === "pdf") {
    const { parsePdfBuffer } = await import("@/lib/pdf-parse-server");
    return parsePdfBuffer(buffer);
  }

  return [];
}
