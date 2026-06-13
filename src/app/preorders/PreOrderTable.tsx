"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  deletePreOrder,
  receivePreOrderItem,
  updatePreOrderStatus,
  type PreOrderActionResult,
} from "@/app/preorders/actions";
import { EditModal, modalFieldClass } from "@/components/EditModal";
import { TableToolbar } from "@/components/TableToolbar";
import { formatPhpFromCents } from "@/lib/money";
import { matchesQuery, rowSearchText } from "@/lib/table-filter";

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
      <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
        {props.state.error}
      </div>
    );
  }
  if (props.state.ok && props.state.message) {
    return (
      <div className="mb-3 rounded-lg border border-brand-cyan/30 bg-brand-blue/10 px-3 py-2 text-xs text-brand-cyan/80">
        {props.state.message}
        {props.state.orderId ? (
          <>
            {" "}
            <Link
              href="/orders"
              className="font-medium underline hover:text-brand-cyan/70"
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
  const [editId, setEditId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
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
  const editRow = props.rows.find((r) => r.id === editId) ?? null;

  const filtered = useMemo(() => {
    let list = props.rows;
    if (filter !== "all") {
      list = list.filter((r) => r.status === filter);
    }
    if (query.trim()) {
      list = list.filter((r) =>
        matchesQuery(
          rowSearchText([
            r.id,
            r.customerName,
            r.supplierName,
            r.status,
            ...r.items.flatMap((i) => [i.itemName, i.variant]),
          ]),
          query,
        ),
      );
    }
    return list;
  }, [props.rows, filter, query]);

  return (
    <div>
      <FeedbackBanner state={feedback} />

      <TableToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search customer, item, PO #…"
        shown={filtered.length}
        total={props.rows.length}
        filters={[
          {
            id: "status",
            value: filter,
            onChange: setFilter,
            "aria-label": "Filter by status",
            options: [
              { value: "all", label: "All statuses" },
              ...statuses.map((s) => ({ value: s, label: s })),
            ],
          },
        ]}
      />

      <div className="space-y-3">
        {props.rows.length === 0 ? (
          <p className="text-sm text-zinc-600">No pre-orders yet.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-zinc-600">No pre-orders match your search or filters.</p>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-zinc-900">
                    #{row.id}
                    {row.items[0]?.itemName ? ` · ${row.items[0].itemName}` : ""}
                  </div>
                  <div className="text-xs text-zinc-600">
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
                    <div className="mt-1 text-[10px] text-brand-cyan/80">
                      Linked to{" "}
                      <Link
                        href="/orders"
                        className="underline hover:text-brand-cyan/70"
                      >
                        sales order #{row.fulfillmentOrderId}
                      </Link>
                    </div>
                  ) : row.customerName &&
                    row.status !== "Received" &&
                    row.status !== "Cancelled" ? (
                    <div className="mt-1 text-[10px] text-zinc-600">
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
                <button
                  type="button"
                  disabled={!!row.fulfillmentOrderId}
                  onClick={() => setEditId(row.id)}
                  className="text-[10px] text-brand-blue underline hover:text-brand-blue disabled:opacity-50"
                >
                  Edit
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded(expanded === row.id ? null : row.id)
                  }
                  className="text-[10px] text-zinc-600 hover:text-zinc-800"
                >
                  {expanded === row.id ? "Hide items" : "Show items"}
                </button>
                {!row.fulfillmentOrderId ? (
                  <form action={deletePreOrder}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="text-[10px] text-red-400/80 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </form>
                ) : null}
              </div>

              {expanded === row.id ? (
                <ul className="mt-2 space-y-2 border-t border-zinc-200 pt-2">
                  {row.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="text-zinc-800">{item.itemName}</span>
                        {item.variant ? (
                          <span className="ml-1 text-zinc-600">{item.variant}</span>
                        ) : null}
                        <div className="text-zinc-600">
                          {item.quantity} × {formatPhpFromCents(item.unitCostCents)} ={" "}
                          {formatPhpFromCents(item.lineTotalCents)}
                        </div>
                        {item.stockOnHand != null ? (
                          <div
                            className={
                              item.stockOnHand >= item.quantity
                                ? "text-brand-cyan/90"
                                : "text-amber-800/90"
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
                          <span className="text-[10px] text-zinc-600">Received</span>
                          <input
                            name="receivedQty"
                            type="number"
                            min={0}
                            max={item.quantity}
                            defaultValue={item.receivedQty}
                            disabled={receivePending || !!row.fulfillmentOrderId}
                            className="w-12 rounded border border-zinc-300 bg-white px-1 py-0.5 text-center text-xs disabled:opacity-50"
                          />
                          <button
                            type="submit"
                            disabled={receivePending || !!row.fulfillmentOrderId}
                            className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-700 disabled:opacity-50"
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

      <EditModal
        open={editRow != null}
        onClose={() => setEditId(null)}
        title="Edit pre-order"
        subtitle={editRow ? `#${editRow.id}` : undefined}
      >
        {editRow ? (
          <form action={statusAction} className="space-y-3">
            <input type="hidden" name="id" value={editRow.id} />
            <label className="block space-y-1">
              <span className="text-[11px] text-zinc-600">Status</span>
              <select
                name="status"
                defaultValue={editRow.status}
                disabled={statusPending}
                className={modalFieldClass}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={statusPending}
              className="rounded-lg bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-50"
            >
              {statusPending ? "Saving…" : "Save status"}
            </button>
          </form>
        ) : null}
      </EditModal>
    </div>
  );
}
