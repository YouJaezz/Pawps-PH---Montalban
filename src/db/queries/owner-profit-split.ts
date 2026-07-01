import { cache } from "react";
import { and, eq, gte, inArray, lt } from "drizzle-orm";

import { db } from "@/db";
import { ownerProfitSplitSettings, timeEntries } from "@/db/schema";
import type { PayrollRow } from "@/db/queries/payroll";
import { grossPayFromMinutes } from "@/db/queries/payroll";
import { getCashProfitReport } from "@/db/queries/cash-profit-report";
import { entryMinutes } from "@/db/queries/time-attendance";
import {
  DEFAULT_OWNER_PROFIT_SPLIT,
  type OwnerProfitSplitSettings,
} from "@/lib/owner-profit-split";
import {
  buildUnpaidPayrollSplitBreakdown,
  payrollRowKey,
  type UnpaidPayrollItem,
} from "@/lib/owner-volunteer-payroll";
import { payrollPeriodBounds } from "@/lib/payroll-period";
import { buildPayrollSlipDaySummaries } from "@/lib/payroll-slip-format";

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
    owner1VolunteerWeekday: row.owner1VolunteerWeekday ?? null,
    owner2VolunteerWeekday: row.owner2VolunteerWeekday ?? null,
  };
}

export const getOwnerProfitSplitSettings = cache(async () => {
  try {
    const [row] = await db
      .select()
      .from(ownerProfitSplitSettings)
      .where(eq(ownerProfitSplitSettings.id, 1))
      .limit(1);
    return rowFromDb(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no such table") || msg.includes("owner_profit_split_settings")) {
      return { ...DEFAULT_OWNER_PROFIT_SPLIT };
    }
    throw err;
  }
});

function isStaffPayrollRow(
  row: PayrollRow,
  employeeRoleById: Map<number, string>,
) {
  const role = employeeRoleById.get(row.userId);
  return role !== "admin";
}

function isUnpaidPayrollRow(row: PayrollRow) {
  if (row.grossPayCents <= 0) return false;
  if (row.status === "Accrued") return true;
  if (row.canGenerate) return true;
  return false;
}

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

async function buildUnpaidPayrollItems(
  unpaidRows: PayrollRow[],
): Promise<UnpaidPayrollItem[]> {
  if (unpaidRows.length === 0) return [];

  const userIds = [...new Set(unpaidRows.map((row) => row.userId))];
  let rangeStartMs = Number.POSITIVE_INFINITY;
  let rangeEndMs = Number.NEGATIVE_INFINITY;

  for (const row of unpaidRows) {
    const { start, end } = payrollPeriodBounds(
      row.year,
      row.month,
      row.half,
      row.periodDay,
    );
    rangeStartMs = Math.min(rangeStartMs, start.getTime());
    rangeEndMs = Math.max(rangeEndMs, end.getTime());
  }

  const entries = await db
    .select({
      userId: timeEntries.userId,
      clockInAt: timeEntries.clockInAt,
      clockOutAt: timeEntries.clockOutAt,
    })
    .from(timeEntries)
    .where(
      and(
        inArray(timeEntries.userId, userIds),
        gte(timeEntries.clockInAt, new Date(rangeStartMs)),
        lt(timeEntries.clockInAt, new Date(rangeEndMs)),
      ),
    );

  const entriesByUser = new Map<number, typeof entries>();
  for (const entry of entries) {
    const list = entriesByUser.get(entry.userId) ?? [];
    list.push(entry);
    entriesByUser.set(entry.userId, list);
  }

  return unpaidRows.map((row) => {
    const { start, end } = payrollPeriodBounds(
      row.year,
      row.month,
      row.half,
      row.periodDay,
    );
    const rowEntries = (entriesByUser.get(row.userId) ?? []).filter(
      (entry) => entry.clockInAt >= start && entry.clockInAt < end,
    );

    const punches = rowEntries.map((entry) => ({
      dateKey: clockInDateKey(entry.clockInAt),
      clockIn: entry.clockInAt.toISOString(),
      clockOut: entry.clockOutAt?.toISOString() ?? null,
      minutes: entryMinutes(entry.clockInAt, entry.clockOutAt),
    }));

    const daySummaries = buildPayrollSlipDaySummaries(
      punches,
      row.hourlyRateCents,
    );

    const dayPayLines = daySummaries.map((day) => ({
      dateKey: day.dateKey,
      dayPayCents: day.dayPayCents,
    }));

    const minutesFromDays = daySummaries.reduce(
      (sum, day) => sum + day.totalMinutes,
      0,
    );
    const grossFromDays = grossPayFromMinutes(
      minutesFromDays,
      row.hourlyRateCents,
    );

    return {
      rowKey: payrollRowKey(row),
      userId: row.userId,
      employeeName: row.employeeName,
      label: row.label,
      status: row.status === "Accrued" ? "accrued" : "ready",
      grossPayCents: grossFromDays > 0 ? grossFromDays : row.grossPayCents,
      minutesWorked: minutesFromDays > 0 ? minutesFromDays : row.minutesWorked,
      dayPayLines,
    } satisfies UnpaidPayrollItem;
  });
}

export type WalletObligationsSummary = {
  owner1TotalCents: number;
  owner2TotalCents: number;
  shopPoolTotalCents: number;
  grossUnpaidCents: number;
  unpaidCount: number;
};

export type OwnerProfitSplitDashboard = {
  settings: OwnerProfitSplitSettings;
  unpaidPayroll: UnpaidPayrollItem[];
  walletObligations: WalletObligationsSummary;
  shopCash: {
    cashInHandCents: number;
    availableShopCashCents: number;
    pendingShopPoolCents: number;
  };
};

export async function getOwnerProfitSplitDashboard(input: {
  semiMonthlyRows: PayrollRow[];
  dailyRows: PayrollRow[];
  employees: Array<{ id: number; role: string }>;
}): Promise<OwnerProfitSplitDashboard> {
  const settings = await getOwnerProfitSplitSettings();
  const allRows = [...input.semiMonthlyRows, ...input.dailyRows];
  const roleById = new Map(input.employees.map((e) => [e.id, e.role]));

  const unpaidRows = allRows
    .filter((row) => isStaffPayrollRow(row, roleById) && isUnpaidPayrollRow(row))
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      if (a.half !== b.half) return b.half - a.half;
      if (a.periodDay !== b.periodDay) return b.periodDay - a.periodDay;
      return b.grossPayCents - a.grossPayCents;
    });

  const [unpaidPayroll, cashReport] = await Promise.all([
    buildUnpaidPayrollItems(unpaidRows),
    getCashProfitReport(),
  ]);

  let owner1TotalCents = 0;
  let owner2TotalCents = 0;
  let shopPoolTotalCents = 0;
  let grossUnpaidCents = 0;

  for (const item of unpaidPayroll) {
    const breakdown = buildUnpaidPayrollSplitBreakdown(item, settings);
    owner1TotalCents += breakdown.owner1TotalCents;
    owner2TotalCents += breakdown.owner2TotalCents;
    shopPoolTotalCents += breakdown.staffPoolCents;
    grossUnpaidCents += breakdown.grossPayCents;
  }

  return {
    settings,
    unpaidPayroll,
    walletObligations: {
      owner1TotalCents,
      owner2TotalCents,
      shopPoolTotalCents,
      grossUnpaidCents,
      unpaidCount: unpaidPayroll.length,
    },
    shopCash: {
      cashInHandCents: cashReport.cash.cashInHandCents,
      availableShopCashCents: cashReport.cash.availableShopCashCents,
      pendingShopPoolCents: shopPoolTotalCents,
    },
  };
}
