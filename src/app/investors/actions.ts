"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  investorAgreements,
  investorPayouts,
  investors,
} from "@/db/schema";
import {
  computeMonthlyNetIncome,
  investorShareCents,
} from "@/lib/investor-income";
import { requireAdmin } from "@/lib/auth-guard";

export type InvestorActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function parseMoneyToCents(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  const n = Number(str);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function parseSharePercent(value: FormDataEntryValue | null) {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return Math.round(n);
}

function revalidateInvestorPages() {
  revalidatePath("/investors");
  revalidatePath("/");
  revalidatePath("/reports");
}

function isCurrentMonth(year: number, month: number) {
  const now = new Date();
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

export async function upsertInvestorProfile(
  _prev: InvestorActionResult | null,
  formData: FormData,
): Promise<InvestorActionResult> {
  await requireAdmin();

  const id = Number.parseInt(String(formData.get("investorId") ?? ""), 10);
  const fullName = String(formData.get("fullName") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const idReference = String(formData.get("idReference") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!fullName) return { error: "Investor full name is required." };

  const values = {
    fullName,
    contact: contact || null,
    email: email || null,
    address: address || null,
    idReference: idReference || null,
    notes: notes || null,
  };

  if (Number.isFinite(id) && id > 0) {
    await db.update(investors).set(values).where(eq(investors.id, id));
    revalidateInvestorPages();
    return {
      ok: true,
      message: "Profile saved. Next: fill in the Investment agreement on the right →",
    };
  }

  await db.insert(investors).values(values);
  revalidateInvestorPages();
  redirect("/investors?step=agreement");
}

export async function upsertInvestorAgreement(
  _prev: InvestorActionResult | null,
  formData: FormData,
): Promise<InvestorActionResult> {
  await requireAdmin();

  const investorId = Number.parseInt(String(formData.get("investorId") ?? ""), 10);
  const agreementId = Number.parseInt(String(formData.get("agreementId") ?? ""), 10);
  const agreementHolder = String(formData.get("agreementHolder") ?? "").trim();
  const capitalCents = parseMoneyToCents(formData.get("capitalAmount"));
  const sharePercent = parseSharePercent(formData.get("sharePercent"));
  const agreementDateRaw = String(formData.get("agreementDate") ?? "").trim();
  const effectiveFromRaw = String(formData.get("effectiveFrom") ?? "").trim();
  const termsNotes = String(formData.get("termsNotes") ?? "").trim();

  if (!Number.isFinite(investorId) || investorId <= 0) {
    return { error: "Save the investor profile first (left panel)." };
  }
  if (!agreementHolder) return { error: "Agreement holder is required." };
  if (capitalCents <= 0) return { error: "Capital amount must be greater than zero." };
  if (sharePercent == null) return { error: "Share percent must be between 1 and 100." };

  const agreementDate = agreementDateRaw
    ? new Date(agreementDateRaw + "T00:00:00")
    : null;
  const effectiveFrom = effectiveFromRaw
    ? new Date(effectiveFromRaw + "T00:00:00")
    : null;

  const values = {
    investorId,
    agreementHolder,
    capitalCents,
    sharePercent,
    agreementDate,
    effectiveFrom,
    termsNotes: termsNotes || null,
  };

  if (Number.isFinite(agreementId) && agreementId > 0) {
    await db
      .update(investorAgreements)
      .set(values)
      .where(eq(investorAgreements.id, agreementId));
  } else {
    await db.insert(investorAgreements).values(values);
  }

  revalidateInvestorPages();
  return {
    ok: true,
    message: `Agreement saved — ${sharePercent}% share on net income. See her payout in the gold summary above.`,
  };
}

export async function recordMonthlyPayout(
  _prev: InvestorActionResult | null,
  formData: FormData,
): Promise<InvestorActionResult> {
  await requireAdmin();

  const investorId = Number.parseInt(String(formData.get("investorId") ?? ""), 10);
  const agreementId = Number.parseInt(String(formData.get("agreementId") ?? ""), 10);
  const year = Number.parseInt(String(formData.get("year") ?? ""), 10);
  const month = Number.parseInt(String(formData.get("month") ?? ""), 10);
  const markPaid = formData.get("markPaid") === "on";

  if (
    !Number.isFinite(investorId) ||
    !Number.isFinite(agreementId) ||
    !Number.isFinite(year) ||
    !Number.isFinite(month)
  ) {
    return { error: "Invalid payout request." };
  }

  if (isCurrentMonth(year, month)) {
    return {
      error:
        "The current month is still in progress — wait until the month ends before locking it.",
    };
  }

  const [agreement] = await db
    .select()
    .from(investorAgreements)
    .where(eq(investorAgreements.id, agreementId))
    .limit(1);

  if (!agreement) return { error: "Agreement not found." };

  const [existing] = await db
    .select({ id: investorPayouts.id, status: investorPayouts.status })
    .from(investorPayouts)
    .where(
      and(
        eq(investorPayouts.investorId, investorId),
        eq(investorPayouts.periodYear, year),
        eq(investorPayouts.periodMonth, month),
      ),
    )
    .limit(1);

  if (existing?.status === "Paid") {
    return { error: "This month is already marked paid and cannot be changed." };
  }

  const metrics = await computeMonthlyNetIncome(year, month);
  const payoutCents = investorShareCents(
    metrics.netIncomeCents,
    agreement.sharePercent,
  );

  const payload = {
    investorId,
    agreementId,
    periodYear: year,
    periodMonth: month,
    grossRevenueCents: metrics.grossRevenueCents,
    cogsCents: metrics.cogsCents,
    netIncomeCents: metrics.netIncomeCents,
    sharePercent: agreement.sharePercent,
    payoutCents,
    status: markPaid ? ("Paid" as const) : ("Accrued" as const),
    paidAt: markPaid ? new Date() : null,
  };

  if (existing) {
    await db
      .update(investorPayouts)
      .set(payload)
      .where(eq(investorPayouts.id, existing.id));
  } else {
    await db.insert(investorPayouts).values(payload);
  }

  revalidateInvestorPages();

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });

  const peso = (payoutCents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  });

  if (markPaid) {
    return {
      ok: true,
      message: `${monthLabel} locked and marked paid — ₱${peso} recorded.`,
    };
  }

  return {
    ok: true,
    message: `${monthLabel} accrued — investor share ₱${peso} is now locked. Mark paid after you disburse.`,
  };
}

