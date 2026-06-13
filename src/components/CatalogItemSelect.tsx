"use client";

import { useMemo, useState } from "react";

import { ItemTypeBadge } from "@/components/ItemTypeBadge";
import {
  displayCatalogBrand,
  displayCatalogFlavor,
  displayCatalogProductName,
} from "@/lib/catalog-item-display";
import { displayCatalogItemType, normalizeCatalogItemType } from "@/lib/catalog-item-types";

export type CatalogSelectOption = {
  id: number;
  itemName: string;
  brand: string | null;
  variant: string | null;
  itemType?: string | null;
};

const fieldClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20";

export function CatalogItemSelect(props: {
  items: CatalogSelectOption[];
  value: string;
  onChange: (id: string) => void;
  name?: string;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of props.items) {
      set.add(normalizeCatalogItemType(item.itemType));
    }
    return Array.from(set).sort((a, b) =>
      displayCatalogItemType(a).localeCompare(displayCatalogItemType(b)),
    );
  }, [props.items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.items.filter((c) => {
      const type = normalizeCatalogItemType(c.itemType);
      if (typeFilter !== "all" && type !== typeFilter) return false;
      if (!q) return true;
      const label = [
        c.itemName,
        c.brand,
        c.variant,
        displayCatalogItemType(type),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return label.includes(q);
    });
  }, [props.items, query, typeFilter]);

  const selected = props.items.find((c) => String(c.id) === props.value);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search catalog…"
          className={fieldClass}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className={`${fieldClass} sm:min-w-[9rem]`}
        >
          <option value="all">All types</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {displayCatalogItemType(t)}
            </option>
          ))}
        </select>
      </div>

      <select
        name={props.name}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={`${fieldClass} min-h-[2.25rem]`}
        size={Math.min(Math.max(filtered.length + 1, 4), 8)}
      >
        <option value="">Manual entry — type details yourself</option>
        {filtered.map((c) => {
          const title = displayCatalogProductName(c);
          const brand = displayCatalogBrand(c.brand);
          const flavor = displayCatalogFlavor(c.variant, c.itemName);
          const typeLabel = displayCatalogItemType(c.itemType);
          const detail = [typeLabel, brand !== "—" ? brand : null, flavor !== "—" ? flavor : null]
            .filter(Boolean)
            .join(" · ");
          return (
            <option key={c.id} value={c.id}>
              {title} — {detail}
            </option>
          );
        })}
      </select>

      {selected ? (
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <ItemTypeBadge itemType={selected.itemType} />
            <span className="text-sm font-medium text-zinc-100">
              {displayCatalogProductName(selected)}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {displayCatalogBrand(selected.brand)}
            {displayCatalogFlavor(selected.variant, selected.itemName) !== "—"
              ? ` · ${displayCatalogFlavor(selected.variant, selected.itemName)}`
              : ""}
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-zinc-600">
          Pick from your supplier pricelist, or choose manual entry to add a custom item.
        </p>
      )}
    </div>
  );
}
