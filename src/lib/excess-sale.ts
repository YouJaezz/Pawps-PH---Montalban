export const EXCESS_QTY_PRESETS = [
  "¼ sack surplus",
  "½ sack surplus",
  "¼ kg surplus",
  "½ kg surplus",
  "Custom",
] as const;

export function buildExcessLineNote(qtyLabel: string, extraNote?: string | null) {
  const base = `Excess/bonus stock — ${qtyLabel} — no inventory deduction · 100% profit`;
  const extra = extraNote?.trim();
  return extra ? `${base} · ${extra}` : base;
}

export function excessLineLabel(productName: string, qtyLabel: string) {
  return `${productName} (${qtyLabel})`;
}
