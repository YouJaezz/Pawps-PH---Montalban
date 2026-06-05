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
import type { StockUnit } from "@/db/schema";
import {
  formatQuantityLabel,
  lineTotalCents,
  normalizeKgInput,
  parseQuantityInput,
  saleUnitsForProduct,
  unitPriceForSale,
  type SaleUnit,
} from "@/lib/order-line-math";
import { EXCESS_QTY_PRESETS } from "@/lib/excess-sale";
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

type ProductCartLine = {
  kind: "product";
  productId: number;
  quantity: string;
  saleUnit: SaleUnit;
  priceTier: "Retail" | "Bulk";
};

type ExcessCartLine = {
  kind: "excess";
  productId: number;
  qtyPreset: string;
  customQtyLabel: string;
  amount: string;
  note: string;
};

type CartLine = ProductCartLine | ExcessCartLine;

const KG_QUICK_AMOUNTS = ["0.25", "0.5", "0.75", "1"] as const;

type ModalStep = "form" | "confirm" | "receipt";

function productLabel(p: QuickSellProduct) {
  return `${p.name} — ${p.brand}${p.variant ? ` (${p.variant})` : ""}`;
}

export function QuickSellPanel(props: {
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
  const [storeType, setStoreType] = useState("Online");
  const [deliveryMethod, setDeliveryMethod] = useState("Montalban Free Delivery");
  const [excessProductId, setExcessProductId] = useState(
    props.products[0]?.id ?? 0,
  );
  const [excessQtyPreset, setExcessQtyPreset] = useState<string>(EXCESS_QTY_PRESETS[0]!);
  const [excessCustomQty, setExcessCustomQty] = useState("");
  const [excessAmount, setExcessAmount] = useState("");
  const [excessNote, setExcessNote] = useState("");

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

  useEffect(() => {
    if (state?.ok && state.receipt) {
      setStep("receipt");
    }
  }, [state]);

  function resetDraft() {
    setDraftProductId(props.products[0]?.id ?? 0);
    setDraftSaleUnit("Piece");
    setDraftQuantity("1");
    setDraftPriceTier("Retail");
    setDeductStock((props.products[0]?.stockQuantity ?? 0) > 0);
  }

  function closeModal() {
    setOpen(false);
    setStep("form");
    setFormKey((k) => k + 1);
    setCart([]);
    resetDraft();
    setCustomerName("");
    setContact("");
    setLocation("");
    setCustomerId("");
    setStoreType("Online");
    setDeliveryMethod("Montalban Free Delivery");
  }

  function openModal() {
    setFormKey((k) => k + 1);
    setStep("form");
    setCart([]);
    resetDraft();
    setOpen(true);
  }

  function lineTotal(line: ProductCartLine) {
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
    () =>
      cart.reduce((sum, line) => {
        if (line.kind === "excess") {
          const n = Number(line.amount.trim());
          if (!Number.isFinite(n) || n <= 0) return sum;
          return sum + Math.round(n * 100);
        }
        return sum + lineTotal(line);
      }, 0),
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
          line.kind === "product" &&
          line.productId === draftProductId &&
          line.saleUnit === draftSaleUnit &&
          line.priceTier === draftPriceTier,
      );
      if (idx >= 0) {
        const existing = prev[idx] as ProductCartLine;
        const existingQty = parseQuantityInput(existing.quantity, draftSaleUnit);
        const nextQty =
          draftSaleUnit === "Kilogram"
            ? String(
                (existingQty?.quantityTenths ?? 0) / 100 +
                  (qtyParsed.quantityTenths ?? 0) / 100,
              )
            : String((existingQty?.quantity ?? 0) + qtyParsed.quantity);
        return prev.map((line, i) =>
          i === idx && line.kind === "product"
            ? { ...line, quantity: nextQty }
            : line,
        );
      }
      return [
        ...prev,
        {
          kind: "product",
          productId: draftProductId,
          quantity: draftQuantity,
          saleUnit: draftSaleUnit,
          priceTier: draftPriceTier,
        },
      ];
    });

    setDraftQuantity("1");
  }

  function addExcessToCart() {
    const qtyLabel =
      excessQtyPreset === "Custom"
        ? excessCustomQty.trim()
        : excessQtyPreset;
    const n = Number(excessAmount.trim());
    if (!qtyLabel || !Number.isFinite(n) || n <= 0) return;
    setCart((prev) => [
      ...prev,
      {
        kind: "excess",
        productId: excessProductId,
        qtyPreset: excessQtyPreset,
        customQtyLabel: excessCustomQty,
        amount: excessAmount,
        note: excessNote,
      },
    ]);
    setExcessAmount("");
    setExcessNote("");
    setExcessCustomQty("");
  }

  function removeFromCart(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  const cartSummary = useMemo(() => {
    if (cart.length === 0) return "—";
    return cart
      .map((line) => {
        if (line.kind === "excess") {
          const p = productById.get(line.productId);
          const qty =
            line.qtyPreset === "Custom"
              ? line.customQtyLabel.trim() || "custom"
              : line.qtyPreset;
          return p ? `${p.name} · excess ${qty}` : `excess ${qty}`;
        }
        const p = productById.get(line.productId);
        return p ? productLabel(p) : "item";
      })
      .join(" · ");
  }, [cart, productById]);

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
                    {step === "receipt" ? "Receipt" : "Quick Sell"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {step === "receipt"
                      ? "Print or save this receipt, then complete the order when ready."
                      : "Add multiple items to the cart, then check out as one pending order."}
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
                  {state.message ?? "Order created."}
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
                {step === "confirm" ? (
                  <div className="hidden" aria-hidden>
                    {cart.map((line, idx) =>
                      line.kind === "product" ? (
                        <div key={`confirm-product-${idx}`}>
                          <input
                            type="hidden"
                            name="productId"
                            value={line.productId}
                          />
                          <input
                            type="hidden"
                            name="quantity"
                            value={line.quantity}
                          />
                          <input type="hidden" name="saleUnit" value={line.saleUnit} />
                          <input type="hidden" name="priceTier" value={line.priceTier} />
                        </div>
                      ) : (
                        <div key={`confirm-excess-${idx}`}>
                          <input
                            type="hidden"
                            name="excessProductId"
                            value={line.productId}
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
                      ),
                    )}
                    <input type="hidden" name="customerName" value={customerName} />
                    <input type="hidden" name="customerId" value={customerId} />
                    <input type="hidden" name="contact" value={contact} />
                    <input type="hidden" name="location" value={location} />
                    <input type="hidden" name="storeType" value={storeType} />
                    <input type="hidden" name="deliveryMethod" value={deliveryMethod} />
                    {deductStock ? (
                      <input type="hidden" name="deductStock" value="on" />
                    ) : null}
                  </div>
                ) : null}
                {step === "confirm" ? (
                  <>
                    {state?.error ? (
                      <div className="mx-6 mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        {state.error}
                      </div>
                    ) : null}
                    <OrderSaleConfirm
                    title="Confirm Quick Sell"
                    customerName={customerName}
                    contact={contact}
                    location={location}
                    totalLabel="Total due"
                    totalCents={cartTotal}
                    paidLabel="Collect now"
                    paidCents={cartTotal}
                    itemSummary={cartSummary}
                    extraNotes={[
                      deductStock
                        ? "Regular items deduct stock when the order is marked Completed."
                        : "Regular items will not deduct stock automatically.",
                      cart.some((line) => line.kind === "excess")
                        ? "Excess/bonus lines are 100% profit and never touch inventory."
                        : "",
                    ].filter(Boolean)}
                    pending={pending}
                    confirmLabel="Yes, create pending order"
                    onBack={() => setStep("form")}
                    onConfirm={() => formRef.current?.requestSubmit()}
                  />
                  </>
                ) : (
                  <>
                {state?.error ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {state.error}
                  </div>
                ) : null}
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
                          step={draftSaleUnit === "Kilogram" ? "0.25" : "1"}
                          min={draftSaleUnit === "Kilogram" ? "0.01" : "1"}
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                          value={draftQuantity}
                          onChange={(e) => setDraftQuantity(e.target.value)}
                          onBlur={() => {
                            if (draftSaleUnit === "Kilogram") {
                              setDraftQuantity(normalizeKgInput(draftQuantity));
                            }
                          }}
                        />
                        {draftSaleUnit === "Kilogram" ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {KG_QUICK_AMOUNTS.map((amount) => (
                              <button
                                key={amount}
                                type="button"
                                onClick={() => setDraftQuantity(amount)}
                                className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-white/5"
                              >
                                {amount === "0.25" ? "¼ kg" : amount === "0.5" ? "½ kg" : amount === "0.75" ? "¾ kg" : "1 kg"}
                              </button>
                            ))}
                          </div>
                        ) : null}
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
                          if (line.kind === "excess") {
                            const p = productById.get(line.productId);
                            if (!p) return null;
                            const qty =
                              line.qtyPreset === "Custom"
                                ? line.customQtyLabel.trim() || "custom"
                                : line.qtyPreset;
                            const amountCents = Math.round(
                              Number(line.amount.trim()) * 100,
                            );
                            return (
                              <li
                                key={`excess-${idx}`}
                                className="flex items-start justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2"
                              >
                                <div className="min-w-0 text-[11px]">
                                  <div className="truncate font-medium text-emerald-100">
                                    {productLabel(p)} · excess
                                  </div>
                                  <div className="text-emerald-200/70">
                                    {qty} · {formatPhpFromCents(amountCents)} · 100%
                                    profit
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
                          }

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

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="text-xs font-medium text-emerald-100">
                      Excess / bonus stock (optional)
                    </div>
                    <p className="mt-1 text-[10px] text-emerald-100/70">
                      For surplus sold separately (e.g. extra ¼ sack). 100% profit,
                      no inventory change.
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="space-y-1">
                        <div className="text-[11px] text-zinc-400">Related product</div>
                        <select
                          value={excessProductId}
                          onChange={(e) =>
                            setExcessProductId(Number(e.target.value))
                          }
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                        >
                          {props.products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {productLabel(p)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <div className="text-[11px] text-zinc-400">What was sold</div>
                        <select
                          value={excessQtyPreset}
                          onChange={(e) => setExcessQtyPreset(e.target.value)}
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
                          value={excessAmount}
                          onChange={(e) => setExcessAmount(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[11px] text-zinc-400">Note (optional)</div>
                        <input
                          value={excessNote}
                          onChange={(e) => setExcessNote(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                        />
                      </label>
                    </div>
                    {excessQtyPreset === "Custom" ? (
                      <label className="mt-2 block space-y-1">
                        <div className="text-[11px] text-zinc-400">Custom label</div>
                        <input
                          value={excessCustomQty}
                          onChange={(e) => setExcessCustomQty(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none"
                        />
                      </label>
                    ) : null}
                    <button
                      type="button"
                      onClick={addExcessToCart}
                      className="mt-3 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/15"
                    >
                      Add excess line to cart
                    </button>
                  </div>

                  {cart
                    .filter((line): line is ProductCartLine => line.kind === "product")
                    .map((line, idx) => (
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

                  <label className="flex items-center gap-3 text-sm text-zinc-200">
                    <input
                      name="deductStock"
                      type="checkbox"
                      checked={deductStock}
                      onChange={(e) => setDeductStock(e.target.checked)}
                      className="size-4 accent-white"
                    />
                    Deduct stock when order is marked Completed
                  </label>

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
                    disabled={cart.length === 0 || !customerName.trim()}
                    className="w-full rounded-xl bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
                  >
                    Review order · {formatPhpFromCents(cartTotal)}
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
