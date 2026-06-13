import { PayrollAttendanceReport } from "@/app/payroll/PayrollAttendanceReport";
import { PayrollPanel } from "@/app/payroll/PayrollPanel";
import { AppShell } from "@/components/AppShell";
import {
  getPayrollAttendanceReport,
  resolvePayrollReportPeriod,
} from "@/db/queries/payroll-attendance";
import { getPayrollDashboard } from "@/db/queries/payroll";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function PayrollPage(props: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await requireAdmin();
  const sp = await props.searchParams;
  const { year, month } = resolvePayrollReportPeriod(sp.year, sp.month);

  const [data, attendanceReport] = await Promise.all([
    getPayrollDashboard(),
    getPayrollAttendanceReport(year, month),
  ]);

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Staff Time In/Out hours, attendance reports, hourly rates, and monthly pay
          disbursement.
        </p>

        <div className="mt-6 space-y-6">
          <PayrollAttendanceReport report={attendanceReport} />

          <PayrollPanel
            employees={data.employees.map((e) => ({
              id: e.id,
              name: e.name,
              email: e.email,
              hourlyRateCents: e.hourlyRateCents,
              role: e.role,
            }))}
            rows={data.rows}
            reportYear={year}
            reportMonth={month}
          />
        </div>
      </div>
    </AppShell>
  );
}
