"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { investorFunds, INVESTOR_FUND_TYPES } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { parseMoneyToCents } from "@/lib/money";
import { parsePhDateInput } from "@/lib/payroll-payment";
import { getSession } from "@/lib/session";

export type InvestorFundsActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function revalidateInvestorFunds() {
  revalidatePath("/investor-funds");
  revalidatePath("/investors");
  revalidatePath("/");
}

export async function recordInvestorFundEntry(
  _prev: InvestorFundsActionResult | null,
  formData: FormData,
): Promise<InvestorFundsActionResult> {
  await requireAdmin();
  const session = await getSession();

  const investorName = String(formData.get("investorName") ?? "").trim();
  const amountCents = parseMoneyToCents(formData.get("amount"));
  const typeRaw = String(formData.get("type") ?? "").trim();
  const type = (INVESTOR_FUND_TYPES as readonly string[]).includes(typeRaw)
    ? (typeRaw as (typeof INVESTOR_FUND_TYPES)[number])
    : ("contribution" as const);
  const dateRaw = String(formData.get("date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!investorName) return { error: "Investor name is required." };
  if (amountCents <= 0) return { error: "Amount must be greater than zero." };

  const date = parsePhDateInput(dateRaw);
  if (!date) return { error: "Enter a valid date." };

  await db.insert(investorFunds).values({
    investorName,
    amountCents,
    type,
    date,
    notes,
    recordedByUserId: session?.userId ?? null,
  });

  revalidateInvestorFunds();
  return { ok: true, message: "Entry recorded." };
}

