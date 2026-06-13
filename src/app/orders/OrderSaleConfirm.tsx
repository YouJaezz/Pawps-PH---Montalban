"use client";

import { formatPhpFromCents } from "@/lib/money";

export function OrderSaleConfirm(props: {
  title: string;
  customerName: string;
  contact?: string;
  location?: string;
  subtotalCents?: number;
  discountCents?: number;
  discountNote?: string | null;
  totalLabel: string;
  totalCents: number;
  paidLabel?: string;
  paidCents?: number;
  itemSummary: string;
  extraNotes?: string[];
  onBack: () => void;
  onConfirm: () => void;
  pending?: boolean;
  confirmLabel?: string;
}) {
  return (
    <div className="space-y-4 overflow-y-auto p-6">
      <div>
        <div className="text-sm font-medium text-zinc-800">{props.title}</div>
        <div className="mt-1 text-xs text-zinc-600">
          Review the details below. The order will appear as{" "}
          <span className="text-zinc-700">Pending</span> until staff marks it
          complete.
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
        Confirm before creating this order. You can print the receipt right after.
      </div>

      <dl className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-600">Customer</dt>
          <dd className="text-right font-medium text-zinc-800">
            {props.customerName}
          </dd>
        </div>
        {props.contact ? (
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-600">Contact</dt>
            <dd className="text-right text-zinc-800">{props.contact}</dd>
          </div>
        ) : null}
        {props.location ? (
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-600">Location</dt>
            <dd className="text-right text-zinc-800">{props.location}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-600">Items</dt>
          <dd className="max-w-[60%] text-right text-zinc-800">
            {props.itemSummary}
          </dd>
        </div>
        {props.subtotalCents != null &&
        props.discountCents != null &&
        props.discountCents > 0 ? (
          <>
            <div className="flex justify-between gap-3 border-t border-zinc-200 pt-2">
              <dt className="text-zinc-600">Subtotal</dt>
              <dd className="text-zinc-800">
                {formatPhpFromCents(props.subtotalCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-600">
                Discount
                {props.discountNote ? (
                  <span className="block text-[10px] text-zinc-600">
                    {props.discountNote}
                  </span>
                ) : null}
              </dt>
              <dd className="text-amber-200">
                −{formatPhpFromCents(props.discountCents)}
              </dd>
            </div>
          </>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-zinc-200 pt-2">
          <dt className="text-zinc-600">{props.totalLabel}</dt>
          <dd className="font-semibold text-zinc-900">
            {formatPhpFromCents(props.totalCents)}
          </dd>
        </div>
        {props.paidLabel && props.paidCents != null ? (
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-600">{props.paidLabel}</dt>
            <dd className="font-semibold text-brand-cyan/70">
              {formatPhpFromCents(props.paidCents)}
            </dd>
          </div>
        ) : null}
      </dl>

      {props.extraNotes?.map((note) => (
        <div key={note} className="text-[11px] text-zinc-600">
          {note}
        </div>
      ))}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={props.onBack}
          disabled={props.pending}
          className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          Go back
        </button>
        <button
          type="button"
          onClick={props.onConfirm}
          disabled={props.pending}
          className="flex-1 rounded-xl bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          {props.pending
            ? "Creating…"
            : (props.confirmLabel ?? "Yes, create order")}
        </button>
      </div>
    </div>
  );
}
