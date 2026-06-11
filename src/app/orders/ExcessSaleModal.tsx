"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import {
  quickSell,
  type OrderActionResult,
} from "@/app/orders/actions";
import {
  CustomerPicker,
  type CustomerOption,
} from "@/app/orders/CustomerPicker";
import { OrderReceiptView } from "@/app/orders/OrderReceiptView";
import { OrderSaleConfirm } from "@/app/orders/OrderSaleConfirm";
import type { QuickSellProduct } from "@/app/orders/QuickSellPanel";
import {
  ProductSelectField,
  type ProductSelectOption,
} from "@/components/ProductSelectField";
import { OrderDiscountFields } from "@/components/OrderDiscountFields";
import {
  orderTotalsFromSubtotal,
  type DiscountType,
} from "@/lib/order-discount";
import { EXCESS_QTY_PRESETS } from "@/lib/excess-sale";
import { formatPhpFromCents } from "@/lib/money";

type ExcessLine = {
  productId: number;
  qtyPreset: string;
  customQtyLabel: string;
  amount: string;
  note: string;
};

type ModalStep = "form" | "confirm" | "receipt";

function toSelectOptions(products: QuickSellProduct[]): ProductSelectOption[] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    variant: p.variant,
    itemType: p.itemType,
  }));
}

