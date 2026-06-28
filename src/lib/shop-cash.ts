import type { ShopExpenseCategory } from "@/db/schema";
import { phDateInputValue } from "@/lib/payroll-payment";

export function expenseCategoryLabel(category: string | null | undefined) {
  switch (category) {
    case "utilities_electric":
      return "Electric bill";
    case "utilities_water":
      return "Water bill";
    case "utilities_internet":
      return "Internet / phone";
    case "rent":
      return "Rent";
    case "supplies":
      return "Shop supplies";
    case "maintenance":
      return "Maintenance & repairs";
    case "transport":
      return "Transport / delivery";
    case "taxes_fees":
      return "Taxes & fees";
    case "other":
      return "Other expense";
    default:
      return "Expense";
  }
}

export function outflowKindLabel(kind: "expense" | "restock") {
  return kind === "restock" ? "Restock purchase" : "Operating expense";
}

export function normalizeExpenseCategory(
  raw: string | null | undefined,
): ShopExpenseCategory {
  const allowed = [
    "utilities_electric",
    "utilities_water",
    "utilities_internet",
    "rent",
    "supplies",
    "maintenance",
    "transport",
    "taxes_fees",
    "other",
  ] as const;
  if (raw && (allowed as readonly string[]).includes(raw)) {
    return raw as ShopExpenseCategory;
  }
  return "other";
}

export { phDateInputValue as shopCashDateInputValue };
