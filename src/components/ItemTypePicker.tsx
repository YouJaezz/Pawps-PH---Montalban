"use client";

import {
  CATALOG_ITEM_TYPE_GROUPS,
  type CatalogItemTypeValue,
} from "@/lib/catalog-item-types";

export function ItemTypePicker(props: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      {props.label ? (
        <div className="text-[11px] text-zinc-400">{props.label}</div>
      ) : null}
      {props.name ? (
        <input type="hidden" name={props.name} value={props.value} />
      ) : null}
      <div className="space-y-3">
        {CATALOG_ITEM_TYPE_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
              {group.label}
            </div>
            <div
              className={`mt-1.5 grid gap-1.5 ${props.compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}
            >
              {group.types.map((t) => {
                const selected = props.value === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => props.onChange(t.value)}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                      selected
                        ? "border-brand-blue/50 bg-brand-blue/10 ring-1 ring-brand-blue/30"
                        : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className="min-w-0 flex-1 text-[11px] leading-snug text-zinc-200">
                      {t.label}
                    </span>
                    {selected ? (
                      <span className="shrink-0 text-[9px] font-medium text-brand-blue">
                        Selected
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { CatalogItemTypeValue };
