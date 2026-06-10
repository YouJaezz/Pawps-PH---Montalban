import { PayrollPanel } from "@/app/payroll/PayrollPanel";
import { AppShell } from "@/components/AppShell";
import { getPayrollDashboard } from "@/db/queries/payroll";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  await requireAdmin();
  const data = await getPayrollDashboard();

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Set hourly rates, lock monthly pay from attendance hours, and mark disbursements
          paid.
        </p>
        <div className="mt-6">
          <PayrollPanel
            employees={data.employees.map((e) => ({
              id: e.id,
              name: e.name,
              email: e.email,
              hourlyRateCents: e.hourlyRateCents,
              role: e.role,
            }))}
            rows={data.rows}
          />
        </div>
      </div>
    </AppShell>
  );
}
