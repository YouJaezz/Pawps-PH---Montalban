"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  investorAgreements,
  investorPayouts,
  investors,
} from "@/db/schema";
import { computeMonthlyNetIncome } from "@/db/queries/investors";
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
  } else {
    await db.insert(investors).values(values);
  }

  revalidatePath("/investors");
  return { ok: true, message: "Investor profile saved." };
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
    return { error: "Select an investor first." };
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

  revalidatePath("/investors");
  return { ok: true, message: "Investment agreement saved." };
}

export async function recordMonthlyPayout(formData: FormData) {
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
    throw new Error("Invalid payout request.");
  }

  const [agreement] = await db
    .select()
    .from(investorAgreements)
    .where(eq(investorAgreements.id, agreementId))
    .limit(1);

  if (!agreement) throw new Error("Agreement not found.");

  const metrics = await computeMonthlyNetIncome(year, month);
  const payoutCents = Math.round(
    (metrics.netIncomeCents * agreement.sharePercent) / 100,
  );

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

  revalidatePath("/investors");
}

export async function markPayoutPaid(formData: FormData) {
  await requireAdmin();
  const payoutId = Number.parseInt(String(formData.get("payoutId") ?? ""), 10);
  if (!Number.isFinite(payoutId) || payoutId <= 0) {
    throw new Error("Invalid payout.");
  }

  await db
    .update(investorPayouts)
    .set({ status: "Paid", paidAt: new Date() })
    .where(eq(investorPayouts.id, payoutId));

  revalidatePath("/investors");
}
