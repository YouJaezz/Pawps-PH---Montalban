"use client";

import { useState } from "react";

import { updateSupplierCatalogItem } from "@/app/suppliers/actions";
import type { PriceUnit } from "@/db/schema";
import { priceUnitLabel } from "@/lib/price-units";

const inputClass =
  "w-full rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[10px] text-zinc-50 outline-none";

function centsToInput(cents: number | null | undefined) {
  if (cents == null) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export function CatalogItemEditButton(props: {
  id: number;
  itemName: string;
  brand: string | null;
  variant: string | null;
  unitCost: number | null;
  retailPrice: number | null;
  perKiloPrice: number | null;
  packSize: string | null;
  packUnit: string | null;
  priceUnit?: string | null;
  unitsPerCase?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [priceUnit, setPriceUnit] = useState<PriceUnit>(
    (props.priceUnit as PriceUnit) ?? "Sack",
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-[#e8a44a]/80 hover:text-[#e8a44a]"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="mt-1 rounded-lg border border-[#e8a44a]/20 bg-black/30 p-2">
      <form action={updateSupplierCatalogItem} className="space-y-1">
        <input type="hidden" name="id" value={props.id} />
        <input
          name="itemName"
          required
          defaultValue={props.itemName}
          placeholder="Item name"
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-1">
          <input
            name="brand"
            defaultValue={props.brand ?? ""}
            placeholder="Brand"
            className={inputClass}
          />
          <input
            name="variant"
            defaultValue={props.variant ?? ""}
            placeholder="Flavor"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <input
            name="packSize"
            defaultValue={props.packSize ?? ""}
            placeholder="Size (e.g. 20)"
            className={inputClass}
          />
          <input
            name="packUnit"
            defaultValue={props.packUnit ?? ""}
            placeholder="Unit (kg)"
            className={inputClass}
          />
        </div>
        <select
          name="priceUnit"
          value={priceUnit}
          onChange={(e) => setPriceUnit(e.target.value as PriceUnit)}
          className={inputClass}
        >
          <option value="Sack">Sack</option>
          <option value="Piece">Piece</option>
          <option value="Case">Case</option>
        </select>
        {priceUnit === "Case" ? (
          <input
            name="unitsPerCase"
            type="number"
            min={1}
            defaultValue={props.unitsPerCase ?? 24}
            placeholder="Cans per case"
            className={inputClass}
          />
        ) : (
          <input type="hidden" name="unitsPerCase" value={props.unitsPerCase ?? 24} />
        )}
        <div className="grid grid-cols-2 gap-1">
          <input
            name="unitCost"
            defaultValue={centsToInput(props.unitCost)}
            placeholder={`WS ${priceUnitLabel(priceUnit)}`}
            className={inputClass}
          />
          <input
            name="retailPrice"
            defaultValue={centsToInput(props.retailPrice)}
            placeholder={`Retail ${priceUnitLabel(priceUnit)}`}
            className={inputClass}
          />
        </div>
        {priceUnit === "Sack" ? (
          <input
            name="perKiloPrice"
            defaultValue={centsToInput(props.perKiloPrice)}
            placeholder="Per kg WS"
            className={inputClass}
          />
        ) : null}
        <div className="flex gap-1">
          <button
            type="submit"
            className="rounded border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-200"
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
    </div>
  );
}
