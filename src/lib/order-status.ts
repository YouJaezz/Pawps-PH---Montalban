import { ORDER_STATUSES, type OrderStatus } from "@/db/schema";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  Pending: "Pending",
  Confirmed: "Confirmed",
  Preparing: "Preparing",
  "Out for Delivery": "Out for delivery",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  Pending: "border-zinc-300 bg-zinc-100 text-zinc-700",
  Confirmed: "border-sky-300 bg-sky-50 text-sky-800",
  Preparing: "border-amber-300 bg-amber-50 text-amber-900",
  "Out for Delivery": "border-violet-300 bg-violet-50 text-violet-800",
  Completed: "border-brand-cyan/50 bg-brand-blue/10 text-brand-blue",
  Cancelled: "border-red-300 bg-red-50 text-red-700",
};

/** Border accent for status selects */
export const ORDER_STATUS_SELECT_BORDER: Record<OrderStatus, string> = {
  Pending: "border-zinc-400",
  Confirmed: "border-sky-400",
  Preparing: "border-amber-400",
  "Out for Delivery": "border-violet-400",
  Completed: "border-brand-blue",
  Cancelled: "border-red-400",
};

export const STAFF_ORDER_STATUSES = ORDER_STATUSES.filter(
  (s) => s !== "Cancelled",
) as Exclude<OrderStatus, "Cancelled">[];

/** Map legacy DB values to current statuses. */
export function normalizeOrderStatus(raw: string): OrderStatus {
  if (raw === "Active") return "Confirmed";
  if ((ORDER_STATUS_LABELS as Record<string, string>)[raw]) {
    return raw as OrderStatus;
  }
  return "Pending";
}

export function isOrderOpen(status: OrderStatus) {
  return status !== "Completed" && status !== "Cancelled";
}
