import { NextRequest, NextResponse } from "next/server";

import {
  getPayrollAttendanceReport,
  resolvePayrollReportPeriod,
} from "@/db/queries/payroll-attendance";
import { requireAdmin } from "@/lib/auth-guard";
import { formatDuration } from "@/lib/time-duration";

function fmtPh(iso: Date | string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export async function GET(req: NextRequest) {
  await requireAdmin();

  const sp = req.nextUrl.searchParams;
  const { year, month } = resolvePayrollReportPeriod(
    sp.get("year") ?? undefined,
    sp.get("month") ?? undefined,
  );
  const report = await getPayrollAttendanceReport(year, month);

  const header = [
    "employee_code",
    "employee_name",
    "date",
    "time_in",
    "time_out",
    "duration",
    "status",
    "hourly_rate_php",
    "shift_gross_php",
  ];

  const lines = [header.join(",")];

  for (const p of [...report.punches].sort(
    (a, b) => a.clockInAt.getTime() - b.clockInAt.getTime(),
  )) {
    const emp = report.staffSummaries.find((s) => s.userId === p.userId);
    const rate = emp?.hourlyRateCents ?? 0;
    const shiftGross =
      p.minutes > 0 && rate > 0
        ? ((p.minutes * rate) / 60 / 100).toFixed(2)
        : "0.00";
    const cols = [
      p.employeeCode,
      JSON.stringify(p.employeeName),
      p.dateKey,
      JSON.stringify(fmtPh(p.clockInAt)),
      JSON.stringify(p.clockOutAt ? fmtPh(p.clockOutAt) : ""),
      JSON.stringify(formatDuration(p.minutes)),
      p.status,
      rate > 0 ? (rate / 100).toFixed(2) : "",
      shiftGross,
    ];
    lines.push(cols.join(","));
  }

  lines.push("");
  lines.push("SUMMARY");
  lines.push(
    [
      "employee_code",
      "employee_name",
      "total_hours",
      "shifts",
      "days_worked",
      "hourly_rate_php",
      "gross_pay_php",
    ].join(","),
  );
  for (const s of report.staffSummaries) {
    lines.push(
      [
        s.employeeCode,
        JSON.stringify(s.employeeName),
        JSON.stringify(formatDuration(s.minutesWorked)),
        s.shiftCount,
        s.daysWorked,
        s.hourlyRateCents > 0 ? (s.hourlyRateCents / 100).toFixed(2) : "",
        s.grossPayCents > 0 ? (s.grossPayCents / 100).toFixed(2) : "0.00",
      ].join(","),
    );
  }

  const csv = lines.join("\n");
  const filename = `attendance-${year}-${String(month).padStart(2, "0")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
