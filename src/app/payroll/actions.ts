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
  normalizePaymentMethod,
  parsePhDateInput,
  paymentMethodLabel,
} from "@/lib/payroll-payment";
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
    status: "Accrued",
    paidAt: null,
  });

  revalidatePayroll();

  const monthLabel = payrollPeriodLabel(year, month, half, periodDay);
  const peso = (grossPayCents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  });

  return {
    ok: true,
    message: `${monthLabel} locked for ${row.employeeName} — ₱${peso} awaiting payment.`,
  };
}

export async function markPayrollPaid(
  _prev: PayrollActionResult | null,
  formData: FormData,
): Promise<PayrollActionResult> {
  const admin = await requireAdmin();

  const payoutId = Number.parseInt(String(formData.get("payoutId") ?? ""), 10);
  if (!Number.isFinite(payoutId) || payoutId <= 0) {
    return { error: "Invalid payout." };
  }

  const payment = readPaymentFields(formData);
  if ("error" in payment) return { error: payment.error };

  const [payout] = await db
    .select({
      id: payrollPayouts.id,
      status: payrollPayouts.status,
      grossPayCents: payrollPayouts.grossPayCents,
      userId: payrollPayouts.userId,
    })
    .from(payrollPayouts)
    .where(eq(payrollPayouts.id, payoutId))
    .limit(1);

  if (!payout) return { error: "Payout not found." };
  if (payout.status === "Paid") {
    return { error: "This payout is already recorded as paid." };
  }

  const [employee] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, payout.userId))
    .limit(1);

  await db
    .update(payrollPayouts)
    .set({
      status: "Paid",
      paidAt: payment.paidAt,
      paymentMethod: payment.paymentMethod,
      paymentReference: payment.paymentReference || null,
      notes: payment.notes || null,
      paidByUserId: admin.userId,
    })
    .where(eq(payrollPayouts.id, payoutId));

  revalidatePayroll();

  const peso = (payout.grossPayCents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  });
  const employeeName = employee?.name ?? employee?.email ?? "Employee";

  return {
    ok: true,
    message: `Recorded ₱${peso} paid to ${employeeName} via ${paymentMethodLabel(payment.paymentMethod)}.`,
  };
}

function readPaymentFields(formData: FormData) {
  const paymentMethod = normalizePaymentMethod(
    String(formData.get("paymentMethod") ?? ""),
  );
  if (!paymentMethod) {
    return { error: "Select how the employee was paid." as const };
  }

  return {
    paymentMethod,
    paymentReference: String(formData.get("paymentReference") ?? "")
      .trim()
      .slice(0, 120),
    notes: String(formData.get("notes") ?? "").trim().slice(0, 500),
    paidAt:
      parsePhDateInput(String(formData.get("paidAt") ?? "")) ?? new Date(),
  };
}

/** Lock payroll and record payment in one step (for periods ready to pay). */
export async function lockAndRecordPayrollPayment(
  _prev: PayrollActionResult | null,
  formData: FormData,
): Promise<PayrollActionResult> {
  const admin = await requireAdmin();

  const userId = Number.parseInt(String(formData.get("userId") ?? ""), 10);
  const { year, month, half, periodDay } = resolvePayrollPayoutPeriod(
    String(formData.get("year") ?? ""),
    String(formData.get("month") ?? ""),
    String(formData.get("half") ?? ""),
    String(formData.get("periodDay") ?? formData.get("day") ?? ""),
  );
  const payment = readPaymentFields(formData);
  if ("error" in payment) return { error: payment.error };

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
    return { error: "Wait until the payroll period ends before paying." };
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

  if (existing) {
    return { error: "Payroll for this period is already locked. Use Pay now on that row instead." };
  }

  const { semiMonthlyRows, dailyRows } = await getPayrollDashboard();
  const row = [...semiMonthlyRows, ...dailyRows].find(
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
    status: "Paid",
    paidAt: payment.paidAt,
    paymentMethod: payment.paymentMethod,
    paymentReference: payment.paymentReference || null,
    notes: payment.notes || null,
    paidByUserId: admin.userId,
  });

  revalidatePayroll();

  const monthLabel = payrollPeriodLabel(year, month, half, periodDay);
  const peso = (grossPayCents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  });

  return {
    ok: true,
    message: `${monthLabel}: recorded ₱${peso} paid to ${row.employeeName} via ${paymentMethodLabel(payment.paymentMethod)}.`,
  };
}

/** Modal form handler — record on locked payout or lock + pay in one step. */
export async function submitPayrollPayment(
  _prev: PayrollActionResult | null,
  formData: FormData,
): Promise<PayrollActionResult> {
  const mode = String(formData.get("paymentMode") ?? "record");
  if (mode === "lock_and_pay") {
    return lockAndRecordPayrollPayment(_prev, formData);
  }
  return markPayrollPaid(_prev, formData);
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
