import { db } from "@/db";
import { products, supplierCatalogItems, suppliers } from "@/db/schema";
import { KNOWN_BRANDS_WS } from "@/lib/catalog-fields";
import {
  displayCatalogFlavor,
  displayCatalogItem,
} from "@/lib/catalog-item-display";
import type { PawpsNormalizedRow } from "@/lib/pricelist-normalize-types";
import { asc, eq } from "drizzle-orm";

export type CatalogKnowledgeEntry = {
  type: string;
  item: string;
  flavor: string | null;
  size: string | null;
  searchText: string;
};

export type CatalogKnowledge = {
  entries: CatalogKnowledgeEntry[];
  promptBlock: string;
  brandCount: number;
  productCount: number;
};

function formatSize(packSize?: string | null, packUnit?: string | null) {
  if (!packSize?.trim()) return null;
  const unit = (packUnit ?? "").trim().toLowerCase();
  if (unit === "kg") return `${packSize}kg`;
  if (unit === "g") return `${packSize}g`;
  if (unit === "l") return `${packSize}L`;
  if (unit === "ml") return `${packSize}ml`;
  return packSize;
}

function mapItemType(itemType?: string | null): string {
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
  return "Other";
}

function normalizeKey(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function entryKey(entry: CatalogKnowledgeEntry) {
  return `${entry.type}|${entry.item}|${entry.flavor ?? ""}|${entry.size ?? ""}`;
}

function addEntry(
  map: Map<string, CatalogKnowledgeEntry>,
  fields: {
    type: string;
    item: string;
    flavor: string | null;
    size: string | null;
    extraTerms?: string[];
  },
) {
  const item = fields.item.trim();
  if (!item) return;

  const entry: CatalogKnowledgeEntry = {
    type: fields.type,
    item,
    flavor: fields.flavor?.trim() || null,
    size: fields.size?.trim() || null,
    searchText: normalizeKey(
      [item, fields.flavor, fields.size, ...(fields.extraTerms ?? [])]
        .filter(Boolean)
        .join(" "),
    ),
  };

  map.set(entryKey(entry), entry);
}

export async function buildCatalogKnowledge(
  supplierName?: string,
): Promise<CatalogKnowledge> {
  const trimmedSupplier = supplierName?.trim() ?? "";
  let supplierId: number | null = null;

  if (trimmedSupplier) {
    const [supplier] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.name, trimmedSupplier))
      .limit(1);
    supplierId = supplier?.id ?? null;
  }

  const [inventoryRows, catalogRows] = await Promise.all([
    db
      .select({
        name: products.name,
        brand: products.brand,
        variant: products.variant,
      })
      .from(products)
      .where(eq(products.archived, false))
      .orderBy(asc(products.name)),
    db
      .select({
        supplierId: supplierCatalogItems.supplierId,
        itemName: supplierCatalogItems.itemName,
        brand: supplierCatalogItems.brand,
        variant: supplierCatalogItems.variant,
        itemType: supplierCatalogItems.itemType,
        packSize: supplierCatalogItems.packSize,
        packUnit: supplierCatalogItems.packUnit,
      })
      .from(supplierCatalogItems)
      .orderBy(asc(supplierCatalogItems.itemName)),
  ]);

  const map = new Map<string, CatalogKnowledgeEntry>();

  for (const product of inventoryRows) {
    addEntry(map, {
      type: "Other",
      item: product.name,
      flavor: product.variant,
      size: null,
      extraTerms: [product.brand],
    });
  }

  for (const row of catalogRows) {
    if (supplierId != null && row.supplierId !== supplierId) continue;

    const item = displayCatalogItem(row.brand, row.itemName);
    const flavorRaw = displayCatalogFlavor(row.variant, row.itemName);
    const flavor = flavorRaw === "—" ? null : flavorRaw;

    addEntry(map, {
      type: mapItemType(row.itemType),
      item,
      flavor,
      size: formatSize(row.packSize, row.packUnit),
      extraTerms: [row.brand ?? "", row.itemName],
    });
  }

  for (const brand of KNOWN_BRANDS_WS) {
    addEntry(map, {
      type: "Other",
      item: brand,
      flavor: null,
      size: null,
    });
  }

  const entries = [...map.values()].slice(0, 250);

  const sampleLines = entries.slice(0, 120).map((entry) => {
    const parts = [
      entry.type,
      entry.item,
      entry.flavor ?? "",
      entry.size ?? "",
    ].filter(Boolean);
    return `- ${parts.join(" | ")}`;
  });

  const promptBlock = [
    "PAWPS CATALOG REFERENCE (prefer these exact brand/item/flavor/size names when OCR or PDF text is messy):",
    ...sampleLines,
    entries.length > 120
      ? `- … and ${entries.length - 120} more known products in this shop`
      : "",
    "",
    "Rules when matching:",
    "- item = brand line only (Aozi, Whiskas, Special Cat, Pedigree, etc.)",
    "- flavor = variant (Tuna, Adult, Urinary, Kitten, etc.)",
    "- size = pack weight (7kg, 20kg, 400g) — never put kg in flavor",
    "- Fix OCR typos using closest reference line (e.g. CIAL CAT → Special Cat, SKAS → Whiskas)",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    entries,
    promptBlock,
    brandCount: KNOWN_BRANDS_WS.length,
    productCount: entries.length,
  };
}

