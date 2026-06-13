import { BulkOrderModal } from "@/app/orders/BulkOrderModal";
import { DailySalesPanel } from "@/app/orders/DailySalesPanel";
import { OrdersBoard } from "@/app/orders/OrdersBoard";
import { OrdersPageTabs } from "@/app/orders/OrdersPageTabs";
import { QuickSellPanel } from "@/app/orders/QuickSellPanel";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { getDailySalesReport } from "@/db/queries/daily-sales";
import { getOrdersPageData } from "@/db/queries/orders-board";
import { resolvePhDateParams } from "@/lib/ph-time";

import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/roles";
import { redirect } from "next/navigation";

export default async function OrdersPage(props: {
  searchParams: Promise<{ tab?: string; date?: string }>;
}) {
  const session = await getSession();
  const admin = isAdmin(session?.role);
  const sp = await props.searchParams;
  const wantsDailySales = sp.tab === "daily-sales";

  if (wantsDailySales && !admin) {
    redirect("/orders?tab=orders");
  }

  const activeTab = wantsDailySales ? "daily-sales" : "orders";
  const { year, month, day } = resolvePhDateParams(sp.date);

  const [{ customerRows, quickSellProducts, boardRows, editableByOrderId }, dailyReport] =
    await Promise.all([
      getOrdersPageData(),
      admin ? getDailySalesReport(year, month, day) : Promise.resolve(null),
    ]);

  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col px-0 py-3">
        <PageHeader
          eyebrow="Sales & Orders"
          title={activeTab === "daily-sales" ? "Daily sales" : "Orders"}
          description={
            activeTab === "daily-sales"
              ? "Collections, unpaid balances, and payments for the selected date."
              : "New sales start as Pending · confirm before checkout · print receipt after"
          }
          actions={
            <>
              <QuickSellPanel products={quickSellProducts} customers={customerRows} />
              {admin ? (
                <BulkOrderModal
                  products={quickSellProducts}
                  customers={customerRows}
                />
              ) : null}
            </>
          }
        />

        {admin ? (
          <div className="mt-3 shrink-0">
            <OrdersPageTabs
              activeTab={activeTab}
              dateKey={dailyReport?.dateKey}
              showDailySales
            />
          </div>
        ) : null}

        <div className="mt-3 min-h-0 flex-1">
          {activeTab === "daily-sales" && dailyReport ? (
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
