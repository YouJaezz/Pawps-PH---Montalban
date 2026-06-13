"use client";

import Link from "next/link";

export function OrdersPageTabs(props: {
  activeTab: "orders" | "daily-sales";
  dateKey?: string;
  showDailySales?: boolean;
}) {
  const ordersHref = "/orders?tab=orders";
  const dailyHref = props.dateKey
    ? `/orders?tab=daily-sales&date=${props.dateKey}`
    : "/orders?tab=daily-sales";

  const tabClass = (active: boolean) =>
    active
      ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
      : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-800";

  return (
    <div className="flex gap-2 border-b border-zinc-200 pb-2">
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
