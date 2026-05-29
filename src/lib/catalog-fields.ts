/** Shared catalog row shape for all supplier file formats. */
export type ParsedCatalogRow = {
  itemName: string;
  brand?: string;
  productName?: string;
  variant?: string;
  itemType?: string;
  sku?: string;
  unitCostCents?: number;
  packSize?: string;
  packUnit?: string;
  perKiloCents?: number;
  retailPriceCents?: number;
  notes?: string;
};

export const KNOWN_BRANDS_WS = [
  "Smart Heart",
  "Special Dog",
  "Special Cat",
  "Top Breed",
  "Valuemeal",
  "Value Meal",
  "Vitality",
  "Whoopy",
  "Good boy",
  "Good Boy",
  "Nutrichunks",
  "Beef Teriyaki",
  "Beefpro",
  "Beef Pro",
  "Pedigree",
  "Zoi Dog",
  "Zoi Cat",
  "Goodest",
  "Yum Yum",
  "Holistic",
  "Aozi",
  "Doggo",
  "Doggy Joy",
  "Bingo",
  "Dear Kat",
  "Whiskas",
  "Powercat",
  "Monello Cat",
  "Monello",
  "Cuties",
  "Infinity",
  "Princess Cat",
  "Toei Cat",
  "Nutricare",
  "Majesty",
  "Pet yum",
  "Pet Yum",
  "Freya",
  "Purreetty",
  "Pureetty",
  "Feline Fresh",
  "Marie Premuim",
  "Marie Premium",
  "Ichi & Co.",
  "Kitty Elite",
  "Brit premuim",
  "Brit premium",
  "Kitcat",
  "Kit Cat",
  "Jerhigh",
  "Denta Styx",
  "Frieskies",
  "Friskies",
  "Ciao Pouch",
  "Cosi",
  "Lc Vit",
  "Lc Scour",
  "Canibrom",
  "Papi Ob",
  "Papi Mvp",
  "Dextrose Powder",
  "Mondex",
  "Detick",
  "Nematocide",
  "AOZI",
  "AOZI DOG",
  "AOZI CAT",
  "SPECIAL CAT",
  "SPECIAL DOG",
  "TOP BREED",
  "GOODEST",
  "ABC",
] as const;

/** Longest match first (case-insensitive prefix). */
export function extractBrand(description: string): {
  brand: string;
  variant: string;
} {
  const trimmed = description.trim();
  const lower = trimmed.toLowerCase();

  const sorted = [...KNOWN_BRANDS_WS].sort((a, b) => b.length - a.length);
  for (const candidate of sorted) {
    if (lower.startsWith(candidate.toLowerCase())) {
      const variant = trimmed.slice(candidate.length).trim();
      return {
        brand: normalizeBrandLabel(candidate),
        variant: variant || trimmed,
      };
    }
  }

  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return {
      brand: words[0],
      variant: words.slice(1).join(" "),
    };
  }

  return { brand: trimmed, variant: trimmed };
}

function normalizeBrandLabel(raw: string) {
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .replace(/\bAozi\b/i, "Aozi")
    .replace(/\bZoi\b/i, "Zoi");
}

export function buildCatalogRow(fields: {
  brand: string;
  variant: string;
  itemType: string;
  packSize?: string;
  packUnit?: string;
  unitCostCents?: number;
  retailPriceCents?: number;
  perKiloCents?: number;
  notes?: string;
}): ParsedCatalogRow {
  const brand = fields.brand.trim();
  const variant = fields.variant.trim();
  const productName = variant || brand;
  const itemName = variant && brand.toLowerCase() !== variant.toLowerCase()
    ? `${brand} — ${variant}`
    : brand;

  return {
    itemName,
    brand,
    productName,
    variant: variant || undefined,
    itemType: fields.itemType,
    unitCostCents: fields.unitCostCents,
    retailPriceCents: fields.retailPriceCents,
    packSize: fields.packSize,
    packUnit: fields.packUnit,
    perKiloCents: fields.perKiloCents,
    notes: fields.notes,
  };
}

export function formatNotes(parts: Record<string, string | number | undefined>) {
  return Object.entries(parts)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join(" | ");
}

export function detectPdfFormat(text: string): "ws" | "may" {
  if (/WS\s+PRICELIST/i.test(text)) return "ws";
  if (/ITEM\s+DESCRIPTION\s+UNITS\s+PRICE/i.test(text)) return "ws";
  if (/ITEM\s+PRODUCT\s+IMAGE/i.test(text)) return "may";
  if (/PER\s+KILO\s+WHOLESALE\s+RETAIL/i.test(text)) return "may";
  return "may";
}