export function ExcessSaleModal(props: {
  products: QuickSellProduct[];
  customers: CustomerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>("form");
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    OrderActionResult | null,
    FormData
  >(quickSell, null);

  const [lines, setLines] = useState<ExcessLine[]>([
    {
      productId: props.products[0]?.id ?? 0,
      qtyPreset: EXCESS_QTY_PRESETS[0]!,
      customQtyLabel: "",
      amount: "",
      note: "",
    },
  ]);
  const [customerName, setCustomerName] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [storeType, setStoreType] = useState("Walk-in");
  const [deliveryMethod, setDeliveryMethod] = useState("Montalban Free Delivery");
  const [discountType, setDiscountType] = useState<DiscountType>("None");
  const [discountValue, setDiscountValue] = useState("");
  const [discountNote, setDiscountNote] = useState("");

  useEffect(() => {
    if (state?.ok && state.receipt) setStep("receipt");
  }, [state]);

  const productById = useMemo(() => {
    const m = new Map<number, QuickSellProduct>();
    for (const p of props.products) m.set(p.id, p);
    return m;
  }, [props.products]);

  const productOptions = useMemo(
    () => toSelectOptions(props.products),
    [props.products],
  );

  const totalCents = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const n = Number(line.amount.trim());
        if (!Number.isFinite(n) || n <= 0) return sum;
        return sum + Math.round(n * 100);
      }, 0),
    [lines],
  );

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
    return orderTotalsFromSubtotal(totalCents, input);
  }, [totalCents, discountType, discountValue]);

  const itemSummary = useMemo(() => {
    if (lines.length === 0) return "—";
    return lines
      .map((line) => {
        const p = productById.get(line.productId);
        const qty =
          line.qtyPreset === "Custom"
            ? line.customQtyLabel.trim() || "custom"
            : line.qtyPreset;
        return p ? `${p.name} · ${qty}` : qty;
      })
      .join(" · ");
  }, [lines, productById]);

  function closeModal() {
    setOpen(false);
    setStep("form");
    setFormKey((k) => k + 1);
    setLines([
      {
        productId: props.products[0]?.id ?? 0,
        qtyPreset: EXCESS_QTY_PRESETS[0]!,
        customQtyLabel: "",
        amount: "",
        note: "",
      },
    ]);
    setCustomerName("");
    setContact("");
    setLocation("");
    setCustomerId("");
    setDiscountType("None");
    setDiscountValue("");
    setDiscountNote("");
  }

  function updateLine(index: number, patch: Partial<ExcessLine>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        productId: props.products[0]?.id ?? 0,
        qtyPreset: EXCESS_QTY_PRESETS[0]!,
        customQtyLabel: "",
        amount: "",
        note: "",
      },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function suggestAmount(index: number) {
    const line = lines[index];
    if (!line) return;
    const p = productById.get(line.productId);
    if (!p) return;
    const preset = line.qtyPreset;
    let cents = 0;
    if (preset.includes("¼")) cents = Math.round(p.retailPrice / 4);
    else if (preset.includes("½")) cents = Math.round(p.retailPrice / 2);
    else if (preset === "Custom") return;
    if (cents > 0) {
      updateLine(index, { amount: (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2) });
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setFormKey((k) => k + 1);
          setStep("form");
          setOpen(true);
        }}
        className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/15"
      >
        Excess / bonus sale
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div className="absolute left-1/2 top-1/2 flex max-h-[92vh] w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-white/10 bg-[#0b0b10] shadow-2xl">
            <div className="shrink-0 border-b border-white/10 p-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-zinc-400">Sales</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight">
                    {step === "receipt" ? "Receipt" : "Excess / bonus stock"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Record surplus (e.g. extra ¼ sack) as 100% profit — no inventory
                    deduction.
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

            {step === "receipt" && state?.receipt ? (
              <div className="space-y-4 overflow-y-auto p-6">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  {state.message ?? "Excess sale recorded."}
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
              <form
                key={formKey}
                ref={formRef}
                action={formAction}
                className="flex min-h-0 flex-1 flex-col"
              >
                <input
                  type="hidden"
                  name="deductStock"
                  value={lines.some((line) => line.qtyPreset === "Custom") ? "on" : ""}
                />
                {step === "confirm" ? (
                  <div className="hidden" aria-hidden>
                    {lines.map((line, idx) => (
                      <div key={`confirm-${idx}`}>
                        <input
                          type="hidden"
                          name="excessProductId"
                          value={line.productId}
                        />
                        <input
                          type="hidden"
                          name="excessQtyPreset"
                          value={line.qtyPreset}
                        />
                        <input
                          type="hidden"
                          name="excessQtyLabel"
                          value={
                            line.qtyPreset === "Custom"
                              ? line.customQtyLabel.trim()
                              : line.qtyPreset
                          }
                        />
                        <input type="hidden" name="excessAmount" value={line.amount} />
                        <input type="hidden" name="excessNote" value={line.note} />
                      </div>
                    ))}
                    <input type="hidden" name="customerName" value={customerName} />
                    <input type="hidden" name="customerId" value={customerId} />
                    <input type="hidden" name="contact" value={contact} />
                    <input type="hidden" name="location" value={location} />
                    <input type="hidden" name="storeType" value={storeType} />
                    <input type="hidden" name="deliveryMethod" value={deliveryMethod} />
                  </div>
                ) : null}

                {step === "confirm" ? (
                  <>
                    {state?.error ? (
                      <div className="mx-6 mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        {state.error}
                      </div>
                    ) : null}
                    <div className="space-y-4 overflow-y-auto px-6 pb-2">
                      <OrderDiscountFields
                        subtotalCents={totalCents}
                        discountType={discountType}
                        discountValue={discountValue}
                        discountNote={discountNote}
                        onTypeChange={setDiscountType}
                        onValueChange={setDiscountValue}
                        onNoteChange={setDiscountNote}
                      />
                    </div>
                    <OrderSaleConfirm
                      title="Confirm excess / bonus sale"
                      customerName={customerName}
                      contact={contact}
                      location={location}
                      subtotalCents={totalCents}
                      discountCents={orderPricing.discountCents}
                      discountNote={discountNote}
                      totalLabel="Total collected"
                      totalCents={orderPricing.totalAmount}
                      paidLabel="Collect now"
                      paidCents={orderPricing.totalAmount}
                      itemSummary={itemSummary}
                      extraNotes={[
                        lines.some((line) => line.qtyPreset === "Custom")
                          ? "Custom quantity lines deduct stock when the order is marked Completed."
                          : "",
                        lines.some((line) => line.qtyPreset !== "Custom")
                          ? "Preset surplus/bonus lines are 100% profit — inventory is not reduced."
                          : "",
                      ].filter(Boolean)}
                      pending={pending}
                      confirmLabel="Yes, record excess sale"
                      onBack={() => setStep("form")}
                      onConfirm={() => formRef.current?.requestSubmit()}
                    />
                  </>
                ) : (
                  <>
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 pt-4">
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
                        Use this for bonus stock sold separately (e.g. the extra ¼
                        in a sack). Each line is stored with a note showing it was
                        excess income.
                      </div>

                      {lines.map((line, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2"
                        >
                          <ProductSelectField
                            label="Related product"
                            products={productOptions}
                            value={line.productId}
                            onChange={(productId) =>
                              updateLine(idx, { productId })
                            }
                          />

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <label className="space-y-1">
                              <div className="text-[11px] text-zinc-400">What was sold</div>
                              <select
                                value={line.qtyPreset}
                                onChange={(e) => {
                                  updateLine(idx, { qtyPreset: e.target.value });
                                  suggestAmount(idx);
                                }}
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                              >
                                {EXCESS_QTY_PRESETS.map((preset) => (
                                  <option key={preset} value={preset}>
                                    {preset}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="space-y-1">
                              <div className="text-[11px] text-zinc-400">Amount (₱)</div>
                              <input
                                inputMode="decimal"
                                value={line.amount}
                                onChange={(e) =>
                                  updateLine(idx, { amount: e.target.value })
                                }
                                placeholder="e.g. 150"
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                              />
                            </label>
                          </div>

                          {line.qtyPreset === "Custom" ? (
                            <label className="space-y-1">
                              <div className="text-[11px] text-zinc-400">
                                Custom quantity (deducts stock)
                              </div>
                              <input
                                value={line.customQtyLabel}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    customQtyLabel: e.target.value,
                                  })
                                }
                                placeholder="e.g. 0.25 kg, 1 sack, 3 pcs"
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                              />
                            </label>
                          ) : null}

                          <label className="space-y-1">
                            <div className="text-[11px] text-zinc-400">
                              Extra note (optional)
                            </div>
                            <input
                              value={line.note}
                              onChange={(e) =>
                                updateLine(idx, { note: e.target.value })
                              }
                              placeholder="e.g. Customer bought leftover ¼ sack"
                              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                            />
                          </label>

                          {lines.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              className="text-[10px] text-red-300 hover:text-red-200"
                            >
                              Remove line
                            </button>
                          ) : null}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addLine}
                        className="w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
                      >
                        + Add another excess line
                      </button>

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
                            value={storeType}
                            onChange={(e) => setStoreType(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                          >
                            <option>Online</option>
                            <option>Walk-in</option>
                          </select>
                        </label>
                        <label className="space-y-1">
                          <div className="text-xs text-zinc-300">Delivery method</div>
                          <select
                            value={deliveryMethod}
                            onChange={(e) => setDeliveryMethod(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                          >
                            <option>Montalban Free Delivery</option>
                            <option>Lalamove</option>
                            <option>Other</option>
                          </select>
                        </label>
                      </div>

                      {state?.error ? (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                          {state.error}
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0 border-t border-white/10 p-6 pt-4">
                      <button
                        type="button"
                        onClick={() => setStep("confirm")}
                        disabled={
                          !customerName.trim() ||
                          totalCents <= 0 ||
                          lines.some(
                            (line) =>
                              line.qtyPreset === "Custom" &&
                              !line.customQtyLabel.trim(),
                          )
                        }
                        className="w-full rounded-xl bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
                      >
                        Review excess sale · {formatPhpFromCents(totalCents)}
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
