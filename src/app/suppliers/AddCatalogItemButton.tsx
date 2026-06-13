"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createSupplierCatalogItem } from "@/app/suppliers/actions";
import { ItemTypePicker } from "@/components/ItemTypePicker";
import type { PriceUnit } from "@/db/schema";
import {
  CATALOG_ITEM_TYPES,
  defaultPackUnitForItemType,
  defaultPriceUnitForItemType,
  packSizeHintForItemType,
} from "@/lib/catalog-item-types";
import { priceUnitLabel } from "@/lib/price-units";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20";

export function AddCatalogItemButton(props: {
  suppliers: { id: number; name: string }[];
  defaultSupplierId?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [itemType, setItemType] = useState<string>(CATALOG_ITEM_TYPES[0]!.value);
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("Sack");
  const [packUnit, setPackUnit] = useState("kg");

  function handleItemTypeChange(next: string) {
    setItemType(next);
    setPriceUnit(defaultPriceUnitForItemType(next));
    setPackUnit(defaultPackUnitForItemType(next));
  }

  const defaultSupplier =
    props.defaultSupplierId != null
      ? String(props.defaultSupplierId)
      : props.suppliers[0]
        ? String(props.suppliers[0].id)
        : "";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={props.suppliers.length === 0}
        className="rounded-md border border-brand-blue/30 bg-brand-blue/10 px-2.5 py-1 text-[10px] text-brand-blue hover:bg-brand-blue/15 disabled:opacity-50"
      >
        Add item
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-zinc-100">Add pricelist item</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Close
          </button>
        </div>

        <p className="mt-2 text-[10px] text-zinc-500">
          Prices are what the supplier charges — not your shop retail or wholesale.
        </p>

        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              try {
                await createSupplierCatalogItem(fd);
                setOpen(false);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to add item.");
              }
            });
          }}
        >
          <label className="block space-y-0.5">
            <span className="text-[11px] text-zinc-400">Supplier *</span>
            <select
              name="supplierId"
              required
              defaultValue={defaultSupplier}
              className={inputClass}
            >
              {props.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <input
            name="itemName"
            required
            placeholder="Item name *"
            className={inputClass}
          />
          <ItemTypePicker
            name="itemType"
            label="Item type *"
            value={itemType}
            onChange={handleItemTypeChange}
            compact
          />

          <div className="grid grid-cols-2 gap-2">
            <input name="brand" placeholder="Brand" className={inputClass} />
            <input name="variant" placeholder="Flavor" className={inputClass} />
          </div>

          <div className="rounded-lg border border-white/5 bg-black/20 px-2.5 py-2">
            <div className="text-[10px] font-medium text-zinc-500">Pack size</div>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              {packSizeHintForItemType(itemType)}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                name="packSize"
                placeholder="Number (7, 400…)"
                className={inputClass}
              />
              <input
                name="packUnit"
                value={packUnit}
                onChange={(e) => setPackUnit(e.target.value)}
                placeholder="Unit"
                className={inputClass}
              />
            </div>
          </div>

          <label className="block space-y-0.5">
            <span className="text-[11px] text-zinc-400">Supplier prices are per…</span>
            <select
              name="priceUnit"
              value={priceUnit}
              onChange={(e) => setPriceUnit(e.target.value as PriceUnit)}
              className={inputClass}
            >
              <option value="Sack">Sack (dry food bags)</option>
              <option value="Piece">Piece (can / pouch)</option>
              <option value="Case">Case (box of cans)</option>
            </select>
          </label>

          {priceUnit === "Case" ? (
            <label className="block space-y-0.5">
              <span className="text-[11px] text-zinc-400">Cans per case</span>
              <input
                name="unitsPerCase"
                type="number"
                min={1}
                defaultValue={24}
                className={inputClass}
              />
            </label>
          ) : (
            <input type="hidden" name="unitsPerCase" value="24" />
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-0.5">
              <span className="text-[10px] text-zinc-500">
                WS {priceUnitLabel(priceUnit)}
              </span>
              <input name="unitCost" inputMode="decimal" className={inputClass} />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-zinc-500">
                Retail {priceUnitLabel(priceUnit)}
              </span>
              <input name="retailPrice" inputMode="decimal" className={inputClass} />
            </label>
          </div>

          {priceUnit === "Sack" ? (
            <label className="space-y-0.5">
              <span className="text-[10px] text-zinc-500">Per kg WS (optional)</span>
              <input name="perKiloPrice" inputMode="decimal" className={inputClass} />
            </label>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">
              {error}
            </div>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-zinc-50 py-2 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {pending ? "Adding…" : "Add to pricelist"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
