/** Order-level discount helpers (subtotal → net total). */

export const DISCOUNT_TYPES = ["None", "Fixed", "Percent"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export type DiscountInput = {
  type: DiscountType;
  /** Fixed: centavos. Percent: whole percent (e.g. 10 = 10%). */
  value: number;
};

export function parseDiscountType(raw: string | null | undefined): DiscountType {
  const t = (raw ?? "").trim();
  if (t === "Fixed" || t === "Percent") return t;
  return "None";
}

export function parseDiscountFromForm(formData: FormData): DiscountInput {
  const type = parseDiscountType(String(formData.get("discountType") ?? ""));
  if (type === "None") return { type: "None", value: 0 };

  if (type === "Fixed") {
    const pesos = Number(String(formData.get("discountValue") ?? "").trim());
    if (!Number.isFinite(pesos) || pesos <= 0) return { type: "None", value: 0 };
    return { type: "Fixed", value: Math.round(pesos * 100) };
  }

  const pct = Number(String(formData.get("discountValue") ?? "").trim());
  if (!Number.isFinite(pct) || pct <= 0) return { type: "None", value: 0 };
  return { type: "Percent", value: Math.min(100, Math.round(pct)) };
}

export function computeDiscountCents(
  subtotalCents: number,
  input: DiscountInput,
): number {
  if (subtotalCents <= 0 || input.type === "None" || input.value <= 0) return 0;

  if (input.type === "Fixed") {
    return Math.min(subtotalCents, Math.max(0, input.value));
  }

  const pct = Math.min(100, Math.max(0, input.value));
  return Math.min(subtotalCents, Math.round((subtotalCents * pct) / 100));
}

export function orderTotalsFromSubtotal(
  subtotalCents: number,
  input: DiscountInput,
) {
  const discountCents = computeDiscountCents(subtotalCents, input);
  const totalAmount = Math.max(0, subtotalCents - discountCents);
  return { subtotalCents, discountCents, totalAmount };
}

export function discountSummaryLabel(
  type: DiscountType,
  value: number,
  discountCents: number,
) {
  if (type === "None" || discountCents <= 0) return null;
  if (type === "Percent") return `${value}% off`;
  return `₱${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)} off`;
}

export function paymentStatusFor(totalAmount: number, amountPaid: number) {
  if (amountPaid >= totalAmount) return "Paid" as const;
  if (amountPaid >= Math.round(totalAmount * 0.3)) return "30% Deposit" as const;
  return "Pending" as const;
}
