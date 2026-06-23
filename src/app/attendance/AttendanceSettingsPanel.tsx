"use client";

import { useActionState } from "react";

import {
  updateAttendanceSettings,
  type AttendanceActionResult,
} from "@/app/attendance/actions";
import type { AttendanceSettings } from "@/db/queries/attendance-settings";
import {
  cutoffTimeInputValue,
  formatCutoffLabel,
} from "@/lib/attendance-cutoff";

function SettingsBanner(props: { state: AttendanceActionResult | null }) {
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

export function AttendanceSettingsPanel(props: { settings: AttendanceSettings }) {
  const [state, formAction, pending] = useActionState<
    AttendanceActionResult | null,
    FormData
  >(updateAttendanceSettings, null);

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
      <div className="text-sm font-medium text-amber-100">Attendance rules</div>
      <p className="mt-1 text-xs text-amber-100/75">
        After the cutoff time (Philippines), all open shifts are auto timed-out and
        staff cannot clock in/out until the next day.
      </p>
      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-4">
        <label className="block text-xs text-zinc-300">
          Auto time-out at (PH)
          <input
            type="time"
            name="cutoffTime"
            defaultValue={cutoffTimeInputValue(props.settings)}
            className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100"
            required
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            name="autoCutoffEnabled"
            defaultChecked={props.settings.autoCutoffEnabled}
            className="rounded border-white/20"
          />
          Enable daily auto time-out
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
      </form>
      <p className="mt-2 text-[10px] text-zinc-500">
        Current:{" "}
        {props.settings.autoCutoffEnabled
          ? `everyone timed out at ${formatCutoffLabel(props.settings)} PH`
          : "auto time-out disabled"}
      </p>
      <SettingsBanner state={state} />
    </div>
  );
}
