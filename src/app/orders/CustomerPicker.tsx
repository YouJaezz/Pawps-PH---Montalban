"use client";

import { useMemo, useState } from "react";

import { formatPhpFromCents } from "@/lib/money";

export type CustomerOption = {
  id: number;
  name: string;
  contact: string | null;
  location: string | null;
  totalSpend: number;
};

export function CustomerPicker(props: {
  customers: CustomerOption[];
  customerName: string;
  contact: string;
  location: string;
  customerId: string;
  onCustomerNameChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onCustomerIdChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);

  const matches = useMemo(() => {
    const q = props.customerName.trim().toLowerCase();
    if (q.length < 1) return props.customers.slice(0, 8);
    return props.customers
      .filter((c) => {
        const hay = `${c.name} ${c.contact ?? ""} ${c.location ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [props.customers, props.customerName]);

  function pickCustomer(c: CustomerOption) {
    props.onCustomerIdChange(String(c.id));
    props.onCustomerNameChange(c.name);
    props.onContactChange(c.contact ?? "");
    props.onLocationChange(c.location ?? "");
    setFocused(false);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <label className="block space-y-1">
          <span className="text-xs text-zinc-700">Customer *</span>
          <input
            name="customerName"
            required
            value={props.customerName}
            onChange={(e) => {
              props.onCustomerIdChange("");
              props.onCustomerNameChange(e.target.value);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            placeholder="Search or type name…"
            autoComplete="off"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-300"
          />
        </label>
        <input type="hidden" name="customerId" value={props.customerId} />

        {focused && matches.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-900 shadow-lg">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickCustomer(c)}
                  className="w-full px-3 py-2 text-left hover:bg-zinc-50"
                >
                  <div className="text-sm font-medium text-zinc-800">{c.name}</div>
                  <div className="text-[10px] text-zinc-600">
                    {[c.contact, c.location].filter(Boolean).join(" · ") ||
                      "No contact saved"}
                    {c.totalSpend > 0
                      ? ` · spent ${formatPhpFromCents(c.totalSpend)}`
                      : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-zinc-700">Contact</span>
          <input
            name="contact"
            value={props.contact}
            onChange={(e) => props.onContactChange(e.target.value)}
            placeholder="Phone / FB / Viber"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-300"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-zinc-700">Location</span>
          <input
            name="location"
            value={props.location}
            onChange={(e) => props.onLocationChange(e.target.value)}
            placeholder="Barangay / city"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-300"
          />
        </label>
      </div>
    </div>
  );
}
