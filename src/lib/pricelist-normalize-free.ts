import type { ParsedCatalogRow } from "@/lib/catalog-fields";
import { detectPdfFormat } from "@/lib/catalog-fields";
import { parseMayPriceListText } from "@/lib/supplier-parse-pdf";
import { parseWsPriceListText } from "@/lib/supplier-parse-pdf-ws";
import {
  PAWPS_CATALOG_TYPES,
  type PawpsNormalizedRow,
} from "@/lib/pricelist-normalize-types";

function centsToPesos(cents: number | undefined) {
  if (cents == null || !Number.isFinite(cents)) return null;
  return Math.round(cents) / 100;
}

function formatSize(packSize?: string, packUnit?: string): string | null {
  if (!packSize) return null;
  const unit = (packUnit ?? "").trim();
  if (!unit) return packSize;
  if (packSize.toLowerCase().endsWith(unit.toLowerCase())) return packSize;
  return `${packSize}${unit}`;
}

function mapItemType(itemType?: string): string {
  const t = (itemType ?? "").toLowerCase();
  if (t.includes("dog") && (t.includes("can") || t.includes("canned")))
    return "Dog Wet Food (Can)";
  if (t.includes("cat") && (t.includes("can") || t.includes("canned")))
    return "Cat Wet Food (Can)";
  if (t.includes("dog") && (t.includes("wet") || t.includes("pouch")))
    return "Dog Wet Food (Pouch)";
  if (t.includes("cat") && (t.includes("wet") || t.includes("pouch")))
    return "Cat Wet Food (Pouch)";
  if (t.includes("dog") && t.includes("food")) return "Dog Dry Food";
  if (t.includes("cat") && t.includes("food")) return "Cat Dry Food";
  if (t.includes("litter")) return "Cat Litter";
  if (t.includes("dog") && t.includes("treat")) return "Dog Treats";
  if (t.includes("cat") && t.includes("treat")) return "Cat Treats";
  if (t.includes("tick") || t.includes("flea")) return "Tick & Flea";
  if (t.includes("vitamin") || t.includes("medicine") || t.includes("milk"))
    return "Vitamins & Medicine";
  if (t.includes("canned")) return "Dog Wet Food (Can)";
  if (t.includes("treat")) return "Dog Treats";
  return "Other";
}

export function catalogRowToPawps(row: ParsedCatalogRow): PawpsNormalizedRow | null {
  const wholesale = centsToPesos(row.unitCostCents);
  if (wholesale == null || wholesale <= 0) return null;

  const item = (row.brand ?? row.itemName.split("—")[0]?.trim() ?? row.itemName).trim();
  if (!item) return null;

  let flavor = row.variant?.trim() || null;
  if (flavor && flavor.toLowerCase() === item.toLowerCase()) flavor = null;

  return {
    type: mapItemType(row.itemType),
    item,
    flavor,
    size: formatSize(row.packSize, row.packUnit),
    per_kg: centsToPesos(row.perKiloCents),
    wholesale,
    retail: centsToPesos(row.retailPriceCents),
  };
}

