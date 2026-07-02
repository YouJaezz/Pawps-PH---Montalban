import { cache } from "react";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { normalizeOrderCreatedAt, orderCreatedMsColumn } from "@/lib/order-timestamp";
import { normalizeOrderStatus } from "@/lib/order-status";
import { displayOrderCustomerName } from "@/lib/order-customer";
import { getActiveBranches } from "@/lib/branch-stock";
import {
  phDayBounds,
  phDayLabel,
  phDaysBetween,
  phNow,
} from "@/lib/ph-time";
import { and, desc, gte, lt, ne, sql } from "drizzle-orm";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

const orderSelectFields = {
  id: orders.id,
  customerName: orders.customerName,
  orderStatus: orders.orderStatus,
  subtotalCents: orders.subtotalCents,
  discountCents: orders.discountCents,
  totalAmount: orders.totalAmount,
  amountPaid: orders.amountPaid,
  paymentStatus: orders.paymentStatus,
  storeType: orders.storeType,
  deliveryMethod: orders.deliveryMethod,
  cashierName: orders.cashierName,
  branchId: orders.branchId,
  createdAt: orders.createdAt,
};

type OrderRow = {
  id: number;
  customerName: string;
  orderStatus: string;
  subtotalCents: number;
  discountCents: number;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: string;
  storeType: string;
  deliveryMethod: string | null;
  cashierName: string | null;
  branchId: number | null;
  branchName: string;
  createdAt: Date;
  createdAtMs: number;
  status: ReturnType<typeof normalizeOrderStatus>;
  balance: number;
  onSelectedDate: boolean;
};

function mapOrderRows(
  rawRows: Array<{
    id: number;
    customerName: string;
    orderStatus: string;
    subtotalCents: number;
    discountCents: number;
    totalAmount: number;
    amountPaid: number;
    paymentStatus: string;
    storeType: string;
    deliveryMethod: string | null;
    cashierName: string | null;
    branchId: number | null;
    createdAt: Date;
  }>,
  branchNameById: Map<number, string>,
  defaultBranchName: string,
  startMs: number,
  endMs: number,
): OrderRow[] {
  return rawRows.map((r) => {
    const createdAt = normalizeOrderCreatedAt(r.createdAt);
    const createdAtMs = createdAt.getTime();
    return {
      ...r,
      branchName: r.branchId
        ? (branchNameById.get(r.branchId) ?? defaultBranchName)
        : defaultBranchName,
      createdAt,
      createdAtMs,
      status: normalizeOrderStatus(r.orderStatus),
      balance: r.totalAmount - r.amountPaid,
      onSelectedDate: createdAtMs >= startMs && createdAtMs < endMs,
    };
  });
}

export type DailySalesReport = Awaited<ReturnType<typeof getDailySalesReport>>;

export const getDailySalesReport = cache(
  async (year: number, month: number, day: number) => {
    const { start, end } = phDayBounds(year, month, day);
    const startMs = start.getTime();
    const endMs = end.getTime();
    const dateLabel = phDayLabel(year, month, day);
    const selectedKey = dateKey(year, month, day);
    const today = phNow();
    const isToday =
      year === today.year && month === today.month && day === today.day;

    const [unpaidRaw, onDateRaw, activeBranches] = await Promise.all([
      db
        .select(orderSelectFields)
        .from(orders)
        .where(
          and(
            ne(orders.orderStatus, "Cancelled"),
            sql`${orders.totalAmount} > ${orders.amountPaid}`,
          ),
        )
        .orderBy(desc(orderCreatedMsColumn())),
      db
        .select(orderSelectFields)
        .from(orders)
        // createdAt has legacy mixed seconds/ms values; filter using normalized ms expression.
        .where(and(gte(orderCreatedMsColumn(), startMs), lt(orderCreatedMsColumn(), endMs)))
        .orderBy(desc(orderCreatedMsColumn())),
      getActiveBranches(),
    ]);

    const branchNameById = new Map(activeBranches.map((b) => [b.id, b.name]));
    const defaultBranchName =
      activeBranches.find((b) => b.isDefault)?.name ?? "PAWPS Shop";

    const unpaid = mapOrderRows(
      unpaidRaw,
      branchNameById,
      defaultBranchName,
      startMs,
      endMs,
    );
    const onDate = mapOrderRows(
      onDateRaw,
      branchNameById,
      defaultBranchName,
      startMs,
      endMs,
    );
    const visitsOnDate = onDate.filter((r) => r.status !== "Cancelled");
    const cancelledOnDate = onDate.filter((r) => r.status === "Cancelled");

    const totalExistingBalance = unpaid.reduce((sum, r) => sum + r.balance, 0);
    const collectedTodayTotal = visitsOnDate.reduce((sum, r) => sum + r.amountPaid, 0);

    const unpaidRows = unpaid.map((r) => ({
      id: r.id,
      customerName: displayOrderCustomerName(r.customerName, r.storeType),
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
    const totalGrossSubtotalOnDate = visitsOnDate.reduce(
      (sum, r) => sum + (r.subtotalCents > 0 ? r.subtotalCents : r.totalAmount),
      0,
    );
    const totalDiscountOnDate = visitsOnDate.reduce((sum, r) => sum + r.discountCents, 0);
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
      customerName: displayOrderCustomerName(r.customerName, r.storeType),
      storeType: r.storeType,
      branchId: r.branchId,
      branchName: r.branchName,
      chargesCents: r.totalAmount,
      paidCents: r.amountPaid,
      balanceCents: r.balance,
      collectedTodayCents: r.amountPaid,
    }));

    const branchTotals = new Map<
      string,
      { branchId: number | null; branchName: string; amountCents: number; count: number }
    >();
    for (const r of visitsOnDate.filter((v) => v.amountPaid > 0)) {
      const key = r.branchName;
      const cur = branchTotals.get(key) ?? {
        branchId: r.branchId,
        branchName: r.branchName,
        amountCents: 0,
        count: 0,
      };
      cur.amountCents += r.amountPaid;
      cur.count += 1;
      branchTotals.set(key, cur);
    }

    const paymentsReceived = visitsOnDate
      .filter((r) => r.amountPaid > 0)
      .map((r) => ({
        orderId: r.id,
        time: r.createdAt.toISOString(),
        customerName: displayOrderCustomerName(r.customerName, r.storeType),
        branchId: r.branchId,
        branchName: r.branchName,
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
      branches: activeBranches.map((b) => ({
        id: b.id,
        name: b.name,
        isDefault: b.isDefault,
      })),
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
        customerName: displayOrderCustomerName(r.customerName, r.storeType),
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
        walkInOrderCount: visitsOnDate.filter((r) => r.storeType === "Walk-in")
          .length,
        onlineOrderCount: visitsOnDate.filter((r) => r.storeType !== "Walk-in")
          .length,
        branchBreakdown: [...branchTotals.values()].sort((a, b) =>
          a.branchName.localeCompare(b.branchName),
        ),
        totalChargesCents: totalChargesOnDate,
        totalGrossSubtotalCents: totalGrossSubtotalOnDate,
        totalDiscountCents: totalDiscountOnDate,
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
