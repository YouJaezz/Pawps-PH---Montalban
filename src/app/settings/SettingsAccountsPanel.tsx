import {
  AccountsTable,
  AddAccountForm,
  ChangePasswordForm,
} from "@/app/settings/SettingsPanel";
import { toggleAccountActive } from "@/app/settings/actions";
import { listUsers } from "@/db/queries/users";

export async function SettingsAccountsPanel(props: { currentUserId: number }) {
  const accounts = await listUsers();

  return (
    <>
      <p className="mb-4 text-sm text-zinc-400">
        Manage your password and team accounts.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Change password</div>
          <ChangePasswordForm />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Add account</div>
          <AddAccountForm />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 text-sm font-medium text-zinc-100">
          Accounts ({accounts.length})
        </div>
        <AccountsTable
          accounts={accounts}
          currentUserId={props.currentUserId}
          toggleAction={toggleAccountActive}
        />
      </div>
    </>
  );
}
