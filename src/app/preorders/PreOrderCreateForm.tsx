"use client";

import { useState } from "react";

import { createPreOrder } from "@/app/preorders/actions";
import type { CatalogSelectOption } from "@/components/CatalogItemSelect";
import { CatalogItemSelect } from "@/components/CatalogItemSelect";

const inputClass =
  "app-select w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20";

type InventoryProduct = {
  id: number;
  name: string;
  brand: string | null;
  variant: string | null;
  stockQuantity: number;
};

type SupplierOption = { id: number; name: string };

export function PreOrderCreateForm(props: {
  inventoryProducts: InventoryProduct[];
  suppliers: SupplierOption[];
  catalogItems: CatalogSelectOption[];
}) {
  const [mode, setMode] = useState<"inventory" | "new">("inventory");
  const [catalogId, setCatalogId] = useState("");

  return (
    <form action={createPreOrder} className="mt-3 space-y-2.5">
      <input type="hidden" name="itemMode" value={mode} />

      <div className="flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
        <button
          type="button"
          onClick={() => setMode("inventory")}
          className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${
            mode === "inventory"
              ? "bg-brand-blue/20 text-brand-blue"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          From inventory
        </button>
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${
            mode === "new"
              ? "bg-brand-blue/20 text-brand-blue"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          New item (not stocked yet)
        </button>
      </div>

      {mode === "inventory" ? (
        <label className="block space-y-0.5">
          <span className="text-[11px] text-zinc-400">Inventory product *</span>
          <select
            name="productId"
            required
            className={inputClass}
            disabled={props.inventoryProducts.length === 0}
          >
            {props.inventoryProducts.length === 0 ? (
              <option value="">Add products in Inventory first</option>
            ) : (
              props.inventoryProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.variant ? ` · ${p.variant}` : ""} — stock {p.stockQuantity}
                </option>
              ))
            )}
          </select>
        </label>
      ) : (
        <>
          <p className="rounded-lg border border-brand-blue/20 bg-brand-blue/5 px-2.5 py-2 text-[11px] text-zinc-300">
            Use this when the product is not in Inventory yet. Add the same item in
            Inventory when stock arrives — it will link automatically and move to
            Sales &amp; Orders when there is enough stock.
          </p>
          <label className="block space-y-0.5">
            <span className="text-[11px] text-zinc-400">Item name *</span>
            <input name="itemName" required className={inputClass} placeholder="e.g. Royal Canin Mini Adult 2kg" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-0.5">
              <span className="text-[11px] text-zinc-400">Brand</span>
              <input name="brand" className={inputClass} />
            </label>
            <label className="block space-y-0.5">
              <span className="text-[11px] text-zinc-400">Variant / size</span>
              <input name="variant" className={inputClass} />
            </label>
          </div>
          <label className="block space-y-0.5">
            <span className="text-[11px] text-zinc-400">Est. unit cost (₱) *</span>
            <input
              name="unitCost"
              inputMode="decimal"
              className={inputClass}
              placeholder="Wholesale estimate"
            />
          </label>
          {props.catalogItems.length > 0 ? (
            <div className="space-y-1">
              <span className="text-[11px] text-zinc-400">
                Link to supplier catalog (optional — helps auto-match Inventory)
              </span>
              <CatalogItemSelect
                items={props.catalogItems}
                value={catalogId}
                onChange={setCatalogId}
                name="supplierCatalogItemId"
              />
            </div>
          ) : null}
          <label className="block space-y-0.5">
            <span className="text-[11px] text-zinc-400">Supplier *</span>
            <select name="supplierId" required className={inputClass}>
              <option value="">Select supplier</option>
              {props.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {mode === "inventory" ? (
        <label className="block space-y-0.5">
          <span className="text-[11px] text-zinc-400">
            Supplier (optional — internal PO tracking)
          </span>
          <select name="supplierId" className={inputClass}>
            <option value="">Auto from product / any</option>
            {props.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block space-y-0.5">
        <span className="text-[11px] text-zinc-400">Quantity *</span>
        <input
          name="quantity"
          type="number"
          min={1}
          defaultValue={1}
          required
          className={inputClass}
        />
      </label>
      <label className="block space-y-0.5">
        <span className="text-[11px] text-zinc-400">Customer (optional pre-order for)</span>
        <input name="customerName" className={inputClass} />
      </label>
      <label className="block space-y-0.5">
        <span className="text-[11px] text-zinc-400">Expected date</span>
        <input name="expectedDate" type="date" className={inputClass} />
      </label>
      <label className="block space-y-0.5">
        <span className="text-[11px] text-zinc-400">Deposit (₱)</span>
        <input name="deposit" inputMode="decimal" className={inputClass} />
      </label>
      <label className="block space-y-0.5">
        <span className="text-[11px] text-zinc-400">Notes</span>
        <input name="notes" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={mode === "inventory" && props.inventoryProducts.length === 0}
        className="w-full rounded-lg bg-zinc-50 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        Create pre-order
      </button>
    </form>
  );
}
