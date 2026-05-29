import { addPayment, cancelOrder } from "@/app/orders/actions";
import { QuickSellPanel } from "@/app/orders/QuickSellPanel";
import { BulkOrderModal } from "@/app/orders/BulkOrderModal";
import { AppShell } from "@/components/AppShell";
import { ScrollableTable } from "@/components/ScrollableTable";
import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";
import { formatPhpFromCents } from "@/lib/money";
import { desc, eq, inArray } from "drizzle-orm";

export default async function OrdersPage() {
  const recentOrders = await db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      location: orders.location,
      orderStatus: orders.orderStatus,
      totalAmount: orders.totalAmount,
      amountPaid: orders.amountPaid,
      paymentStatus: orders.paymentStatus,
      deliveryMethod: orders.deliveryMethod,
      storeType: orders.storeType,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(25);

  const recentOrderIds = recentOrders.map((o) => o.id);
  const recentLines =
    recentOrderIds.length === 0
      ? []
      : await db
          .select({
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            quantity: orderItems.quantity,
            priceTier: orderItems.priceTier,
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
          })
          .from(products)
          .where(inArray(products.id, productIdSet));

  const productById = new Map(productRows.map((p) => [p.id, p]));
  const firstLineByOrder = new Map<number, string>();
  for (const l of recentLines) {
    if (firstLineByOrder.has(l.orderId)) continue;
    const p = productById.get(l.productId);
    if (!p) continue;
    firstLineByOrder.set(
      l.orderId,
      `${p.name}${p.variant ? ` (${p.variant})` : ""} × ${l.quantity}`,
    );
  }

  const quickSellProducts = await db
    .select({
      id: products.id,
      name: products.name,
      brand: products.brand,
      variant: products.variant,
      retailPrice: products.retailPrice,
      bulkPrice: products.bulkPrice,
      stockQuantity: products.stockQuantity,
    })
    .from(products)
    .where(eq(products.archived, false));

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-400">Sales & Orders</div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Quick Sell logs paid orders and deducts stock. Bulk orders support
              30% downpayment.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <QuickSellPanel products={quickSellProducts} />
            <BulkOrderModal products={quickSellProducts} />
            <a
              href="/api/export/daily-sales.csv"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
            >
              Export Daily Sales (CSV)
            </a>
          </div>
        </div>

        <div className="mt-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    Recent orders
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    Latest 25 orders.
                  </div>
                </div>
                <div className="text-xs text-zinc-400">
                  {recentOrders.length} shown
                </div>
              </div>

              <ScrollableTable maxHeight="max-h-[min(65vh,640px)]">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-white/5 text-left text-zinc-300">
                    <tr>
                      <th className="w-16 px-4 py-3 font-medium">Order</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="hidden px-4 py-3 font-medium md:table-cell">
                        Items
                      </th>
                      <th className="px-4 py-3 font-medium">Payment</th>
                      <th className="hidden px-4 py-3 font-medium lg:table-cell">
                        Method
                      </th>
                      <th className="hidden w-24 px-4 py-3 font-medium sm:table-cell">
                        Status
                      </th>
                      <th className="w-20 px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {recentOrders.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-zinc-400" colSpan={5}>
                          No orders yet — use Quick Sell to log your first sale.
                        </td>
                      </tr>
                    ) : (
                      recentOrders.map((o) => {
                        const itemsText = firstLineByOrder.get(o.id) ?? "—";
                        return (
                          <tr key={o.id} className="hover:bg-white/5">
                            <td className="px-4 py-3 text-zinc-200">#{o.id}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-zinc-50">
                                {o.customerName}
                              </div>
                              <div className="text-xs text-zinc-400">
                                {o.location ?? "—"} • {o.storeType}
                              </div>
                              <div className="mt-1 text-xs text-zinc-400 md:hidden">
                                {itemsText}
                                {o.deliveryMethod ? ` • ${o.deliveryMethod}` : ""}
                              </div>
                            </td>
                            <td className="hidden px-4 py-3 text-zinc-200 md:table-cell">
                              {itemsText}
                            </td>
                            <td className="px-4 py-3 text-zinc-200">
                              <div className="font-medium">
                                {formatPhpFromCents(o.amountPaid)} /{" "}
                                {formatPhpFromCents(o.totalAmount)}
                              </div>
                              <div className="text-xs text-zinc-400">
                                {o.paymentStatus}
                              </div>
                              {o.paymentStatus !== "Paid" ? (
                                <form
                                  action={addPayment}
                                  className="mt-2 flex items-center gap-2"
                                >
                                  <input
                                    type="hidden"
                                    name="orderId"
                                    value={o.id}
                                  />
                                  <input
                                    name="addAmount"
                                    inputMode="decimal"
                                    placeholder="₱ add"
                                    className="w-28 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-100 hover:bg-white/10"
                                  >
                                    Add
                                  </button>
                                </form>
                              ) : null}
                            </td>
                            <td className="hidden px-4 py-3 text-zinc-200 lg:table-cell">
                              {o.deliveryMethod ?? "—"}
                            </td>
                            <td className="hidden px-4 py-3 text-zinc-200 sm:table-cell">
                              {o.orderStatus}
                            </td>
                            <td className="px-4 py-3">
                              {o.orderStatus === "Active" ? (
                                <form action={cancelOrder}>
                                  <input
                                    type="hidden"
                                    name="orderId"
                                    value={o.id}
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200 hover:bg-amber-500/15"
                                  >
                                    Cancel
                                  </button>
                                </form>
                              ) : (
                                <span className="text-xs text-zinc-500">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </ScrollableTable>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

