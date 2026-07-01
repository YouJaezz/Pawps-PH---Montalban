import { InvestorDashboard } from "@/app/investors/InvestorDashboard";
import { getInvestorDashboard } from "@/db/queries/investors";

export async function InvestorsPanel(props: { highlightAgreement?: boolean }) {
  const data = await getInvestorDashboard();

  return (
    <>
      <p className="mb-4 max-w-2xl text-sm text-zinc-400">
        Tracks your investor&apos;s {data.agreement?.sharePercent ?? 10}% share of monthly
        net income — connected to Sales &amp; Orders and the Dashboard.
      </p>
      <InvestorDashboard
        investor={data.primary}
        agreement={data.agreement}
        monthlyRows={data.monthlyRows}
        currentMetrics={data.currentMetrics}
        currentShareCents={data.currentShareCents}
        paidYtdCents={data.paidYtdCents}
        accruedUnpaidCents={data.accruedUnpaidCents}
        setupStep={data.setupStep}
        highlightAgreement={props.highlightAgreement}
        currentMonthLabel={data.currentMonthLabel}
        salesPreview={data.salesPreview}
        sanityOrderCount={data.sanityOrderCount}
        sanityGrossCents={data.sanityGrossCents}
      />
    </>
  );
}
