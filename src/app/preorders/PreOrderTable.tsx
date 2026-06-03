"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  deletePreOrder,
  receivePreOrderItem,
  updatePreOrderStatus,
  type PreOrderActionResult,
} from "@/app/preorders/actions";
import { formatPhpFromCents } from "@/lib/money";

export type PreOrderRow = {
  id: number;
  supplierName: string;
  status: string;
  customerName: string | null;
  expectedDate: Date | null;
  depositCents: number;
  totalCostCents: number;
  notes: string | null;
  fulfillmentOrderId: number | null;
  createdAt: Date;
  items: {
    id: number;
    productId: number | null;
    itemName: string;
    variant: string | null;
    quantity: number;
    unitCostCents: number;
    lineTotalCents: number;
    receivedQty: number;
    stockOnHand: number | null;
  }[];
};

const statuses = [
  "Draft",
  "Ordered",
  "In Transit",
  "Partial",
  "Received",
  "Cancelled",
] as const;

function FeedbackBanner(props: { state: PreOrderActionResult | null }) {
  if (!props.state) return null;
  if (props.state.error) {
    return (
      <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
        {props.state.error}
      </div>
    );
  }
  if (props.state.ok && props.state.message) {
    return (
      <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
        {props.state.message}
        {props.state.orderId ? (
          <>
            {" "}
            <Link
              href="/orders"
              className="font-medium underline hover:text-emerald-200"
            >
              Open Sales &amp; Orders →
            </Link>
          </>
        ) : null}
      </div>
    );
  }
  return null;
}

export function PreOrderTable(props: { rows: PreOrderRow[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [statusState, statusAction, statusPending] = useActionState<
    PreOrderActionResult | null,
    FormData
  >(updatePreOrderStatus, null);
  const [receiveState, receiveAction, receivePending] = useActionState<
    PreOrderActionResult | null,
    FormData
  >(receivePreOrderItem, null);

  const feedback = statusState ?? receiveState;

  const filtered = useMemo(() => {
    if (filter === "all") return props.rows;
    return props.rows.filter((r) => r.status === filter);
  }, [props.rows, filter]);

  return (
    <div>
      <FeedbackBanner state={feedback} />

      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none"
        >
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-500">No pre-orders yet.</p>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-zinc-50">
                    #{row.id}
                    {row.items[0]?.itemName ? ` · ${row.items[0].itemName}` : ""}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {row.customerName ? `For ${row.customerName} · ` : "Shop stock · "}
                    {formatPhpFromCents(row.totalCostCents)} cost
                    {row.depositCents > 0
                      ? ` · ${formatPhpFromCents(row.depositCents)} deposit`
                      : ""}
                    {row.supplierName !== "—"
                      ? ` · PO ref: ${row.supplierName}`
                      : ""}
                  </div>
                  {row.fulfillmentOrderId ? (
                    <div className="mt-1 text-[10px] text-emerald-300">
                      Linked to{" "}
                      <Link
                        href="/orders"
                        className="underline hover:text-emerald-200"
                      >
                        sales order #{row.fulfillmentOrderId}
                      </Link>
                    </div>
                  ) : row.customerName &&
                    row.status !== "Received" &&
                    row.status !== "Cancelled" ? (
                    <div className="mt-1 text-[10px] text-zinc-500">
                      {row.items.some(
                        (item) =>
                          item.stockOnHand != null &&
                          item.stockOnHand >= item.quantity,
                      )
                        ? "Inventory ready — auto moves to Sales & Orders when restocked, or set status to Received."
                        : "Waiting for inventory stock (restock from any supplier in Inventory)."}
                    </div>
                  ) : null}
                </div>
                <form action={statusAction} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={row.id} />
                  <select
                    name="status"
                    defaultValue={row.status}
                    disabled={statusPending || !!row.fulfillmentOrderId}
                    className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-zinc-50 disabled:opacity-50"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={statusPending || !!row.fulfillmentOrderId}
                    className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200 disabled:opacity-50"
                  >
                    {statusPending ? "…" : "Update"}
                  </button>
                </form>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded(expanded === row.id ? null : row.id)
                  }
                  className="text-[10px] text-zinc-400 hover:text-zinc-200"
                >
                  {expanded === row.id ? "Hide items" : "Show items"}
                </button>
                {!row.fulfillmentOrderId ? (
                  <form action={deletePreOrder}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="text-[10px] text-red-400/80 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </form>
                ) : null}
              </div>

              {expanded === row.id ? (
                <ul className="mt-2 space-y-2 border-t border-white/10 pt-2">
                  {row.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="text-zinc-200">{item.itemName}</span>
                        {item.variant ? (
                          <span className="ml-1 text-zinc-500">{item.variant}</span>
                        ) : null}
                        <div className="text-zinc-500">
                          {item.quantity} × {formatPhpFromCents(item.unitCostCents)} ={" "}
                          {formatPhpFromCents(item.lineTotalCents)}
                        </div>
                        {item.stockOnHand != null ? (
                          <div
                            className={
                              item.stockOnHand >= item.quantity
                                ? "text-emerald-400/90"
                                : "text-amber-300/90"
                            }
                          >
                            Inventory: {item.stockOnHand} / need {item.quantity}
                          </div>
                        ) : null}
                      </div>
                      {!row.customerName ? (
                        <form
                          action={receiveAction}
                          className="flex items-center gap-1"
                        >
                          <input type="hidden" name="itemId" value={item.id} />
                          <span className="text-[10px] text-zinc-500">Received</span>
                          <input
                            name="receivedQty"
                            type="number"
                            min={0}
                            max={item.quantity}
                            defaultValue={item.receivedQty}
                            disabled={receivePending || !!row.fulfillmentOrderId}
                            className="w-12 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-center text-xs disabled:opacity-50"
                          />
                          <button
                            type="submit"
                            disabled={receivePending || !!row.fulfillmentOrderId}
                            className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300 disabled:opacity-50"
                          >
                            Save
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
