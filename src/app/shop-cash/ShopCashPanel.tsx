"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  deleteShopCashOutflow,
  recordShopExpense,
  recordShopRestock,
  type ShopCashActionResult,
} from "@/app/shop-cash/actions";
import {
  ProductSelectField,
  type ProductSelectOption,
} from "@/components/ProductSelectField";
import { formatPhpFromCents } from "@/lib/money";
import {
  expenseCategoryLabel,
  outflowKindLabel,
  shopCashDateInputValue,
} from "@/lib/shop-cash";
import type { ShopCashLedgerRow } from "@/db/queries/shop-cash";
import { SHOP_EXPENSE_CATEGORIES } from "@/db/schema";
import type { StockUnit } from "@/db/schema";
import { stockQtyLabel } from "@/lib/product-stock";

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

function SummaryCards(props: {
  cashCollectedCents: number;
  availableShopCashCents: number;
  thisMonthExpenseCents: number;
  thisMonthRestockCents: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-brand-cyan/25 bg-brand-blue/10 px-4 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wide text-brand-cyan/80">
          Available shop cash
        </div>
        <div className="mt-1 text-lg font-semibold text-zinc-50">
          {formatPhpFromCents(props.availableShopCashCents)}
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-500">
          Sales cash collected − all recorded outflows
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
          Bills, rent, utilities, etc.
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
          Inventory purchases from shop cash
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
        Electric bill, water, rent, supplies — anything paid from the shop&apos;s on-hand
        money.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
  restockProducts: Array<ProductSelectOption & { stockUnit: StockUnit }>;
  branches: Array<{ id: number; name: string }>;
  suppliers: Array<{ id: number; name: string }>;
}) {
  const [state, action, pending] = useActionState(recordShopRestock, null);
  const [addStock, setAddStock] = useState(true);
  const [productId, setProductId] = useState(props.restockProducts[0]?.id ?? 0);

  const selectedProduct = useMemo(
    () => props.restockProducts.find((p) => p.id === productId) ?? null,
    [props.restockProducts, productId],
  );

  const qtyLabel = selectedProduct
    ? stockQtyLabel(selectedProduct.stockUnit).replace(/^Stock /, "Units ")
    : "Units to add";

  return (
    <form action={action} className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-zinc-100">Record restock payment</h3>
      <p className="mt-1 text-[11px] text-zinc-500">
        When you buy inventory using shop cash, record the payment here. Optionally add
        stock in the same step so inventory stays in sync.
        {props.restockProducts.length > 0 ? (
          <>
            {" "}
            <span className="text-zinc-400">
              {props.restockProducts.length} product
              {props.restockProducts.length === 1 ? "" : "s"} in inventory — search by
              name, brand, or supplier.
            </span>
          </>
        ) : null}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                  onChange={setProductId}
                  placeholder="Search and select product…"
                />
                <input type="hidden" name="productId" value={productId || ""} />
              </div>
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
                  type="number"
                  min="1"
                  step="1"
                  required={addStock}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
                  placeholder="e.g. 24"
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

function LedgerTable(props: { entries: ShopCashLedgerRow[] }) {
  const [, deleteAction, deletePending] = useActionState(deleteShopCashOutflow, null);

  if (!props.entries.length) {
    return (
      <p className="mt-4 text-sm text-zinc-500">
        No outflows recorded yet. Add an expense or restock payment above.
      </p>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[640px] text-xs">
        <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
          <tr>
            <th className="px-3 py-2">Date</th>
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
            if (e.stockQtyAdded != null) detailParts.push(`+${e.stockQtyAdded} units`);

            return (
              <tr key={e.id} className="border-t border-white/5">
                <td className="px-3 py-2.5 text-zinc-400">{dateLabel}</td>
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
                  {e.stockQtyAdded == null ? (
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <button
                        type="submit"
                        disabled={deletePending}
                        className="text-[10px] text-zinc-600 underline hover:text-red-300"
                      >
                        Remove
                      </button>
                    </form>
                  ) : (
                    <span className="text-[10px] text-zinc-700" title="Stock was added">
                      —
                    </span>
                  )}
                </td>
              </tr>
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
  entries: ShopCashLedgerRow[];
  restockProducts: Array<ProductSelectOption & { stockUnit: StockUnit }>;
  branches: Array<{ id: number; name: string }>;
  suppliers: Array<{ id: number; name: string }>;
}) {
  return (
    <div className="space-y-6">
      <SummaryCards
        cashCollectedCents={props.cashCollectedCents}
        availableShopCashCents={props.availableShopCashCents}
        thisMonthExpenseCents={props.thisMonthExpenseCents}
        thisMonthRestockCents={props.thisMonthRestockCents}
      />

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
          Recent expenses and restock payments · {props.entries.length} shown
        </p>
        <LedgerTable entries={props.entries} />
      </section>
    </div>
  );
}
