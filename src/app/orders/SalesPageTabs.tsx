"use client";

import Link from "next/link";

import {
  ordersDailySalesHref,
  ordersDeliveryHref,
  ordersHref,
} from "@/lib/nav-urls";

export function SalesPageTabs(props: {
  activeTab: "orders" | "daily-sales" | "delivery";
  dateKey?: string;
  showDailySales?: boolean;
  showDelivery?: boolean;
  staffTodayOnly?: boolean;
  deliveryHint?: string;
}) {
  const dailyHref = props.staffTodayOnly
    ? ordersDailySalesHref
    : props.dateKey
      ? `${ordersDailySalesHref}&date=${props.dateKey}`
      : ordersDailySalesHref;

  const tabClass = (active: boolean) =>
    active
      ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200";

  return (
    <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
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
      {props.showDelivery ? (
        <Link
          href={ordersDeliveryHref}
          className={`rounded-t-lg border px-4 py-2 text-xs font-medium ${tabClass(props.activeTab === "delivery")}`}
        >
          Delivery log
          {props.deliveryHint ? (
            <span className="ml-1.5 font-normal text-[10px] opacity-70">
              {props.deliveryHint}
            </span>
          ) : null}
        </Link>
      ) : null}
    </div>
  );
}
