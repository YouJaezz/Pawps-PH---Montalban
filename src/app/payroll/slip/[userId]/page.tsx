import { notFound } from "next/navigation";

import { PayrollSlipView } from "@/app/payroll/PayrollSlipView";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { getPayrollSlipData } from "@/db/queries/payroll";
import { requireAdmin } from "@/lib/auth-guard";
import { resolvePayrollReportPeriod } from "@/db/queries/payroll-attendance";

export const dynamic = "force-dynamic";

export default async function PayrollSlipPage(props: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await requireAdmin();
  const { userId: userIdRaw } = await props.params;
  const sp = await props.searchParams;
  const userId = Number(userIdRaw);
  if (!Number.isFinite(userId) || userId <= 0) notFound();

  const { year, month } = resolvePayrollReportPeriod(sp.year, sp.month);
  const slip = await getPayrollSlipData(userId, year, month);
  if (!slip) notFound();

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-0 py-4 print:max-w-none print:py-0">
        <div className="print:hidden">
          <PageHeader
            eyebrow="Payroll"
            title="Printable slip"
            description={`${slip.employeeName} · ${slip.periodLabel}`}
          />
        </div>
        <div className="mt-4 print:mt-0">
          <PayrollSlipView slip={slip} />
        </div>
      </div>
    </AppShell>
  );
}
