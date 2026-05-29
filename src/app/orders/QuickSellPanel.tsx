"use client";

import { useMemo, useState } from "react";

import { quickSell } from "@/app/orders/actions";
import { formatPhpFromCents } from "@/lib/money";

export type QuickSellProduct = {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
  retailPrice: number;
  bulkPrice: number;
  stockQuantity: number;
};

export function QuickSellPanel(props: { products: QuickSellProduct[] }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<number>(
    props.products[0]?.id ?? 0,
  );
  const [priceTier, setPriceTier] = useState<"Retail" | "Bulk">("Retail");
  const [quantity, setQuantity] = useState(1);

  const product = useMemo(
    () => props.products.find((p) => p.id === productId),
    [props.products, productId],
  );

  const unitPrice =
    priceTier === "Bulk" ? product?.bulkPrice ?? 0 : product?.retailPrice ?? 0;
  const total = unitPrice * quantity;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
      >
        Quick Sell
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-[94vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0b0b10] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-zinc-400">Sales</div>
                <div className="mt-1 text-xl font-semibold tracking-tight">
                  Quick Sell
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Logs a paid sale and (optionally) deducts stock.
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <form action={quickSell} className="mt-6 space-y-4">
              <label className="space-y-1">
                <div className="text-xs text-zinc-300">Product *</div>
                <select
                  name="productId"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                  value={productId}
                  onChange={(e) => setProductId(Number(e.target.value))}
                >
                  {props.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.brand}
                      {p.variant ? ` (${p.variant})` : ""} | stock {p.stockQuantity}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Qty *</div>
                  <input
                    name="quantity"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value || "1"))}
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Price tier</div>
                  <select
                    name="priceTier"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                    value={priceTier}
                    onChange={(e) =>
                      setPriceTier(e.target.value as "Retail" | "Bulk")
                    }
                  >
                    <option>Retail</option>
                    <option>Bulk</option>
                  </select>
                </label>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-xs text-zinc-400">Total</div>
                  <div className="text-sm font-medium text-zinc-50">
                    {formatPhpFromCents(total)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Customer name *</div>
                  <input
                    name="customerName"
                    required
                    placeholder="Matches FB ordering workflow"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Location</div>
                  <input
                    name="location"
                    placeholder="e.g. Montalban"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    defaultValue="Montalban Free Delivery"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                  >
                    <option>Montalban Free Delivery</option>
                    <option>Lalamove</option>
                    <option>Other</option>
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-3 text-sm text-zinc-200">
                <input
                  name="deductStock"
                  type="checkbox"
                  defaultChecked
                  className="size-4 accent-white"
                />
                Deduct stock
              </label>

              <button
                type="submit"
                className="w-full rounded-xl bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
              >
                Confirm Quick Sell
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

