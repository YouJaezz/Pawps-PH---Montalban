/** Stable key to match the same product across price list uploads. */
export function catalogItemKey(input: {
  brand?: string | null;
  variant?: string | null;
  itemName?: string | null;
}) {
  const brand = (input.brand ?? "").trim().toLowerCase();
  const variant = (input.variant ?? "").trim().toLowerCase();
  if (brand && variant) return `${brand}|${variant}`;
  return (input.itemName ?? "").trim().toLowerCase();
}

export function percentChange(oldCents: number | null, newCents: number | null) {
  if (oldCents == null || newCents == null || oldCents === 0) return null;
  return ((newCents - oldCents) / oldCents) * 100;
}
