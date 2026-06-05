import { BulkOrderModal } from "@/app/orders/BulkOrderModal";
import { ExcessSaleModal } from "@/app/orders/ExcessSaleModal";
import { OrdersBoard } from "@/app/orders/OrdersBoard";
import { QuickSellPanel } from "@/app/orders/QuickSellPanel";
import { AppShell } from "@/components/AppShell";
import { getOrdersPageData } from "@/db/queries/orders-board";

export default async function OrdersPage() {
  const { customerRows, quickSellProducts, boardRows, editableByOrderId } =
    await getOrdersPageData();

  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col px-0 py-3">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-zinc-500">Sales & Orders</div>
            <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              New sales start as Pending · confirm before checkout · print receipt after
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
            <ExcessSaleModal
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
