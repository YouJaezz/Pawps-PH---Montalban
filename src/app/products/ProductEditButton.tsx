"use client";

import { useState } from "react";

import { updateProduct } from "@/app/products/actions";
import { formatPhpFromCents } from "@/lib/money";

export type ProductEditRow = {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
  costPrice: number;
  retailPrice: number;
  bulkPrice: number;
  purchaseTier: string;
  supplierId: number | null;
  supplierRetailPrice: number | null;
  supplierBulkPrice: number | null;
};

const inputClass =
  "w-full rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-zinc-50 outline-none";

function centsToInput(cents: number | null | undefined) {
  if (cents == null) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export function ProductEditButton(props: {
  product: ProductEditRow;
  suppliers: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-[#e8a44a]/90 hover:text-[#e8a44a]"
      >
        Edit
      </button>
    );
  }

  const p = props.product;

  return (
    <div className="mt-1 space-y-1.5 rounded-lg border border-[#e8a44a]/25 bg-[#e8a44a]/5 p-2">
      <div className="text-[10px] font-medium text-zinc-200">Edit product</div>
      <form action={updateProduct} className="space-y-1">
        <input type="hidden" name="productId" value={p.id} />
        <input
          name="name"
          required
          defaultValue={p.name}
          placeholder="Item name"
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-1">
          <input
            name="brand"
            required
            defaultValue={p.brand}
            placeholder="Brand"
            className={inputClass}
          />
          <input
            name="variant"
            defaultValue={p.variant ?? ""}
            placeholder="Flavor / variant"
            className={inputClass}
          />
        </div>
        <select
          name="supplierId"
          defaultValue={p.supplierId ? String(p.supplierId) : ""}
          className={inputClass}
        >
          <option value="">No supplier</option>
          {props.suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          name="purchaseTier"
          defaultValue={p.purchaseTier}
          className={inputClass}
        >
          <option value="Wholesale">Bought wholesale</option>
          <option value="Retail">Bought retail</option>
        </select>
        <div className="grid grid-cols-3 gap-1">
          <label className="text-[9px] text-zinc-500">
            Cost
            <input
              name="costPrice"
              required
              defaultValue={centsToInput(p.costPrice)}
              className={inputClass}
            />
          </label>
          <label className="text-[9px] text-zinc-500">
            Retail
            <input
              name="retailPrice"
              required
              defaultValue={centsToInput(p.retailPrice)}
              className={inputClass}
            />
          </label>
          <label className="text-[9px] text-zinc-500">
            Bulk
            <input
              name="bulkPrice"
              defaultValue={centsToInput(p.bulkPrice)}
              className={inputClass}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <label className="text-[9px] text-zinc-500">
            Sup. retail
            <input
              name="supplierRetailPrice"
              defaultValue={centsToInput(p.supplierRetailPrice)}
              className={inputClass}
            />
          </label>
          <label className="text-[9px] text-zinc-500">
            Sup. WS
            <input
              name="supplierBulkPrice"
              defaultValue={centsToInput(p.supplierBulkPrice)}
              className={inputClass}
            />
          </label>
        </div>
        <div className="text-[9px] text-zinc-600">
          Stock: use Restock + to change quantity
        </div>
        <div className="flex gap-1">
          <button
            type="submit"
            className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400"
          >
            Cancel
          </button>
        </div>
      </form>
      <div className="text-[9px] text-zinc-600">
        Margin @ retail:{" "}
        {formatPhpFromCents(Math.max(0, p.retailPrice - p.costPrice))}/unit
      </div>
    </div>
  );
}