export async function markPayoutPaid(
  _prev: InvestorActionResult | null,
  formData: FormData,
): Promise<InvestorActionResult> {
  await requireAdmin();

  const payoutId = Number.parseInt(String(formData.get("payoutId") ?? ""), 10);
  if (!Number.isFinite(payoutId) || payoutId <= 0) {
    return { error: "Invalid payout." };
  }

  const [row] = await db
    .select({
      status: investorPayouts.status,
      payoutCents: investorPayouts.payoutCents,
      periodYear: investorPayouts.periodYear,
      periodMonth: investorPayouts.periodMonth,
    })
    .from(investorPayouts)
    .where(eq(investorPayouts.id, payoutId))
    .limit(1);

  if (!row) return { error: "Payout not found." };
  if (row.status === "Paid") return { error: "Already marked paid." };

  await db
    .update(investorPayouts)
    .set({ status: "Paid", paidAt: new Date() })
    .where(eq(investorPayouts.id, payoutId));

  revalidateInvestorPages();

  const monthLabel = new Date(row.periodYear, row.periodMonth - 1, 1).toLocaleDateString(
    "en-PH",
    { month: "long", year: "numeric" },
  );
  const peso = (row.payoutCents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  });

  return { ok: true, message: `${monthLabel} marked paid — ₱${peso} disbursed.` };
}

/** Undo an accidental accrue — only works while status is Accrued (not yet paid). */
export async function undoAccrual(
  _prev: InvestorActionResult | null,
  formData: FormData,
): Promise<InvestorActionResult> {
  await requireAdmin();

  const payoutId = Number.parseInt(String(formData.get("payoutId") ?? ""), 10);
  if (!Number.isFinite(payoutId) || payoutId <= 0) {
    return { error: "Invalid payout." };
  }

  const [row] = await db
    .select({
      status: investorPayouts.status,
      periodYear: investorPayouts.periodYear,
      periodMonth: investorPayouts.periodMonth,
    })
    .from(investorPayouts)
    .where(eq(investorPayouts.id, payoutId))
    .limit(1);

  if (!row) return { error: "Payout not found." };
  if (row.status === "Paid") {
    return { error: "Cannot undo a payout that was already marked paid." };
  }

  await db.delete(investorPayouts).where(eq(investorPayouts.id, payoutId));
  revalidateInvestorPages();

  const monthLabel = new Date(row.periodYear, row.periodMonth - 1, 1).toLocaleDateString(
    "en-PH",
    { month: "long", year: "numeric" },
  );

  return {
    ok: true,
    message: `${monthLabel} accrual removed — month is open again.`,
  };
}
