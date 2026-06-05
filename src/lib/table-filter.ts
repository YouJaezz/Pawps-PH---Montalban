/** Join row fields into a single searchable string. */
export function rowSearchText(
  parts: (string | null | undefined | number)[],
): string {
  return parts
    .filter((p) => p != null && p !== "")
    .map(String)
    .join(" ");
}

/** Case-insensitive substring match; empty query matches everything. */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}
