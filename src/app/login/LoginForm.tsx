"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/login/actions";

const fieldClass =
  "app-select w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";

export function LoginForm(props: { nextPath: string }) {
  const [state, formAction, pending] = useActionState<LoginState | null, FormData>(
    loginAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={props.nextPath} />

      <label className="block space-y-1">
        <span className="text-sm font-medium text-zinc-700">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className={fieldClass}
          placeholder="you@example.com"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-zinc-700">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={fieldClass}
        />
      </label>

      {state?.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-blue py-2 text-sm font-semibold text-white hover:bg-brand-blue/90 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
