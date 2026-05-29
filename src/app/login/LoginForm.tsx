"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/login/actions";

const fieldClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-white/20";

export function LoginForm(props: { nextPath: string }) {
  const [state, formAction, pending] = useActionState<LoginState | null, FormData>(
    loginAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={props.nextPath} />

      <label className="block space-y-1">
        <span className="text-xs text-zinc-400">Email</span>
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
        <span className="text-xs text-zinc-400">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={fieldClass}
        />
      </label>

      {state?.error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-50 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
