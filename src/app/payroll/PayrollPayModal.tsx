"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  submitPayrollPayment,
  type PayrollActionResult,
} from "@/app/payroll/actions";
import { EditModal, modalFieldClass } from "@/components/EditModal";
import { formatPhpFromCents } from "@/lib/money";
import { phDateInputValue } from "@/lib/payroll-payment";
import type { PayrollPayModalRow } from "@/lib/payroll-pay-modal";

export function PayrollPayModal(props: {
  row: PayrollPayModalRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    PayrollActionResult | null,
    FormData
  >(submitPayrollPayment, null);

  useEffect(() => {
    if (state?.ok) {
      props.onClose();
      router.refresh();
    }
  }, [state?.ok, props.onClose, router]);

  const row = props.row;
  const isLockAndPay = row?.kind === "lock_and_pay";

  return (
    <EditModal
      open={row != null}
      onClose={props.onClose}
      title="Pay employee"
      subtitle={row ? `${row.employeeName} · ${row.label}` : undefined}
    >
      {row ? (
        <form action={action} className="space-y-3">
          <input
            type="hidden"
            name="paymentMode"
            value={isLockAndPay ? "lock_and_pay" : "record"}
          />
          {row.kind === "record" ? (
            <input type="hidden" name="payoutId" value={row.payoutId} />
          ) : (
            <>
              <input type="hidden" name="userId" value={row.userId} />
              <input type="hidden" name="year" value={row.year} />
              <input type="hidden" name="month" value={row.month} />
              <input type="hidden" name="half" value={row.half} />
              <input type="hidden" name="periodDay" value={row.periodDay} />
            </>
          )}

          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">
              Amount to pay
            </div>
            <div className="mt-0.5 text-lg font-semibold text-brand-cyan/90">
              {formatPhpFromCents(row.grossPayCents)}
            </div>
            {isLockAndPay ? (
              <p className="mt-1 text-[10px] text-zinc-500">
                Locks this payroll period and records payment together.
              </p>
            ) : null}
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
            className="w-full rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-semibold text-zinc-900 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Confirm payment"}
          </button>
        </form>
      ) : null}
    </EditModal>
  );
}
