import { PayrollAttendanceReport } from "@/app/payroll/PayrollAttendanceReport";
import { PayrollPanel } from "@/app/payroll/PayrollPanel";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import {
  getPayrollAttendanceReport,
  resolvePayrollReportPeriod,
} from "@/db/queries/payroll-attendance";
import { getPayrollDashboard } from "@/db/queries/payroll";
import { requireAdmin } from "@/lib/auth-guard";
import { normalizePaySchedule } from "@/lib/payroll-period";

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
        <PageHeader
          eyebrow="Admin"
          title="Payroll"
          description="Staff hours from Time In/Out, hourly rates, per-employee pay schedule (daily or semi-monthly), printable slips, and disbursement."
        />

        <div className="mt-6 space-y-6">
          <PayrollAttendanceReport report={attendanceReport} />

          <PayrollPanel
            employees={data.employees.map((e) => ({
              id: e.id,
              name: e.name,
              email: e.email,
              hourlyRateCents: e.hourlyRateCents,
              paySchedule: normalizePaySchedule(e.paySchedule),
              role: e.role,
            }))}
            semiMonthlyRows={data.semiMonthlyRows}
            dailyRows={data.dailyRows}
            reportYear={year}
            reportMonth={month}
          />
        </div>
      </div>
    </AppShell>
  );
}
