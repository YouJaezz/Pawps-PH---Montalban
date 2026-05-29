import { AppShell } from "@/components/AppShell";
import {
  AccountsTable,
  AddAccountForm,
  ChangePasswordForm,
} from "@/app/settings/SettingsPanel";
import { toggleAccountActive } from "@/app/settings/actions";
import { listUsers } from "@/db/queries/users";
import { requireAdmin } from "@/lib/auth-guard";

export default async function SettingsPage() {
  const session = await requireAdmin();
  const accounts = await listUsers();

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-400">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Manage your password and team accounts.
        </p>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">
              Change password
            </div>
            <ChangePasswordForm />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">
              Add account
            </div>
            <AddAccountForm />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">
            Accounts ({accounts.length})
          </div>
          <AccountsTable
            accounts={accounts}
            currentUserId={session.userId}
            toggleAction={toggleAccountActive}
          />
        </div>
      </div>
    </AppShell>
  );
}
