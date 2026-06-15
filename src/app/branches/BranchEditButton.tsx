"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { updateBranch } from "@/app/branches/actions";

export type BranchTableRow = {
  id: number;
  name: string;
  location: string | null;
  notes: string | null;
  isDefault: boolean;
  active: boolean;
  productCount: number;
  stockLineCount: number;
};

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-zinc-50 outline-none focus:border-white/20";

export function BranchEditButton(props: { branch: BranchTableRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const b = props.branch;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-brand-blue/30 px-2 py-0.5 text-[10px] text-brand-blue hover:bg-brand-blue/10"
      >
        Edit
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl border border-white/10 bg-surface-elevated p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-zinc-50">Edit branch</h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  try {
                    await updateBranch(fd);
                    setOpen(false);
                    router.refresh();
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "Save failed.");
                  }
                });
              }}
            >
              <input type="hidden" name="branchId" value={b.id} />
              <label className="block space-y-1">
                <span className="text-xs text-zinc-400">Branch name *</span>
                <input
                  name="name"
                  required
                  defaultValue={b.name}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-400">Location</span>
                <input
                  name="location"
                  defaultValue={b.location ?? ""}
                  placeholder="Address or area"
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-400">Notes</span>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={b.notes ?? ""}
                  className={inputClass}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  name="isDefault"
                  defaultChecked={b.isDefault}
                  className="size-4 accent-white"
                />
                Default branch (shop sales deduct stock here)
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-lg bg-zinc-50 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
