import { InvestorDashboard } from "@/app/investors/InvestorDashboard";
import { AppShell } from "@/components/AppShell";
import { getInvestorDashboard } from "@/db/queries/investors";
import { requireAdmin } from "@/lib/auth-guard";

export default async function InvestorsPage() {
  await requireAdmin();
  const data = await getInvestorDashboard();

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-400">Confidential · Admin only</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Investor relations
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Track capital contributions, profit-sharing agreements, and monthly
          investor payouts based on net income from paid sales.
        </p>

        <div className="mt-6">
          <InvestorDashboard
            investor={data.primary}
            agreement={data.agreement}
            monthlyRows={data.monthlyRows}
            currentMetrics={data.currentMetrics}
            currentShareCents={data.currentShareCents}
            paidYtdCents={data.paidYtdCents}
          />
        </div>
      </div>
    </AppShell>
  );
}