export function catalogRowsToPawps(rows: ParsedCatalogRow[]): PawpsNormalizedRow[] {
  const out: PawpsNormalizedRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const pawps = catalogRowToPawps(row);
    if (!pawps) continue;
    const key = `${pawps.type}|${pawps.item}|${pawps.flavor ?? ""}|${pawps.size ?? ""}|${pawps.wholesale}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pawps);
  }
  return out;
}

function parseMoneyCell(raw: string): number | null {
  const s = raw.replace(/[₱,\s]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function pickColumn(headers: string[], aliases: string[]) {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Google Sheets / CSV paste with recognizable headers. */
function parseStructuredTable(text: string): PawpsNormalizedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delimiter = lines[0]!.includes("\t")
    ? "\t"
    : lines[0]!.includes(",")
      ? ","
      : null;
  if (!delimiter) return [];

  const headers = lines[0]!.split(delimiter).map(normalizeHeader);
  const hasPriceCol =
    headers.some((h) => /wholesale|ws|dealer|price/.test(h)) ||
    headers.some((h) => /item|product|brand/.test(h));
  if (!hasPriceCol) return [];

  const typeIdx = pickColumn(headers, ["type", "category", "item_type"]);
  const itemIdx = pickColumn(headers, [
    "item",
    "brand",
    "product",
    "item_name",
    "name",
  ]);
  const flavorIdx = pickColumn(headers, ["flavor", "variant", "flavour"]);
  const sizeIdx = pickColumn(headers, ["size", "weight", "volume", "pack"]);
  const perKgIdx = pickColumn(headers, ["per_kg", "perkg", "price_per_kg", "per_kilo"]);
  const wsIdx = pickColumn(headers, [
    "wholesale",
    "ws",
    "dealer",
    "wholesale_price",
    "ws_price",
  ]);
  const retailIdx = pickColumn(headers, ["retail", "srp", "retail_price"]);

  const rows: PawpsNormalizedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(delimiter).map((c) => c.trim());
    const wholesale = wsIdx >= 0 ? parseMoneyCell(cells[wsIdx] ?? "") : null;
    if (wholesale == null) continue;

    const item =
      itemIdx >= 0
        ? cells[itemIdx]?.trim()
        : cells.find((c) => c && !/^\d/.test(c))?.trim();
    if (!item) continue;

    const typeRaw = typeIdx >= 0 ? cells[typeIdx]?.trim() : "";
    const type = PAWPS_CATALOG_TYPES.includes(typeRaw as (typeof PAWPS_CATALOG_TYPES)[number])
      ? typeRaw
      : mapItemType(typeRaw);

    rows.push({
      type,
      item,
      flavor: flavorIdx >= 0 ? cells[flavorIdx]?.trim() || null : null,
      size: sizeIdx >= 0 ? cells[sizeIdx]?.trim() || null : null,
      per_kg: perKgIdx >= 0 ? parseMoneyCell(cells[perKgIdx] ?? "") : null,
      wholesale,
      retail: retailIdx >= 0 ? parseMoneyCell(cells[retailIdx] ?? "") : null,
    });
  }

  return rows;
}

/** Generic lines: "Brand variant 20kg 2975" or "Brand variant — ₱2,975" */
function parseGenericLines(text: string): PawpsNormalizedRow[] {
  const rows: PawpsNormalizedRow[] = [];
  let sectionType = "Other";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line || line.length < 4) continue;
    if (/^(?:wholesale|price list|prices may|pickup|walk.?in|📍|🛍|⚠)/i.test(line))
      continue;
    if (/^(?:dog dry|cat dry|dog food|cat food|cat litter|treats)/i.test(line)) {
      sectionType = mapItemType(line);
      continue;
    }

    const tabParts = line.split(/\t+/).filter(Boolean);
    if (tabParts.length >= 3) {
      const nums = tabParts
        .map(parseMoneyCell)
        .filter((n): n is number => n != null);
      if (nums.length >= 1) {
        const wholesale = nums[nums.length - 2] ?? nums[nums.length - 1]!;
        const retail =
          nums.length >= 2 ? nums[nums.length - 1]! : null;
        const textParts = tabParts.filter((p) => parseMoneyCell(p) == null);
        const item = textParts[0]?.trim();
        if (item && wholesale) {
          rows.push({
            type: sectionType,
            item,
            flavor: textParts[1]?.trim() || null,
            size: textParts.find((p) => /\d\s*(kg|g|l|ml)\b/i.test(p)) ?? null,
            per_kg: null,
            wholesale,
            retail: retail !== wholesale ? retail : null,
          });
          continue;
        }
      }
    }

    const priceMatch = line.match(
      /(.+?)\s+(?:₱|php\s*)?([\d,]+(?:\.\d+)?)\s*(?:₱|php)?\s*$/i,
    );
    if (priceMatch) {
      const desc = priceMatch[1]!.trim();
      const wholesale = parseMoneyCell(priceMatch[2]!);
      if (!desc || wholesale == null) continue;
      const sizeMatch = desc.match(/(\d+(?:\.\d+)?\s*(?:kg|g|l|ml|L))/i);
      const withoutSize = sizeMatch
        ? desc.replace(sizeMatch[0], "").trim()
        : desc;
      const words = withoutSize.split(/\s+/);
      rows.push({
        type: sectionType,
        item: words[0] ?? withoutSize,
        flavor: words.length > 1 ? words.slice(1).join(" ") : null,
        size: sizeMatch?.[1]?.replace(/\s+/g, "") ?? null,
        per_kg: null,
        wholesale,
        retail: null,
      });
    }
  }

  return rows;
}

export function parsePricelistTextFree(text: string): PawpsNormalizedRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const structured = parseStructuredTable(trimmed);
  if (structured.length > 0) return structured;

  const format = detectPdfFormat(trimmed);
  const catalogRows =
    format === "ws"
      ? parseWsPriceListText(trimmed)
      : parseMayPriceListText(trimmed);
  const fromCatalog = catalogRowsToPawps(catalogRows);
  if (fromCatalog.length > 0) return fromCatalog;

  return parseGenericLines(trimmed);
}

export function isPdfUpload(file: { name: string; mimeType: string }) {
  return (
    file.mimeType === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export function isImageUpload(file: { name: string; mimeType: string }) {
  return (
    file.mimeType.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif)$/i.test(file.name)
  );
}
