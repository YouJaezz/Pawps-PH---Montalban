"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { PrintButton } from "@/components/PrintButton";
import { BRAND_TAGLINE } from "@/lib/brand";
import type { PayrollSlipData } from "@/lib/payroll-slip";
import { formatPhpFromCents } from "@/lib/money";
import { formatDuration } from "@/lib/time-duration";
import { formatOrderWhenLong } from "@/lib/order-timestamp";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function PayrollSlipView(props: { slip: PayrollSlipData }) {
  const { slip } = props;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <PrintButton label="Print payroll slip" />
      </div>

      <div
        id="payroll-slip"
        className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 print:border-0 print:shadow-none"
      >
        <div className="flex flex-col items-center text-center">
          <BrandLogo size="sm" className="max-w-[120px]" />
          <div className="mt-1 text-xs text-zinc-600">{BRAND_TAGLINE}</div>
          <div className="mt-3 text-sm font-semibold uppercase tracking-wide">
            Employee payroll slip
          </div>
          <div className="text-xs text-zinc-600">
            {slip.employeeCode} · {slip.periodLabel}
          </div>
        </div>

        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-zinc-100 pb-2">
            <dt className="text-zinc-600">Employee</dt>
            <dd className="text-right font-medium">{slip.employeeName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Pay period</dt>
            <dd>{slip.periodLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Total hours</dt>
            <dd className="font-medium">{formatDuration(slip.minutesWorked)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Shifts / days</dt>
            <dd>
              {slip.shiftCount} shift(s) · {slip.daysWorked} day(s)
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Hourly rate</dt>
            <dd>
              {slip.hourlyRateCents > 0
                ? `${formatPhpFromCents(slip.hourlyRateCents)}/hr`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-zinc-200 pt-2 text-base">
            <dt className="font-medium text-zinc-700">Gross pay</dt>
            <dd className="font-bold">{formatPhpFromCents(slip.grossPayCents)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Status</dt>
            <dd>
              {slip.status}
              {slip.paidAt ? ` · ${formatOrderWhenLong(slip.paidAt)}` : ""}
            </dd>
          </div>
        </dl>

        {slip.punches.length > 0 ? (
          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Time in / out
            </div>
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">In</th>
                  <th className="py-1 pr-2">Out</th>
                  <th className="py-1 text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {slip.punches.map((p, i) => (
                  <tr key={`${p.dateKey}-${i}`} className="border-b border-zinc-100">
                    <td className="py-1 pr-2">{p.dateKey}</td>
                    <td className="py-1 pr-2">{fmtTime(p.clockIn)}</td>
                    <td className="py-1 pr-2">
                      {p.clockOut ? fmtTime(p.clockOut) : "—"}
                    </td>
                    <td className="py-1 text-right">
                      {p.minutes > 0 ? formatDuration(p.minutes) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-8 border-t border-dashed border-zinc-300 pt-4 text-center text-[10px] text-zinc-600">
          Generated from Pawps PH Time In/Out · For internal payroll records
        </div>
        <div className="mt-6 grid grid-cols-2 gap-8 text-xs text-zinc-600">
          <div>
            <div className="border-t border-zinc-400 pt-1">Employee signature</div>
          </div>
          <div>
            <div className="border-t border-zinc-400 pt-1">Authorized by</div>
          </div>
        </div>
      </div>
    </div>
  );
}
