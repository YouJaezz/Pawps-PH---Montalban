import { TeamChatPanel } from "@/components/TeamChatPanel";
import { TeamChatPageHeader } from "@/app/team-chat/TeamChatPageHeader";
import { AppShell } from "@/components/AppShell";
import { requireAuth } from "@/lib/auth-guard";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function TeamChatPage() {
  const session = await requireAuth();

  return (
    <AppShell session={session}>
      <div className="w-full px-0 py-4">
        <TeamChatPageHeader />
        <div className="mt-6 max-w-2xl">
          <TeamChatPanel
            userId={session.userId}
            isAdmin={isAdmin(session.role)}
            markReadOnView
          />
        </div>
      </div>
    </AppShell>
  );
}
