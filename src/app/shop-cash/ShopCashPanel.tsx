"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";

import {
  deleteInvestorContribution,
  deleteShopCashOutflow,
  recordInvestorContribution,
  recordShopExpense,
  recordShopRestock,
  updateShopCashOutflow,
  type ShopCashActionResult,
} from "@/app/shop-cash/actions";
import {
  ProductSelectField,
  type ProductSelectOption,
} from "@/components/ProductSelectField";
import type { InvestorCapitalContributionRow } from "@/db/queries/investor-capital";
import type { ShopCashLedgerRow } from "@/db/queries/shop-cash";
import { SHOP_EXPENSE_CATEGORIES } from "@/db/schema";
import type { StockUnit } from "@/db/schema";
import { formatPhpFromCents } from "@/lib/money";
import {
  defaultRestockEntryMode,
  formatRestockQtyDelta,
  isWeightStockUnit,
  parseRestockStockInput,
  restockQtyFieldLabel,
} from "@/lib/product-stock";
import { isCatLitterItemType } from "@/lib/catalog-item-types";
import { displayKgPerSack } from "@/lib/order-line-math";
import {
  expenseCategoryLabel,
  fundingSourceLabel,
  outflowKindLabel,
  shopCashDateInputValue,
} from "@/lib/shop-cash";

function ActionMessage(props: { result: ShopCashActionResult | null }) {
  if (!props.result) return null;
  if (props.result.error) {
    return (
      <p className="mt-2 text-xs text-red-300" role="alert">
        {props.result.error}
      </p>
    );
  }
  if (props.result.message) {
    return (
      <p className="mt-2 text-xs text-emerald-300" role="status">
        {props.result.message}
      </p>
    );
  }
  return null;
}

function FundingSourceField(props: { name?: string; defaultValue?: string }) {
  const name = props.name ?? "fundingSource";
  return (
    <fieldset className="block text-xs text-zinc-400 sm:col-span-2">
      <legend className="mb-1.5">Paid from</legend>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-zinc-300">
          <input
            type="radio"
            name={name}
            value="shop_cash"
            defaultChecked={props.defaultValue !== "investor_capital"}
            className="border-white/20"
          />
          Shop cash (from sales)
        </label>
        <label className="flex items-center gap-2 text-zinc-300">
          <input
            type="radio"
            name={name}
            value="investor_capital"
            defaultChecked={props.defaultValue === "investor_capital"}
            className="border-white/20"
          />
          Investor capital
        </label>
      </div>
    </fieldset>
  );
}

