import { sql, type AnyColumn } from "drizzle-orm";

import { orders } from "@/db/schema";
import { PH_TIMEZONE } from "@/lib/ph-time";

/** Values below this are Unix seconds; at/above are milliseconds. */
export const ORDER_TIMESTAMP_MS_THRESHOLD = 1_000_000_000_000;

/**
 * Values at/above this (when treated as ms) are ~year 5138+.
 * Real shop data through the 2030s stays well below this — catches double ×1000 fixes.
 */
export const ORDER_TIMESTAMP_ABSURD_MS = 100_000_000_000_000;

/** Earliest sensible order timestamp (2020-01-01 UTC). */
export const ORDER_TIMESTAMP_MIN_MS = 1_577_836_800_000;

function rawToMs(raw: Date | number | string): number {
  if (raw instanceof Date) return raw.getTime();
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  return new Date(String(raw)).getTime();
}

/** Convert legacy / corrupted stored values to epoch milliseconds. */
export function normalizeOrderTimestampMs(
  raw: Date | number | string | null | undefined,
): number {
  if (raw == null) return 0;

  let ms = rawToMs(raw);
  if (!Number.isFinite(ms) || ms <= 0) return 0;

  // Unix seconds (e.g. 1730000000 for 2024)
  if (ms < ORDER_TIMESTAMP_MS_THRESHOLD) {
    ms *= 1000;
  }

  // Undo accidental double/triple ×1000 migrations (shows as year 50417+)
  let guard = 0;
  while (ms >= ORDER_TIMESTAMP_ABSURD_MS && guard < 4) {
    ms = Math.round(ms / 1000);
    guard += 1;
  }

  return ms;
}

export function normalizeOrderCreatedAt(
  raw: Date | number | string | null | undefined,
): Date {
  return new Date(normalizeOrderTimestampMs(raw));
}

/** SQL expression matching normalizeOrderTimestampMs for ORDER BY / filters. */
export function timestampMsColumn(column: AnyColumn) {
  return sql<number>`CASE
    WHEN ${column} >= ${ORDER_TIMESTAMP_ABSURD_MS} THEN CAST(${column} / 1000 AS INTEGER)
    WHEN ${column} > 0 AND ${column} < ${ORDER_TIMESTAMP_MS_THRESHOLD} THEN ${column} * 1000
    ELSE ${column}
  END`;
}

/** SQL expression matching normalizeOrderTimestampMs for orders.createdAt. */
export function orderCreatedMsColumn() {
  return timestampMsColumn(orders.createdAt);
}

function formatWithParts(d: Date, includeYear: boolean) {
  const parts = new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIMEZONE,
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const month = pick("month");
  const day = pick("day");
  const hour = pick("hour");
  const minute = pick("minute");
  const dayPeriod = pick("dayPeriod");
  const time = `${hour}:${minute} ${dayPeriod}`.trim();

  if (includeYear) {
    return `${month} ${day}, ${pick("year")} · ${time}`;
  }
  return `${month} ${day} · ${time}`;
}

export function formatOrderWhen(iso: string | Date) {
  const d = normalizeOrderCreatedAt(iso);
  const year = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: PH_TIMEZONE,
      year: "numeric",
    }).format(d),
  );
  const nowYear = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: PH_TIMEZONE,
      year: "numeric",
    }).format(new Date()),
  );
  return formatWithParts(d, year !== nowYear);
}

export function formatOrderWhenLong(iso: string | Date) {
  return formatWithParts(normalizeOrderCreatedAt(iso), true);
}
