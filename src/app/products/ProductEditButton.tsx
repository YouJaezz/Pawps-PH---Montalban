"use client";

import { useEffect, useState } from "react";

import { updateProduct } from "@/app/products/actions";
import { STOCK_UNITS, type StockUnit } from "@/db/schema";
import { formatPhpFromCents } from "@/lib/money";

export type ProductEditRow = {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
  packSize: string | null;
  stockUnit: StockUnit;
  stockQuantity: number;
  retailPrice: number;
  bulkPrice: number;
};

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-zinc-50 outline-none focus:border-white/20";

function centsToInput(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function stockQtyLabel(unit: StockUnit) {
  if (unit === "Kilogram") return "Stock (kg)";
  if (unit === "Pack") return "Stock (packs)";
  return "Stock (pcs)";
}

export function ProductEditButton(props: { product: ProductEditRow }) {
  const [open, setOpen] = useState(false);
  const [stockUnit, setStockUnit] = useState<StockUnit>(props.product.stockUnit);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const p = props.product;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStockUnit(props.product.stockUnit);
          setOpen(true);
        }}
        className="text-[10px] text-[#e8a44a]/90 hover:text-[#e8a44a]"
      >
        Edit
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-[#13131f] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="edit-product-title"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-zinc-500">Inventory</div>
                <h2
                  id="edit-product-title"
                  className="text-lg font-semibold text-zinc-50"
                >
                  Edit item
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                Close
              </button>
            </div>

            <form action={updateProduct} className="mt-4 space-y-3">
              <input type="hidden" name="productId" value={p.id} />

              <label className="block space-y-1">
                <span className="text-xs text-zinc-400">Item name *</span>
                <input
                  name="name"
                  required
                  defaultValue={p.name}
                  className={inputClass}
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-xs text-zinc-400">Brand *</span>
                  <input
                    name="brand"
                    required
                    defaultValue={p.brand}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-zinc-400">Flavor</span>
                  <input
                    name="variant"
                    defaultValue={p.variant ?? ""}
                    placeholder="Chicken, beef…"
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-xs text-zinc-400">Pack size</span>
                  <input
                    name="packSize"
                    defaultValue={p.packSize ?? ""}
                    placeholder="20kg, 400g, 7kg"
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-zinc-400">Stock unit</span>
                  <select
                    name="stockUnit"
                    value={stockUnit}
                    onChange={(e) => setStockUnit(e.target.value as StockUnit)}
                    className={inputClass}
                  >
                    {STOCK_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs text-zinc-400">
                  {stockQtyLabel(stockUnit)}
                </span>
                <input
                  name="stockQuantity"
                  type="number"
                  min={0}
                  step={stockUnit === "Kilogram" ? "0.1" : "1"}
                  required
                  defaultValue={String(p.stockQuantity)}
                  className={inputClass}
                />
                <span className="text-[10px] text-zinc-600">
                  Use whole numbers for pieces/packs. For kg you can use
                  decimals (e.g. 12.5).
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-xs text-zinc-400">Sell retail (₱)</span>
                  <input
                    name="retailPrice"
                    required
                    defaultValue={centsToInput(p.retailPrice)}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-zinc-400">Sell bulk (₱)</span>
                  <input
                    name="bulkPrice"
                    defaultValue={centsToInput(p.bulkPrice)}
                    placeholder="Optional"
                    className={inputClass}
                  />
                </label>
              </div>

              <p className="text-[10px] text-zinc-600">
                Purchase cost and supplier link stay as-is — change those from
                the supplier catalog if needed.
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-zinc-50 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </form>

            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-500">
              Current sell retail:{" "}
              <span className="text-zinc-200">
                {formatPhpFromCents(p.retailPrice)}
              </span>
              {p.bulkPrice > 0 ? (
                <>
                  {" "}
                  · bulk{" "}
                  <span className="text-zinc-200">
                    {formatPhpFromCents(p.bulkPrice)}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
