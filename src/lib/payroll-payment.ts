import { phNow } from "@/lib/ph-time";

export const PAYMENT_METHODS = [
  "cash",
  "gcash",
  "bank_transfer",
  "check",
  "other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function paymentMethodLabel(method: string | null | undefined) {
  switch (method) {
    case "cash":
      return "Cash";
    case "gcash":
      return "GCash";
    case "bank_transfer":
      return "Bank transfer";
    case "check":
      return "Check";
    case "other":
      return "Other";
    default:
      return "—";
  }
}

export function normalizePaymentMethod(
  raw: string | null | undefined,
): PaymentMethod | null {
  if (raw && PAYMENT_METHODS.includes(raw as PaymentMethod)) {
    return raw as PaymentMethod;
  }
  return null;
}

export function payrollStatusLabel(
  status: "Open" | "Projected" | "Accrued" | "Paid",
) {
  switch (status) {
    case "Open":
      return "Unlocked";
    case "Projected":
      return "In progress";
    case "Accrued":
      return "Awaiting payment";
    case "Paid":
      return "Paid";
  }
}

export function phDateInputValue(date = phNow()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

export function parsePhDateInput(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T12:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatPaymentSummary(props: {
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
}) {
  const parts: string[] = [];
  if (props.paymentMethod) {
    parts.push(paymentMethodLabel(props.paymentMethod));
  }
  if (props.paymentReference?.trim()) {
    parts.push(`Ref ${props.paymentReference.trim()}`);
  }
  if (props.notes?.trim()) {
    parts.push(props.notes.trim());
  }
  return parts.join(" · ") || null;
}
