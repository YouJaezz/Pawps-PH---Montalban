"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import {
  quickSell,
  type OrderActionResult,
} from "@/app/orders/actions";
import {
  CustomerPicker,
  type CustomerOption,
} from "@/app/orders/CustomerPicker";
import type { StockUnit } from "@/db/schema";
import {
  formatQuantityLabel,
  lineTotalCents,
  parseQuantityInput,
  saleUnitsForProduct,
  unitPriceForSale,
  type SaleUnit,
} from "@/lib/order-line-math";
import { saleUnitLabel } from "@/lib/price-units";
import { formatPhpFromCents } from "@/lib/money";
import { formatStockLabel } from "@/lib/product-stock";

export type QuickSellProduct = {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
  retailPrice: number;
  bulkPrice: number;
  stockQuantity: number;
  stockUnit: StockUnit;
  kgPerSack: number | null;
  unitsPerCase: number | null;
};

type CartLine = {
  productId: number;
  quantity: string;
  saleUnit: SaleUnit;
  priceTier: "Retail" | "Bulk";
};

function productLabel(p: QuickSellProduct) {
  return `${p.name} — ${p.brand}${p.variant ? ` (${p.variant})` : ""}`;
}

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

  const [cart, setCart] = useState<CartLine[]>([]);
  const [draftProductId, setDraftProductId] = useState<number>(
    props.products[0]?.id ?? 0,
  );
  const [draftSaleUnit, setDraftSaleUnit] = useState<SaleUnit>("Piece");
  const [draftQuantity, setDraftQuantity] = useState("1");
  const [draftPriceTier, setDraftPriceTier] = useState<"Retail" | "Bulk">(
    "Retail",
  );
  const [deductStock, setDeductStock] = useState(
    () => (props.products[0]?.stockQuantity ?? 0) > 0,
  );
  const [customerName, setCustomerName] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [customerId, setCustomerId] = useState("");

  const productById = useMemo(() => {
    const m = new Map<number, QuickSellProduct>();
    for (const p of props.products) m.set(p.id, p);
    return m;
  }, [props.products]);

  const draftProduct = productById.get(draftProductId);

  const draftAllowedUnits = draftProduct
    ? saleUnitsForProduct({
        stockUnit: draftProduct.stockUnit,
        kgPerSack: draftProduct.kgPerSack,
        unitsPerCase: draftProduct.unitsPerCase,
      })
    : (["Piece"] as SaleUnit[]);

  useEffect(() => {
    if (draftProduct && !draftAllowedUnits.includes(draftSaleUnit)) {
      setDraftSaleUnit(draftAllowedUnits[0] ?? "Piece");
    }
  }, [draftProduct, draftAllowedUnits, draftSaleUnit]);

  function resetDraft() {
    setDraftProductId(props.products[0]?.id ?? 0);
    setDraftSaleUnit("Piece");
    setDraftQuantity("1");
    setDraftPriceTier("Retail");
    setDeductStock((props.products[0]?.stockQuantity ?? 0) > 0);
  }

  function closeModal() {
    setOpen(false);
    setFormKey((k) => k + 1);
    setCart([]);
    resetDraft();
    setCustomerName("");
    setContact("");
    setLocation("");
    setCustomerId("");
  }

  function openModal() {
    setFormKey((k) => k + 1);
    setCart([]);
    resetDraft();
    setOpen(true);
  }

  function lineTotal(line: CartLine) {
    const p = productById.get(line.productId);
    if (!p) return 0;
    const unitPrice = unitPriceForSale(
      line.saleUnit,
      line.priceTier,
      p.retailPrice,
      p.bulkPrice,
      p.kgPerSack,
      p.unitsPerCase,
    );
    const qtyParsed = parseQuantityInput(line.quantity, line.saleUnit);
    if (!qtyParsed) return 0;
    return lineTotalCents(
      unitPrice,
      line.saleUnit,
      qtyParsed.quantity,
      qtyParsed.quantityTenths,
    );
  }

  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + lineTotal(line), 0),
    [cart, productById],
  );

  function addToCart() {
    const p = productById.get(draftProductId);
    if (!p) return;
    const qtyParsed = parseQuantityInput(draftQuantity, draftSaleUnit);
    if (!qtyParsed) return;

    setCart((prev) => {
      const idx = prev.findIndex(
        (line) =>
          line.productId === draftProductId &&
          line.saleUnit === draftSaleUnit &&
          line.priceTier === draftPriceTier,
      );
      if (idx >= 0) {
        const existing = prev[idx]!;
        const existingQty = parseQuantityInput(existing.quantity, draftSaleUnit);
        const nextQty =
          draftSaleUnit === "Kilogram"
            ? String(
                (existingQty?.quantityTenths ?? 0) / 10 +
                  (qtyParsed.quantityTenths ?? 0) / 10,
              )
            : String((existingQty?.quantity ?? 0) + qtyParsed.quantity);
        return prev.map((line, i) =>
          i === idx ? { ...line, quantity: nextQty } : line,
        );
      }
      return [
        ...prev,
        {
          productId: draftProductId,
          quantity: draftQuantity,
          saleUnit: draftSaleUnit,
          priceTier: draftPriceTier,
        },
      ];
    });

    setDraftQuantity("1");
  }

  function removeFromCart(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

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
          <div className="absolute left-1/2 top-1/2 flex max-h-[92vh] w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-white/10 bg-[#0b0b10] shadow-2xl">
            <div className="shrink-0 border-b border-white/10 p-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-zinc-400">Sales</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight">
                    Quick Sell
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Add multiple items to the cart, then check out as one order.
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </div>

            {state?.ok ? (
              <div className="space-y-4 overflow-y-auto p-6">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  {state.message ?? "Sale recorded."}
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
              <form
                key={formKey}
                action={formAction}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 pt-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs font-medium text-zinc-200">
                      Add to cart
                    </div>
                    <label className="mt-2 block space-y-1">
                      <div className="text-[11px] text-zinc-400">Product</div>
                      <select
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                        value={draftProductId}
                        onChange={(e) => {
                          const nextId = Number(e.target.value);
                          setDraftProductId(nextId);
                          const nextProduct = productById.get(nextId);
                          setDeductStock((nextProduct?.stockQuantity ?? 0) > 0);
                          setDraftSaleUnit("Piece");
                        }}
                      >
                        {props.products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {productLabel(p)} | stock{" "}
                            {formatStockLabel(
                              p.stockUnit,
                              p.stockQuantity,
                              p.kgPerSack,
                              p.unitsPerCase,
                            )}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <label className="space-y-1">
                        <div className="text-[11px] text-zinc-400">Sale unit</div>
                        <select
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                          value={draftSaleUnit}
                          onChange={(e) =>
                            setDraftSaleUnit(e.target.value as SaleUnit)
                          }
                        >
                          {draftAllowedUnits.map((u) => (
                            <option key={u} value={u}>
                              {saleUnitLabel(u)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <div className="text-[11px] text-zinc-400">
                          {draftSaleUnit === "Kilogram"
                            ? "Weight (kg)"
                            : draftSaleUnit === "Sack"
                              ? "Sacks"
                              : draftSaleUnit === "Case"
                                ? "Cases"
                                : "Qty (pcs)"}
                        </div>
                        <input
                          inputMode="decimal"
                          step={draftSaleUnit === "Kilogram" ? "0.1" : "1"}
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                          value={draftQuantity}
                          onChange={(e) => setDraftQuantity(e.target.value)}
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[11px] text-zinc-400">Price tier</div>
                        <select
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                          value={draftPriceTier}
                          onChange={(e) =>
                            setDraftPriceTier(e.target.value as "Retail" | "Bulk")
                          }
                        >
                          <option value="Retail">Retail</option>
                          <option value="Bulk">Wholesale</option>
                        </select>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={addToCart}
                      className="mt-3 w-full rounded-xl border border-[#e8a44a]/30 bg-[#e8a44a]/10 px-3 py-2 text-sm text-[#e8a44a] hover:bg-[#e8a44a]/15"
                    >
                      Add to cart
                    </button>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium text-zinc-200">
                        Cart ({cart.length} item{cart.length === 1 ? "" : "s"})
                      </div>
                      <div className="text-sm font-semibold text-zinc-50">
                        {formatPhpFromCents(cartTotal)}
                      </div>
                    </div>

                    {cart.length === 0 ? (
                      <p className="mt-2 text-[11px] text-zinc-500">
                        No items yet — add products above.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {cart.map((line, idx) => {
                          const p = productById.get(line.productId);
                          if (!p) return null;
                          const qtyParsed = parseQuantityInput(
                            line.quantity,
                            line.saleUnit,
                          );
                          const qtyLabel = qtyParsed
                            ? formatQuantityLabel(
                                line.saleUnit,
                                qtyParsed.quantity,
                                qtyParsed.quantityTenths,
                              )
                            : line.quantity;
                          return (
                            <li
                              key={`${line.productId}-${line.saleUnit}-${line.priceTier}-${idx}`}
                              className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"
                            >
                              <div className="min-w-0 text-[11px]">
                                <div className="truncate font-medium text-zinc-100">
                                  {productLabel(p)}
                                </div>
                                <div className="text-zinc-500">
                                  {qtyLabel} · {line.priceTier} ·{" "}
                                  {formatPhpFromCents(lineTotal(line))}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFromCart(idx)}
                                className="shrink-0 text-[10px] text-red-300 hover:text-red-200"
                              >
                                Remove
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {cart.map((line, idx) => (
                    <div key={`fields-${idx}`} className="hidden">
                      <input type="hidden" name="productId" value={line.productId} />
                      <input type="hidden" name="quantity" value={line.quantity} />
                      <input type="hidden" name="saleUnit" value={line.saleUnit} />
                      <input type="hidden" name="priceTier" value={line.priceTier} />
                    </div>
                  ))}

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
                    Deduct stock for all cart items
                  </label>

                  {state?.error ? (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                      {state.error}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 border-t border-white/10 p-6 pt-4">
                  <button
                    type="submit"
                    disabled={pending || cart.length === 0 || !customerName.trim()}
                    className="w-full rounded-xl bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
                  >
                    {pending
                      ? "Saving…"
                      : `Confirm sale · ${formatPhpFromCents(cartTotal)}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
