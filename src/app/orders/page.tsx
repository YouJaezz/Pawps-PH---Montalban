import { BulkOrderModal } from "@/app/orders/BulkOrderModal";
import { DailySalesPanel } from "@/app/orders/DailySalesPanel";
import { ExcessSaleModal } from "@/app/orders/ExcessSaleModal";
import { OrdersBoard } from "@/app/orders/OrdersBoard";
import { OrdersPageTabs } from "@/app/orders/OrdersPageTabs";
import { QuickSellPanel } from "@/app/orders/QuickSellPanel";
import { AppShell } from "@/components/AppShell";
import { getDailySalesReport } from "@/db/queries/daily-sales";
import { getOrdersPageData } from "@/db/queries/orders-board";
import { resolvePhDateParams } from "@/lib/ph-time";

import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/roles";

export default async function OrdersPage(props: {
  searchParams: Promise<{ tab?: string; date?: string }>;
}) {
  const session = await getSession();
  const admin = isAdmin(session?.role);
  const sp = await props.searchParams;
  const activeTab = sp.tab === "daily-sales" ? "daily-sales" : "orders";
  const { year, month, day } = resolvePhDateParams(sp.date);

  const [{ customerRows, quickSellProducts, boardRows, editableByOrderId }, dailyReport] =
    await Promise.all([
      getOrdersPageData(),
      getDailySalesReport(year, month, day),
    ]);

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
            {admin ? (
              <>
                <BulkOrderModal
                  products={quickSellProducts}
                  customers={customerRows}
                />
                <ExcessSaleModal
                  products={quickSellProducts}
                  customers={customerRows}
                />
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-3 shrink-0">
          <OrdersPageTabs activeTab={activeTab} dateKey={dailyReport.dateKey} />
        </div>

        <div className="mt-3 min-h-0 flex-1">
          {activeTab === "daily-sales" ? (
            <DailySalesPanel report={dailyReport} adminMode={admin} />
          ) : (
            <OrdersBoard
              rows={boardRows}
              editableByOrderId={admin ? editableByOrderId : {}}
              adminMode={admin}
              staffCanUpdateStatus={!admin}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
