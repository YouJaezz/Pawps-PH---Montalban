"use client";

import { useActionState, useMemo, useState } from "react";

import {
  changeOwnPassword,
  createAccount,
  type SettingsActionResult,
} from "@/app/settings/actions";
import { TableToolbar } from "@/components/TableToolbar";
import { matchesQuery, rowSearchText } from "@/lib/table-filter";

const fieldClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20";

function ResultBanner(props: { state: SettingsActionResult | null }) {
  if (!props.state) return null;
  if (props.state.error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">
        {props.state.error}
      </div>
    );
  }
  if (props.state.ok && props.state.message) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-300">
        {props.state.message}
      </div>
    );
  }
  return null;
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<
    SettingsActionResult | null,
    FormData
  >(changeOwnPassword, null);

  return (
    <form action={formAction} className="space-y-3">
      <ResultBanner state={state} />
      <label className="block space-y-0.5">
        <span className="text-[11px] text-zinc-400">Current password</span>
        <input
          name="currentPassword"
          type="password"
          required
          className={fieldClass}
        />
      </label>
      <label className="block space-y-0.5">
        <span className="text-[11px] text-zinc-400">New password</span>
        <input name="newPassword" type="password" required className={fieldClass} />
      </label>
      <label className="block space-y-0.5">
        <span className="text-[11px] text-zinc-400">Confirm new password</span>
        <input
          name="confirmPassword"
          type="password"
          required
          className={fieldClass}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-zinc-100 hover:bg-white/15 disabled:opacity-50"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

export function AddAccountForm() {
  const [state, formAction, pending] = useActionState<
    SettingsActionResult | null,
    FormData
  >(createAccount, null);

  return (
    <form action={formAction} className="space-y-3">
      <ResultBanner state={state} />
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 space-y-0.5">
          <span className="text-[11px] text-zinc-400">Email *</span>
          <input name="email" type="email" required className={fieldClass} />
        </label>
        <label className="space-y-0.5">
          <span className="text-[11px] text-zinc-400">Name</span>
          <input name="name" className={fieldClass} />
        </label>
        <label className="space-y-0.5">
          <span className="text-[11px] text-zinc-400">Role</span>
          <select name="role" className={fieldClass} defaultValue="staff">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="col-span-2 space-y-0.5">
          <span className="text-[11px] text-zinc-400">Password *</span>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className={fieldClass}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Add account"}
      </button>
    </form>
  );
}

export type AccountRow = {
  id: number;
  email: string;
  name: string | null;
  role: "admin" | "staff";
  active: boolean;
};

export function AccountsTable(props: {
  accounts: AccountRow[];
  currentUserId: number;
  toggleAction: (formData: FormData) => Promise<void>;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return props.accounts;
    return props.accounts.filter((u) =>
      matchesQuery(rowSearchText([u.email, u.name, u.role]), query),
    );
  }, [props.accounts, query]);

  return (
    <div>
      <TableToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search email, name…"
        shown={filtered.length}
        total={props.accounts.length}
      />
      <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-xs">
        <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
          <tr>
            <th className="px-2 py-2">Email</th>
            <th className="px-2 py-2">Name</th>
            <th className="px-2 py-2">Role</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {filtered.length === 0 ? (
            <tr>
              <td className="px-2 py-4 text-zinc-500" colSpan={5}>
                {props.accounts.length === 0
                  ? "No accounts yet."
                  : "No accounts match your search."}
              </td>
            </tr>
          ) : (
          filtered.map((u) => (
            <tr key={u.id} className="hover:bg-white/5">
              <td className="px-2 py-2 text-zinc-200">{u.email}</td>
              <td className="px-2 py-2 text-zinc-400">{u.name ?? "—"}</td>
              <td className="px-2 py-2 capitalize text-zinc-400">{u.role}</td>
              <td className="px-2 py-2">
                {u.active ? (
                  <span className="text-emerald-400">Active</span>
                ) : (
                  <span className="text-zinc-500">Inactive</span>
                )}
              </td>
              <td className="px-2 py-2">
                {u.id === props.currentUserId ? (
                  <span className="text-zinc-600">You</span>
                ) : (
                  <form action={props.toggleAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button
                      type="submit"
                      className="text-[11px] text-zinc-300 underline hover:text-zinc-100"
                    >
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))
          )}
        </tbody>
      </table>
    </div>
    </div>
  );
}
