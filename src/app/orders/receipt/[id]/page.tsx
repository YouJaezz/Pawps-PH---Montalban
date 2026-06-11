import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderReceiptView } from "@/app/orders/OrderReceiptView";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";
import { formatQuantityLabel, type SaleUnit } from "@/lib/order-line-math";
import type { OrderReceiptData } from "@/lib/order-receipt";
import { eq, inArray } from "drizzle-orm";

export default async function OrderReceiptPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id: idRaw } = await props.params;
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id)) notFound();

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) notFound();

  const lines = await db
    .select({
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      quantityTenths: orderItems.quantityTenths,
      saleUnit: orderItems.saleUnit,
      priceTier: orderItems.priceTier,
      isExcessSale: orderItems.isExcessSale,
      lineNote: orderItems.lineNote,
      unitPrice: orderItems.unitPrice,
      lineTotal: orderItems.lineTotal,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, id));

  const productIds = Array.from(new Set(lines.map((l) => l.productId)));
  const productRows =
    productIds.length === 0
      ? []
      : await db
          .select({ id: products.id, name: products.name })
          .from(products)
          .where(inArray(products.id, productIds));
  const productById = new Map(productRows.map((p) => [p.id, p.name]));

  const receipt: OrderReceiptData = {
    orderId: order.id,
    customerName: order.customerName,
    contact: order.contact,
    location: order.location,
    storeType: order.storeType,
    deliveryMethod: order.deliveryMethod,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    discountNote: order.discountNote,
    totalAmount: order.totalAmount,
    amountPaid: order.amountPaid,
    createdAt: order.createdAt.toISOString(),
    cashierName: order.cashierName,
    lines: lines.map((line) => ({
      label: productById.get(line.productId) ?? "Item",
      qtyLabel: line.isExcessSale
        ? (line.lineNote?.match(/^Excess\/bonus stock — (.+?) — no inventory/)?.[1] ??
          "bonus stock")
        : formatQuantityLabel(
            line.saleUnit as SaleUnit,
            line.quantity,
            line.quantityTenths,
          ),
      priceTier: line.isExcessSale ? "Excess" : line.priceTier,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      lineNote: line.lineNote,
      isExcessSale: line.isExcessSale,
    })),
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-0 py-4 print:py-0">
        <div className="mb-4 print:hidden">
          <Link href="/orders" className="text-xs text-zinc-400 hover:text-zinc-200">
            ← Back to orders
          </Link>
        </div>
        <OrderReceiptView receipt={receipt} />
      </div>
    </AppShell>
  );
}
