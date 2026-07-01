"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { createProduct } from "@/app/products/actions";
import type { BranchOption, CatalogPickOption, SupplierOption } from "@/app/products/ProductForm";
import { CatalogItemSelect } from "@/components/CatalogItemSelect";
import {
  displayCatalogProductName,
} from "@/lib/catalog-item-display";
import { isCatLitterItemType } from "@/lib/catalog-item-types";
import { formatPhpFromCents } from "@/lib/money";
import {
  isWeightProduct,
} from "@/lib/price-units";
import { catalogItemKey } from "@/lib/supplier-item-key";

function CreateProductMessage(props: {
  result: { ok: boolean; error?: string; itemLabel?: string } | null;
}) {
  if (!props.result) return null;
  if (props.result.error) {
    return (
      <p className="mt-2 text-xs text-red-300" role="alert">
        {props.result.error}
      </p>
    );
  }
  if (props.result.ok && props.result.itemLabel) {
    return (
      <p className="mt-2 text-xs text-emerald-300" role="status">
        Added {props.result.itemLabel} to inventory — select it above to restock.
      </p>
    );
  }
  return null;
}

function centsToInput(cents: number | null | undefined) {
  if (cents == null || cents <= 0) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function inferKgPerSack(catalog: CatalogPickOption | undefined) {
  if (!catalog?.packSize) return "";
  const unit = catalog.packUnit?.toLowerCase() ?? "kg";
  if (unit !== "kg" && unit !== "") return "";
  const n = Number(catalog.packSize);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(n);
}

export function ShopCashQuickAddProduct(props: {
  suppliers: SupplierOption[];
  catalogItems: CatalogPickOption[];
  inventoryCatalogItemIds: number[];
  inventoryProductKeys: string[];
  branches: BranchOption[];
  onAdded: (productId: number) => void;
}) {
  const [state, formAction, pending] = useActionState(createProduct, null);
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(
    props.suppliers[0]?.id ? String(props.suppliers[0].id) : "",
  );
  const [catalogItemId, setCatalogItemId] = useState("");
  const [retailInput, setRetailInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");

  const numericSupplierId = Number.parseInt(supplierId, 10);
  const defaultBranchId =
    props.branches.find((b) => b.isDefault)?.id ?? props.branches[0]?.id ?? "";

  const inventoryCatalogSet = useMemo(
    () => new Set(props.inventoryCatalogItemIds),
    [props.inventoryCatalogItemIds],
  );
  const inventoryKeySet = useMemo(
    () => new Set(props.inventoryProductKeys),
    [props.inventoryProductKeys],
  );

  const catalogForSupplier = useMemo(
    () => props.catalogItems.filter((c) => c.supplierId === numericSupplierId),
    [props.catalogItems, numericSupplierId],
  );

  const missingFromInventory = useMemo(
    () =>
      catalogForSupplier.filter((c) => {
        if (inventoryCatalogSet.has(c.id)) return false;
        const key = catalogItemKey({
          brand: c.brand,
          variant: c.variant,
          itemName: c.itemName,
        });
        return !inventoryKeySet.has(key);
      }),
    [catalogForSupplier, inventoryCatalogSet, inventoryKeySet],
  );

  const selectedCatalog = useMemo(
    () => catalogForSupplier.find((c) => String(c.id) === catalogItemId),
    [catalogForSupplier, catalogItemId],
  );

  const isLitter = selectedCatalog
    ? isCatLitterItemType(selectedCatalog.itemType)
    : false;
  const isWeight = selectedCatalog
    ? isWeightProduct({
        priceUnit: selectedCatalog.priceUnit,
        packUnit: selectedCatalog.packUnit,
        itemType: selectedCatalog.itemType,
      })
    : false;
  const trackInKg = isWeight && !isLitter;
  const kgPerSack = inferKgPerSack(selectedCatalog);

  useEffect(() => {
    if (!selectedCatalog) return;
    const ws = selectedCatalog.unitCost ?? 0;
    const supRetail = selectedCatalog.retailPrice ?? 0;
    setRetailInput(centsToInput(supRetail > 0 ? supRetail : ws > 0 ? Math.round(ws * 1.15) : 0));
    setBulkInput(centsToInput(ws));
  }, [selectedCatalog]);

  useEffect(() => {
    if (state?.ok && state.productId) {
      props.onAdded(state.productId);
      setOpen(false);
      setCatalogItemId("");
    }
  }, [state?.ok, state?.productId, props.onAdded]);

  if (props.suppliers.length === 0) {
    return (
      <p className="text-[11px] text-zinc-500">
        Add a supplier first under{" "}
        <a href="/suppliers" className="underline hover:text-zinc-300">
          Suppliers
        </a>
        .
      </p>
    );
  }

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-xl border border-brand-blue/20 bg-brand-blue/5"
    >
      <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-brand-cyan/90 hover:bg-brand-blue/10">
        Product not in the list? Add from supplier catalog
        {missingFromInventory.length > 0 ? (
          <span className="ml-2 font-normal text-zinc-500">
            ({missingFromInventory.length} on pricelist, not in inventory)
          </span>
        ) : null}
      </summary>

      <div className="border-t border-brand-blue/15 px-4 py-4">
        <p className="text-[11px] text-zinc-500">
          Pick an item from your supplier pricelist to add it to inventory. You can
          record the restock payment right after — stock is added separately in the
          form above.
        </p>

        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="stockQuantity" value="0" />
          <input type="hidden" name="purchaseTier" value="Wholesale" />
          <input type="hidden" name="branchId" value={defaultBranchId} />
          {selectedCatalog ? (
            <>
              <input type="hidden" name="name" value={selectedCatalog.itemName} />
              <input type="hidden" name="brand" value={selectedCatalog.brand ?? selectedCatalog.itemName} />
              <input type="hidden" name="variant" value={selectedCatalog.variant ?? ""} />
              <input type="hidden" name="itemType" value={selectedCatalog.itemType ?? ""} />
              {trackInKg ? <input type="hidden" name="trackInKg" value="on" /> : null}
              {kgPerSack ? <input type="hidden" name="kgPerSack" value={kgPerSack} /> : null}
              <input
                type="hidden"
                name="unitsPerCase"
                value={String(selectedCatalog.unitsPerCase ?? 24)}
              />
            </>
          ) : null}

          <label className="block text-xs text-zinc-400">
            Supplier
            <select
              name="supplierId"
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                setCatalogItemId("");
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            >
              {props.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.itemCount != null ? ` (${s.itemCount} catalog)` : ""}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="mb-1 text-xs text-zinc-400">Supplier catalog item</div>
            <CatalogItemSelect
              name="supplierCatalogItemId"
              items={missingFromInventory.length > 0 ? missingFromInventory : catalogForSupplier}
              value={catalogItemId}
              onChange={setCatalogItemId}
            />
            {missingFromInventory.length === 0 && catalogForSupplier.length > 0 ? (
              <p className="mt-1 text-[10px] text-zinc-600">
                All items for this supplier are already in inventory — you can still pick
                one to link a duplicate row.
              </p>
            ) : null}
          </div>

          {selectedCatalog ? (
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-zinc-400">
              Adding{" "}
              <span className="text-zinc-200">
                {displayCatalogProductName(selectedCatalog)}
              </span>
              {selectedCatalog.unitCost ? (
                <>
                  {" "}
                  · supplier WS {formatPhpFromCents(selectedCatalog.unitCost)}
                </>
              ) : null}
              {trackInKg ? " · tracks stock in kg" : " · tracks stock in pcs"}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400">
              Our retail sell price (₱)
              <input
                name="retailPrice"
                type="number"
                min="0"
                step="0.01"
                required
                value={retailInput}
                onChange={(e) => setRetailInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Our bulk / WS sell price (₱)
              <input
                name="bulkPrice"
                type="number"
                min="0"
                step="0.01"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={pending || !catalogItemId}
            className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add to inventory"}
          </button>
          <CreateProductMessage result={state} />
        </form>
      </div>
    </details>
  );
}
