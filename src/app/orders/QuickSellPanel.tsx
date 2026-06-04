"use client";

import { useActionState, useMemo, useState } from "react";

import {
  quickSell,
  type OrderActionResult,
} from "@/app/orders/actions";
import {
  CustomerPicker,
  type CustomerOption,
} from "@/app/orders/CustomerPicker";
import {
  lineTotalCents,
  SALE_UNITS,
  type SaleUnit,
} from "@/lib/order-line-math";
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

export function QuickSellPanel(props: {
  products: QuickSellProduct[];
  customers: CustomerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState<
    OrderActionResult | null,
    FormData
  >(quickSell, null);
  const [productId, setProductId] = useState<number>(
    props.products[0]?.id ?? 0,
  );
  const [priceTier, setPriceTier] = useState<"Retail" | "Bulk">("Retail");
  const [saleUnit, setSaleUnit] = useState<SaleUnit>("Piece");
  const [quantity, setQuantity] = useState("1");
  const [deductStock, setDeductStock] = useState(
    () => (props.products[0]?.stockQuantity ?? 0) > 0,
  );
  const [customerName, setCustomerName] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [customerId, setCustomerId] = useState("");

  function closeModal() {
    setOpen(false);
    setFormKey((k) => k + 1);
    setCustomerName("");
    setContact("");
    setLocation("");
    setCustomerId("");
    setQuantity("1");
    setSaleUnit("Piece");
  }

  function openModal() {
    setFormKey((k) => k + 1);
    setOpen(true);
  }

  const product = useMemo(
    () => props.products.find((p) => p.id === productId),
    [props.products, productId],
  );

  const unitPrice =
    priceTier === "Bulk" ? product?.bulkPrice ?? 0 : product?.retailPrice ?? 0;
  const qtyNum = Number(quantity) || 0;
  const quantityTenths =
    saleUnit === "Kilogram" ? Math.round(qtyNum * 10) : null;
  const qtyWhole = saleUnit === "Kilogram" ? Math.max(1, Math.round(qtyNum)) : Math.round(qtyNum);
  const total = lineTotalCents(unitPrice, saleUnit, qtyWhole, quantityTenths);

  return (
    <>
      <button
        onClick={openModal}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
      >
        Quick Sell
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={closeModal}
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
                onClick={closeModal}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            {state?.ok ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  {state.message ?? "Quick sell recorded."}
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full rounded-xl bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
                >
                  Done
                </button>
              </div>
            ) : (
            <form key={formKey} action={formAction} className="mt-6 space-y-4">
              <label className="space-y-1">
                <div className="text-xs text-zinc-300">Product *</div>
                <select
                  name="productId"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                  value={productId}
                  onChange={(e) => {
                    const nextId = Number(e.target.value);
                    setProductId(nextId);
                    const nextProduct = props.products.find((p) => p.id === nextId);
                    setDeductStock((nextProduct?.stockQuantity ?? 0) > 0);
                  }}
                >
                  {props.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.brand}
                      {p.variant ? ` (${p.variant})` : ""} | stock {p.stockQuantity}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Sale unit</div>
                  <select
                    name="saleUnit"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                    value={saleUnit}
                    onChange={(e) => setSaleUnit(e.target.value as SaleUnit)}
                  >
                    {SALE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">
                    {saleUnit === "Kilogram" ? "Weight (kg) *" : "Qty *"}
                  </div>
                  <input
                    name="quantity"
                    inputMode="decimal"
                    step={saleUnit === "Kilogram" ? "0.1" : "1"}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  checked={deductStock}
                  onChange={(e) => setDeductStock(e.target.checked)}
                  className="size-4 accent-white"
                />
                Deduct stock
                {product && product.stockQuantity <= 0 ? (
                  <span className="text-xs text-amber-300">
                    (no stock — leave unchecked)
                  </span>
                ) : null}
              </label>

              {state?.error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {state.error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
              >
                {pending ? "Saving…" : "Confirm Quick Sell"}
              </button>
            </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

