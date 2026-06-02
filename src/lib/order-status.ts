import type { OrderStatus } from "@/db/schema";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  Pending: "Pending",
  Confirmed: "Confirmed",
  Preparing: "Preparing",
  "Out for Delivery": "Out for delivery",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  Pending: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  Confirmed: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  Preparing: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  "Out for Delivery": "border-violet-500/30 bg-violet-500/10 text-violet-200",
  Completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  Cancelled: "border-red-500/30 bg-red-500/10 text-red-300",
};

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
