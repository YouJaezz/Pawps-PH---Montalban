import { cache } from "react";
import { inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { deliveryLogs } from "@/db/schema";

export const getPendingDeliveryCount = cache(async () => {
  const statuses = ["Queued", "Booked", "Picked Up"] as const;
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(deliveryLogs)
    .where(inArray(deliveryLogs.status, [...statuses]));
  return Number(rows[0]?.count ?? 0);
});
