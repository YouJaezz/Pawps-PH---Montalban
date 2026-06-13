import { sql } from "drizzle-orm";

import { orders } from "@/db/schema";
import { PH_TIMEZONE } from "@/lib/ph-time";

/** Values below this are Unix seconds; at/above are milliseconds. */
export const ORDER_TIMESTAMP_MS_THRESHOLD = 1_000_000_000_000;

export function normalizeOrderCreatedAt(
  raw: Date | number | string | null | undefined,
): Date {
  if (raw == null) return new Date(0);
  if (raw instanceof Date) {
    const ms = raw.getTime();
    if (ms > 0 && ms < ORDER_TIMESTAMP_MS_THRESHOLD) return new Date(ms * 1000);
    return raw;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return new Date(String(raw));
  if (n > 0 && n < ORDER_TIMESTAMP_MS_THRESHOLD) return new Date(n * 1000);
  return new Date(n);
}

export function orderCreatedMsColumn() {
  return sql<number>`CASE WHEN ${orders.createdAt} < ${ORDER_TIMESTAMP_MS_THRESHOLD} THEN ${orders.createdAt} * 1000 ELSE ${orders.createdAt} END`;
}

export function formatOrderWhen(iso: string | Date) {
  const d = normalizeOrderCreatedAt(iso);
  const now = new Date();
  const sameYear =
    d.toLocaleString("en-CA", { timeZone: PH_TIMEZONE, year: "numeric" }) ===
    now.toLocaleString("en-CA", { timeZone: PH_TIMEZONE, year: "numeric" });

  return d.toLocaleString("en-PH", {
    timeZone: PH_TIMEZONE,
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatOrderWhenLong(iso: string | Date) {
  const d = normalizeOrderCreatedAt(iso);
  return d.toLocaleString("en-PH", {
    timeZone: PH_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
