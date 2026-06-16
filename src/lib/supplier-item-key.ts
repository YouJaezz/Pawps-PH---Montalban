/** Normalize flavor text so "Lamb and Rice" matches "Rice & Lamb". */
export function normalizeFlavorKey(variant: string | null | undefined) {
  const raw = (variant ?? "").trim().toLowerCase();
  if (!raw) return "";

  const tokens = raw
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && t !== "and");

  return [...new Set(tokens)].sort().join(" ");
}

/** Stable key to match the same product across price list uploads. */
export function catalogItemKey(input: {
  brand?: string | null;
  variant?: string | null;
  itemName?: string | null;
}) {
  const brand = (input.brand ?? "").trim().toLowerCase();
  const itemName = (input.itemName ?? "").trim().toLowerCase();
  const flavor = normalizeFlavorKey(input.variant);

  if (brand && flavor) return `${brand}|${flavor}`;
  if (brand && itemName) return `${brand}|${itemName}`;
  if (flavor) return flavor;
  return itemName;
}

export function percentChange(oldCents: number | null, newCents: number | null) {
  if (oldCents == null || newCents == null || oldCents === 0) return null;
  return ((newCents - oldCents) / oldCents) * 100;
}
