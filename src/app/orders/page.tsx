import { BulkOrderModal } from "@/app/orders/BulkOrderModal";
import type { OrderEditPayload } from "@/app/orders/OrderEditModal";
import { OrdersBoard } from "@/app/orders/OrdersBoard";
import { QuickSellPanel } from "@/app/orders/QuickSellPanel";
import { formatQuantityLabel, type SaleUnit } from "@/lib/order-line-math";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import { customers, orderItems, orders, products } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";

export default async function OrdersPage() {
  const [customerRows, recentOrders, quickSellProducts] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        contact: customers.contact,
        location: customers.location,
        totalSpend: customers.totalSpend,
      })
      .from(customers)
      .orderBy(customers.name),
    db
      .select({
        id: orders.id,
        customerName: orders.customerName,
        contact: orders.contact,
        location: orders.location,
        orderStatus: orders.orderStatus,
        totalAmount: orders.totalAmount,
        amountPaid: orders.amountPaid,
        paymentStatus: orders.paymentStatus,
        deliveryMethod: orders.deliveryMethod,
        storeType: orders.storeType,
        notes: orders.notes,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(50),
    db
      .select({
        id: products.id,
        name: products.name,
        brand: products.brand,
        variant: products.variant,
        retailPrice: products.retailPrice,
        bulkPrice: products.bulkPrice,
        stockQuantity: products.stockQuantity,
        stockUnit: products.stockUnit,
        kgPerSack: products.kgPerSack,
      })
      .from(products)
      .where(eq(products.archived, false)),
  ]);

  const recentOrderIds = recentOrders.map((o) => o.id);
  const recentLines =
    recentOrderIds.length === 0
      ? []
      : await db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            quantity: orderItems.quantity,
            quantityTenths: orderItems.quantityTenths,
            saleUnit: orderItems.saleUnit,
            priceTier: orderItems.priceTier,
            unitPrice: orderItems.unitPrice,
            lineTotal: orderItems.lineTotal,
          })
          .from(orderItems)
          .where(inArray(orderItems.orderId, recentOrderIds));

  const productIdSet = Array.from(
    new Set(recentLines.map((l) => l.productId)),
  );
  const productRows =
    productIdSet.length === 0
      ? []
      : await db
          .select({
            id: products.id,
            name: products.name,
            brand: products.brand,
            variant: products.variant,
            stockUnit: products.stockUnit,
            kgPerSack: products.kgPerSack,
          })
          .from(products)
          .where(inArray(products.id, productIdSet));

  const productById = new Map(productRows.map((p) => [p.id, p]));
  const linesByOrder = new Map<number, string[]>();
  const editableByOrderId: Record<number, OrderEditPayload> = {};

  for (const o of recentOrders) {
    editableByOrderId[o.id] = {
      id: o.id,
      customerName: o.customerName,
      contact: o.contact,
      location: o.location,
      deliveryMethod: o.deliveryMethod,
      storeType: o.storeType,
      notes: o.notes,
      orderStatus: o.orderStatus,
      lines: [],
    };
  }

  for (const l of recentLines) {
    const p = productById.get(l.productId);
    if (!p) continue;
    const qtyLabel = formatQuantityLabel(
      l.saleUnit as SaleUnit,
      l.quantity,
      l.quantityTenths,
    );
    const label = `${p.name}${p.variant ? ` (${p.variant})` : ""} · ${qtyLabel}`;
    const arr = linesByOrder.get(l.orderId) ?? [];
    arr.push(label);
    linesByOrder.set(l.orderId, arr);

    const payload = editableByOrderId[l.orderId];
    if (payload) {
      payload.lines.push({
        id: l.id,
        productId: l.productId,
        productLabel: `${p.name}${p.variant ? ` (${p.variant})` : ""}`,
        quantity: l.quantity,
        quantityTenths: l.quantityTenths,
        saleUnit: l.saleUnit as SaleUnit,
        priceTier: l.priceTier as "Retail" | "Bulk",
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        stockUnit: p.stockUnit,
        kgPerSack: p.kgPerSack,
      });
    }
  }

  const boardRows = recentOrders.map((o) => {
    const items = linesByOrder.get(o.id) ?? [];
    return {
      id: o.id,
      customerName: o.customerName,
      contact: o.contact,
      location: o.location,
      orderStatus: o.orderStatus,
      totalAmount: o.totalAmount,
      amountPaid: o.amountPaid,
      paymentStatus: o.paymentStatus,
      deliveryMethod: o.deliveryMethod,
      storeType: o.storeType,
      createdAt: o.createdAt.toISOString(),
      itemsSummary: items[0] ?? "—",
      itemCount: items.length,
    };
  });

  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col px-0 py-3">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-zinc-500">Sales & Orders</div>
            <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Search customers to autofill · track fulfillment & payments
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <QuickSellPanel
              products={quickSellProducts}
              customers={customerRows}
            />
            <BulkOrderModal
              products={quickSellProducts}
              customers={customerRows}
            />
            <a
              href="/api/export/daily-sales.csv"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-zinc-200 hover:bg-white/10"
            >
              Export CSV
            </a>
          </div>
        </div>

        <div className="mt-3 min-h-0 flex-1">
          <OrdersBoard rows={boardRows} editableByOrderId={editableByOrderId} />
        </div>
      </div>
    </AppShell>
  );
}
