import { cache } from "react";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { normalizeOrderCreatedAt, orderCreatedMsColumn } from "@/lib/order-timestamp";
import { normalizeOrderStatus } from "@/lib/order-status";
import {
  phDayBounds,
  phDayLabel,
  phDaysBetween,
  phNow,
} from "@/lib/ph-time";
import { desc } from "drizzle-orm";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

type OrderRow = {
  id: number;
  customerName: string;
  orderStatus: string;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: string;
  storeType: string;
  deliveryMethod: string | null;
  cashierName: string | null;
  createdAt: Date;
  createdAtMs: number;
  status: ReturnType<typeof normalizeOrderStatus>;
  balance: number;
  onSelectedDate: boolean;
};

export type DailySalesReport = Awaited<ReturnType<typeof getDailySalesReport>>;

export const getDailySalesReport = cache(
  async (year: number, month: number, day: number) => {
    const { start, end } = phDayBounds(year, month, day);
    const dateLabel = phDayLabel(year, month, day);
    const selectedKey = dateKey(year, month, day);
    const today = phNow();
    const isToday =
      year === today.year && month === today.month && day === today.day;

    const rawRows = await db
      .select({
        id: orders.id,
        customerName: orders.customerName,
        orderStatus: orders.orderStatus,
        totalAmount: orders.totalAmount,
        amountPaid: orders.amountPaid,
        paymentStatus: orders.paymentStatus,
        storeType: orders.storeType,
        deliveryMethod: orders.deliveryMethod,
        cashierName: orders.cashierName,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orderCreatedMsColumn()));

    const rows: OrderRow[] = rawRows.map((r) => {
      const createdAt = normalizeOrderCreatedAt(r.createdAt);
      const createdAtMs = createdAt.getTime();
      return {
        ...r,
        createdAt,
        createdAtMs,
        status: normalizeOrderStatus(r.orderStatus),
        balance: r.totalAmount - r.amountPaid,
        onSelectedDate: createdAtMs >= start.getTime() && createdAtMs < end.getTime(),
      };
    });

    const unpaid = rows.filter((r) => r.balance > 0 && r.status !== "Cancelled");
    const onDate = rows.filter((r) => r.onSelectedDate);
    const visitsOnDate = onDate.filter((r) => r.status !== "Cancelled");
    const cancelledOnDate = onDate.filter((r) => r.status === "Cancelled");

    const totalExistingBalance = unpaid.reduce((sum, r) => sum + r.balance, 0);
    const collectedTodayTotal = visitsOnDate.reduce((sum, r) => sum + r.amountPaid, 0);

    const unpaidRows = unpaid.map((r) => ({
      id: r.id,
      customerName: r.customerName,
      orderDateLabel: phDayLabel(
        ...(() => {
          const p = phCalendarPartsFromDate(r.createdAt);
          return [p.year, p.month, p.day] as [number, number, number];
        })(),
      ),
      status: r.status,
      daysOutstanding: phDaysBetween(r.createdAt, start),
      chargesCents: r.totalAmount,
      paidCents: r.amountPaid,
      balanceCents: r.balance,
      collectedTodayCents: r.onSelectedDate ? r.amountPaid : 0,
    }));

    const collectedTowardExisting = unpaidRows.reduce(
      (sum, r) => sum + (r.collectedTodayCents > 0 && r.daysOutstanding > 0 ? r.collectedTodayCents : 0),
      0,
    );

    const totalChargesOnDate = visitsOnDate.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalPaidOnDate = visitsOnDate.reduce((sum, r) => sum + r.amountPaid, 0);
    const outstandingOnDate = visitsOnDate.reduce((sum, r) => sum + r.balance, 0);

    const methodTotals = new Map<string, { amountCents: number; count: number }>();
    for (const r of visitsOnDate.filter((v) => v.amountPaid > 0)) {
      const method =
        r.storeType === "Walk-in"
          ? "Cash / walk-in"
          : r.paymentStatus === "Paid"
            ? "Paid online"
            : r.paymentStatus;
      const cur = methodTotals.get(method) ?? { amountCents: 0, count: 0 };
      cur.amountCents += r.amountPaid;
      cur.count += 1;
      methodTotals.set(method, cur);
    }

    const visitsTable = visitsOnDate.map((r) => ({
      id: r.id,
      customerName: r.customerName,
      chargesCents: r.totalAmount,
      paidCents: r.amountPaid,
      balanceCents: r.balance,
      collectedTodayCents: r.amountPaid,
    }));

    const paymentsReceived = visitsOnDate
      .filter((r) => r.amountPaid > 0)
      .map((r) => ({
        orderId: r.id,
        time: r.createdAt.toISOString(),
        customerName: r.customerName,
        method:
          r.storeType === "Walk-in"
            ? "Cash"
            : r.paymentStatus === "Paid"
              ? "Online"
              : r.paymentStatus,
        amountCents: r.amountPaid,
        reference: `Order #${r.id}`,
        cashierName: r.cashierName,
      }))
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return {
      year,
      month,
      day,
      dateKey: selectedKey,
      dateLabel,
      isToday,
      summary: {
        totalExistingBalanceCents: totalExistingBalance,
        unpaidOrderCount: unpaid.length,
        collectedTodayCents: collectedTodayTotal,
        collectedTowardExistingCents: collectedTowardExisting,
        paymentCount: paymentsReceived.length,
      },
      unpaidRows,
      cancelledOnDate: cancelledOnDate.map((r) => ({
        id: r.id,
        customerName: r.customerName,
        chargesCents: r.totalAmount,
        paidCents: r.amountPaid,
      })),
      collections: {
        totalCollectedCents: collectedTodayTotal,
        methodBreakdown: [...methodTotals.entries()].map(([method, v]) => ({
          method,
          amountCents: v.amountCents,
          count: v.count,
        })),
        visitCount: visitsOnDate.length,
        totalChargesCents: totalChargesOnDate,
        totalPaidCents: totalPaidOnDate,
        outstandingCents: outstandingOnDate,
        visitsTable,
        paymentsReceived,
      },
    };
  },
);

function phCalendarPartsFromDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}
