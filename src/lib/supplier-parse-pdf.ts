import type { ParsedCatalogRow } from "@/lib/catalog-fields";
import { buildCatalogRow, formatNotes } from "@/lib/catalog-fields";

const SKIP_LINE =
  /^(?:--\s*\d+\s+of\s+\d+\s+--|\(\s*\)|FREE DELIVERY|Discounts Available|Prices are subject|OPEN FOR RESELLERS|BRANCH LOCATIONS|Bulk Discount)/i;

const TABLE_HEADER_LINE =
  /^(?:ITEM\s+VARIANT|SACK\s+1\s+BAG|PCS|MIN\.\s*\d+|MINIMUM\s+OF|UNIT\s+in|RETAIL|WHOLESALE|PER\s+PIECE|PRICE\s+PER)/i;

const SECTION_LABEL =
  /^(?:CAT FOOD|DOG FOOD|CANNED FOOD|TREATS|CAT LITTER|VITAMINS|TICK AND FLEA)$/i;

function itemTypeFromSection(label: string) {
  const u = label.toUpperCase();
  if (u.includes("DOG FOOD")) return "Dog Food";
  if (u.includes("CAT FOOD")) return "Cat Food";
  if (u.includes("CAT LITTER")) return "Cat Litter";
  if (u.includes("CANNED")) return "Canned Food";
  if (u.includes("TREAT")) return "Treats";
  if (u.includes("VITAMIN")) return "Medicine & Vitamins";
  if (u.includes("TICK")) return "Tick & Flea";
  return "General";
}

function itemTypeFromBrand(brand: string) {
  const u = brand.toUpperCase();
  if (/DOG/.test(u) && /CAN|POUCH/.test(u)) return "Dog Canned Food";
  if (/CAT/.test(u) && /CAN|POUCH/.test(u)) return "Cat Canned Food";
  if (/POUCH/.test(u)) return "Wet Food";
  if (/LITTER/.test(u)) return "Cat Litter";
  if (/NEXGARD|FRONTLINE|DETICK|TICK|FLEA/.test(u)) return "Tick & Flea";
  if (/VITAMIN|MILK|MEDICINE|PAPI|LC VIT|CANIBROM/.test(u)) return "Medicine & Vitamins";
  if (/DOG/.test(u) && /FOOD|DRY/.test(u)) return "Dog Food";
  if (/CAT/.test(u) && /FOOD|DRY/.test(u)) return "Cat Food";
  if (/TREAT|BISCUIT|JERHIGH|SAUSAGE/.test(u)) return "Treats";
  return "General";
}

/** Dry food rows: Variant UnitKg PerKilo Wholesale Retail */
const DRY_FOOD_ROW =
  /^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/;

/** Two-price rows (treats/pouches): Variant Retail WholesaleMin */
const TWO_PRICE_ROW = /^(.+?)\s+(\d+)\s+(\d+)\s*$/;

/** Cat litter: scent + liters + 4 tier prices */
const LITTER_FULL_ROW =
  /^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/;

/** Cat litter: scent + liters only (prices on next line) */
const LITTER_SCENT_ROW = /^(.+?)\s+(\d+(?:\.\d+)?)\s*$/;

/** Four bulk tier prices, optional trailing scent line */
const FOUR_TIER_PRICES = /^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*(.*)$/;

const COMPLETE_BRAND_SUFFIX =
  /(?:FOOD|POUCH|POUCHES|LITTER|TREATS|VITAMINS|BISCUIT|CAN)$/i;

const LITTER_BRAND_RESET = /^(?:BEST CLEAN|FELINE FRESH|MARIE|PRETTY|CUTIE ZOE|ABC CAT)$/i;

const INLINE_LITTER_BRANDS = ["CUTIE ZOE", "ABC CAT LITTER"] as const;

type PendingLitter = {
  brand: string;
  scent: string;
  liters: string;
};

