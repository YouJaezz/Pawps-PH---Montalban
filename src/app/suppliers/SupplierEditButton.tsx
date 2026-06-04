"use client";

import { useState } from "react";

import { updateSupplier } from "@/app/suppliers/actions";

const inputClass =
  "w-full rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-zinc-50 outline-none";

export function SupplierEditButton(props: {
  supplierId: number;
  name: string;
  contact: string | null;
  location: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 text-[10px] text-[#e8a44a]/90 hover:text-[#e8a44a]"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="mt-1 w-full space-y-1 rounded-lg border border-[#e8a44a]/25 bg-[#e8a44a]/5 p-2">
      <form action={updateSupplier} className="space-y-1">
        <input type="hidden" name="supplierId" value={props.supplierId} />
        <input
          name="name"
          required
          defaultValue={props.name}
          className={inputClass}
        />
        <input
          name="contact"
          defaultValue={props.contact ?? ""}
          placeholder="Contact"
          className={inputClass}
        />
        <input
          name="location"
          defaultValue={props.location ?? ""}
          placeholder="City"
          className={inputClass}
        />
        <div className="flex gap-1">
          <button
            type="submit"
            className="rounded border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-200"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
