"use client";

import { useActionState } from "react";

import {
  uploadSupplierCatalog,
  type UploadCatalogResult,
} from "@/app/suppliers/actions";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20";

export function UploadCatalogForm(props: {
  suppliers: { id: number; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<
    UploadCatalogResult | null,
    FormData
  >(uploadSupplierCatalog, null);

  return (
    <form action={formAction} className="mt-2 space-y-1.5">
      <label className="block space-y-0.5">
        <span className="text-[11px] text-zinc-400">Supplier *</span>
        <select
          name="supplierId"
          required
          className={inputClass}
          defaultValue={props.suppliers[0]?.id ?? ""}
        >
          {props.suppliers.length === 0 ? (
            <option value="">Add a supplier first</option>
          ) : (
            props.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))
          )}
        </select>
      </label>
      <label className="block space-y-0.5">
        <span className="text-[11px] text-zinc-400">File *</span>
        <input
          name="file"
          type="file"
          required
          accept=".xlsx,.xls,.csv,.txt,.pdf"
          className="w-full text-[11px] text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-zinc-200"
        />
      </label>

      {state?.error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">
          {state.error}
        </div>
      ) : null}

      {state?.ok && state.message ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-300">
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={props.suppliers.length === 0 || pending}
        className="w-full rounded-lg bg-zinc-50 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload & replace"}
      </button>
    </form>
  );
}
