"use client";

import Link from "next/link";

import { PrintReceiptButton } from "@/components/PrintReceiptButton";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_TAGLINE } from "@/lib/brand";
import { formatPhpFromCents } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import type { OrderReceiptData } from "@/lib/order-receipt";
import { formatOrderWhenLong } from "@/lib/order-timestamp";

function formatWhen(iso: string) {
  return formatOrderWhenLong(iso);
}

export function OrderReceiptView(props: {
  receipt: OrderReceiptData;
  showActions?: boolean;
  compact?: boolean;
}) {
  const { receipt, showActions = true, compact = false } = props;
  const balanceDue = Math.max(0, receipt.totalAmount - receipt.amountPaid);

  return (
    <div className={compact ? "" : "space-y-4"}>
      {showActions ? (
        <div className="flex flex-wrap gap-2 print:hidden">
          <PrintReceiptButton />
          <Link
            href={`/orders/receipt/${receipt.orderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-200 hover:bg-white/5"
          >
            Open full receipt
          </Link>
        </div>
      ) : null}

      <div
        id="order-receipt"
        className="rounded-2xl border border-white/10 bg-white p-6 text-zinc-900 print:border-0 print:shadow-none"
      >
        <div className="text-center">
          <div className="flex justify-center">
            <BrandLogo size="sm" className="max-w-[110px]" />
          </div>
          <div className="mt-1 text-xs text-zinc-600">{BRAND_TAGLINE}</div>
          <div className="mt-2 text-sm font-medium">Sales Receipt</div>
          <div className="text-xs text-zinc-500">Order #{receipt.orderId}</div>
        </div>

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Customer</dt>
            <dd className="text-right font-medium">{receipt.customerName}</dd>
          </div>
          {receipt.contact ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Contact</dt>
              <dd className="text-right">{receipt.contact}</dd>
            </div>
          ) : null}
          {receipt.location ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Location</dt>
              <dd className="text-right">{receipt.location}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Store</dt>
            <dd>{receipt.storeType}</dd>
          </div>
          {receipt.cashierName ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Cashier</dt>
              <dd className="text-right font-medium">{receipt.cashierName}</dd>
            </div>
          ) : null}
          {receipt.deliveryMethod ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Delivery</dt>
              <dd>{receipt.deliveryMethod}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Status</dt>
            <dd>
              {ORDER_STATUS_LABELS[
                receipt.orderStatus as keyof typeof ORDER_STATUS_LABELS
              ] ?? receipt.orderStatus}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-zinc-200 pt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Items
          </div>
          <ul className="space-y-2 text-sm">
            {receipt.lines.map((line, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">
                    {line.label}
                    {line.isExcessSale ? (
                      <span className="ml-1 text-[10px] font-normal text-brand-blue">
                        excess
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-zinc-600">
                    {line.qtyLabel}
                    {line.isExcessSale ? null : (
                      <>
                        {" "}
                        · {line.priceTier} · {formatPhpFromCents(line.unitPrice)} ea
                      </>
                    )}
                  </div>
                  {line.lineNote ? (
                    <div className="mt-1 text-[10px] text-zinc-500">{line.lineNote}</div>
                  ) : null}
                </div>
                <div className="shrink-0 font-medium">
                  {formatPhpFromCents(line.lineTotal)}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 space-y-1 border-t border-zinc-200 pt-4 text-sm">
          {receipt.discountCents != null && receipt.discountCents > 0 ? (
            <>
              <div className="flex justify-between">
                <span className="text-zinc-600">Subtotal</span>
                <span>{formatPhpFromCents(receipt.subtotalCents ?? receipt.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-amber-800">
                <span>
                  Discount
                  {receipt.discountNote ? (
                    <span className="block text-[10px] font-normal text-zinc-500">
                      {receipt.discountNote}
                    </span>
                  ) : null}
                </span>
                <span>−{formatPhpFromCents(receipt.discountCents)}</span>
              </div>
            </>
          ) : null}
          <div className="flex justify-between font-medium">
            <span className="text-zinc-600">Total</span>
            <span>{formatPhpFromCents(receipt.totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Paid</span>
            <span>{formatPhpFromCents(receipt.amountPaid)}</span>
          </div>
          {balanceDue > 0 ? (
            <div className="flex justify-between font-medium">
              <span>Balance due</span>
              <span>{formatPhpFromCents(balanceDue)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-xs text-zinc-600">
            <span>Payment status</span>
            <span>{receipt.paymentStatus}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-zinc-300 pt-2 text-base font-bold">
            <span>Amount received</span>
            <span>{formatPhpFromCents(receipt.amountPaid)}</span>
          </div>
        </div>

        <div className="mt-5 text-center text-[10px] text-zinc-500">
          {formatWhen(receipt.createdAt)}
        </div>
      </div>
    </div>
  );
}
