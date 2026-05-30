"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { getTransportPricing } from "@/db/queries/transport";
import { transportPricingSettings } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";

function parseMoneyToCents(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  const n = Number(str);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export async function updateTransportPricing(formData: FormData) {
  await requireAuth();

  const baseFeeCents = parseMoneyToCents(formData.get("baseFee"));
  const perKmCents = parseMoneyToCents(formData.get("perKm"));
  const minimumFeeCents = parseMoneyToCents(formData.get("minimumFee"));
  const trafficPerMinCents = parseMoneyToCents(formData.get("trafficPerMin"));
  const stopLightFeeCents = parseMoneyToCents(formData.get("stopLightFee"));

  await db
    .insert(transportPricingSettings)
    .values({
      id: 1,
      baseFeeCents,
      perKmCents,
      minimumFeeCents,
      trafficPerMinCents,
      stopLightFeeCents,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: transportPricingSettings.id,
      set: {
        baseFeeCents,
        perKmCents,
        minimumFeeCents,
        trafficPerMinCents,
        stopLightFeeCents,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/transport");
}

export async function getTransportPricingAction() {
  await requireAuth();
  return getTransportPricing();
}
