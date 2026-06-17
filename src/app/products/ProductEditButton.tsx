"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { updateProduct, transferBranchStock } from "@/app/products/actions";
import { ItemTypePicker } from "@/components/ItemTypePicker";
import { STOCK_UNITS, type StockUnit } from "@/db/schema";
import { CATALOG_ITEM_TYPES, isCatLitterItemType } from "@/lib/catalog-item-types";
import type { ProductBranchStock } from "@/lib/branch-stock";
import { displayKgPerSack } from "@/lib/order-line-math";
import { formatPhpFromCents } from "@/lib/money";
import { displayStockQuantity } from "@/lib/product-stock";

export type ProductEditRow = {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
  itemType: string | null;
  packSize: string | null;
  stockUnit: StockUnit;
  stockQuantity: number;
  kgPerSack: number | null;
  unitsPerCase: number | null;
  retailPrice: number;
  bulkPrice: number;
  branchStock: ProductBranchStock[];
};

type EditTab = "details" | "transfer";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-zinc-50 outline-none focus:border-white/20";

const readOnlyStockClass =
  "w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-sm text-zinc-200";

function centsToInput(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function branchStockTotal(rows: ProductBranchStock[]) {
  return rows.reduce((sum, row) => sum + row.stockQuantity, 0);
}

function stockInputDisplay(
  storedQty: number,
  stockQtyUnit: StockUnit,
  stockEntryMode: "sacks" | "kg" | "cases" | "pcs",
  kgPerSackTenths: number | null,
  unitsPerCase: number | null,
) {
  if (storedQty <= 0) return "0";
  if (
    stockQtyUnit === "Kilogram" &&
    stockEntryMode === "sacks" &&
    kgPerSackTenths != null &&
    kgPerSackTenths > 0
  ) {
    const sacks = storedQty / kgPerSackTenths;
    return sacks % 1 === 0 ? String(sacks) : sacks.toFixed(1);
  }
  if (stockEntryMode === "cases" && unitsPerCase != null && unitsPerCase > 0) {
    const cases = storedQty / unitsPerCase;
    return cases % 1 === 0 ? String(cases) : cases.toFixed(1);
  }
  const display = displayStockQuantity(stockQtyUnit, storedQty);
  return display % 1 === 0 ? String(display) : display.toFixed(1);
}

function branchStockInputsFromRows(
  rows: ProductBranchStock[],
  stockQtyUnit: StockUnit,
  stockEntryMode: "sacks" | "kg" | "cases" | "pcs",
  kgPerSackTenths: number | null,
  unitsPerCase: number | null,
) {
  const inputs: Record<number, string> = {};
  for (const branch of rows) {
    inputs[branch.branchId] = stockInputDisplay(
      branch.stockQuantity,
      stockQtyUnit,
      stockEntryMode,
      kgPerSackTenths,
      unitsPerCase,
    );
  }
  return inputs;
}

function parseKgPerSackTenths(raw: string) {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.round(n * 10));
}

