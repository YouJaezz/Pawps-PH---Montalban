"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ItemTypeBadge } from "@/components/ItemTypeBadge";
import {
  displayCatalogBrand,
  displayCatalogFlavor,
  displayCatalogProductName,
} from "@/lib/catalog-item-display";

export type ProductSelectOption = {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
  itemType: string | null;
  meta?: string;
};

function productTitle(p: ProductSelectOption) {
  return displayCatalogProductName({
    itemName: p.name,
    brand: p.brand,
    variant: p.variant,
  });
}

function productSubtitle(p: ProductSelectOption) {
  const brand = displayCatalogBrand(p.brand);
  const flavor = displayCatalogFlavor(p.variant, p.name);
  return [brand !== "—" ? brand : null, flavor !== "—" ? flavor : null]
    .filter(Boolean)
    .join(" · ");
}

export function ProductSelectField(props: {
  products: ProductSelectOption[];
  value: number;
  onChange: (id: number) => void;
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = props.products.find((p) => p.id === props.value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.products;
    return props.products.filter((p) => {
      const hay = [
        p.name,
        p.brand,
        p.variant,
        p.itemType,
        p.meta,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [props.products, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative space-y-1">
      {props.label ? (
        <div className="text-[11px] text-zinc-400">{props.label}</div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-left outline-none hover:border-white/20 focus:border-white/25"
      >
        {selected ? (
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <ItemTypeBadge itemType={selected.itemType} size="xs" />
              <span className="truncate text-sm font-medium text-zinc-50">
                {productTitle(selected)}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-zinc-500">
              {productSubtitle(selected)}
              {selected.meta ? ` · ${selected.meta}` : null}
            </div>
          </div>
        ) : (
          <span className="text-sm text-zinc-500">
            {props.placeholder ?? "Select a product…"}
          </span>
        )}
        <span className="shrink-0 pt-0.5 text-[10px] text-zinc-500">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0f0f16] shadow-2xl">
          <div className="border-b border-white/10 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, brand, type…"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-[11px] text-zinc-500">
                No products match your search.
              </li>
            ) : (
              filtered.map((p) => {
                const active = p.id === props.value;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        props.onChange(p.id);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-white/5 ${
                        active ? "bg-brand-blue/10" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ItemTypeBadge itemType={p.itemType} size="xs" />
                          <span className="truncate text-xs font-medium text-zinc-100">
                            {productTitle(p)}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-zinc-500">
                          {productSubtitle(p)}
                          {p.meta ? ` · ${p.meta}` : null}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
