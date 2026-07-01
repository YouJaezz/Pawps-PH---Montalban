import { PayrollAttendanceReport } from "@/app/payroll/PayrollAttendanceReport";
import { OwnerProfitSplitPanel } from "@/app/payroll/OwnerProfitSplitPanel";
import { PayrollWorkspace } from "@/app/payroll/PayrollWorkspace";
import { InvestorsPanel } from "@/app/investors/InvestorsPanel";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs } from "@/components/SectionTabs";
import { getOwnerProfitSplitDashboard } from "@/db/queries/owner-profit-split";
import {
  getPayrollAttendanceReport,
  resolvePayrollReportPeriod,
} from "@/db/queries/payroll-attendance";
import { getPayrollDashboard } from "@/db/queries/payroll";
import { requireAdmin } from "@/lib/auth-guard";
import { payrollHref, payrollInvestorsHref } from "@/lib/nav-urls";
import { normalizePaySchedule } from "@/lib/payroll-period";

export const dynamic = "force-dynamic";

export default async function PayrollPage(props: {
  searchParams: Promise<{ tab?: string; year?: string; month?: string; step?: string }>;
}) {
  await requireAdmin();
  const sp = await props.searchParams;
  const activeTab = sp.tab === "investors" ? "investors" : "payroll";
  const { year, month } = resolvePayrollReportPeriod(sp.year, sp.month);

  let data = null;
  let attendanceReport = null;
  let profitSplit = null;

  if (activeTab === "payroll") {
    const [dashboard, report] = await Promise.all([
      getPayrollDashboard(),
      getPayrollAttendanceReport(year, month),
    ]);
    data = dashboard;
    attendanceReport = report;
    try {
      profitSplit = await getOwnerProfitSplitDashboard({
        semiMonthlyRows: dashboard.semiMonthlyRows,
        dailyRows: dashboard.dailyRows,
        employees: dashboard.employees.map((e) => ({
          id: e.id,
          role: e.role,
        })),
      });
    } catch (err) {
      console.error("Owner profit split unavailable:", err);
    }
  }

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <PageHeader
          eyebrow="Admin"
          title={activeTab === "investors" ? "Investors" : "Payroll"}
          description={
            activeTab === "investors"
              ? "Confidential investor share of net income and agreements."
              : "Pay employees, split wages between owner wallets and shop cash, and print payroll slips."
          }
        />

        <div className="mt-4">
          <SectionTabs
            activeTab={activeTab}
            tabs={[
              { id: "payroll", label: "Payroll", href: payrollHref },
              {
                id: "investors",
                label: "Investors",
                href: payrollInvestorsHref,
                hint: "confidential",
              },
            ]}
          />
        </div>

        <div className="mt-6 space-y-6">
          {activeTab === "investors" ? (
            <InvestorsPanel highlightAgreement={sp.step === "agreement"} />
          ) : data && attendanceReport ? (
            <>
              {profitSplit ? (
                <OwnerProfitSplitPanel dashboard={profitSplit} />
              ) : null}
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
            </>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
