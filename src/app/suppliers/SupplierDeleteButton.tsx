"use client";

import { useState } from "react";

import { deleteSupplier } from "@/app/suppliers/actions";

export function SupplierDeleteButton(props: { supplierId: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"disconnect" | "purge">("disconnect");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-red-400/80 hover:text-red-300"
      >
        Remove
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-1 rounded-lg border border-red-500/20 bg-red-500/5 p-2">
      <div className="text-[10px] text-zinc-300">Remove {props.name}?</div>
      <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
        <input
          type="radio"
          name={`mode-${props.supplierId}`}
          checked={mode === "disconnect"}
          onChange={() => setMode("disconnect")}
        />
        Disconnect — keep history, unlink inventory
      </label>
      <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
        <input
          type="radio"
          name={`mode-${props.supplierId}`}
          checked={mode === "purge"}
          onChange={() => setMode("purge")}
        />
        Delete entirely — remove catalog &amp; records
      </label>
      <div className="flex gap-1">
        <form action={deleteSupplier}>
          <input type="hidden" name="supplierId" value={props.supplierId} />
          <input type="hidden" name="mode" value={mode} />
          <button
            type="submit"
            className="rounded border border-red-500/40 px-2 py-0.5 text-[10px] text-red-200"
          >
            Confirm
          </button>
        </form>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
