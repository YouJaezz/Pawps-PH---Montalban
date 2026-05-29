/** Merge structured DB fields with legacy note strings from older PDF imports. */
export type CatalogItemDetails = {
  packSize: string | null;
  packUnit: string | null;
  perKiloPrice: number | null;
  retailPrice: number | null;
};

const GARBAGE_BRAND_PREFIX =
  /^SACK\s+(?:1\s+)?BAG(?:\s+3\s+BAGS)?(?:\s+30\s+BAGS)?(?:\s+90\s+BAGS)?\s*/i;

const KNOWN_LITTER_BRANDS = [
  "BEST CLEAN",
  "FELINE FRESH",
  "MARIE PREMIUM",
  "PRETTY CASSEY",
  "CUTIE ZOE",
  "ABC CAT LITTER",
] as const;

const BRAND_DISPLAY_RULES: Array<{ match: RegExp; label: string }> = [
  { match: /^WHISKAS\s+CAT\s+FOOD$/i, label: "Whiskas" },
  { match: /^WHISKAS\s+POUCH$/i, label: "Whiskas Pouch" },
  { match: /^ZOI\s+CAT$/i, label: "Zoi Cat" },
  { match: /^PEDIGREE\s+POUCH/i, label: "Pedigree Pouch" },
  { match: /^PEDIGREE\s+DOG/i, label: "Pedigree" },
  { match: /^ROYAL CANIN/i, label: "Royal Canin" },
  { match: /^SPECIAL CAT/i, label: "Special Cat" },
  { match: /^TOP BREED/i, label: "Top Breed" },
  { match: /^GOODEST/i, label: "Goodest" },
  { match: /^AOZI/i, label: "Aozi" },
  { match: /^BEST CLEAN$/i, label: "Best Clean" },
  { match: /^FELINE FRESH$/i, label: "Feline Fresh" },
  { match: /^MARIE PREMIUM$/i, label: "Marie Premium" },
  { match: /^PRETTY CASSEY$/i, label: "Pretty Cassey" },
  { match: /^CUTIE ZOE$/i, label: "Cutie Zoe" },
  { match: /^ABC CAT LITTER$/i, label: "ABC Cat Litter" },
];

function pesosFromNotes(notes: string, label: string) {
  const match = notes.match(new RegExp(`${label}:\\s*(\\d+(?:\\.\\d+)?)`, "i"));
  if (!match) return null;
  return Math.round(Number(match[1]) * 100);
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function stripGarbageBrand(raw: string) {
  let cleaned = raw.replace(GARBAGE_BRAND_PREFIX, "").trim();
  const upper = cleaned.toUpperCase();

  for (const litterBrand of KNOWN_LITTER_BRANDS) {
    const idx = upper.indexOf(litterBrand);
    if (idx >= 0) {
      cleaned = cleaned.slice(idx).trim();
      break;
    }
  }

  return cleaned;
}

export function displayCatalogItem(
  brand: string | null | undefined,
  itemName: string,
): string {
  const raw = stripGarbageBrand(
    brand?.trim() || itemName.split(" — ")[0]?.trim() || itemName,
  );

  for (const rule of BRAND_DISPLAY_RULES) {
    if (rule.match.test(raw)) return rule.label;
  }

  return toTitleCase(raw);
}

export function displayCatalogFlavor(
  variant: string | null | undefined,
  itemName: string,
): string {
  const flavor =
    variant?.trim() ||
    itemName.split(" — ").slice(1).join(" — ").trim() ||
    "";

  if (!flavor) return "—";

  // Strip trailing pack size accidentally merged into flavor (e.g. "Tuna 7")
  const withoutSize = flavor.replace(/\s+\d+(?:\.\d+)?\s*$/, "").trim();
  return withoutSize || flavor;
}

export function resolveCatalogItemDetails(row: {
  packSize?: string | null;
  packUnit?: string | null;
  perKiloPrice?: number | null;
  retailPrice?: number | null;
  notes?: string | null;
}): CatalogItemDetails {
  const hasStructured =
    row.packSize != null ||
    row.perKiloPrice != null ||
    row.retailPrice != null;

  if (hasStructured) {
    return {
      packSize: row.packSize ?? null,
      packUnit: row.packUnit ?? null,
      perKiloPrice: row.perKiloPrice ?? null,
      retailPrice: row.retailPrice ?? null,
    };
  }

  const notes = row.notes ?? "";
  if (!notes) {
    return {
      packSize: null,
      packUnit: null,
      perKiloPrice: null,
      retailPrice: null,
    };
  }

  const packSize =
    notes.match(/Unit \(kg\):\s*([\d.]+)/i)?.[1] ??
    notes.match(/Unit:\s*([\d.]+)/i)?.[1] ??
    null;

  return {
    packSize,
    packUnit: packSize ? "kg" : null,
    perKiloPrice: pesosFromNotes(notes, "Per kilo"),
    retailPrice: pesosFromNotes(notes, "Retail"),
  };
}

export function formatPackLabel(packSize: string | null, packUnit: string | null) {
  if (!packSize) return "—";
  if (packUnit?.toLowerCase() === "l") return `${packSize} L`;
  if (packUnit?.toLowerCase() === "kg") return `${packSize} kg`;
  return packUnit ? `${packSize} ${packUnit}` : packSize;
}

export function formatBulkTierNote(notes: string | null | undefined) {
  if (!notes) return null;
  const sack = notes.match(/Sack:\s*(\d+)/i)?.[1];
  const oneBag = notes.match(/1 bag:\s*(\d+)/i)?.[1];
  const threeBags = notes.match(/3 bags:\s*(\d+)/i)?.[1];
  const ninetyBags = notes.match(/90 bags:\s*(\d+)/i)?.[1];

  if (!sack && !oneBag) return null;

  const parts = [
    sack ? `Sack ₱${sack}` : null,
    oneBag ? `1 bag ₱${oneBag}` : null,
    threeBags ? `3 bags ₱${threeBags}` : null,
    ninetyBags ? `90 bags ₱${ninetyBags}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : null;
}

export function formatMoneyOrDash(cents: number | null | undefined) {
  if (cents == null) return "—";
  const pesos = cents / 100;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: pesos % 1 === 0 ? 0 : 2,
  }).format(pesos);
}
