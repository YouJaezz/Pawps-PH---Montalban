import { PreOrderCreateForm } from "@/app/preorders/PreOrderCreateForm";
import { PreOrderTable } from "@/app/preorders/PreOrderTable";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import {
  getPreOrderStockHints,
  resolvePreOrderItemStockHint,
} from "@/lib/preorder-fulfillment";
import { preOrderItems, preOrders, products, supplierCatalogItems, suppliers } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";

export default async function PreOrdersPage() {
  const [supplierRows, inventoryProducts, catalogRows, orderRows] = await Promise.all([
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
        id: supplierCatalogItems.id,
        itemName: supplierCatalogItems.itemName,
        brand: supplierCatalogItems.brand,
        variant: supplierCatalogItems.variant,
        itemType: supplierCatalogItems.itemType,
      })
      .from(supplierCatalogItems)
      .orderBy(supplierCatalogItems.itemName)
      .limit(500),
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
            supplierCatalogItemId: preOrderItems.supplierCatalogItemId,
            itemName: preOrderItems.itemName,
            brand: preOrderItems.brand,
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

  const rows = await Promise.all(
    orderRows.map(async (o) => ({
      ...o,
      supplierName: supplierById.get(o.supplierId) ?? "—",
      items: await Promise.all(
        (itemsByOrder.get(o.id) ?? []).map(async ({ preOrderId, ...item }) => {
          void preOrderId;
          const stockOnHand =
            item.productId != null
              ? (stockByProduct.get(item.productId) ?? 0)
              : await resolvePreOrderItemStockHint({
                  productId: item.productId,
                  supplierCatalogItemId: item.supplierCatalogItemId,
                });
          return {
            ...item,
            stockOnHand,
            awaitingInventory: item.productId == null && stockOnHand == null,
          };
        }),
      ),
    })),
  );

  const pendingCount = rows.filter(
    (r) => !["Received", "Cancelled"].includes(r.status),
  ).length;

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-400">Pre-orders</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Customer pre-orders
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Reserve products for customers before stock arrives. You can pre-order items
          that are not in Inventory yet — add them in Inventory when stock comes in and
          they link automatically. Customer pre-orders move to Sales &amp; Orders when
          stock is enough. {pendingCount} active.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium text-zinc-100">New pre-order</div>
              <PreOrderCreateForm
                inventoryProducts={inventoryProducts}
                suppliers={supplierRows}
                catalogItems={catalogRows}
              />
            </div>
          </div>

          <div className="xl:col-span-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium text-zinc-100">Pre-order list</div>
              <div className="mt-3">
                <PreOrderTable rows={rows} inventoryProducts={inventoryProducts} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
