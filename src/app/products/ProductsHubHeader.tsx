import Link from "next/link";
import { ReactNode } from "react";

import { SectionTabs } from "@/components/SectionTabs";
import {
  productsInventoryHref,
  productsShopCashHref,
  productsSuppliersHref,
  settingsBranchesHref,
} from "@/lib/nav-urls";

export function ProductsHubHeader(props: {
  activeTab: "inventory" | "shop-cash" | "suppliers";
  admin: boolean;
  actions?: ReactNode;
}) {
  const title =
    props.activeTab === "shop-cash"
      ? "Shop cash"
      : props.activeTab === "suppliers"
        ? "Suppliers"
        : "Stock & pricing";

  const description =
    props.activeTab === "shop-cash"
      ? "Track money leaving the shop — expenses, restock payments, and investor capital."
      : props.activeTab === "suppliers"
        ? "Supplier pricelists, price comparison, and catalog uploads."
        : "Totals include all branches. Move stock between locations from the edit screen.";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">Inventory & purchasing</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">{description}</p>
        </div>
        {props.actions ? (
          <div className="flex flex-wrap items-center gap-2">{props.actions}</div>
        ) : null}
      </div>

      {props.admin ? (
        <div className="mt-4">
          <SectionTabs
            activeTab={props.activeTab}
            tabs={[
              { id: "inventory", label: "Inventory", href: productsInventoryHref },
              { id: "shop-cash", label: "Shop cash", href: productsShopCashHref },
              { id: "suppliers", label: "Suppliers", href: productsSuppliersHref },
            ]}
          />
        </div>
      ) : null}
    </>
  );
}

export function InventoryAdminLinks() {
  return (
    <>
      <Link
        href={settingsBranchesHref}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5"
      >
        Branches
      </Link>
      <Link
        href={productsSuppliersHref}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5"
      >
        Suppliers
      </Link>
    </>
  );
}
