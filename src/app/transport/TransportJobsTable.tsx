"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CopyTrackingLink } from "@/app/transport/CopyTrackingLink";
import { deleteTransportJob } from "@/app/transport/delete-actions";
import { updateTransportStatus } from "@/app/transport/actions";
import { EditModal, modalFieldClass } from "@/components/EditModal";
import { TableToolbar } from "@/components/TableToolbar";
import { formatPhpFromCents } from "@/lib/money";
import { matchesQuery, rowSearchText } from "@/lib/table-filter";
import { tenthsToKm } from "@/lib/transport-pricing";

export type TransportJobRow = {
  id: number;
  customerName: string;
  contact: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  serviceType: string;
  status: string;
  fee: number;
  distanceKmTenths: number;
  trackingToken: string | null;
  receiptNumber: string | null;
};

const statuses = [
  "Requested",
  "Scheduled",
  "In Transit",
  "Completed",
  "Cancelled",
] as const;

export function TransportJobsTable(props: { rows: TransportJobRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editId, setEditId] = useState<number | null>(null);

  const editRow = props.rows.find((j) => j.id === editId) ?? null;

  const filtered = useMemo(() => {
    let list = props.rows;
    if (statusFilter !== "all") {
      list = list.filter((j) => j.status === statusFilter);
    }
    if (query.trim()) {
      list = list.filter((j) =>
        matchesQuery(
          rowSearchText([
            j.customerName,
            j.contact,
            j.pickupLocation,
            j.dropoffLocation,
            j.serviceType,
            j.status,
            j.receiptNumber,
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
        placeholder="Search customer, location, receipt…"
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
          <p className="text-sm text-zinc-500">No transport jobs yet.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-zinc-500">No jobs match your search or filters.</p>
        ) : (
          filtered.map((j) => (
            <div
              key={j.id}
              className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-zinc-50">{j.customerName}</div>
                  <div className="text-xs text-zinc-400">
                    {j.pickupLocation} → {j.dropoffLocation}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {j.serviceType} · {tenthsToKm(j.distanceKmTenths)} km ·{" "}
                    {formatPhpFromCents(j.fee)} · {j.status}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditId(j.id)}
                  className="text-[10px] text-brand-blue underline"
                >
                  Edit
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                <Link
                  href={`/transport/driver/${j.id}`}
                  className="rounded border border-sky-500/30 px-2 py-0.5 text-sky-200"
                >
                  Driver mode
                </Link>
                {j.receiptNumber ? (
                  <Link
                    href={`/transport/receipt/${j.id}`}
                    className="rounded border border-white/10 px-2 py-0.5 text-zinc-300"
                  >
                    Receipt
                  </Link>
                ) : null}
                {j.trackingToken ? (
                  <>
                    <CopyTrackingLink token={j.trackingToken} />
                    <Link
                      href={`/track/${j.trackingToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-white/10 px-2 py-0.5 text-zinc-300"
                    >
                      Preview
                    </Link>
                  </>
                ) : null}
                <form action={deleteTransportJob}>
                  <input type="hidden" name="id" value={j.id} />
                  <button type="submit" className="text-red-400/80 hover:text-red-300">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      <EditModal
        open={editRow != null}
        onClose={() => setEditId(null)}
        title="Edit transport job"
        subtitle={editRow?.customerName}
      >
        {editRow ? (
          <form action={updateTransportStatus} className="space-y-3">
            <input type="hidden" name="id" value={editRow.id} />
            <label className="block space-y-1">
              <span className="text-[11px] text-zinc-400">Status</span>
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
            <button
              type="submit"
              className="rounded-lg bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900"
            >
              Save status
            </button>
          </form>
        ) : null}
      </EditModal>
    </div>
  );
}
