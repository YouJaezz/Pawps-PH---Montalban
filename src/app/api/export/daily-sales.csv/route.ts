import { NextRequest, NextResponse } from "next/server";
import { and, desc, gte, lt } from "drizzle-orm";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { getActiveBranches } from "@/lib/branch-stock";
import {
  normalizeOrderCreatedAt,
  orderCreatedMsColumn,
} from "@/lib/order-timestamp";
import { phDayBounds, resolvePhDateParams } from "@/lib/ph-time";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export async function GET(req: NextRequest) {
  await requireAdmin();

  const dateParam = req.nextUrl.searchParams.get("date") ?? undefined;
  const { year, month, day } = resolvePhDateParams(dateParam);
  const { start, end } = phDayBounds(year, month, day);
  const dateKey = `${year}-${pad2(month)}-${pad2(day)}`;

  const [rows, activeBranches] = await Promise.all([
    db
      .select({
      id: orders.id,
      customerName: orders.customerName,
      location: orders.location,
      subtotalCents: orders.subtotalCents,
      discountCents: orders.discountCents,
      discountNote: orders.discountNote,
      totalAmount: orders.totalAmount,
      amountPaid: orders.amountPaid,
      paymentStatus: orders.paymentStatus,
      deliveryMethod: orders.deliveryMethod,
      storeType: orders.storeType,
      branchId: orders.branchId,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, start),
        lt(orders.createdAt, end),
      ),
    )
    .orderBy(desc(orderCreatedMsColumn())),
    getActiveBranches(),
  ]);

  const branchNameById = new Map(activeBranches.map((b) => [b.id, b.name]));
  const defaultBranchName =
    activeBranches.find((b) => b.isDefault)?.name ?? "PAWPS Shop";

  const header = [
    "order_id",
    "customer_name",
    "location",
    "store_type",
    "branch",
    "delivery_method",
    "payment_status",
    "subtotal_php",
    "discount_php",
    "discount_note",
    "total_amount_php",
    "amount_paid_php",
    "created_at",
  ];

  const lines = [header.join(",")].concat(
    rows.map((r) => {
      const createdAt = r.createdAt
        ? normalizeOrderCreatedAt(r.createdAt)
        : null;
      const branchName = r.branchId
        ? (branchNameById.get(r.branchId) ?? defaultBranchName)
        : defaultBranchName;
      const cols = [
        r.id,
        JSON.stringify(r.customerName),
        JSON.stringify(r.location ?? ""),
        r.storeType,
        JSON.stringify(branchName),
        JSON.stringify(r.deliveryMethod ?? ""),
        r.paymentStatus,
        (r.subtotalCents / 100).toFixed(2),
        (r.discountCents / 100).toFixed(2),
        JSON.stringify(r.discountNote ?? ""),
        (r.totalAmount / 100).toFixed(2),
        (r.amountPaid / 100).toFixed(2),
        JSON.stringify(createdAt ? createdAt.toISOString() : ""),
      ];
      return cols.join(",");
    }),
  );

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="daily-sales-${dateKey}.csv"`,
    },
  });
}
