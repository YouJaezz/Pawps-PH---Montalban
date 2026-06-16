/** Canonical item categories for supplier catalog and inventory. */
export const CATALOG_ITEM_TYPES = [
  { value: "Dog Dry Food", label: "Dog Dry Food (sack/kg)" },
  { value: "Cat Dry Food", label: "Cat Dry Food (sack/kg)" },
  { value: "Dog Wet Food (Can)", label: "Dog Wet Food — Can" },
  { value: "Cat Wet Food (Can)", label: "Cat Wet Food — Can" },
  { value: "Dog Wet Food (Pouch)", label: "Dog Wet Food — Pouch" },
  { value: "Cat Wet Food (Pouch)", label: "Cat Wet Food — Pouch" },
  { value: "Dog Treats", label: "Dog Treats" },
  { value: "Cat Treats", label: "Cat Treats" },
  { value: "Toys", label: "Toys & Accessories" },
  { value: "Cat Litter", label: "Cat Litter (per sack)" },
  { value: "Medicine & Vitamins", label: "Medicine & Vitamins" },
  { value: "Other", label: "Other" },
] as const;

/** Visual groups for item-type pickers in forms. */
export const CATALOG_ITEM_TYPE_GROUPS = [
  {
    label: "Dry food",
    types: CATALOG_ITEM_TYPES.filter((t) => t.value.includes("Dry Food")),
  },
  {
    label: "Wet food",
    types: CATALOG_ITEM_TYPES.filter(
      (t) => t.value.includes("Wet Food") || t.value.includes("Can") || t.value.includes("Pouch"),
    ),
  },
  {
    label: "Treats & extras",
    types: CATALOG_ITEM_TYPES.filter(
      (t) =>
        t.value.includes("Treats") ||
        t.value === "Toys" ||
        t.value === "Cat Litter" ||
        t.value === "Medicine & Vitamins" ||
        t.value === "Other",
    ),
  },
] as const;

export type CatalogItemTypeValue = (typeof CATALOG_ITEM_TYPES)[number]["value"];

const TYPE_VALUE_SET = new Set<string>(CATALOG_ITEM_TYPES.map((t) => t.value));

/** Map legacy/parser labels to our canonical types. */
export function normalizeCatalogItemType(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "Other";
  if (TYPE_VALUE_SET.has(t)) return t;

  const lower = t.toLowerCase();
  if (lower.includes("toy") || lower.includes("accessory")) return "Toys";
  if (lower.includes("litter")) return "Cat Litter";
  if (lower.includes("medicine") || lower.includes("vitamin")) {
    return "Medicine & Vitamins";
  }
  if (lower.includes("dog") && (lower.includes("can") || lower.includes("canned"))) {
    return "Dog Wet Food (Can)";
  }
  if (lower.includes("cat") && (lower.includes("can") || lower.includes("canned"))) {
    return "Cat Wet Food (Can)";
  }
  if (lower.includes("dog") && lower.includes("pouch")) return "Dog Wet Food (Pouch)";
  if (lower.includes("cat") && lower.includes("pouch")) return "Cat Wet Food (Pouch)";
  if (lower.includes("dog") && lower.includes("treat")) return "Dog Treats";
  if (lower.includes("cat") && lower.includes("treat")) return "Cat Treats";
  if (lower.includes("dog") && lower.includes("food")) return "Dog Dry Food";
  if (lower.includes("cat") && lower.includes("food")) return "Cat Dry Food";

  return "Other";
}

export function isCatLitterItemType(raw: string | null | undefined) {
  return normalizeCatalogItemType(raw) === "Cat Litter";
}

export function displayCatalogItemType(raw: string | null | undefined) {
  const normalized = normalizeCatalogItemType(raw);
  return (
    CATALOG_ITEM_TYPES.find((t) => t.value === normalized)?.label ??
    normalized
  );
}

export function isValidCatalogItemType(value: string) {
  return TYPE_VALUE_SET.has(value);
}

/** Suggest default price unit from item type. */
export function defaultPriceUnitForItemType(itemType: string | null | undefined) {
  const t = normalizeCatalogItemType(itemType).toLowerCase();
  if (t.includes("dry food")) return "Sack" as const;
  if (t.includes("can") || t.includes("pouch") || t.includes("treat") || t === "toys") {
    return "Piece" as const;
  }
  if (t.includes("litter")) return "Sack" as const;
  return "Piece" as const;
}

/** Hint text for the Size field in supplier forms. */
export function packSizeHintForItemType(itemType: string | null | undefined) {
  const t = normalizeCatalogItemType(itemType).toLowerCase();
  if (t.includes("litter")) {
    return "Pack size — volume per sack (e.g. 10 in L, or 7 in kg for reference)";
  }
  if (t.includes("dry food") || t.includes("litter")) {
    return "Pack size — weight per sack (e.g. 7 in kg, 20 in kg)";
  }
  if (t.includes("can") || t.includes("pouch") || t.includes("treat")) {
    return "Pack size — net weight per piece (e.g. 400 in g, 85 in g)";
  }
  if (t === "toys") return "Pack size — optional (e.g. 1 pc, medium)";
  return "Pack size — number + unit (7 kg, 400 g, 10 L)";
}

export function defaultPackUnitForItemType(itemType: string | null | undefined) {
  const t = normalizeCatalogItemType(itemType).toLowerCase();
  if (t.includes("dry food") || t.includes("litter")) return "kg";
  if (t.includes("can") || t.includes("pouch") || t.includes("treat")) return "g";
  if (t.includes("medicine")) return "ml";
  return "kg";
}
