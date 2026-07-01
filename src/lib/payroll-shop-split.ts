import { and, eq, gte, lt } from "drizzle-orm";

import { db } from "@/db";
import { payrollPayouts, shopCashOutflows, timeEntries } from "@/db/schema";
import type { PayrollRow } from "@/db/queries/payroll";
import { getOwnerProfitSplitSettings } from "@/db/queries/owner-profit-split";
import { entryMinutes } from "@/db/queries/time-attendance";
import {
  buildUnpaidPayrollSplitBreakdown,
  payrollRowKey,
  type UnpaidPayrollItem,
  type UnpaidPayrollSplitBreakdown,
} from "@/lib/owner-volunteer-payroll";
import { payrollPeriodBounds } from "@/lib/payroll-period";
import { buildPayrollSlipDaySummaries } from "@/lib/payroll-slip-format";

function clockInDateKey(clockInAt: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(clockInAt);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export async function fetchDayPayLinesForPayrollRow(row: {
  userId: number;
  year: number;
  month: number;
  half: 0 | 1 | 2;
  periodDay: number;
  hourlyRateCents: number;
}) {
  const { start, end } = payrollPeriodBounds(
    row.year,
    row.month,
    row.half,
    row.periodDay,
  );

  const entries = await db
    .select({
      clockInAt: timeEntries.clockInAt,
      clockOutAt: timeEntries.clockOutAt,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, row.userId),
        gte(timeEntries.clockInAt, start),
        lt(timeEntries.clockInAt, end),
      ),
    );

  const punches = entries.map((entry) => ({
    dateKey: clockInDateKey(entry.clockInAt),
    clockIn: entry.clockInAt.toISOString(),
    clockOut: entry.clockOutAt?.toISOString() ?? null,
    minutes: entryMinutes(entry.clockInAt, entry.clockOutAt),
  }));

  return buildPayrollSlipDaySummaries(punches, row.hourlyRateCents).map((day) => ({
    dateKey: day.dateKey,
    dayPayCents: day.dayPayCents,
  }));
}

export async function buildPayrollWalletSplitForRow(
  row: PayrollRow,
): Promise<UnpaidPayrollSplitBreakdown> {
  const settings = await getOwnerProfitSplitSettings();
  const dayPayLines = await fetchDayPayLinesForPayrollRow(row);

  const item: UnpaidPayrollItem = {
    rowKey: payrollRowKey(row),
    userId: row.userId,
    employeeName: row.employeeName,
    label: row.label,
    status: row.status === "Accrued" ? "accrued" : "ready",
    grossPayCents: row.grossPayCents,
    minutesWorked: row.minutesWorked,
    dayPayLines,
  };

  const grossFromDays = dayPayLines.reduce((sum, day) => sum + day.dayPayCents, 0);
  if (grossFromDays > 0) {
    item.grossPayCents = grossFromDays;
  }

  return buildUnpaidPayrollSplitBreakdown(item, settings);
}

export async function recordPayrollShopPoolExpense(input: {
  shopPoolCents: number;
  employeeName: string;
  periodLabel: string;
  payoutId: number;
  paidAt: Date;
  recordedByUserId: number | null;
  owner1Name: string;
  owner2Name: string;
  owner1WalletCents: number;
  owner2WalletCents: number;
}) {
  if (input.shopPoolCents <= 0) return null;

  const [outflow] = await db
    .insert(shopCashOutflows)
    .values({
      kind: "expense",
      fundingSource: "shop_cash",
      expenseCategory: "payroll",
      amountCents: input.shopPoolCents,
      description: `Staff payroll — ${input.employeeName} · ${input.periodLabel}`,
      reference: `payroll-${input.payoutId}`,
      paidAt: input.paidAt,
      recordedByUserId: input.recordedByUserId,
      notes: `Shop pool share. ${input.owner1Name} wallet: ₱${(input.owner1WalletCents / 100).toFixed(2)} · ${input.owner2Name} wallet: ₱${(input.owner2WalletCents / 100).toFixed(2)} (paid personally, not from shop cash).`,
    })
    .returning({ id: shopCashOutflows.id });

  return outflow?.id ?? null;
}

export async function deletePayrollShopPoolExpense(payoutId: number) {
  const [payout] = await db
    .select({
      shopCashOutflowId: payrollPayouts.shopCashOutflowId,
    })
    .from(payrollPayouts)
    .where(eq(payrollPayouts.id, payoutId))
    .limit(1);

  if (payout?.shopCashOutflowId) {
    await db
      .delete(shopCashOutflows)
      .where(eq(shopCashOutflows.id, payout.shopCashOutflowId));
  }
}
