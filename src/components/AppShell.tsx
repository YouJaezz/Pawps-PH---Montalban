import Link from "next/link";
import { ReactNode } from "react";

import { getPendingDeliveryCount } from "@/db/queries/delivery-nav";
import { getUserOpenShift } from "@/db/queries/time-attendance";
import { logoutAction } from "@/app/login/actions";
import { BrandLogo } from "@/components/BrandLogo";
import { MobileNav } from "@/components/MobileNav";
import { SidebarShiftStatus } from "@/components/SidebarShiftStatus";
import { TeamChatNavLink } from "@/components/TeamChatNavLink";
import { TeamChatNotifier } from "@/components/TeamChatNotifier";
import { BRAND_TAGLINE } from "@/lib/brand";
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

function ShellBody(props: {
  children: ReactNode;
  admin: boolean;
  session: SessionUser | null;
  pendingDeliveryCount: number;
  openShiftClockIn: string | null;
}) {
  return (
    <>
      <div className="mx-auto flex h-full w-full max-w-none gap-4 px-4 py-4 pb-20 md:pb-4 lg:px-6 lg:py-6">
        <aside className="hidden w-64 shrink-0 print:hidden md:block">
          <div className="sticky top-0 flex max-h-[calc(100dvh-3rem)] flex-col rounded-2xl border border-brand-blue/20 bg-brand-gradient p-4 shadow-[0_0_40px_rgba(14,109,227,0.06)]">
            <BrandLogo size="md" />
            <div className="mt-2 text-xs text-zinc-500">{BRAND_TAGLINE}</div>
            <div className="mt-4 flex-1 space-y-1 overflow-y-auto">
              {props.admin ? (
                <>
                  <NavItem href="/" label="Dashboard" />
                  <NavItem href="/reports" label="Reports" hint="insights" />
                  <NavItem href="/payroll" label="Payroll" hint="employees" />
                  <NavItem href="/investors" label="Investors" hint="confidential" />
                </>
              ) : null}
              <NavItem href="/products" label="Inventory" hint={props.admin ? "CRUD" : "add stock"} />
              <NavItem href="/orders" label="Sales & Orders" hint="quick sell" />
              <NavItem href="/attendance" label="Time In / Out" hint="attendance" />
              <TeamChatNavLink />
              {props.admin ? (
                <>
                  <NavItem href="/customers" label="Customers" hint="CRM" />
                  <NavItem href="/preorders" label="Pre-orders" hint="customers" />
                  <NavItem
                    href="/delivery"
                    label="Delivery Log"
                    hint={
                      props.pendingDeliveryCount > 0
                        ? `${props.pendingDeliveryCount} pending`
                        : "—"
                    }
                  />
                  <NavItem href="/suppliers" label="Suppliers" hint="catalog" />
                  <NavItem href="/transport" label="Pet Transport" hint="driver" />
                  <NavItem href="/settings" label="Settings" hint="admin" />
                </>
              ) : (
                <NavItem href="/customers" label="Customers" hint="checkout" />
              )}
            </div>
            {props.session ? (
              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="truncate text-[11px] text-zinc-400">
                  {props.session.name ?? props.session.email}
                </div>
                <div className="truncate text-[10px] text-zinc-600">
                  {roleLabel(props.session.role)}
                </div>
                <SidebarShiftStatus clockInAt={props.openShiftClockIn} />
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

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto print:overflow-visible">
          {props.children}
        </main>
      </div>

      <MobileNav admin={props.admin} />
    </>
  );
}

export async function AppShell(props: {
  children: ReactNode;
  session?: SessionUser | null;
}) {
  const session = props.session ?? (await getSession());
  const admin = isAdmin(session?.role);
  const [pendingDeliveryCount, openShift] = await Promise.all([
    admin ? getPendingDeliveryCount() : Promise.resolve(0),
    session ? getUserOpenShift(session.userId) : Promise.resolve(null),
  ]);

  const body = (
    <ShellBody
      admin={admin}
      session={session}
      pendingDeliveryCount={pendingDeliveryCount}
      openShiftClockIn={openShift?.clockInAt.toISOString() ?? null}
    >
      {props.children}
    </ShellBody>
  );

  return (
    <div className="h-dvh overflow-hidden bg-brand-black text-zinc-50">
      {session ? (
        <TeamChatNotifier
          userId={session.userId}
          userName={session.name ?? session.email}
          isAdmin={admin}
        >
          {body}
        </TeamChatNotifier>
      ) : (
        body
      )}
    </div>
  );
}
