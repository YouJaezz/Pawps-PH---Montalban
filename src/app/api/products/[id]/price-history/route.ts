import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { priceHistory } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await ctx.params;
  const productId = Number.parseInt(id, 10);
  if (!Number.isFinite(productId) || productId <= 0) {
    return NextResponse.json({ error: "Invalid product." }, { status: 400 });
  }

  const rows = await db
    .select({
      id: priceHistory.id,
      priceKind: priceHistory.priceKind,
      oldPrice: priceHistory.oldPrice,
      newPrice: priceHistory.newPrice,
      changedByUserId: priceHistory.changedByUserId,
      changedAt: priceHistory.changedAt,
      reason: priceHistory.reason,
    })
    .from(priceHistory)
    .where(eq(priceHistory.productId, productId))
    .orderBy(desc(priceHistory.changedAt), desc(priceHistory.id))
    .limit(50);

  return NextResponse.json({ rows });
}

