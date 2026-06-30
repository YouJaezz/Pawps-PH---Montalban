import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { InvestorFundsPanel } from "@/app/investor-funds/InvestorFundsPanel";
import { getInvestorFundsDashboard } from "@/db/queries/investor-funds";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function InvestorFundsPage() {
  await requireAdmin();
  const data = await getInvestorFundsDashboard();

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <PageHeader
          eyebrow="Admin"
          title="Investor funds"
          description="Simple ledger for investor money in/out (contributions, leftovers returned to pool, and returns back to investor)."
        />

        <div className="mt-6">
          <InvestorFundsPanel
            allTime={data.allTime}
            thisMonth={data.thisMonth}
            entries={data.entries}
          />
        </div>
      </div>
    </AppShell>
  );
}

