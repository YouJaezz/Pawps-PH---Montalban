"use client";

import { useActionState, useEffect } from "react";

import {
  markPayrollPaid,
  type PayrollActionResult,
} from "@/app/payroll/actions";
import { EditModal, modalFieldClass } from "@/components/EditModal";
import { formatPhpFromCents } from "@/lib/money";
import { phDateInputValue } from "@/lib/payroll-payment";

type PaymentRow = {
  payoutId: number;
  employeeName: string;
  label: string;
  grossPayCents: number;
};

export function PayrollRecordPaymentModal(props: {
  row: PaymentRow | null;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<
    PayrollActionResult | null,
    FormData
  >(markPayrollPaid, null);

  useEffect(() => {
    if (state?.ok) {
      props.onClose();
    }
  }, [state?.ok, props.onClose]);

  const row = props.row;

  return (
    <EditModal
      open={row != null}
      onClose={props.onClose}
      title="Record payment"
      subtitle={row ? `${row.employeeName} · ${row.label}` : undefined}
    >
      {row ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="payoutId" value={row.payoutId} />

          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">
              Amount to record
            </div>
            <div className="mt-0.5 text-lg font-semibold text-brand-cyan/90">
              {formatPhpFromCents(row.grossPayCents)}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] text-zinc-400">Payment date</span>
            <input
              name="paidAt"
              type="date"
              required
              defaultValue={phDateInputValue()}
              className={modalFieldClass}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] text-zinc-400">Payment method</span>
            <select name="paymentMethod" required className={modalFieldClass}>
              <option value="">Select method…</option>
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="check">Check</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] text-zinc-400">
              Reference no. <span className="text-zinc-600">(optional)</span>
            </span>
            <input
              name="paymentReference"
              placeholder="GCash ref, check no., bank txn ID…"
              className={modalFieldClass}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] text-zinc-400">
              Notes <span className="text-zinc-600">(optional)</span>
            </span>
            <textarea
              name="notes"
              rows={2}
              placeholder="Partial pay, advance, remarks…"
              className={modalFieldClass}
            />
          </label>

          {state?.error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {state.error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand-cyan/90 px-3 py-2 text-xs font-semibold text-zinc-900 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Confirm payment recorded"}
          </button>
        </form>
      ) : null}
    </EditModal>
  );
}
