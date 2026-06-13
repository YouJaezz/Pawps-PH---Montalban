export function formatPhpFromCents(cents: number) {
  const pesos = cents / 100;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(pesos);
}

export function parseMoneyToCents(value: FormDataEntryValue | null | string) {
  const str = typeof value === "string" ? value.trim() : "";
  if (!str) return 0;
  const n = Number(str.replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}
