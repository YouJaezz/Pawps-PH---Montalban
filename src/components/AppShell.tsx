import Link from "next/link";
import { ReactNode } from "react";

import { getPendingDeliveryCount } from "@/db/queries/delivery-nav";
import { logoutAction } from "@/app/login/actions";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { isAdmin, roleLabel } from "@/lib/roles";
import { getSession, type SessionUser } from "@/lib/session";

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

export async function AppShell(props: {
  children: ReactNode;
  session?: SessionUser | null;
}) {
  const session = props.session ?? (await getSession());
  const admin = isAdmin(session?.role);
  const pendingDeliveryCount = admin ? await getPendingDeliveryCount() : 0;

  return (
    <div className="h-dvh overflow-hidden bg-[#07070a] text-zinc-50">
      <div className="mx-auto flex h-full w-full max-w-none gap-4 px-4 py-4 lg:px-6 lg:py-6">
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-0 flex max-h-[calc(100dvh-3rem)] flex-col rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold tracking-tight">
              {BRAND_NAME}
            </div>
            <div className="mt-1 text-xs text-zinc-400">{BRAND_TAGLINE}</div>
            <div className="mt-4 flex-1 space-y-1 overflow-y-auto">
              {admin ? (
                <>
                  <NavItem href="/" label="Dashboard" />
                  <NavItem href="/reports" label="Reports" hint="insights" />
                  <NavItem href="/payroll" label="Payroll" hint="employees" />
                  <NavItem href="/investors" label="Investors" hint="confidential" />
                </>
              ) : null}
              <NavItem href="/products" label="Inventory" hint={admin ? "CRUD" : "add stock"} />
              <NavItem href="/orders" label="Sales & Orders" hint="POS" />
              <NavItem href="/attendance" label="Time In / Out" hint="attendance" />
              {admin ? (
                <>
                  <NavItem href="/customers" label="Customers" hint="CRM" />
                  <NavItem href="/preorders" label="Pre-orders" hint="customers" />
                  <NavItem
                    href="/delivery"
                    label="Delivery Log"
                    hint={
                      pendingDeliveryCount > 0
                        ? `${pendingDeliveryCount} pending`
                        : "—"
                    }
                  />
                  <NavItem href="/suppliers" label="Suppliers" hint="catalog" />
                  <NavItem
                    href="/suppliers/normalize"
                    label="Pricelist AI"
                    hint="normalize"
                  />
                  <NavItem href="/transport" label="Pet Transport" hint="driver" />
                  <NavItem href="/pos" label="Future POS" hint="placeholder" />
                  <NavItem href="/settings" label="Settings" hint="admin" />
                </>
              ) : (
                <NavItem href="/customers" label="Customers" hint="checkout" />
              )}
            </div>
            {session ? (
              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="truncate text-[11px] text-zinc-400">
                  {session.name ?? session.email}
                </div>
                <div className="truncate text-[10px] text-zinc-600">
                  {roleLabel(session.role)}
                  {!admin ? " · on duty" : ""}
                </div>
                <form action={logoutAction} className="mt-2">
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-zinc-300 hover:bg-white/5"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{props.children}</main>
      </div>
    </div>
  );
}
