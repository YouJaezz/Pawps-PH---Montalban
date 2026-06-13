"use client";

import { useState } from "react";

import {
  updateOrderDetails,
  updateOrderLineItem,
} from "@/app/orders/actions";
import {
  formatQuantityLabel,
  saleUnitsForProduct,
  type SaleUnit,
} from "@/lib/order-line-math";
import { saleUnitLabel } from "@/lib/price-units";
import { centsToInput, formatPhpFromCents } from "@/lib/money";
import { isOrderOpen, normalizeOrderStatus } from "@/lib/order-status";

export type OrderLineEdit = {
  id: number;
  productId: number;
  productLabel: string;
  quantity: number;
  quantityTenths: number | null;
  saleUnit: SaleUnit;
  priceTier: "Retail" | "Bulk";
  unitPrice: number;
  lineTotal: number;
  stockUnit: string;
  kgPerSack: number | null;
  unitsPerCase: number | null;
};

export type OrderEditPayload = {
  id: number;
  customerName: string;
  contact: string | null;
  location: string | null;
  deliveryMethod: string | null;
  storeType: string;
  notes: string | null;
  orderStatus: string;
  lines: OrderLineEdit[];
};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-900 outline-none";

function qtyInputValue(line: OrderLineEdit) {
  if (line.saleUnit === "Kilogram" && line.quantityTenths != null) {
    return String(line.quantityTenths / 100);
  }
  return String(line.quantity);
}

export function OrderEditModal(props: {
  order: OrderEditPayload | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"lines" | "details">("lines");

  if (!props.order) return null;

  const o = props.order;
  const canEditLines = isOrderOpen(normalizeOrderStatus(o.orderStatus));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white border border-zinc-300 p-3">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-100 p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-zinc-600">Edit order</div>
            <h2 className="text-lg font-semibold text-zinc-900">#{o.id}</h2>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600"
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex gap-1">
          <button
            type="button"
            onClick={() => setTab("lines")}
            className={`rounded px-2 py-0.5 text-[10px] ${tab === "lines" ? "bg-zinc-100 text-zinc-800" : "text-zinc-600"}`}
          >
            Items &amp; units
          </button>
          <button
            type="button"
            onClick={() => setTab("details")}
            className={`rounded px-2 py-0.5 text-[10px] ${tab === "details" ? "bg-zinc-100 text-zinc-800" : "text-zinc-600"}`}
          >
            Order details
          </button>
        </div>

        {tab === "lines" ? (
          <div className="mt-3 space-y-3">
            {!canEditLines ? (
              <p className="text-[11px] text-amber-800/90">
                Completed or cancelled orders cannot have line items changed.
                Use Order details for customer info.
              </p>
            ) : null}
            {o.lines.length === 0 ? (
              <p className="text-[11px] text-zinc-600">No line items.</p>
            ) : (
              o.lines.map((line) => (
                <div
                  key={line.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-2"
                >
                  <div className="text-[11px] font-medium text-zinc-800">
                    {line.productLabel}
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-600">
                    Current: {formatQuantityLabel(line.saleUnit, line.quantity, line.quantityTenths)}{" "}
                    · {line.priceTier} · {formatPhpFromCents(line.lineTotal)}
                  </div>
                  {canEditLines ? (
                    <form action={updateOrderLineItem} className="mt-2 space-y-1.5">
                      <input type="hidden" name="orderId" value={o.id} />
                      <input type="hidden" name="lineId" value={line.id} />
                      <div className="grid grid-cols-2 gap-1.5">
                        <label className="text-[9px] text-zinc-600">
                          Sale unit
                          <select
                            name="saleUnit"
                            defaultValue={line.saleUnit}
                            className={inputClass}
                          >
                            {saleUnitsForProduct({
                              stockUnit: line.stockUnit,
                              kgPerSack: line.kgPerSack,
                              unitsPerCase: line.unitsPerCase,
                            }).map((u) => (
                              <option key={u} value={u}>
                                {saleUnitLabel(u)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[9px] text-zinc-600">
                          Qty
                          <input
                            name="quantity"
                            required
                            defaultValue={qtyInputValue(line)}
                            step="0.1"
                            className={inputClass}
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <label className="text-[9px] text-zinc-600">
                          Price tier
                          <select
                            name="priceTier"
                            defaultValue={line.priceTier}
                            className={inputClass}
                          >
                            <option value="Retail">Retail</option>
                            <option value="Bulk">Bulk</option>
                          </select>
                        </label>
                        <label className="text-[9px] text-zinc-600">
                          Unit price override (₱)
                          <input
                            name="unitPrice"
                            placeholder={centsToInput(line.unitPrice)}
                            className={inputClass}
                          />
                        </label>
                      </div>
                      <p className="text-[9px] text-zinc-600">
                        Kilogram: decimal kg (e.g. 2.5). Sack: whole sacks. Stock
                        deducts exact kg from inventory.
                      </p>
                      <button
                        type="submit"
                        className="rounded border border-brand-cyan/30 px-2 py-0.5 text-[10px] text-brand-cyan/70"
                      >
                        Save line
                      </button>
                    </form>
                  ) : null}
                </div>
              ))
            )}
          </div>
        ) : (
          <form action={updateOrderDetails} className="mt-3 space-y-2">
            <input type="hidden" name="orderId" value={o.id} />
            <label className="block text-[10px] text-zinc-600">
              Customer
              <input
                name="customerName"
                required
                defaultValue={o.customerName}
                className={inputClass}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                name="contact"
                defaultValue={o.contact ?? ""}
                placeholder="Contact"
                className={inputClass}
              />
              <input
                name="location"
                defaultValue={o.location ?? ""}
                placeholder="Location"
                className={inputClass}
              />
            </div>
            <label className="block text-[10px] text-zinc-600">
              Store type
              <select
                name="storeType"
                defaultValue={o.storeType}
                className={inputClass}
              >
                <option value="Online">Online</option>
                <option value="Walk-in">Walk-in</option>
              </select>
            </label>
            <input
              name="deliveryMethod"
              defaultValue={o.deliveryMethod ?? ""}
              placeholder="Delivery method"
              className={inputClass}
            />
            <textarea
              name="notes"
              defaultValue={o.notes ?? ""}
              placeholder="Notes"
              rows={2}
              className={inputClass}
            />
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-50 py-1.5 text-[11px] font-medium text-zinc-900"
            >
              Save order details
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
