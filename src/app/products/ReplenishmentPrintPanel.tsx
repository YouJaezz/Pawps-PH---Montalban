"use client";

import { useMemo, useState } from "react";

import type { InventoryBranchOption, InventorySupplierOption, InventoryTableRow } from "@/app/products/InventoryTable";
import {
  buildReplenishmentLines,
  replenishmentStatusLabel,
} from "@/lib/inventory-replenishment";
import { phNow } from "@/lib/ph-time";

const THRESHOLD_PRESETS = [0, 1, 2, 3, 5, 10, 20];

export function ReplenishmentPrintPanel(props: {
  rows: InventoryTableRow[];
  branches: InventoryBranchOption[];
  suppliers: InventorySupplierOption[];
}) {
  const [open, setOpen] = useState(false);
  const [maxThreshold, setMaxThreshold] = useState(1);
  const [customThreshold, setCustomThreshold] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [includeOutOfStock, setIncludeOutOfStock] = useState(true);

  const effectiveThreshold = useMemo(() => {
    const custom = Number(customThreshold.trim());
    if (customThreshold.trim() && Number.isFinite(custom) && custom >= 0) {
      return custom;
    }
    return maxThreshold;
  }, [customThreshold, maxThreshold]);

  const branchId =
    branchFilter === "all" ? ("all" as const) : Number.parseInt(branchFilter, 10);
  const supplierId =
    supplierFilter === "all"
      ? ("all" as const)
      : Number.parseInt(supplierFilter, 10);

  const lines = useMemo(
    () =>
      buildReplenishmentLines(props.rows, {
        maxThreshold: effectiveThreshold,
        branchId,
        supplierId,
        includeOutOfStock,
        branches: props.branches,
      }),
    [
      props.rows,
      effectiveThreshold,
      branchId,
      supplierId,
      includeOutOfStock,
      props.branches,
    ],
  );

  const outCount = lines.filter((l) => l.status === "out").length;
  const lowCount = lines.filter((l) => l.status === "low").length;
  const branchLabel =
    branchId === "all"
      ? "All branches (shop total)"
      : (props.branches.find((b) => b.id === branchId)?.name ?? "Branch");
  const today = phNow();
  const dateLabel = `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;

  function handlePrint() {
    document.body.classList.add("printing-replenishment");
    const cleanup = () => {
      document.body.classList.remove("printing-replenishment");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-amber-100">
            Replenishment print list
          </h3>
          <p className="mt-1 max-w-2xl text-[11px] text-amber-200/70">
            Set your minimum stock level. Items at or below that number print
            here — e.g. threshold{" "}
            <span className="font-medium text-amber-100">1</span> includes out
            of stock and anything with 1 pc, 1 kg, or 1 sack left (per product
            unit).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/15"
        >
          {open ? "Hide" : "Show"} replenishment tool
        </button>
      </div>

      {open ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-[10px] text-amber-200/80">
              Reorder when at or below
              <div className="mt-1 flex flex-wrap gap-1">
                {THRESHOLD_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setMaxThreshold(n);
                      setCustomThreshold("");
                    }}
                    className={`rounded border px-2 py-1 text-[10px] ${
                      effectiveThreshold === n && !customThreshold.trim()
                        ? "border-amber-400/50 bg-amber-500/20 text-amber-50"
                        : "border-white/10 bg-black/20 text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                step="any"
                value={customThreshold}
                onChange={(e) => setCustomThreshold(e.target.value)}
                placeholder={`Custom (using ${effectiveThreshold})`}
                className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-100"
              />
              <div className="mt-1 text-[9px] text-zinc-500">
                Compared in each item&apos;s unit (pcs, kg, sacks, packs)
              </div>
            </label>

            <label className="block text-[10px] text-amber-200/80">
              Branch
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="app-select mt-1 w-full rounded-md border border-white/10 px-2 py-1.5 text-xs outline-none"
              >
                <option value="all">All branches (total stock)</option>
                {props.branches.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[10px] text-amber-200/80">
              Supplier
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="app-select mt-1 w-full rounded-md border border-white/10 px-2 py-1.5 text-xs outline-none"
              >
                <option value="all">All suppliers</option>
                {props.suppliers.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-[11px] text-zinc-300">
                <input
                  type="checkbox"
                  checked={includeOutOfStock}
                  onChange={(e) => setIncludeOutOfStock(e.target.checked)}
                  className="rounded border-white/20"
                />
                Include out of stock (0)
              </label>
              <button
                type="button"
                onClick={handlePrint}
                disabled={lines.length === 0}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Print list ({lines.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:max-w-md">
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
              <div className="text-[10px] text-zinc-500">To reorder</div>
              <div className="text-lg font-semibold text-amber-100">
                {lines.length}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
              <div className="text-[10px] text-zinc-500">Out of stock</div>
              <div className="text-lg font-semibold text-red-300">{outCount}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
              <div className="text-[10px] text-zinc-500">Low stock</div>
              <div className="text-lg font-semibold text-amber-200">
                {lowCount}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[640px] text-[11px]">
              <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Brand</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-zinc-500">
                      Nothing at or below {effectiveThreshold} for these filters.
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => (
                    <tr key={line.productId} className="border-t border-white/5">
                      <td className="px-3 py-2 font-medium text-zinc-100">
                        {line.item}
                        <div className="text-[9px] font-normal text-zinc-500">
                          {line.flavor !== "—" ? line.flavor : line.itemTypeLabel}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{line.brand}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-zinc-100">
                          {line.stockDisplay}
                        </div>
                        <div className="text-[9px] text-zinc-500">
                          {line.stockDetail}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            line.status === "out"
                              ? "text-red-300"
                              : "text-amber-200"
                          }
                        >
                          {replenishmentStatusLabel(line.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        {line.supplierName}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="replenishment-print-sheet hidden">
        <div className="mb-4 border-b border-zinc-300 pb-3">
          <h1 className="text-lg font-bold text-black">
            Replenishment list — The PAWps PH
          </h1>
          <p className="mt-1 text-[10pt] text-zinc-700">
            {dateLabel} · {branchLabel} · at or below{" "}
            <strong>{effectiveThreshold}</strong> (per item unit: pcs / kg /
            sacks)
          </p>
          <p className="mt-1 text-[9pt] text-zinc-600">
            {lines.length} item(s) · {outCount} out of stock · {lowCount} low
          </p>
        </div>
        <table className="w-full border-collapse text-[9pt] text-black">
          <thead>
            <tr className="border-b border-zinc-400 text-left">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Item</th>
              <th className="py-1 pr-2">Brand</th>
              <th className="py-1 pr-2">Flavor / type</th>
              <th className="py-1 pr-2">On hand</th>
              <th className="py-1 pr-2">Status</th>
              <th className="py-1 pr-2">Supplier</th>
              <th className="py-1">Branches</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={line.productId} className="border-b border-zinc-200">
                <td className="py-1.5 pr-2 align-top text-zinc-600">{i + 1}</td>
                <td className="py-1.5 pr-2 align-top font-medium">{line.item}</td>
                <td className="py-1.5 pr-2 align-top">{line.brand}</td>
                <td className="py-1.5 pr-2 align-top text-zinc-700">
                  {line.flavor !== "—" ? line.flavor : line.itemTypeLabel}
                </td>
                <td className="py-1.5 pr-2 align-top">
                  <div>{line.stockDisplay}</div>
                  <div className="text-[8pt] text-zinc-600">{line.stockDetail}</div>
                </td>
                <td className="py-1.5 pr-2 align-top">
                  {replenishmentStatusLabel(line.status)}
                </td>
                <td className="py-1.5 pr-2 align-top">{line.supplierName}</td>
                <td className="py-1.5 align-top text-[8pt] text-zinc-700">
                  {line.branchLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-[8pt] text-zinc-500">
          Check off items as you restock. Threshold compares each product in its
          own unit (pcs, kg, sacks, or packs).
        </p>
      </div>
    </div>
  );
}
