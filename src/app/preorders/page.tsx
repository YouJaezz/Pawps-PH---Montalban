import { createPreOrder } from "@/app/preorders/actions";
import { PreOrderTable } from "@/app/preorders/PreOrderTable";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import { getPreOrderStockHints } from "@/lib/preorder-fulfillment";
import { preOrderItems, preOrders, products, suppliers } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-300";

export default async function PreOrdersPage() {
  const [supplierRows, inventoryProducts, orderRows] = await Promise.all([
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .orderBy(suppliers.name),
    db
      .select({
        id: products.id,
        name: products.name,
        brand: products.brand,
        variant: products.variant,
        stockQuantity: products.stockQuantity,
        costPrice: products.costPrice,
      })
      .from(products)
      .where(eq(products.archived, false))
      .orderBy(products.name),
    db
      .select({
        id: preOrders.id,
        supplierId: preOrders.supplierId,
        status: preOrders.status,
        customerName: preOrders.customerName,
        expectedDate: preOrders.expectedDate,
        depositCents: preOrders.depositCents,
        totalCostCents: preOrders.totalCostCents,
        notes: preOrders.notes,
        fulfillmentOrderId: preOrders.fulfillmentOrderId,
        createdAt: preOrders.createdAt,
      })
      .from(preOrders)
      .orderBy(desc(preOrders.createdAt))
      .limit(100),
  ]);

  const supplierById = new Map(supplierRows.map((s) => [s.id, s.name]));

  const orderIds = orderRows.map((o) => o.id);
  const allItems =
    orderIds.length === 0
      ? []
      : await db
          .select({
            preOrderId: preOrderItems.preOrderId,
            id: preOrderItems.id,
            productId: preOrderItems.productId,
            itemName: preOrderItems.itemName,
            variant: preOrderItems.variant,
            quantity: preOrderItems.quantity,
            unitCostCents: preOrderItems.unitCostCents,
            lineTotalCents: preOrderItems.lineTotalCents,
            receivedQty: preOrderItems.receivedQty,
          })
          .from(preOrderItems)
          .where(inArray(preOrderItems.preOrderId, orderIds));

  const productIds = [
    ...new Set(
      allItems
        .map((item) => item.productId)
        .filter((id): id is number => id != null),
    ),
  ];
  const stockByProduct = await getPreOrderStockHints(productIds);

  const itemsByOrder = new Map<number, typeof allItems>();
  for (const item of allItems) {
    const list = itemsByOrder.get(item.preOrderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.preOrderId, list);
  }

  const rows = orderRows.map((o) => ({
    ...o,
    supplierName: supplierById.get(o.supplierId) ?? "—",
    items: (itemsByOrder.get(o.id) ?? []).map(({ preOrderId, ...item }) => {
      void preOrderId;
      return {
        ...item,
        stockOnHand:
          item.productId != null
            ? (stockByProduct.get(item.productId) ?? 0)
            : null,
      };
    }),
  }));

  const pendingCount = rows.filter(
    (r) => !["Received", "Cancelled"].includes(r.status),
  ).length;

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-600">Pre-orders</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Customer pre-orders
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Reserve products for customers before stock arrives. Fulfillment follows{" "}
          <strong className="font-medium text-zinc-700">inventory</strong> — restock
          from any supplier in Inventory, then the pre-order moves to Sales &amp;
          Orders automatically when stock is enough. {pendingCount} active.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm font-medium text-zinc-800">New pre-order</div>
              <form action={createPreOrder} className="mt-3 space-y-2.5">
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-600">
                    Inventory product *
                  </span>
                  <select name="productId" required className={inputClass}>
                    {inventoryProducts.length === 0 ? (
                      <option value="">Add products in Inventory first</option>
                    ) : (
                      inventoryProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.variant ? ` · ${p.variant}` : ""} — stock {p.stockQuantity}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-600">
                    Supplier (optional — your internal PO tracking)
                  </span>
                  <select name="supplierId" className={inputClass}>
                    <option value="">Auto from product / any</option>
                    {supplierRows.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-600">Quantity *</span>
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    defaultValue={1}
                    required
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-600">
                    Customer (optional pre-order for)
                  </span>
                  <input name="customerName" className={inputClass} />
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-600">Expected date</span>
                  <input name="expectedDate" type="date" className={inputClass} />
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-600">Deposit (₱)</span>
                  <input name="deposit" inputMode="decimal" className={inputClass} />
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[11px] text-zinc-600">Notes</span>
                  <input name="notes" className={inputClass} />
                </label>
                <button
                  type="submit"
                  disabled={inventoryProducts.length === 0}
                  className="w-full rounded-lg bg-zinc-50 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
                >
                  Create pre-order
                </button>
              </form>
            </div>
          </div>

          <div className="xl:col-span-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm font-medium text-zinc-800">Pre-order list</div>
              <div className="mt-3">
                <PreOrderTable rows={rows} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
