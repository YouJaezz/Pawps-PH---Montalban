import Link from "next/link";
import { ReactNode } from "react";

import { db } from "@/db";
import { deliveryLogs } from "@/db/schema";
import { inArray, sql } from "drizzle-orm";

function NavItem(props: { href: string; label: string; hint?: string }) {
  return (
    <Link
      href={props.href}
      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
    >
      <span>{props.label}</span>
      {props.hint ? (
        <span className="text-[11px] text-zinc-500">{props.hint}</span>
      ) : null}
    </Link>
  );
}

async function getPendingDeliveryCount() {
  const statuses = ["Queued", "Booked", "Picked Up"] as const;
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(deliveryLogs)
    .where(inArray(deliveryLogs.status, [...statuses]));
  return Number(rows[0]?.count ?? 0);
}

export async function AppShell(props: { children: ReactNode }) {
  const pendingDeliveryCount = await getPendingDeliveryCount();
  return (
    <div className="h-dvh overflow-hidden bg-[#07070a] text-zinc-50">
      <div className="mx-auto flex h-full w-full max-w-none gap-4 px-4 py-4 lg:px-6 lg:py-6">
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-0 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold tracking-tight">
              Pet Pro Manager
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              PH pet supplies ERP
            </div>
            <div className="mt-4 space-y-1">
              <NavItem href="/" label="Dashboard" />
              <NavItem href="/products" label="Inventory" hint="CRUD" />
              <NavItem href="/orders" label="Sales & Orders" hint="next" />
              <NavItem href="/customers" label="Customers" hint="next" />
              <NavItem
                href="/delivery"
                label="Delivery Log"
                hint={
                  pendingDeliveryCount > 0 ? `${pendingDeliveryCount} pending` : "—"
                }
              />
              <NavItem href="/reports" label="Reports" hint="insights" />
              <NavItem href="/suppliers" label="Suppliers" hint="catalog" />
              <NavItem href="/transport" label="Pet Transport" hint="new" />
              <NavItem href="/pos" label="Future POS" hint="placeholder" />
            </div>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{props.children}</main>
      </div>
    </div>
  );
}

