import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { ownerProfitSplitSettings } from "@/db/schema";
import type { PayrollRow } from "@/db/queries/payroll";
import { computeProfitForDateRange, computeMonthlyNetIncome } from "@/lib/investor-income";
import {
  buildOwnerPayrollPlan,
  DEFAULT_OWNER_PROFIT_SPLIT,
  type OwnerPayrollPlanScope,
  type OwnerProfitSplitSettings,
} from "@/lib/owner-profit-split";
import {
  payrollPeriodBounds,
  semiMonthlyPeriods,
} from "@/lib/payroll-period";
import { phMonthLabel, phNow } from "@/lib/ph-time";

function rowFromDb(
  row: typeof ownerProfitSplitSettings.$inferSelect | undefined,
): OwnerProfitSplitSettings {
  if (!row) return { ...DEFAULT_OWNER_PROFIT_SPLIT };
  return {
    owner1Name: row.owner1Name,
    owner2Name: row.owner2Name,
    owner1Percent: row.owner1Percent,
    owner2Percent: row.owner2Percent,
    payrollPoolPercent: row.payrollPoolPercent,
  };
}

export const getOwnerProfitSplitSettings = cache(async () => {
  const [row] = await db
    .select()
    .from(ownerProfitSplitSettings)
    .where(eq(ownerProfitSplitSettings.id, 1))
    .limit(1);
  return rowFromDb(row);
});

function isStaffPayrollRow(
  row: PayrollRow,
  employeeRoleById: Map<number, string>,
) {
  const role = employeeRoleById.get(row.userId);
  return role !== "admin";
}

function staffLinesForPeriod(
  rows: PayrollRow[],
  employeeRoleById: Map<number, string>,
  match: (row: PayrollRow) => boolean,
) {
  const byUser = new Map<number, { employeeName: string; hoursOwedCents: number }>();

  for (const row of rows) {
    if (!match(row)) continue;
    if (!isStaffPayrollRow(row, employeeRoleById)) continue;
    if (row.grossPayCents <= 0) continue;

    const existing = byUser.get(row.userId);
    if (existing) {
      existing.hoursOwedCents += row.grossPayCents;
    } else {
      byUser.set(row.userId, {
        employeeName: row.employeeName,
        hoursOwedCents: row.grossPayCents,
      });
    }
  }

  return Array.from(byUser.entries()).map(([userId, line]) => ({
    userId,
    employeeName: line.employeeName,
    hoursOwedCents: line.hoursOwedCents,
  }));
}

export type OwnerProfitSplitDashboard = {
  settings: OwnerProfitSplitSettings;
  currentPeriod: OwnerPayrollPlanScope;
  currentMonth: OwnerPayrollPlanScope;
};

export async function getOwnerProfitSplitDashboard(input: {
  semiMonthlyRows: PayrollRow[];
  dailyRows: PayrollRow[];
  employees: Array<{ id: number; role: string }>;
}): Promise<OwnerProfitSplitDashboard> {
  const settings = await getOwnerProfitSplitSettings();
  const allRows = [...input.semiMonthlyRows, ...input.dailyRows];
  const roleById = new Map(input.employees.map((e) => [e.id, e.role]));

  const period = semiMonthlyPeriods(1)[0]!;
  const { start, end } = payrollPeriodBounds(
    period.year,
    period.month,
    period.half,
    period.periodDay,
  );

  const now = phNow();
  const monthLabel = phMonthLabel(now.year, now.month);

  const [periodProfit, monthProfit] = await Promise.all([
    computeProfitForDateRange(start.getTime(), end.getTime()),
    computeMonthlyNetIncome(now.year, now.month),
  ]);

  const periodMatch = (row: PayrollRow) =>
    row.year === period.year &&
    row.month === period.month &&
    row.half === period.half &&
    row.periodDay === period.periodDay;

  const monthMatch = (row: PayrollRow) =>
    row.year === now.year && row.month === now.month;

  const currentPeriod = buildOwnerPayrollPlan(
    period.label,
    periodProfit,
    settings,
    staffLinesForPeriod(allRows, roleById, periodMatch),
  );

  const currentMonth = buildOwnerPayrollPlan(
    monthLabel,
    monthProfit,
    settings,
    staffLinesForPeriod(allRows, roleById, monthMatch),
  );

  return {
    settings,
    currentPeriod,
    currentMonth,
  };
}
