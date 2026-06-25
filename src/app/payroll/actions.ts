"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { payrollPayouts, users } from "@/db/schema";
import {
  getPayrollDashboard,
  grossPayFromMinutes,
} from "@/db/queries/payroll";
import { requireAdmin } from "@/lib/auth-guard";
import { parseMoneyToCents } from "@/lib/money";
import {
  canLockPayrollPeriod,
  isDailyPayPeriod,
  isSemiMonthlyEnabled,
  normalizePaySchedule,
  payrollPeriodLabel,
  resolvePayrollPayoutPeriod,
} from "@/lib/payroll-period";

export type PayrollActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function revalidatePayroll() {
  revalidatePath("/payroll");
  revalidatePath("/attendance");
}

export async function updateEmployeeHourlyRate(
  _prev: PayrollActionResult | null,
  formData: FormData,
): Promise<PayrollActionResult> {
  await requireAdmin();

  const userId = Number.parseInt(String(formData.get("userId") ?? ""), 10);
  const hourlyRateCents = parseMoneyToCents(formData.get("hourlyRate"));
  const paySchedule = normalizePaySchedule(
    String(formData.get("paySchedule") ?? ""),
  );

  if (!Number.isFinite(userId) || userId <= 0) {
    return { error: "Invalid employee." };
  }

  await db
    .update(users)
    .set({ hourlyRateCents, paySchedule })
    .where(eq(users.id, userId));

  revalidatePayroll();
  return { ok: true, message: "Pay settings saved." };
}

export async function generatePayrollPayout(
  _prev: PayrollActionResult | null,
  formData: FormData,
): Promise<PayrollActionResult> {
  await requireAdmin();

  const userId = Number.parseInt(String(formData.get("userId") ?? ""), 10);
  const { year, month, half, periodDay } = resolvePayrollPayoutPeriod(
    String(formData.get("year") ?? ""),
    String(formData.get("month") ?? ""),
    String(formData.get("half") ?? ""),
    String(formData.get("periodDay") ?? formData.get("day") ?? ""),
  );
  const markPaid = formData.get("markPaid") === "on";

  if (!Number.isFinite(userId) || userId <= 0) {
    return { error: "Invalid payroll request." };
  }

  if (
    !isDailyPayPeriod(periodDay) &&
    isSemiMonthlyEnabled(year, month) &&
    half === 0
  ) {
    return { error: "Invalid payroll period." };
  }

  if (!canLockPayrollPeriod({ year, month, half, periodDay })) {
    return { error: "Wait until the payroll period ends before locking payroll." };
  }

  const [existing] = await db
    .select({ id: payrollPayouts.id })
    .from(payrollPayouts)
    .where(
      and(
        eq(payrollPayouts.userId, userId),
        eq(payrollPayouts.periodYear, year),
        eq(payrollPayouts.periodMonth, month),
        eq(payrollPayouts.periodHalf, half),
        eq(payrollPayouts.periodDay, periodDay),
      ),
    )
    .limit(1);

  if (existing) return { error: "Payroll for this period is already locked." };

  const { semiMonthlyRows, dailyRows } = await getPayrollDashboard();
  const allRows = [...semiMonthlyRows, ...dailyRows];
  const row = allRows.find(
    (r) =>
      r.userId === userId &&
      r.year === year &&
      r.month === month &&
      r.half === half &&
      r.periodDay === periodDay,
  );
  if (!row) return { error: "Payroll row not found." };
  if (row.minutesWorked <= 0) return { error: "No hours recorded for this period." };
  if (row.hourlyRateCents <= 0) return { error: "Set an hourly rate first." };

  const grossPayCents = grossPayFromMinutes(
    row.minutesWorked,
    row.hourlyRateCents,
  );

  await db.insert(payrollPayouts).values({
    userId,
    periodYear: year,
    periodMonth: month,
    periodHalf: half,
    periodDay,
    minutesWorked: row.minutesWorked,
    hourlyRateCents: row.hourlyRateCents,
    grossPayCents,
    status: markPaid ? "Paid" : "Accrued",
    paidAt: markPaid ? new Date() : null,
  });

  revalidatePayroll();

  const monthLabel = payrollPeriodLabel(year, month, half, periodDay);
  const peso = (grossPayCents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  });

  return {
    ok: true,
    message: `${monthLabel} payroll locked — ₱${peso} for ${row.employeeName}.`,
  };
}

export async function markPayrollPaid(
  _prev: PayrollActionResult | null,
  formData: FormData,
): Promise<PayrollActionResult> {
  await requireAdmin();

  const payoutId = Number.parseInt(String(formData.get("payoutId") ?? ""), 10);
  if (!Number.isFinite(payoutId) || payoutId <= 0) {
    return { error: "Invalid payout." };
  }

  await db
    .update(payrollPayouts)
    .set({ status: "Paid", paidAt: new Date() })
    .where(eq(payrollPayouts.id, payoutId));

  revalidatePayroll();
  return { ok: true, message: "Marked paid." };
}

export async function resetPayrollPayout(
  _prev: PayrollActionResult | null,
  formData: FormData,
): Promise<PayrollActionResult> {
  await requireAdmin();

  const payoutId = Number.parseInt(String(formData.get("payoutId") ?? ""), 10);
  if (!Number.isFinite(payoutId) || payoutId <= 0) {
    return { error: "Invalid payout." };
  }

  await db.delete(payrollPayouts).where(eq(payrollPayouts.id, payoutId));
  revalidatePayroll();
  return { ok: true, message: "Payroll entry reset." };
}
