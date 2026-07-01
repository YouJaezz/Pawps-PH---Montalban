import { redirect } from "next/navigation";

import { payrollInvestorsHref } from "@/lib/nav-urls";

export default async function InvestorsPage(props: {
  searchParams: Promise<{ step?: string }>;
}) {
  const sp = await props.searchParams;
  const href =
    sp.step === "agreement"
      ? `${payrollInvestorsHref}&step=agreement`
      : payrollInvestorsHref;
  redirect(href);
}