function SummaryCards(props: {
  cashCollectedCents: number;
  availableShopCashCents: number;
  thisMonthExpenseCents: number;
  thisMonthRestockCents: number;
  investorBalanceCents: number;
  investorSpentCents: number;
  investorContributedCents: number;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-brand-cyan/25 bg-brand-blue/10 px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-brand-cyan/80">
            Available shop cash
          </div>
          <div className="mt-1 text-lg font-semibold text-zinc-50">
            {formatPhpFromCents(props.availableShopCashCents)}
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-500">
            Sales cash collected − shop-cash outflows only
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Cash from sales
          </div>
          <div className="mt-1 text-lg font-semibold text-zinc-100">
            {formatPhpFromCents(props.cashCollectedCents)}
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-600">
            Total customer payments recorded
          </div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-amber-200/70">
            Expenses this month
          </div>
          <div className="mt-1 text-lg font-semibold text-amber-100">
            {formatPhpFromCents(props.thisMonthExpenseCents)}
          </div>
          <div className="mt-0.5 text-[10px] text-amber-200/60">
            From shop cash · see ledger for investor-paid
          </div>
        </div>
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-violet-200/70">
            Restock paid this month
          </div>
          <div className="mt-1 text-lg font-semibold text-violet-100">
            {formatPhpFromCents(props.thisMonthRestockCents)}
          </div>
          <div className="mt-0.5 text-[10px] text-violet-200/60">
            Shop cash restocks · auto-updates unit cost
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-200/80">
            Investor capital balance
          </div>
          <div className="mt-1 text-lg font-semibold text-emerald-100">
            {formatPhpFromCents(props.investorBalanceCents)}
          </div>
          <div className="mt-0.5 text-[10px] text-emerald-200/60">
            Contributions − expenses &amp; restocks paid from pool
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Total contributed
          </div>
          <div className="mt-1 text-lg font-semibold text-zinc-100">
            {formatPhpFromCents(props.investorContributedCents)}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Spent from investor pool
          </div>
          <div className="mt-1 text-lg font-semibold text-zinc-100">
            {formatPhpFromCents(props.investorSpentCents)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpenseForm() {
  const [state, action, pending] = useActionState(recordShopExpense, null);

  return (
    <form action={action} className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-zinc-100">Record operating expense</h3>
      <p className="mt-1 text-[11px] text-zinc-500">
        Bills, rent, equipment (e.g. scale), supplies — choose whether paid from sales
        cash or investor capital.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <FundingSourceField />
        <label className="block text-xs text-zinc-400">
          Category
          <select
            name="expenseCategory"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            defaultValue="utilities_electric"
          >
            {SHOP_EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {expenseCategoryLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-zinc-400">
          Amount paid (₱)
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            placeholder="0.00"
          />
        </label>
        <label className="block text-xs text-zinc-400 sm:col-span-2">
          Description
          <input
            name="description"
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            placeholder="Meralco bill — March 2026"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Vendor / payee
          <input
            name="vendor"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            placeholder="Meralco, landlord, etc."
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Reference / receipt #
          <input
            name="reference"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Date paid
          <input
            name="paidAt"
            type="date"
            required
            defaultValue={shopCashDateInputValue()}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs text-zinc-400 sm:col-span-2">
          Notes (optional)
          <input
            name="notes"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-xl bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Record expense"}
      </button>
      <ActionMessage result={state} />
    </form>
  );
}

function RestockForm(props: {
  restockProducts: Array<
    ProductSelectOption & {
      stockUnit: StockUnit;
      costPriceCents: number;
      kgPerSack: number | null;
      unitsPerCase: number | null;
      itemType: string | null;
    }
  >;
  branches: Array<{ id: number; name: string }>;
  suppliers: Array<{ id: number; name: string }>;
}) {
  const [state, action, pending] = useActionState(recordShopRestock, null);
  const [addStock, setAddStock] = useState(true);
  const [productId, setProductId] = useState(props.restockProducts[0]?.id ?? 0);
  const [amount, setAmount] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [stockEntryMode, setStockEntryMode] = useState<"sacks" | "kg" | "cases" | "pcs">(
    "pcs",
  );

  const selectedProduct = useMemo(
    () => props.restockProducts.find((p) => p.id === productId) ?? null,
    [props.restockProducts, productId],
  );

  const isWeight = selectedProduct
    ? isWeightStockUnit(selectedProduct.stockUnit)
    : false;
  const isLitter = selectedProduct
    ? isCatLitterItemType(selectedProduct.itemType)
    : false;
  const showCaseMode =
    selectedProduct != null &&
    !isWeight &&
    !isLitter &&
    selectedProduct.stockUnit === "Piece" &&
    (selectedProduct.unitsPerCase ?? 24) > 1;

  const handleProductChange = (id: number) => {
    setProductId(id);
    const product = props.restockProducts.find((p) => p.id === id);
    if (product) {
      setStockEntryMode(
        defaultRestockEntryMode(product.stockUnit, {
          unitsPerCase: product.unitsPerCase,
          itemType: product.itemType,
        }),
      );
    }
  };

  const qtyLabel = selectedProduct
    ? restockQtyFieldLabel(selectedProduct.stockUnit, stockEntryMode, selectedProduct.itemType)
    : "Quantity";

  const parsedQty = useMemo(() => {
    if (!selectedProduct || !stockQty.trim()) return null;
    return parseRestockStockInput(stockQty, selectedProduct.stockUnit, {
      stockEntryMode,
      kgPerSack: selectedProduct.kgPerSack,
      unitsPerCase: selectedProduct.unitsPerCase,
    });
  }, [selectedProduct, stockQty, stockEntryMode]);

  const amountCents = Math.round(Number.parseFloat(amount || "0") * 100);
  const impliedUnitCost =
    parsedQty && amountCents > 0
      ? Math.round(amountCents / parsedQty.costDivisor)
      : null;

  const costChanged =
    impliedUnitCost != null &&
    selectedProduct != null &&
    impliedUnitCost !== selectedProduct.costPriceCents;

  const kgPerSackDisplay = selectedProduct?.kgPerSack
    ? displayKgPerSack(selectedProduct.kgPerSack)
    : null;

  useEffect(() => {
    if (!selectedProduct) return;
    setStockEntryMode(
      defaultRestockEntryMode(selectedProduct.stockUnit, {
        unitsPerCase: selectedProduct.unitsPerCase,
        itemType: selectedProduct.itemType,
      }),
    );
  }, [selectedProduct?.id]);

  return (
    <form action={action} className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-zinc-100">Record restock payment</h3>
      <p className="mt-1 text-[11px] text-zinc-500">
        When you add stock, we calculate unit cost (amount ÷ units) and update inventory
        + supplier catalog if the price changed. Visible on Suppliers and Reports.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <FundingSourceField />
        <label className="block text-xs text-zinc-400">
          Amount paid (₱)
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            placeholder="0.00"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Date paid
          <input
            name="paidAt"
            type="date"
            required
            defaultValue={shopCashDateInputValue()}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300 sm:col-span-2">
          <input
            type="checkbox"
            name="addStock"
            checked={addStock}
            onChange={(e) => setAddStock(e.target.checked)}
            className="rounded border-white/20"
          />
          Also add units to inventory now
        </label>
        {addStock ? (
          props.restockProducts.length === 0 ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-xs text-amber-100/90 sm:col-span-2">
              No inventory products yet.{" "}
              <Link href="/products" className="underline hover:text-amber-50">
                Add products in Inventory
              </Link>{" "}
              first, or uncheck &quot;Also add units&quot; to record payment only.
            </div>
          ) : (
            <>
              <div className="sm:col-span-2">
                <ProductSelectField
                  label="Product"
                  products={props.restockProducts}
                  value={productId}
                  onChange={handleProductChange}
                  placeholder="Search and select product…"
                />
                <input type="hidden" name="productId" value={productId || ""} />
                <input type="hidden" name="stockEntryMode" value={stockEntryMode} />
                {selectedProduct?.kgPerSack ? (
                  <input
                    type="hidden"
                    name="kgPerSack"
                    value={kgPerSackDisplay ?? ""}
                  />
                ) : null}
              </div>
              {selectedProduct ? (
                <div className="text-[10px] text-zinc-500 sm:col-span-2">
                  Stock unit:{" "}
                  <span className="text-zinc-300">{selectedProduct.stockUnit}</span>
                  {kgPerSackDisplay ? (
                    <>
                      {" "}
                      · {kgPerSackDisplay} kg/sack
                    </>
                  ) : null}
                </div>
              ) : null}
              {isWeight ? (
                <label className="block text-xs text-zinc-400">
                  Enter quantity as
                  <select
                    value={stockEntryMode}
                    onChange={(e) =>
                      setStockEntryMode(e.target.value as "sacks" | "kg")
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="sacks">Sacks</option>
                  </select>
                </label>
              ) : showCaseMode ? (
                <label className="block text-xs text-zinc-400">
                  Enter quantity as
                  <select
                    value={stockEntryMode}
                    onChange={(e) =>
                      setStockEntryMode(e.target.value as "cases" | "pcs")
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="cases">Cases</option>
                  </select>
                </label>
              ) : null}
              {selectedProduct && parsedQty ? (
                <div
                  className={`rounded-lg border px-3 py-2 text-[11px] sm:col-span-2 ${
                    costChanged
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                      : "border-white/10 bg-black/20 text-zinc-400"
                  }`}
                >
                  Current unit cost: {formatPhpFromCents(selectedProduct.costPriceCents)}
                  {" · "}
                  Adding:{" "}
                  {formatRestockQtyDelta(
                    selectedProduct.stockUnit,
                    parsedQty.rawDelta,
                    {
                      kgPerSack: selectedProduct.kgPerSack,
                      unitsPerCase: selectedProduct.unitsPerCase,
                      itemType: selectedProduct.itemType,
                    },
                  )}
                  {impliedUnitCost != null ? (
                    <>
                      {" "}
                      · Unit cost from payment: {formatPhpFromCents(impliedUnitCost)}
                    </>
                  ) : null}
                  {costChanged ? (
                    <span className="text-amber-200">
                      {" "}
                      — will update product &amp; supplier on save
                    </span>
                  ) : impliedUnitCost != null ? (
                    <span> — no cost change</span>
                  ) : null}
                </div>
              ) : null}
              <label className="block text-xs text-zinc-400">
                Branch
                <select
                  name="branchId"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
                  defaultValue={props.branches[0]?.id ?? ""}
                >
                  {props.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-zinc-400">
                {qtyLabel}
                <input
                  name="stockQty"
                  type="text"
                  inputMode="decimal"
                  required={addStock}
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
                  placeholder={
                    isWeight
                      ? stockEntryMode === "sacks"
                        ? "e.g. 2"
                        : "e.g. 40 or 2.5"
                      : stockEntryMode === "cases"
                        ? "e.g. 1"
                        : "e.g. 24"
                  }
                />
              </label>
            </>
          )
        ) : (
          <label className="block text-xs text-zinc-400 sm:col-span-2">
            Description
            <input
              name="description"
              required={!addStock}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
              placeholder="Supplier delivery — bulk dog food"
            />
          </label>
        )}
        <label className="block text-xs text-zinc-400">
          Supplier (optional)
          <select
            name="supplierId"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            defaultValue=""
          >
            <option value="">—</option>
            {props.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-zinc-400">
          Vendor / receipt #
          <input
            name="reference"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs text-zinc-400 sm:col-span-2">
          Notes (optional)
          <input
            name="notes"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending || (addStock && props.restockProducts.length === 0)}
        className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Record restock payment"}
      </button>
      <ActionMessage result={state} />
    </form>
  );
}

function InvestorContributionForm(props: {
  investors: Array<{ id: number; fullName: string }>;
  balanceCents: number;
}) {
  const [state, action, pending] = useActionState(recordInvestorContribution, null);

  return (
    <form action={action} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <h3 className="text-sm font-semibold text-emerald-100">Add investor money</h3>
      <p className="mt-1 text-[11px] text-emerald-200/60">
        Record capital the investor puts into the business pool. Use &quot;Investor
        capital&quot; when paying expenses so sales cash stays untouched. Balance:{" "}
        <span className="font-medium text-emerald-100">
          {formatPhpFromCents(props.balanceCents)}
        </span>
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-zinc-400">
          Investor (optional)
          <select
            name="investorId"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            defaultValue=""
          >
            <option value="">— General pool —</option>
            {props.investors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-zinc-400">
          Amount (₱)
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            placeholder="0.00"
          />
        </label>
        <label className="block text-xs text-zinc-400 sm:col-span-2">
          Description
          <input
            name="description"
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            placeholder="Capital top-up — equipment fund"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Date received
          <input
            name="paidAt"
            type="date"
            required
            defaultValue={shopCashDateInputValue()}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Notes (optional)
          <input
            name="notes"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Record contribution"}
      </button>
      <ActionMessage result={state} />
    </form>
  );
}

function ContributionsTable(props: { rows: InvestorCapitalContributionRow[] }) {
  const [, deleteAction, deletePending] = useActionState(deleteInvestorContribution, null);

  if (!props.rows.length) {
    return (
      <p className="mt-3 text-xs text-zinc-500">
        No contributions yet. Record investor money above before paying expenses from
        the pool.
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[400px] text-xs">
        <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {props.rows.slice(0, 10).map((row) => (
            <tr key={row.id} className="border-t border-white/5">
              <td className="px-3 py-2 text-zinc-400">
                {new Date(row.contributedAt).toLocaleDateString("en-PH", {
                  timeZone: "Asia/Manila",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              <td className="px-3 py-2 text-zinc-200">
                {row.description}
                {row.investorName ? (
                  <span className="text-zinc-600"> · {row.investorName}</span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-emerald-300/90">
                +{formatPhpFromCents(row.amountCents)}
              </td>
              <td className="px-3 py-2 text-right">
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <button
                    type="submit"
                    disabled={deletePending}
                    onClick={(e) => {
                      if (
                        !confirm(
                          "Remove this investor contribution? The pool balance will update.",
                        )
                      ) {
                        e.preventDefault();
                      }
                    }}
                    className="text-[10px] text-zinc-600 underline hover:text-red-300"
                  >
                    Remove
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LedgerTable(props: { entries: ShopCashLedgerRow[] }) {
  const [, deleteAction, deletePending] = useActionState(deleteShopCashOutflow, null);
  const [editState, editAction, editPending] = useActionState(updateShopCashOutflow, null);
  const [editingId, setEditingId] = useState<number | null>(null);

  if (!props.entries.length) {
    return (
      <p className="mt-4 text-sm text-zinc-500">
        No outflows recorded yet. Add an expense or restock payment above.
      </p>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[720px] text-xs">
        <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {props.entries.map((e) => {
            const date = new Date(e.paidAt);
            const dateLabel = date.toLocaleDateString("en-PH", {
              timeZone: "Asia/Manila",
              year: "numeric",
              month: "short",
              day: "numeric",
            });
            const detailParts: string[] = [];
            if (e.kind === "expense" && e.expenseCategory) {
              detailParts.push(expenseCategoryLabel(e.expenseCategory));
            }
            if (e.vendor) detailParts.push(e.vendor);
            if (e.productLabel) detailParts.push(e.productLabel);
            if (e.branchName) detailParts.push(e.branchName);
            if (e.stockQtyDisplay) detailParts.push(e.stockQtyDisplay);
            else if (e.stockQtyAdded != null) detailParts.push(`+${e.stockQtyAdded} units`);

            return (
              <>
                <tr key={e.id} className="border-t border-white/5">
                  <td className="px-3 py-2.5 text-zinc-400">{dateLabel}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={
                        e.fundingSource === "investor_capital"
                          ? "text-emerald-300/90"
                          : "text-zinc-400"
                      }
                    >
                      {fundingSourceLabel(e.fundingSource)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-300">{outflowKindLabel(e.kind)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-zinc-200">{e.description}</div>
                    {detailParts.length ? (
                      <div className="mt-0.5 text-[10px] text-zinc-600">
                        {detailParts.join(" · ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-red-300/90">
                    −{formatPhpFromCents(e.amountCents)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      {e.stockQtyAdded == null ? (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingId((cur) => (cur === e.id ? null : e.id))
                          }
                          className="text-[10px] text-zinc-500 underline hover:text-zinc-300"
                        >
                          {editingId === e.id ? "Cancel" : "Edit"}
                        </button>
                      ) : null}
                      <form action={deleteAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <button
                          type="submit"
                          disabled={deletePending}
                          onClick={(ev) => {
                            if (e.stockQtyAdded != null && e.stockQtyAdded > 0) {
                              const qty =
                                e.stockQtyDisplay ?? `+${e.stockQtyAdded} units`;
                              if (
                                !confirm(
                                  `Remove this entry and reverse ${qty} from inventory?`,
                                )
                              ) {
                                ev.preventDefault();
                              }
                            } else if (
                              !confirm("Remove this ledger entry? Shop cash will update.")
                            ) {
                              ev.preventDefault();
                            }
                          }}
                          className="text-[10px] text-zinc-600 underline hover:text-red-300"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
                {editingId === e.id && e.stockQtyAdded == null ? (
                  <tr key={`${e.id}-edit`} className="border-t border-white/5 bg-black/20">
                    <td colSpan={6} className="px-3 py-3">
                      <form action={editAction} className="space-y-3">
                        <input type="hidden" name="id" value={e.id} />
                        <div className="text-[11px] font-medium text-zinc-300">
                          Fix this entry
                        </div>
                        <p className="text-[10px] text-zinc-500">
                          Change the description or reclassify as an operating expense if
                          this was not an inventory restock.
                        </p>
                        <label className="block text-xs text-zinc-400">
                          Description
                          <input
                            name="description"
                            required
                            defaultValue={e.description}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
                          />
                        </label>
                        <fieldset className="text-xs text-zinc-400">
                          <legend className="mb-1.5">Record as</legend>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 text-zinc-300">
                              <input
                                type="radio"
                                name="recordAs"
                                value="restock"
                                defaultChecked={e.kind === "restock"}
                              />
                              Restock payment (no stock added)
                            </label>
                            <label className="flex items-center gap-2 text-zinc-300">
                              <input
                                type="radio"
                                name="recordAs"
                                value="expense"
                                defaultChecked={e.kind === "expense"}
                              />
                              Operating expense (not inventory)
                            </label>
                          </div>
                        </fieldset>
                        <label className="block text-xs text-zinc-400">
                          Expense category (if operating expense)
                          <select
                            name="expenseCategory"
                            className="mt-1 w-full max-w-xs rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
                            defaultValue={e.expenseCategory ?? "supplies"}
                          >
                            {SHOP_EXPENSE_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {expenseCategoryLabel(c)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-xs text-zinc-400">
                          Notes (optional)
                          <input
                            name="notes"
                            defaultValue={e.notes ?? ""}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
                          />
                        </label>
                        <div className="flex items-center gap-3">
                          <button
                            type="submit"
                            disabled={editPending}
                            className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50"
                          >
                            {editPending ? "Saving…" : "Save changes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-xs text-zinc-500 underline hover:text-zinc-300"
                          >
                            Cancel
                          </button>
                        </div>
                        <ActionMessage result={editState} />
                      </form>
                    </td>
                  </tr>
                ) : null}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ShopCashPanel(props: {
  cashCollectedCents: number;
  availableShopCashCents: number;
  thisMonthExpenseCents: number;
  thisMonthRestockCents: number;
  investorCapital: {
    contributedCents: number;
    spentCents: number;
    balanceCents: number;
    contributions: InvestorCapitalContributionRow[];
  };
  entries: ShopCashLedgerRow[];
  restockProducts: Array<
    ProductSelectOption & {
      stockUnit: StockUnit;
      costPriceCents: number;
      kgPerSack: number | null;
      unitsPerCase: number | null;
      itemType: string | null;
    }
  >;
  branches: Array<{ id: number; name: string }>;
  suppliers: Array<{ id: number; name: string }>;
  investors: Array<{ id: number; fullName: string }>;
}) {
  return (
    <div className="space-y-6">
      <SummaryCards
        cashCollectedCents={props.cashCollectedCents}
        availableShopCashCents={props.availableShopCashCents}
        thisMonthExpenseCents={props.thisMonthExpenseCents}
        thisMonthRestockCents={props.thisMonthRestockCents}
        investorBalanceCents={props.investorCapital.balanceCents}
        investorSpentCents={props.investorCapital.spentCents}
        investorContributedCents={props.investorCapital.contributedCents}
      />

      <section className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-5">
        <h2 className="text-sm font-semibold text-emerald-100">Investor capital</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          Separate pool for investor-funded purchases (equipment, setup costs) without
          touching sales cash. Record contributions, then choose &quot;Investor
          capital&quot; when logging expenses.
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <InvestorContributionForm
            investors={props.investors}
            balanceCents={props.investorCapital.balanceCents}
          />
          <div>
            <h3 className="text-xs font-medium text-zinc-400">Recent contributions</h3>
            <ContributionsTable rows={props.investorCapital.contributions} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ExpenseForm />
        <RestockForm
          restockProducts={props.restockProducts}
          branches={props.branches}
          suppliers={props.suppliers}
        />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-semibold text-zinc-100">Money out ledger</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          Recent expenses and restock payments · {props.entries.length} shown ·
          Remove reverses stock when a restock added inventory
        </p>
        <LedgerTable entries={props.entries} />
      </section>
    </div>
  );
}
