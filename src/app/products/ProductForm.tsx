"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import {
  createProduct,
  type CreateProductResult,
} from "@/app/products/actions";
import { CatalogItemSelect } from "@/components/CatalogItemSelect";
import { ItemTypeBadge } from "@/components/ItemTypeBadge";
import { ItemTypePicker } from "@/components/ItemTypePicker";
import {
  displayCatalogBrand,
  displayCatalogFlavor,
  displayCatalogProductName,
} from "@/lib/catalog-item-display";
import { formatPhpFromCents } from "@/lib/money";
import {
  CATALOG_ITEM_TYPES,
  normalizeCatalogItemType,
  isCatLitterItemType,
} from "@/lib/catalog-item-types";
import {
  formatSupplierPrice,
  isPieceProduct,
  isWeightProduct,
  priceUnitLabel,
  stockPieceLabel,
} from "@/lib/price-units";

export type CatalogPickOption = {
  id: number;
  supplierId: number;
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
  itemType?: string | null;
};

export type SupplierOption = {
  id: number;
  name: string;
  itemCount?: number;
};

const fieldClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20";

function centsToInput(cents: number | null | undefined) {
  if (cents == null) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function parseMoneyInput(value: string) {
  const n = Number(value.trim());
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function inferKgPerSackFromCatalog(catalog: CatalogPickOption | undefined) {
  if (!catalog?.packSize) return "";
  const unit = catalog.packUnit?.toLowerCase() ?? "kg";
  if (unit !== "kg" && unit !== "") return "";
  const n = Number(catalog.packSize);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(n);
}

function ProfitLine(props: {
  label: string;
  perUnit: number;
  total: number | null;
  stock: number;
  unitLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 text-[11px]">
      <span className="text-zinc-400">{props.label}</span>
      <div className="text-right">
        <div className="font-medium text-brand-cyan">
          {formatPhpFromCents(props.perUnit)} / {props.unitLabel}
        </div>
        {props.stock > 0 && props.total != null ? (
          <div className="text-zinc-500">
            {formatPhpFromCents(props.total)} total ({props.stock} {props.unitLabel})
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProductForm(props: {
  suppliers: SupplierOption[];
  catalogItems: CatalogPickOption[];
  onSuccess?: () => void;
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
  const [trackInKg, setTrackInKg] = useState(false);
  const [kgPerSackInput, setKgPerSackInput] = useState("");
  const [stockEntryMode, setStockEntryMode] = useState<
    "sacks" | "kg" | "cases" | "pcs"
  >("sacks");
  const [unitsPerCaseInput, setUnitsPerCaseInput] = useState("24");
  const [manualItemType, setManualItemType] = useState<string>(
    CATALOG_ITEM_TYPES[0]!.value,
  );

  useEffect(() => {
    if (state?.ok) props.onSuccess?.();
  }, [state?.ok, props]);

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
    ? displayCatalogProductName(selectedCatalog)
    : "";
  const previewBrand = selectedCatalog
    ? displayCatalogBrand(selectedCatalog.brand)
    : "—";
  const previewFlavor = selectedCatalog
    ? displayCatalogFlavor(selectedCatalog.variant, selectedCatalog.itemName)
    : "";

  const kgPerSackTenths = useMemo(() => {
    const n = Number(kgPerSackInput.trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 10);
  }, [kgPerSackInput]);

  const isLitter = selectedCatalog
    ? isCatLitterItemType(selectedCatalog.itemType)
    : isCatLitterItemType(manualItemType);

  const isWeight = selectedCatalog
    ? isWeightProduct({
        priceUnit: selectedCatalog.priceUnit,
        packUnit: selectedCatalog.packUnit,
        itemType: selectedCatalog.itemType,
      })
    : trackInKg && !isLitter;

  const isPiece = selectedCatalog
    ? isPieceProduct({
        priceUnit: selectedCatalog.priceUnit,
        packUnit: selectedCatalog.packUnit,
        itemType: selectedCatalog.itemType,
      })
    : !trackInKg || isLitter;

  const unitsPerCase = Number(unitsPerCaseInput) || 24;

  const costPerUnitCents = useMemo(() => {
    if (!selectedCatalog) return parseMoneyInput(manualCostInput);
    const ws = selectedCatalog.unitCost ?? 0;
    const supRetail = selectedCatalog.retailPrice ?? ws;
    const base = purchaseTier === "Retail" ? supRetail : ws;

    if (isWeight && trackInKg && selectedCatalog.perKiloPrice != null && selectedCatalog.perKiloPrice > 0) {
      return selectedCatalog.perKiloPrice;
    }
    if (isPiece && selectedCatalog.priceUnit === "Case" && unitsPerCase > 0) {
      return Math.round(base / unitsPerCase);
    }
    if (isWeight && trackInKg && kgPerSackTenths && kgPerSackTenths > 0) {
      return Math.round(base / (kgPerSackTenths / 10));
    }
    return base;
  }, [
    selectedCatalog,
    manualCostInput,
    purchaseTier,
    trackInKg,
    isWeight,
    isPiece,
    kgPerSackTenths,
    unitsPerCase,
  ]);

  const stockQtyNum = Number(stockInput);
  const safeStock = useMemo(() => {
    if (!Number.isFinite(stockQtyNum) || stockQtyNum <= 0) return 0;
    if (isWeight && trackInKg) {
      if (stockEntryMode === "sacks" && kgPerSackTenths) {
        return (stockQtyNum * kgPerSackTenths) / 10;
      }
      return stockQtyNum;
    }
    if (isPiece && stockEntryMode === "cases") {
      return stockQtyNum * unitsPerCase;
    }
    return stockQtyNum;
  }, [
    stockQtyNum,
    isWeight,
    isPiece,
    trackInKg,
    stockEntryMode,
    kgPerSackTenths,
    unitsPerCase,
  ]);

  const stockUnitLabel =
    isLitter ? "sacks" : isWeight && trackInKg ? "kg" : stockPieceLabel(manualItemType) + "s";
  const perUnitRetailLabel = isLitter
    ? "Our retail (per sack)"
    : isWeight && trackInKg
      ? "Our retail (per kg)"
      : "Our retail (per pc)";
  const perUnitBulkLabel = isLitter
    ? "Our wholesale (per sack)"
    : isWeight && trackInKg
      ? "Our wholesale (per kg)"
      : "Our wholesale (per pc)";
  const retailProfitPerUnit = Math.max(0, parseMoneyInput(retailInput) - costPerUnitCents);
  const bulkProfitPerUnit =
    bulkInput.trim().length > 0
      ? Math.max(0, parseMoneyInput(bulkInput) - costPerUnitCents)
      : null;

  function handleCatalogChange(id: string) {
    setCatalogItemId(id);
    const catalog = catalogForSupplier.find((c) => String(c.id) === id);
    if (catalog) {
      const piece = isPieceProduct({
        priceUnit: catalog.priceUnit,
        packUnit: catalog.packUnit,
        itemType: catalog.itemType,
      });
      const weight = isWeightProduct({
        priceUnit: catalog.priceUnit,
        packUnit: catalog.packUnit,
        itemType: catalog.itemType,
      });

      if (piece) {
        setTrackInKg(false);
        setStockEntryMode(
          isCatLitterItemType(catalog.itemType)
            ? "pcs"
            : catalog.priceUnit === "Case"
              ? "cases"
              : "pcs",
        );
        setUnitsPerCaseInput(String(catalog.unitsPerCase ?? 24));
        setRetailInput("");
        setBulkInput("");
      } else if (weight) {
        const inferredKg = inferKgPerSackFromCatalog(catalog);
        if (inferredKg) {
          setKgPerSackInput(inferredKg);
          setTrackInKg(true);
          setStockEntryMode("sacks");
        }
        if (catalog.perKiloPrice != null) {
          setRetailInput(centsToInput(catalog.perKiloPrice));
        } else {
          setRetailInput("");
        }
        setBulkInput("");
      }
    } else {
      setRetailInput("");
      setBulkInput("");
      setManualCostInput("");
      setKgPerSackInput("");
      setTrackInKg(false);
      setStockEntryMode("pcs");
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
            setKgPerSackInput("");
            setTrackInKg(false);
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

      <label className="block space-y-1">
        <span className="text-[11px] text-zinc-400">
          Catalog item ({catalogForSupplier.length} for this supplier)
        </span>
        <CatalogItemSelect
          name="supplierCatalogItemId"
          items={catalogForSupplier}
          value={catalogItemId}
          onChange={handleCatalogChange}
        />
      </label>

      {selectedCatalog ? (
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-[11px] text-zinc-400">
          <span className="text-zinc-200">{previewItem}</span>
          {previewBrand !== "—" ? (
            <>
              {" "}
              · <span className="text-zinc-300">{previewBrand}</span>
            </>
          ) : null}
          {previewFlavor !== "—" ? <> · {previewFlavor}</> : null}
          {selectedCatalog.perKiloPrice != null ? (
            <div className="mt-1 text-[10px] text-zinc-500">
              Supplier per kg: {formatPhpFromCents(selectedCatalog.perKiloPrice)}
            </div>
          ) : null}
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
          <ItemTypePicker
            name="itemType"
            label="Item type *"
            value={manualItemType}
            onChange={(next) => {
              setManualItemType(next);
              if (isCatLitterItemType(next)) setTrackInKg(false);
            }}
            compact
          />
        </div>
      )}

      {selectedCatalog ? (
        <>
          <input type="hidden" name="name" value={selectedCatalog.itemName} />
          <input
            type="hidden"
            name="brand"
            value={selectedCatalog.brand ?? ""}
          />
          <input
            type="hidden"
            name="variant"
            value={selectedCatalog.variant ?? ""}
          />
        </>
      ) : null}

      {selectedCatalog ? (
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-[11px]">
          <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            From supplier pricelist
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ItemTypeBadge itemType={selectedCatalog.itemType} />
            <span className="text-zinc-300">{previewItem}</span>
          </div>
          <input
            type="hidden"
            name="itemType"
            value={normalizeCatalogItemType(selectedCatalog.itemType)}
          />
          <div className="mt-1.5 grid grid-cols-2 gap-2 text-zinc-300">
            <div>
              <span className="text-zinc-500">WS </span>
              {formatSupplierPrice(
                selectedCatalog.unitCost,
                selectedCatalog.priceUnit,
              )}
            </div>
            <div>
              <span className="text-zinc-500">Retail </span>
              {formatSupplierPrice(
                selectedCatalog.retailPrice,
                selectedCatalog.priceUnit,
              )}
            </div>
            {selectedCatalog.perKiloPrice != null ? (
              <div className="col-span-2 text-[10px] text-zinc-500">
                Per kg WS: {formatPhpFromCents(selectedCatalog.perKiloPrice)}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
        <div className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Your shop prices &amp; stock
        </div>

        {selectedCatalog ? (
          <label className="col-span-2 space-y-0.5">
            <span className="text-[10px] text-zinc-500">Bought as *</span>
            <select
              name="purchaseTier"
              value={purchaseTier}
              onChange={(e) =>
                setPurchaseTier(e.target.value as "Wholesale" | "Retail")
              }
              className={fieldClass}
            >
              <option value="Wholesale">
                Wholesale ({priceUnitLabel(selectedCatalog.priceUnit ?? "Sack")})
              </option>
              <option value="Retail">
                Retail ({priceUnitLabel(selectedCatalog.priceUnit ?? "Sack")})
              </option>
            </select>
          </label>
        ) : (
          <>
            <label className="space-y-0.5">
              <span className="text-[10px] text-zinc-500">Bought as *</span>
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

        {isWeight && selectedCatalog ? (
          <>
            <input type="hidden" name="trackInKg" value="on" />
            <label className="space-y-0.5">
              <span className="text-[10px] text-zinc-500">Kg per sack *</span>
              <input
                name="kgPerSack"
                value={kgPerSackInput}
                onChange={(e) => setKgPerSackInput(e.target.value)}
                inputMode="decimal"
                step="0.1"
                required
                placeholder="7"
                className={fieldClass}
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-zinc-500">Add stock as</span>
              <select
                name="stockEntryMode"
                value={stockEntryMode}
                onChange={(e) =>
                  setStockEntryMode(e.target.value as "sacks" | "kg")
                }
                className={fieldClass}
              >
                <option value="sacks">Sacks</option>
                <option value="kg">Kilograms</option>
              </select>
            </label>
          </>
        ) : isLitter && selectedCatalog ? (
          <>
            <input type="hidden" name="trackInKg" value="off" />
            <input type="hidden" name="stockEntryMode" value="pcs" />
          </>
        ) : isPiece && selectedCatalog ? (
          <>
            <input type="hidden" name="trackInKg" value="off" />
            <label className="space-y-0.5">
              <span className="text-[10px] text-zinc-500">Cans per case</span>
              <input
                name="unitsPerCase"
                value={unitsPerCaseInput}
                onChange={(e) => setUnitsPerCaseInput(e.target.value)}
                type="number"
                min={1}
                className={fieldClass}
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-zinc-500">Add stock as</span>
              <select
                name="stockEntryMode"
                value={stockEntryMode}
                onChange={(e) =>
                  setStockEntryMode(e.target.value as "cases" | "pcs")
                }
                className={fieldClass}
              >
                <option value="cases">Cases</option>
                <option value="pcs">Pieces</option>
              </select>
            </label>
          </>
        ) : (
          <label className="col-span-2 flex items-center gap-2 text-[11px] text-zinc-300">
            <input
              type="checkbox"
              name="trackInKg"
              checked={trackInKg}
              onChange={(e) => setTrackInKg(e.target.checked)}
              className="rounded border-white/20"
            />
            Track stock by kilogram (sacks convert to kg)
          </label>
        )}

        <label className="space-y-0.5">
          <span className="text-[10px] text-zinc-500">
            {isLitter
              ? "Stock (sacks)"
              : isWeight && trackInKg
                ? stockEntryMode === "sacks"
                  ? "Stock (sacks)"
                  : "Stock (kg)"
                : isPiece
                  ? stockEntryMode === "cases"
                    ? "Stock (cases)"
                    : `Stock (${stockPieceLabel(manualItemType)}s)`
                  : "Stock"}
          </span>
          <input
            name="stockQuantity"
            inputMode="decimal"
            step={isWeight && trackInKg ? "0.1" : "1"}
            value={stockInput}
            onChange={(e) => setStockInput(e.target.value)}
            className={fieldClass}
          />
          {safeStock > 0 ? (
            <span className="text-[10px] text-zinc-600">
              ≈ {safeStock % 1 === 0 ? safeStock.toFixed(0) : safeStock.toFixed(1)}{" "}
              {stockUnitLabel} on hand
            </span>
          ) : null}
        </label>

        <label className="space-y-0.5">
          <span className="text-[10px] text-zinc-500">{perUnitRetailLabel}</span>
          <input
            name="retailPrice"
            value={retailInput}
            onChange={(e) => setRetailInput(e.target.value)}
            inputMode="decimal"
            className={fieldClass}
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-zinc-500">{perUnitBulkLabel}</span>
          <input
            name="bulkPrice"
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            inputMode="decimal"
            className={fieldClass}
          />
        </label>

        {costPerUnitCents > 0 && parseMoneyInput(retailInput) > 0 ? (
          <div className="col-span-2 space-y-1 rounded-md border border-brand-blue/20 bg-brand-blue/5 px-2.5 py-2">
            <ProfitLine
              label="Retail profit"
              perUnit={retailProfitPerUnit}
              total={
                safeStock > 0
                  ? Math.round(retailProfitPerUnit * safeStock)
                  : null
              }
              stock={safeStock}
              unitLabel={stockUnitLabel}
            />
            {bulkProfitPerUnit != null ? (
              <ProfitLine
                label="Wholesale profit"
                perUnit={bulkProfitPerUnit}
                total={
                  safeStock > 0
                    ? Math.round(bulkProfitPerUnit * safeStock)
                    : null
                }
                stock={safeStock}
                unitLabel={stockUnitLabel}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {state?.error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">
          {state.error}
        </div>
      ) : null}

      {state?.ok ? (
        <div className="space-y-2 rounded-lg border border-brand-cyan/30 bg-brand-blue/10 px-2.5 py-2.5">
          <div className="text-[11px] font-medium text-brand-cyan/70">
            Added {state.itemLabel} to inventory
          </div>
          <div className="space-y-1.5 border-t border-brand-blue/20 pt-2">
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
              unitLabel={
                state.stockUnit === "Kilogram" ? "kg" : "pcs"
              }
            />
            {state.bulkProfitPerUnitCents != null ? (
              <ProfitLine
                label="Bulk profit"
                perUnit={state.bulkProfitPerUnitCents}
                total={state.totalBulkProfitCents ?? null}
                stock={state.stockQuantity ?? 0}
                unitLabel={
                  state.stockUnit === "Kilogram" ? "kg" : "pcs"
                }
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