export function ProductEditButton(props: { product: ProductEditRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<EditTab>("details");
  const [pending, startTransition] = useTransition();
  const [branchStock, setBranchStock] = useState<ProductBranchStock[]>(
    props.product.branchStock,
  );
  const [branchStockInputs, setBranchStockInputs] = useState<Record<number, string>>(
    {},
  );
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [stockUnit, setStockUnit] = useState<StockUnit>(props.product.stockUnit);
  const [stockEntryMode, setStockEntryMode] = useState<"sacks" | "kg" | "cases" | "pcs">(
    props.product.stockUnit === "Kilogram" ? "kg" : "pcs",
  );
  const [kgPerSackInput, setKgPerSackInput] = useState(
    props.product.kgPerSack != null
      ? String(displayKgPerSack(props.product.kgPerSack) ?? "")
      : "",
  );
  const [itemType, setItemType] = useState(
    props.product.itemType ?? CATALOG_ITEM_TYPES[0]!.value,
  );
  const [transferFrom, setTransferFrom] = useState(
    () => String(props.product.branchStock[0]?.branchId ?? ""),
  );
  const [transferTo, setTransferTo] = useState(
    () =>
      String(
        props.product.branchStock[1]?.branchId ??
          props.product.branchStock[0]?.branchId ??
          "",
      ),
  );
  const [transferQty, setTransferQty] = useState("");
  const [transferNote, setTransferNote] = useState("");

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

  const p = props.product;
  const isLitter = isCatLitterItemType(itemType);
  const isWeight =
    !isLitter &&
    (stockUnit === "Kilogram" || stockUnit === "Sack" || p.kgPerSack != null);
  const stockQtyUnit = stockUnit === "Sack" ? "Kilogram" : stockUnit;
  const totalStored = branchStockTotal(branchStock);
  const displayQty = displayStockQuantity(stockQtyUnit, totalStored);
  const stockUnitLabel = isLitter
    ? "sacks"
    : stockUnit === "Kilogram" || stockUnit === "Sack"
      ? stockEntryMode === "sacks"
        ? "sacks"
        : "kg"
      : stockEntryMode === "cases"
        ? "cases"
        : "pcs";
  const branchStockQtyLabel = isLitter
    ? "Quantity (sacks)"
    : isWeight
      ? stockEntryMode === "sacks"
        ? "Quantity (sacks)"
        : "Quantity (kg)"
      : stockEntryMode === "cases"
        ? "Quantity (cases)"
        : "Quantity (pcs)";
  const kgPerSackTenths =
    parseKgPerSackTenths(kgPerSackInput) ?? p.kgPerSack ?? null;
  const canTransfer = branchStock.length > 1;

  function refreshBranchStockInputs(
    rows: ProductBranchStock[],
    entryMode: typeof stockEntryMode,
    kgTenths: number | null,
  ) {
    setBranchStockInputs(
      branchStockInputsFromRows(
        rows,
        stockQtyUnit,
        entryMode,
        kgTenths,
        p.unitsPerCase,
      ),
    );
  }

  function openModal() {
    const nextItemType = props.product.itemType ?? CATALOG_ITEM_TYPES[0]!.value;
    const nextStockUnit = props.product.stockUnit;
    const nextKgPerSackInput =
      props.product.kgPerSack != null
        ? String(displayKgPerSack(props.product.kgPerSack) ?? "")
        : "";
    const nextKgTenths = props.product.kgPerSack ?? null;
    const nextEntryMode: "sacks" | "kg" | "cases" | "pcs" = isCatLitterItemType(
      nextItemType,
    )
      ? "pcs"
      : nextStockUnit === "Kilogram" || nextStockUnit === "Sack" || props.product.kgPerSack
        ? "sacks"
        : props.product.unitsPerCase && props.product.unitsPerCase > 1
          ? "cases"
          : "pcs";
    const nextStockQtyUnit =
      nextStockUnit === "Sack" ? "Kilogram" : nextStockUnit;

    setStockUnit(nextStockUnit);
    setKgPerSackInput(nextKgPerSackInput);
    setItemType(nextItemType);
    setStockEntryMode(nextEntryMode);
    setBranchStock(props.product.branchStock);
    setBranchStockInputs(
      branchStockInputsFromRows(
        props.product.branchStock,
        nextStockQtyUnit,
        nextEntryMode,
        nextKgTenths,
        props.product.unitsPerCase,
      ),
    );
    setTransferFrom(String(props.product.branchStock[0]?.branchId ?? ""));
    setTransferTo(
      String(
        props.product.branchStock[1]?.branchId ??
          props.product.branchStock[0]?.branchId ??
          "",
      ),
    );
    setTransferQty("");
    setTransferNote("");
    setTransferMessage(null);
    setTab("details");
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded border border-brand-blue/30 px-2 py-0.5 text-[10px] text-brand-blue hover:bg-brand-blue/10"
      >
        Edit
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-surface-elevated p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="edit-product-title"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-zinc-500">Inventory</div>
                <h2
                  id="edit-product-title"
                  className="text-lg font-semibold text-zinc-50"
                >
                  {p.name}
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

            <div className="mt-4 flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
              <button
                type="button"
                onClick={() => setTab("details")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  tab === "details"
                    ? "bg-white/10 text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => setTab("transfer")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  tab === "transfer"
                    ? "bg-white/10 text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Transfer
              </button>
            </div>

            {tab === "details" ? (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  startTransition(async () => {
                    try {
                      await updateProduct(fd);
                      setOpen(false);
                      router.refresh();
                    } catch (err) {
                      alert(err instanceof Error ? err.message : "Save failed.");
                    }
                  });
                }}
              >
                <input type="hidden" name="productId" value={p.id} />
                <input
                  type="hidden"
                  name="unitsPerCase"
                  value={p.unitsPerCase ?? 24}
                />

                <label className="block space-y-1">
                  <span className="text-xs text-zinc-400">Item name *</span>
                  <input
                    name="name"
                    required
                    defaultValue={p.name}
                    className={inputClass}
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-400">Brand *</span>
                    <input
                      name="brand"
                      required
                      defaultValue={p.brand}
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-400">Flavor</span>
                    <input
                      name="variant"
                      defaultValue={p.variant ?? ""}
                      placeholder="Chicken, beef…"
                      className={inputClass}
                    />
                  </label>
                </div>

                <ItemTypePicker
                  name="itemType"
                  label="Item type"
                  value={itemType}
                  onChange={setItemType}
                  compact
                />

                <label className="block space-y-1">
                  <span className="text-xs text-zinc-400">Pack size</span>
                  <input
                    name="packSize"
                    defaultValue={p.packSize ?? ""}
                    placeholder="20kg, 400g, 7kg"
                    className={inputClass}
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-400">Stock unit</span>
                    <select
                      name="stockUnit"
                      value={stockUnit}
                      onChange={(e) => setStockUnit(e.target.value as StockUnit)}
                      className={inputClass}
                    >
                      {STOCK_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-400">Total on hand</span>
                    <div className={readOnlyStockClass}>
                      {String(displayQty)} {stockUnitLabel}
                    </div>
                  </label>
                </div>

                {isWeight ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1">
                      <span className="text-xs text-zinc-400">Kg per sack</span>
                      <input
                        name="kgPerSack"
                        value={kgPerSackInput}
                        onChange={(e) => setKgPerSackInput(e.target.value)}
                        inputMode="decimal"
                        step="0.1"
                        className={inputClass}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-zinc-400">Stock entry</span>
                      <select
                        name="stockEntryMode"
                        value={stockEntryMode}
                        onChange={(e) => {
                          const mode = e.target.value as "sacks" | "kg";
                          setStockEntryMode(mode);
                          refreshBranchStockInputs(
                            branchStock,
                            mode,
                            parseKgPerSackTenths(kgPerSackInput) ?? p.kgPerSack,
                          );
                        }}
                        className={inputClass}
                      >
                        <option value="sacks">Sacks</option>
                        <option value="kg">Kilograms</option>
                      </select>
                    </label>
                  </div>
                ) : !isLitter &&
                  !isWeight &&
                  p.unitsPerCase != null &&
                  p.unitsPerCase > 1 ? (
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-400">Stock entry</span>
                    <select
                      name="stockEntryMode"
                      value={stockEntryMode}
                      onChange={(e) => {
                        const mode = e.target.value as "cases" | "pcs";
                        setStockEntryMode(mode);
                        refreshBranchStockInputs(branchStock, mode, null);
                      }}
                      className={inputClass}
                    >
                      <option value="cases">Cases</option>
                      <option value="pcs">Pieces</option>
                    </select>
                  </label>
                ) : (
                  <input type="hidden" name="stockEntryMode" value={stockEntryMode} />
                )}

                <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                  <div className="text-xs font-medium text-zinc-200">
                    Stock by branch
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Set {branchStockQtyLabel.toLowerCase()} at each location. Total
                    on hand: {String(displayQty)} {stockUnitLabel}.
                  </p>
                  {branchStock.length === 0 ? (
                    <p className="text-[10px] text-zinc-600">
                      No branches configured — add one under Branches.
                    </p>
                  ) : (
                    branchStock.map((branch) => (
                      <label key={branch.branchId} className="block space-y-1">
                        <span className="text-[11px] text-zinc-400">
                          {branch.branchName}
                          {branch.isDefault ? " (default)" : ""}
                        </span>
                        <input
                          name={`branchStock_${branch.branchId}`}
                          value={branchStockInputs[branch.branchId] ?? ""}
                          onChange={(e) =>
                            setBranchStockInputs((prev) => ({
                              ...prev,
                              [branch.branchId]: e.target.value,
                            }))
                          }
                          inputMode="decimal"
                          className={inputClass}
                          aria-label={`${branchStockQtyLabel} at ${branch.branchName}`}
                        />
                      </label>
                    ))
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-400">
                      {isWeight ? "Our retail (per kg)" : "Our retail (per pc)"}
                    </span>
                    <input
                      name="retailPrice"
                      required
                      defaultValue={centsToInput(p.retailPrice)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-400">
                      {isWeight ? "Our wholesale (per kg)" : "Our wholesale (per pc)"}
                    </span>
                    <input
                      name="bulkPrice"
                      defaultValue={centsToInput(p.bulkPrice)}
                      placeholder="Optional"
                      className={inputClass}
                    />
                  </label>
                </div>

                <p className="text-[10px] text-zinc-600">
                  Purchase cost and supplier link stay as-is — change those from
                  the supplier catalog if needed. Use the Transfer tab to move
                  stock between branches without changing the total.
                </p>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={pending}
                    className="flex-1 rounded-lg bg-zinc-50 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
                  >
                    {pending ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-medium text-zinc-200">
                    Stock by branch
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Total on hand: {String(displayQty)} {stockUnitLabel}
                  </p>
                  <div className="mt-2 space-y-2">
                    {branchStock.length === 0 ? (
                      <p className="text-[10px] text-zinc-600">
                        No branches yet — add one under Branches.
                      </p>
                    ) : (
                      branchStock.map((branch) => {
                        const branchDisplay = displayStockQuantity(
                          stockQtyUnit,
                          branch.stockQuantity,
                        );
                        return (
                          <div key={branch.branchId} className="space-y-1">
                            <span className="text-[11px] text-zinc-400">
                              {branch.branchName}
                              {branch.isDefault ? " (default)" : ""}
                            </span>
                            <div className={readOnlyStockClass}>
                              {String(branchDisplay)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {transferMessage ? (
                  <div className="rounded-lg border border-brand-cyan/30 bg-brand-blue/10 px-3 py-2 text-xs text-brand-cyan/90">
                    {transferMessage}
                  </div>
                ) : null}

                {canTransfer ? (
                  <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/5 p-3">
                    <div className="text-xs font-medium text-brand-cyan/90">
                      Move stock between branches
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block space-y-1">
                        <span className="text-[10px] text-zinc-500">From</span>
                        <select
                          value={transferFrom}
                          onChange={(e) => setTransferFrom(e.target.value)}
                          className={inputClass}
                        >
                          {branchStock.map((b) => (
                            <option key={b.branchId} value={b.branchId}>
                              {b.branchName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] text-zinc-500">To</span>
                        <select
                          value={transferTo}
                          onChange={(e) => setTransferTo(e.target.value)}
                          className={inputClass}
                        >
                          {branchStock.map((b) => (
                            <option key={b.branchId} value={b.branchId}>
                              {b.branchName}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="mt-2 block space-y-1">
                      <span className="text-[10px] text-zinc-500">Quantity</span>
                      <input
                        value={transferQty}
                        onChange={(e) => setTransferQty(e.target.value)}
                        placeholder={
                          isWeight ? "e.g. 1 sack or 2.5 kg" : "e.g. 12"
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="mt-2 block space-y-1">
                      <span className="text-[10px] text-zinc-500">Note (optional)</span>
                      <input
                        value={transferNote}
                        onChange={(e) => setTransferNote(e.target.value)}
                        placeholder="e.g. Moved home for neighbor sales"
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={pending || !transferQty.trim()}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("productId", String(p.id));
                        fd.set("fromBranchId", transferFrom);
                        fd.set("toBranchId", transferTo);
                        fd.set("transferQuantity", transferQty);
                        fd.set("stockUnit", stockUnit);
                        fd.set("stockEntryMode", stockEntryMode);
                        if (kgPerSackInput) fd.set("kgPerSack", kgPerSackInput);
                        if (transferNote.trim()) fd.set("note", transferNote);
                        startTransition(async () => {
                          try {
                            const updated = await transferBranchStock(fd);
                            setBranchStock(updated);
                            setBranchStockInputs(
                              branchStockInputsFromRows(
                                updated,
                                stockQtyUnit,
                                stockEntryMode,
                                kgPerSackTenths,
                                p.unitsPerCase,
                              ),
                            );
                            setTransferQty("");
                            setTransferNote("");
                            setTransferMessage("Stock transferred — quantities updated.");
                            router.refresh();
                          } catch (err) {
                            setTransferMessage(null);
                            alert(
                              err instanceof Error ? err.message : "Transfer failed.",
                            );
                          }
                        });
                      }}
                      className="mt-2 w-full rounded-lg border border-brand-cyan/30 px-3 py-2 text-xs text-brand-cyan/90 hover:bg-brand-blue/10 disabled:opacity-50"
                    >
                      {pending ? "Transferring…" : "Transfer stock"}
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500">
                    Add at least two active branches under Branches to move stock
                    between locations.
                  </p>
                )}
              </div>
            )}

            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-500">
              Current sell retail:{" "}
              <span className="text-zinc-200">
                {formatPhpFromCents(p.retailPrice)}
                {isWeight ? " / kg" : ""}
              </span>
              {p.bulkPrice > 0 ? (
                <>
                  {" "}
                  · bulk{" "}
                  <span className="text-zinc-200">
                    {formatPhpFromCents(p.bulkPrice)}
                    {isWeight ? " / kg" : ""}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
