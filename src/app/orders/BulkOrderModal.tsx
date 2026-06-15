"use client";

import { useActionState, useMemo, useRef, useState } from "react";

import {
  createBulkOrder,
  type OrderActionResult,
} from "@/app/orders/actions";
import {
  CustomerPicker,
  type CustomerOption,
} from "@/app/orders/CustomerPicker";
import { OrderReceiptView } from "@/app/orders/OrderReceiptView";
import { OrderSaleConfirm } from "@/app/orders/OrderSaleConfirm";
import { OrderDiscountFields } from "@/components/OrderDiscountFields";
import {
  orderTotalsFromSubtotal,
  type DiscountType,
} from "@/lib/order-discount";
import {
  ProductSelectField,
  type ProductSelectOption,
} from "@/components/ProductSelectField";
import {
  lineTotalCents,
  parseQuantityInput,
  saleUnitsForProduct,
  unitPriceForSale,
  type SaleUnit,
} from "@/lib/order-line-math";
import type { StockUnit } from "@/db/schema";
import { saleUnitLabel } from "@/lib/price-units";
import { formatPhpFromCents } from "@/lib/money";

export type BulkOrderProduct = {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
  itemType: string | null;
  retailPrice: number;
  bulkPrice: number;
  stockUnit: StockUnit;
  kgPerSack: number | null;
  unitsPerCase: number | null;
};

type Line = { productId: number; quantity: string };

type ModalStep = "form" | "confirm" | "receipt";

