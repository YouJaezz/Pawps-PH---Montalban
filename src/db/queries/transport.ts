import { db } from "@/db";
import { transportPricingSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getTransportPricing() {
  const [row] = await db
    .select()
    .from(transportPricingSettings)
    .where(eq(transportPricingSettings.id, 1))
    .limit(1);

  return (
    row ?? {
      id: 1,
      baseFeeCents: 15000,
      perKmCents: 2500,
      minimumFeeCents: 15000,
      trafficPerMinCents: 800,
      stopLightFeeCents: 2000,
      updatedAt: new Date(),
    }
  );
}
