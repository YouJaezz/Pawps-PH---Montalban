import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { investorAgreements, investors } from "@/db/schema";
import { phMonthBounds, phNow } from "@/lib/ph-time";

/** Ensure every active investor has a default agreement (10% · ₱50k). */
export async function ensureDefaultAgreement(investorId: number) {
  const [existing] = await db
    .select()
    .from(investorAgreements)
    .where(
      and(
        eq(investorAgreements.investorId, investorId),
        eq(investorAgreements.active, true),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const { year, month } = phNow();
  const { start: effectiveFrom } = phMonthBounds(year, month);

  const [created] = await db
    .insert(investorAgreements)
    .values({
      investorId,
      agreementHolder: "The PAWps PH — Montalban",
      capitalCents: 5_000_000,
      sharePercent: 10,
      agreementDate: new Date(),
      effectiveFrom,
      termsNotes:
        "10% of monthly net income from collected sales minus COGS.",
    })
    .returning();

  return created ?? null;
}

export async function ensurePrimaryInvestorSetup() {
  const [investor] = await db
    .select()
    .from(investors)
    .where(eq(investors.active, true))
    .orderBy(investors.fullName)
    .limit(1);

  if (!investor) return { investor: null, agreement: null };

  const agreement = await ensureDefaultAgreement(investor.id);
  return { investor, agreement };
}
