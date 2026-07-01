import { BulkOrderModal } from "@/app/orders/BulkOrderModal";
import { DailySalesPanel } from "@/app/orders/DailySalesPanel";
import { DeliveryPanel } from "@/app/delivery/DeliveryPanel";
import { OrdersBoard } from "@/app/orders/OrdersBoard";
import { QuickSellPanel } from "@/app/orders/QuickSellPanel";
import { SalesPageTabs } from "@/app/orders/SalesPageTabs";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { getPendingDeliveryCount } from "@/db/queries/delivery-nav";
import { getDailySalesReport } from "@/db/queries/daily-sales";
import { getOrdersPageData } from "@/db/queries/orders-board";
import { phNow, phTodayDateKey, resolvePhDateParams } from "@/lib/ph-time";
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
  const wantsDelivery = sp.tab === "delivery";
  const todayKey = phTodayDateKey();

  if (!admin && (wantsDelivery || (wantsDailySales && sp.date && sp.date !== todayKey))) {
    redirect(wantsDelivery ? "/orders?tab=orders" : "/orders?tab=daily-sales");
  }

  const activeTab = wantsDelivery
    ? "delivery"
    : wantsDailySales
      ? "daily-sales"
      : "orders";

  const { year, month, day } =
    wantsDailySales && !admin ? phNow() : resolvePhDateParams(sp.date);

  const [
    { customerRows, branches, quickSellProducts, boardRows, editableByOrderId },
    dailyReport,
    pendingDeliveryCount,
  ] = await Promise.all([
    getOrdersPageData(),
    wantsDailySales
      ? getDailySalesReport(year, month, day)
      : Promise.resolve(null),
    admin ? getPendingDeliveryCount() : Promise.resolve(0),
  ]);

  const title =
    activeTab === "delivery"
      ? "Delivery log"
      : activeTab === "daily-sales"
        ? "Daily sales"
        : "Orders";

  const description =
    activeTab === "delivery"
      ? "Queue deliveries, update status and fees — history is kept automatically."
      : activeTab === "daily-sales"
        ? admin
          ? "Collections, unpaid balances, and payments for the selected date."
          : "Today's collections, unpaid balances, and payments only."
        : "Pick branch when selling from home/other site · walk-in needs cart only · record after checkout";

  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col px-0 py-3">
        <PageHeader
          eyebrow="Sales & delivery"
          title={title}
          description={description}
          actions={
            activeTab === "orders" ? (
              <>
                <QuickSellPanel
                  products={quickSellProducts}
                  branches={branches}
                  customers={customerRows}
                />
                {admin ? (
                  <BulkOrderModal
                    products={quickSellProducts}
                    customers={customerRows}
                  />
                ) : null}
              </>
            ) : null
          }
        />

        <div className="mt-3 shrink-0">
          <SalesPageTabs
            activeTab={activeTab}
            dateKey={admin ? dailyReport?.dateKey : todayKey}
            showDailySales
            showDelivery={admin}
            staffTodayOnly={!admin}
            deliveryHint={
              pendingDeliveryCount > 0 ? `${pendingDeliveryCount} pending` : undefined
            }
          />
        </div>

        <div className="mt-3 min-h-0 flex-1">
          {activeTab === "delivery" ? (
            <DeliveryPanel />
          ) : activeTab === "daily-sales" && dailyReport ? (
            <DailySalesPanel
              report={dailyReport}
              adminMode={admin}
              todayOnly={!admin}
            />
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
