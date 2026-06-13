"use client";

import { useMemo } from "react";

import {
  computeDiscountCents,
  type DiscountType,
} from "@/lib/order-discount";
import { formatPhpFromCents } from "@/lib/money";

const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-300";

export function OrderDiscountFields(props: {
  subtotalCents: number;
  discountType: DiscountType;
  discountValue: string;
  discountNote: string;
  onTypeChange: (type: DiscountType) => void;
  onValueChange: (value: string) => void;
  onNoteChange: (note: string) => void;
}) {
  const discountCents = useMemo(() => {
    if (props.discountType === "None") return 0;
    const n = Number(props.discountValue.trim());
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (props.discountType === "Fixed") {
      return computeDiscountCents(props.subtotalCents, {
        type: "Fixed",
        value: Math.round(n * 100),
      });
    }
    return computeDiscountCents(props.subtotalCents, {
      type: "Percent",
      value: Math.min(100, Math.round(n)),
    });
  }, [props.subtotalCents, props.discountType, props.discountValue]);

  const netTotal = Math.max(0, props.subtotalCents - discountCents);

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white/[0.03] p-3">
      <div>
        <div className="text-xs font-medium text-zinc-800">Discount (optional)</div>
        <p className="mt-0.5 text-[10px] text-zinc-600">
          Applied to the order subtotal before payment. Shown on receipt for audit.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="text-[10px] text-zinc-600">Type</span>
          <select
            name="discountType"
            value={props.discountType}
            onChange={(e) =>
              props.onTypeChange(e.target.value as DiscountType)
            }
            className={fieldClass}
          >
            <option value="None">No discount</option>
            <option value="Fixed">Fixed amount (₱)</option>
            <option value="Percent">Percent (%)</option>
          </select>
        </label>

        {props.discountType !== "None" ? (
          <label className="space-y-1">
            <span className="text-[10px] text-zinc-600">
              {props.discountType === "Fixed" ? "Amount (₱)" : "Percent (%)"}
            </span>
            <input
              name="discountValue"
              inputMode="decimal"
              value={props.discountValue}
              onChange={(e) => props.onValueChange(e.target.value)}
              placeholder={props.discountType === "Fixed" ? "50" : "10"}
              className={fieldClass}
            />
          </label>
        ) : (
          <input type="hidden" name="discountValue" value="" />
        )}

        {props.discountType !== "None" ? (
          <label className="space-y-1 sm:col-span-1">
            <span className="text-[10px] text-zinc-600">Reason (optional)</span>
            <input
              name="discountNote"
              value={props.discountNote}
              onChange={(e) => props.onNoteChange(e.target.value)}
              placeholder="Senior, bulk, promo…"
              className={fieldClass}
            />
          </label>
        ) : (
          <input type="hidden" name="discountNote" value="" />
        )}
      </div>

      <dl className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px]">
        <div className="flex justify-between gap-2 text-zinc-600">
          <dt>Subtotal</dt>
          <dd>{formatPhpFromCents(props.subtotalCents)}</dd>
        </div>
        {discountCents > 0 ? (
          <div className="flex justify-between gap-2 text-amber-200">
            <dt>Discount</dt>
            <dd>−{formatPhpFromCents(discountCents)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2 border-t border-zinc-200 pt-1 font-semibold text-zinc-800">
          <dt>Total due</dt>
          <dd>{formatPhpFromCents(netTotal)}</dd>
        </div>
      </dl>
    </div>
  );
}
