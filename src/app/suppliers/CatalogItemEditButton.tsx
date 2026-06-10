"use client";

import { useState } from "react";

import { updateSupplierCatalogItem } from "@/app/suppliers/actions";
import { EditModal, modalFieldClass } from "@/components/EditModal";
import type { PriceUnit } from "@/db/schema";
import {
  CATALOG_ITEM_TYPES,
  defaultPackUnitForItemType,
  defaultPriceUnitForItemType,
  normalizeCatalogItemType,
  packSizeHintForItemType,
} from "@/lib/catalog-item-types";
import { priceUnitLabel } from "@/lib/price-units";

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
  itemType?: string | null;
  priceUnit?: string | null;
  unitsPerCase?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const normalizedType = normalizeCatalogItemType(props.itemType);
  const [itemType, setItemType] = useState<string>(normalizedType);
  const [priceUnit, setPriceUnit] = useState<PriceUnit>(
    (props.priceUnit as PriceUnit) ?? defaultPriceUnitForItemType(normalizedType),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-[#e8a44a]/80 hover:text-[#e8a44a]"
      >
        Edit
      </button>
      <EditModal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit catalog item"
        subtitle={props.itemName}
        maxWidth="lg"
      >
        <form action={updateSupplierCatalogItem} className="space-y-2">
          <input type="hidden" name="id" value={props.id} />
          <input
            name="itemName"
            required
            defaultValue={props.itemName}
            placeholder="Item name"
            className={modalFieldClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              name="brand"
              defaultValue={props.brand ?? ""}
              placeholder="Brand"
              className={modalFieldClass}
            />
            <input
              name="variant"
              defaultValue={props.variant ?? ""}
              placeholder="Flavor"
              className={modalFieldClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              name="packSize"
              defaultValue={props.packSize ?? ""}
              placeholder="Pack #"
              className={modalFieldClass}
            />
            <input
              name="packUnit"
              defaultValue={props.packUnit ?? defaultPackUnitForItemType(itemType)}
              placeholder="kg, g…"
              className={modalFieldClass}
            />
          </div>
          <p className="text-[9px] text-zinc-600">{packSizeHintForItemType(itemType)}</p>
          <select
            name="itemType"
            value={itemType}
            onChange={(e) => {
              setItemType(e.target.value);
              setPriceUnit(defaultPriceUnitForItemType(e.target.value));
            }}
            className={modalFieldClass}
          >
            {CATALOG_ITEM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            name="priceUnit"
            value={priceUnit}
            onChange={(e) => setPriceUnit(e.target.value as PriceUnit)}
            className={modalFieldClass}
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
              className={modalFieldClass}
            />
          ) : (
            <input type="hidden" name="unitsPerCase" value={props.unitsPerCase ?? 24} />
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              name="unitCost"
              defaultValue={centsToInput(props.unitCost)}
              placeholder={`WS ${priceUnitLabel(priceUnit)}`}
              className={modalFieldClass}
            />
            <input
              name="retailPrice"
              defaultValue={centsToInput(props.retailPrice)}
              placeholder={`Retail ${priceUnitLabel(priceUnit)}`}
              className={modalFieldClass}
            />
          </div>
          {priceUnit === "Sack" ? (
            <input
              name="perKiloPrice"
              defaultValue={centsToInput(props.perKiloPrice)}
              placeholder="Per kg WS"
              className={modalFieldClass}
            />
          ) : null}
          <button
            type="submit"
            className="rounded-lg bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900"
          >
            Save catalog item
          </button>
        </form>
      </EditModal>
    </>
  );
}
