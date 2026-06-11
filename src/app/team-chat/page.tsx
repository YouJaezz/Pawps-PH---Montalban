import { TeamChatPanel } from "@/components/TeamChatPanel";
import { AppShell } from "@/components/AppShell";
import { requireAuth } from "@/lib/auth-guard";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function TeamChatPage() {
  const session = await requireAuth();

  return (
    <AppShell session={session}>
      <div className="w-full px-0 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">Team chat</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Internal messages for staff — notify cashiers, coordinate deliveries, and
          share quick updates.
        </p>
        <div className="mt-6 max-w-2xl">
          <TeamChatPanel
            userId={session.userId}
            isAdmin={isAdmin(session.role)}
          />
        </div>
      </div>
    </AppShell>
  );
}