function tokenSet(text: string) {
  return new Set(normalizeKey(text).split(" ").filter((t) => t.length > 1));
}

function scoreRowAgainstEntry(
  row: PawpsNormalizedRow,
  entry: CatalogKnowledgeEntry,
) {
  const rowText = normalizeKey(
    [row.item, row.flavor, row.size].filter(Boolean).join(" "),
  );
  const rowTokens = tokenSet(rowText);
  const entryTokens = tokenSet(entry.searchText);

  if (!rowText || entryTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of entryTokens) {
    if (rowTokens.has(token)) overlap += 1;
  }

  let score = overlap / Math.max(entryTokens.size, 1);
  if (rowText.includes(normalizeKey(entry.item))) score += 0.35;
  if (entry.flavor && rowText.includes(normalizeKey(entry.flavor))) score += 0.2;
  if (entry.size && rowText.includes(normalizeKey(entry.size))) score += 0.15;
  return score;
}

function extractSizeFromText(text: string): string | null {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|l|ml)\b/i);
  if (!match) return null;
  const unit = match[2]!.toLowerCase();
  if (unit === "l") return `${match[1]}L`;
  return `${match[1]}${unit}`;
}

export function looksLikeBadPricelistParse(rows: PawpsNormalizedRow[]) {
  if (rows.length === 0) return true;

  let suspicious = 0;
  for (const row of rows) {
    const blob = `${row.item} ${row.flavor ?? ""}`;
    if (row.item.length <= 2) suspicious += 1;
    if (row.wholesale > 50000 || row.wholesale < 10) suspicious += 1;
    if (/[\[\]{}|\\]|_{2,}/.test(blob)) suspicious += 1;
    if (/\d{3,}/.test(row.item)) suspicious += 1;
  }

  return suspicious >= Math.max(2, Math.ceil(rows.length * 0.25));
}

export function applyCatalogKnowledgeToRows(
  rows: PawpsNormalizedRow[],
  knowledge: CatalogKnowledge,
): PawpsNormalizedRow[] {
  if (rows.length === 0 || knowledge.entries.length === 0) return rows;

  return rows.map((row) => {
    let best: CatalogKnowledgeEntry | null = null;
    let bestScore = 0;

    for (const entry of knowledge.entries) {
      const score = scoreRowAgainstEntry(row, entry);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }

    const combined = [row.item, row.flavor, row.size].filter(Boolean).join(" ");

    if (!best || bestScore < 0.45) {
      const size = row.size ?? extractSizeFromText(combined);
      return { ...row, size };
    }

    return {
      ...row,
      type: best.type !== "Other" ? best.type : row.type,
      item: best.item,
      flavor: best.flavor,
      size: best.size ?? row.size ?? extractSizeFromText(combined),
    };
  });
}

export async function finalizeNormalizedRows(
  rows: PawpsNormalizedRow[],
  supplierName: string,
) {
  const knowledge = await buildCatalogKnowledge(supplierName);
  return applyCatalogKnowledgeToRows(rows, knowledge);
}
