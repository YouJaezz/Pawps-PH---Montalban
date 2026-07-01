import { CustomersPanel } from "@/app/customers/CustomersPanel";
import { PreOrdersPanel } from "@/app/preorders/PreOrdersPanel";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs } from "@/components/SectionTabs";
import { customersHref, customersPreordersHref } from "@/lib/nav-urls";

export default async function CustomersPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await props.searchParams;
  const activeTab = sp.tab === "preorders" ? "preorders" : "customers";

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <PageHeader
          eyebrow="Customers"
          title={activeTab === "preorders" ? "Pre-orders" : "Customers"}
          description="CRM for online buyers and customer pre-orders before stock arrives."
        />

        <div className="mt-4">
          <SectionTabs
            activeTab={activeTab}
            tabs={[
              { id: "customers", label: "Customers", href: customersHref },
              { id: "preorders", label: "Pre-orders", href: customersPreordersHref },
            ]}
          />
        </div>

        <div className="mt-6">
          {activeTab === "preorders" ? <PreOrdersPanel /> : <CustomersPanel />}
        </div>
      </div>
    </AppShell>
  );
}
