import { PayrollAttendanceReport } from "@/app/payroll/PayrollAttendanceReport";
import { PayrollWorkspace } from "@/app/payroll/PayrollWorkspace";
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
          description="Pay employees, track hours from Time In/Out, and print payroll slips."
        />

        <div className="mt-6 space-y-6">
          <PayrollWorkspace
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
            paymentSummary={data.paymentSummary}
            reportYear={year}
            reportMonth={month}
          />

          <PayrollAttendanceReport report={attendanceReport} />
        </div>
      </div>
    </AppShell>
  );
}
