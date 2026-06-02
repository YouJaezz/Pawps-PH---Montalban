"use client";

import { useMemo, useState } from "react";

import { createBulkOrder } from "@/app/orders/actions";
import {
  CustomerPicker,
  type CustomerOption,
} from "@/app/orders/CustomerPicker";
import { formatPhpFromCents } from "@/lib/money";

export type BulkOrderProduct = {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
  retailPrice: number;
  bulkPrice: number;
};

type Line = { productId: number; quantity: number };

export function BulkOrderModal(props: {
  products: BulkOrderProduct[];
  customers: CustomerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [priceTier, setPriceTier] = useState<"Bulk" | "Retail">("Bulk");
  const [lines, setLines] = useState<Line[]>([
    { productId: props.products[0]?.id ?? 0, quantity: 1 },
  ]);
  const [customerName, setCustomerName] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [customerId, setCustomerId] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return props.products;
    return props.products.filter((p) => {
      const label = `${p.name} ${p.brand} ${p.variant ?? ""}`.toLowerCase();
      return label.includes(q);
    });
  }, [props.products, search]);

  const priceById = useMemo(() => {
    const m = new Map<number, BulkOrderProduct>();
    for (const p of props.products) m.set(p.id, p);
    return m;
  }, [props.products]);

  const total = useMemo(() => {
    return lines.reduce((acc, l) => {
      const p = priceById.get(l.productId);
      if (!p) return acc;
      const unit = priceTier === "Bulk" ? p.bulkPrice : p.retailPrice;
      return acc + unit * (l.quantity || 0);
    }, 0);
  }, [lines, priceById, priceTier]);

  const deposit = Math.round(total * 0.3);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { productId: props.products[0]?.id ?? 0, quantity: 1 },
    ]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
      >
        Bulk Order
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-[96vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0b0b10] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-zinc-400">Orders</div>
                <div className="mt-1 text-xl font-semibold tracking-tight">
                  Bulk Order (30% deposit)
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Search products, add multiple lines, auto-calculates deposit.
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <form action={createBulkOrder} className="mt-6 space-y-4">
              <CustomerPicker
                customers={props.customers}
                customerName={customerName}
                contact={contact}
                location={location}
                customerId={customerId}
                onCustomerNameChange={setCustomerName}
                onContactChange={setContact}
                onLocationChange={setLocation}
                onCustomerIdChange={setCustomerId}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Price tier</div>
                  <select
                    name="priceTier"
                    value={priceTier}
                    onChange={(e) =>
                      setPriceTier(e.target.value as "Bulk" | "Retail")
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                  >
                    <option>Bulk</option>
                    <option>Retail</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Store type</div>
                  <select
                    name="storeType"
                    defaultValue="Online"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                  >
                    <option>Online</option>
                    <option>Walk-in</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Delivery method</div>
                  <select
                    name="deliveryMethod"
                    defaultValue="Lalamove"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                  >
                    <option>Montalban Free Delivery</option>
                    <option>Lalamove</option>
                    <option>Other</option>
                  </select>
                </label>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-100">Items</div>
                  <div className="flex items-center gap-3">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search products..."
                      className="w-64 max-w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                    />
                    <button
                      type="button"
                      onClick={addLine}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
                    >
                      + Add line
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {lines.map((l, idx) => {
                    const p = priceById.get(l.productId);
                    const unit = p
                      ? priceTier === "Bulk"
                        ? p.bulkPrice
                        : p.retailPrice
                      : 0;
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-12"
                      >
                        <div className="sm:col-span-7">
                          <div className="text-xs text-zinc-400">Product</div>
                          <select
                            name="productId"
                            value={l.productId}
                            onChange={(e) =>
                              updateLine(idx, {
                                productId: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                          >
                            {filtered.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} — {p.brand}
                                {p.variant ? ` (${p.variant})` : ""}
                              </option>
                            ))}
                          </select>
                          <div className="mt-1 text-xs text-zinc-500">
                            Unit: {formatPhpFromCents(unit)}
                          </div>
                        </div>

                        <div className="sm:col-span-3">
                          <div className="text-xs text-zinc-400">Qty</div>
                          <input
                            name="quantity"
                            inputMode="numeric"
                            value={l.quantity}
                            onChange={(e) =>
                              updateLine(idx, {
                                quantity: Number(e.target.value || "1"),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                          />
                          <div className="mt-1 text-xs text-zinc-500">
                            Line: {formatPhpFromCents(unit * l.quantity)}
                          </div>
                        </div>

                        <div className="flex items-center justify-end sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={lines.length <= 1}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/15 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-zinc-400">Total</div>
                  <div className="mt-1 text-lg font-semibold text-zinc-50">
                    {formatPhpFromCents(total)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-zinc-400">30% deposit</div>
                  <div className="mt-1 text-lg font-semibold text-zinc-50">
                    {formatPhpFromCents(deposit)}
                  </div>
                </div>
                <button
                  type="submit"
                  className="rounded-2xl bg-zinc-50 p-4 text-sm font-medium text-zinc-900 hover:bg-white"
                >
                  Create bulk order
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

