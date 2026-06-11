import { NextResponse } from "next/server";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { desc } from "drizzle-orm";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function GET() {
  await requireAdmin();

  const now = new Date();
  const start = startOfDay(now);

  const rows = await db
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
      createdAt: orders.createdAt,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt));

  const header = [
    "order_id",
    "customer_name",
    "location",
    "store_type",
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
      const createdAt = r.createdAt ? new Date(r.createdAt) : null;
      const cols = [
        r.id,
        JSON.stringify(r.customerName),
        JSON.stringify(r.location ?? ""),
        r.storeType,
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
      "content-disposition": `attachment; filename="daily-sales-${start.toISOString().slice(0, 10)}.csv"`,
    },
  });
}

