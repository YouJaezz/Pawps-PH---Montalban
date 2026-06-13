"use client";

import Link from "next/link";

export function OrdersPageTabs(props: {
  activeTab: "orders" | "daily-sales";
  dateKey?: string;
  showDailySales?: boolean;
  staffTodayOnly?: boolean;
}) {
  const ordersHref = "/orders?tab=orders";
  const dailyHref = props.staffTodayOnly
    ? "/orders?tab=daily-sales"
    : props.dateKey
      ? `/orders?tab=daily-sales&date=${props.dateKey}`
      : "/orders?tab=daily-sales";

  const tabClass = (active: boolean) =>
    active
      ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200";

  return (
    <div className="flex gap-2 border-b border-white/10 pb-2">
      <Link
        href={ordersHref}
        className={`rounded-t-lg border px-4 py-2 text-xs font-medium ${tabClass(props.activeTab === "orders")}`}
      >
        Orders
      </Link>
      {props.showDailySales !== false ? (
        <Link
          href={dailyHref}
          className={`rounded-t-lg border px-4 py-2 text-xs font-medium ${tabClass(props.activeTab === "daily-sales")}`}
        >
          Daily sales
        </Link>
      ) : null}
    </div>
  );
}
