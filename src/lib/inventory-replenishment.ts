import { isCatLitterItemType } from "@/lib/catalog-item-types";
import { displayStockQuantity, formatDualStock } from "@/lib/product-stock";
import type { StockUnit } from "@/db/schema";

export type ReplenishmentStatus = "out" | "low";

export type ReplenishmentEvalInput = {
  stockUnit: StockUnit;
  rawQuantity: number;
  itemType?: string | null;
  kgPerSack?: number | null;
  unitsPerCase?: number | null;
};

/** Human-facing quantity used for threshold checks (pcs, kg, sacks, packs). */
export function inventoryComparableQuantity(input: ReplenishmentEvalInput): number {
  const { stockUnit, rawQuantity, itemType } = input;
  if (stockUnit === "Kilogram" || stockUnit === "Sack") {
    return displayStockQuantity("Kilogram", rawQuantity);
  }
  return rawQuantity;
}

export function inventoryQuantityUnitLabel(
  stockUnit: StockUnit,
  itemType?: string | null,
): string {
  if (stockUnit === "Kilogram" || stockUnit === "Sack") return "kg";
  if (stockUnit === "Pack") return "packs";
  if (isCatLitterItemType(itemType)) return "sacks";
  return "pcs";
}

export function formatComparableQuantity(
  qty: number,
  stockUnit: StockUnit,
  itemType?: string | null,
): string {
  const unit = inventoryQuantityUnitLabel(stockUnit, itemType);
  const rounded =
    stockUnit === "Kilogram" || stockUnit === "Sack"
      ? qty % 1 === 0
        ? qty.toFixed(0)
        : qty.toFixed(1)
      : String(Math.round(qty));
  const word =
    unit === "pcs"
      ? qty === 1
        ? "pc"
        : "pcs"
      : qty === 1
        ? unit.replace(/s$/, "")
        : unit;
  return `${rounded} ${word}`;
}

export function replenishmentStatus(
  comparableQty: number,
  maxThreshold: number,
): ReplenishmentStatus | null {
  if (comparableQty <= 0) return "out";
  if (comparableQty <= maxThreshold) return "low";
  return null;
}

export function replenishmentStatusLabel(status: ReplenishmentStatus): string {
  return status === "out" ? "Out of stock" : "Low — reorder";
}

export type ReplenishmentLine = {
  productId: number;
  item: string;
  brand: string;
  flavor: string;
  itemTypeLabel: string;
  supplierName: string;
  stockDisplay: string;
  stockDetail: string;
  comparableQty: number;
  unitLabel: string;
  status: ReplenishmentStatus;
  branchLabel: string;
};

export type InventoryReplenishmentRow = {
  id: number;
  item: string;
  brand: string;
  flavor: string;
  itemTypeLabel: string;
  supplierName: string;
  supplierId: number | null;
  stockQuantity: number;
  branchQtyById: Record<number, number>;
  assignedBranchIds: number[];
  productEdit: {
    stockUnit: StockUnit;
    kgPerSack: number | null;
    unitsPerCase: number | null;
    itemType: string | null;
  };
};

export function buildReplenishmentLines(
  rows: InventoryReplenishmentRow[],
  opts: {
    maxThreshold: number;
    branchId: number | "all";
    supplierId: number | "all";
    includeOutOfStock: boolean;
    branches: Array<{ id: number; name: string }>;
  },
): ReplenishmentLine[] {
  const threshold = Math.max(0, opts.maxThreshold);
  const branchNameById = new Map(opts.branches.map((b) => [b.id, b.name]));

  const lines: ReplenishmentLine[] = [];

  for (const row of rows) {
    if (opts.supplierId !== "all" && row.supplierId !== opts.supplierId) {
      continue;
    }

    if (
      opts.branchId !== "all" &&
      !row.assignedBranchIds.includes(opts.branchId)
    ) {
      continue;
    }

    const stockUnit = row.productEdit.stockUnit;
    const evalOpts = {
      stockUnit,
      itemType: row.productEdit.itemType,
      kgPerSack: row.productEdit.kgPerSack,
      unitsPerCase: row.productEdit.unitsPerCase,
    };

    const rawQty =
      opts.branchId === "all"
        ? row.stockQuantity
        : (row.branchQtyById[opts.branchId] ?? 0);

    const comparableQty = inventoryComparableQuantity({
      ...evalOpts,
      rawQuantity: rawQty,
    });

    const status = replenishmentStatus(comparableQty, threshold);
    if (!status) continue;
    if (!opts.includeOutOfStock && status === "out") continue;

    const stockFormatted = formatDualStock(stockUnit, rawQty, evalOpts);
    const unitLabel = inventoryQuantityUnitLabel(
      stockUnit,
      row.productEdit.itemType,
    );

    let branchLabel: string;
    if (opts.branchId === "all") {
      const parts = row.assignedBranchIds.map((id) => {
        const qty = row.branchQtyById[id] ?? 0;
        const name = branchNameById.get(id) ?? "Branch";
        const disp = formatDualStock(stockUnit, qty, evalOpts);
        return `${name}: ${disp.primary}`;
      });
      branchLabel = parts.length ? parts.join(" · ") : "Not assigned to any branch";
    } else {
      branchLabel =
        branchNameById.get(opts.branchId) ?? `Branch #${opts.branchId}`;
    }

    lines.push({
      productId: row.id,
      item: row.item,
      brand: row.brand,
      flavor: row.flavor,
      itemTypeLabel: row.itemTypeLabel,
      supplierName: row.supplierName,
      stockDisplay: formatComparableQuantity(
        comparableQty,
        stockUnit,
        row.productEdit.itemType,
      ),
      stockDetail:
        stockFormatted.secondary !== "—"
          ? `${stockFormatted.primary} · ${stockFormatted.secondary}`
          : stockFormatted.primary,
      comparableQty,
      unitLabel,
      status,
      branchLabel,
    });
  }

  lines.sort((a, b) => {
    if (a.status !== b.status) return a.status === "out" ? -1 : 1;
    if (a.comparableQty !== b.comparableQty) {
      return a.comparableQty - b.comparableQty;
    }
    return a.item.localeCompare(b.item);
  });

  return lines;
}
