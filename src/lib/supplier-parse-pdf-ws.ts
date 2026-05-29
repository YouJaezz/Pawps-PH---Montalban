import type { ParsedCatalogRow } from "@/lib/catalog-fields";
import { buildCatalogRow, extractBrand, formatNotes } from "@/lib/catalog-fields";

const SKIP_LINE =
  /^(?:--\s*\d+\s+of\s+\d+\s+--|WS\s+PRICELIST|ITEM\s+DESCRIPTION|ITEM\s+PRODUCT|FREE DELIVERY|✅|Send us a message|Happy Shopping)/i;

const SECTION_LINE =
  /^(?:DOG DRY FOOD|CAT DRY FOOD|CAT LITTER|DOG CAN|CAT CAN|WET FOOD|POUCH|TREATS|Milk\s*\/|ITEM\s)/i;

/** desc + embedded unit + price: "Feline Fresh Lemon 10L 200" */
const EMBEDDED_UNIT_ROW =
  /^(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|G|L|l|ml|ML|cc|CC|gx\d+|x\d+)\s+(\d+)\s*$/i;

/** desc + numeric size + price: "Special Dog Adult 9 1100" */
const SIZE_PRICE_ROW = /^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d{2,})\s*$/;

/** desc + price only: "Mondex Small 70" */
const PRICE_ONLY_ROW = /^(.+?)\s+(\d{2,})\s*$/;

function normalizeSection(line: string): { itemType: string; defaultUnit: string } {
  const upper = line.toUpperCase();
  if (/DOG DRY FOOD/.test(upper)) return { itemType: "Dog Food", defaultUnit: "kg" };
  if (/CAT DRY FOOD/.test(upper)) return { itemType: "Cat Food", defaultUnit: "kg" };
  if (/CAT LITTER/.test(upper)) return { itemType: "Cat Litter", defaultUnit: "L" };
  if (/DOG CAN/.test(upper)) return { itemType: "Dog Canned Food", defaultUnit: "g" };
  if (/CAT CAN/.test(upper)) return { itemType: "Cat Canned Food", defaultUnit: "g" };
  if (/DOG WET FOOD|DOG.*POUCH/.test(upper))
    return { itemType: "Dog Wet Food", defaultUnit: "g" };
  if (/CAT WET FOOD|CAT.*POUCH/.test(upper))
    return { itemType: "Cat Wet Food", defaultUnit: "g" };
  if (/TREATS/.test(upper)) return { itemType: "Treats", defaultUnit: "g" };
  if (/MILK|VITAMIN|MEDICINE/.test(upper))
    return { itemType: "Medicine & Vitamins", defaultUnit: "ml" };
  return { itemType: "General", defaultUnit: "kg" };
}

function normalizePackUnit(raw: string) {
  const u = raw.toLowerCase();
  if (u === "l") return "L";
  if (u === "g") return "g";
  if (u === "kg") return "kg";
  if (u === "ml") return "ml";
  if (u === "cc") return "cc";
  if (u.includes("gx")) return "pack";
  return raw;
}

function parseDataLine(
  line: string,
  itemType: string,
  defaultUnit: string,
): ParsedCatalogRow | null {
  const embedded = line.match(EMBEDDED_UNIT_ROW);
  if (embedded) {
    const [, desc, packSize, packUnitRaw, price] = embedded;
    const { brand, variant } = extractBrand(desc!.trim());
    const unit = normalizePackUnit(packUnitRaw!);
    return buildCatalogRow({
      brand,
      variant,
      itemType,
      packSize: packSize!,
      packUnit: unit,
      unitCostCents: Number(price) * 100,
    });
  }

  const sized = line.match(SIZE_PRICE_ROW);
  if (sized) {
    const [, desc, packSize, price] = sized;
    const descTrim = desc!.trim();
    if (/^(Min\.|minimum)/i.test(descTrim)) return null;
    const { brand, variant } = extractBrand(descTrim);
    return buildCatalogRow({
      brand,
      variant,
      itemType,
      packSize: packSize!,
      packUnit: defaultUnit,
      unitCostCents: Number(price) * 100,
    });
  }

  const priceOnly = line.match(PRICE_ONLY_ROW);
  if (priceOnly) {
    const [, desc, price] = priceOnly;
    const descTrim = desc!.trim();
    if (descTrim.split(/\s+/).length < 2) return null;
    const { brand, variant } = extractBrand(descTrim);
    return buildCatalogRow({
      brand,
      variant,
      itemType,
      unitCostCents: Number(price) * 100,
      notes: formatNotes({ Type: itemType }),
    });
  }

  return null;
}

export function parseWsPriceListText(text: string): ParsedCatalogRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const rows: ParsedCatalogRow[] = [];
  let itemType = "General";
  let defaultUnit = "kg";

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue;
    if (/^Min\.\s/i.test(line) && !/\d{2,}\s*$/.test(line)) continue;

    if (SECTION_LINE.test(line) || /Min\.\s*\d+/i.test(line)) {
      const section = normalizeSection(line);
      itemType = section.itemType;
      defaultUnit = section.defaultUnit;
      continue;
    }

    const row = parseDataLine(line, itemType, defaultUnit);
    if (row) rows.push(row);
  }

  return rows;
}
