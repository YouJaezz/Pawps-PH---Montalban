/** Fixed Pawps pricelist output schema (CSV + AI). */
export const PAWPS_CATALOG_TYPES = [
  "Dog Dry Food",
  "Dog Wet Food (Can)",
  "Dog Wet Food (Pouch)",
  "Cat Dry Food",
  "Cat Wet Food (Can)",
  "Cat Wet Food (Pouch)",
  "Cat Litter",
  "Dog Treats",
  "Cat Treats",
  "Tick & Flea",
  "Vitamins & Medicine",
  "Accessories",
  "Other",
] as const;

export type PawpsCatalogType = (typeof PAWPS_CATALOG_TYPES)[number];

export type PawpsNormalizedRow = {
  type: PawpsCatalogType | string;
  item: string;
  flavor: string | null;
  size: string | null;
  per_kg: number | null;
  wholesale: number;
  retail: number | null;
};

export type PawpsNormalizeAiResponse = {
  rows: PawpsNormalizedRow[];
};

export type NormalizeUploadFile = {
  name: string;
  mimeType: string;
  base64: string;
};

export const CSV_HEADERS = [
  "supplier",
  "type",
  "item",
  "flavor",
  "size",
  "per_kg",
  "wholesale",
  "retail",
] as const;
