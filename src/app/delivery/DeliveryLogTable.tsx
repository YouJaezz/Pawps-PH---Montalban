"use client";

import { useMemo, useState } from "react";

import { deleteDeliveryLog } from "@/app/delivery/delete-actions";
import { updateDeliveryLog } from "@/app/delivery/update-actions";
import { EditModal, modalFieldClass } from "@/components/EditModal";
import { TableToolbar } from "@/components/TableToolbar";
import { formatPhpFromCents } from "@/lib/money";
import { matchesQuery, rowSearchText } from "@/lib/table-filter";

export type DeliveryLogRow = {
  id: number;
  orderId: number | null;
  customerName: string | null;
  location: string | null;
  deliveryMethod: string;
  status: string;
  fee: number;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
  history: {
    id: number;
    previousStatus: string | null;
    newStatus: string;
    note: string | null;
    changedAt: Date;
  }[];
};

const statuses = [
  "Queued",
  "Booked",
  "Picked Up",
  "Delivered",
  "Cancelled",
] as const;

export function DeliveryLogTable(props: { rows: DeliveryLogRow[] }) {
  const [editId, setEditId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const editRow = props.rows.find((d) => d.id === editId) ?? null;

  const filtered = useMemo(() => {
    let list = props.rows;
    if (statusFilter !== "all") {
      list = list.filter((d) => d.status === statusFilter);
    }
    if (query.trim()) {
      list = list.filter((d) =>
        matchesQuery(
          rowSearchText([
            d.customerName,
            d.location,
            d.deliveryMethod,
            d.status,
            d.reference,
            d.notes,
            d.orderId,
          ]),
          query,
        ),
      );
    }
    return list;
  }, [props.rows, query, statusFilter]);

  return (
    <div>
      <TableToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search customer, location, order #…"
        shown={filtered.length}
        total={props.rows.length}
        filters={[
          {
            id: "status",
            value: statusFilter,
            onChange: setStatusFilter,
            "aria-label": "Filter by status",
            options: [
              { value: "all", label: "All statuses" },
              ...statuses.map((s) => ({ value: s, label: s })),
            ],
          },
        ]}
      />

      <div className="space-y-2">
        {props.rows.length === 0 ? (
          <p className="text-sm text-zinc-500">No delivery logs yet.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-zinc-500">No logs match your search or filters.</p>
        ) : (
          filtered.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-zinc-50">
                    {d.customerName ?? "—"}
                    {d.orderId ? (
                      <span className="ml-2 text-xs text-zinc-500">#{d.orderId}</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {d.location ?? "—"} · {d.deliveryMethod}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditId(d.id)}
                  className="text-[10px] text-brand-blue underline hover:text-brand-blue"
                >
                  Edit
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-300">
                <span>{d.status}</span>
                <span>{formatPhpFromCents(d.fee)}</span>
                {d.reference ? <span>{d.reference}</span> : null}
              </div>
            </div>
          ))
        )}
      </div>

      <EditModal
        open={editRow != null}
        onClose={() => setEditId(null)}
        title="Edit delivery log"
        subtitle={editRow?.customerName ?? undefined}
        maxWidth="lg"
      >
        {editRow ? (
          <>
            <form action={updateDeliveryLog} className="space-y-2">
              <input type="hidden" name="id" value={editRow.id} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="space-y-0.5">
                  <span className="text-[10px] text-zinc-500">Status</span>
                  <select
                    name="status"
                    defaultValue={editRow.status}
                    className={modalFieldClass}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-0.5">
                  <span className="text-[10px] text-zinc-500">Fee (₱)</span>
                  <input
                    name="fee"
                    defaultValue={(editRow.fee / 100).toFixed(2)}
                    className={modalFieldClass}
                  />
                </label>
                <label className="col-span-2 space-y-0.5">
                  <span className="text-[10px] text-zinc-500">Reference</span>
                  <input
                    name="reference"
                    defaultValue={editRow.reference ?? ""}
                    className={modalFieldClass}
                  />
                </label>
                <label className="col-span-2 space-y-0.5">
                  <span className="text-[10px] text-zinc-500">Notes</span>
                  <input
                    name="notes"
                    defaultValue={editRow.notes ?? ""}
                    className={modalFieldClass}
                  />
                </label>
                <label className="col-span-2 space-y-0.5">
                  <span className="text-[10px] text-zinc-500">Status change note</span>
                  <input
                    name="historyNote"
                    placeholder="e.g. Lalamove rider picked up"
                    className={modalFieldClass}
                  />
                </label>
              </div>
              <button
                type="submit"
                className="rounded-lg bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900"
              >
                Save changes
              </button>
            </form>

            {editRow.history.length > 0 ? (
              <ul className="mt-4 space-y-1 border-t border-white/10 pt-3 text-[10px] text-zinc-500">
                {editRow.history.map((h) => (
                  <li key={h.id}>
                    {h.previousStatus ?? "—"} → {h.newStatus}
                    {h.note ? ` · ${h.note}` : ""}
                    {" · "}
                    {new Date(h.changedAt).toLocaleString("en-PH")}
                  </li>
                ))}
              </ul>
            ) : null}

            <form action={deleteDeliveryLog} className="mt-4 border-t border-white/10 pt-3">
              <input type="hidden" name="id" value={editRow.id} />
              <button type="submit" className="text-[10px] text-red-400/80 hover:text-red-300">
                Delete log
              </button>
            </form>
          </>
        ) : null}
      </EditModal>
    </div>
  );
}
