"use client";

import { useActionState, useMemo, useState } from "react";

import {
  createProduct,
  type CreateProductResult,
} from "@/app/products/actions";
import {
  displayCatalogFlavor,
  displayCatalogItem,
} from "@/lib/catalog-item-display";
import { formatPhpFromCents } from "@/lib/money";

export type CatalogPickOption = {
  id: number;
  supplierId: number;
  itemName: string;
  brand: string | null;
  variant: string | null;
  unitCost: number | null;
  retailPrice: number | null;
};

export type SupplierOption = {
  id: number;
  name: string;
  itemCount?: number;
};

const fieldClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20";

const readOnlyClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-300";

function centsToInput(cents: number | null | undefined) {
  if (cents == null) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function parseMoneyInput(value: string) {
  const n = Number(value.trim());
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function ProfitLine(props: {
  label: string;
  perUnit: number;
  total: number | null;
  stock: number;
}) {
  return (
    <div className="flex items-start justify-between gap-2 text-[11px]">
      <span className="text-zinc-400">{props.label}</span>
      <div className="text-right">
        <div className="font-medium text-emerald-400">
          {formatPhpFromCents(props.perUnit)} / unit
        </div>
        {props.stock > 0 && props.total != null ? (
          <div className="text-zinc-500">
            {formatPhpFromCents(props.total)} total ({props.stock} pcs)
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProductForm(props: {
  suppliers: SupplierOption[];
  catalogItems: CatalogPickOption[];
}) {
  const [state, formAction, pending] = useActionState<
    CreateProductResult | null,
    FormData
  >(createProduct, null);

  const [supplierId, setSupplierId] = useState(
    props.suppliers[0]?.id ? String(props.suppliers[0].id) : "",
  );
  const [catalogItemId, setCatalogItemId] = useState("");
  const [stockInput, setStockInput] = useState("0");
  const [retailInput, setRetailInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [manualCostInput, setManualCostInput] = useState("");
  const [purchaseTier, setPurchaseTier] = useState<"Wholesale" | "Retail">(
    "Wholesale",
  );

  const numericSupplierId = Number.parseInt(supplierId, 10);

  const catalogForSupplier = useMemo(
    () =>
      props.catalogItems.filter((c) => c.supplierId === numericSupplierId),
    [props.catalogItems, numericSupplierId],
  );

  const selectedCatalog = useMemo(
    () => catalogForSupplier.find((c) => String(c.id) === catalogItemId),
    [catalogForSupplier, catalogItemId],
  );

  const previewItem = selectedCatalog
    ? displayCatalogItem(selectedCatalog.brand, selectedCatalog.itemName)
    : "";
  const previewFlavor = selectedCatalog
    ? displayCatalogFlavor(selectedCatalog.variant, selectedCatalog.itemName)
    : "";

  const costPerUnitCents = selectedCatalog
    ? purchaseTier === "Retail"
      ? (selectedCatalog.retailPrice ?? selectedCatalog.unitCost ?? 0)
      : (selectedCatalog.unitCost ?? 0)
    : parseMoneyInput(manualCostInput);

  const stockQuantity = Number.parseInt(stockInput, 10);
  const safeStock = Number.isFinite(stockQuantity) && stockQuantity > 0
    ? stockQuantity
    : 0;

  const totalPurchaseCents = costPerUnitCents * safeStock;

  function handleCatalogChange(id: string) {
    setCatalogItemId(id);
    const catalog = catalogForSupplier.find((c) => String(c.id) === id);
    if (catalog) {
      setRetailInput(centsToInput(catalog.retailPrice));
      setBulkInput("");
    } else {
      setRetailInput("");
      setBulkInput("");
      setManualCostInput("");
    }
  }

  return (
    <form action={formAction} className="space-y-3">
      <label className="block space-y-0.5">
        <span className="text-[11px] text-zinc-400">Supplier *</span>
        <select
          name="supplierId"
          required
          value={supplierId}
          onChange={(e) => {
            setSupplierId(e.target.value);
            setCatalogItemId("");
            setRetailInput("");
            setBulkInput("");
            setManualCostInput("");
          }}
          className={fieldClass}
        >
          {props.suppliers.length === 0 ? (
            <option value="">Add a supplier first</option>
          ) : (
            props.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.itemCount != null ? ` (${s.itemCount})` : ""}
              </option>
            ))
          )}
        </select>
      </label>

      <label className="block space-y-0.5">
        <span className="text-[11px] text-zinc-400">
          Catalog item ({catalogForSupplier.length} for this supplier)
        </span>
        <select
          name="supplierCatalogItemId"
          value={catalogItemId}
          onChange={(e) => handleCatalogChange(e.target.value)}
          className={fieldClass}
        >
          <option value="">Manual entry</option>
          {catalogForSupplier.map((c) => (
            <option key={c.id} value={c.id}>
              {displayCatalogItem(c.brand, c.itemName)} —{" "}
              {displayCatalogFlavor(c.variant, c.itemName)}
            </option>
          ))}
        </select>
      </label>

      {selectedCatalog ? (
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-[11px] text-zinc-400">
          <span className="text-zinc-200">{previewItem}</span> · {previewFlavor}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 space-y-0.5">
            <span className="text-[11px] text-zinc-400">Item *</span>
            <input name="name" required className={fieldClass} placeholder="Whiskas" />
          </label>
          <label className="space-y-0.5">
            <span className="text-[11px] text-zinc-400">Brand *</span>
            <input name="brand" required className={fieldClass} />
          </label>
          <label className="space-y-0.5">
            <span className="text-[11px] text-zinc-400">Flavor</span>
            <input name="variant" className={fieldClass} placeholder="Tuna" />
          </label>
        </div>
      )}

      {selectedCatalog ? (
        <>
          <input type="hidden" name="name" value={previewItem} />
          <input
            type="hidden"
            name="brand"
            value={selectedCatalog.brand ?? previewItem}
          />
          <input
            type="hidden"
            name="variant"
            value={previewFlavor === "—" ? "" : previewFlavor}
          />
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
        <div className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Supplier · Your prices
        </div>
        <label className="space-y-0.5">
          <span className="text-[10px] text-zinc-500">Sup. retail</span>
          <input
            name="supplierRetailPrice"
            key={`sr-${catalogItemId}`}
            defaultValue={centsToInput(selectedCatalog?.retailPrice)}
            inputMode="decimal"
            className={fieldClass}
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-zinc-500">Sup. wholesale</span>
          <input
            name="supplierBulkPrice"
            key={`sb-${catalogItemId}`}
            defaultValue={centsToInput(selectedCatalog?.unitCost)}
            inputMode="decimal"
            className={fieldClass}
          />
        </label>

        {selectedCatalog ? (
          <>
            <label className="col-span-2 space-y-0.5">
              <span className="text-[10px] text-zinc-500">How I bought this *</span>
              <select
                name="purchaseTier"
                value={purchaseTier}
                onChange={(e) =>
                  setPurchaseTier(e.target.value as "Wholesale" | "Retail")
                }
                className={fieldClass}
              >
                <option value="Wholesale">Wholesale (supplier bulk price)</option>
                <option value="Retail">Retail (supplier retail price)</option>
              </select>
            </label>
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500">My cost (per unit)</span>
              <div className={readOnlyClass}>
                {costPerUnitCents > 0
                  ? formatPhpFromCents(costPerUnitCents)
                  : "—"}
              </div>
              <input
                type="hidden"
                name="costPrice"
                value={centsToInput(costPerUnitCents)}
              />
            </div>
          </>
        ) : (
          <>
            <label className="space-y-0.5">
              <span className="text-[10px] text-zinc-500">How I bought this *</span>
              <select name="purchaseTier" defaultValue="Wholesale" className={fieldClass}>
                <option value="Wholesale">Wholesale</option>
                <option value="Retail">Retail</option>
              </select>
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-zinc-500">My cost (per unit) *</span>
              <input
                name="costPrice"
                value={manualCostInput}
                onChange={(e) => setManualCostInput(e.target.value)}
                inputMode="decimal"
                required
                className={fieldClass}
              />
            </label>
          </>
        )}

        <label className="space-y-0.5">
          <span className="text-[10px] text-zinc-500">Stock</span>
          <input
            name="stockQuantity"
            inputMode="numeric"
            value={stockInput}
            onChange={(e) => setStockInput(e.target.value)}
            className={fieldClass}
          />
        </label>

        <div className="col-span-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-amber-200/80">
            Total purchase cost
          </div>
          <div className="mt-0.5 text-sm font-semibold text-amber-100">
            {costPerUnitCents > 0 && safeStock > 0
              ? formatPhpFromCents(totalPurchaseCents)
              : "—"}
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-500">
            {costPerUnitCents > 0 && safeStock > 0
              ? `${formatPhpFromCents(costPerUnitCents)} × ${safeStock} pcs`
              : "Set stock to see total cost"}
          </div>
        </div>

        <label className="space-y-0.5">
          <span className="text-[10px] text-zinc-500">My retail</span>
          <input
            name="retailPrice"
            value={retailInput}
            onChange={(e) => setRetailInput(e.target.value)}
            inputMode="decimal"
            className={fieldClass}
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-zinc-500">My bulk</span>
          <input
            name="bulkPrice"
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            inputMode="decimal"
            className={fieldClass}
          />
        </label>
      </div>

      {state?.error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">
          {state.error}
        </div>
      ) : null}

      {state?.ok ? (
        <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2.5">
          <div className="text-[11px] font-medium text-emerald-200">
            Added {state.itemLabel} to inventory
          </div>
          <div className="space-y-1.5 border-t border-emerald-500/20 pt-2">
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Total purchase</span>
              <span className="text-zinc-200">
                {formatPhpFromCents(state.totalPurchaseCents ?? 0)}
              </span>
            </div>
            <ProfitLine
              label="Retail profit"
              perUnit={state.retailProfitPerUnitCents ?? 0}
              total={state.totalRetailProfitCents ?? null}
              stock={state.stockQuantity ?? 0}
            />
            {state.bulkProfitPerUnitCents != null ? (
              <ProfitLine
                label="Bulk profit"
                perUnit={state.bulkProfitPerUnitCents}
                total={state.totalBulkProfitCents ?? null}
                stock={state.stockQuantity ?? 0}
              />
            ) : (
              <div className="text-[10px] text-zinc-500">
                Set My bulk to see wholesale profit.
              </div>
            )}
          </div>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={props.suppliers.length === 0 || pending}
        className="w-full rounded-lg bg-zinc-50 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add to inventory"}
      </button>
    </form>
  );
}
