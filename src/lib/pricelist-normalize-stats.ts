import type { PawpsNormalizedRow } from "@/lib/pricelist-normalize-types";

export type NormalizeStats = {
  totalItems: number;
  typesCount: number;
  withWholesale: number;
  withRetail: number;
  avgWholesale: number | null;
};

export function computeNormalizeStats(
  rows: PawpsNormalizedRow[],
): NormalizeStats {
  const types = new Set(rows.map((r) => r.type));
  const withWholesale = rows.filter((r) => r.wholesale != null).length;
  const withRetail = rows.filter((r) => r.retail != null).length;
  const wsSum = rows.reduce((s, r) => s + (r.wholesale ?? 0), 0);

  return {
    totalItems: rows.length,
    typesCount: types.size,
    withWholesale,
    withRetail,
    avgWholesale: rows.length > 0 ? wsSum / rows.length : null,
  };
}