function isMostlyUpper(line: string) {
  const letters = line.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 3) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length >= 0.75;
}

function shouldMergeBrandPart(currentBrand: string, addition: string) {
  if (COMPLETE_BRAND_SUFFIX.test(currentBrand.trim())) return false;
  // Standalone multi-word brands (e.g. FELINE FRESH) start a new header.
  if (addition.includes(" ") && addition.length > 8) return false;
  return (
    addition.length <= 12 &&
    addition === addition.toUpperCase() &&
    /^[A-Z\s]+$/.test(addition)
  );
}

function cleanScent(value: string) {
  return value.trim().replace(/,\s*$/, "");
}

function mergeBrandPart(prev: string, line: string) {
  const cleaned = line.replace(/\(\s*\)/g, "").trim();
  if (!prev) return cleaned;
  if (shouldMergeBrandPart(prev, cleaned)) {
    return `${prev} ${cleaned}`.replace(/\s+/g, " ").trim();
  }
  return cleaned;
}

function looksLikeBrand(line: string, mode: "standard" | "litter") {
  if (SKIP_LINE.test(line) || TABLE_HEADER_LINE.test(line)) return false;
  if (SECTION_LABEL.test(line)) return false;
  if (DRY_FOOD_ROW.test(line) || TWO_PRICE_ROW.test(line)) return false;
  if (LITTER_FULL_ROW.test(line) || FOUR_TIER_PRICES.test(line)) return false;
  if (line.startsWith("•")) return false;

  const upper = line.toUpperCase();
  const keywords =
    /FOOD|LITTER|CAN|TREAT|POUCH|VITAMIN|TICK|FLEA|BISCUIT|SAUSAGE|GELATO|CHEESECAKE|MILK|DETICK|NEXGARD|FRONTLINE|ROYAL CANIN|PEDIGREE|WHISKAS|JERHIGH|DOGGO|GOODEST|SPECIAL CAT|AOZI|TOP BREED|SMART HEART|ZOI CAT|FELINE|MARIE|CASSEY|CLEAN|FRESH|PREMIUM|PRETTY|CUTIE|ABC CAT|BEST CLEAN|FELINE FRESH/i;

  if (mode === "litter") {
    if (
      isMostlyUpper(line) &&
      line.length <= 24 &&
      !/\d{2,}/.test(line) &&
      keywords.test(upper)
    ) {
      return true;
    }
    if (
      line.length <= 12 &&
      line === upper &&
      /^[A-Z\s]+$/.test(line) &&
      !TABLE_HEADER_LINE.test(line)
    ) {
      return true;
    }
    return false;
  }

  if (keywords.test(upper) && isMostlyUpper(line.replace(/\(\s*\)/g, "").trim())) {
    return true;
  }

  if (line.length <= 12 && line === upper && /^[A-Z\s]+$/.test(line)) {
    return true;
  }

  return false;
}

function splitInlineLitterBrand(head: string, fallbackBrand: string) {
  const upper = head.toUpperCase();
  for (const brand of INLINE_LITTER_BRANDS) {
    if (upper.startsWith(brand)) {
      const scent = head.slice(brand.length).trim().replace(/^,\s*/, "");
      return { brand, scent };
    }
  }
  return { brand: fallbackBrand, scent: head.trim() };
}

function pushLitterRow(
  rows: ParsedCatalogRow[],
  brand: string,
  scent: string,
  liters: string,
  sack: number,
  oneBag: number,
  threeBags: number,
  ninetyBags: number,
) {
  const cleanBrand = brand.trim() || "Cat Litter";
  const flavor = cleanScent(scent);
  if (!flavor) return;

  rows.push({
    itemName: `${cleanBrand} — ${flavor}`,
    brand: cleanBrand,
    variant: flavor,
    unitCostCents: oneBag * 100,
    packSize: liters,
    packUnit: "L",
    notes: formatNotes({
      Sack: sack,
      "1 bag": oneBag,
      "3 bags": threeBags,
      "90 bags": ninetyBags,
    }),
  });
}