export function BulkOrderModal(props: {
  products: BulkOrderProduct[];
  customers: CustomerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>("form");
  const [receiptDismissed, setReceiptDismissed] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    OrderActionResult | null,
    FormData
  >(createBulkOrder, null);
  const [priceTier, setPriceTier] = useState<"Bulk" | "Retail">("Bulk");
  const [saleUnit, setSaleUnit] = useState<SaleUnit>("Piece");
  const [lines, setLines] = useState<Line[]>([
    { productId: props.products[0]?.id ?? 0, quantity: "1" },
  ]);
  const [customerName, setCustomerName] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [storeType, setStoreType] = useState("Online");
  const [deliveryMethod, setDeliveryMethod] = useState("Lalamove");
  const [discountType, setDiscountType] = useState<DiscountType>("None");
  const [discountValue, setDiscountValue] = useState("");
  const [discountNote, setDiscountNote] = useState("");

  const activeStep: ModalStep =
    state?.ok && state.receipt && !receiptDismissed ? "receipt" : step;

  function closeModal() {
    setOpen(false);
    setStep("form");
    setReceiptDismissed(true);
    setFormKey((k) => k + 1);
    setCustomerName("");
    setContact("");
    setLocation("");
    setCustomerId("");
    setStoreType("Online");
    setDeliveryMethod("Lalamove");
    setLines([{ productId: props.products[0]?.id ?? 0, quantity: "1" }]);
    setSaleUnit("Piece");
    setDiscountType("None");
    setDiscountValue("");
    setDiscountNote("");
  }

  function openModal() {
    setFormKey((k) => k + 1);
    setStep("form");
    setReceiptDismissed(false);
    setOpen(true);
  }

  const priceById = useMemo(() => {
    const m = new Map<number, BulkOrderProduct>();
    for (const p of props.products) m.set(p.id, p);
    return m;
  }, [props.products]);

  const productOptions = useMemo<ProductSelectOption[]>(
    () =>
      props.products.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        variant: p.variant,
        itemType: p.itemType,
      })),
    [props.products],
  );

  const total = useMemo(() => {
    return lines.reduce((acc, l) => {
      const p = priceById.get(l.productId);
      if (!p) return acc;
      const unit = unitPriceForSale(
        saleUnit,
        priceTier,
        p.retailPrice,
        p.bulkPrice,
        p.kgPerSack,
        p.unitsPerCase,
      );
      const qtyParsed = parseQuantityInput(l.quantity, saleUnit);
      if (!qtyParsed) return acc;
      return (
        acc +
        lineTotalCents(
          unit,
          saleUnit,
          qtyParsed.quantity,
          qtyParsed.quantityTenths,
        )
      );
    }, 0);
  }, [lines, priceById, priceTier, saleUnit]);

  const allowedSaleUnits = useMemo(() => {
    const set = new Set<SaleUnit>();
    for (const p of props.products) {
      for (const u of saleUnitsForProduct({
        stockUnit: p.stockUnit,
        kgPerSack: p.kgPerSack,
        unitsPerCase: p.unitsPerCase,
      })) {
        set.add(u);
      }
    }
    return set.size > 0 ? [...set] : (["Piece"] as SaleUnit[]);
  }, [props.products]);

  const orderPricing = useMemo(() => {
    const input =
      discountType === "None"
        ? { type: "None" as const, value: 0 }
        : discountType === "Fixed"
          ? {
              type: "Fixed" as const,
              value: Math.round(Number(discountValue) * 100) || 0,
            }
          : {
              type: "Percent" as const,
              value: Math.min(100, Math.round(Number(discountValue))) || 0,
            };
    return orderTotalsFromSubtotal(total, input);
  }, [total, discountType, discountValue]);

  const deposit = Math.round(orderPricing.totalAmount * 0.3);

  const itemSummary = useMemo(() => {
    if (lines.length === 0) return "—";
    if (lines.length === 1) {
      const p = priceById.get(lines[0]!.productId);
      return p ? `${p.name} — ${p.brand}` : "1 item";
    }
    return `${lines.length} items · ${formatPhpFromCents(total)} total`;
  }, [lines, priceById, total]);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { productId: props.products[0]?.id ?? 0, quantity: "1" },
    ]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <>
      <button
        onClick={openModal}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
      >
        Bulk Order
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={closeModal}
          />
          <div className="absolute left-1/2 top-1/2 flex max-h-[92vh] w-[96vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-white/10 bg-[#0a1018] shadow-2xl">
            <div className="shrink-0 border-b border-white/10 p-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-zinc-400">Orders</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight">
                    {activeStep === "receipt" ? "Receipt" : "Bulk Order (30% deposit)"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {activeStep === "receipt"
                      ? "Print or save this receipt, then complete the order when ready."
                      : "Search products, add multiple lines, auto-calculates deposit."}
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

            <div className="min-h-0 flex-1 overflow-y-auto">
            {activeStep === "receipt" && state?.receipt ? (
              <div className="space-y-4 p-6">
                <div className="rounded-xl border border-brand-cyan/30 bg-brand-blue/10 px-3 py-2 text-sm text-brand-cyan/80">
                  {state.message ?? "Bulk order created."}
                </div>
                <OrderReceiptView receipt={state.receipt} compact />
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full rounded-xl bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
                >
                  Done
                </button>
              </div>
            ) : (
            <form key={formKey} ref={formRef} action={formAction} className="space-y-4 p-6">
              {activeStep === "confirm" ? (
                <div className="hidden" aria-hidden>
                  {lines.map((line, idx) => (
                    <div key={`confirm-${idx}`}>
                      <input type="hidden" name="productId" value={line.productId} />
                      <input type="hidden" name="quantity" value={line.quantity} />
                    </div>
                  ))}
                  <input type="hidden" name="customerName" value={customerName} />
                  <input type="hidden" name="customerId" value={customerId} />
                  <input type="hidden" name="contact" value={contact} />
                  <input type="hidden" name="location" value={location} />
                  <input type="hidden" name="storeType" value={storeType} />
                  <input type="hidden" name="deliveryMethod" value={deliveryMethod} />
                  <input type="hidden" name="saleUnit" value={saleUnit} />
                  <input type="hidden" name="priceTier" value={priceTier} />
                </div>
              ) : null}
              {activeStep === "confirm" ? (
                <>
                  {state?.error ? (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                      {state.error}
                    </div>
                  ) : null}
                  <OrderDiscountFields
                    subtotalCents={total}
                    discountType={discountType}
                    discountValue={discountValue}
                    discountNote={discountNote}
                    onTypeChange={setDiscountType}
                    onValueChange={setDiscountValue}
                    onNoteChange={setDiscountNote}
                  />
                  <OrderSaleConfirm
                  title="Confirm bulk order"
                  customerName={customerName}
                  contact={contact}
                  location={location}
                  subtotalCents={total}
                  discountCents={orderPricing.discountCents}
                  discountNote={discountNote}
                  totalLabel="Order total"
                  totalCents={orderPricing.totalAmount}
                  paidLabel="30% deposit now"
                  paidCents={deposit}
                  itemSummary={itemSummary}
                  pending={pending}
                  confirmLabel="Yes, create pending order"
                  onBack={() => setStep("form")}
                  onConfirm={() => formRef.current?.requestSubmit()}
                />
                </>
              ) : (
              <>
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
                  <div className="text-xs text-zinc-300">Sale unit (all lines)</div>
                  <select
                    name="saleUnit"
                    value={saleUnit}
                    onChange={(e) => setSaleUnit(e.target.value as SaleUnit)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                  >
                    {allowedSaleUnits.map((u) => (
                      <option key={u} value={u}>
                        {saleUnitLabel(u)}
                      </option>
                    ))}
                  </select>
                </label>
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
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-xs text-zinc-300">Store type</div>
                  <select
                    name="storeType"
                    value={storeType}
                    onChange={(e) => setStoreType(e.target.value)}
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
                    value={deliveryMethod}
                    onChange={(e) => setDeliveryMethod(e.target.value)}
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
                      ? unitPriceForSale(
                          saleUnit,
                          priceTier,
                          p.retailPrice,
                          p.bulkPrice,
                          p.kgPerSack,
                          p.unitsPerCase,
                        )
                      : 0;
                    const qtyParsed = parseQuantityInput(l.quantity, saleUnit);
                    const lineTotal = qtyParsed
                      ? lineTotalCents(
                          unit,
                          saleUnit,
                          qtyParsed.quantity,
                          qtyParsed.quantityTenths,
                        )
                      : 0;
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-12"
                      >
                        <div className="sm:col-span-7">
                          <ProductSelectField
                            label="Product"
                            products={productOptions}
                            value={l.productId}
                            onChange={(productId) =>
                              updateLine(idx, { productId })
                            }
                          />
                          <input type="hidden" name="productId" value={l.productId} />
                          <div className="mt-1 text-xs text-zinc-500">
                            Unit: {formatPhpFromCents(unit)}
                          </div>
                        </div>

                        <div className="sm:col-span-3">
                          <div className="text-xs text-zinc-400">
                            {saleUnit === "Kilogram"
                              ? "Weight (kg)"
                              : saleUnit === "Sack"
                                ? "Sacks"
                                : saleUnit === "Case"
                                  ? "Cases"
                                  : "Qty (pcs)"}
                          </div>
                          <input
                            name="quantity"
                            inputMode="decimal"
                            step={
                              saleUnit === "Kilogram" ? "0.1" : "1"
                            }
                            value={l.quantity}
                            onChange={(e) =>
                              updateLine(idx, {
                                quantity: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20"
                          />
                          <div className="mt-1 text-xs text-zinc-500">
                            Line: {formatPhpFromCents(lineTotal)}
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
                  type="button"
                  onClick={() => setStep("confirm")}
                  disabled={!customerName.trim() || lines.length === 0}
                  className="rounded-2xl bg-zinc-50 p-4 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
                >
                  Review bulk order
                </button>
              </div>

              {state?.error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {state.error}
                </div>
              ) : null}
              </>
              )}
            </form>
            )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

