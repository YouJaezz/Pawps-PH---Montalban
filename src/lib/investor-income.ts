import { and, eq, gte, inArray, lt, ne } from "drizzle-orm";

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

/** Net income for a month — uses cash collected (amountPaid) minus prorated COGS. */
export async function computeMonthlyNetIncome(year: number, month: number) {
  const { start, end } = monthBounds(year, month);

  const monthOrders = await db
    .select({
      id: orders.id,
      totalAmount: orders.totalAmount,
      amountPaid: orders.amountPaid,
    })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, start),
        lt(orders.createdAt, end),
        ne(orders.orderStatus, "Cancelled"),
      ),
    );

  const paidOrders = monthOrders.filter((o) => o.amountPaid > 0);
  if (paidOrders.length === 0) {
    return { grossRevenueCents: 0, cogsCents: 0, netIncomeCents: 0, orderCount: 0 };
  }

  const orderIds = paidOrders.map((o) => o.id);
  const lines = await db
    .select({
      orderId: orderItems.orderId,
      lineTotal: orderItems.lineTotal,
      quantity: orderItems.quantity,
      quantityTenths: orderItems.quantityTenths,
      saleUnit: orderItems.saleUnit,
      unitCost: orderItems.unitCost,
      isExcessSale: orderItems.isExcessSale,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));

  const cogsByOrder = new Map<number, number>();
  for (const line of lines) {
    cogsByOrder.set(
      line.orderId,
      (cogsByOrder.get(line.orderId) ?? 0) + lineCogs(line),
    );
  }

  let grossRevenueCents = 0;
  let cogsCents = 0;
  for (const order of paidOrders) {
    grossRevenueCents += order.amountPaid;
    const fullCogs = cogsByOrder.get(order.id) ?? 0;
    if (order.totalAmount > 0 && order.amountPaid < order.totalAmount) {
      cogsCents += Math.round((fullCogs * order.amountPaid) / order.totalAmount);
    } else {
      cogsCents += fullCogs;
    }
  }

  return {
    grossRevenueCents,
    cogsCents,
    netIncomeCents: grossRevenueCents - cogsCents,
    orderCount: paidOrders.length,
  };
}

export function investorShareCents(netIncomeCents: number, sharePercent: number) {
  return Math.round((netIncomeCents * sharePercent) / 100);
}

export type InvestorSummary = {
  hasSetup: boolean;
  investorName: string | null;
  sharePercent: number | null;
  capitalCents: number | null;
  currentMonthLabel: string;
  currentGrossCents: number;
  currentNetCents: number;
  currentShareCents: number;
  currentOrderCount: number;
  paidOutYtdCents: number;
  accruedUnpaidCents: number;
};

export async function getInvestorSummary(): Promise<InvestorSummary | null> {
  const [investor] = await db
    .select()
    .from(investors)
    .where(eq(investors.active, true))
    .orderBy(investors.fullName)
    .limit(1);

  if (!investor) return null;

  const [agreement] = await db
    .select()
    .from(investorAgreements)
    .where(
      and(
        eq(investorAgreements.investorId, investor.id),
        eq(investorAgreements.active, true),
      ),
    )
    .limit(1);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentMonthLabel = now.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });

  if (!agreement) {
    return {
      hasSetup: false,
      investorName: investor.fullName,
      sharePercent: null,
      capitalCents: null,
      currentMonthLabel,
      currentGrossCents: 0,
      currentNetCents: 0,
      currentShareCents: 0,
      currentOrderCount: 0,
      paidOutYtdCents: 0,
      accruedUnpaidCents: 0,
    };
  }

  const metrics = await computeMonthlyNetIncome(year, month);
  const currentShareCents = investorShareCents(
    metrics.netIncomeCents,
    agreement.sharePercent,
  );

  const payouts = await db
    .select({
      payoutCents: investorPayouts.payoutCents,
      status: investorPayouts.status,
      periodYear: investorPayouts.periodYear,
    })
    .from(investorPayouts)
    .where(eq(investorPayouts.investorId, investor.id));

  const paidOutYtdCents = payouts
    .filter((p) => p.periodYear === year && p.status === "Paid")
    .reduce((s, p) => s + p.payoutCents, 0);

  const accruedUnpaidCents = payouts
    .filter((p) => p.status === "Accrued")
    .reduce((s, p) => s + p.payoutCents, 0);

  return {
    hasSetup: true,
    investorName: investor.fullName,
    sharePercent: agreement.sharePercent,
    capitalCents: agreement.capitalCents,
    currentMonthLabel,
    currentGrossCents: metrics.grossRevenueCents,
    currentNetCents: metrics.netIncomeCents,
    currentShareCents,
    currentOrderCount: metrics.orderCount,
    paidOutYtdCents,
    accruedUnpaidCents,
  };
}
