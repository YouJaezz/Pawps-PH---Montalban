"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink(props: { href: string; label: string }) {
  const pathname = usePathname();
  const active =
    props.href === "/"
      ? pathname === "/"
      : pathname === props.href || pathname.startsWith(`${props.href}/`);

  return (
    <Link
      href={props.href}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium ${
        active
          ? "bg-brand-blue/15 text-brand-blue"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
      }`}
    >
      {props.label}
    </Link>
  );
}

export function MobileNav(props: { admin: boolean }) {
  const cashierItems = [
    { href: "/orders", label: "Sales" },
    { href: "/products", label: "Stock" },
    { href: "/customers", label: "Customers" },
    { href: "/attendance", label: "Time" },
  ];

  const adminItems = [
    { href: "/", label: "Home" },
    { href: "/orders", label: "Sales" },
    { href: "/products", label: "Stock" },
    { href: "/customers", label: "Customers" },
    { href: "/payroll", label: "Payroll" },
    { href: "/settings", label: "Settings" },
  ];

  const items = props.admin ? adminItems : cashierItems;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#000000]/95 backdrop-blur md:hidden print:hidden">
      <div className="mx-auto flex max-w-lg gap-1 overflow-x-auto px-2 py-2">
        {items.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} />
        ))}
      </div>
    </nav>
  );
}