function parseTrailingScent(rest: string): PendingLitter | null {
  const trimmed = rest.trim();
  if (!trimmed) return null;
  const match = trimmed.match(LITTER_SCENT_ROW);
  if (!match) return null;
  return { brand: "", scent: match[1].trim(), liters: match[2] };
}

export function parseMayPriceListText(text: string): ParsedCatalogRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const rows: ParsedCatalogRow[] = [];
  let mode: "standard" | "litter" = "standard";
  let currentBrand = "";
  let pendingBrandPart = "";
  let pendingLitter: PendingLitter | null = null;
  let currentItemType = "General";
  let cannedBrand = "";
  let pendingBullets: string[] = [];

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue;
    if (SECTION_LABEL.test(line)) {
      if (/^CAT LITTER$/i.test(line) && mode === "litter") {
        mode = "standard";
        pendingLitter = null;
      }
      currentItemType = itemTypeFromSection(line);
      continue;
    }
    if (TABLE_HEADER_LINE.test(line)) {
      if (/^SACK\s+1\s+BAG/i.test(line)) {
        mode = "litter";
        currentBrand = "";
        pendingBrandPart = "";
        pendingLitter = null;
        currentItemType = "Cat Litter";
      }
      continue;
    }

    if (line.startsWith("•")) {
      pendingBullets.push(line.replace(/^•\s*/, "").trim());
      continue;
    }

    const cannedPrices = line.match(/^(\d+)\s+(\d+)\s+(\d+)\s*$/);
    if (cannedPrices && pendingBullets.length > 0) {
      const brand = cannedBrand || currentBrand || "Canned Food";
      const [, retail, min24, min72] = cannedPrices;
      for (const bullet of pendingBullets) {
        rows.push(
          buildCatalogRow({
            brand,
            variant: bullet,
            itemType: itemTypeFromBrand(brand) === "General" ? "Canned Food" : itemTypeFromBrand(brand),
            retailPriceCents: Number(retail) * 100,
            unitCostCents: Number(min72) * 100,
            notes: formatNotes({ "Min 24 pcs": min24, "Min 72 pcs": min72 }),
          }),
        );
      }
      pendingBullets = [];
      continue;
    }

    if (mode === "litter") {
      const fullLitter = line.match(LITTER_FULL_ROW);
      if (fullLitter) {
        const [, head, liters, p1, p2, p3, p4] = fullLitter;
        const { brand, scent } = splitInlineLitterBrand(head!, currentBrand);
        pushLitterRow(
          rows,
          brand,
          scent,
          liters!,
          Number(p1),
          Number(p2),
          Number(p3),
          Number(p4),
        );
        pendingLitter = null;
        continue;
      }

      const tierMatch = line.match(FOUR_TIER_PRICES);
      if (tierMatch) {
        const [, s, b1, b3, b90, rest] = tierMatch;
        const prices = [Number(s), Number(b1), Number(b3), Number(b90)] as const;

        if (pendingLitter?.scent) {
          pushLitterRow(
            rows,
            pendingLitter.brand || currentBrand,
            pendingLitter.scent,
            pendingLitter.liters,
            ...prices,
          );
          pendingLitter = null;
        }

        const trailing = parseTrailingScent(rest ?? "");
        if (trailing) {
          pendingLitter = {
            brand: currentBrand,
            scent: trailing.scent,
            liters: trailing.liters,
          };
        }
        continue;
      }

      const scentOnly = line.match(LITTER_SCENT_ROW);
      if (scentOnly && !DRY_FOOD_ROW.test(line)) {
        pendingLitter = {
          brand: currentBrand,
          scent: scentOnly[1].trim(),
          liters: scentOnly[2],
        };
        continue;
      }

      if (looksLikeBrand(line, "litter")) {
        const cleaned = line.replace(/\(\s*\)/g, "").trim();
        if (LITTER_BRAND_RESET.test(cleaned)) {
          currentBrand = cleaned;
          pendingBrandPart = "";
        } else if (pendingBrandPart) {
          currentBrand = mergeBrandPart(pendingBrandPart, cleaned);
          pendingBrandPart = "";
        } else if (currentBrand && shouldMergeBrandPart(currentBrand, cleaned)) {
          currentBrand = mergeBrandPart(currentBrand, cleaned);
        } else {
          currentBrand = cleaned;
        }
        pendingLitter = null;
        continue;
      }

      if (
        isMostlyUpper(line) &&
        line.length <= 20 &&
        !/\d/.test(line) &&
        !TABLE_HEADER_LINE.test(line)
      ) {
        if (pendingBrandPart) {
          currentBrand = mergeBrandPart(pendingBrandPart, line);
          pendingBrandPart = "";
        } else if (currentBrand && shouldMergeBrandPart(currentBrand, line)) {
          currentBrand = mergeBrandPart(currentBrand, line);
        } else {
          pendingBrandPart = line;
        }
        continue;
      }

      continue;
    }

    const dryMatch = line.match(DRY_FOOD_ROW);
    if (dryMatch) {
      const [, variant, unitKg, perKilo, wholesale, retail] = dryMatch;
      const brand = currentBrand || "General";
      rows.push({
        itemName: `${brand} — ${variant.trim()}`,
        brand,
        variant: variant.trim(),
        unitCostCents: Number(wholesale) * 100,
        packSize: unitKg,
        packUnit: "kg",
        perKiloCents: Number(perKilo) * 100,
        retailPriceCents: Number(retail) * 100,
        notes: formatNotes({ Wholesale: wholesale }),
      });
      continue;
    }

    const twoMatch = line.match(TWO_PRICE_ROW);
    if (twoMatch && currentBrand) {
      const [, variant, retail, wholesaleMin] = twoMatch;
      if (variant.length > 1 && !/^\d+$/.test(variant)) {
        rows.push({
          itemName: `${currentBrand} — ${variant.trim()}`,
          brand: currentBrand,
          variant: variant.trim(),
          unitCostCents: Number(wholesaleMin) * 100,
          retailPriceCents: Number(retail) * 100,
          notes: formatNotes({ "Min wholesale": wholesaleMin }),
        });
        continue;
      }
    }

    if (looksLikeBrand(line, "standard")) {
      const cleaned = line.replace(/\(\s*\)/g, "").trim();
      if (pendingBrandPart) {
        currentBrand = mergeBrandPart(pendingBrandPart, cleaned);
        pendingBrandPart = "";
      } else if (currentBrand && shouldMergeBrandPart(currentBrand, cleaned)) {
        currentBrand = mergeBrandPart(currentBrand, cleaned);
      } else {
        currentBrand = cleaned;
      }
      if (/CAN|POUCH/i.test(currentBrand)) {
        cannedBrand = currentBrand;
        pendingBullets = [];
      }
      continue;
    }

    if (
      line.length <= 12 &&
      line === line.toUpperCase() &&
      /^[A-Z\s]+$/.test(line) &&
      currentBrand &&
      shouldMergeBrandPart(currentBrand, line)
    ) {
      currentBrand = mergeBrandPart(currentBrand, line);
      continue;
    }

    if (isMostlyUpper(line) && line.length < 40 && !line.match(/\d{3,}/)) {
      pendingBrandPart = pendingBrandPart
        ? `${pendingBrandPart} ${line}`
        : line;
    }
  }

  return rows.map((row) => ({
    ...row,
    itemType:
      row.itemType ||
      itemTypeFromBrand(row.brand ?? "") ||
      currentItemType ||
      "General",
  }));
}

/** @deprecated use parseMayPriceListText */
export function parsePdfPriceListText(text: string): ParsedCatalogRow[] {
  return parseMayPriceListText(text);
}
