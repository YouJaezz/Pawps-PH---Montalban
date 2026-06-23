"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { PrintButton } from "@/components/PrintButton";
import { BRAND_TAGLINE } from "@/lib/brand";
import type { PayrollSlipData } from "@/lib/payroll-slip";
import {
  formatDurationLong,
  formatDurationTable,
  splitDaySummariesForPrint,
  type PayrollSlipDaySummary,
} from "@/lib/payroll-slip-format";
import { formatPhpFromCents } from "@/lib/money";
import { formatOrderWhenLong } from "@/lib/order-timestamp";

function DaySummaryTable(props: {
  rows: PayrollSlipDaySummary[];
  hourlyRateCents: number;
}) {
  if (props.rows.length === 0) return null;

  const rateLabel =
    props.hourlyRateCents > 0
      ? `${formatPhpFromCents(props.hourlyRateCents)}/hr`
      : "—";

  return (
    <table className="payroll-slip-days-table w-full border-collapse">
      <thead>
        <tr className="border-b border-zinc-300 text-left text-zinc-600">
          <th className="py-0.5 pr-1 font-semibold">Day</th>
          <th className="py-0.5 pr-1 font-semibold">Time in / out</th>
          <th className="py-0.5 pr-1 text-right font-semibold">Hrs</th>
          <th className="py-0.5 text-right font-semibold">Day pay</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((day) => (
          <tr key={day.dateKey} className="border-b border-zinc-100 align-top">
            <td className="whitespace-nowrap py-0.5 pr-1 font-medium">
              {day.weekday} {day.dayLabel}
              {day.shiftCount > 1 ? (
                <span className="ml-0.5 font-normal text-zinc-500">
                  ×{day.shiftCount}
                </span>
              ) : null}
            </td>
            <td className="py-0.5 pr-1 leading-tight text-zinc-700">
              {day.scheduleCompact}
            </td>
            <td className="whitespace-nowrap py-0.5 pr-1 text-right font-medium">
              {formatDurationTable(day.totalMinutes)}
            </td>
            <td className="whitespace-nowrap py-0.5 text-right leading-tight">
              {props.hourlyRateCents > 0 && day.totalMinutes > 0 ? (
                <>
                  <span className="text-[10px] text-zinc-500 print:text-[7pt]">
                    {formatDurationTable(day.totalMinutes)} × {rateLabel}
                  </span>
                  <div className="font-semibold">
                    = {formatPhpFromCents(day.dayPayCents)}
                  </div>
                </>
              ) : (
                "—"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PayrollSlipView(props: { slip: PayrollSlipData }) {
  const { slip } = props;
  const [leftDays, rightDays] = splitDaySummariesForPrint(slip.daySummaries);
  const dayPayTotalCents = slip.daySummaries.reduce(
    (sum, day) => sum + day.dayPayCents,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <PrintButton label="Print payroll slip" />
      </div>

      <div
        id="payroll-slip"
        className="payroll-slip-print rounded-2xl border border-white/10 bg-white p-5 text-zinc-900 print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" className="max-w-[88px] print:max-w-[72px]" />
            <div>
              <div className="text-[10px] text-zinc-500 print:text-[8pt]">
                {BRAND_TAGLINE}
              </div>
              <div className="text-sm font-semibold uppercase tracking-wide print:text-[10pt]">
                Payroll slip
              </div>
            </div>
          </div>
          <div className="text-right text-[10px] text-zinc-500 print:text-[8pt]">
            <div>{slip.employeeCode}</div>
            <div className="font-medium text-zinc-700">{slip.periodLabel}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs print:grid-cols-3 print:text-[8.5pt]">
          <div>
            <span className="text-zinc-500">Employee</span>
            <div className="font-semibold">{slip.employeeName}</div>
          </div>
          <div>
            <span className="text-zinc-500">Total hours</span>
            <div className="font-semibold">{formatDurationLong(slip.minutesWorked)}</div>
          </div>
          <div>
            <span className="text-zinc-500">Days / shifts</span>
            <div>
              {slip.daysWorked} day(s) · {slip.shiftCount} shift(s)
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Hourly rate</span>
            <div>
              {slip.hourlyRateCents > 0
                ? `${formatPhpFromCents(slip.hourlyRateCents)}/hr`
                : "—"}
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Gross pay</span>
            <div className="text-sm font-bold print:text-[10pt]">
              {formatPhpFromCents(slip.grossPayCents)}
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Status</span>
            <div>
              {slip.status}
              {slip.paidAt ? (
                <span className="block text-[10px] text-zinc-500 print:text-[7.5pt]">
                  {formatOrderWhenLong(slip.paidAt)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {slip.daySummaries.length > 0 ? (
          <div className="mt-3 border-t border-zinc-200 pt-2">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 print:text-[7.5pt]">
                Daily attendance
              </div>
              <div className="text-[10px] text-zinc-500 print:text-[7.5pt]">
                One row per day · all punches combined
              </div>
            </div>

            {rightDays.length > 0 ? (
              <div className="payroll-slip-days-cols grid grid-cols-1 gap-x-4 print:grid-cols-2">
                <DaySummaryTable rows={leftDays} hourlyRateCents={slip.hourlyRateCents} />
                <DaySummaryTable rows={rightDays} hourlyRateCents={slip.hourlyRateCents} />
              </div>
            ) : (
              <DaySummaryTable rows={leftDays} hourlyRateCents={slip.hourlyRateCents} />
            )}

            <div className="mt-1 flex flex-wrap items-baseline justify-end gap-x-4 gap-y-0.5 border-t border-zinc-200 pt-1 text-[10px] print:text-[8pt]">
              <span>
                <span className="text-zinc-500">Period hours&nbsp;</span>
                <span className="font-bold">{formatDurationLong(slip.minutesWorked)}</span>
              </span>
              {slip.hourlyRateCents > 0 ? (
                <span>
                  <span className="text-zinc-500">From daily rows&nbsp;</span>
                  <span className="font-bold">{formatPhpFromCents(dayPayTotalCents)}</span>
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-6 border-t border-dashed border-zinc-300 pt-3 text-[10px] text-zinc-600 print:mt-3 print:text-[8pt]">
          <div>
            <div className="border-t border-zinc-400 pt-1">Employee signature</div>
          </div>
          <div>
            <div className="border-t border-zinc-400 pt-1">Authorized by</div>
          </div>
        </div>

        <div className="mt-2 text-center text-[9px] text-zinc-400 print:text-[7pt]">
          Pawps PH · Time In/Out payroll record
        </div>
      </div>
    </div>
  );
}
