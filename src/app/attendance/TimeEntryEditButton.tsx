"use client";

import { useActionState, useEffect, useState } from "react";

import {
  updateTimeEntry,
  type AttendanceActionResult,
} from "@/app/attendance/actions";
import { toPhDatetimeLocalValue } from "@/lib/ph-time";

function EditBanner(props: { state: AttendanceActionResult | null }) {
  if (!props.state) return null;
  if (props.state.error) {
    return (
      <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
        {props.state.error}
      </div>
    );
  }
  if (props.state.ok && props.state.message) {
    return (
      <div className="mt-3 rounded-lg border border-brand-blue/30 bg-brand-blue/10 px-3 py-2 text-xs text-brand-cyan/80">
        {props.state.message}
      </div>
    );
  }
  return null;
}

export function TimeEntryEditButton(props: {
  entryId: number;
  employeeName: string;
  clockInAt: Date;
  clockOutAt: Date | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    AttendanceActionResult | null,
    FormData
  >(updateTimeEntry, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state?.ok]);

  function close() {
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-brand-blue hover:underline"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-xl">
        <div className="text-sm font-medium text-zinc-100">Edit time entry</div>
        <p className="mt-1 text-xs text-zinc-400">{props.employeeName}</p>
        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="entryId" value={props.entryId} />
          <label className="block text-xs text-zinc-300">
            Time in (PH)
            <input
              type="datetime-local"
              name="clockInAt"
              defaultValue={toPhDatetimeLocalValue(props.clockInAt)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100"
              required
            />
          </label>
          <label className="block text-xs text-zinc-300">
            Time out (PH)
            <input
              type="datetime-local"
              name="clockOutAt"
              defaultValue={
                props.clockOutAt ? toPhDatetimeLocalValue(props.clockOutAt) : ""
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100"
            />
            <span className="mt-1 block text-[10px] text-zinc-500">
              Leave empty only if still on duty (rare after auto time-out).
            </span>
          </label>
          <EditBanner state={state} />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-blue/20 px-4 py-2 text-xs font-medium text-brand-cyan ring-1 ring-brand-blue/40 hover:bg-brand-blue/30 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save times"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
