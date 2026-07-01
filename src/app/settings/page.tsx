import { BranchesPanel } from "@/app/branches/BranchesPanel";
import { SettingsAccountsPanel } from "@/app/settings/SettingsAccountsPanel";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs } from "@/components/SectionTabs";
import { requireAdmin } from "@/lib/auth-guard";
import { settingsAccountsHref, settingsBranchesHref } from "@/lib/nav-urls";

export default async function SettingsPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAdmin();
  const sp = await props.searchParams;
  const activeTab = sp.tab === "branches" ? "branches" : "accounts";

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <PageHeader
          eyebrow="Admin"
          title="Settings"
          description="Team accounts, passwords, and stock branch locations."
        />

        <div className="mt-4">
          <SectionTabs
            activeTab={activeTab}
            tabs={[
              { id: "accounts", label: "Team & accounts", href: settingsAccountsHref },
              { id: "branches", label: "Branches", href: settingsBranchesHref },
            ]}
          />
        </div>

        <div className="mt-6">
          {activeTab === "branches" ? (
            <>
              <p className="mb-4 text-sm text-zinc-400">
                Track where stock is kept — shop, home storage, or other locations.
              </p>
              <BranchesPanel />
            </>
          ) : (
            <SettingsAccountsPanel currentUserId={session.userId} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
