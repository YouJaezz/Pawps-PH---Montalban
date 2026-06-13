"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  addPayment,
  cancelOrder,
  markOrderPaid,
  updateOrderStatus,
} from "@/app/orders/actions";
import {
  OrderEditModal,
  type OrderEditPayload,
} from "@/app/orders/OrderEditModal";
import { ScrollableTable } from "@/components/ScrollableTable";
import { ORDER_STATUSES } from "@/db/schema";
import {
  normalizeOrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
} from "@/lib/order-status";
import { formatPhpFromCents } from "@/lib/money";
import { formatOrderWhen } from "@/lib/order-timestamp";

export type OrderBoardRow = {
  id: number;
  customerName: string;
  contact: string | null;
  location: string | null;
  orderStatus: string;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: string;
  deliveryMethod: string | null;
  storeType: string;
  cashierName: string | null;
  createdAt: string;
  itemsSummary: string;
  itemsSearchText: string;
  itemCount: number;
};

export function OrdersBoard(props: {
  rows: OrderBoardRow[];
  editableByOrderId: Record<number, OrderEditPayload>;
  adminMode?: boolean;
}) {
  const adminMode = props.adminMode ?? true;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

  const stats = useMemo(() => {
    let open = 0;
    let awaitingPayment = 0;
    let paidTotal = 0;
    for (const o of props.rows) {
      const status = normalizeOrderStatus(o.orderStatus);
      if (status !== "Completed" && status !== "Cancelled") open += 1;
      if (o.paymentStatus !== "Paid" && status !== "Cancelled") awaitingPayment += 1;
      paidTotal += o.amountPaid;
    }
    return { open, awaitingPayment, paidTotal };
  }, [props.rows]);

  const filtered = useMemo(() => {
    let list = props.rows;
    const q = query.trim().toLowerCase();

    if (statusFilter === "open") {
      list = list.filter((o) => {
        const s = normalizeOrderStatus(o.orderStatus);
        return s !== "Completed" && s !== "Cancelled";
      });
    } else if (statusFilter !== "all") {
      list = list.filter(
        (o) => normalizeOrderStatus(o.orderStatus) === statusFilter,
      );
    }

    if (paymentFilter !== "all") {
      list = list.filter((o) => o.paymentStatus === paymentFilter);
    }

    if (q) {
      list = list.filter((o) => {
        const hay = `${o.customerName} ${o.contact ?? ""} ${o.location ?? ""} ${o.itemsSearchText} ${o.itemsSummary} #${o.id}`.toLowerCase();
        return hay.includes(q);
      });
    }

    return list;
  }, [props.rows, query, statusFilter, paymentFilter]);

  const editingOrder =
    editingOrderId != null ? props.editableByOrderId[editingOrderId] ?? null : null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <OrderEditModal
        order={editingOrder}
        onClose={() => setEditingOrderId(null)}
      />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <div className="text-[10px] text-zinc-500">Open orders</div>
          <div className="text-lg font-semibold text-zinc-100">{stats.open}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <div className="text-[10px] text-zinc-500">Awaiting payment</div>
          <div className="text-lg font-semibold text-amber-200">
            {stats.awaitingPayment}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <div className="text-[10px] text-zinc-500">Collected (shown)</div>
          <div className="text-lg font-semibold text-emerald-200">
            {formatPhpFromCents(stats.paidTotal)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer, item, order #…"
          className="min-w-[160px] flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-50 outline-none sm:max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-zinc-50 outline-none"
        >
          <option value="open">Open only</option>
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-zinc-50 outline-none"
        >
          <option value="all">All payments</option>
          <option value="Pending">Pending</option>
          <option value="30% Deposit">30% deposit</option>
          <option value="Paid">Paid</option>
        </select>
        <span className="text-[10px] text-zinc-600">
          {filtered.length} / {props.rows.length}
        </span>
      </div>

      <ScrollableTable maxHeight="max-h-[min(52vh,520px)]" className="mt-2">
        <table className="w-full min-w-[760px] text-[11px]">
          <thead className="sticky top-0 z-10 bg-[#13131f] text-left text-[10px] text-zinc-500">
            <tr>
              <th className="px-2 py-1.5">Order</th>
              <th className="px-2 py-1.5">Customer</th>
              <th className="hidden px-2 py-1.5 md:table-cell">Cashier</th>
              <th className="hidden px-2 py-1.5 lg:table-cell">Items</th>
              <th className="px-2 py-1.5">Payment</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-zinc-500">
                  No orders match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((o) => {
                const status = normalizeOrderStatus(o.orderStatus);
                const canCancel =
                  status !== "Cancelled" && status !== "Completed";

                return (
                  <tr key={o.id} className="align-top hover:bg-white/[0.03]">
                    <td className="px-2 py-2 text-zinc-400">
                      <div>#{o.id}</div>
                      <div className="text-[9px] text-zinc-600">
                        {formatOrderWhen(o.createdAt)}
                      </div>
                      <div className="text-[9px] text-zinc-600">{o.storeType}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium text-zinc-100">
                        {o.customerName}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {o.contact ?? "—"}
                      </div>
                      <div className="text-[10px] text-zinc-600">
                        {o.location ?? "—"}
                        {o.deliveryMethod ? ` · ${o.deliveryMethod}` : ""}
                      </div>
                    </td>
                    <td className="hidden px-2 py-2 text-zinc-400 md:table-cell">
                      {o.cashierName ?? "—"}
                    </td>
                    <td className="hidden px-2 py-2 text-zinc-400 lg:table-cell">
                      <div>{o.itemsSummary}</div>
                      {o.itemCount > 1 ? (
                        <div className="text-[9px] text-zinc-600">
                          {o.itemCount} items total
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium text-zinc-100">
                        {formatPhpFromCents(o.amountPaid)} /{" "}
                        {formatPhpFromCents(o.totalAmount)}
                      </div>
                      <div className="text-[10px] text-zinc-500">{o.paymentStatus}</div>
                      {adminMode &&
                      o.paymentStatus !== "Paid" &&
                      status !== "Cancelled" ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <form action={addPayment} className="flex gap-1">
                            <input type="hidden" name="orderId" value={o.id} />
                            <input
                              name="addAmount"
                              inputMode="decimal"
                              placeholder="₱"
                              className="w-14 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[10px] outline-none"
                            />
                            <button
                              type="submit"
                              className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-zinc-300"
                            >
                              Add
                            </button>
                          </form>
                          <form action={markOrderPaid}>
                            <input type="hidden" name="orderId" value={o.id} />
                            <button
                              type="submit"
                              className="rounded border border-emerald-500/30 px-1.5 py-0.5 text-[9px] text-emerald-300"
                            >
                              Mark paid
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      {adminMode &&
                      status !== "Cancelled" &&
                      status !== "Completed" ? (
                        <form action={updateOrderStatus} className="space-y-1">
                          <input type="hidden" name="orderId" value={o.id} />
                          <select
                            name="orderStatus"
                            defaultValue={status}
                            onChange={(e) => e.currentTarget.form?.requestSubmit()}
                            className={`w-full max-w-[9rem] rounded-md border px-1.5 py-1 text-[10px] outline-none ${ORDER_STATUS_STYLES[status]}`}
                          >
                            {ORDER_STATUSES.filter((s) => s !== "Cancelled").map(
                              (s) => (
                                <option key={s} value={s}>
                                  {ORDER_STATUS_LABELS[s]}
                                </option>
                              ),
                            )}
                          </select>
                        </form>
                      ) : (
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-[10px] ${ORDER_STATUS_STYLES[status]}`}
                        >
                          {ORDER_STATUS_LABELS[status]}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/orders/receipt/${o.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded border border-white/10 px-2 py-0.5 text-[9px] text-zinc-300 hover:bg-white/5"
                        >
                          Receipt
                        </Link>
                        {adminMode && props.editableByOrderId[o.id] ? (
                          <button
                            type="button"
                            onClick={() => setEditingOrderId(o.id)}
                            className="rounded border border-[#e8a44a]/30 px-2 py-0.5 text-[9px] text-[#e8a44a]"
                          >
                            Edit
                          </button>
                        ) : null}
                        {adminMode && canCancel ? (
                          <form action={cancelOrder}>
                            <input type="hidden" name="orderId" value={o.id} />
                            <button
                              type="submit"
                              className="rounded border border-red-500/30 px-2 py-0.5 text-[9px] text-red-300"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <span className="text-[9px] text-zinc-600">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ScrollableTable>
    </div>
  );
}
