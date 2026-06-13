"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ProductForm, type CatalogPickOption, type SupplierOption } from "@/app/products/ProductForm";

export function ProductAddButton(props: {
  suppliers: SupplierOption[];
  catalogItems: CatalogPickOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={props.suppliers.length === 0}
        className="rounded-lg bg-zinc-50 px-4 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        Add item
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-product-title"
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-surface-elevated p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-zinc-500">Inventory</div>
                <h2
                  id="add-product-title"
                  className="text-lg font-semibold text-zinc-50"
                >
                  Add item
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

            <div className="mt-4">
              <ProductForm
                suppliers={props.suppliers}
                catalogItems={props.catalogItems}
                onSuccess={() => {
                  setOpen(false);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
