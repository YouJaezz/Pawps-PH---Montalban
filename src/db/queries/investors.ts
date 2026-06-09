import { cache } from "react";
import { and, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  investorAgreements,
  investorPayouts,
  investors,
  orderItems,
  orders,
} from "@/db/schema";
import { effectiveQuantity, type SaleUnit } from "@/lib/order-line-math";

function monthBounds(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

function lineCogs(line: {
  quantity: number;
  quantityTenths: number | null;
  saleUnit: string;
  unitCost: number;
  isExcessSale: boolean;
}) {
  if (line.isExcessSale) return 0;
  const qty = effectiveQuantity(
    line.quantity,
    line.saleUnit as SaleUnit,
    line.quantityTenths,
  );
  return Math.round(line.unitCost * qty);
}

export async function computeMonthlyNetIncome(year: number, month: number) {
  const { start, end } = monthBounds(year, month);

  const paidOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, start),
        lt(orders.createdAt, end),
        ne(orders.orderStatus, "Cancelled"),
        eq(orders.paymentStatus, "Paid"),
      ),
    );

  const orderIds = paidOrders.map((o) => o.id);
  if (orderIds.length === 0) {
    return { grossRevenueCents: 0, cogsCents: 0, netIncomeCents: 0, orderCount: 0 };
  }

  const lines = await db
    .select({
      lineTotal: orderItems.lineTotal,
      quantity: orderItems.quantity,
      quantityTenths: orderItems.quantityTenths,
      saleUnit: orderItems.saleUnit,
      unitCost: orderItems.unitCost,
      isExcessSale: orderItems.isExcessSale,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));

  let grossRevenueCents = 0;
  let cogsCents = 0;
  for (const line of lines) {
    grossRevenueCents += line.lineTotal;
    cogsCents += lineCogs(line);
  }

  return {
    grossRevenueCents,
    cogsCents,
    netIncomeCents: grossRevenueCents - cogsCents,
    orderCount: orderIds.length,
  };
}

export type InvestorMonthlyRow = {
  year: number;
  month: number;
  label: string;
  grossRevenueCents: number;
  cogsCents: number;
  netIncomeCents: number;
  sharePercent: number;
  payoutCents: number;
  payoutId: number | null;
  payoutStatus: "Accrued" | "Paid" | "Projected";
};

export const getInvestorDashboard = cache(async () => {
  const investorRows = await db
    .select()
    .from(investors)
    .where(eq(investors.active, true))
    .orderBy(investors.fullName);

  const agreements = await db
    .select()
    .from(investorAgreements)
    .where(eq(investorAgreements.active, true));

  const agreementByInvestor = new Map(
    agreements.map((a) => [a.investorId, a]),
  );

  const payouts = await db
    .select()
    .from(investorPayouts)
    .orderBy(
      sql`${investorPayouts.periodYear} desc, ${investorPayouts.periodMonth} desc`,
    );

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const primary = investorRows[0] ?? null;
  const agreement = primary ? agreementByInvestor.get(primary.id) : undefined;

  const monthlyRows: InvestorMonthlyRow[] = [];
  if (agreement) {
    for (let i = 0; i < 6; i++) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const label = d.toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric",
      });

      const existing = payouts.find(
        (p) =>
          p.investorId === primary!.id &&
          p.periodYear === year &&
          p.periodMonth === month,
      );

      if (existing) {
        monthlyRows.push({
          year,
          month,
          label,
          grossRevenueCents: existing.grossRevenueCents,
          cogsCents: existing.cogsCents,
          netIncomeCents: existing.netIncomeCents,
          sharePercent: existing.sharePercent,
          payoutCents: existing.payoutCents,
          payoutId: existing.id,
          payoutStatus: existing.status,
        });
        continue;
      }

      const metrics = await computeMonthlyNetIncome(year, month);
      const payoutCents = Math.round(
        (metrics.netIncomeCents * agreement.sharePercent) / 100,
      );
      monthlyRows.push({
        year,
        month,
        label,
        grossRevenueCents: metrics.grossRevenueCents,
        cogsCents: metrics.cogsCents,
        netIncomeCents: metrics.netIncomeCents,
        sharePercent: agreement.sharePercent,
        payoutCents,
        payoutId: null,
        payoutStatus:
          year === currentYear && month === currentMonth
            ? "Projected"
            : "Accrued",
      });
    }
  }

  const currentMetrics =
    agreement != null
      ? await computeMonthlyNetIncome(currentYear, currentMonth)
      : null;

  const currentShareCents =
    agreement && currentMetrics
      ? Math.round(
          (currentMetrics.netIncomeCents * agreement.sharePercent) / 100,
        )
      : 0;

  const paidYtd = payouts
    .filter(
      (p) =>
        primary &&
        p.investorId === primary.id &&
        p.periodYear === currentYear &&
        p.status === "Paid",
    )
    .reduce((sum, p) => sum + p.payoutCents, 0);

  return {
    investors: investorRows,
    primary,
    agreement,
    monthlyRows,
    currentMetrics,
    currentShareCents,
    paidYtdCents: paidYtd,
    payoutHistory: payouts.filter((p) => primary && p.investorId === primary.id),
  };
});
