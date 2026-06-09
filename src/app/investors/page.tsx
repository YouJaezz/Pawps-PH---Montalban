import { InvestorDashboard } from "@/app/investors/InvestorDashboard";
import { AppShell } from "@/components/AppShell";
import { getInvestorDashboard } from "@/db/queries/investors";
import { requireAdmin } from "@/lib/auth-guard";

export default async function InvestorsPage(props: {
  searchParams: Promise<{ step?: string }>;
}) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  const data = await getInvestorDashboard();

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-400">Confidential · Admin only</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Investor relations
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Tracks your investor&apos;s {data.agreement?.sharePercent ?? 10}% share of
          monthly net income — connected automatically to Sales &amp; Orders and the
          Dashboard.
        </p>

        <div className="mt-6">
          <InvestorDashboard
            investor={data.primary}
            agreement={data.agreement}
            monthlyRows={data.monthlyRows}
            currentMetrics={data.currentMetrics}
            currentShareCents={data.currentShareCents}
            paidYtdCents={data.paidYtdCents}
            accruedUnpaidCents={data.accruedUnpaidCents}
            setupStep={data.setupStep}
            highlightAgreement={searchParams.step === "agreement"}
          />
        </div>
      </div>
    </AppShell>
  );
}
