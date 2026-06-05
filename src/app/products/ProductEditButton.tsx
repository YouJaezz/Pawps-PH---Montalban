"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { updateProduct } from "@/app/products/actions";
import { STOCK_UNITS, type StockUnit } from "@/db/schema";
import { displayKgPerSack } from "@/lib/order-line-math";
import { formatPhpFromCents } from "@/lib/money";
import { displayStockQuantity, stockQtyLabel } from "@/lib/product-stock";

export type ProductEditRow = {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
  packSize: string | null;
  stockUnit: StockUnit;
  stockQuantity: number;
  kgPerSack: number | null;
  unitsPerCase: number | null;
  retailPrice: number;
  bulkPrice: number;
};

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-zinc-50 outline-none focus:border-white/20";

function centsToInput(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export function ProductEditButton(props: { product: ProductEditRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [stockUnit, setStockUnit] = useState<StockUnit>(props.product.stockUnit);
  const [stockEntryMode, setStockEntryMode] = useState<"sacks" | "kg" | "cases" | "pcs">(
    props.product.stockUnit === "Kilogram" ? "kg" : "pcs",
  );
  const [kgPerSackInput, setKgPerSackInput] = useState(
    props.product.kgPerSack != null
      ? String(displayKgPerSack(props.product.kgPerSack) ?? "")
      : "",
  );

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
  const isWeight =
    stockUnit === "Kilogram" || stockUnit === "Sack" || p.kgPerSack != null;
  const displayQty = displayStockQuantity(
    stockUnit === "Sack" ? "Kilogram" : stockUnit,
    p.stockQuantity,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStockUnit(props.product.stockUnit);
          setKgPerSackInput(
            props.product.kgPerSack != null
              ? String(displayKgPerSack(props.product.kgPerSack) ?? "")
              : "",
          );
          setOpen(true);
        }}
        className="rounded border border-[#e8a44a]/30 px-2 py-0.5 text-[10px] text-[#e8a44a] hover:bg-[#e8a44a]/10"
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

            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  try {
                    await updateProduct(fd);
                    setOpen(false);
                    router.refresh();
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "Save failed.");
                  }
                });
              }}
            >
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

              {isWeight ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-400">Kg per sack</span>
                    <input
                      name="kgPerSack"
                      value={kgPerSackInput}
                      onChange={(e) => setKgPerSackInput(e.target.value)}
                      inputMode="decimal"
                      step="0.1"
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-400">Stock entry</span>
                    <select
                      name="stockEntryMode"
                      value={stockEntryMode}
                      onChange={(e) =>
                        setStockEntryMode(e.target.value as "sacks" | "kg")
                      }
                      className={inputClass}
                    >
                      <option value="sacks">Sacks</option>
                      <option value="kg">Kilograms</option>
                    </select>
                  </label>
                </div>
              ) : null}

              <label className="block space-y-1">
                <span className="text-xs text-zinc-400">
                  {stockQtyLabel(
                    stockUnit === "Sack" ? "Kilogram" : stockUnit,
                    isWeight ? stockEntryMode : undefined,
                  )}
                </span>
                <input
                  name="stockQuantity"
                  type="number"
                  min={0}
                  step={
                    stockUnit === "Kilogram" || stockUnit === "Sack" ? "0.1" : "1"
                  }
                  required
                  defaultValue={String(displayQty)}
                  className={inputClass}
                />
                <span className="text-[10px] text-zinc-600">
                  Weight items are stored as kg. Use sacks + kg/sack when receiving
                  by sack.
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-xs text-zinc-400">
                    {isWeight ? "Our retail (per kg)" : "Our retail (per pc)"}
                  </span>
                  <input
                    name="retailPrice"
                    required
                    defaultValue={centsToInput(p.retailPrice)}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-zinc-400">
                    {isWeight ? "Our wholesale (per kg)" : "Our wholesale (per pc)"}
                  </span>
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
                  disabled={pending}
                  className="flex-1 rounded-lg bg-zinc-50 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save changes"}
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
                {isWeight ? " / kg" : ""}
              </span>
              {p.bulkPrice > 0 ? (
                <>
                  {" "}
                  · bulk{" "}
                  <span className="text-zinc-200">
                    {formatPhpFromCents(p.bulkPrice)}
                    {isWeight ? " / kg" : ""}
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
